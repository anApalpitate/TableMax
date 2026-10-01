import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { GameRules, BotStrategy, JsonValue } from '@tablemax/game-sdk';
import {
  CommandSchema,
  type Command,
  type CommandReply,
  type RoomView,
} from '@tablemax/protocol';
import type { Save, SaveRepository } from './model';
import { validateSave } from './save-validation';
import { Rejection, requireThat } from './errors';
import { RandomSource } from './random';

export const token = () => randomBytes(32).toString('hex');
export const hash = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export type Identity =
  { role: 'public' } | { role: 'host' } | { role: 'player'; seatId: string };

export class RoomCoordinator {
  private data: Save;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private bindings = new Map<string, { seatId: string; expires: number }>();
  private transientBotError: string | null = null;
  readonly hostToken: string;
  restored = false;
  constructor(
    readonly rules: GameRules,
    readonly strategy: BotStrategy,
    private repository: SaveRepository,
    hostToken = token(),
  ) {
    this.hostToken = hostToken;
    requireThat(
      strategy.gameId === rules.manifest.id &&
        strategy.rulesVersion === rules.manifest.rulesVersion,
      'incompatible-strategy',
    );
    const saved = repository.load();
    this.data =
      saved === null ? this.fresh() : validateSave(saved, rules, strategy);
    if (saved !== null && this.data.status === 'playing') {
      this.restored = true;
      this.data.paused = true;
      this.data.revision++;
      // Invalidate intentions produced before the process stopped.
      this.data.branch++;
      repository.save(this.data);
    }
  }
  private fresh(): Save {
    const { id, gameVersion, rulesVersion, stateVersion } = this.rules.manifest;
    return {
      formatVersion: 1,
      manifest: { id, gameVersion, rulesVersion, stateVersion },
      instanceId: randomUUID(),
      revision: 0,
      branch: 0,
      status: 'lobby',
      paused: false,
      joinOpen: true,
      seats: [],
      snapshot: null,
      history: [],
      receipts: {},
      botError: null,
      endReason: null,
    };
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
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  notify() {
    for (const listener of this.listeners) {
      try {
        listener();
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
  private commit(next: Save, clearBotError = false) {
    this.repository.save(next);
    this.data = next;
    if (clearBotError) this.transientBotError = null;
    this.notify();
  }
  async join(name: string) {
    return this.enqueue(() => {
      requireThat(
        this.data.status === 'lobby' && this.data.joinOpen,
        'joining-closed',
      );
      requireThat(
        this.data.seats.length < this.rules.manifest.players.max,
        'room-full',
      );
      const credential = token();
      const next = structuredClone(this.data);
      const duplicateName = next.seats.some((s) => s.name === name);
      next.seats.push({
        id: randomUUID(),
        name,
        controller: 'human',
        ready: false,
        tokenHash: hash(credential),
      });
      next.revision++;
      this.commit(next);
      return { token: credential, duplicateName };
    });
  }
  async redeem(code: string) {
    return this.enqueue(() => {
      const binding = this.bindings.get(hash(code));
      requireThat(binding && binding.expires > Date.now(), 'binding-expired');
      const next = structuredClone(this.data);
      const seat = next.seats.find((s) => s.id === binding.seatId);
      requireThat(seat && seat.controller === 'human', 'invalid-seat');
      const credential = token();
      seat.tokenHash = hash(credential);
      next.revision++;
      this.commit(next);
      this.bindings.delete(hash(code));
      return { token: credential };
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
      game: {
        id: this.rules.manifest.id,
        name: this.rules.manifest.name,
        ...this.rules.manifest.players,
      },
      seats: d.seats.map(({ id, name, controller, ready }) => ({
        id,
        name,
        controller,
        ready,
        online: controller === 'bot' || online.has(id),
      })),
      self: { role: identity.role, seatId },
      gameView: snap
        ? this.rules.project(
            structuredClone(snap.state),
            seatId ? { role: 'player', seatId } : { role: 'public' },
          )
        : null,
      decisionId: pending?.id ?? null,
      actions:
        pending && !d.paused && d.status === 'playing'
          ? [...this.rules.legalActions(structuredClone(snap!.state), seatId!)]
          : [],
      history:
        identity.role === 'host'
          ? d.history.map(({ id, label, revealedInformation }) => ({
              id,
              label,
              revealedInformation,
            }))
          : [],
      lifecycleActions:
        identity.role === 'host' && snap && !d.paused
          ? [...this.rules.lifecycleActions(structuredClone(snap.state))]
          : [],
      botError: d.botError ?? this.transientBotError,
      endReason: d.endReason,
    };
  }
  command(
    credential: string | undefined,
    input: unknown,
  ): Promise<CommandReply> {
    return this.enqueue(() => {
      try {
        const parsed = CommandSchema.safeParse(input);
        requireThat(parsed.success, 'invalid-message');
        const identity = this.identity(credential);
        return this.execute(identity, parsed.data);
      } catch (error) {
        return {
          ok: false,
          reason:
            error instanceof Rejection
              ? error.message
              : 'save-or-action-failed',
        };
      }
    });
  }
  private execute(
    identity: Identity,
    envelope: Command,
    botUpdate?: { memory: JsonValue; random: number },
  ): CommandReply {
    requireThat(identity.role !== 'public', 'unauthorized');
    const principal = identity.role === 'host' ? 'host' : identity.seatId;
    const key = hash(`${principal}:${envelope.actionId}`);
    const fingerprint = hash(JSON.stringify(envelope));
    const receipt = this.data.receipts[key];
    if (
      envelope.instanceId !== this.data.instanceId &&
      envelope.command.type === 'new-room' &&
      receipt?.fingerprint === fingerprint
    )
      return receipt.reply;
    requireThat(envelope.instanceId === this.data.instanceId, 'stale-instance');
    requireThat(envelope.branch === this.data.branch, 'stale-branch');
    if (receipt) {
      requireThat(receipt.fingerprint === fingerprint, 'action-id-conflict');
      return receipt.reply;
    }
    requireThat(envelope.revision === this.data.revision, 'stale-revision');
    const next = structuredClone(this.data);
    const c = envelope.command;
    const host = () => requireThat(identity.role === 'host', 'unauthorized');
    const lobby = () => requireThat(next.status === 'lobby', 'not-in-lobby');
    let code: string | undefined;
    let bindingSeat: string | undefined;
    switch (c.type) {
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
      case 'add-bot':
        host();
        lobby();
        requireThat(
          next.seats.length < this.rules.manifest.players.max,
          'room-full',
        );
        next.seats.push({
          id: randomUUID(),
          name: c.name,
          controller: 'bot',
          ready: true,
          tokenHash: null,
        });
        break;
      case 'remove-seat':
        host();
        lobby();
        requireThat(
          next.seats.some((s) => s.id === c.seatId),
          'invalid-seat',
        );
        next.seats = next.seats.filter((s) => s.id !== c.seatId);
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
        host();
        lobby();
        requireThat(
          next.seats.length >= this.rules.manifest.players.min &&
            next.seats.every((s) => s.ready),
          'not-ready',
        );
        const random = new RandomSource(randomBytes(4).readUInt32LE() || 1);
        const state = this.rules.validateState(
          this.rules.initialize({ seats: next.seats.map((s) => s.id), random }),
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
                },
              ]),
          ),
        };
        next.status = this.rules.ended(state) ? 'ended' : 'playing';
        next.joinOpen = false;
        break;
      }
      case 'pause':
        host();
        requireThat(next.status === 'playing', 'not-playing');
        next.paused = true;
        break;
      case 'resume':
        host();
        requireThat(next.status === 'playing', 'not-playing');
        next.paused = false;
        next.botError = null;
        break;
      case 'end':
        host();
        requireThat(next.status === 'playing', 'not-playing');
        next.status = 'ended';
        next.endReason = '房主结束';
        break;
      case 'new-room':
        host();
        requireThat(next.status !== 'playing', 'end-first');
        {
          const fresh = this.fresh();
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
      case 'rebind': {
        host();
        const seat = next.seats.find(
          (s) => s.id === c.seatId && s.controller === 'human',
        );
        requireThat(seat, 'invalid-seat');
        seat.tokenHash = null;
        code = token();
        bindingSeat = seat.id;
        break;
      }
      case 'rollback': {
        host();
        requireThat(next.snapshot, 'not-playing');
        const index = next.history.findIndex((h) => h.id === c.checkpointId);
        requireThat(index >= 0, 'invalid-checkpoint');
        next.snapshot = structuredClone(next.history[index]!.before);
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
          host();
          requireThat(
            next.snapshot && !next.paused && next.endReason !== '房主结束',
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
        const before = structuredClone(next.snapshot!);
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
        next.snapshot!.random = random.state;
        if (botUpdate) {
          requireThat(
            Number.isInteger(botUpdate.random) &&
              botUpdate.random > 0 &&
              botUpdate.random <= 0xffffffff,
            'invalid-strategy-random',
          );
          const bot = next.snapshot!.bots[seatId]!;
          bot.memory = this.strategy.validateMemory(botUpdate.memory);
          bot.random = botUpdate.random;
        }
        next.history.push({ id: randomUUID(), ...result.decision, before });
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
    const reply: CommandReply = {
      ok: true,
      revision: next.revision,
      branch: next.branch,
      ...(code ? { bindingCode: code } : {}),
    };
    next.receipts[key] = { fingerprint, reply };
    this.commit(next, c.type === 'resume' || c.type === 'rollback');
    if (code && bindingSeat) {
      for (const [key, b] of this.bindings)
        if (b.seatId === bindingSeat) this.bindings.delete(key);
      this.bindings.set(hash(code), {
        seatId: bindingSeat,
        expires: Date.now() + 120_000,
      });
    }
    if (c.type === 'resume') this.restored = false;
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
    return this.enqueue(() => {
      try {
        return this.execute(
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
      const next = structuredClone(this.data);
      next.botError = '电脑行动失败，请检查策略后恢复';
      next.paused = true;
      next.revision++;
      try {
        this.commit(next);
      } catch {
        this.transientBotError = '电脑行动未能保存，请检查存储后恢复';
        this.notify();
      }
    });
  }
}
