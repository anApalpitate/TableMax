import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

// Run from the repository root. Each invocation creates fresh isolated evidence.
// Example: node scripts/measure-pokemon-expansion.mjs --seeds=3 --seed-base=610500
const argument = (name, fallback) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=') ?? fallback;
const seeds = Number(argument('seeds', '3'));
const seedBase = Number(argument('seed-base', '610500'));
const actionCap = Number(argument('action-cap', '1200'));
const evidenceName = argument(
  'evidence',
  `run-${Date.now()}-${randomUUID().slice(0, 8)}`,
);
assert.ok(
  Number.isSafeInteger(seeds) && seeds >= 1 && seeds <= 100,
  'seeds must be 1–100',
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
  'tmp/pokemon-expansion-verification/balance',
  evidenceName,
);
const evidenceRoot = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-balance',
);
const evidence = join(evidenceRoot, evidenceName);
await mkdir(temporary, { recursive: true });
await mkdir(evidenceRoot, { recursive: true });
// Do not overwrite an earlier run, including one that failed.
await mkdir(evidence, { recursive: false });
const bundlePath = join(temporary, 'measure.cjs');
const runner = `
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { rules as originalRules } from './games/pokemon-encounters/rules/index.ts';
import { bot as originalBot } from './games/pokemon-encounters/bot/index.ts';
import { pokemonExpansion } from './games/pokemon-encounters/expansion/index.ts';
import { bot as expansionBot } from './games/pokemon-encounters/expansion/bot/index.ts';
import { tasks } from './games/pokemon-encounters/expansion/research.ts';
import { RandomSource } from './packages/platform-core/src/random.ts';
const difficultyNames = ['default', 'doubao', 'juewu'];
function tableFingerprint(state) {
  const data = Object.fromEntries(['boards','deck','discard','held','phase','turnSeat','recipientQueue',
    'recipientIndex','coin','peekSlot','peekSlots','targetSeat','suppressedAbility','rowAbility','arceusUsed',
    'activeResearch','initialDone','votesBySeat'].filter(key => Object.hasOwn(state,key)).map(key => [key,state[key]]));
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}
export async function measure(variant, players, seed, mixOffset, cap) {
  const rules = variant === 'original' ? originalRules : pokemonExpansion;
  const bot = variant === 'original' ? originalBot : expansionBot;
  const seats = Array.from({length:players},(_,i)=>'s'+i);
  const difficulties = Object.fromEntries(seats.map((seat,i)=>[seat,difficultyNames[(i+mixOffset)%3]]));
  const context = {seats, random:new RandomSource(seed)};
  const randoms = Object.fromEntries(seats.map((seat,i)=>[seat,new RandomSource((seed ^ ((i+1)*7193)) >>> 0 || 1)]));
  const memories = Object.fromEntries(seats.map(seat=>[seat,null]));
  let state = rules.initialize(context), legalActionCount = 0, ordinaryTurns = 0, initialFlipActions = 0,
    voteActions = 0, repositionTurns = 0, coverActivations = 0, ninjaCoverActivations = 0,
    ninjaSwapActivations = 0, arceusActivations = 0, rowExchanges = 0, extraDraws = 0,
    netCoveredCards = 0, consecutiveRepositions = 0, maxConsecutiveRepositions = 0,
    repeatedConfigurations = 0, maxConfigurationVisits = 1, maxComputeMs = 0;
  const visits = new Map(), phases = new Set();
  const initial = state.boards[seats[0]].length;
  const started = performance.now();
  for (;legalActionCount<cap && !['round-result','match-result'].includes(state.phase);legalActionCount++) {
    phases.add(state.phase);
    const fingerprint = tableFingerprint(state), visited = (visits.get(fingerprint)??0)+1;
    visits.set(fingerprint,visited);if(visited>1) repeatedConfigurations++;
    maxConfigurationVisits=Math.max(maxConfigurationVisits,visited);
    const decision = rules.decisions(state)[0];
    assert.ok(decision,'Missing player decision at '+state.phase);
    const seat = decision.seatId, view = rules.project(state,{role:'player',seatId:seat});
    const actions = rules.legalActions(state,seat), ruleRandomBefore = context.random.state;
    const decisionStart=performance.now();
    const result = await bot.decide({view,actions,decision,memory:memories[seat],difficulty:difficulties[seat],
      random:randoms[seat],signal:new AbortController().signal});
    maxComputeMs=Math.max(maxComputeMs,performance.now()-decisionStart);
    assert.equal(context.random.state,ruleRandomBefore,'Strategy consumed rule RNG');
    assert.ok(actions.some(action=>JSON.stringify(action)===JSON.stringify(result.action)),'Illegal strategy action');
    if(state.phase==='draw') {
      ordinaryTurns++;
      consecutiveRepositions=result.action.type==='reposition'?consecutiveRepositions+1:0;
      maxConsecutiveRepositions=Math.max(maxConsecutiveRepositions,consecutiveRepositions);
    }
    if(result.action.type==='initial-flip') initialFlipActions++;
    if(result.action.type==='vote-research') voteActions++;
    if(result.action.type==='reposition') repositionTurns++;
    if(result.action.type==='ninja-target') {
      coverActivations++;ninjaCoverActivations++;if(result.action.swap)ninjaSwapActivations++;
    }
    if(result.action.type==='activate-arceus') {coverActivations++;arceusActivations++;}
    if(result.action.type==='row-target') rowExchanges++;
    if(state.phase==='lucario-draw'&&result.action.type==='draw') extraDraws++;
    const previous=state;
    memories[seat]=bot.validateMemory(result.memory);
    state=rules.apply(state,rules.validateAction(result.action),seat,context).state;
    state=rules.validateState(state,seats);
    for(const owner of seats) for(let i=0;i<previous.boards[owner].length;i++)
      if(previous.boards[owner][i].faceUp && state.boards[owner][i] && !state.boards[owner][i].faceUp) netCoveredCards++;
    for(const observer of seats) if(bot.observe) memories[observer]=bot.validateMemory(bot.observe({
      view:rules.project(state,{role:'player',seatId:observer}),memory:memories[observer],seatId:observer,difficulty:difficulties[observer]}));
  }
  const completed=['round-result','match-result'].includes(state.phase);
  const scoreEntries=completed?Object.entries(state.roundResult.scores):[];
  const baseMinimum=completed?Math.min(...scoreEntries.map(([,score])=>score.base??score.total)):null;
  const baseWinners=completed?scoreEntries.filter(([,score])=>(score.base??score.total)===baseMinimum).map(([seat])=>seat):[];
  const finalWinners=completed?[...state.roundResult.winners]:[];
  const research=(state.activeResearch??[]).map(id=>{
    const definition=tasks.find(task=>task.id===id);
    return {...definition,achievedSeats:scoreEntries.filter(([,score])=>score.research?.some(research=>research.taskId===id&&research.achieved)).map(([seat])=>seat)};
  });
  return {variant,players,seed,difficulties,completed,capReached:!completed,actionCap:cap,
    deckProfile:variant==='original'?'original-56':players<=3?'small-112':'standard-144',
    cardCount:variant==='original'?56:players<=3?112:144,
    boardSlots:variant==='original'?initial:9,legalActionCount,ordinaryTurns,initialFlipActions,voteActions,
    repositionTurns,coverActivations,ninjaCoverActivations,ninjaSwapActivations,arceusActivations,rowExchanges,extraDraws,
    netCoveredCards,maxConsecutiveRepositions,repeatedConfigurations,maxConfigurationVisits,phases:[...phases],
    openingCandidates:state.researchCandidates??[],voteCounts:state.voteCounts??null,research,
    hoennTriggered:state.hoennTriggered??false,baseWinners,finalWinners,
    researchChangedWinners:JSON.stringify(baseWinners)!==JSON.stringify(finalWinners),
    scores:scoreEntries.map(([seat,score])=>({seat,base:score.base??score.total,deduction:score.deduction??0,total:score.total,
      matchedLines:score.matchedLines?.length??score.values.slice(0,3).filter((value,i)=>value===score.values[i+3]).length})),
    simulationWallMs:performance.now()-started,maxComputeMs,ruleRandomAtEnd:context.random.state};
}
export const researchDefinitions=tasks;
`;
const compilation = await build({
  stdin: {
    contents: runner,
    resolveDir: resolve('.'),
    sourcefile: 'pokemon-expansion-measure.ts',
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
        path !== 'pokemon-expansion-measure.ts',
    ),
    'games/pokemon-encounters/game-module.json',
    'scripts/measure-pokemon-expansion.mjs',
    'package.json',
    'pnpm-lock.yaml',
  ]),
].sort();
async function sourceHashes() {
  const entries = await Promise.all(
    inputs.map(async (path) => [
      path,
      createHash('sha256')
        .update(await readFile(resolve(path)))
        .digest('hex'),
    ]),
  );
  return Object.fromEntries(entries);
}
const beforeHashes = await sourceHashes();
const harness = createRequire(import.meta.url)(bundlePath);
const rounds = [];
for (let players = 2; players <= 6; players++)
  for (let index = 0; index < seeds; index++) {
    const seed = seedBase + players + (index + 1) * 177;
    for (const variant of ['original', 'expansion'])
      rounds.push(
        await harness.measure(variant, players, seed, index % 3, actionCap),
      );
    console.log(
      `${players} players, seed ${index + 1}/${seeds}: original ${rounds.at(-2).ordinaryTurns} / expansion ${rounds.at(-1).ordinaryTurns} ordinary turns`,
    );
  }
