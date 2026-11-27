import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import {
  experience,
  profiles,
  readUnoPilotRoster,
} from '../uno-pilot-roster.mjs';

const { values } = parseArgs({
  options: { input: { type: 'string' }, 'verify-only': { type: 'boolean' } },
});
const { allowed, rosterSha256, schedule } = readUnoPilotRoster(
  new URL('../../../../docs/tasks/uno-human-pilot-slots.md', import.meta.url),
);
const states = ['ended', 'interrupted', 'error', 'not-started'];
const recordFields = new Set([
  'participant',
  'play',
  'matchId',
  'status',
  'reason',
  'winnerSeat',
  'difficulty',
  'comeback',
  'interference',
  'durationSeconds',
  'familiarity',
  'publicExample',
  'saveEvidence',
]);
const bootstrapReplicates = 10000;
const mean = (values) =>
  values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

function wins(flags) {
  const count = flags.filter(Boolean).length;
  const n = flags.length;
  if (!n) return { wins: 0, played: 0, rate: null, interval95: null };
  const rate = count / n;
  const z = 1.959963984540054;
  const denominator = 1 + (z * z) / n;
  const center = (rate + (z * z) / (2 * n)) / denominator;
  const radius =
    (z * Math.sqrt((rate * (1 - rate)) / n + (z * z) / (4 * n * n))) /
    denominator;
  return {
    wins: count,
    played: n,
    rate,
    interval95: {
      lower: Math.max(0, center - radius),
      upper: Math.min(1, center + radius),
    },
  };
}

function paired(groups) {
  const details = Object.fromEntries(
    groups.map(({ band, differences }) => [
      band,
      { count: differences.length, point: mean(differences) },
    ]),
  );
  if (groups.some(({ differences }) => !differences.length)) {
    return { byExperience: details, point: null, interval95: null };
  }
  const point = mean(groups.map(({ differences }) => mean(differences)));
  if (groups.some(({ differences }) => differences.length < 2)) {
    return { byExperience: details, point, interval95: null };
  }
  let rng = 724195;
  const draw = (limit) => {
    rng ^= rng << 13;
    rng ^= rng >>> 17;
    rng ^= rng << 5;
    return Math.floor(((rng >>> 0) / 4294967296) * limit);
  };
  const distribution = Array.from({ length: bootstrapReplicates }, () =>
    mean(
      groups.map(({ differences }) => {
        let sum = 0;
        for (let index = 0; index < differences.length; index++)
          sum += differences[draw(differences.length)];
        return sum / differences.length;
      }),
    ),
  ).sort((left, right) => left - right);
  return {
    byExperience: details,
    point,
    interval95: {
      lower: distribution[Math.floor(0.025 * (distribution.length - 1))],
      upper: distribution[Math.ceil(0.975 * (distribution.length - 1))],
    },
  };
}

