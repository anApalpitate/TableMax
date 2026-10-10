import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { launchTestBrowser } from './browser-test.mjs';
import { launchDesktop } from './desktop-test.mjs';
import {
  saveVerificationScreenshot,
  captureBrowserScreenshot,
  captureMatrixScreenshot,
  matrixIdentity,
  captureBrowserMatrixScreenshot,
} from './screenshots.mjs';

function png() {
  const chunk = (kind, data) => {
    const type = Buffer.from(kind);
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([type, data])) {
      crc ^= byte;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4),
      checksum = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, type, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(64);
  header.writeUInt32BE(32, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(32 * 257);
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++) {
      const i = y * 257 + 1 + x * 4;
      rows[i] = x * 4;
      rows[i + 1] = y * 8;
      rows[i + 2] = (x * 17 + y * 11) % 256;
      rows[i + 3] = x * 4;
    }
  return Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function fixture(
  run,
  mode = 'representative',
  { nativeProfile = false } = {},
) {
  await mkdir('tmp', { recursive: true });
  const output = await mkdtemp(
    resolve(nativeProfile ? 'tmp/desktop-verify-' : 'tmp/screenshot-policy-'),
  );
  const old = process.env.TABLEMAX_TEST_SCREENSHOTS;
  process.env.TABLEMAX_TEST_SCREENSHOTS = mode;
  try {
    await run(output);
  } finally {
    if (old === undefined) delete process.env.TABLEMAX_TEST_SCREENSHOTS;
    else process.env.TABLEMAX_TEST_SCREENSHOTS = old;
    assert.ok(
      output.startsWith(resolve('tmp') + '\\') ||
        output.startsWith(resolve('tmp') + '/'),
    );
    // WebView2 releases profile locks after the owning desktop exits. Keep the
    // exact known temporary directory for guarded maintenance, rather than
    // recursively deleting a profile while Windows still holds its lockfile.
    if (!nativeProfile) await rm(output, { recursive: true, force: true });
  }
}
const metrics = (width = 1920, height = 1080, dpi = 1, zoom = 1) => ({
  width,
  height,
  dpi,
  zoom,
});

test('key/failure PNG bytes, preview quality90, returned references and sidecar SHA remain exact', async () => {
  await fixture(async (output) => {
    const source = png();
    const key = await saveVerificationScreenshot(
      join(output, 'key.png'),
      source,
    );
    const failed = await saveVerificationScreenshot(
      join(output, 'failure.png'),
      source,
      { purpose: 'preview' },
    );
    assert.deepEqual(await readFile(join(output, key.path)), source);
    assert.deepEqual(await readFile(join(output, failed.path)), source);
    const first = await saveVerificationScreenshot(
      join(output, 'preview.png'),
      source,
      { purpose: 'preview', allowAlias: true },
    );
    const second = await saveVerificationScreenshot(
      join(output, 'preview-again.png'),
      source,
      { purpose: 'preview', allowAlias: true },
    );
    assert.equal(first.path, 'preview.webp');
    assert.equal(second.path, first.path);
    const bytes = await readFile(join(output, first.path));
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(first.sha256, hash(bytes));
    const index = JSON.parse(
      await readFile(join(output, 'screenshot-index.json'), 'utf8'),
    );
    assert.equal(index.previewEncodings[0].quality, 90);
    assert.equal(index.previewEncodings[0].sha256, first.sha256);
    assert.equal(index.screenshotAliases[0].retained, first.path);
    assert.equal(index.records[3].path, first.path);
  });
});

test('Playwright options/Buffer contract survive, legacy key paths do not alias, output is guarded before capture', async () => {
  await fixture(async (output) => {
    const calls = [],
      source = png(),
      target = {
        screenshot: async (options) => {
          calls.push(options);
          return source;
        },
      };
    assert.deepEqual(
      await captureBrowserScreenshot(target, {
        path: join(output, 'legacy.png'),
        fullPage: true,
        timeout: 17,
      }),
      source,
    );
    await captureBrowserScreenshot(target, {
      path: join(output, 'legacy-2.png'),
      fullPage: false,
    });
    assert.equal(calls[0].fullPage, true);
    assert.equal(calls[0].timeout, 17);
    assert.equal(calls[0].type, 'png');
    assert.equal(calls[0].path, undefined);
    assert.deepEqual(await readFile(join(output, 'legacy-2.png')), source);
    await assert.rejects(
      captureBrowserScreenshot(target, {
        path: resolve('assets/not-allowed.png'),
      }),
      /artifacts/,
    );
    assert.equal(calls.length, 2);
    assert.equal(
      await captureBrowserScreenshot(undefined, {
        path: join(output, 'failure.png'),
      }),
      undefined,
    );
    await assert.rejects(
      saveVerificationScreenshot(
        join(output, 'invalid.png'),
        Buffer.from('invalid'),
      ),
      /PNG buffer/,
    );
  });
});

test('matrix skips capture only for redundant successful boundaries and keeps all assertions in the caller', async () => {
  await fixture(async (output) => {
    let captures = 0,
      assertions = 0;
    const capture = async () => {
      captures++;
      return png();
    };
    for (const [w, h] of [
      [1920, 1080],
      [2560, 1440],
    ]) {
      assertions++;
      assert.ok(w >= 1920);
      const result = await captureMatrixScreenshot(
        join(output, `public-state-6-${w}x${h}.png`),
        capture,
        metrics(w, h),
      );
      assert.equal(result.path, 'public-state-6-1920x1080.png');
    }
    assert.equal(assertions, 2);
    assert.equal(captures, 1);
    for (const [label, m] of [
      ['public-state-6-1280x720', metrics(1280, 720)],
      ['public-state-6-3840x2160', metrics(3840, 2160)],
      ['public-state-6-1920x1080', metrics(1920, 1080, 1.5)],
      ['public-state-6-1920x1080', metrics(1920, 1080, 1, 1.25)],
      ['host-state-6-1920x1080', metrics()],
      ['public-state-5-1920x1080', metrics()],
      ['public-new-state-6-1920x1080', metrics()],
    ])
      await captureMatrixScreenshot(join(output, label + '.png'), capture, m);
    assert.equal(captures, 8);
    const failed = await captureMatrixScreenshot(
      join(output, 'failure.png'),
      capture,
      metrics(),
      { state: 'public-state-6-1920x1080' },
    );
    assert.equal(failed.path, 'failure.png');
    assert.equal(captures, 9);
  });
});

test('shorter/narrower representatives, overwritten/missing files and mustKeep never skip capture', async () => {
  await fixture(async (output) => {
    let captures = 0;
    const capture = async () => {
      captures++;
      return png();
    };
    const first = await captureMatrixScreenshot(
      join(output, 'player-action-430.png'),
      capture,
      metrics(430, 844),
    );
    const narrow = await captureMatrixScreenshot(
      join(output, 'player-action-390.png'),
      capture,
      metrics(390, 844),
    );
    assert.equal(narrow.path, 'player-action-390.png');
    assert.equal(captures, 2);
    assert.notEqual(
      matrixIdentity('phone-320x568', metrics(320, 568)),
      matrixIdentity('phone-320x844', metrics(320, 844)),
    );
    await rm(join(output, narrow.path));
    await captureMatrixScreenshot(
      join(output, 'player-action-430.png'),
      capture,
      metrics(430, 844),
    );
    assert.equal(captures, 3);
    await captureMatrixScreenshot(
      join(output, 'player-action-430.png'),
      capture,
      metrics(430, 844),
      { mustKeep: true },
    );
    assert.equal(captures, 4);
    assert.equal(first.purpose, 'representative');
    await writeFile(join(output, first.path), Buffer.from('overwritten'));
    await captureMatrixScreenshot(
      join(output, 'player-action-430.png'),
      capture,
      metrics(430, 844),
    );
    assert.equal(captures, 5);
  });
});

test('actual hidden Edge captures key/failure PNG and WebP90; repeated matrix skips capture but executes geometry assertions', async () => {
  const output = resolve(
    'artifacts/maintenance/v1.0.6/screenshot-policy-rollout-20261011/live-browser',
  );
  await mkdir(output, { recursive: true });
  const browser = await launchTestBrowser({
    channel: 'msedge',
    headless: true,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 640, height: 480 },
    });
    await page.setContent(
      '<style>body{margin:0;background:#f6efd9}article{width:300px;padding:20px;font:24px sans-serif;background:linear-gradient(120deg,#9ee0e0,#eb99bb)}b{display:block}</style><article><b>TableMax</b>Screenshot policy 90</article>',
    );
    await captureBrowserScreenshot(page, {
      path: join(output, 'acceptance.png'),
    });
    const pngBytes = await page.screenshot();
    const preview = await saveVerificationScreenshot(
      join(output, 'ordinary.png'),
      pngBytes,
      { purpose: 'preview' },
    );
    await captureBrowserScreenshot(
      page,
      { path: join(output, 'failure.png') },
      { purpose: 'preview' },
    );
    let captures = 0;
    for (const [width, height] of [
      [1920, 1080],
      [2560, 1440],
    ]) {
      await page.setViewportSize({ width, height });
      const geometry = await page.evaluate(() => ({
        width: innerWidth,
        height: innerHeight,
        dpi: devicePixelRatio,
        zoom: 1,
      }));
      assert.equal(geometry.width, width);
      await captureMatrixScreenshot(
        join(output, `public-live-${width}x${height}.png`),
        async () => {
          captures++;
          return page.screenshot();
        },
        geometry,
      );
    }
    assert.equal(captures, 1);
    await page.setViewportSize({ width: 320, height: 568 });
    const phone = await captureBrowserMatrixScreenshot(page, {
      path: join(output, 'player-live-320x568.png'),
    });
    assert.equal(phone.width, 320);
    const index = JSON.parse(
      await readFile(join(output, 'screenshot-index.json'), 'utf8'),
    );
    assert.equal(index.previewEncodings[0].quality, 90);
    assert.equal(
      (await readFile(join(output, 'failure.png')))
        .subarray(0, 8)
        .toString('hex'),
      '89504e470d0a1a0a',
    );
    await writeFile(
      join(output, 'results.json'),
      JSON.stringify(
        {
          result: 'passed',
          captures,
          assertedMatrixRows: 2,
          preview,
          sourceBytes: pngBytes.length,
          savedBytes: preview.bytes,
        },
        null,
        2,
      ) + '\n',
    );
  } finally {
    await browser.close();
  }
});

