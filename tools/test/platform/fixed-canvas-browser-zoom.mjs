import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchPersistentTestBrowser } from '../support/browser-test.mjs';
import { readMsEdgeRuntime } from '../support/msedge-runtime.mjs';
import { captureBrowserScreenshot } from '../support/screenshots.mjs';

// Chromium reads this preference into HostZoomMap; the default partition key is
// "x" and level = log(factor) / log(1.2). This is page zoom, not pinch/page scale.
// https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/browser/ui/zoom/chrome_zoom_level_prefs.cc
// https://chromium.googlesource.com/chromium/src/+/938b37a6d2886bf8335fc7db792f1eb46c65b2ae/third_party/blink/common/page/page_zoom.cc
// https://www.chromium.org/developers/design-documents/blink-coordinate-spaces/
const root = fileURLToPath(new URL('../../../', import.meta.url));
const serverRequire = createRequire(
  new URL('../../../apps/server/package.json', import.meta.url),
);
const projectRequire = createRequire(
  new URL('../../../package.json', import.meta.url),
);
const playwrightRequire = createRequire(
  projectRequire.resolve('playwright/package.json'),
);
const { PNG } = serverRequire('pngjs');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const local = (path) => relative(root, path).split(sep).join('/');
const windowSize = { width: 1440, height: 1440 };
const probeText = 'WWWW MMMM 01789';
const probeFamily = 'TableMaxContractLatin';
const surfaceCaptureParameters = Object.freeze({
  format: 'png',
  fromSurface: true,
  captureBeyondViewport: false,
});
const sourcePaths = [
  fileURLToPath(import.meta.url),
  join(root, 'tools/test/support/browser-test.mjs'),
  join(root, 'tools/test/support/screenshots.mjs'),
  join(root, 'tools/test/support/msedge-runtime.mjs'),
  join(root, 'pnpm-lock.yaml'),
  serverRequire.resolve('pngjs/package.json'),
  serverRequire.resolve('pngjs/lib/png-sync.js'),
  projectRequire.resolve('playwright/package.json'),
  playwrightRequire.resolve('playwright-core/package.json'),
  join(
    dirname(playwrightRequire.resolve('playwright-core/package.json')),
    'lib/coreBundle.js',
  ),
];

function ownedDirectory(value, prefix) {
  assert(value, `Missing browser zoom ${prefix} directory`);
  const path = resolve(value);
  assert(local(path).startsWith(prefix + '/'), `Expected ${prefix}/ directory`);
  for (let cursor = path; cursor !== resolve(root); cursor = dirname(cursor)) {
    assert(
      !existsSync(cursor) || !lstatSync(cursor).isSymbolicLink(),
      'Linked browser zoom directory rejected',
    );
  }
  return path;
}
async function fileRecord(path) {
  const bytes = await readFile(path);
  return { path: local(path), bytes: bytes.length, sha256: hash(bytes) };
}
function sameRuntime(actual, expected) {
  assert.equal(actual.version, expected.version, 'Edge version changed');
  for (const key of ['executable', 'engine']) {
    assert.equal(actual[key].path, expected[key].path, `Edge ${key} changed`);
    assert.equal(actual[key].bytes, expected[key].bytes);
    assert.equal(actual[key].sha256, expected[key].sha256);
  }
}
function near(actual, expected, tolerance, message) {
  assert(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message}: actual=${actual}, expected=${expected}, tolerance=${tolerance}`,
  );
}

async function installProbe(page) {
  return page.evaluate(
    async ({ text, family }) => {
      const canvas = document.querySelector('[data-fixed-canvas]');
      if (!canvas || document.querySelector('[data-browser-zoom-probe]'))
        throw new Error('Expected one production canvas and no previous probe');
      const loaded = await document.fonts.load(`400 18px "${family}"`, text);
      if (!loaded.length || loaded.some((face) => face.status !== 'loaded'))
        throw new Error('Browser zoom named Latin face did not load');
      const probe = document.createElement('div');
      probe.dataset.browserZoomProbe = 'true';
      probe.setAttribute('aria-label', '浏览器缩放栅格探针');
      probe.style.cssText =
        'all:initial;position:absolute;left:16px;top:16px;display:block;' +
        'width:320px;height:48px;padding:0 8px;box-sizing:border-box;background:#fff;' +
        `color:#000;font:normal 400 18px/48px "${family}";` +
        'letter-spacing:0;text-indent:0;text-shadow:none;white-space:nowrap;' +
        'overflow:hidden;z-index:2147483647;zoom:1;transform:none;' +
        'opacity:1;filter:none;isolation:isolate;';
      probe.textContent = text;
      canvas.append(probe);
      await document.fonts.ready;
      return loaded.map((face) => ({
        family: face.family,
        weight: face.weight,
        style: face.style,
        status: face.status,
      }));
    },
    { text: probeText, family: probeFamily },
  );
}

