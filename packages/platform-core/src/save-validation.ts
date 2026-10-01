import type { GameRules, BotStrategy } from '@tablemax/game-sdk';
import type { Save, Snapshot } from './model';
import { requireThat } from './errors';
export function validateSave(
  input: unknown,
  rules: GameRules,
  strategy: BotStrategy,
): Save {
  const d = input as Save;
  const { id, gameVersion, rulesVersion, stateVersion } = rules.manifest;
  const expected = { id, gameVersion, rulesVersion, stateVersion };
  requireThat(
    d &&
      d.formatVersion === 1 &&
      d.manifest &&
      Object.entries(expected).every(
        ([k, v]) => d.manifest[k as keyof typeof expected] === v,
      ),
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
    Array.isArray(d.seats) &&
      d.seats.length <= rules.manifest.players.max &&
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
      : d.snapshot !== null && d.seats.length >= rules.manifest.players.min,
    'damaged-save',
  );
  for (const h of d.history) {
    requireThat(
      typeof h.id === 'string' &&
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
  return structuredClone(d);
}
