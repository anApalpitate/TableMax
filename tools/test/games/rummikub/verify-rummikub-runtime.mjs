import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createRequire } from 'node:module';
import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  stat,
} from 'node:fs/promises';
import { resolve, join, relative, sep } from 'node:path';
import { promisify } from 'node:util';
import {
  MAXIMUM_PACKAGE_BYTES,
  PACKAGE_BUDGET_BYTES,
} from '../../../release/package-limits.mjs';

// No service or window is started without --run. The Native/UI verifier owns
// launchDesktop acceptance; this probe measures the same unmodified package
// service through its private desktop pipe, with a read-only heap preload.
const arg = (name) =>
  process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const execute = promisify(execFile);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const name = arg('evidence') ?? 'prepared';
assert.match(name, /^[a-z0-9-]{1,40}$/, 'Safe isolated evidence name');
const counts = (arg('seats') ?? '2,3,4').split(',').map(Number);
assert.ok(
  counts.length &&
    new Set(counts).size === counts.length &&
    counts.every((n) => [2, 3, 4].includes(n)),
);
const actionLimit = Number(arg('max-actions') ?? 6000);
const matchTimeout = Number(arg('match-timeout-ms') ?? 600000);
assert.ok(
  Number.isSafeInteger(actionLimit) && actionLimit > 0 && actionLimit <= 6000,
);
assert.ok(
  Number.isSafeInteger(matchTimeout) &&
    matchTimeout >= 10000 &&
    matchTimeout <= 600000,
);
const output = resolve('artifacts/rummikub/validation', `runtime-${name}`);
await mkdir(output, { recursive: true });
await mkdir(resolve('tmp'), { recursive: true });
const work = await mkdtemp(resolve('tmp/rummikub-runtime-'));
const verifierBytes = await readFile(new URL(import.meta.url));
await writeFile(join(output, 'verifier-source.mjs'), verifierBytes, {
  flag: 'wx',
});
const evidence = {
  startedAt: new Date().toISOString(),
  packageStage: process.argv.includes('--candidate')
    ? 'candidate'
    : 'verification-input',
  deliveryBoundary:
    'Passing this script verifies its bound package input and requested runtime scenarios; it does not resolve pending rule decisions or declare a final accepted delivery.',
  requestedPackage: {
    zip: arg('zip') ? resolve(arg('zip')) : null,
    manifest: arg('manifest') ? resolve(arg('manifest')) : null,
    extracted: arg('extracted') ? resolve(arg('extracted')) : null,
    expectedZipSha256: arg('sha256') ?? null,
  },
  verifierSha256: sha256(verifierBytes),
  workDir: work,
  result: 'prepared',
  requestedSeats: counts,
  actionLimit,
  matchTimeout,
  scope:
    'Natural 2/3/4-seat complete classic matches in the same ZIP package service, SQLite and real 32MiB package Workers; one authorized human Socket identity per match, mixed bot difficulties. Test timing saves every legal action. No synthetic game state or physical device claim.',
  measurementBoundary:
    'Read-only --require preload samples heapUsed in the actual package Node service and its Worker isolates. It does not replace or patch rules, random, Worker constructors, limits or timers. Sampled heap is not private bytes or an allocation maximum. Native/UI acceptance is separate and can be linked with --native-evidence.',
  nativeEvidence: arg('native-evidence')
    ? resolve(arg('native-evidence'))
    : null,
  reusedPureBotEvidence: arg('bot-evidence')
    ? resolve(arg('bot-evidence'))
    : null,
  cases: [],
  ownedProcesses: [],
  failures: [],
  checks: [],
  externalRequests: [],
};