async function measure(page) {
  return page.evaluate(() => {
    const probe = document.querySelector('[data-browser-zoom-probe]');
    const canvas = probe.closest('[data-fixed-canvas]');
    const box = (node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    };
    const styles = (node) => {
      const style = getComputedStyle(node);
      return {
        tag: node.tagName,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontFamily: style.fontFamily,
        color: style.color,
        backgroundColor: style.backgroundColor,
        zoom: style.zoom,
        transform: style.transform,
      };
    };
    const ancestors = [];
    for (let node = probe; node; node = node.parentElement)
      ancestors.push(styles(node));
    const range = document.createRange();
    range.selectNodeContents(probe);
    const glyphRange = range.getBoundingClientRect();
    return {
      dpr: devicePixelRatio,
      window: { width: outerWidth, height: outerHeight },
      screen: {
        width: screen.width,
        height: screen.height,
        availWidth: screen.availWidth,
        availHeight: screen.availHeight,
        colorDepth: screen.colorDepth,
      },
      viewport: { width: innerWidth, height: innerHeight },
      visualViewport: visualViewport && {
        width: visualViewport.width,
        height: visualViewport.height,
        scale: visualViewport.scale,
        offsetLeft: visualViewport.offsetLeft,
        offsetTop: visualViewport.offsetTop,
      },
      scroll: { x: scrollX, y: scrollY },
      canvas: { ...box(canvas), layout: canvas.dataset.canvasLayout },
      layout: {
        layout: window.contractContext.layout,
        logicalSize: window.contractContext.logicalSize,
        scale: window.contractContext.scale,
        fitStatus: window.contractContext.fitStatus,
        preference: window.contractContext.preference,
      },
      probe: {
        ...box(probe),
        ...styles(probe),
        text: probe.textContent,
        glyphRange: { width: glyphRange.width, height: glyphRange.height },
      },
      ancestors,
      controlledFontLoads: window.controlledFontLoads,
      commands: window.fixtureCommands.length,
    };
  });
}

function surfaceScreenshotTarget(session) {
  return {
    async screenshot(options) {
      assert.deepEqual(options, {
        fullPage: false,
        scale: 'device',
        type: 'png',
      });
      // Locked Playwright 1.63 crops viewport:null screenshots using innerWidth
      // and innerHeight, which shrink under real page zoom. Request the original
      // viewport surface directly, without a clip or scale, then keep its bytes
      // through the existing screenshot writer. No image adjustment is applied.
      // https://chromedevtools.github.io/devtools-protocol/tot/Page/#method-captureScreenshot
      const { data } = await session.send(
        'Page.captureScreenshot',
        surfaceCaptureParameters,
      );
      return Buffer.from(data, 'base64');
    },
  };
}

