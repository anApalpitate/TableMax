import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type {
  GameRules,
  BotStrategy,
  JsonValue,
  PublicEvent,
} from '@tablemax/game-sdk';
import {
  CommandSchema,
  AVATAR_PRESETS,
  AvatarIdSchema,
  DEFAULT_COUNTDOWN_SECONDS,
  type AvatarId,
  type Command,
  type CommandReply,
  type CommandStatus,
  type SyncHint,
  type RoomView,
  type RoomFeedback,
  type PlayMode,
} from '@tablemax/protocol';
import type { Save, SaveExtras, SaveRepository } from './model';
import { validateSave } from './save-validation';
import { Rejection, requireThat } from './errors';
import { RandomSource } from './random';
import { sealCredential, openCredential } from './session-receipts';
import { GameRegistry, type LoadedGame } from './game-registry';
import { synchronizeDecisionClocks, projectDecisionClock } from './countdown';
import {
  createTransfer,
  decideTransfer,
  pendingTransfers,
  transferForKey,
  transferState,
} from './device-transfer';

export const token = () => randomBytes(32).toString('hex');
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export type Identity =
  { role: 'public' } | { role: 'host' } | { role: 'player'; seatId: string };
type AvatarImage = { id: AvatarId; png: Uint8Array };
type TrackedCommand = {
  fingerprint: string;
  promise: Promise<CommandReply>;
};
type RejectedCommand = {
  fingerprint: string;
  reply: CommandReply;
  expiresAt: number;
};
const instanceChangingCommands = new Set<Command['command']['type']>([
  'new-room',
  'replay',
  'select-game',
  'select-variant',
  'remove-seat',
]);

// Saved states/checkpoints are immutable after commit. Copy only the containers
// that a command can change, instead of cloning every historical game state.
function copySave(data: Save): Save {
  return {
    ...data,
    seats: data.seats.map((seat) => ({ ...seat })),
    snapshot: data.snapshot
      ? { ...data.snapshot, bots: { ...data.snapshot.bots } }
      : null,
    history: [...data.history],
    receipts: { ...data.receipts },
    sessionReceipts: { ...data.sessionReceipts },
    transferRequests: Object.fromEntries(
      Object.entries(data.transferRequests ?? {}).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ),
  };
}