const preload = String.raw`
const fs=require('node:fs'),{isMainThread,threadId,resourceLimits}=require('node:worker_threads');
const path=process.env.TABLEMAX_RUMMI_HEAP_FILE,role=process.env.TABLEMAX_RUMMI_ROLE;
function sample(event){ if(path)fs.appendFileSync(path,JSON.stringify({at:Date.now(),event,pid:process.pid,threadId,role:isMainThread?role:role+'-worker',heapUsed:process.memoryUsage().heapUsed,...(!isMainThread?{resourceLimits}: {})})+'\n'); }
sample('start');const timer=setInterval(()=>sample('sample'),50);timer.unref();
process.once('exit',code=>{clearInterval(timer);sample('exit:'+code);});
const diagnostics=require('node:diagnostics_channel');
function outbound(value){let host;try{host=new URL(String(value).includes('://')?String(value):'http://'+value).hostname;}catch{return;}if(!['127.0.0.1','localhost','::1','[::1]'].includes(host)&&path)fs.appendFileSync(path,JSON.stringify({at:Date.now(),event:'outbound-http',pid:process.pid,threadId,destinationHost:host})+'\n');}
diagnostics.channel('http.client.request.start').subscribe(({request})=>outbound(request.getHeader('host')));
diagnostics.channel('undici:request:create').subscribe(({request})=>outbound(request.origin));
`;
const workerDriver = String.raw`
const {Worker}=require('node:worker_threads'),{createInterface}=require('node:readline'),path=require('node:path');
const root=process.env.TABLEMAX_RUMMI_RUNTIME,{bot}=require(path.join(root,'bots/rummikub.cjs'));
let active=null;
async function decide(task,cancelNow=false){
 const started=performance.now(); const worker=new Worker(path.join(root,'bot-worker.cjs'),{workerData:task,resourceLimits:{maxOldGenerationSizeMb:32}});active=worker;
 let timer,elapsed;
 const exit=new Promise(done=>worker.once('exit',done));
 try{
  const value=await new Promise((done,reject)=>{
   const fail=reason=>reject(new Error(reason));
   worker.once('error',()=>fail('worker-error'));worker.once('exit',()=>fail('worker-exited'));
   worker.once('message',value=>{elapsed=performance.now()-started;value.error?fail('strategy-failed'):done(value);});
   timer=setTimeout(()=>fail('two-second-deadline'),2000);
   if(cancelNow)setImmediate(()=>fail('cancelled'));
  });
  if(!Number.isInteger(value.random)||value.random<=0||value.random>0xffffffff)throw new Error('invalid-random');
  return {...value,elapsedMs:elapsed,workerOldGenerationMiB:worker.resourceLimits.maxOldGenerationSizeMb};
 }finally{clearTimeout(timer);await worker.terminate();await exit;active=null;}
}
const lines=createInterface({input:process.stdin});let queue=Promise.resolve();
lines.on('line',line=>{queue=queue.then(async()=>{
 const message=JSON.parse(line); let response;
 if(message.type==='metadata')response={id:bot.id,version:bot.version,rulesVersion:bot.rulesVersion,difficulties:bot.difficulties,node:process.version};
 else if(message.type==='decide')response=await decide(message.task,false);
 else if(message.type==='cancel'){let failed=false;try{await decide(message.task,true);}catch(error){failed=error.message==='cancelled';}if(!failed)throw new Error('cancel-probe-failed');response={cancelled:true,terminated:true};}
 else if(message.type==='stop'){process.exitCode=0;lines.close();process.stdin.destroy();return;}
 else throw new Error('unknown-driver-command');
 process.stdout.write(JSON.stringify({id:message.id,ok:true,response})+'\n');
 }).catch(()=>{process.stdout.write(JSON.stringify({ok:false,error:'driver-command-failed'})+'\n');process.exitCode=1;lines.close();process.stdin.destroy();});});
lines.on('close',()=>{queue.finally(async()=>{if(active)await active.terminate();});});
`;
const auditSource = String.raw`
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{rules}=require(process.argv[3]);
const {readCurrentSave}=await import(process.argv[4]);
const db=new DatabaseSync(process.argv[2],{readOnly:true});try{assert.equal(db.prepare('PRAGMA quick_check').get().quick_check,'ok');
let validatedStates=0,checkpointStates=0,turns=0,draws=0,passes=0,nextGames=0,submitTurns=0;const actors={},levels=new Set(),seen=new Set();
class Random{constructor(state){this.state=state;}next(){let x=this.state|0;x^=x<<13;x^=x>>>17;x^=x<<5;this.state=x>>>0;return this.state/4294967296;}}
const journalIds=db.prepare('SELECT rowid FROM journal ORDER BY rowid').all(),readJournal=db.prepare('SELECT data FROM journal WHERE rowid=?');
for(const {rowid} of journalIds){const row=readJournal.get(rowid);
 const stored=JSON.parse(row.data),save=stored._storage===2?stored.value:stored;if(save.manifest?.id!=='rummikub'||!save.snapshot)continue;
 const seats=save.seats.map(p=>p.id),s=rules.validateState(save.snapshot.state,seats);validatedStates++;
 for(const p of save.seats)if(p.controller==='bot')levels.add(p.botDifficulty??'default');
 const key=save.instanceId+':'+save.branch+':'+s.serial;if(seen.has(key)||s.serial===0)continue;seen.add(key);
 const checkpoint=stored._storage===2?JSON.parse(db.prepare('SELECT data FROM checkpoint_nodes WHERE id=?').get(stored.historyHead).data):save.history.at(-1);
 const before=checkpoint?.before?.state;if(!before||s.serial!==before.serial+1)continue;
 rules.validateState(before,seats);const latest=s.latest;turns++;
 if(latest.actor)actors[latest.actor]=(actors[latest.actor]??0)+1;
 let action=null;
 if(latest.verb==='draw'){draws++;action={type:'draw'};}
 else if(latest.verb==='pass'){passes++;action={type:'pass'};}
 else if(latest.verb==='next-game'){nextGames++;const result=rules.applyLifecycle(before,{type:'next-game'},{seats,random:new Random(checkpoint.before.random)});assert.deepEqual(result.state,s,'Package lifecycle replay');}
 else if(latest.verb==='submit-turn')submitTurns++;
 if(action){assert.ok(rules.isLegalAction(before,action,latest.actor));const result=rules.apply(before,action,latest.actor,{seats,random:new Random(checkpoint.before.random)});assert.deepEqual(result.state,s,'Package draw/pass replay');}
}
const checkpointIds=db.prepare('SELECT id FROM checkpoint_nodes').all(),readCheckpoint=db.prepare('SELECT data FROM checkpoint_nodes WHERE id=?');
for(const {id} of checkpointIds){const row=readCheckpoint.get(id);const c=JSON.parse(row.data);if(c.before?.state?.gameId==='rummikub'){rules.validateState(c.before.state,c.before.state.seats);checkpointStates++;}}
const final=readCurrentSave(db),s=rules.validateState(final.snapshot.state,final.seats.map(p=>p.id));
assert.equal(final.status,'ended');assert.equal(s.phase,'ended');assert.equal(s.results.length,final.seats.length);assert.equal(s.gameCount,final.seats.length);assert.ok(s.winners.length);
for(const result of s.results)assert.ok(Math.abs(Object.values(result.scores).reduce((a,b)=>a+b,0))<1e-9);
const total=Object.fromEntries(s.seats.map(id=>[id,0])),wins=Object.fromEntries(s.seats.map(id=>[id,0]));for(const r of s.results)for(const id of s.seats){total[id]+=r.scores[id];if(r.winners.includes(id))wins[id]++;}assert.deepEqual(total,s.scores);assert.deepEqual(wins,s.wins);
console.log(JSON.stringify({result:'passed',validatedStates,checkpointStates,turns,draws,passes,nextGames,submitTurns,actors,levels:[...levels],gameCount:s.gameCount,serial:s.serial,results:s.results,winners:s.winners,sourceSeedBoundary:'Natural room random comes from production cryptographic setup and is preserved privately in SQLite; no game seed or state was injected.',auditBoundary:'Every saved game and checkpoint state passes package state/106-partition/scoring validation; draw/pass and next-game transitions additionally replay. Submit-turn release witnesses are not retained as full commands, so no claim of replaying every submitted rearrangement.'}));}finally{db.close();}
`;
const preloadPath = join(work, 'heap-probe.cjs'),
  driverPath = join(work, 'worker-driver.cjs'),
  auditPath = join(work, 'audit.mjs');
