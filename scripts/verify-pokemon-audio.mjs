import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { launchDesktop, desktopExecutable } from './desktop-test.mjs';
import { serveFixture } from './fixture-server.mjs';

const name =
  process.argv.find((arg) => arg.startsWith('--evidence='))?.slice(11) ??
  'development';
assert.match(name, /^[a-z0-9-]{1,40}$/);
const output = resolve(
  'artifacts/maintenance/v1.0.2/pokemon-polish-20261005/audio',
  name,
);
await mkdir(output, { recursive: true });
const work = await mkdtemp(resolve('tmp/game-ui-'));
await build({
  stdin: {
    resolveDir: resolve('.'),
    sourcefile: 'pokemon-audio-fixture.tsx',
    loader: 'tsx',
    contents: `
      import React from 'react';
      import { createRoot } from 'react-dom/client';
      import { flushSync } from 'react-dom';
      import { SoundControl } from './games/pokemon-encounters/ui/audio';
      window.audioPlays=[]; window.claims=[]; window.createdAudio=0;
      window.fixtureAudioOwner={claimEvent:async id=>{window.claims.push(id);return true}};
      const NativeAudio=window.Audio;
      window.Audio=new Proxy(NativeAudio,{construct(target,args){window.createdAudio++;const item=Reflect.construct(target,args);item.muted=true;return item}});
      const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){const item={src:this.src,time:performance.now(),volume:this.volume};window.audioPlays.push(item);return play.call(this).then(()=>item.fulfilled=true,error=>{item.error=String(error);throw error})};
      const root=createRoot(document.getElementById('root'));
      let revision=0, props={feedback:null,errorId:'',canPlay:true,game:{coin:null,boards:{},matchWinners:[]}};
      window.audioRender=options=>{props={...props,...options};flushSync(()=>root.render(<SoundControl {...props}/>))};
      window.savedAudio=(category,coin=null)=>{window.audioRender({feedback:{instanceId:'fixture',branch:0,revision:++revision,events:[{kind:'draw',text:'saved',action:{actor:'S1',verb:'draw',cardCategory:category,ability:category.startsWith('special-')?category:null,targets:[]}}]},game:{coin,boards:{},matchWinners:[]}});return performance.now()};
      window.audioRender({});
    `,
  },
  outfile: join(work, 'fixture.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  loader: { '.wav': 'file', '.mp3': 'file' },
  nodePaths: [resolve('apps/web/node_modules')],
  define: { 'window.tablemaxAudio': 'window.fixtureAudioOwner' },
  logLevel: 'silent',
});
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><div id="root"></div><script src="fixture.js"></script>',
);
const server = await serveFixture(work);
const desktop = await launchDesktop({
  executablePath: desktopExecutable,
  args: ['--foundation-test'],
  env: {
    ...process.env,
    TABLEMAX_DATA_DIR: join(work, 'data'),
    TABLEMAX_PROTOTYPE_URL: server.url,
  },
});
const evidence = {
  scope:
    'Hidden real WebView2 codec and production SoundControl playback. Owner permission is supplied by an isolated fixture; native owner handoff is verified separately. Media is muted for background checks; no human listening claim.',
  work,
  checks: [],
  decoded: [],
  errors: [],
};
try {
  const page = await desktop.firstWindow();
  page.on('pageerror', (error) => evidence.errors.push(error.message));
  await page.waitForFunction(
    () => window.audioRender && window.createdAudio === 2,
  );
  const files = (await readdir(work)).filter((file) =>
    /user-v2-.*\.wav$/.test(file),
  );
  assert.equal(files.length, 8);
  evidence.decoded = await page.evaluate(async (files) => {
    const context = new AudioContext();
    try {
      return await Promise.all(
        files.map(async (file) => {
          const data = await (await fetch(file)).arrayBuffer();
          const decoded = await context.decodeAudioData(data);
          const samples = decoded.getChannelData(0);
          let peak = 0;
          for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
          return {
            file,
            seconds: decoded.duration,
            channels: decoded.numberOfChannels,
            peak,
          };
        }),
      );
    } finally {
      await context.close();
    }
  }, files);
  assert.ok(
    evidence.decoded.every((item) => item.seconds > 0 && item.peak > 0),
  );
  for (const [category, stem] of [
    ['ordinary--2', 'pikachu'],
    ['ordinary-0', 'jigglypuff'],
    ['ordinary-1', 'eevee'],
    ['ordinary-3', 'bulbasaur'],
    ['ordinary-4', 'squirtle'],
    ['ordinary-7', 'gengar'],
  ]) {
    const prior = await page.evaluate(() => window.audioPlays.length);
    await page.evaluate((category) => window.savedAudio(category), category);
    await page.waitForFunction(
      (prior) =>
        window.audioPlays.length > prior && window.audioPlays.at(-1).fulfilled,
      prior,
    );
    assert.ok(
      (await page.evaluate(() => window.audioPlays.at(-1).src)).includes(
        stem + '-user-v2',
      ),
    );
  }
  evidence.checks.push(
    'Eight imported WAVs decode; six ordinary public draw categories play their corresponding source.',
  );
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  for (let turn = 0; turn < 2; turn++) {
    const prior = await page.evaluate(() => window.audioPlays.length);
    const start = await page.evaluate(() =>
      window.savedAudio('special-team-rocket', 'meowth'),
    );
    await page.waitForFunction(
      (prior) =>
        window.audioPlays.length >= prior + 2 &&
        window.audioPlays.at(-1).fulfilled,
      prior,
    );
    const plays = await page.evaluate(
      (prior) => window.audioPlays.slice(prior),
      prior,
    );
    assert.ok(plays[0].src.includes('team-rocket-entrance-user-v2'));
    assert.ok(plays[1].src.includes('meowth-coin-user-v2'));
    assert.ok(plays[1].time - start >= 1150 && plays[1].time - start < 1900);
    assert.ok(
      plays[1].time - plays[0].time < 1900,
      'Cry must not queue behind two-second BGM',
    );
  }
  evidence.checks.push(
    'Repeated same saved coin face plays per event; BGM and landing cry use independent slots with 1200ms timing.',
  );
  for (const flags of [
    { paused: true },
    { disabled: true },
    { canPlay: false },
  ]) {
    await page.evaluate(
      (flags) =>
        window.audioRender({
          paused: false,
          disabled: false,
          canPlay: true,
          ...flags,
        }),
      flags,
    );
    const prior = await page.evaluate(() => window.audioPlays.length);
    await page.evaluate(() =>
      window.savedAudio('special-team-rocket', 'meowth'),
    );
    await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(() => window.audioPlays.length), prior);
  }
  await page.evaluate(() =>
    window.audioRender({ paused: false, disabled: false, canPlay: true }),
  );
  const before = await page.evaluate(() => window.audioPlays.length);
  await page.evaluate(() => window.audioRender({}));
  await page.waitForTimeout(50);
  assert.equal(
    await page.evaluate(() => window.audioPlays.length),
    before,
    'Ownership recovery must not replay prior feedback',
  );
  await page.evaluate(() => window.savedAudio('special-team-rocket', 'meowth'));
  await page.waitForTimeout(100);
  await page.evaluate(() => window.audioRender({ feedback: null }));
  const stopped = await page.evaluate(() => window.audioPlays.length);
  await page.waitForTimeout(1300);
  assert.equal(
    await page.evaluate(() => window.audioPlays.length),
    stopped,
    'Sync clears delayed landing cry',
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForTimeout(50);
  const reduced = await page.evaluate(() => window.audioPlays.length);
  const start = await page.evaluate(() =>
    window.savedAudio('special-team-rocket', 'pikachu'),
  );
  await page.waitForFunction(
    (prior) =>
      window.audioPlays.length >= prior + 2 &&
      window.audioPlays.at(-1).fulfilled,
    reduced,
  );
  assert.ok(
    await page.evaluate(
      (start) => window.audioPlays.at(-1).time - start < 300,
      start,
    ),
  );
  assert.equal(await page.evaluate(() => window.createdAudio), 2);
  evidence.checks.push(
    'Paused/test/non-owner/sync stop or discard delayed playback; ownership recovery does not replay; reduced motion lands immediately; exactly two media elements.',
  );
  for (const [source, file] of [
    ['火箭队.wav', 'team-rocket-entrance-user-v2.wav'],
    ['硬币喵喵面.wav', 'meowth-coin-user-v2.wav'],
  ]) {
    const hash = async (path) =>
      createHash('sha256')
        .update(await readFile(path))
        .digest('hex');
    assert.equal(
      await hash(join('D:/aLCYYDS/IDM下载/叫声', source)),
      await hash(join('assets/games/pokemon-encounters/audio', file)),
    );
  }
  evidence.plays = await page.evaluate(() => window.audioPlays);
  assert.deepEqual(evidence.errors, []);
  evidence.result = 'passed';
} catch (error) {
  evidence.result = 'failed';
  evidence.error = error.stack;
  throw error;
} finally {
  await desktop.close();
  await server.close();
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(evidence, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    result: evidence.result,
    checks: evidence.checks.length,
    output,
  }),
);
