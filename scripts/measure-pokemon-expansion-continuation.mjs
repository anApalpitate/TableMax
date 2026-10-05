import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

// In-process measurements only. Every invocation preserves an isolated result.
// Reuses the original measurement loop; the assertions below detect stale hooks.
const argument = (name, fallback) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;
const naturalSeeds = Number(argument('natural-seeds', '24'));
const strengthSeeds = Number(argument('strength-seeds', '24'));
const originalSeeds = Number(argument('original-seeds', '3'));
const seedBase = Number(argument('seed-base', '612500'));
const actionCap = Number(argument('action-cap', '1200'));
const evidenceName = argument(
  'evidence',
  `run-${Date.now()}-${randomUUID().slice(0, 8)}`,
);
for (const [name, value] of Object.entries({
  naturalSeeds,
  strengthSeeds,
  originalSeeds,
}))
  assert.ok(
    Number.isSafeInteger(value) && value >= 0 && value <= 200,
    `${name} must be 0–200`,
  );
assert.ok(
  naturalSeeds + strengthSeeds > 0,
  'At least one measurement cohort is required',
);
assert.ok(
  Number.isSafeInteger(seedBase) && seedBase > 0 && seedBase < 0x7fffffff,
  'Invalid seed base',
);
assert.ok(
  Number.isSafeInteger(actionCap) && actionCap >= 100 && actionCap <= 10000,
  'Invalid action cap',
);
assert.match(evidenceName, /^[a-zA-Z0-9_-]+$/, 'Invalid evidence name');
const temporary = resolve(
  'tmp/pokemon-expansion-balance-continuation',
  evidenceName,
);
const evidenceRoot = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-balance-continuation',
);
const evidence = join(evidenceRoot, evidenceName);
await mkdir(temporary, { recursive: true });
await mkdir(evidenceRoot, { recursive: true });
await mkdir(evidence, { recursive: false });
const source = await readFile('scripts/measure-pokemon-expansion.mjs', 'utf8');
const match = /const runner = `([\s\S]*?)`;\r?\nconst compilation/.exec(source);
assert.ok(match, 'Original measurement runner boundary changed');
let runner = match[1];
const replace = (from, to) => {
  assert.equal(
    runner.split(from).length,
    2,
    `Measurement hook missing or ambiguous: ${from.slice(0, 80)}`,
  );
  runner = runner.replace(from, to);
};
replace(
  "import { tasks } from './games/pokemon-encounters/expansion/research.ts';",
  `import { tasks } from './games/pokemon-encounters/expansion/research.ts';
import { card } from './games/pokemon-encounters/expansion/cards.ts';
import { scoreBoard } from './games/pokemon-encounters/expansion/scoring.ts';`,
);
replace(
  'export async function measure(variant, players, seed, mixOffset, cap) {',
  'export async function measure(variant, players, seed, mixOffset, cap, explicitDifficulties = null) {',
);
replace(
  'difficultyNames[(i+mixOffset)%3]',
  'explicitDifficulties?.[i] ?? difficultyNames[(i+mixOffset)%3]',
);
replace(
  'const visits = new Map(), phases = new Set();',
  `const visits = new Map(), phases = new Set();
  const observations = { votes: [], drawCategories: {}, arceusChoices: 0, arceusDeclines: 0,
    trueCoveredCards: 0, coverActions: [], maxSimultaneousGodSpecies: 0, everVisibleGodSpecies: [] };
  const visibleGods = new Set();
  function observeTable(s) {
    if (variant !== 'expansion') return;
    const species = new Set();
    const ended = ['round-result','match-result'].includes(s.phase);
    for (const owner of seats) for (let i=0;i<s.boards[owner].length;i++) {
      const slot=s.boards[owner][i];
      const visible=ended?s.preReveal?.[owner]?.[i]:slot.faceUp;
      const ability=card(slot.instanceId).ability;
      if(visible && ['groudon','kyogre','rayquaza'].includes(ability)) species.add(ability);
    }
    for(const speciesId of species) visibleGods.add(speciesId);
    observations.maxSimultaneousGodSpecies=Math.max(observations.maxSimultaneousGodSpecies,species.size);
  }`,
);
replace(
  "if(result.action.type==='vote-research') voteActions++;",
  `if(result.action.type==='vote-research') {
      voteActions++;
      observations.votes.push({seat,difficulty:difficulties[seat],taskId:result.action.taskId});
    }
    if(state.phase==='arceus-choice') {
      observations.arceusChoices++;
      if(result.action.type==='decline-ability') observations.arceusDeclines++;
    }`,
);
replace(
  'state=rules.validateState(state,seats);',
  `state=rules.validateState(state,seats);
    if(variant==='expansion') {
      if(result.action.type==='draw' && state.held) {
        const id=card(state.held).categoryId;
        observations.drawCategories[id]=(observations.drawCategories[id]??0)+1;
      }
      const beforeUp=new Set(seats.flatMap(owner=>previous.boards[owner].filter(slot=>slot.faceUp).map(slot=>slot.instanceId)));
      const afterDown=new Set(seats.flatMap(owner=>state.boards[owner].filter(slot=>!slot.faceUp).map(slot=>slot.instanceId)));
      const newlyCovered=[...beforeUp].filter(id=>afterDown.has(id)).length;
      observations.trueCoveredCards+=newlyCovered;
      if(result.action.type==='ninja-target'||result.action.type==='activate-arceus')
        observations.coverActions.push({actionIndex:legalActionCount,ordinaryTurn:ordinaryTurns,seat,
          difficulty:difficulties[seat],type:result.action.type,newlyCovered});
      observeTable(state);
    }`,
);
replace(
  "const completed=['round-result','match-result'].includes(state.phase);",
  `observations.everVisibleGodSpecies=[...visibleGods].sort();
  const completed=['round-result','match-result'].includes(state.phase);
  const finalTaskFeasibility=variant==='expansion' && completed?tasks.map(definition=>({
    id:definition.id,achievedSeats:seats.filter(seat=>scoreBoard(state.boards[seat].map(slot=>slot.instanceId),
      [definition.id],state.preReveal[seat]).research[0].achieved)})):[];`,
);
replace(
  'return {variant,players,seed,difficulties,completed,capReached:!completed,actionCap:cap,',
  'return {variant,players,seed,difficulties,completed,capReached:!completed,actionCap:cap,observations,finalTaskFeasibility,',
);
const bundlePath = join(temporary, 'measure.cjs');
const compilation = await build({
  stdin: {
    contents: runner,
    resolveDir: resolve('.'),
    sourcefile: 'pokemon-expansion-continuation.ts',
    loader: 'ts',
  },
  outfile: bundlePath,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  metafile: true,
  logLevel: 'silent',
});
const inputs = [
  ...new Set([
    ...Object.keys(compilation.metafile.inputs).filter(
      (path) =>
        !path.includes('node_modules') &&
        path !== 'pokemon-expansion-continuation.ts',
    ),
    'scripts/measure-pokemon-expansion.mjs',
    'scripts/measure-pokemon-expansion-continuation.mjs',
    'games/pokemon-encounters/game-module.json',
    'package.json',
    'pnpm-lock.yaml',
  ]),
].sort();
async function sourceHashes() {
  return Object.fromEntries(
    await Promise.all(
      inputs.map(async (path) => [
        path,
        createHash('sha256')
          .update(await readFile(resolve(path)))
          .digest('hex'),
      ]),
    ),
  );
}
const beforeHashes = await sourceHashes();
const harness = createRequire(import.meta.url)(bundlePath);
const rounds = [];
const startedAt = new Date().toISOString();
const started = performance.now();
for (let players = 2; players <= 6; players++) {
  const cohortStarted = performance.now();
  for (let index = 0; index < naturalSeeds; index++) {
    const seed = seedBase + players + (index + 1) * 177;
    const round = await harness.measure(
      'expansion',
      players,
      seed,
      index % 3,
      actionCap,
    );
    rounds.push({ ...round, cohort: 'natural', seedIndex: index });
    if (index < originalSeeds)
      rounds.push({
        ...(await harness.measure(
          'original',
          players,
          seed,
          index % 3,
          actionCap,
        )),
        cohort: 'paired-original',
        seedIndex: index,
      });
  }
  await writeFile(
    join(evidence, 'rounds-partial.json'),
    JSON.stringify(rounds, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      cohort: 'natural',
      players,
      completed: naturalSeeds,
      elapsedMs: Math.round(performance.now() - cohortStarted),
      hoenn: rounds.filter(
        (r) =>
          r.variant === 'expansion' &&
          r.players === players &&
          r.hoennTriggered,
      ).length,
      arceus: rounds
        .filter((r) => r.variant === 'expansion' && r.players === players)
        .reduce((n, r) => n + r.arceusActivations, 0),
    }),
  );
}
for (let index = 0; index < strengthSeeds; index++) {
  const seed = seedBase + 100003 + (index + 1) * 239;
  for (let rotation = 0; rotation < 3; rotation++)
    rounds.push({
      ...(await harness.measure('expansion', 3, seed, rotation, actionCap)),
      cohort: 'strength',
      seedIndex: index,
      rotation,
    });
  if ((index + 1) % 6 === 0 || index + 1 === strengthSeeds) {
    await writeFile(
      join(evidence, 'rounds-partial.json'),
      JSON.stringify(rounds, null, 2) + '\n',
    );
    console.log(
      JSON.stringify({
        cohort: 'strength',
        completedSeedBlocks: index + 1,
        totalSeedBlocks: strengthSeeds,
        elapsedMs: Math.round(performance.now() - started),
      }),
    );
  }
}
const afterHashes = await sourceHashes();
const sourceStable =
  JSON.stringify(beforeHashes) === JSON.stringify(afterHashes);
