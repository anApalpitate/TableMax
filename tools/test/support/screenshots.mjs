import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { basename, dirname, resolve, relative, sep } from 'node:path';
import { writeScreenshot } from '../../maintenance/verification-artifacts.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';

const sessions = new Map();
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const failureName = /(?:^|[-_.])(failure|failed|error)(?:[-_.]|$)/i;

function session(path) {
  assertWorkspaceRoot();
  const output = dirname(resolve(path));
  const local = relative(resolve('.'), output).split(sep).join('/');
  if (!/^(artifacts|tmp)\//.test(local))
    throw new Error(
      'Verification screenshots require an artifacts/ or tmp/ output',
    );
  let value = sessions.get(output);
  if (!value) {
    const mode = process.env.TABLEMAX_TEST_SCREENSHOTS ?? 'representative';
    if (!['representative', 'all'].includes(mode))
      throw new Error('Screenshot mode must be representative or all');
    value = {
      output,
      mode,
      records: [],
      representatives: new Map(),
      aliases: [],
      encodings: [],
    };
    sessions.set(output, value);
  }
  return value;
}

async function flush(value) {
  value.flushing = (value.flushing ?? Promise.resolve()).then(async () => {
    await mkdir(value.output, { recursive: true });
    await writeFile(
      resolve(value.output, 'screenshot-index.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          mode: value.mode,
          previewQuality: 90,
          records: value.records,
          screenshotAliases: value.aliases,
          previewEncodings: value.encodings,
        },
        null,
        2,
      ) + '\n',
    );
  });
  await value.flushing;
}

// Unknown captures are acceptance evidence: keep their original PNG and name.
// Preview callers consume the returned path; literal legacy PNG reports stay valid.
export async function saveVerificationScreenshot(path, image, options = {}) {
  const value = session(path);
  if (
    !Buffer.isBuffer(image) ||
    image.length < 24 ||
    image.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a'
  )
    throw new Error('Screenshot capture must provide a PNG buffer');
  const requested = basename(path);
  const failure = options.failure === true || failureName.test(requested);
  const purpose = failure
    ? 'failure'
    : options.mustKeep
      ? 'key'
      : (options.purpose ?? 'key');
  if (
    !['key', 'failure', 'preview', 'representative', 'process'].includes(
      purpose,
    )
  )
    throw new Error('Unknown screenshot purpose');
  if (!/^[\w.-]+\.(png|webp)$/.test(requested))
    throw new Error('Unsafe screenshot filename');
  const preview = purpose === 'preview' || purpose === 'process';
  if (!preview && !requested.endsWith('.png'))
    throw new Error('Acceptance and failure screenshots require PNG');
  const filename = requested.replace(/\.webp$/, '.png');
  const retained = await writeScreenshot(
    value.output,
    purpose === 'process' ? `process/${filename}` : filename,
    image,
    value.aliases,
    {
      mustKeep: !preview,
      failure,
      preview,
      allowAlias: options.allowAlias === true,
      encodings: value.encodings,
    },
  );
  const actualBytes = await readFile(resolve(value.output, retained));
  const record = {
    requested,
    path: retained,
    purpose,
    bytes: actualBytes.length,
    sha256: hash(actualBytes),
    sourceSha256: hash(image),
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
    ...(options.context ? { context: options.context } : {}),
  };
  value.records.push(record);
  await flush(value);
  return record;
}

// This adapter keeps Playwright's Buffer return contract and all capture options.
export async function captureBrowserScreenshot(target, options, metadata = {}) {
  if (!target) return undefined; // Preserve optional failure capture chains.
  if (!options?.path)
    throw new Error('Saved browser screenshots require a path');
  session(options.path); // Validate output before capture or directory creation.
  const { path, ...captureOptions } = options;
  if (captureOptions.type && captureOptions.type !== 'png')
    throw new Error('Capture source must be PNG');
  const image = await target.screenshot({ ...captureOptions, type: 'png' });
  await saveVerificationScreenshot(path, image, metadata);
  return image;
}

export function matrixIdentity(label, metrics) {
  const { width, height, dpi, zoom = 1 } = metrics;
  if (
    ![width, height, dpi, zoom].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  )
    throw new Error('Screenshot geometry must be explicit');
  const geometry = `${width}x${height}`;
  let state = label.replace(
    new RegExp(`(?<![a-zA-Z0-9])${geometry}(?![a-zA-Z0-9])`, 'g'),
    '{viewport}',
  );
  state = state.replace(
    new RegExp(`(?<![a-zA-Z0-9])${width}(?![a-zA-Z0-9])`, 'g'),
    '{width}',
  );
  const boundary =
    width >= 3000
      ? '4k'
      : width <= 360
        ? height <= 640
          ? 'short-narrow-phone'
          : 'narrow-phone'
        : width <= 430
          ? height <= 640
            ? 'short-phone'
            : 'phone'
          : width <= 1000 && height < 500
            ? 'landscape-phone'
            : height <= 800
              ? 'short-desktop'
              : 'desktop';
  // Label retains state, role, seat/rack count, selection, scroll and other suffixes.
  return JSON.stringify([state, boundary, dpi, zoom]);
}

// Only reviewed matrix helpers opt in. Assertions remain outside this function.
export async function captureMatrixScreenshot(
  path,
  capture,
  metrics,
  options = {},
) {
  const value = session(path);
  const requested = basename(path);
  const failure = options.failure || failureName.test(requested);
  const key = matrixIdentity(options.state ?? requested, metrics);
  let previous = value.representatives.get(key);
  const tighter =
    previous &&
    (metrics.width < previous.context.width ||
      metrics.height < previous.context.height);
  if (previous && !failure && !options.mustKeep && !tighter) {
    let bytes;
    try {
      bytes = await readFile(resolve(value.output, previous.path));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    if (!bytes || hash(bytes) !== previous.sha256) {
      value.representatives.delete(key);
      previous = undefined;
    } else if (value.mode === 'representative') {
      value.records.push({
        ...previous,
        requested,
        skippedBeforeCapture: true,
      });
      await flush(value);
      return {
        ...previous,
        image: bytes,
        requested,
        skippedBeforeCapture: true,
      };
    }
  }
  const image = await capture();
  const record = await saveVerificationScreenshot(path, image, {
    ...options,
    purpose: failure
      ? 'failure'
      : options.mustKeep
        ? 'key'
        : options.purpose === 'preview'
          ? 'preview'
          : previous && !tighter && !options.mustKeep
            ? 'process'
            : 'representative',
    context: metrics,
  });
  if ((!previous || tighter || options.mustKeep) && !failure)
    value.representatives.set(key, record);
  return { ...record, image };
}

export async function browserScreenshotMetrics(page, zoom = 1) {
  return page.evaluate(
    (nativeZoom) => ({
      width: innerWidth,
      height: innerHeight,
      dpi: devicePixelRatio,
      zoom: nativeZoom,
    }),
    zoom,
  );
}

export async function captureBrowserMatrixScreenshot(
  page,
  options,
  metadata = {},
) {
  const { path, ...captureOptions } = options;
  session(path);
  return captureMatrixScreenshot(
    path,
    () => page.screenshot({ ...captureOptions, type: 'png' }),
    await browserScreenshotMetrics(page, metadata.zoom ?? 1),
    metadata,
  );
}
