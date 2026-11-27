import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  readCurrentSave,
  readJournalSave,
} from '../../../apps/server/src/save-audit';
import { bot, rules } from '../../../games/uno';
import { unoPilotMatch } from '../../../games/uno/config';
import { unoWinningScore } from '../../../games/uno/rules/scoring';
import type { UnoView } from '../../../games/uno/types';
import type { Save } from '../../../packages/platform-core/src/model';
import { readUnoPilotRoster } from './uno-pilot-roster.mjs';

export function capturePilotMatch(
  save: Save,
  roster: ReturnType<typeof readUnoPilotRoster>,
  participant: string,
  play: number,
) {
  const slot = roster.allowed.get(participant)?.plays[play - 1];
  assert.ok(
    slot && [1, 2].includes(play),
    'Unknown participant or scheduled play',
  );
  assert.ok(
    save?.snapshot && save.status === 'ended',
    'Select an ended UNO room save',
  );
  assert.ok(typeof save.instanceId === 'string' && save.instanceId.trim());
  for (const value of [save.branch, save.revision])
    assert.ok(
      Number.isSafeInteger(value) && value >= 0,
      'Invalid save revision',
    );
  assert.ok(
    save.manifest?.id === rules.manifest.id &&
      save.manifest.gameVersion === rules.manifest.gameVersion &&
      save.manifest.rulesVersion === rules.manifest.rulesVersion &&
      save.manifest.stateVersion === rules.manifest.stateVersion,
    'Save does not match the current UNO rules',
  );
  assert.equal(save.seats.length, unoPilotMatch.seatCount);
  assert.equal(
    Object.keys(save.snapshot.bots).length,
    unoPilotMatch.seatCount - 1,
  );
  if (save.releaseRef !== undefined)
    assert.match(save.releaseRef, /^[a-f0-9]{64}$/);
  const seatIds = save.seats.map(({ id }) => id);
  const observedRoles = save.seats.map(({ id, controller, botDifficulty }) => {
    const savedBot = save.snapshot!.bots[id];
    if (controller === 'human') {
      assert.equal(savedBot, undefined, 'Human seat has bot state');
      return 'human';
    }
    assert.equal(controller, 'bot');
    assert.ok(
      savedBot && savedBot.id === bot.id && savedBot.version === bot.version,
    );
    assert.equal(
      savedBot.modelRef,
      undefined,
      'This roster uses the heuristic version',
    );
    assert.equal(
      savedBot.difficulty,
      botDifficulty,
      'Seat difficulty does not match the saved strategy',
    );
    return botDifficulty;
  });
  assert.deepEqual(
    observedRoles,
    slot.roles,
    'Saved seat order or difficulty does not match this pilot slot',
  );
  const state = rules.validateState(save.snapshot.state, seatIds);
  const view = rules.project(state, { role: 'public' }) as unknown as UnoView;
  assert.deepEqual(
    view.setup,
    unoPilotMatch.setup,
    'Save uses a different UNO setup',
  );
  const saveEvidence = {
    gameVersion: save.manifest.gameVersion,
    rulesVersion: save.manifest.rulesVersion,
    strategyVersion: bot.version,
    revision: save.revision,
    branch: save.branch,
    releaseRef: save.releaseRef ?? null,
    rosterSha256: roster.rosterSha256,
    saveSha256: createHash('sha256').update(JSON.stringify(save)).digest('hex'),
  };
  const identity = {
    participant,
    play,
    matchId: save.instanceId,
    saveEvidence,
  };
  if (save.endReason !== '游戏完成') {
    assert.ok(!rules.ended(state), 'Platform and UNO result disagree');
    return {
      ...identity,
      status: 'interrupted',
      reason: '房间在 UNO 规则终局前结束',
    };
  }
  assert.ok(rules.ended(state));
  assert.equal(view.winners.length, 1);
  const winner = view.winners[0]!;
  const winnerSeat = seatIds.indexOf(winner) + 1;
  assert.ok(winnerSeat > 0 && view.players[winner]!.score >= unoWinningScore);
  return { ...identity, status: 'ended', winnerSeat };
}

export function readPilotSave(path: string, matchId?: string): Save {
  const database = new DatabaseSync(path, { readOnly: true });
  try {
    database.exec('PRAGMA query_only = ON; BEGIN');
    const current = readCurrentSave(database) as Save | null;
    if (!matchId || current?.instanceId === matchId) {
      assert.ok(current, 'Save database has no current room');
      return current;
    }
    const row = database
      .prepare(
        'SELECT rowid FROM journal WHERE instance = ? ORDER BY revision DESC LIMIT 1',
      )
      .get(matchId);
    assert.ok(
      row && Number.isSafeInteger(row.rowid),
      'Requested room is absent from the save journal',
    );
    const found = readJournalSave(database, row.rowid as number) as Save | null;
    assert.ok(found && found.instanceId === matchId);
    return found;
  } finally {
    database.close();
  }
}

export function runUnoPilotCapture(args: string[]) {
  const { values } = parseArgs({
    args,
    options: {
      roster: { type: 'string' },
      'save-copy': { type: 'string' },
      participant: { type: 'string' },
      play: { type: 'string' },
      'match-id': { type: 'string' },
      'duration-seconds': { type: 'string' },
    },
  });
  assert.ok(
    values.roster && values['save-copy'] && values.participant && values.play,
    'Pass --roster, --save-copy, --participant and --play',
  );
  const duration =
    values['duration-seconds'] === undefined
      ? undefined
      : Number(values['duration-seconds']);
  assert.ok(
    duration === undefined || (Number.isSafeInteger(duration) && duration > 0),
    'Provide a positive duration in seconds',
  );
  const match = capturePilotMatch(
    readPilotSave(values['save-copy'], values['match-id']),
    readUnoPilotRoster(values.roster),
    values.participant,
    Number(values.play),
  );
  console.log(
    JSON.stringify(
      {
        ...match,
        ...(duration === undefined ? {} : { durationSeconds: duration }),
      },
      null,
      2,
    ),
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runUnoPilotCapture(process.argv.slice(2));
}