const natural = rounds.filter((r) => r.cohort === 'natural'),
  strength = rounds.filter((r) => r.cohort === 'strength');
const expansion = rounds.filter((r) => r.variant === 'expansion');
const mean = (values) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const median = (values) => {
  if (!values.length) return null;
  const a = [...values].sort((a, b) => a - b),
    m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const sum = (rs, key) => rs.reduce((n, r) => n + r[key], 0);
const taskSummary = harness.researchDefinitions.map((t) => {
  const candidates = natural.filter((r) => r.openingCandidates.includes(t.id));
  const elections = natural.filter((r) =>
    r.research.some((task) => task.id === t.id),
  );
  const eligibleSeats = elections.reduce((n, r) => n + r.players, 0);
  const achievements = elections.reduce(
    (n, r) =>
      n + r.research.find((task) => task.id === t.id).achievedSeats.length,
    0,
  );
  const attainable = natural.filter(
    (r) =>
      r.finalTaskFeasibility.find((task) => task.id === t.id)?.achievedSeats
        .length,
  );
  const finalFeasibleSeats = natural.reduce(
    (n, r) =>
      n +
      (r.finalTaskFeasibility.find((task) => task.id === t.id)?.achievedSeats
        .length ?? 0),
    0,
  );
  return {
    ...t,
    candidateRounds: candidates.length,
    votes: sum(
      natural.map((r) => ({
        count: r.observations.votes.filter((v) => v.taskId === t.id).length,
      })),
      'count',
    ),
    activeRounds: elections.length,
    eligibleSeats,
    achievements,
    achievementRate: eligibleSeats ? achievements / eligibleSeats : null,
    finalFeasibleRounds: attainable.length,
    finalFeasibleSeats,
  };
});
const naturalSummary = Array.from({ length: 5 }, (_, i) => {
  const players = i + 2,
    rs = natural.filter((r) => r.players === players),
    original = rounds.filter(
      (r) => r.cohort === 'paired-original' && r.players === players,
    );
  return {
    players,
    rounds: rs.length,
    completed: rs.filter((r) => r.completed).length,
    medianOrdinaryTurns: median(rs.map((r) => r.ordinaryTurns)),
    medianLegalActions: median(rs.map((r) => r.legalActionCount)),
    pairedOriginalRounds: original.length,
    pairedOriginalMedianOrdinaryTurns: median(
      original.map((r) => r.ordinaryTurns),
    ),
    pairedMedianOrdinaryTurnRatio: median(
      original.map(
        (r) =>
          rs.find((e) => e.seed === r.seed).ordinaryTurns / r.ordinaryTurns,
      ),
    ),
    hoennRounds: rs.filter((r) => r.hoennTriggered).length,
    everVisibleAllThreeRounds: rs.filter(
      (r) => r.observations.everVisibleGodSpecies.length === 3,
    ).length,
    arceusDraws: rs.reduce(
      (n, r) => n + (r.observations.drawCategories['special-arceus'] ?? 0),
      0,
    ),
    arceusChoiceRounds: rs.filter((r) => r.observations.arceusChoices > 0)
      .length,
    arceusChoices: rs.reduce((n, r) => n + r.observations.arceusChoices, 0),
    arceusActivations: sum(rs, 'arceusActivations'),
    arceusDeclines: rs.reduce((n, r) => n + r.observations.arceusDeclines, 0),
    ninjaCoverActivations: sum(rs, 'ninjaCoverActivations'),
    ninjaSwapActivations: sum(rs, 'ninjaSwapActivations'),
    trueCoveredCards: rs.reduce(
      (n, r) => n + r.observations.trueCoveredCards,
      0,
    ),
    repositionTurns: sum(rs, 'repositionTurns'),
    maxConsecutiveRepositions: Math.max(
      0,
      ...rs.map((r) => r.maxConsecutiveRepositions),
    ),
    repeatedConfigurations: sum(rs, 'repeatedConfigurations'),
    maxConfigurationVisits: Math.max(
      0,
      ...rs.map((r) => r.maxConfigurationVisits),
    ),
    researchChangedWinners: rs.filter((r) => r.researchChangedWinners).length,
    meanDeduction: mean(rs.flatMap((r) => r.scores.map((s) => s.deduction))),
    roundsWithMatchedLine: rs.filter((r) =>
      r.scores.some((s) => s.matchedLines > 0),
    ).length,
    simulationWallMs: sum(rs, 'simulationWallMs'),
  };
});
const tierSummary = ['default', 'doubao', 'juewu'].map((difficulty) => {
  const seats = strength.flatMap((r) =>
    r.scores
      .filter((s) => r.difficulties[s.seat] === difficulty)
      .map((s) => ({ r, s })),
  );
  const seatExposures = Object.fromEntries(
    ['s0', 's1', 's2'].map((seat) => [
      seat,
      seats.filter((x) => x.s.seat === seat).length,
    ]),
  );
  return {
    difficulty,
    seatRounds: seats.length,
    seatExposures,
    winsIncludingTies: seats.filter(({ r, s }) =>
      r.finalWinners.includes(s.seat),
    ).length,
    fractionalWins: seats.reduce(
      (n, { r, s }) =>
        n + (r.finalWinners.includes(s.seat) ? 1 / r.finalWinners.length : 0),
      0,
    ),
    meanRank: mean(
      seats.map(
        ({ r, s }) =>
          1 +
          r.scores.filter((other) => other.total < s.total).length +
          r.scores.filter(
            (other) => other.seat !== s.seat && other.total === s.total,
          ).length /
            2,
      ),
    ),
    meanTotal: mean(seats.map(({ s }) => s.total)),
    meanBase: mean(seats.map(({ s }) => s.base)),
    meanDeduction: mean(seats.map(({ s }) => s.deduction)),
  };
});
const pairwise = [
  ['default', 'doubao'],
  ['default', 'juewu'],
  ['doubao', 'juewu'],
].map(([a, b]) => {
  let wins = 0,
    losses = 0,
    ties = 0;
  const differences = [];
  for (const r of strength) {
    const sa = r.scores.find((s) => r.difficulties[s.seat] === a),
      sb = r.scores.find((s) => r.difficulties[s.seat] === b);
    if (!sa || !sb) continue;
    differences.push(sa.total - sb.total);
    if (sa.total < sb.total) wins++;
    else if (sa.total > sb.total) losses++;
    else ties++;
  }
  return {
    a,
    b,
    winsA: wins,
    winsB: losses,
    ties,
    scoreDifferenceMeanAminusB: mean(differences),
    tieAdjustedScoreA: differences.length
      ? (wins + ties / 2) / differences.length
      : null,
  };
});
const capReached = rounds
  .filter((r) => r.capReached)
  .map(({ cohort, variant, players, seed, rotation }) => ({
    cohort,
    variant,
    players,
    seed,
    rotation,
  }));
const report = {
  generatedAt: new Date().toISOString(),
  startedAt,
  elapsedMs: performance.now() - started,
  sourceStable,
  sourceHashesBefore: beforeHashes,
  sourceHashesAfter: afterHashes,
  parameters: {
    naturalSeedsPerPlayerCount: naturalSeeds,
    strengthSeedBlocks: strengthSeeds,
    originalSeedsPerPlayerCount: Math.min(naturalSeeds, originalSeeds),
    seedBase,
    actionCap,
  },
  definitions: {
    natural:
      'Unmodified production bots and unforced seeded decks, one first round per seed, 2–6 players.',
    strength:
      'Three-player seeded blocks, each tier occupies each seat exactly once across three rotations; ties receive fractional win credit.',
    taskFinalFeasibility:
      'Counterfactual task-only scoring on the actual final board/pre-reveal snapshot; allows legal copy tie choices for that task. This is not an elected task achievement.',
    trueCoveredCards:
      'Card identities that were face up before an action and face down afterwards, excluding mere movement between slots.',
    repeatedConfigurations:
      'Same authoritative table/pile fingerprint excluding bot memory, rule RNG and event counters; diagnostic only.',
    winnerImpact:
      'Base-score winners versus winners after elected task deductions; descriptive, not a causal replay with rewards disabled.',
  },
  limits: [
    'In-process rules/bot measurement, not Worker/SQLite/UI/physical phone/listening acceptance.',
    'CPU time and action counts are not human play time. The 2–3x human duration target remains unmeasured.',
    'Three-player tier results describe this seed cohort. Rotations within a seed are correlated and multiplayer research voting can affect outcomes.',
    'Bots use wall-clock budgets; fixed RNG seeds and source hashes permit reruns but timing contention can change sampled search depth.',
    'First-round sampling does not measure whole-match strength or long-run opening/Hoenn pool exhaustion.',
  ],
  naturalSummary,
  taskSummary,
  tierSummary,
  pairwise,
  capReached,
  rounds,
};
await writeFile(
  join(evidence, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
const show = (n) =>
  n === null ? '未取样' : Number.isInteger(n) ? String(n) : n.toFixed(3);
const rows = naturalSummary
  .map(
    (r) =>
      `| ${r.players} | ${r.rounds} | ${r.medianOrdinaryTurns} | ${r.hoennRounds} | ${r.everVisibleAllThreeRounds} | ${r.arceusDraws}/${r.arceusChoices}/${r.arceusActivations} | ${r.researchChangedWinners} | ${r.maxConsecutiveRepositions} |`,
  )
  .join('\n');
const taskRows = taskSummary
  .map(
    (t) =>
      `| ${t.id} ${t.name} | ${t.candidateRounds} | ${t.votes} | ${t.activeRounds} | ${t.achievements}/${t.eligibleSeats} | ${t.finalFeasibleSeats} |`,
  )
  .join('\n');
const tierRows = tierSummary
  .map(
    (t) =>
      `| ${t.difficulty} | ${t.seatRounds} | ${t.winsIncludingTies} | ${show(t.fractionalWins)} | ${show(t.meanRank)} | ${show(t.meanTotal)} |`,
  )
  .join('\n');
await writeFile(
  join(evidence, 'overview.md'),
  `# 扩展版自然频率与三档对照续测\n\n源码前后哈希一致：${sourceStable}；实耗 ${(report.elapsedMs / 1000).toFixed(2)} 秒；扩展 ${expansion.length} 小局、${sum(expansion, 'legalActionCount')} 个合法动作，封顶 ${capReached.length} 局。\n\n复跑：\`node scripts/measure-pokemon-expansion-continuation.mjs --natural-seeds=${naturalSeeds} --strength-seeds=${strengthSeeds} --original-seeds=${originalSeeds} --seed-base=${seedBase} --action-cap=${actionCap}\`，每次新建证据目录。\n\n| 人数 | 自然小局 | 普通回合中位 | 三神齐聚 | 三种曾先后明置 | 阿尔宙斯取到/选择/发动 | 研究改变赢家 | 连续调位最长 |\n| --- | --- | --- | --- | --- | --- | --- | --- |\n${rows}\n\n| 任务 | 候选小局 | 票数 | 当选小局 | 当选达成座位/合资格座位 | 最终棋盘离线可达座位 |\n| --- | --- | --- | --- | --- | --- |\n${taskRows}\n\n离线可达逐项用实际终盘和强制揭牌前快照计分，允许对应任务的合法复制同基础分择优。未当选时不算真实达成，不表示玩家主动追求该任务。\n\n| 档位 | 座位小局 | 含共同赢家次数 | 分摊获胜数 | 平均名次 | 平均最终分 |\n| --- | --- | --- | --- | --- | --- |\n${tierRows}\n\n档位对照为同种子3人三次座位轮换，座位暴露完全相等。种子块内样本相关，结果是描述统计；不推断所有人数、整场三胜胜率或稳定强度保证。逐局、同局两两比分、盖回身份计数、来源哈希见 report.json。CPU／动作数量不能证明真人时长，实体手机与听感仍未验。\n`,
);
console.log(
  JSON.stringify({
    report: join(evidence, 'report.json'),
    sourceStable,
    expansionRounds: expansion.length,
    elapsedMs: Math.round(report.elapsedMs),
    capReached: capReached.length,
    hoennNatural: natural.filter((r) => r.hoennTriggered).length,
    arceusNatural: sum(natural, 'arceusActivations'),
    tierSummary,
    pairwise,
  }),
);
assert.ok(
  sourceStable,
  'Source changed during measurement; report is not accepted',
);
assert.equal(
  capReached.length,
  0,
  'At least one round exhausted the action cap',
);