await writeFile(preloadPath, preload);
await writeFile(driverPath, workerDriver);
await writeFile(auditPath, auditSource);
for (const path of [preloadPath, driverPath, auditPath])
  await execute(process.execPath, ['--check', path], { windowsHide: true });
evidence.probes = {
  preloadSha256: sha256(preload),
  workerDriverSha256: sha256(workerDriver),
  auditSha256: sha256(auditSource),
};

async function inventory(directory) {
  const files = [];
  async function visit(current) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false, 'No linked delivery member');
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile())
        files.push({
          path: relative(directory, path).split(sep).join('/'),
          bytes: (await stat(path)).size,
          sha256: sha256(await readFile(path)),
        });
    }
  }
  await visit(directory);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
const environment = {
  ...process.env,
  PATH: `${process.env.SystemRoot}\\system32;${process.env.SystemRoot}`,
  TABLEMAX_HOST: '127.0.0.1',
  TABLEMAX_PORT: '0',
  TABLEMAX_TEST_AUDIO: '0',
};
for (const key of Object.keys(environment))
  if (
    ['NODE_OPTIONS', 'NODE_PATH', 'TABLEMAX_WEB_DEV_URL'].includes(
      key.toUpperCase(),
    ) ||
    (key.toUpperCase() === 'PATH' && key !== 'PATH')
  )
    delete environment[key];