test('actual hidden WebView2 captures preserve native PNG and encode only ordinary preview', async () => {
  const output = resolve(
    'artifacts/maintenance/v1.0.6/screenshot-policy-rollout-20261011/live-native',
  );
  await mkdir(output, { recursive: true });
  await fixture(
    async (data) => {
      const desktop = await launchDesktop({
        env: {
          ...process.env,
          TABLEMAX_HOST: '127.0.0.1',
          TABLEMAX_PORT: '0',
          TABLEMAX_DATA_DIR: data,
        },
      });
      try {
        const page = await desktop.firstWindow();
        await page.waitForURL('**/host');
        await page.locator('.connection.online').waitFor();
        await page.evaluate(
          () =>
            new Promise((done) =>
              requestAnimationFrame(() => requestAnimationFrame(done)),
            ),
        );
        const win = await desktop.browserWindow(page);
        assert.equal(await win.evaluate((w) => w.isVisible()), false);
        const geometry = await page.evaluate(() => ({
          width: innerWidth,
          height: innerHeight,
          dpi: devicePixelRatio,
          zoom: 1,
        }));
        geometry.zoom = await win.evaluate((w) =>
          w.webContents.getZoomFactor(),
        );
        const native = await captureMatrixScreenshot(
          join(output, 'native-host.png'),
          async () =>
            Buffer.from(
              await win.evaluate(async (w) =>
                (await w.webContents.capturePage()).toPNG().toString('base64'),
              ),
              'base64',
            ),
          geometry,
          { mustKeep: true },
        );
        assert.equal(native.path, 'native-host.png');
        assert.ok(native.width > 0 && native.height > 0);
        assert.deepEqual(
          await readFile(join(output, native.path)),
          native.image,
        );
        const preview = await saveVerificationScreenshot(
          join(output, 'native-preview.png'),
          native.image,
          { purpose: 'preview' },
        );
        assert.equal(preview.path, 'native-preview.webp');
        await captureBrowserScreenshot(
          page,
          { path: join(output, 'failure.png') },
          { purpose: 'preview' },
        );
        assert.equal(
          (await readFile(join(output, 'failure.png')))
            .subarray(0, 8)
            .toString('hex'),
          '89504e470d0a1a0a',
        );
        const index = JSON.parse(
          await readFile(join(output, 'screenshot-index.json'), 'utf8'),
        );
        assert.equal(index.previewEncodings[0].quality, 90);
        await writeFile(
          join(output, 'results.json'),
          JSON.stringify(
            {
              result: 'passed',
              hidden: true,
              temporaryData: data,
              cleanup:
                'deferred to guarded maintenance with recent-file protection',
              geometry,
              native: { ...native, image: undefined },
              preview,
            },
            null,
            2,
          ) + '\n',
        );
      } finally {
        await desktop.close();
      }
    },
    'representative',
    { nativeProfile: true },
  );
});