function analyze(input) {
  assert.equal(input.version, 1);
  assert.equal(input.rosterSha256, rosterSha256);
  assert.equal(typeof input.build, 'string');
  assert.ok(input.build.trim());
  assert.ok(Array.isArray(input.matches));
  const entries = new Map();
  const keys = new Set();
  const savedVersions = new Set();
  const familiarityByParticipant = new Map();
  for (const data of input.matches) {
    assert.ok(
      data && Object.keys(data).every((key) => recordFields.has(key)),
      'Unexpected outcome field',
    );
    const enrolled = allowed.get(data.participant);
    assert.ok(
      enrolled && [1, 2].includes(data.play),
      'Unknown participant or scheduled play',
    );
    const key = data.participant + '/' + data.play;
    assert.ok(!entries.has(key), 'Duplicate scheduled entry');
    assert.ok(states.includes(data.status), 'Unknown match status');
    if (data.status !== 'not-started') {
      assert.ok(
        typeof data.matchId === 'string' && data.matchId.trim(),
        'Missing started match ID',
      );
      assert.ok(!keys.has(data.matchId), 'Duplicate started match');
      keys.add(data.matchId);
    }
    if (data.durationSeconds !== undefined)
      assert.ok(
        data.status !== 'not-started' &&
          Number.isSafeInteger(data.durationSeconds) &&
          data.durationSeconds > 0,
        'Invalid recorded duration',
      );
    if (data.familiarity !== undefined) {
      assert.deepEqual(Object.keys(data.familiarity).sort(), [
        'challenge',
        'stacking',
      ]);
      assert.ok(
        Object.values(data.familiarity).every(
          (value) => typeof value === 'boolean',
        ),
      );
      const prior = familiarityByParticipant.get(data.participant);
      if (prior)
        assert.deepEqual(
          data.familiarity,
          prior,
          'Rule familiarity must be recorded consistently for both plays',
        );
      familiarityByParticipant.set(data.participant, data.familiarity);
    }
    if (data.publicExample !== undefined)
      assert.ok(
        typeof data.publicExample === 'string' && data.publicExample.trim(),
        'Invalid public position note',
      );
    if (data.saveEvidence !== undefined) {
      const evidence = data.saveEvidence;
      assert.ok(
        ['ended', 'interrupted'].includes(data.status),
        'Unexpected save evidence for an unplayed or errored slot',
      );
      assert.deepEqual(Object.keys(evidence).sort(), [
        'branch',
        'gameVersion',
        'releaseRef',
        'revision',
        'rosterSha256',
        'rulesVersion',
        'saveSha256',
        'strategyVersion',
      ]);
      assert.equal(evidence.rosterSha256, rosterSha256);
      assert.match(evidence.saveSha256, /^[a-f0-9]{64}$/);
      if (evidence.releaseRef !== null)
        assert.match(evidence.releaseRef, /^[a-f0-9]{64}$/);
      for (const key of ['branch', 'revision'])
        assert.ok(Number.isSafeInteger(evidence[key]) && evidence[key] >= 0);
      for (const key of ['gameVersion', 'rulesVersion', 'strategyVersion'])
        assert.ok(typeof evidence[key] === 'string' && evidence[key].trim());
      savedVersions.add(
        JSON.stringify([
          evidence.releaseRef,
          evidence.gameVersion,
          evidence.rulesVersion,
          evidence.strategyVersion,
        ]),
      );
    }
    if (data.status === 'ended') {
      assert.ok(
        [1, 2, 3, 4].includes(data.winnerSeat),
        'An ended game needs a winner seat',
      );
      assert.ok(
        data.difficulty === undefined ||
          [1, 2, 3, 4, 5].includes(data.difficulty),
      );
      assert.ok(
        data.comeback === undefined || typeof data.comeback === 'boolean',
      );
      if (data.interference !== undefined) {
        assert.equal(enrolled.comparison, '绝悟／捣蛋王');
        assert.deepEqual(Object.keys(data.interference).sort(), [
          'directActions',
          'opportunities',
        ]);
        for (const count of Object.values(data.interference))
          assert.ok(Number.isSafeInteger(count) && count >= 0);
        assert.ok(Number.isSafeInteger(data.interference.opportunities));
        assert.ok(Number.isSafeInteger(data.interference.directActions));
        assert.ok(
          data.interference.directActions <= data.interference.opportunities,
        );
      }
    } else {
      assert.ok(
        data.winnerSeat === undefined,
        'An incomplete game cannot record a winner',
      );
      assert.ok(
        typeof data.reason === 'string' && data.reason.trim(),
        'Record the reason for an incomplete game',
      );
    }
    entries.set(key, data);
  }
  assert.ok(
    savedVersions.size <= 1,
    'Save evidence must come from one UNO release and strategy version',
  );

  const outcomes = schedule.map(({ id, band, comparison, plays }) => ({
    band,
    comparison,
    plays: plays.map((planned, index) => ({
      ...planned,
      ...(entries.get(id + '/' + (index + 1)) ?? { status: 'unrecorded' }),
    })),
  }));
  const comparisons = Object.entries(profiles).map(([name, [left, right]]) => {
    const participants = outcomes.filter(
      ({ comparison }) => comparison === name,
    );
    const full = participants.filter(({ plays }) =>
      plays.every(({ status }) => status === 'ended'),
    );
    const summaries = [left, right].map((profile) => {
      const assigned = participants.flatMap(({ plays }) =>
        plays.filter((play) => play.profile === profile),
      );
      const ended = assigned.filter(({ status }) => status === 'ended');
      const issueCounts = Object.fromEntries(
        [...states, 'unrecorded'].map((state) => [
          state,
          assigned.filter(({ status }) => status === state).length,
        ]),
      );
      const interruptions = assigned
        .filter(({ status, reason }) => status !== 'ended' && reason)
        .map(({ status, reason }) => ({ status, reason }));
      const rates = {
        human: wins(
          ended.map(({ humanSeat, winnerSeat }) => humanSeat === winnerSeat),
        ),
        ...(!ended.some(({ focusSeat }) => focusSeat !== undefined)
          ? {}
          : {
              focalBot: wins(
                ended.map(
                  ({ focusSeat, winnerSeat }) => focusSeat === winnerSeat,
                ),
              ),
            }),
      };
      return {
        profile,
        planned: assigned.length,
        issueCounts,
        interruptions,
        ...rates,
        recordedDurations: ended.filter(
          ({ durationSeconds }) => durationSeconds !== undefined,
        ).length,
        durationMeanSeconds: mean(
          ended.flatMap(({ durationSeconds }) =>
            durationSeconds === undefined ? [] : [durationSeconds],
          ),
        ),
        publicExamplesRecorded: ended.filter(
          ({ publicExample }) => publicExample !== undefined,
        ).length,
        difficultyMean: mean(
          ended.flatMap(({ difficulty }) =>
            difficulty === undefined ? [] : [difficulty],
          ),
        ),
        comebackShare: mean(
          ended.flatMap(({ comeback }) =>
            comeback === undefined ? [] : [Number(comeback)],
          ),
        ),
      };
    });
    const inBands = (take) =>
      experience.map((band) => ({
        band,
        differences: full.filter((row) => row.band === band).flatMap(take),
      }));
    const pairValues = (plays) => [
      plays.find(({ profile }) => profile === left),
      plays.find(({ profile }) => profile === right),
    ];
    const winDifference = paired(
      inBands(({ plays }) => {
        const [a, b] = pairValues(plays);
        return [
          Number(a.humanSeat === a.winnerSeat) -
            Number(b.humanSeat === b.winnerSeat),
        ];
      }),
    );
    const interferenceDifference =
      name !== '绝悟／捣蛋王'
        ? null
        : paired(
            inBands(({ plays }) => {
              const [base, mischief] = pairValues(plays);
              const a = base.interference,
                b = mischief.interference;
              if (!a?.opportunities || !b?.opportunities) return [];
              return [
                b.directActions / b.opportunities -
                  a.directActions / a.opportunities,
              ];
            }),
          );
    return {
      name,
      completePairs: full.length,
      plannedPairs: participants.length,
      summaries,
      humanWinDifference: { direction: left + '−' + right, ...winDifference },
      ...(interferenceDifference
        ? {
            directInterferenceDifference: {
              direction: '捣蛋王−绝悟',
              ...interferenceDifference,
            },
          }
        : {}),
    };
  });
  return {
    type: 'uno-human-experience-pilot-analysis',
    build: input.build,
    rosterSha256,
    resultScope: 'pilot',
    synthetic: input.synthetic === true,
    announcedStatus: 'descriptive',
    comparisons,
    recordedMatches: entries.size,
    completeMatches: [...entries.values()].filter(
      ({ status }) => status === 'ended',
    ).length,
    matchesWithSaveEvidence: [...entries.values()].filter(
      ({ saveEvidence }) => saveEvidence !== undefined,
    ).length,
    participantsWithFamiliarity: familiarityByParticipant.size,
  };
}

