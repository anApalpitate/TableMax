import type { GameRules, BotStrategy } from '@tablemax/game-sdk';
import { AVATAR_PRESETS, AvatarIdSchema } from '@tablemax/protocol';
import type { Save, Snapshot } from './model';
import { requireThat } from './errors';
export function validateSave(
  input: unknown,
  rules: GameRules | null,
  strategy: BotStrategy | null,
): Save {
  const d = structuredClone(input) as Save;
  requireThat(
    d &&
      d.formatVersion === 1 &&
      (rules
        ? d.manifest &&
          ['id', 'gameVersion', 'rulesVersion', 'stateVersion'].every(
            (key) =>
              d.manifest![key as keyof NonNullable<Save['manifest']>] ===
              rules.manifest[key as keyof NonNullable<Save['manifest']>],
          )
        : d.manifest === null),
    'incompatible-save',
  );
  requireThat(
    typeof d.instanceId === 'string' &&
      /^[0-9a-f-]{36}$/.test(d.instanceId) &&
      Number.isSafeInteger(d.revision) &&
      d.revision >= 0 &&
      Number.isSafeInteger(d.branch) &&
      d.branch >= 0 &&
      ['lobby', 'playing', 'ended'].includes(d.status) &&
      typeof d.paused === 'boolean' &&
      typeof d.joinOpen === 'boolean',
    'damaged-save',
  );
  requireThat(
    d.playMode === undefined || d.playMode === 'play' || d.playMode === 'test',
    'damaged-save',
  );
  d.playMode ??= 'play';
  requireThat(
    Array.isArray(d.seats) &&
      d.seats.length <= (rules?.manifest.players.max ?? 0) &&
      new Set(d.seats.map((s) => s.id)).size === d.seats.length,
    'damaged-save',
  );
  for (const s of d.seats)
    requireThat(
      typeof s.id === 'string' &&
        typeof s.name === 'string' &&
        s.name.length > 0 &&
        s.name.length <= 24 &&
        ['human', 'bot'].includes(s.controller) &&
        typeof s.ready === 'boolean' &&
        (s.tokenHash === null || /^[0-9a-f]{64}$/.test(s.tokenHash)),
      'damaged-save',
    );
  const occupied = new Set<string>();
  for (const seat of d.seats) {
    if (seat.avatarId === undefined) continue;
    requireThat(
      AvatarIdSchema.safeParse(seat.avatarId).success &&
        !occupied.has(seat.avatarId),
      'damaged-save',
    );
    occupied.add(seat.avatarId);
  }
  for (const seat of d.seats) {
    if (seat.avatarId !== undefined) continue;
    // Preserve the former six-avatar hash when free, then use the first free ID.
    const legacy =
      AVATAR_PRESETS[
        [...seat.id].reduce(
          (sum, character) => sum + character.charCodeAt(0),
          0,
        ) % 6
      ]!;
    const preset = !occupied.has(legacy.id)
      ? legacy
      : AVATAR_PRESETS.find((entry) => !occupied.has(entry.id));
    requireThat(preset, 'damaged-save');
    seat.avatarId = preset.id;
    occupied.add(preset.id);
  }
  for (const seat of d.seats) {
    if (seat.controller === 'human') {
      requireThat(seat.botDifficulty === undefined, 'damaged-save');
      continue;
    }
    if (seat.botDifficulty === undefined) seat.botDifficulty = 'default';
    requireThat(
      strategy &&
        (strategy.difficulties ?? ['default']).includes(seat.botDifficulty),
      'incompatible-strategy',
    );
  }
  requireThat(
    d.hostSeat == null ||
      d.seats.some(
        (seat) => seat.id === d.hostSeat && seat.controller === 'human',
      ),
    'damaged-save',
  );
  d.ownerSeatId ??= null;
  requireThat(
    d.ownerSeatId === null ||
      d.seats.some(
        (seat) => seat.id === d.ownerSeatId && seat.controller === 'human',
      ),
    'damaged-save',
  );
  const revision = (value: number) =>
    Number.isSafeInteger(value) && value >= 0 && value <= d.revision;
  requireThat(
    d.gameWindow == null ||
      (typeof d.gameWindow.group === 'string' && revision(d.gameWindow.floor)),
    'damaged-save',
  );
  requireThat(
    d.readyWindow === undefined ||
      (revision(d.readyWindow.floor) &&
        d.readyWindow.seats &&
        typeof d.readyWindow.seats === 'object' &&
        Object.entries(d.readyWindow.seats).every(
          ([seat, value]) =>
            d.seats.some((entry) => entry.id === seat) && revision(value),
        )),
    'damaged-save',
  );
  requireThat(
    Array.isArray(d.history) &&
      new Set(d.history.map((h) => h.id)).size === d.history.length &&
      d.receipts &&
      typeof d.receipts === 'object' &&
      (d.botError === null || typeof d.botError === 'string') &&
      (d.endReason === null || typeof d.endReason === 'string'),
    'damaged-save',
  );
  const validateSnapshot = (snap: Snapshot) => {
    requireThat(rules && strategy, 'damaged-save');
    requireThat(
      snap &&
        Number.isInteger(snap.random) &&
        snap.random > 0 &&
        snap.random <= 0xffffffff &&
        snap.bots &&
        typeof snap.bots === 'object',
      'damaged-save',
    );
    snap.state = rules.validateState(
      snap.state,
      d.seats.map((s) => s.id),
    );
    for (const seat of d.seats.filter((s) => s.controller === 'bot')) {
      const b = snap.bots[seat.id];
      requireThat(
        b && b.id === strategy.id && b.version === strategy.version,
        'incompatible-strategy',
      );
      if (b.difficulty === undefined) b.difficulty = 'default';
      requireThat(
        (strategy.difficulties ?? ['default']).includes(b.difficulty) &&
          b.difficulty === seat.botDifficulty,
        'incompatible-strategy',
      );
      requireThat(
        Number.isInteger(b.random) && b.random > 0 && b.random <= 0xffffffff,
        'damaged-save',
      );
      b.memory = strategy.validateMemory(b.memory);
    }
    requireThat(
      Object.keys(snap.bots).every((s) =>
        d.seats.some((seat) => seat.id === s && seat.controller === 'bot'),
      ),
      'damaged-save',
    );
    requireThat(
      rules
        .decisions(snap.state)
        .every((p) => d.seats.some((s) => s.id === p.seatId)),
      'damaged-save',
    );
  };
  if (d.snapshot) validateSnapshot(d.snapshot);
  requireThat(
    d.status === 'lobby'
      ? d.snapshot === null && d.history.length === 0
      : d.snapshot !== null &&
          !!rules &&
          d.seats.length >= rules.manifest.players.min,
    'damaged-save',
  );
  for (const h of d.history) {
    requireThat(
      typeof h.id === 'string' &&
        (h.seatId == null || d.seats.some((s) => s.id === h.seatId)) &&
        (h.roundNumber === undefined ||
          (Number.isSafeInteger(h.roundNumber) && h.roundNumber > 0)) &&
        typeof h.label === 'string' &&
        typeof h.revealedInformation === 'boolean',
      'damaged-save',
    );
    validateSnapshot(h.before);
  }
  for (const r of Object.values(d.receipts))
    requireThat(
      r &&
        typeof r.fingerprint === 'string' &&
        r.reply &&
        r.reply.ok === true &&
        Number.isInteger(r.reply.revision) &&
        Number.isInteger(r.reply.branch),
      'damaged-save',
    );
  for (const value of [d.sessionReceipts])
    requireThat(
      value === undefined ||
        (value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value) &&
          Object.keys(value).length <= 128),
      'damaged-save',
    );
  for (const [key, receipt] of Object.entries(d.sessionReceipts ?? {}))
    requireThat(
      /^[0-9a-f]{64}$/.test(key) &&
        receipt &&
        /^[0-9a-f]{64}$/.test(receipt.fingerprint) &&
        /^[0-9a-f]{120}$/.test(receipt.sealedCredential) &&
        typeof receipt.seatId === 'string' &&
        typeof receipt.duplicateName === 'boolean' &&
        Number.isSafeInteger(receipt.expires) &&
        receipt.expires > 0,
      'damaged-save',
    );
  d.sessionReceipts ??= {};
  d.readyWindow ??= { floor: d.revision, seats: {} };
  // Old binding requests are inert; existing phone credentials still restore.
  delete d.bindings;
  return d;
}