function readInk(image, measurement) {
  const png = PNG.sync.read(image);
  const probe = measurement.probe,
    dpr = measurement.dpr;
  // Scan the white probe interior in the original device-pixel PNG. No resize,
  // synthetic text rendering, CSS-pixel screenshot or image resampling occurs.
  const roi = {
    left: Math.floor((probe.x + 2) * dpr),
    top: Math.floor((probe.y + 2) * dpr),
    right: Math.ceil((probe.x + probe.width - 2) * dpr),
    bottom: Math.ceil((probe.y + probe.height - 2) * dpr),
  };
  assert(
    roi.left >= 0 &&
      roi.top >= 0 &&
      roi.right <= png.width &&
      roi.bottom <= png.height,
    'Browser zoom probe ROI must be wholly inside the original viewport PNG',
  );
  let left = Infinity,
    top = Infinity,
    right = -1,
    bottom = -1,
    pixels = 0;
  for (let y = roi.top; y < roi.bottom; y++) {
    for (let x = roi.left; x < roi.right; x++) {
      const offset = (y * png.width + x) * 4;
      if (
        png.data[offset + 3] >= 250 &&
        png.data[offset] <= 80 &&
        png.data[offset + 1] <= 80 &&
        png.data[offset + 2] <= 80
      ) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
        pixels++;
      }
    }
  }
  assert(pixels > 0, 'The original PNG contains actual black glyph pixels');
  return {
    image: { width: png.width, height: png.height },
    roi,
    threshold: { maximumRgb: 80, minimumAlpha: 250 },
    ink: {
      left,
      top,
      right,
      bottom,
      width: right - left + 1,
      height: bottom - top + 1,
      pixels,
    },
  };
}

function assertSnapshot(value, baseline, item) {
  const { measurement: current, factor } = value;
  assert.equal(current.layout.layout, item.layout);
  assert.equal(current.layout.preference, 'portrait');
  assert.equal(current.layout.fitStatus, 'fits');
  assert.equal(current.layout.scale, 1);
  assert.equal(current.layout.logicalSize.width, item.width);
  assert.equal(current.layout.logicalSize.height, item.height);
  near(current.canvas.width, item.width, 0.5, 'Canvas logical width');
  near(current.canvas.height, item.height, 0.5, 'Canvas logical height');
  assert.equal(current.probe.fontSize, '18px');
  assert.equal(current.probe.fontWeight, '400');
  assert(current.probe.fontFamily.includes(probeFamily));
  assert.equal(current.probe.color, 'rgb(0, 0, 0)');
  assert.equal(current.probe.backgroundColor, 'rgb(255, 255, 255)');
  assert.equal(current.probe.text, probeText);
  assert(value.probeFontLoads.length > 0);
  assert(
    value.probeFontLoads.every(
      (face) =>
        face.family.replaceAll('"', '') === probeFamily &&
        face.weight === '400' &&
        face.status === 'loaded',
    ),
    'The probe uses the actual named regular Latin font face',
  );
  assert.equal(current.commands, 0);
  assert.deepEqual(current.scroll, { x: 0, y: 0 });
  for (const style of current.ancestors) {
    assert.equal(Number(style.zoom), 1, 'Probe ancestors have no CSS zoom');
    assert.equal(
      style.transform,
      'none',
      'Probe ancestors have no CSS transform',
    );
  }
  near(current.visualViewport?.scale, 1, 0.001, 'No pinch zoom');
  for (const [name, viewport] of Object.entries(value.layoutMetrics)) {
    if (
      ['visualViewport', 'cssVisualViewport'].includes(name) &&
      viewport.zoom !== undefined
    )
      near(viewport.zoom, factor, 0.001, `Actual CDP ${name}.zoom`);
  }
  const before = baseline.measurement;
  assert.deepEqual(
    current.window,
    before.window,
    'Browser window dimensions stay fixed',
  );
  assert.deepEqual(
    current.screen,
    before.screen,
    'Screen environment stays fixed',
  );
  assert.deepEqual(value.browserWindow.bounds, baseline.browserWindow.bounds);
  assert.deepEqual(
    value.raster.image,
    baseline.raster.image,
    'Original viewport PNG dimensions stay fixed',
  );
  near(
    current.dpr / before.dpr,
    factor,
    0.001,
    'Actual DPR follows browser zoom',
  );
  for (const axis of ['width', 'height']) {
    near(
      current.probe.glyphRange[axis],
      before.probe.glyphRange[axis],
      0.5,
      `Logical glyph range ${axis} stays fixed`,
    );
    near(
      current.viewport[axis],
      before.viewport[axis] / factor,
      1,
      `CSS viewport ${axis} contracts`,
    );
    near(
      current.visualViewport[axis],
      before.visualViewport[axis] / factor,
      1,
      `Visual CSS viewport ${axis} contracts`,
    );
    if (factor > 1) {
      assert(
        value.raster.ink[axis] > baseline.raster.ink[axis],
        `Actual glyph ink ${axis} grows`,
      );
      near(
        value.raster.ink[axis],
        baseline.raster.ink[axis] * factor,
        2,
        `Device-pixel glyph ink ${axis} follows zoom`,
      );
    }
  }
}

