import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { build } from 'esbuild';

const evidenceName =
  process.argv.find((value) => value.startsWith('--evidence='))?.slice(11) ??
  `strategy-review-${Date.now()}`;
assert.match(evidenceName, /^[a-zA-Z0-9_-]+$/);
const expectFixed = process.argv.includes('--expect-fixed');
const root = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-expansion-balance-continuation',
  evidenceName,
);
const temporary = resolve(
  'tmp/pokemon-expansion-balance-continuation',
  evidenceName,
);
await mkdir(root, { recursive: false });
await mkdir(temporary, { recursive: true });
const strategyPath = resolve(
  'games/pokemon-encounters/expansion/bot/strategy.ts',
);
const production = await readFile(strategyPath, 'utf8');
const hook = production.includes('const initial = score(board, up);')
  ? 'const initial = score(board, up);'
  : 'const initial = score(board, first.up[seat]!);';
const upExpression = hook.includes('first.up') ? 'first.up[seat]!' : 'up';
assert.equal(production.split(hook).length, 2);
const instrumented = production.replace(
  hook,
  `${hook}
      (globalThis as any).__strategyProbe.push({difficulty,action,initial,board:[...board],
        before:[...first.boards[seat]!],up:[...${upExpression}]});`,
);
const orderedHook = 'const ordered = actions';
assert.equal(instrumented.split(orderedHook).length, 2);
const observedStrategy = instrumented.replace(
  orderedHook,
  `(globalThis as any).__evaluationProbe = {
  baseline:utility(first!),discardForced:first!.discards.map(incoming=>bestReplace(first!,seat,incoming)),
  candidateValues:actions.map((action,i)=>({action,value:sums[i]!/samples}))};
  ${orderedHook}`,
);
const bundle = join(temporary, 'probe.cjs');
await build({
  stdin: {
    resolveDir: resolve('.'),
    loader: 'ts',
    contents: `
import assert from 'node:assert/strict';
import { pokemonExpansion as rules } from './games/pokemon-encounters/expansion/index.ts';
import { card, instancesForSeats } from './games/pokemon-encounters/expansion/cards.ts';
import { scoreBoard } from './games/pokemon-encounters/expansion/scoring.ts';
import { observeMemory, validateMemory } from './games/pokemon-encounters/expansion/bot/memory.ts';
import { choose } from './games/pokemon-encounters/expansion/bot/strategy.ts';
import { RandomSource } from './packages/platform-core/src/random.ts';
export function run(expectFixed = false, orientationOnly = false) {
 const seats=['s0','s1','s2'],context={seats,random:new RandomSource(701006)};
 let state=rules.initialize(context);state.researchCandidates=['R24','R01','R02'];
 for(const seat of seats)state=rules.apply(state,{type:'vote-research',taskId:state.researchCandidates[0]},seat,context).state;
 const pool=instancesForSeats(3);
 const take=(category)=>{const i=pool.findIndex(id=>card(id).categoryId===category);assert.ok(i>=0);return pool.splice(i,1)[0];};
 const own=['ordinary-piplup','ordinary-7','ordinary-piplup','ordinary-0','ordinary-1','ordinary-3','ordinary-4','ordinary-5','ordinary-6'].map(take);
 state.boards.s0=own.map((instanceId,i)=>({instanceId,faceUp:[2,4,8].includes(i)}));
 for(const seat of seats.slice(1))state.boards[seat]=pool.splice(0,9).map((instanceId,i)=>({instanceId,faceUp:i===4}));
 state.discard=[take('ordinary-garchomp'),take('ordinary-garchomp')];state.deck=[...pool];
 state.activeResearch=['R24'];state.phase='draw';state.turnSeat='s0';state.initialDone=[...seats];
 state=rules.validateState(state,seats);
 const view=rules.project(state,{role:'player',seatId:'s0'});
 const memory=observeMemory(null,view,'s0','juewu');
 for(const seat of seats)for(let i=0;i<9;i++)memory.known[seat][i]={category:card(state.boards[seat][i].instanceId).categoryId,source:'public',turn:0};
 validateMemory(memory);
 const known=Object.values(memory.known).flat().map(k=>k.category);
 const samplingPool=instancesForSeats(3);
 for(const category of [...known,...view.discardOptions.map(c=>c.categoryId)])samplingPool.splice(samplingPool.findIndex(id=>card(id).categoryId===category),1);
 const wanted=samplingPool.findIndex(id=>card(id).categoryId==='ordinary-piplup');
 let calls=0;const random={next:()=>calls++%(samplingPool.length-1)===0?(wanted+0.01)/samplingPool.length:0.999999};
 (globalThis as any).__strategyProbe=[];
 const chosen=choose(view,rules.legalActions(state,'s0'),memory,'juewu',random,new AbortController().signal);
 const evaluation=(globalThis as any).__evaluationProbe;
 assert.ok(evaluation.discardForced.every(value=>value>evaluation.baseline+0.35));
 if(!orientationOnly) for(const item of evaluation.candidateValues.filter(item=>item.action.type==='draw'&&item.action.source==='discard'))
   assert.ok(Math.abs(item.value-(expectFixed?evaluation.discardForced[item.action.discardIndex]+0.08:evaluation.baseline+0.43))<1e-9,
     'Discard estimate must use forced replacement cost');
 const probes=(globalThis as any).__strategyProbe;
 const draw=probes.find(p=>p.action.type==='draw'&&p.action.source==='deck');
 assert.ok(draw,'Deck candidate must reach lookahead');
 const changed=draw.board.map((id,i)=>id!==draw.before[i]?i:-1).filter(i=>i>=0);
 assert.deepEqual(changed,[1]);
 const originalUp=view.boards.s0.map(slot=>slot.faceUp);
 const correctUp=[...originalUp];correctUp[1]=true;
 const wrong=scoreBoard(draw.board,['R24'],originalUp),correct=scoreBoard(draw.board,['R24'],correctUp);
 if(expectFixed) assert.equal(draw.initial,correct.total,'Future replacement must mark the incoming card face up');
 assert.equal(wrong.research[0].achieved,true);
 assert.equal(correct.research[0].achieved,false);
 assert.equal(wrong.total+4,correct.total);
 return {chosen,fixture:{own:own.map(id=>card(id).value),up:originalUp,activeResearch:['R24'],allKnowledgeAuthorized:true},
   evaluation:{baseline:evaluation.baseline,discardForced:evaluation.discardForced,
     discardCandidateValues:evaluation.candidateValues.filter(item=>item.action.type==='draw'&&item.action.source==='discard')},
   drawLookahead:{action:draw.action,changedSlot:1,recordedInitial:draw.initial,board:draw.board.map(id=>card(id).value),
     actualAfterReplaceUp:correctUp,wrongTotal:wrong.total,correctTotal:correct.total,
     wrongResearchAchieved:wrong.research[0].achieved,correctResearchAchieved:correct.research[0].achieved},
   limits:['Legal validated 112-card three-player fixture; explicit previously public memory, no hidden input to choose.',
     'Observation hook added to an in-memory compilation only; production source bytes are unchanged.',
     'Proves a four-point hypothetical R24 evaluation error, not that it caused aggregate tier outcomes.']};
}`,
  },
  plugins: [
    {
      name: 'read-only-probe',
      setup(build) {
        build.onLoad({ filter: /expansion[\\/]bot[\\/]strategy\.ts$/ }, () => ({
          contents: observedStrategy,
          loader: 'ts',
        }));
      },
    },
  ],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  logLevel: 'silent',
});
let result;
try {
  result = createRequire(import.meta.url)(bundle).run(
    expectFixed,
    process.argv.includes('--orientation-only'),
  );
} catch (error) {
  await writeFile(
    join(root, 'expected-failure.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        expectFixed,
        error: String(error),
      },
      null,
      2,
    ) + '\n',
  );
  throw error;
}
assert.equal(await readFile(strategyPath, 'utf8'), production);
await writeFile(
  join(root, 'report.json'),
  JSON.stringify(
    { generatedAt: new Date().toISOString(), ...result },
    null,
    2,
  ) + '\n',
);
console.log(JSON.stringify(result));