const afterHashes = await sourceHashes();
const median = (values) => {
  const ordered = [...values].sort((a, b) => a - b),
    middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : (ordered[middle - 1] + ordered[middle]) / 2;
};
const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const comparisons = Array.from({ length: 5 }, (_, index) => {
  const players = index + 2,
    original = rounds.filter(
      (round) => round.players === players && round.variant === 'original',
    ),
    expansion = rounds.filter(
      (round) => round.players === players && round.variant === 'expansion',
    );
  return {
    players,
    samples: seeds,
    completedOriginal: original.filter((round) => round.completed).length,
    completedExpansion: expansion.filter((round) => round.completed).length,
    originalMedianOrdinaryTurns: median(
      original.map((round) => round.ordinaryTurns),
    ),
    expansionMedianOrdinaryTurns: median(
      expansion.map((round) => round.ordinaryTurns),
    ),
    pairedMedianOrdinaryTurnRatio: median(
      expansion.map(
        (round, i) => round.ordinaryTurns / original[i].ordinaryTurns,
      ),
    ),
    originalMedianLegalActions: median(
      original.map((round) => round.legalActionCount),
    ),
    expansionMedianLegalActions: median(
      expansion.map((round) => round.legalActionCount),
    ),
    expansionMeanMatchedLines: mean(
      expansion.flatMap((round) =>
        round.scores.map((score) => score.matchedLines),
      ),
    ),
    originalMeanMatchedLines: mean(
      original.flatMap((round) =>
        round.scores.map((score) => score.matchedLines),
      ),
    ),
    expansionRoundsWithMatchedLine: expansion.filter((round) =>
      round.scores.some((score) => score.matchedLines > 0),
    ).length,
    expansionHoennTriggered: expansion.filter((round) => round.hoennTriggered)
      .length,
    expansionResearchChangedWinners: expansion.filter(
      (round) => round.researchChangedWinners,
    ).length,
    expansionRepositionTurns: expansion.reduce(
      (sum, round) => sum + round.repositionTurns,
      0,
    ),
    expansionCoverActivations: expansion.reduce(
      (sum, round) => sum + round.coverActivations,
      0,
    ),
    expansionRowExchanges: expansion.reduce(
      (sum, round) => sum + round.rowExchanges,
      0,
    ),
  };
});
const taskSummary = harness.researchDefinitions.map((definition) => {
  const appearances = rounds
    .filter((round) => round.variant === 'expansion')
    .flatMap((round) =>
      round.research
        .filter((research) => research.id === definition.id)
        .map((research) => ({ players: round.players, research })),
    );
  const eligibleSeats = appearances.reduce(
      (sum, item) => sum + item.players,
      0,
    ),
    achievements = appearances.reduce(
      (sum, item) => sum + item.research.achievedSeats.length,
      0,
    );
  return {
    ...definition,
    appearances: appearances.length,
    eligibleSeats,
    achievements,
    achievementRate: eligibleSeats ? achievements / eligibleSeats : null,
  };
});
const sourceStable =
  JSON.stringify(beforeHashes) === JSON.stringify(afterHashes);