/** Internal proof for the existing verifier: three startup zooms, never live zoom. */
export async function runBrowserZoomProof({
  browserRuntime,
  url,
  item,
  work,
  output,
  settle,
}) {
  assert.equal(item.layer, 'adapter');
  assert.equal(item.role, 'player');
  assert.equal(item.layout, 'player-portrait');
  assert(/^[a-z0-9][a-z0-9-]*$/.test(item.id));
  assert.equal(typeof settle, 'function');
  assert.equal(
    new URL(url).hostname,
    '127.0.0.1',
    'Zoom fixture stays on loopback',
  );
  assert.equal(new URL(url).protocol, 'http:');
  process.env.TABLEMAX_AUTO_MAINTENANCE = '0';
  work = ownedDirectory(work, 'tmp');
  output = ownedDirectory(output, 'artifacts');
  const prefix = item.id + '-browser-zoom';
  const proofPath = join(output, prefix + '-proof.json');
  assert(!existsSync(proofPath), 'Browser zoom evidence already exists');
  const task = await mkdtemp(join(work, 'browser-zoom-'));
  const methodDirectory = join(output, prefix + '-method');
  await mkdir(methodDirectory);
  const report = {
    schemaVersion: 1,
    result: 'running',
    failures: 0,
    item,
    requestedWindow: windowSize,
    boundary:
      'Three isolated startup page-zoom preferences in actual hidden muted Edge. No in-document zoom transition, draft retention, physical DPI or physical-device acceptance.',
    mechanisms: {
      cssZoom: false,
      cssTransform: false,
      deviceMetricsOverride: false,
      pinchSimulation: false,
      screenshotScale: 'device',
      screenshotMethod: 'Page.captureScreenshot',
      screenshotClip: false,
    },
    snapshots: [],
    screenshots: [],
    methodSources: [],
    errors: [],
  };
  let failure;
  try {
    report.runtimeBefore = readMsEdgeRuntime();
    sameRuntime(report.runtimeBefore, browserRuntime);
    for (const path of sourcePaths) {
      const record = await fileRecord(path);
      if (record.path.startsWith('tools/')) {
        const target = join(methodDirectory, basename(path));
        await writeFile(target, await readFile(path), { flag: 'wx' });
        assert.equal(hash(await readFile(target)), record.sha256);
        record.evidencePath = local(target);
      }
      report.methodSources.push(record);
    }
    for (const factor of [1, 1.25, 1.5]) {
      const percent = Math.round(factor * 100);
      const profile = join(task, 'profile-' + percent);
      const temporary = join(task, 'temp-' + percent);
      await mkdir(join(profile, 'Default'), { recursive: true });
      await mkdir(temporary);
      const preferencesPath = join(profile, 'Default', 'Preferences');
      const preferences = Buffer.from(
        JSON.stringify({
          partition: {
            default_zoom_level: { x: Math.log(factor) / Math.log(1.2) },
            per_host_zoom_levels: {},
          },
        }) + '\n',
      );
      await writeFile(preferencesPath, preferences, { flag: 'wx' });
      const savedPreferences = join(
        output,
        `${prefix}-${percent}-preferences.json`,
      );
      await writeFile(savedPreferences, preferences, { flag: 'wx' });
      const snapshot = {
        percent,
        factor,
        profile: local(profile),
        preferences: {
          ...(await fileRecord(savedPreferences)),
          profilePath: local(preferencesPath),
        },
        result: 'running',
      };
      report.snapshots.push(snapshot);
      let context;
      try {
        context = await launchPersistentTestBrowser(profile, {
          executablePath: browserRuntime.executable.path,
          headless: true,
          viewport: null,
          reducedMotion: 'reduce',
          ignoreDefaultArgs: ['--hide-scrollbars'],
          args: [`--window-size=${windowSize.width},${windowSize.height}`],
          env: {
            ...process.env,
            TEMP: temporary,
            TMP: temporary,
            TABLEMAX_AUTO_MAINTENANCE: '0',
          },
        });
        assert.equal(context.browser().version(), browserRuntime.version);
        await context.route('**/*', (route) =>
          new URL(route.request().url()).origin === new URL(url).origin
            ? route.continue()
            : route.abort('blockedbyclient'),
        );
        await context.addInitScript(() => {
          if (
            location.protocol === 'http:' &&
            location.hostname === '127.0.0.1'
          )
            localStorage.setItem('tablemax-sound-enabled', 'false');
        });
        const page = context.pages()[0] ?? (await context.newPage());
        page.setDefaultTimeout(10000);
        page.on('pageerror', (error) => report.errors.push(error.message));
        const response = await page.goto(url);
        assert(response?.ok(), 'Browser zoom fixture responds successfully');
        snapshot.html = {
          url: response.url(),
          sha256: hash(await response.body()),
        };
        await page.waitForFunction(
          () => typeof window.renderFixedCase === 'function',
        );
        await page.evaluate((value) => window.renderFixedCase(value), item);
        await settle(page);
        await page
          .getByRole('combobox', { name: '显示布局', exact: true })
          .selectOption('portrait');
        await settle(page);
        snapshot.probeFontLoads = await installProbe(page);
        await settle(page);
        const session = await context.newCDPSession(page);
        snapshot.layoutMetrics = await session.send('Page.getLayoutMetrics');
        snapshot.browserWindow = await session.send(
          'Browser.getWindowForTarget',
        );
        snapshot.measurement = await measure(page);
        snapshot.capture = {
          method: 'Page.captureScreenshot',
          parameters: surfaceCaptureParameters,
        };
        const path = join(output, `${prefix}-${percent}.png`);
        const image = await captureBrowserScreenshot(
          surfaceScreenshotTarget(session),
          { path, fullPage: false, scale: 'device' },
          { mustKeep: true },
        );
        assert.equal(
          hash(await readFile(path)),
          hash(image),
          'The saved viewport PNG preserves the original capture bytes',
        );
        const screenshot = {
          ...(await fileRecord(path)),
          percent,
          factor,
          width: image.readUInt32BE(16),
          height: image.readUInt32BE(20),
        };
        report.screenshots.push(screenshot);
        snapshot.screenshot = screenshot;
        snapshot.raster = readInk(image, snapshot.measurement);
        assertSnapshot(snapshot, report.snapshots[0], item);
        assert.equal(
          report.errors.length,
          0,
          'Browser zoom fixture has no page errors',
        );
        snapshot.result = 'passed';
      } catch (error) {
        snapshot.result = 'failed';
        snapshot.error = String(error);
        throw error;
      } finally {
        await context?.close();
        if (existsSync(preferencesPath)) {
          const target = join(
            output,
            `${prefix}-${percent}-preferences-after.json`,
          );
          await writeFile(target, await readFile(preferencesPath), {
            flag: 'wx',
          });
          snapshot.persistedPreferences = await fileRecord(target);
        }
      }
    }
    for (const expected of report.methodSources)
      assert.deepEqual(
        await fileRecord(join(root, expected.path)),
        {
          path: expected.path,
          bytes: expected.bytes,
          sha256: expected.sha256,
        },
        'Browser zoom method source changed during the proof',
      );
    report.result = 'passed';
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    report.result = 'failed';
    report.failures = 1;
    report.error = String(error);
  } finally {
    try {
      report.runtimeAfter = readMsEdgeRuntime();
      sameRuntime(report.runtimeAfter, browserRuntime);
    } catch (error) {
      failure ??= error instanceof Error ? error : new Error(String(error));
      report.result = 'failed';
      report.failures = 1;
      report.runtimeError = String(error);
    }
    await writeFile(proofPath, JSON.stringify(report, null, 2) + '\n', {
      flag: 'wx',
    });
  }
  if (failure) {
    failure.browserZoomEvidence = local(proofPath);
    throw failure;
  }
  return {
    ...report,
    proofPath: local(proofPath),
    proofSha256: hash(await readFile(proofPath)),
  };
}
