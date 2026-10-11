import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const json = (value) => JSON.stringify(value);
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
export async function verifyAuthorContract(output) {
  const { rules } = require(resolve(output, 'rules.cjs'));
  const { bot } = require(resolve(output, 'bot.cjs'));
  assert.equal(rules.manifest.sdkVersion, 1);
  assert.equal(rules.manifest.id, bot.gameId);
  assert.equal(rules.manifest.rulesVersion, bot.rulesVersion);
  const seats = Array.from(
    { length: rules.manifest.players.min },
    (_, i) => `seat-${i + 1}`,
  );
  let seed = 2037;
  const context = {
    seats,
    random: {
      next: () => {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        return (seed >>> 0) / 4294967296;
      },
    },
  };
  let state = rules.validateState(rules.initialize(context), seats);
  const memories = new Map(
    seats.map((seat) => [seat, bot.validateMemory(null)]),
  );
  let actions = 0;
  while (!rules.ended(state) && actions < 2000) {
    const original = json(state);
    freeze(state);
    const decisions = rules.decisions(state);
    assert.equal(
      new Set(decisions.map((d) => d.id)).size,
      decisions.length,
      'Duplicate decision ID',
    );
    assert.ok(decisions.length, 'No pending decision in unfinished game');
    const decision = decisions[0];
    assert.ok(seats.includes(decision.seatId), 'Decision actor is not seated');
    const view = rules.project(state, {
      role: 'player',
      seatId: decision.seatId,
    });
    assert.doesNotThrow(() => json(view));
    assert.doesNotThrow(() => json(rules.project(state, { role: 'public' })));
    const legal = rules.legalActions(state, decision.seatId);
    assert.ok(
      legal.length,
      'Contract harness needs a legal suggestion for bot',
    );
    const result = await bot.decide({
      view: freeze(view),
      actions: freeze(legal),
      decision,
      memory: memories.get(decision.seatId),
      difficulty: 'default',
      random: context.random,
      signal: new AbortController().signal,
    });
    const action = rules.validateAction(result.action);
    assert.ok(
      rules.isLegalAction
        ? rules.isLegalAction(state, action, decision.seatId)
        : legal.some((item) => json(item) === json(action)),
      'Bot returned illegal action',
    );
    const applied = rules.apply(state, action, decision.seatId, context);
    assert.equal(json(state), original, 'Rules mutated historical state');
    state = rules.validateState(applied.state, seats);
    memories.set(decision.seatId, bot.validateMemory(result.memory));
    if (bot.observe)
      for (const seatId of seats)
        memories.set(
          seatId,
          bot.validateMemory(
            bot.observe({
              view: rules.project(state, { role: 'player', seatId }),
              memory: memories.get(seatId),
              seatId,
              difficulty: 'default',
            }),
          ),
        );
    actions++;
  }
  assert.ok(
    rules.ended(state),
    'Natural contract game did not finish within 2000 decisions',
  );
  return {
    gameId: rules.manifest.id,
    seats: seats.length,
    actions,
    ended: true,
  };
}
