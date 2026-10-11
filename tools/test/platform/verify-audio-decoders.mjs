import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { webkit, chromium } from 'playwright';
import assert from 'node:assert/strict';
const root = resolve(process.argv[2]);
async function files(path) {
  const result = [];
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const next = join(path, entry.name);
    if (entry.isDirectory()) result.push(...(await files(next)));
    else if (/\.(flac|wav|mp3|ogg)$/.test(entry.name)) result.push(next);
  }
  return result;
}
const sounds = (await files(join(root, 'web'))).filter((p) =>
  /games[\\/](uno|avalon)[\\/]/.test(p),
);
assert.equal(sounds.length, 23);
const members = await Promise.all(
  sounds.map(async (p) => {
    const bytes = await readFile(p);
    return {
      url: '/' + relative(root, p).replaceAll('\\', '/'),
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }),
);
const routes = new Map(
  sounds.map((p) => ['/' + relative(root, p).replaceAll('\\', '/'), p]),
);
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><title>Muted decoder audit</title>');
    return;
  }
  const path = routes.get(req.url);
  if (!path) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader(
    'Content-Type',
    {
      ' .flac': 'audio/flac',
      '.flac': 'audio/flac',
      '.wav': 'audio/wav',
      '.mp3': 'audio/mpeg',
      '.ogg': 'audio/ogg',
    }[extname(path)],
  );
  res.end(await readFile(path));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const report = {
  version: '1.0.6',
  scope:
    'Muted Web Audio decode only; Playwright WebKit is not physical iOS Safari or human listening.',
  members,
  browsers: [],
};
try {
  for (const [name, type] of [
    ['chromium', chromium],
    ['webkit', webkit],
  ]) {
    const browser = await type.launch({
      headless: true,
      ...(name === 'chromium' ? { channel: 'msedge' } : {}),
    });
    try {
      const page = await browser.newPage();
      await page.goto('http://127.0.0.1:' + server.address().port);
      const decoded = await page.evaluate(async (members) => {
        const Context = window.AudioContext ?? window.webkitAudioContext;
        if (!Context) {
          const rows = [];
          for (const item of members) {
            const audio = new Audio();
            audio.muted = true;
            audio.volume = 0;
            audio.src = item.url;
            await new Promise((done, reject) => {
              const timer = setTimeout(
                () => reject(new Error('Media decode timeout: ' + item.url)),
                5000,
              );
              audio.onloadeddata = () => {
                clearTimeout(timer);
                done();
              };
              audio.onerror = () => {
                clearTimeout(timer);
                reject(new Error('Media decode unsupported: ' + item.url));
              };
              audio.load();
            });
            rows.push({
              url: item.url,
              duration: audio.duration,
              method: 'muted HTMLAudio loadeddata',
            });
            audio.removeAttribute('src');
            audio.load();
          }
          return rows;
        }
        const context = new Context();
        try {
          const rows = [];
          for (const item of members) {
            const bytes = await (await fetch(item.url)).arrayBuffer();
            const sound = await context.decodeAudioData(bytes);
            rows.push({
              url: item.url,
              channels: sound.numberOfChannels,
              sampleRate: sound.sampleRate,
              duration: sound.duration,
            });
          }
          return rows;
        } finally {
          await context.close();
        }
      }, members);
      assert.equal(decoded.length, 23);
      report.browsers.push({ name, version: browser.version(), decoded });
    } finally {
      await browser.close();
    }
  }
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.message;
  process.exitCode = 1;
} finally {
  await new Promise((done) => server.close(done));
  await mkdir('artifacts/maintenance/v1.0.6/bug-five-seven', {
    recursive: true,
  });
  await writeFile(
    'artifacts/maintenance/v1.0.6/bug-five-seven/audio-decoders.json',
    JSON.stringify(report, null, 2) + '\n',
  );
}
console.log(
  JSON.stringify({
    result: report.result,
    browsers: report.browsers.map((b) => ({
      name: b.name,
      version: b.version,
      decoded: b.decoded.length,
    })),
    error: report.error,
  }),
);