const expansionRounds = rounds.filter((round) => round.variant === 'expansion');
const totals = {
  originalLegalActions: rounds
    .filter((round) => round.variant === 'original')
    .reduce((sum, round) => sum + round.legalActionCount, 0),
  expansionLegalActions: expansionRounds.reduce(
    (sum, round) => sum + round.legalActionCount,
    0,
  ),
  expansionRepositionTurns: expansionRounds.reduce(
    (sum, round) => sum + round.repositionTurns,
    0,
  ),
  expansionNinjaCoverActivations: expansionRounds.reduce(
    (sum, round) => sum + round.ninjaCoverActivations,
    0,
  ),
  expansionNinjaSwapActivations: expansionRounds.reduce(
    (sum, round) => sum + round.ninjaSwapActivations,
    0,
  ),
  expansionArceusActivations: expansionRounds.reduce(
    (sum, round) => sum + round.arceusActivations,
    0,
  ),
  expansionRowExchanges: expansionRounds.reduce(
    (sum, round) => sum + round.rowExchanges,
    0,
  ),
  expansionMaxConsecutiveRepositions: Math.max(
    ...expansionRounds.map((round) => round.maxConsecutiveRepositions),
  ),
  expansionRepeatedConfigurations: expansionRounds.reduce(
    (sum, round) => sum + round.repeatedConfigurations,
    0,
  ),
  expansionResearchEligibleSeats: taskSummary.reduce(
    (sum, task) => sum + task.eligibleSeats,
    0,
  ),
  expansionResearchAchievements: taskSummary.reduce(
    (sum, task) => sum + task.achievements,
    0,
  ),
  expansionMatchedLineSeats: expansionRounds
    .flatMap((round) => round.scores)
    .filter((score) => score.matchedLines > 0).length,
  expansionScoredSeats: expansionRounds.reduce(
    (sum, round) => sum + round.scores.length,
    0,
  ),
};
const report = {
  generatedAt: new Date().toISOString(),
  sourceStable,
  sourceHashesBefore: beforeHashes,
  sourceHashesAfter: afterHashes,
  parameters: {
    seedBase,
    seedsPerPlayerCount: seeds,
    players: [2, 3, 4, 5, 6],
    actionCap,
    mixedDifficulties: ['default', 'doubao', 'juewu'],
    meetsRequestedMinimum: seeds >= 3,
  },
  definitions: {
    ordinaryTurn:
      'A choice from ordinary draw phase; Lucario extra draws do not add another ordinary turn.',
    legalActionCount:
      'All successfully applied player decisions, including votes and initial flips.',
    matchedLines:
      'Original: same-value vertical pairs. Expansion: same-value three-card rows, columns and main diagonals.',
    netCoveredCards:
      'Observed face-up to face-down transitions between saved action results, including orientation changes after moving cards.',
    repeatedConfigurations:
      'Repeated authoritative table/pile configuration excluding event counters, policy memory and RNG; a diagnostic, not proof of an infinite loop.',
  },
  limits: [
    'In-process rule/bot simulations, not SQLite, Worker, UI or device acceptance.',
    'Matching players, initial seeds and difficulty mix does not produce identical card order: decks and RNG consumption differ.',
    'Simulation wall time and decision CPU time are engineering costs, not human play duration; no 2–3x human-time conclusion.',
    'Only one round per seed. Small mixed-policy samples do not prove tier strength, win rates or stable balance.',
    'Unselected research tasks and zero Hoenn appearances remain unsampled, not disproved.',
  ],
  comparisons,
  totals,
  taskSummary,
  rounds,
  capReached: rounds
    .filter((round) => round.capReached)
    .map(({ variant, players, seed }) => ({ variant, players, seed })),
};
await writeFile(
  join(evidence, 'report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
const rows = comparisons
  .map(
    (row) =>
      `| ${row.players} | ${row.samples} | ${row.originalMedianOrdinaryTurns} | ${row.expansionMedianOrdinaryTurns} | ${row.pairedMedianOrdinaryTurnRatio.toFixed(2)} | ${row.expansionHoennTriggered} | ${row.expansionResearchChangedWinners} |`,
  )
  .join('\n');
const abilityRows = comparisons
  .map(
    (row) =>
      `| ${row.players} | ${row.originalMedianLegalActions} | ${row.expansionMedianLegalActions} | ${row.expansionMeanMatchedLines.toFixed(2)} | ${row.expansionRepositionTurns} | ${row.expansionCoverActivations} | ${row.expansionRowExchanges} |`,
  )
  .join('\n');
const taskRows = taskSummary
  .filter((task) => task.appearances > 0)
  .map(
    (task) =>
      `| ${task.id} ${task.name} | ${task.appearances} | ${task.achievements}/${task.eligibleSeats} |`,
  )
  .join('\n');
await writeFile(
  join(evidence, 'overview.md'),
  `# 宝可梦扩展首轮参数统计\n\n固定种子、同人数与轮换混合策略的小局模拟，未测真人时长。规则、策略与测量脚本源码前后哈希一致：${sourceStable}。\n\n复跑：\`node scripts/measure-pokemon-expansion.mjs --seeds=${seeds} --seed-base=${seedBase} --action-cap=${actionCap}\`，在仓库根目录运行，每次新建独立证据目录。\n\n| 人数 | 对照种子数 | 原版普通回合中位数 | 扩展普通回合中位数 | 配对回合比中位数 | 三神追加触发小局 | 研究改变赢家小局 |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n\n| 人数 | 原版动作中位数 | 扩展动作中位数 | 扩展每座成线均值 | 调位总数 | 盖回能力总数 | 行交换总数 |\n| --- | --- | --- | --- | --- | --- | --- |\n${abilityRows}\n\n扩展 ${expansionRounds.length} 局共 ${totals.expansionLegalActions} 个合法动作；${totals.expansionMatchedLineSeats}/${totals.expansionScoredSeats} 个场地至少成一条线。忍蛙盖回 ${totals.expansionNinjaCoverActivations} 次（其中调换 ${totals.expansionNinjaSwapActivations} 次），阿尔宙斯 ${totals.expansionArceusActivations} 次。连续普通回合调位最长 ${totals.expansionMaxConsecutiveRepositions} 次，重复桌面配置 ${totals.expansionRepeatedConfigurations} 次，达到动作封顶 ${report.capReached.length} 局；这些诊断只描述本批样本。\n\n| 当选任务 | 出现小局 | 达成座位／参与座位 |\n| --- | --- | --- |\n${taskRows}\n\n未当选任务及未出现的三神追加任务均未获样本支持。完整逐局、动作、能力、成线、研究任务和封顶数据见 report.json。相同初始种子不意味着相同牌序；CPU／快跑耗时不能证明真人时长达到 2–3 倍，少量混合策略样本不能证明胜率或档位强弱。\n`,
);
console.log(
  JSON.stringify({
    report: join(evidence, 'report.json'),
    sourceStable,
    rounds: rounds.length,
    capped: report.capReached.length,
  }),
);
assert.ok(
  sourceStable,
  'Source changed during measurement; report is not accepted',
);
assert.equal(
  report.capReached.length,
  0,
  'At least one round exhausted the action cap',
);