function privateChild(executable, args, env) {
  const child = spawn(executable, args, {
    cwd: work,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const pending = new Map();
  let sequence = 0,
    readyResolve,
    readyReject,
    closed = false;
  const ready = new Promise((done, reject) => {
    readyResolve = done;
    readyReject = reject;
  });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.type === 'ready') readyResolve(message);
    else if (message.type === 'error' || message.ok === false) {
      const error = new Error(
        message.message ?? message.error ?? 'Private child failed',
      );
      readyReject(error);
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(error);
      }
      pending.clear();
    } else if (message.id !== undefined) {
      const item = pending.get(message.id);
      if (item) {
        pending.delete(message.id);
        clearTimeout(item.timer);
        item.done(message.response);
      }
    }
  });
  child.stderr.on('data', () => {}); // Never persist private transport diagnostics.
  child.stdin.on('error', () => {});
  child.once('error', (error) => {
    readyReject(error);
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(error);
    }
    pending.clear();
  });
  const exited = new Promise((done) =>
    child.once('close', (code, signal) => {
      closed = true;
      const error = new Error(`Owned child exited (${code ?? signal})`);
      readyReject(error);
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(error);
      }
      pending.clear();
      lines.close();
      done({ pid: child.pid, code, signal });
    }),
  );
  ready.catch(() => {});
  const send = (value) => child.stdin.write(JSON.stringify(value) + '\n');
  const request = (value, timeout = 10000) =>
    new Promise((done, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Private child request timeout'));
      }, timeout);
      pending.set(id, { done, reject, timer });
      send({ ...value, id });
    });
  return {
    child,
    ready,
    exited,
    send,
    request,
    get closed() {
      return closed;
    },
    async stop() {
      if (!closed) send({ type: 'stop' });
      try {
        return await deadline(
          exited,
          10000,
          'Owned child did not close within 10s',
        );
      } catch (error) {
        child.kill();
        const exit = await deadline(
          exited,
          5000,
          'Owned child kill did not report exit',
        );
        return { ...exit, forced: true, stopFailure: error.message };
      }
    },
  };
}
async function deadline(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function heapSummary(path, servicePids, baseline) {
  const samples = (await readFile(path, 'utf8'))
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const service = samples.filter(
    (s) => s.role === 'service' && servicePids.includes(s.pid),
  );
  const workers = samples.filter((s) => s.role === 'service-worker');
  const externalHttp = samples.filter((s) => s.event === 'outbound-http');
  evidence.externalRequests.push(...externalHttp);
  assert.deepEqual(externalHttp, [], 'No external HTTP request observed');
  const limits = workers
    .filter((s) => s.event === 'start')
    .map((s) => s.resourceLimits.maxOldGenerationSizeMb);
  assert.ok(limits.length, 'Actual service spawned package Workers');
  assert.ok(
    limits.every((n) => n === 32),
    'Every observed service Worker uses 32MiB old generation',
  );
  const peak = Math.max(...service.map((s) => s.heapUsed));
  return {
    intervalMs: 50,
    baselineEmptyBoxHeapBytes: baseline,
    servicePeakHeapBytes: peak,
    serviceSampledIncreaseBytes: Math.max(0, peak - baseline),
    serviceSamples: service.length,
    serviceWorkerStarts: limits.length,
    workerOldGenerationMiB: 32,
    workerSampledPeakHeapBytes: Math.max(...workers.map((s) => s.heapUsed)),
    measurementBoundary: evidence.measurementBoundary,
    externalRequestBoundary:
      'Driver URLs are restricted to the loopback runtime origin; service preload observes Node HTTP/undici client diagnostics. This is not a full network packet capture or Native page-request audit.',
  };
}

async function runMatch(runtime, count, index) {
  const { io } = createRequire(resolve('apps/web/package.json'))(
    'socket.io-client',
  );
  const result = {
    seats: count,
    result: 'running',
    startedAt: new Date().toISOString(),
    humanDriverDifficulty: ['default', 'doubao', 'juewu'][index % 3],
    commands: 0,
    restarts: 0,
    workerDecisions: 0,
    workerLongestMs: 0,
    projectionAudits: 0,
    processes: [],
  };
  evidence.cases.push(result);
  const directory = join(work, `seats-${count}`),
    dataDir = join(directory, 'data'),
    heapFile = join(directory, 'heap.ndjson');
  await mkdir(directory, { recursive: true });
  let service,
    driver,
    origin,
    hostToken,
    hostSocket,
    humanSocket,
    humanToken,
    humanSeatId,
    restarted = false,
    baseline;
  const sockets = [];
  const servicePids = [];
  const started = performance.now();
  let lastProgress = Date.now();
  let caseError;
  async function view(token = '') {
    const response = await fetch(origin + '/api/session/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(token ? { token } : {}),
    });
    const body = await response.json();
    assert.equal(body.ok, true, 'Authorized runtime view');
    return body.view;
  }
  async function connect(token) {
    const socket = io(origin, {
      forceNew: true,
      transports: ['websocket'],
      auth: token ? { token } : {},
    });
    sockets.push(socket);
    await deadline(
      new Promise((done, reject) => {
        socket.once('room:view', done);
        socket.once('connect_error', reject);
      }),
      10000,
      'Socket connect timeout',
    );
    return socket;
  }
  async function send(socket, token, command) {
    const current = await view(token);
    const reply = await new Promise((done, reject) =>
      socket.timeout(10000).emit(
        'room:command',
        {
          actionId: randomUUID(),
          instanceId: current.instanceId,
          revision: current.revision,
          branch: current.branch,
          command,
        },
        (error, value) => (error ? reject(error) : done(value)),
      ),
    );
    assert.equal(
      reply.ok,
      true,
      `Saved ${command.type}: ${reply.reason ?? ''}`,
    );
    result.commands++;
    return reply;
  }
  async function boot() {
    service = privateChild(
      join(runtime, 'node.exe'),
      ['--require', preloadPath, join(runtime, 'server.cjs'), '--desktop-pipe'],
      {
        ...environment,
        TABLEMAX_RUMMI_HEAP_FILE: heapFile,
        TABLEMAX_RUMMI_ROLE: 'service',
      },
    );
    service.send({
      type: 'start',
      config: {
        host: '127.0.0.1',
        port: 0,
        dataDir,
        webDir: join(runtime, 'web'),
        botWorkerPath: join(runtime, 'bot-worker.cjs'),
        playMode: 'test',
      },
    });
    const ready = await deadline(
      service.ready,
      30000,
      'Package service ready timeout',
    );
    assert.equal(ready.health.runtime.node, '22.14.0');
    origin = 'http://127.0.0.1:' + ready.port;
    hostToken = ready.hostToken;
    servicePids.push(service.child.pid);
    hostSocket = await connect(hostToken);
    result.processes.push({
      role: 'service',
      pid: service.child.pid,
      node: join(runtime, 'node.exe'),
    });
  }
  async function stopService() {
    for (const socket of sockets.splice(0)) socket.disconnect();
    if (service) {
      const exit = await service.stop();
      result.processes.push({ ...exit, role: 'service-exit' });
      service = null;
      assert.equal(exit.forced, undefined, 'Owned service closes normally');
      assert.equal(exit.code, 0);
      let reachable = false;
      try {
        await fetch(origin + '/api/foundation/health', {
          signal: AbortSignal.timeout(2000),
        });
        reachable = true;
      } catch {
        // A stopped service must no longer have a reachable listener.
      }
      assert.equal(
        reachable,
        false,
        'Owned service listener exits with process',
      );
    }
  }
  async function projections() {
    const own = await view(humanToken),
      host = await view(hostToken),
      pub = await view();
    assert.equal(host.gameView?.self, null);
    assert.equal(pub.gameView?.self, null);
    assert.equal(host.actions.length, 0);
    assert.equal(pub.actions.length, 0);
    assert.equal(own.self.seatId, humanSeatId);
    assert.equal(own.gameView.self.seatId, humanSeatId);
    assert.equal(
      own.gameView.self.rack.length,
      own.gameView.players[humanSeatId].rackCount,
    );
    for (const game of [host.gameView, pub.gameView]) {
      assert.ok(!('racks' in game) && !('pool' in game));
      for (const player of Object.values(game.players))
        assert.ok(!('rack' in player));
      for (const tile of own.gameView.self.rack)
        assert.ok(
          !JSON.stringify(game).includes(tile.id),
          'Private rack instance never appears publicly',
        );
    }
    result.projectionAudits++;
    return own;
  }
  try {
    await boot();
    await sleep(150);
    const empty = (await readFile(heapFile, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .filter((s) => s.role === 'service');
    baseline = empty.at(-1).heapUsed;
    result.baselineEmptyBoxHeapBytes = baseline;
    await send(hostSocket, hostToken, {
      type: 'select-game',
      gameId: 'rummikub',
    });
    const joined = await (
      await fetch(origin + '/api/session/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Runtime human',
          requestKey: randomBytes(32).toString('hex'),
        }),
      })
    ).json();
    assert.equal(
      joined.ok,
      true,
      `Runtime player join: ${joined.reason ?? ''}`,
    );
    humanToken = joined.token;
    humanSocket = await connect(humanToken);
    humanSeatId = (await view(humanToken)).self.seatId;
    const levels = ['default', 'doubao', 'juewu'];
    for (let i = 1; i < count; i++)
      await send(hostSocket, hostToken, {
        type: 'add-bot',
        name: `Runtime bot ${i}`,
        difficulty: levels[(index + i - 1) % 3],
      });
    await send(hostSocket, hostToken, {
      type: 'set-owner',
      seatId: humanSeatId,
    });
    await send(humanSocket, humanToken, { type: 'ready', ready: true });
    await send(humanSocket, humanToken, { type: 'start' });
    driver = privateChild(join(runtime, 'node.exe'), [driverPath], {
      ...environment,
      TABLEMAX_RUMMI_RUNTIME: runtime,
    });
    result.processes.push({
      role: 'human-driver',
      pid: driver.child.pid,
      node: join(runtime, 'node.exe'),
    });
    const metadata = await driver.request({ type: 'metadata' });
    assert.equal(metadata.node, 'v22.14.0');
    let humanRandom = 1234567 + count,
      hasCancelled = false;
    while (performance.now() - started < matchTimeout) {
      const own = await projections();
      const serial = own.gameView.latest?.serial ?? 0;
      assert.equal(
        own.botError,
        null,
        'Actual package Worker strategy did not fail',
      );
      assert.equal(own.playMode, 'test');
      assert.ok(serial <= actionLimit, 'Bounded natural action count');
      if (own.status === 'ended') break;
      if (
        !restarted &&
        serial >= 6 &&
        ((own.decisionId && own.actions.length) || own.lifecycleActions.length)
      ) {
        await send(hostSocket, hostToken, { type: 'pause' });
        const saved = await projections();
        await stopService();
        await boot();
        humanSocket = await connect(humanToken);
        const restored = await projections();
        assert.equal(restored.paused, true);
        assert.equal(restored.restored, true);
        assert.equal(restored.ownerSeatId, humanSeatId);
        assert.deepEqual(
          restored.gameView,
          saved.gameView,
          'Real SQLite restart restores exact authorized view',
        );
        await send(humanSocket, humanToken, { type: 'resume' });
        restarted = true;
        result.restarts++;
        continue;
      }
      if (own.lifecycleActions.length) {
        assert.deepEqual(own.lifecycleActions, [{ type: 'next-game' }]);
        await send(humanSocket, humanToken, {
          type: 'lifecycle',
          action: { type: 'next-game' },
        });
        continue;
      }
      if (own.decisionId && own.actions.length) {
        const task = {
          gameId: 'rummikub',
          rulesVersion: metadata.rulesVersion,
          instanceId: own.instanceId,
          revision: own.revision,
          branch: own.branch,
          decision: { id: own.decisionId, seatId: humanSeatId },
          view: own.gameView,
          actions: own.actions,
          data: {
            id: metadata.id,
            version: metadata.version,
            rulesVersion: metadata.rulesVersion,
            memory: null,
            random: humanRandom,
            difficulty: result.humanDriverDifficulty,
          },
        };
        if (!hasCancelled) {
          const before = await view(humanToken);
          const cancellation = await driver.request({ type: 'cancel', task });
          assert.equal(cancellation.cancelled, true);
          const after = await view(humanToken);
          assert.equal(
            after.revision,
            before.revision,
            'Cancelled driver never submits an action',
          );
          assert.deepEqual(after.gameView, before.gameView);
          hasCancelled = true;
          result.cancellation = cancellation;
        }
        const choice = await driver.request({ type: 'decide', task }, 5000);
        assert.ok(choice.elapsedMs < 2000);
        assert.equal(choice.workerOldGenerationMiB, 32);
        result.workerDecisions++;
        result.workerLongestMs = Math.max(
          result.workerLongestMs,
          choice.elapsedMs,
        );
        humanRandom = choice.random;
        await send(humanSocket, humanToken, {
          type: 'game',
          decisionId: own.decisionId,
          action: choice.action,
        });
      } else await sleep(25);
      if (Date.now() - lastProgress >= 30000) {
        console.log(
          JSON.stringify({
            progress: true,
            seats: count,
            game: own.gameView.gameNumber,
            serial,
            workerDecisions: result.workerDecisions,
          }),
        );
        lastProgress = Date.now();
      }
    }
    const final = await projections();
    assert.equal(
      final.status,
      'ended',
      'Natural complete match within bounded time',
    );
    assert.equal(final.gameView.phase, 'ended');
    assert.equal(final.gameView.results.length, count);
    assert.ok(final.gameView.winners.length);
    assert.equal(result.restarts, 1);
    assert.ok(result.workerDecisions > 0);
    assert.ok(result.cancellation?.terminated);
    result.games = final.gameView.results;
    result.winners = final.gameView.winners;
    result.finalSerial = final.gameView.latest?.serial ?? 0;
    await stopService();
    const audit = await execute(
      join(runtime, 'node.exe'),
      [
        auditPath,
        join(dataDir, 'room.sqlite'),
        join(runtime, 'games/rummikub.cjs'),
        new URL('../../../../apps/server/src/save-codec.mjs', import.meta.url)
          .href,
      ],
      {
        env: environment,
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1000000,
      },
    );
    result.sqliteAudit = JSON.parse(audit.stdout.trim());
    assert.equal(result.sqliteAudit.nextGames, count - 1);
    for (const botSeat of final.seats.filter((s) => s.controller === 'bot'))
      assert.ok(result.sqliteAudit.actors[botSeat.id] > 0);
    result.heap = await heapSummary(heapFile, servicePids, baseline);
    result.result = 'passed';
  } catch (error) {
    result.result = 'failed';
    result.failure = error.message;
    caseError = error;
  } finally {
    const cleanup = await Promise.allSettled([
      stopService(),
      driver
        ? driver.stop().then((exit) => {
            result.processes.push({ ...exit, role: 'human-driver-exit' });
            assert.equal(
              exit.forced,
              undefined,
              'Owned driver closes normally',
            );
            assert.equal(exit.code, 0);
          })
        : Promise.resolve(),
    ]);
    const cleanupErrors = cleanup.filter((item) => item.status === 'rejected');
    if (cleanupErrors.length) {
      result.result = 'failed';
      result.cleanupFailures = cleanupErrors.map((item) => item.reason.message);
      caseError ??= cleanupErrors[0].reason;
    }
    result.elapsedSeconds =
      Math.round((performance.now() - started) / 10) / 100;
    result.finishedAt = new Date().toISOString();
    evidence.ownedProcesses.push(...result.processes);
    await writeFile(
      join(output, `seats-${count}.json`),
      JSON.stringify(result, null, 2) + '\n',
    );
  }
  if (caseError) throw caseError;
}