if (values['verify-only']) {
  const matching = schedule.flatMap(({ id, comparison, plays }) =>
    plays.map(({ profile, humanSeat, focusSeat }, index) => ({
      participant: id,
      play: index + 1,
      matchId: id + '-' + index,
      status: 'ended',
      winnerSeat:
        profile === profiles[comparison][0] ? humanSeat : (humanSeat % 4) + 1,
      ...(focusSeat === undefined
        ? {}
        : {
            interference: {
              opportunities: 2,
              directActions: profile === '捣蛋王' ? 2 : 0,
            },
          }),
    })),
  );
  const input = {
    version: 1,
    build: 'synthetic-fixture',
    synthetic: true,
    rosterSha256,
    matches: matching,
  };
  const full = analyze(input);
  assert.equal(full.completeMatches, 48);
  assert.ok(
    full.comparisons.every(
      ({ completePairs, humanWinDifference }) =>
        completePairs === 8 && humanWinDifference.interval95.lower === 1,
    ),
  );
  assert.equal(
    full.comparisons[2].directInterferenceDifference.interval95.lower,
    1,
  );
  const failed = { ...matching[1] };
  delete failed.winnerSeat;
  const partial = analyze({
    ...input,
    matches: [
      matching[0],
      { ...failed, status: 'error', reason: 'Synthetic interruption' },
    ],
  });
  assert.equal(partial.completeMatches, 1);
  assert.equal(partial.comparisons[0].completePairs, 0);
  assert.equal(partial.comparisons[0].humanWinDifference.interval95, null);
  assert.equal(
    partial.comparisons[0].summaries.reduce(
      (count, { issueCounts }) => count + issueCounts.error,
      0,
    ),
    1,
  );
  assert.throws(
    () => analyze({ ...input, matches: [matching[0], matching[0]] }),
    /Duplicate scheduled entry/,
  );
  assert.throws(
    () => analyze({ ...input, matches: [{ ...matching[0], humanSeat: 4 }] }),
    /Unexpected outcome field/,
  );
  assert.throws(
    () =>
      analyze({
        ...input,
        matches: [
          matching[0],
          { ...matching[1], status: 'error', reason: 'Synthetic interruption' },
        ],
      }),
    /cannot record a winner/,
  );
  const enriched = analyze({
    ...input,
    matches: [
      {
        ...matching[0],
        durationSeconds: 900,
        publicExample: '公开比分变化',
        familiarity: { stacking: true, challenge: false },
        saveEvidence: {
          branch: 0,
          revision: 1,
          gameVersion: '1.0.0',
          rulesVersion: 'fixture',
          strategyVersion: 'fixture',
          releaseRef: null,
          rosterSha256,
          saveSha256: 'c'.repeat(64),
        },
      },
    ],
  });
  assert.equal(enriched.matchesWithSaveEvidence, 1);
  assert.equal(enriched.participantsWithFamiliarity, 1);
  const summary = enriched.comparisons[0].summaries.find(
    ({ profile }) => profile === '默认',
  );
  assert.equal(summary.durationMeanSeconds, 900);
  assert.equal(summary.publicExamplesRecorded, 1);
  assert.ok(!JSON.stringify(enriched).includes('公开比分变化'));
  assert.throws(
    () =>
      analyze({ ...input, matches: [{ ...matching[0], durationSeconds: 0 }] }),
    /Invalid recorded duration/,
  );
  console.log(
    JSON.stringify({
      fixtureOnly: true,
      actualParticipants: 0,
      checks: [
        'complete-pair',
        'single-match',
        'interrupted',
        'interference',
        'duplicates',
        'seat-override',
        'invalid-winner',
        'duration',
        'save-evidence',
        'public-example-count',
      ],
      rosterSha256,
    }),
  );
} else {
  assert.ok(values.input, 'Pass --input with a pilot result JSON file');
  console.log(
    JSON.stringify(
      analyze(
        JSON.parse(readFileSync(values.input, 'utf8').replace(/^\ufeff/, '')),
      ),
      null,
      2,
    ),
  );
}
