import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { readUnoLearningCorpus } from '../../../tools/analysis/bots/local-uno-corpus';
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
    b: ['yellow-1-a'],
    c: ['green-1-a'],
  });
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
    checkpointId,
    decisionId: checkpointId,
    seat: 0,
    source: 'player-command',
    observation: project(state, { role: 'player', seatId: 'a' }),
    actions: legalActions(state, 'a'),
  });
  const rows = [
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
    { ...decision(1, 9, 'learn-terminal'), result: { phase: 'ended' } },
    {
      ...decision(0, 3, 'incomplete'),
      instanceId: 'unfinished',
      firstForSessionMatch: true,
    },
  ];
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n'));
  const corpus = readUnoLearningCorpus(path, 10);
  expect(corpus.invalidLines).toBe(0);
  expect(corpus.matches).toBe(2);
  expect(corpus.entries).toHaveLength(1);
  expect(corpus.entries[0]!.roots.map(({ id }) => id)).toEqual([
    'learn-retained',
    'learn-terminal',
  ]);
  // A damaged fragment may have been the rollback marker; it cannot certify a corpus.
  writeFileSync(
    path,
    rows.map((row) => JSON.stringify(row)).join('\n') + '\n{broken',
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
