import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { validateResourcePolicies } from './resource-policy.mjs';
import { build } from 'vite';
import { createServer } from 'node:http';
import { gameResourcesPlugin, mediaFile } from './game-resources.mjs';
import { launchTestBrowser } from '../test/support/browser-test.mjs';

test('layered CSS imports keep game media in resource URLs and decode over HTTP', async () => {
  const result = await build({
    configFile: false,
    plugins: [gameResourcesPlugin(resolve('.'))],
    logLevel: 'silent',
    base: './',
    build: {
      write: false,
      assetsInlineLimit: 0,
      rolldownOptions: {
        input: {
          original: resolve('games/pokemon-encounters/ui/legacy.css'),
          expansion: resolve(
            'games/pokemon-encounters/expansion/web/theme.css',
          ),
        },
        output: { assetFileNames: '[name]-[hash][extname]' },
      },
    },
  });
  const output = result.output;
  assert.deepEqual(
    output.filter((item) => mediaFile(item.fileName)),
    [],
  );
  const css = output.filter((item) => item.fileName.endsWith('.css'));
  assert.ok(css.length);
  const imagePath = 'pokemon-encounters/tabletop/garden-table-v1.webp';
  const styles = css.map((item) => String(item.source)).join('\n');
  assert.ok(styles.includes('@layer pokemon-theme'));
  assert.ok(styles.includes('../resources/' + imagePath));
  assert.ok(!styles.includes('garden-table-v1-DNCb1FqE.webp'));
  const bytes = await readFile(resolve('assets/games', imagePath));
  const server = createServer((request, response) => {
    if (request.url === '/resources/' + imagePath) {
      response.setHeader('Content-Type', 'image/webp');
      response.end(bytes);
    } else {
      response.writeHead(404);
      response.end();
    }
  });
  let browser;
  try {
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    const url = `http://127.0.0.1:${server.address().port}/resources/${imagePath}`;
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    browser = await launchTestBrowser({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const size = await page.evaluate(async (src) => {
      const image = new Image();
      image.src = src;
      await image.decode();
      return [image.naturalWidth, image.naturalHeight];
    }, url);
    assert.ok(size[0] > 0 && size[1] > 0);
  } finally {
    await browser?.close();
    await new Promise((done) => server.close(done));
  }
});

test('current cinematic runtime references match provenance, dimensions and declared budgets', async () => {
  const folder = resolve('assets/games/pokemon-encounters/expansion/cinematic');
  const manifest = JSON.parse(
    await readFile(join(folder, 'manifest.json'), 'utf8'),
  );
  const inputs = await validateResourcePolicies(
    manifest.assets.map((x) => join(folder, x.file)),
    resolve('assets/games/pokemon-encounters'),
  );
  assert.deepEqual(inputs, [
    'assets/games/pokemon-encounters/expansion/cinematic/manifest.json',
  ]);
});

test('policy rejects changed bytes, missing provenance, undeclared files and excessive dimensions', async () => {
  const taskRoot = resolve(process.env.TABLEMAX_TEST_TMP ?? 'tmp');
  await mkdir(taskRoot, { recursive: true });
  const folder = await mkdtemp(join(taskRoot, 'resource-policy-'));
  try {
    const image = Buffer.alloc(30);
    image.write('RIFF');
    image.writeUInt32LE(22, 4);
    image.write('WEBPVP8X', 8);
    image.writeUInt32LE(10, 16);
    image.writeUIntLE(959, 24, 3);
    image.writeUIntLE(539, 27, 3);
    const path = join(folder, 'runtime.webp');
    await writeFile(path, image);
    const asset = {
      file: 'runtime.webp',
      source: 'prepared/original.png',
      source_sha256: 'a'.repeat(64),
      sha256: createHash('sha256').update(image).digest('hex'),
      bytes: 30,
      width: 960,
      height: 540,
    };
    const policy = {
      maxWidth: 1000,
      maxHeight: 600,
      maxFileBytes: 100,
      maxTotalBytes: 100,
    };
    const save = async (assets = [asset], runtimePolicy = policy) =>
      writeFile(
        join(folder, 'manifest.json'),
        JSON.stringify({ assets, runtimePolicy }),
      );
    await save();
    assert.equal((await validateResourcePolicies([path], folder)).length, 1);
    await save([{ ...asset, sha256: 'b'.repeat(64) }]);
    await assert.rejects(
      validateResourcePolicies([path], folder),
      /differs from provenance/,
    );
    await save([{ ...asset, source_sha256: '' }]);
    await assert.rejects(
      validateResourcePolicies([path], folder),
      /Missing source provenance/,
    );
    await save([]);
    await assert.rejects(
      validateResourcePolicies([path], folder),
      /missing from provenance whitelist/,
    );
    await save([asset], { ...policy, maxWidth: 900 });
    await assert.rejects(
      validateResourcePolicies([path], folder),
      /exceeds declared budget/,
    );
    await save([asset], { ...policy, maxTotalBytes: 20 });
    await assert.rejects(
      validateResourcePolicies([path], folder),
      /group exceeds/,
    );
    await save();
    assert.deepEqual(await validateResourcePolicies([], folder), []);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