try {
  if (process.argv.includes('--run')) {
    const version = JSON.parse(
      await readFile(resolve('package.json'), 'utf8'),
    ).version;
    const archive = resolve(
        arg('zip') ?? `artifacts/releases/TableMax-${version}-win-x64.zip`,
      ),
      manifestPath = resolve(
        arg('manifest') ??
          `artifacts/releases/TableMax-${version}-win-x64-manifest.json`,
      );
    const archiveBytes = await readFile(archive),
      manifestBytes = await readFile(manifestPath),
      manifest = JSON.parse(manifestBytes);
    const archiveHash = sha256(archiveBytes);
    assert.equal(archiveHash, manifest.archive.sha256);
    if (arg('sha256'))
      assert.equal(archiveHash, arg('sha256'), 'Caller freezes same final ZIP');
    const runtime = arg('extracted')
      ? resolve(arg('extracted'))
      : join(work, 'runtime');
    if (!arg('extracted'))
      await execute(
        join(
          process.env.SystemRoot,
          'System32/WindowsPowerShell/v1.0/powershell.exe',
        ),
        [
          '-NoProfile',
          '-Command',
          '$ErrorActionPreference="Stop"; Expand-Archive -LiteralPath $env:TABLEMAX_RUMMI_ARCHIVE -DestinationPath $env:TABLEMAX_RUMMI_EXTRACT',
        ],
        {
          env: {
            ...environment,
            TABLEMAX_RUMMI_ARCHIVE: archive,
            TABLEMAX_RUMMI_EXTRACT: runtime,
          },
          windowsHide: true,
          timeout: 120000,
        },
      );
    const files = await inventory(runtime);
    assert.deepEqual(
      files,
      manifest.files,
      'Actual extracted members match every manifest hash and byte count',
    );
    const extractedBytes = files.reduce((sum, f) => sum + f.bytes, 0);
    assert.ok(
      archiveBytes.length < MAXIMUM_PACKAGE_BYTES &&
        extractedBytes < MAXIMUM_PACKAGE_BYTES,
    );
    evidence.package = {
      archive,
      archiveSha256: archiveHash,
      archiveBytes: archiveBytes.length,
      manifestPath,
      manifestSha256: sha256(manifestBytes),
      runtime,
      extractedBytes,
      budgetPassed: extractedBytes < PACKAGE_BUDGET_BYTES,
      files,
    };
    await writeFile(
      join(output, 'extracted-inventory.json'),
      JSON.stringify(files, null, 2) + '\n',
    );
    evidence.packagePayload = Object.fromEntries(
      [
        'node.exe',
        'server.cjs',
        'server.cjs.br',
        'bot-worker.cjs',
        'games/rummikub.cjs',
        'bots/rummikub.cjs',
        'modules.json',
      ].map((path) => [path, files.find((file) => file.path === path) ?? null]),
    );
    assert.ok(
      evidence.packagePayload['node.exe'] &&
        evidence.packagePayload['server.cjs'] &&
        evidence.packagePayload['games/rummikub.cjs'],
    );
    evidence.linkedEvidence = [];
    for (const path of [
      evidence.nativeEvidence,
      evidence.reusedPureBotEvidence,
    ].filter(Boolean)) {
      assert.ok((await stat(path)).isFile(), 'Referenced evidence exists');
      const bytes = await readFile(path);
      const record = { path, sha256: sha256(bytes) };
      if (path === evidence.nativeEvidence) {
        const native = JSON.parse(bytes);
        if (native.archiveSha256 !== undefined)
          assert.equal(
            native.archiveSha256,
            archiveHash,
            'Native evidence binds same ZIP',
          );
        else if (native.executableSha256 !== undefined) {
          assert.equal(
            native.executableSha256,
            files.find((file) => file.path === 'TableMax.exe')?.sha256,
          );
          record.boundary =
            'Native report binds this EXE hash; whole ZIP membership is independently bound by this runtime inventory.';
        } else
          throw new Error('Native evidence has no ZIP or EXE hash association');
        if (Array.isArray(native.failures))
          assert.equal(
            native.failures.length,
            0,
            'Native linked evidence has no unresolved failures',
          );
      }
      evidence.linkedEvidence.push(record);
    }
    for (const count of counts) {
      await runMatch(runtime, count, count - 2);
      await writeFile(
        join(output, 'results.json'),
        JSON.stringify(evidence, null, 2) + '\n',
      );
    }
    assert.deepEqual(
      await inventory(runtime),
      files,
      'Unmodified extracted payload after actual runs',
    );
    assert.equal(
      sha256(await readFile(archive)),
      archiveHash,
      'Same input ZIP stayed frozen',
    );
    evidence.result = 'passed';
    evidence.checks.push(
      'Same ZIP/manifest and every actual extracted member hash/bytes bound before and after runtime',
      'Natural complete requested matches with saved next-game lifecycle, live identity projection audits and durable restart',
      'Actual service heap vs empty-box baseline sampled separately from Worker heap and process private bytes',
      'Real package 32MiB Workers, successful choices within 2s and immediate cancellation with no saved action; all owned child processes awaited',
    );
  } else
    evidence.checks.push(
      'Static preparation only: generated probe/driver/audit syntax passed; no service, Worker, Native window, ZIP extraction or game was run. Pass --run only after root releases the final package/Native slot.',
    );
} catch (error) {
  evidence.result = 'failed';
  evidence.failures.push({ message: error.message, stack: error.stack });
  process.exitCode = 1;
} finally {
  evidence.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: evidence.result,
      output,
      caseResults: evidence.cases.map((c) => ({
        seats: c.seats,
        result: c.result,
        elapsedSeconds: c.elapsedSeconds,
      })),
      failure: evidence.failures.at(-1)?.message,
    }),
  );
}