test('all-mode extra matrix frames are WebP90 process files; first and failures stay PNG', async () => {
  await fixture(async (output) => {
    const capture = async () => png();
    await captureMatrixScreenshot(
      join(output, 'host-ready-1920x1080.png'),
      capture,
      metrics(),
    );
    const extra = await captureMatrixScreenshot(
      join(output, 'host-ready-2560x1440.png'),
      capture,
      metrics(2560, 1440),
    );
    assert.equal(extra.path, 'process/host-ready-2560x1440.webp');
    assert.equal(
      (await readFile(join(output, extra.path))).toString('ascii', 8, 12),
      'WEBP',
    );
    assert.equal(
      (await readFile(join(output, 'host-ready-1920x1080.png')))
        .subarray(0, 8)
        .toString('hex'),
      '89504e470d0a1a0a',
    );
    const failure = await captureMatrixScreenshot(
      join(output, 'failure.png'),
      capture,
      metrics(),
      { state: 'host-ready-1920x1080' },
    );
    assert.equal(failure.path, 'failure.png');
  }, 'all');
});

async function sources(dir = 'tools/test') {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await sources(path)));
    else if (entry.name.endsWith('.mjs') && !entry.name.endsWith('.test.mjs'))
      files.push(path);
  }
  return files;
}
test('all saved verification capture sites use policy; only explicit material-source functions bypass it', async () => {
  const raw = [],
    integrated = new Set();
  const allowed = new Set([
    'tools/test/games/modern-art/verify-modern-art-debug.mjs:captureAsset',
    'tools/test/games/power-grid/verify-power-grid-ui.mjs:captureRuleScreens',
    'tools/test/platform/verify-rules-guides.mjs:asset',
  ]);
  for (const file of await sources()) {
    if (file.includes('/support/') || file.includes('/runner/')) continue;
    const source = await readFile(file, 'utf8');
    if (/screenshots\.mjs|verification-artifacts\.mjs/.test(source))
      integrated.add(file);
    const ast = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS,
    );
    function visit(n) {
      if (
        ts.isCallExpression(n) &&
        n.expression.getText(ast) === 'writeFile' &&
        n.arguments.length >= 2
      ) {
        const target = n.arguments[0].getText(ast),
          data = n.arguments[1].getText(ast);
        // One synthetic avatar upload input is material, not a saved UI capture.
        const synthetic =
          file === 'tools/test/box/verify-box-debug.mjs' &&
          data.startsWith('PNG.sync.write(');
        if (
          !synthetic &&
          (/\.(png|webp|jpe?g)/.test(target) ||
            /^Buffer\.from\(.*base64/s.test(data))
        )
          raw.push(
            `${file}:raw-image-write:${ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1}`,
          );
      }
      if (
        ts.isCallExpression(n) &&
        ts.isPropertyAccessExpression(n.expression) &&
        n.expression.name.text === 'screenshot'
      ) {
        const options = n.arguments[0];
        if (
          options &&
          ts.isObjectLiteralExpression(options) &&
          options.properties.some((p) => p.name?.getText(ast) === 'path')
        ) {
          let fn;
          for (let p = n.parent; p; p = p.parent)
            if (ts.isFunctionLike(p)) {
              fn = p;
              break;
            }
          const name =
            fn?.name?.getText(ast) ??
            (fn?.parent && ts.isVariableDeclaration(fn.parent)
              ? fn.parent.name.getText(ast)
              : '');
          if (!allowed.has(`${file}:${name}`))
            raw.push(
              `${file}:${ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1}`,
            );
        }
      }
      ts.forEachChild(n, visit);
    }
    visit(ast);
  }
  assert.deepEqual(
    raw,
    [],
    'New raw browser saving must be explicitly classified',
  );
  assert.ok(
    integrated.size >= 51,
    `Only ${integrated.size} capture modules integrated`,
  );
});