export class RoomCoordinator {
  private data: Save;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<
    (feedback?: RoomFeedback, savedAt?: number) => void
  >();
  private transientBotError: string | null = null;
  private processingCommands = new Map<string, TrackedCommand>();
  private rejectedCommands = new Map<string, RejectedCommand>();
  readonly hostToken: string;
  private game: LoadedGame | null;
  private registry: GameRegistry;
  restored = false;
  constructor(
    rules: GameRules | null,
    strategy: BotStrategy | null,
    private repository: SaveRepository,
    hostToken = token(),
    initialPlayMode?: PlayMode,
    registry?: GameRegistry,
    loadedSave?: unknown,
    loadedVariantId?: string,
  ) {
    this.hostToken = hostToken;
    requireThat(
      (!rules && !strategy) ||
        (rules &&
          strategy &&
          strategy.gameId === rules.manifest.id &&
          strategy.rulesVersion === rules.manifest.rulesVersion),
      'incompatible-strategy',
    );
    this.game =
      rules && strategy
        ? {
            rules,
            bot: strategy,
            ...(loadedVariantId === undefined
              ? {}
              : { variantId: loadedVariantId }),
          }
        : null;
    const game = this.game;
    this.registry =
      registry ??
      new GameRegistry(
        game
          ? [
              {
                catalog: {
                  id: game.rules.manifest.id,
                  name: game.rules.manifest.name,
                  ...game.rules.manifest.players,
                  decisionTimer: game.rules.manifest.decisionTimer !== false,
                },
                load: async () => game,
              },
            ]
          : [],
      );
    const saved = loadedSave === undefined ? repository.load() : loadedSave;
    this.data =
      saved === null
        ? this.fresh()
        : validateSave(saved, rules, strategy, this.game?.variantId);
    for (const seat of this.data.seats) {
      if (!seat.avatarId?.startsWith('custom-')) continue;
      const png = repository.getAvatar?.(seat.avatarId);
      requireThat(
        png &&
          `custom-${createHash('sha256').update(png).digest('hex')}` ===
            seat.avatarId,
        'damaged-avatar-image',
      );
    }
    let persist =
      saved !== null &&
      (this.data.seats.some(
        (_, index) => (saved as Save).seats[index]!.avatarId === undefined,
      ) ||
        (saved as Save).countdownSeconds === undefined ||
        (saved as Save).decisionClocks === undefined ||
        ((saved as Save).variantId === undefined &&
          this.game?.variantId !== undefined));
    // SQLite journal revisions are unique; migrate an old lobby exactly once.
    if (persist && this.data.status !== 'playing') this.data.revision++;
    if (initialPlayMode !== undefined) {
      requireThat(
        initialPlayMode === 'play' || initialPlayMode === 'test',
        'invalid-play-mode',
      );
      if (this.data.playMode !== initialPlayMode) {
        this.data.playMode = initialPlayMode;
        if (saved !== null) {
          this.data.revision++;
          persist = true;
        }
      }
    }
    if (saved !== null && this.data.status === 'playing') {
      this.restored = true;
      this.data.paused = true;
      this.data.revision++;
      // Invalidate intentions produced before the process stopped.
      this.data.branch++;
      persist = true;
    }
    if (persist) {
      synchronizeDecisionClocks(
        this.data,
        this.data,
        this.game?.rules ?? null,
        Date.now(),
        true,
      );
      this.updateWindows(this.data);
      repository.save(this.data);
    }
  }
  static async open(
    registry: GameRegistry,
    repository: SaveRepository,
    hostToken?: string,
    initialPlayMode?: PlayMode,
  ) {
    const saved = repository.load() as Save | null;
    const game = saved?.manifest
      ? await registry.load(saved.manifest.id, saved.variantId)
      : null;
    const room = new RoomCoordinator(
      game?.rules ?? null,
      game?.bot ?? null,
      repository,
      hostToken,
      initialPlayMode,
      registry,
      saved,
      game?.variantId,
    );
    if (game) room.game = game;
    return room;
  }
  get rules(): GameRules {
    requireThat(this.game, 'game-not-selected');
    return this.game.rules;
  }
  get strategy(): BotStrategy {
    requireThat(this.game, 'game-not-selected');
    return this.game.bot;
  }
  get playMode(): PlayMode {
    return this.data.playMode ?? 'play';
  }
  private fresh(game = this.game): Save {
    const manifest = game?.rules.manifest;
    return {
      formatVersion: 1,
      ...(game?.variantId === undefined ? {} : { variantId: game.variantId }),
      manifest: manifest
        ? {
            id: manifest.id,
            gameVersion: manifest.gameVersion,
            rulesVersion: manifest.rulesVersion,
            stateVersion: manifest.stateVersion,
          }
        : null,
      instanceId: randomUUID(),
      revision: 0,
      branch: 0,
      status: 'lobby',
      paused: false,
      joinOpen: true,
      playMode: 'play',
      countdownSeconds: DEFAULT_COUNTDOWN_SECONDS,
      decisionClocks: [],
      seats: [],
      hostSeat: null,
      ownerSeatId: null,
      gameWindow: null,
      readyWindow: { floor: 0, seats: {} },
      snapshot: null,
      history: [],
      receipts: {},
      sessionReceipts: {},
      transferRequests: {},
      botError: null,
      endReason: null,
    };
  }
  private lobbyWithSeats(game = this.game): Save {
    const fresh = this.fresh(game);
    fresh.playMode = this.data.playMode ?? 'play';
    fresh.countdownSeconds =
      this.data.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
    fresh.seats = this.data.seats.map((seat) => ({
      ...seat,
      ready: seat.controller === 'bot',
    }));
    fresh.ownerSeatId = this.data.ownerSeatId ?? null;
    fresh.sessionReceipts = this.data.sessionReceipts ?? {};
    fresh.transferRequests = this.data.transferRequests ?? {};
    return fresh;
  }
  identity(credential?: string): Identity {
    if (!credential) return { role: 'public' };
    if (hash(credential) === hash(this.hostToken)) return { role: 'host' };
    const seat = this.data.seats.find(
      (s) => s.controller === 'human' && s.tokenHash === hash(credential),
    );
    requireThat(seat, 'invalid-identity');
    return { role: 'player', seatId: seat.id };
  }
  interactionContext() {
    return { instanceId: this.data.instanceId, branch: this.data.branch };
  }
  // Read only when transport viewSeq advances, never on unchanged probes.
  synchronizationState(): {
    instanceId: string;
    branch: number;
    syncHint: SyncHint;
    nextExpiryAt: number | null;
  } {
    const d = this.data;
    const active =
      d.status === 'playing' &&
      !d.paused &&
      d.snapshot !== null &&
      this.rules.decisions(d.snapshot.state).length > 0;
    const expirations = pendingTransfers(d).map((request) => request.expiresAt);
    return {
      ...this.interactionContext(),
      syncHint: active ? 'active' : 'idle',
      nextExpiryAt: expirations.length ? Math.min(...expirations) : null,
    };
  }
  subscribe(listener: (feedback?: RoomFeedback, savedAt?: number) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify(feedback?: RoomFeedback, savedAt?: number) {
    for (const listener of this.listeners) {
      try {
        listener(feedback, savedAt);
      } catch {
        /* Observer failure cannot undo a committed action or its ACK. */
      }
    }
  }
  private enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    const pending = this.queue.then(operation);
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  private commit(
    next: Save,
    clearBotError = false,
    events: PublicEvent[] = [],
    game = this.game,
    extras?: SaveExtras,
  ) {
    synchronizeDecisionClocks(next, this.data, game?.rules ?? null, Date.now());
    this.repository.save(next, extras);
    const savedAt = performance.now();
    this.data = next;
    this.game = game;
    if (clearBotError) this.transientBotError = null;
    this.notify(
      events.length
        ? {
            instanceId: next.instanceId,
            branch: next.branch,
            revision: next.revision,
            events,
          }
        : undefined,
      savedAt,
    );
  }
  private sessionResult(requestKey: string | undefined, fingerprint: string) {
    if (!requestKey) return null;
    requireThat(/^[0-9a-f]{64}$/.test(requestKey), 'invalid-message');
    const receipt = this.data.sessionReceipts?.[hash(requestKey)];
    if (!receipt) return null;
    requireThat(
      receipt.fingerprint === fingerprint,
      'session-request-conflict',
    );
    requireThat(receipt.expires > Date.now(), 'session-request-expired');
    const credential = openCredential(receipt.sealedCredential, requestKey);
    requireThat(
      this.data.seats.some(
        (s) => s.id === receipt.seatId && s.tokenHash === hash(credential),
      ),
      'session-request-revoked',
    );
    return { token: credential, duplicateName: receipt.duplicateName };
  }
  private rememberSession(
    next: Save,
    requestKey: string | undefined,
    fingerprint: string,
    seatId: string,
    credential: string,
    duplicateName = false,
  ) {
    if (!requestKey) return;
    next.sessionReceipts = Object.fromEntries(
      Object.entries(next.sessionReceipts ?? {}).filter(
        ([, r]) =>
          r.expires > Date.now() && next.seats.some((s) => s.id === r.seatId),
      ),
    );
    requireThat(
      Object.keys(next.sessionReceipts).length < 128,
      'session-request-limit',
    );
    next.sessionReceipts[hash(requestKey)] = {
      fingerprint,
      seatId,
      sealedCredential: sealCredential(credential, requestKey),
      duplicateName,
      expires: Date.now() + 24 * 60 * 60 * 1000,
    };
  }
  private availableAvatar(
    avatarId?: AvatarId,
    seatId?: string,
    image?: AvatarImage,
  ): AvatarId {
    const occupied = new Set(
      this.data.seats
        .filter((seat) => seat.id !== seatId)
        .map((seat) => seat.avatarId),
    );
    if (avatarId !== undefined) {
      requireThat(AvatarIdSchema.safeParse(avatarId).success, 'invalid-avatar');
      if (avatarId.startsWith('custom-')) {
        requireThat(
          image?.id === avatarId ||
            (this.data.seats.some(
              (seat) => seat.id === seatId && seat.avatarId === avatarId,
            ) &&
              this.repository.getAvatar?.(avatarId)),
          'invalid-avatar',
        );
        return avatarId;
      }
      requireThat(!occupied.has(avatarId), 'avatar-unavailable');
      return avatarId as AvatarId;
    }
    const preset = AVATAR_PRESETS.find((entry) => !occupied.has(entry.id));
    requireThat(preset, 'avatar-unavailable');
    return preset.id;
  }
  async join(
    name: string,
    requestKey?: string,
    avatarId?: AvatarId,
    image?: AvatarImage,
  ) {
    return this.enqueue(() => {
      requireThat(
        avatarId === undefined || AvatarIdSchema.safeParse(avatarId).success,
        'invalid-avatar',
      );
      const fingerprint = hash(
        avatarId === undefined
          ? `join:${name}`
          : JSON.stringify(['join', name, avatarId]),
      );
      const previous = this.sessionResult(requestKey, fingerprint);
      if (previous) return previous;
      requireThat(this.game, 'game-not-selected');
      requireThat(
        this.data.status === 'lobby' && this.data.joinOpen,
        'joining-closed',
      );
      requireThat(
        this.data.seats.length < this.rules.manifest.players.max,
        'room-full',
      );
      const credential = token();
      const next = copySave(this.data);
      const duplicateName = next.seats.some((s) => s.name === name);
      const seatId = randomUUID();
      const selectedAvatar = this.availableAvatar(avatarId, undefined, image);
      next.seats.push({
        id: seatId,
        name,
        avatarId: selectedAvatar,
        controller: 'human',
        ready: false,
        tokenHash: hash(credential),
      });
      this.rememberSession(
        next,
        requestKey,
        fingerprint,
        seatId,
        credential,
        duplicateName,
      );
      next.revision++;
      this.updateWindows(next);
      this.commit(
        next,
        false,
        [],
        this.game,
        image ? { avatars: [image] } : undefined,
      );
      return { token: credential, duplicateName };
    });
  }
  requestTransfer(seatId: string, requestKey: string) {
    return this.enqueue(() => {
      requireThat(/^[0-9a-f]{64}$/.test(requestKey), 'invalid-message');
      const previous = this.data.transferRequests?.[hash(requestKey)];
      if (previous) {
        requireThat(previous.seatId === seatId, 'session-request-conflict');
        return transferState(this.data, previous, requestKey);
      }
      const next = copySave(this.data);
      const request = createTransfer(next, seatId, requestKey);
      next.revision++;
      // Metadata does not close independent game/ready windows or reset clocks.
      this.commit(next);
      return transferState(next, request, requestKey);
    });
  }
  transferStatus(requestKey: string) {
    return transferState(
      this.data,
      transferForKey(this.data, requestKey),
      requestKey,
    );
  }
  cancelTransfer(requestKey: string) {
    return this.enqueue(() => {
      const current = this.transferStatus(requestKey);
      if (current.status !== 'pending') return current;
      const next = copySave(this.data);
      transferForKey(next, requestKey).status = 'cancelled';
      next.revision++;
      this.commit(next);
      return transferState(next, transferForKey(next, requestKey), requestKey);
    });
  }
  view(credential?: string, online: ReadonlySet<string> = new Set()): RoomView {
    const identity = this.identity(credential);
    const d = this.data;
    const seatId = identity.role === 'player' ? identity.seatId : null;
    const snap = d.snapshot;
    const pending =
      snap && seatId
        ? this.rules.decisions(snap.state).find((p) => p.seatId === seatId)
        : undefined;
    return {
      instanceId: d.instanceId,
      revision: d.revision,
      branch: d.branch,
      status: d.status,
      paused: d.paused,
      restored: this.restored,
      joinOpen: d.joinOpen,
      playMode: this.playMode,
      countdownSeconds: d.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS,
      decisionClock: projectDecisionClock(
        d,
        this.game?.rules ?? null,
        seatId,
        Date.now(),
      ),
      game: this.game
        ? {
            id: this.rules.manifest.id,
            name: this.rules.manifest.name,
            ...this.rules.manifest.players,
            decisionTimer: this.rules.manifest.decisionTimer !== false,
            ...(d.variantId === undefined ? {} : { variantId: d.variantId }),
          }
        : null,
      catalog: this.registry.catalog(),
      ownerSeatId: d.ownerSeatId ?? null,
      ...(identity.role === 'host'
        ? { transferRequests: pendingTransfers(d) }
        : {}),
      capabilities: {
        manage: identity.role === 'host',
        manageSeats: this.managesSeats(identity),
        control: this.controls(identity),
      },
      seats: d.seats.map(
        ({ id, name, avatarId, controller, ready, botDifficulty }) => ({
          id,
          name,
          avatarId: avatarId!,
          controller,
          ready,
          online: controller === 'bot' || online.has(id),
          botDifficulty:
            controller === 'bot' ? (botDifficulty ?? 'default') : null,
        }),
      ),
      self: { role: identity.role, seatId },
      gameView: snap
        ? this.rules.project(
            structuredClone(snap.state),
            seatId ? { role: 'player', seatId } : { role: 'public' },
          )
        : null,
      decisionId: pending?.id ?? null,
      selectionToken: pending?.id ?? null,
      actions:
        pending && !d.paused && d.status === 'playing'
          ? [...this.rules.legalActions(structuredClone(snap!.state), seatId!)]
          : [],
      history:
        identity.role === 'host'
          ? d.history.map(
              (
                { id, label, revealedInformation, seatId, roundNumber },
                index,
              ) => ({
                id,
                label,
                revealedInformation,
                step: index + 1,
                seatId: seatId ?? null,
                roundNumber: roundNumber ?? null,
              }),
            )
          : [],
      lifecycleActions:
        this.controls(identity) &&
        snap &&
        !d.paused &&
        !['房主结束', '管理员结束'].includes(d.endReason ?? '')
          ? [...this.rules.lifecycleActions(structuredClone(snap.state))]
          : [],
      botError: d.botError ?? this.transientBotError,
      endReason: d.endReason,
    };
  }
  private controls(identity: Identity) {
    return (
      identity.role === 'host' ||
      (identity.role === 'player' && identity.seatId === this.data.ownerSeatId)
    );
  }
  private managesSeats(identity: Identity) {
    return this.controls(identity);
  }
  private acceptsRevision(identity: Identity, envelope: Command) {
    if (envelope.revision === this.data.revision) return true;
    if (envelope.revision > this.data.revision || identity.role !== 'player')
      return false;
    const command = envelope.command;
    if (command.type === 'ready' && this.data.status === 'lobby') {
      const window = this.data.readyWindow;
      return (
        !!window &&
        envelope.revision >= window.floor &&
        envelope.revision >= (window.seats[identity.seatId] ?? window.floor)
      );
    }
    if (
      command.type !== 'game' ||
      !this.data.snapshot ||
      this.data.paused ||
      this.data.status !== 'playing'
    )
      return false;
    const pending = this.rules
      .decisions(this.data.snapshot.state)
      .find(
        (decision) =>
          decision.seatId === identity.seatId &&
          decision.id === command.decisionId,
      );
    const window = this.data.gameWindow;
    return (
      !!window &&
      !!pending?.concurrencyGroup &&
      pending.concurrencyGroup === window.group &&
      envelope.revision >= window.floor
    );
  }
  private updateWindows(
    next: Save,
    command?: Command['command'],
    identity?: Identity,
  ) {
    const ready = command?.type === 'ready' && identity?.role === 'player';
    next.readyWindow =
      ready && this.data.readyWindow
        ? {
            floor: this.data.readyWindow.floor,
            seats: {
              ...this.data.readyWindow.seats,
              [identity.seatId]: next.revision,
            },
          }
        : { floor: next.revision, seats: {} };
    const group =
      next.snapshot && !next.paused && next.status === 'playing'
        ? this.rules.decisions(next.snapshot.state)[0]?.concurrencyGroup
        : undefined;
    const submittedGroup =
      command?.type === 'game' &&
      identity?.role === 'player' &&
      this.data.snapshot
        ? this.rules
            .decisions(this.data.snapshot.state)
            .find(
              (decision) =>
                decision.seatId === identity.seatId &&
                decision.id === command.decisionId,
            )?.concurrencyGroup
        : undefined;
    next.gameWindow = group
      ? {
          group,
          floor:
            submittedGroup === group && this.data.gameWindow?.group === group
              ? this.data.gameWindow.floor
              : next.revision,
        }
      : null;
  }
  command(
    credential: string | undefined,
    input: unknown,
  ): Promise<CommandReply> {
    return this.trackCommand(credential, input);
  }
  uploadAvatar(
    credential: string,
    metadata: Omit<Command, 'command'>,
    image: AvatarImage,
  ): Promise<CommandReply> {
    return this.trackCommand(
      credential,
      { ...metadata, command: { type: 'set-avatar', avatarId: image.id } },
      image,
    );
  }
  private commandKeys(identity: Identity, envelope: Command) {
    requireThat(identity.role !== 'public', 'unauthorized');
    const principal = identity.role === 'host' ? 'host' : identity.seatId;
    const key = hash(`${principal}:${envelope.actionId}`);
    return {
      key,
      trackingKey: `${key}:${envelope.instanceId}:${envelope.branch}`,
      fingerprint: hash(JSON.stringify(envelope)),
    };
  }
  private commandFailure(error: unknown): Extract<CommandReply, { ok: false }> {
    return {
      ok: false,
      reason:
        error instanceof Rejection ? error.message : 'save-or-action-failed',
    };
  }
  private pruneRejectedCommands() {
    const now = Date.now();
    for (const [key, result] of this.rejectedCommands)
      if (result.expiresAt <= now) this.rejectedCommands.delete(key);
  }
  private trackCommand(
    credential: string | undefined,
    input: unknown,
    image?: AvatarImage,
  ): Promise<CommandReply> {
    try {
      const parsed = CommandSchema.safeParse(input);
      requireThat(parsed.success, 'invalid-message');
      const envelope = parsed.data;
      const identity = this.identity(credential);
      if (image) requireThat(identity.role === 'player', 'unauthorized');
      const { trackingKey, fingerprint } = this.commandKeys(identity, envelope);
      const existing = this.processingCommands.get(trackingKey);
      if (existing) {
        requireThat(existing.fingerprint === fingerprint, 'action-id-conflict');
        return existing.promise;
      }
      const promise = this.enqueue(async () => {
        try {
          // An approval/removal queued before this intent may revoke its owner.
          const currentIdentity = this.identity(credential);
          if (image)
            requireThat(currentIdentity.role === 'player', 'unauthorized');
          return await this.execute(
            currentIdentity,
            envelope,
            undefined,
            image,
          );
        } catch (error) {
          return this.commandFailure(error);
        }
      }).then((reply) => {
        if (this.processingCommands.get(trackingKey) === tracked)
          this.processingCommands.delete(trackingKey);
        this.pruneRejectedCommands();
        if (!reply.ok) {
          this.rejectedCommands.delete(trackingKey);
          this.rejectedCommands.set(trackingKey, {
            fingerprint,
            reply,
            expiresAt: Date.now() + 60_000,
          });
          if (this.rejectedCommands.size > 256)
            this.rejectedCommands.delete(
              this.rejectedCommands.keys().next().value!,
            );
        } else this.rejectedCommands.delete(trackingKey);
        return reply;
      });
      const tracked: TrackedCommand = { fingerprint, promise };
      this.processingCommands.set(trackingKey, tracked);
      return promise;
    } catch (error) {
      return Promise.resolve(this.commandFailure(error));
    }
  }
  // A query never joins the action queue and never executes or saves an intent.
  commandStatus(credential: string | undefined, input: unknown): CommandStatus {
    try {
      const identity = this.identity(credential);
      const parsed = CommandSchema.safeParse(input);
      requireThat(parsed.success, 'invalid-message');
      const envelope = parsed.data;
      const { key, trackingKey, fingerprint } = this.commandKeys(
        identity,
        envelope,
      );
      const receipt = this.data.receipts[key];
      // Existing instance-changing command acknowledgements remain recoverable.
      if (
        envelope.instanceId !== this.data.instanceId &&
        instanceChangingCommands.has(envelope.command.type) &&
        receipt?.fingerprint === fingerprint
      )
        return { status: 'completed', reply: receipt.reply };
      requireThat(
        envelope.instanceId === this.data.instanceId,
        'stale-instance',
      );
      requireThat(envelope.branch === this.data.branch, 'stale-branch');
      if (receipt) {
        requireThat(receipt.fingerprint === fingerprint, 'action-id-conflict');
        return { status: 'completed', reply: receipt.reply };
      }
      const processing = this.processingCommands.get(trackingKey);
      if (processing) {
        requireThat(
          processing.fingerprint === fingerprint,
          'action-id-conflict',
        );
        return { status: 'processing' };
      }
      this.pruneRejectedCommands();
      const rejected = this.rejectedCommands.get(trackingKey);
      if (rejected) {
        requireThat(rejected.fingerprint === fingerprint, 'action-id-conflict');
        return { status: 'completed', reply: rejected.reply };
      }
      return { status: 'unknown' };
    } catch (error) {
      const failure = this.commandFailure(error);
      return {
        status: 'unqueryable',
        reason: failure.reason,
      };
    }
  }
  private async execute(
    identity: Identity,
    envelope: Command,
    botUpdate?: { memory: JsonValue; random: number },
    image?: AvatarImage,
  ): Promise<CommandReply> {
    requireThat(identity.role !== 'public', 'unauthorized');
    const { key, fingerprint } = this.commandKeys(identity, envelope);
    const receipt = this.data.receipts[key];
    if (
      envelope.instanceId !== this.data.instanceId &&
      instanceChangingCommands.has(envelope.command.type) &&
      receipt?.fingerprint === fingerprint
    )
      return receipt.reply;
    requireThat(envelope.instanceId === this.data.instanceId, 'stale-instance');
    requireThat(envelope.branch === this.data.branch, 'stale-branch');
    if (receipt) {
      requireThat(receipt.fingerprint === fingerprint, 'action-id-conflict');
      return receipt.reply;
    }
    // Report a lost race even if another claimant advanced the revision.
    // Other stale avatar changes still obey the normal revision boundary.
    if (envelope.command.type === 'set-avatar') {
      requireThat(identity.role === 'player', 'unauthorized');
      requireThat(this.data.status !== 'playing', 'avatars-locked');
      this.availableAvatar(envelope.command.avatarId, identity.seatId, image);
    }
    requireThat(this.acceptsRevision(identity, envelope), 'stale-revision');
    if (botUpdate)
      requireThat(envelope.revision === this.data.revision, 'stale-revision');
    let next = copySave(this.data);
    const c = envelope.command;
    const host = () => requireThat(identity.role === 'host', 'unauthorized');
    const control = () => requireThat(this.controls(identity), 'unauthorized');
    const manageSeats = () =>
      requireThat(this.managesSeats(identity), 'unauthorized');
    const lobby = () => requireThat(next.status === 'lobby', 'not-in-lobby');
    let events: PublicEvent[] = [];
    switch (c.type) {
      case 'approve-transfer':
      case 'reject-transfer':
        host();
        decideTransfer(next, c.requestId, c.type === 'approve-transfer');
        break;
      case 'set-owner':
        host();
        requireThat(
          c.seatId === null ||
            next.seats.some(
              (seat) => seat.id === c.seatId && seat.controller === 'human',
            ),
          'invalid-seat',
        );
        next.ownerSeatId = c.seatId;
        break;
      case 'select-variant':
      case 'select-game': {
        host();
        if (c.type === 'select-variant')
          requireThat(next.status !== 'playing', 'end-first');
        const gameId =
          c.type === 'select-game' ? c.gameId : this.game?.rules.manifest.id;
        requireThat(gameId, 'game-not-selected');
        requireThat(
          next.status !== 'playing' ||
            (c.type === 'select-game' && c.endCurrent === true),
          'end-first',
        );
        const catalog = this.registry
          .catalog()
          .find((entry) => entry.id === gameId);
        requireThat(catalog, 'unknown-game');
        requireThat(next.seats.length <= catalog.max, 'too-many-seats');
        if (
          this.game?.rules.manifest.id === gameId &&
          next.status === 'lobby' &&
          (c.type === 'select-game' || c.variantId === next.variantId)
        )
          break;
        let game: LoadedGame;
        try {
          game = await this.registry.load(
            gameId,
            c.type === 'select-variant' ? c.variantId : undefined,
          );
        } catch {
          throw new Rejection('game-load-failed');
        }
        requireThat(
          next.seats.every(
            (seat) =>
              seat.controller !== 'bot' ||
              (game.bot.difficulties ?? ['default']).includes(
                seat.botDifficulty ?? 'default',
              ),
          ),
          'unsupported-bot-difficulty',
        );
        let extras: SaveExtras | undefined;
        if (next.status === 'playing') {
          next.status = 'ended';
          next.endReason = '管理员结束';
          next.revision++;
          this.updateWindows(next);
          synchronizeDecisionClocks(
            next,
            this.data,
            this.game?.rules ?? null,
            Date.now(),
          );
          extras = { journal: [next] };
        }
        const fresh = this.lobbyWithSeats(game);
        const reply: CommandReply = {
          ok: true,
          revision: fresh.revision,
          branch: fresh.branch,
        };
        fresh.receipts[key] = { fingerprint, reply };
        this.commit(fresh, true, [], game, extras);
        this.restored = false;
        return reply;
      }
      case 'set-play-mode':
        host();
        next.playMode = c.mode;
        break;
      case 'set-countdown':
        host();
        requireThat(
          this.game?.rules.manifest.decisionTimer !== false,
          'invalid-setting',
        );
        next.countdownSeconds = c.seconds;
        break;
      case 'join-open':
        host();
        lobby();
        next.joinOpen = c.open;
        break;
      case 'ready': {
        lobby();
        requireThat(identity.role === 'player', 'unauthorized');
        next.seats.find((s) => s.id === identity.seatId)!.ready = c.ready;
        break;
      }
      case 'set-avatar': {
        requireThat(identity.role === 'player', 'unauthorized');
        requireThat(next.status !== 'playing', 'avatars-locked');
        const seat = next.seats.find(
          (entry) =>
            entry.id === identity.seatId && entry.controller === 'human',
        );
        requireThat(seat, 'unauthorized');
        seat.avatarId = this.availableAvatar(c.avatarId, seat.id, image);
        break;
      }
      case 'add-bot':
        host();
        lobby();
        requireThat(
          (this.strategy.difficulties ?? ['default']).includes(
            c.difficulty ?? 'default',
          ),
          'unsupported-bot-difficulty',
        );
        requireThat(
          next.seats.length < this.rules.manifest.players.max,
          'room-full',
        );
        next.seats.push({
          id: randomUUID(),
          name: c.name,
          avatarId: this.availableAvatar(),
          controller: 'bot',
          ready: true,
          tokenHash: null,
          botDifficulty: c.difficulty ?? 'default',
        });
        break;
      case 'set-bot-difficulty': {
        host();
        lobby();
        const seat = next.seats.find(
          (s) => s.id === c.seatId && s.controller === 'bot',
        );
        requireThat(seat, 'invalid-seat');
        requireThat(
          (this.strategy.difficulties ?? ['default']).includes(c.difficulty),
          'unsupported-bot-difficulty',
        );
        seat.botDifficulty = c.difficulty;
        break;
      }
      case 'set-bot-name': {
        manageSeats();
        requireThat(next.status !== 'playing', 'end-first');
        const seat = next.seats.find(
          (s) => s.id === c.seatId && s.controller === 'bot',
        );
        requireThat(seat, 'invalid-seat');
        seat.name = c.name;
        break;
      }
      case 'remove-seat':
        manageSeats();
        requireThat(next.status !== 'playing', 'end-first');
        requireThat(
          identity.role !== 'player' || identity.seatId !== c.seatId,
          'cannot-remove-self',
        );
        requireThat(
          next.seats.some((s) => s.id === c.seatId),
          'invalid-seat',
        );
        if (next.status === 'ended') next = this.lobbyWithSeats();
        next.seats = next.seats.filter((s) => s.id !== c.seatId);
        if (next.hostSeat === c.seatId) next.hostSeat = null;
        if (next.ownerSeatId === c.seatId) next.ownerSeatId = null;
        break;
      case 'order':
        host();
        lobby();
        requireThat(
          c.seats.length === next.seats.length &&
            new Set(c.seats).size === next.seats.length &&
            c.seats.every((id) => next.seats.some((s) => s.id === id)),
          'invalid-order',
        );
        next.seats = c.seats.map((id) => next.seats.find((s) => s.id === id)!);
        break;
      case 'start': {
        control();
        lobby();
        requireThat(this.game, 'game-not-selected');
        requireThat(
          next.seats.length >= this.rules.manifest.players.min &&
            next.seats.every((s) => s.ready),
          'not-ready',
        );
        const random = new RandomSource(randomBytes(4).readUInt32LE() || 1);
        const state = this.rules.validateState(
          this.rules.initialize({
            seats: next.seats.map((s) => s.id),
            random,
          }),
          next.seats.map((s) => s.id),
        );
        next.snapshot = {
          state,
          random: random.state,
          bots: Object.fromEntries(
            next.seats
              .filter((s) => s.controller === 'bot')
              .map((s) => [
                s.id,
                {
                  id: this.strategy.id,
                  version: this.strategy.version,
                  memory: this.strategy.validateMemory(null),
                  random: randomBytes(4).readUInt32LE() || 1,
                  difficulty: s.botDifficulty ?? 'default',
                },
              ]),
          ),
        };
        next.status = this.rules.ended(state) ? 'ended' : 'playing';
        next.joinOpen = false;
        break;
      }
      case 'pause':
        control();
        requireThat(next.status === 'playing', 'not-playing');
        next.paused = true;
        break;
      case 'resume':
        control();
        requireThat(next.status === 'playing', 'not-playing');
        next.paused = false;
        next.botError = null;
        break;
      case 'end':
        host();
        requireThat(next.status === 'playing', 'not-playing');
        next.status = 'ended';
        next.endReason = '管理员结束';
        break;
      case 'replay':
      case 'new-room':
        if (c.type === 'replay') control();
        else host();
        requireThat(next.status !== 'playing', 'end-first');
        if (c.type === 'replay')
          requireThat(next.status === 'ended', 'not-ended');
        {
          const fresh =
            c.type === 'replay' ? this.lobbyWithSeats() : this.fresh();
          fresh.playMode = next.playMode ?? 'play';
          fresh.countdownSeconds =
            next.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
          const reply: CommandReply = {
            ok: true,
            revision: fresh.revision,
            branch: fresh.branch,
          };
          fresh.receipts[key] = { fingerprint, reply };
          this.commit(fresh, true);
          this.restored = false;
          return reply;
        }
      case 'rollback': {
        host();
        requireThat(next.snapshot, 'not-playing');
        const index = next.history.findIndex((h) => h.id === c.checkpointId);
        requireThat(index >= 0, 'invalid-checkpoint');
        next.snapshot = {
          ...next.history[index]!.before,
          bots: { ...next.history[index]!.before.bots },
        };
        next.history = next.history.slice(0, index);
        next.branch++;
        next.status = 'playing';
        next.paused = true;
        next.botError = null;
        next.endReason = null;
        break;
      }
      case 'lifecycle':
      case 'game': {
        if (c.type === 'lifecycle') {
          control();
          requireThat(
            next.snapshot &&
              !next.paused &&
              !['房主结束', '管理员结束'].includes(next.endReason ?? ''),
            'not-actionable',
          );
        } else
          requireThat(
            identity.role === 'player' &&
              next.status === 'playing' &&
              !next.paused &&
              next.snapshot,
            'not-actionable',
          );
        const seatId = identity.role === 'player' ? identity.seatId : '';
        if (c.type === 'game') {
          requireThat(
            next.seats.some(
              (s) =>
                s.id === seatId &&
                (botUpdate ? s.controller === 'bot' : s.controller === 'human'),
            ),
            'unauthorized',
          );
          requireThat(
            this.rules
              .decisions(next.snapshot.state)
              .some((p) => p.seatId === seatId && p.id === c.decisionId),
            'stale-decision',
          );
        }
        let action: JsonValue;
        try {
          action = this.rules.validateAction(c.action);
        } catch {
          throw new Rejection('illegal-action');
        }
        requireThat(
          (c.type === 'lifecycle'
            ? this.rules.lifecycleActions(next.snapshot!.state)
            : this.rules.legalActions(next.snapshot!.state, seatId)
          ).some((a) => JSON.stringify(a) === JSON.stringify(action)),
          'illegal-action',
        );
        const before = this.data.snapshot!;
        const random = new RandomSource(next.snapshot!.random);
        const context = { seats: next.seats.map((s) => s.id), random };
        const result =
          c.type === 'lifecycle'
            ? this.rules.applyLifecycle(
                structuredClone(next.snapshot!.state),
                action,
                context,
              )
            : this.rules.apply(
                structuredClone(next.snapshot!.state),
                action,
                seatId,
                context,
              );
        next.snapshot!.state = this.rules.validateState(
          result.state,
          next.seats.map((s) => s.id),
        );
        events = result.events ?? [];
        next.snapshot!.random = random.state;
        if (botUpdate) {
          requireThat(
            Number.isInteger(botUpdate.random) &&
              botUpdate.random > 0 &&
              botUpdate.random <= 0xffffffff,
            'invalid-strategy-random',
          );
          const bot = { ...next.snapshot!.bots[seatId]! };
          bot.memory = this.strategy.validateMemory(botUpdate.memory);
          bot.random = botUpdate.random;
          next.snapshot!.bots[seatId] = bot;
        }
        if (this.strategy.observe) {
          for (const [observerSeat, previousBot] of Object.entries(
            next.snapshot!.bots,
          )) {
            const observedBot = { ...previousBot };
            observedBot.memory = this.strategy.validateMemory(
              this.strategy.observe({
                view: structuredClone(
                  this.rules.project(next.snapshot!.state, {
                    role: 'player',
                    seatId: observerSeat,
                  }),
                ),
                memory: structuredClone(observedBot.memory),
                seatId: observerSeat,
                difficulty: observedBot.difficulty ?? 'default',
              }),
            );
            next.snapshot!.bots[observerSeat] = observedBot;
          }
        }
        next.history.push({
          id: randomUUID(),
          ...result.decision,
          before,
          seatId: c.type === 'game' ? seatId : null,
        });
        if (this.rules.ended(next.snapshot!.state)) {
          next.status = 'ended';
          next.endReason = '游戏完成';
        } else if (c.type === 'lifecycle') {
          next.status = 'playing';
          next.endReason = null;
        }
        break;
      }
    }
    next.revision++;
    this.updateWindows(next, c, identity);
    const reply: CommandReply = {
      ok: true,
      revision: next.revision,
      branch: next.branch,
    };
    next.receipts[key] = { fingerprint, reply };
    const changedInstance = next.instanceId !== this.data.instanceId;
    this.commit(
      next,
      changedInstance || c.type === 'resume' || c.type === 'rollback',
      events,
      this.game,
      image ? { avatars: [image] } : undefined,
    );
    if (changedInstance || c.type === 'resume') this.restored = false;
    return reply;
  }
  botTask() {
    const d = this.data;
    if (
      d.status !== 'playing' ||
      d.paused ||
      d.botError ||
      this.transientBotError ||
      !d.snapshot
    )
      return null;
    const decision = this.rules
      .decisions(d.snapshot.state)
      .find((p) =>
        d.seats.some((s) => s.id === p.seatId && s.controller === 'bot'),
      );
    if (!decision) return null;
    const data = d.snapshot.bots[decision.seatId]!;
    return {
      gameId: this.rules.manifest.id,
      ...(d.variantId === undefined ? {} : { variantId: d.variantId }),
      rulesVersion: this.rules.manifest.rulesVersion,
      instanceId: d.instanceId,
      revision: d.revision,
      branch: d.branch,
      decision: structuredClone(decision),
      view: structuredClone(
        this.rules.project(d.snapshot.state, {
          role: 'player',
          seatId: decision.seatId,
        }),
      ),
      actions: structuredClone(
        this.rules.legalActions(d.snapshot.state, decision.seatId),
      ),
      data: structuredClone(data),
    };
  }
  submitBot(
    task: NonNullable<ReturnType<RoomCoordinator['botTask']>>,
    action: JsonValue,
    memory: JsonValue,
    random: number,
  ) {
    return this.enqueue(async () => {
      try {
        return await this.execute(
          { role: 'player', seatId: task.decision.seatId },
          {
            actionId: `bot-${task.branch}-${task.revision}-${task.decision.id}`,
            instanceId: task.instanceId,
            revision: task.revision,
            branch: task.branch,
            command: { type: 'game', decisionId: task.decision.id, action },
          },
          { memory, random },
        );
      } catch (error) {
        return {
          ok: false as const,
          reason:
            error instanceof Rejection
              ? error.message
              : 'save-or-action-failed',
        };
      }
    });
  }
  botFailed(task: NonNullable<ReturnType<RoomCoordinator['botTask']>>) {
    return this.enqueue(() => {
      if (
        task.instanceId !== this.data.instanceId ||
        task.revision !== this.data.revision ||
        task.branch !== this.data.branch
      )
        return;
      const next = copySave(this.data);
      next.botError = '人机行动失败，请检查策略后恢复';
      next.paused = true;
      next.revision++;
      this.updateWindows(next);
      try {
        this.commit(next);
      } catch {
        this.transientBotError = '人机行动未能保存，请检查存储后恢复';
        this.notify();
      }
    });
  }
}
