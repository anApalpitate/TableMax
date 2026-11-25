import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import {
  readUnoLearningCorpus,
  unoLearningQualityWeights,
} from '../../../tools/analysis/bots/local-uno-corpus';
import { durableLearningProvenance } from '../../../packages/platform-core/src/bot-learning';
import { openTrainingCheckpoint } from '../../../tools/analysis/bots/training-checkpoint';
import { legalActions, project } from '../rules';
import { fixture } from '../rules/test-fixtures';

it('imports only the surviving recorded branch of a naturally finished UNO segment', () => {
  const temporaryRoot = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(join(temporaryRoot, 'uno-learning-corpus-'));
  const path = join(directory, 'decisions.jsonl');
  const state = fixture({
    a: ['red-skip-a', 'red-9-a', 'blue-5-a'],
    b: ['yellow-1-a', 'red-3-a', 'yellow-5-a'],
    c: ['green-1-a'],
    d: ['blue-1-a'],
  });
  state.setup = { drawPenaltyStacking: true, catchUnoDelayMs: 500 };
  state.drawPenalty = null;
  const botState = { ...state, turnSeat: 'b' };
  const result = {
    gameId: 'uno',
    rulesVersion: state.rulesVersion,
    phase: 'ended',
    seatOrder: state.seats,
    winners: ['a'],
  };
  const base = {
    version: 1,
    segment: 'segment',
    writerSession: 'session',
    instanceId: 'test-instance',
    gameId: 'uno',
    rulesVersion: state.rulesVersion,
  };
  const decision = (
    branch: number,
    revision: number,
    checkpointId: string,
  ) => ({
    ...base,
    type: 'decision',
    branch,
    revision,
    beforeRevision: revision - 1,
    checkpointId,
    decisionId: checkpointId,
    seat: 0,
    source: 'player-command',
    observation: project(state, { role: 'player', seatId: 'a' }),
    actions: legalActions(state, 'a'),
    action: { type: 'draw' },
  });
  const outside = fixture({
    a: ['red-1-a', 'red-2-a'],
    b: ['green-4-a'],
  });
  const rows = [
    {
      ...decision(0, 2, 'outside-pilot'),
      instanceId: 'outside-pilot',
      firstForSessionMatch: true,
      observation: project(outside, { role: 'player', seatId: 'a' }),
      actions: legalActions(outside, 'a'),
      result: { ...result, seatOrder: outside.seats },
    },
    { ...decision(0, 5, 'learn-retained'), firstForSessionMatch: true },
    decision(0, 6, 'learn-abandoned'),
    {
      ...base,
      type: 'rollback',
      previousBranch: 0,
      branch: 1,
      revision: 7,
      checkpointId: 'learn-abandoned',
    },
    {
      ...decision(1, 8, 'learn-bot'),
      seat: 1,
      source: 'bot',
      provenance: durableLearningProvenance('bot', 'juewu'),
      policy: {
        id: 'uno/local',
        version: 'fixture',
        difficulty: 'juewu',
        memory: null,
      },
      observation: project(botState, { role: 'player', seatId: 'b' }),
      actions: legalActions(botState, 'b'),
    },
    {
      ...decision(1, 9, 'invalid-action'),
      action: { type: 'play', cardId: 'green-1-a' },
    },
    { ...decision(1, 10, 'learn-terminal'), result },
    {
      ...decision(0, 3, 'incomplete'),
      instanceId: 'unfinished',
      firstForSessionMatch: true,
    },
  ];
  const input = rows.map((row) => JSON.stringify(row)).join('\n');
  writeFileSync(path, input);
  const corpus = readUnoLearningCorpus(path, 10);
  expect(corpus.invalidLines).toBe(0);
  expect(corpus.matches).toBe(3);
  expect(corpus.entries).toHaveLength(1);
  expect(corpus.entries[0]!.roots.map(({ id }) => id)).toEqual([
    'learn-bot',
    'learn-retained',
    'learn-terminal',
  ]);
  expect(corpus.eligible).toEqual({ high: 0, standard: 1, exploratory: 2 });
  expect(corpus.isolated).toEqual({
    invalidDecision: 0,
    invalidObservationOrAction: 1,
  });
  const review = join(directory, 'human-review.json');
  const inputDigest = createHash('sha256').update(input).digest('hex');
  const report = (revision: number, branch = 0, seat = 0) => ({
    type: 'uno-human-source-review',
    version: 1,
    inputDigest,
    decisions: [
      {
        instanceId: base.instanceId,
        branch,
        revision,
        seat,
        evidenceRef: 'isolated reviewer fixture',
      },
    ],
  });
  writeFileSync(review, JSON.stringify(report(5)));
  const reviewed = readUnoLearningCorpus(path, 2, review);
  expect(reviewed.reviewDigest).toMatch(/^[a-f0-9]{64}$/);
  expect(
    reviewed.entries[0]!.roots.map(({ id, qualityTier }) => [id, qualityTier]),
  ).toEqual([
    ['learn-retained', 'high'],
    ['learn-bot', 'standard'],
  ]);
  expect(reviewed.entries[0]!.seed).toBe(corpus.entries[0]!.seed);
  expect(reviewed.selected).toEqual({ high: 1, standard: 1, exploratory: 0 });
  expect(reviewed.selectedMatches).toEqual({
    high: 1,
    standard: 1,
    exploratory: 0,
  });
  expect(durableLearningProvenance('bot', 'default').qualityTier).toBe(
    'exploratory',
  );
  expect(durableLearningProvenance('bot').qualityTier).toBe('exploratory');
  expect(unoLearningQualityWeights).toEqual({
    high: 1.5,
    standard: 1,
    exploratory: 0.5,
  });

  for (const attempted of [report(6), report(8, 1, 1), report(9, 1)]) {
    writeFileSync(review, JSON.stringify(attempted));
    expect(() => readUnoLearningCorpus(path, 10, review)).toThrow(
      /discarded or invalid/,
    );
  }
  writeFileSync(review, JSON.stringify(report(5)));
  // A damaged fragment may have been the rollback marker; it cannot certify a corpus.
  writeFileSync(
    path,
    rows.map((row) => JSON.stringify(row)).join('\n') + '\n{broken',
  );
  expect(() => readUnoLearningCorpus(path, 10, review)).toThrow(
    /exact frozen decision log/,
  );
  expect(readUnoLearningCorpus(path, 10)).toMatchObject({
    entries: [],
    invalidLines: 1,
  });
});

it('resumes a frozen training checkpoint without accepting newer competing writes', () => {
  const temporaryRoot = resolve(process.env.TABLEMAX_TEST_TMP_ROOT ?? 'tmp');
  mkdirSync(temporaryRoot, { recursive: true });
  const directory = mkdtempSync(
    join(temporaryRoot, 'uno-training-checkpoint-'),
  );
  const path = join(directory, 'checkpoint.json');
  const initial = { labelled: [] as number[] };
  const first = openTrainingCheckpoint(path, 'frozen-inputs', initial);
  const competing = openTrainingCheckpoint(path, 'frozen-inputs', initial);
  first.save({ labelled: [11] });
  expect(() => competing.save({ labelled: [12] })).toThrow(
    'changed since it was opened',
  );
  expect(openTrainingCheckpoint(path, 'frozen-inputs', initial).state).toEqual({
    labelled: [11],
  });
  expect(() =>
    openTrainingCheckpoint(path, 'different-inputs', initial),
  ).toThrow('different frozen inputs');
});
