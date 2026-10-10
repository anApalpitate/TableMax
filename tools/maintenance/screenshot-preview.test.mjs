import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import {
  ScreenshotPolicy,
  writeScreenshot,
} from './verification-artifacts.mjs';

function png() {
  const chunk = (kind, data) => {
    const type = Buffer.from(kind);
    let crc = 0xffffffff;
    for (const byte of Buffer.concat([type, data])) {
      crc ^= byte;
      for (let i = 0; i < 8; i++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const length = Buffer.alloc(4),
      checksum = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, type, data, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(64, 0);
  header.writeUInt32BE(32, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(32 * (64 * 4 + 1));
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
const hash = (value) => createHash('sha256').update(value).digest('hex');

test('preview encodes WebP90 with dimensions/alpha checked, aliases exact files and keeps key PNG bytes', async () => {
  const output = await mkdtemp(join(tmpdir(), 'tablemax-preview-'));
  try {
    const source = png(),
      original = hash(source),
      aliases = [],
      encodings = [];
    assert.equal(
      await writeScreenshot(output, 'key.png', source, aliases, {
        mustKeep: true,
        preview: true,
      }),
      'key.png',
    );
    assert.equal(
      await writeScreenshot(output, 'failure.png', source, aliases, {
        preview: true,
      }),
      'failure.png',
    );
    assert.equal(
      await writeScreenshot(output, 'preview.png', source, aliases, {
        preview: true,
        encodings,
      }),
      'preview.webp',
    );
    const webp = await readFile(join(output, 'preview.webp'));
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
    assert.equal(encodings[0].quality, 90);
    assert.equal(encodings[0].encoder, 'Pillow 11.1.0');
    assert.equal(encodings[0].width, 64);
    assert.equal(encodings[0].height, 32);
    assert.equal(encodings[0].sourceSha256, original);
    assert.equal(encodings[0].sha256, hash(webp));
    assert.equal(encodings[0].pixelsVerifiedIdentical, false);
    assert.equal(
      await writeScreenshot(output, 'duplicate.png', source, aliases, {
        preview: true,
        encodings,
      }),
      'preview.webp',
    );
    assert.equal(aliases[0].sha256, hash(webp));
    assert.equal(aliases[0].bytesSaved, webp.length);
    assert.equal(encodings.length, 1);
    assert.deepEqual(await readFile(join(output, 'key.png')), source);
    assert.deepEqual(await readFile(join(output, 'failure.png')), source);
    assert.equal(hash(source), original);
    const other = join(output, 'other');
    assert.equal(
      await writeScreenshot(other, 'process/temporary.png', source, [], {
        encodings,
      }),
      'process/temporary.webp',
    );
    assert.equal(
      await writeScreenshot(other, 'permanent.png', source, [], {
        preview: true,
      }),
      'permanent.webp',
    );
    await assert.rejects(
      writeScreenshot(other, 'process/failure.png', source),
      /Critical/,
    );
    await assert.rejects(
      writeScreenshot(output, 'broken.png', Buffer.from('invalid'), [], {
        preview: true,
      }),
      /encoding failed/,
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('selection retains explicit zoom/DPI and failure boundaries, omitting extra captures before rendering', () => {
  const policy = new ScreenshotPolicy('representative');
  const options = {
    group: 'room',
    role: 'host',
    boundary: 'short',
    layout: true,
  };
  assert.equal(policy.path('short.png', options), 'short.png');
  assert.equal(policy.path('same.png', options), null);
  assert.equal(policy.path('zoom.png', { ...options, zoom: 1.25 }), 'zoom.png');
  assert.equal(policy.path('dpi.png', { ...options, dpi: 1.5 }), 'dpi.png');
  assert.equal(policy.path('extra.png', { boundary: null }), null);
  assert.equal(
    policy.path('failure.png', { boundary: null, failure: true }),
    'failure.png',
  );
  assert.equal(
    policy.path('critical.png', { boundary: null, mustKeep: true }),
    'critical.png',
  );
  assert.equal(policy.skipped, 2);
  assert.equal(
    new ScreenshotPolicy('all').path('extra.png', { boundary: null }),
    'process/extra.png',
  );
});

test('encoder rejects a wrong working directory before producing preview bytes', () => {
  const result = spawnSync(
    process.env.TABLEMAX_PYTHON || 'python',
    [resolve('tools/assets/images/encode-preview.py')],
    {
      cwd: resolve('tools'),
      windowsHide: true,
      input: png(),
      encoding: 'buffer',
    },
  );
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout.length, 0);
  assert.match(result.stderr.toString(), /repository root/);
});

test('overwritten representatives cannot produce stale screenshot aliases', async () => {
  const output = await mkdtemp(join(tmpdir(), 'tablemax-alias-'));
  try {
    const aliases = [];
    await writeScreenshot(output, 'same.png', Buffer.from('original'), aliases);
    await writeScreenshot(
      output,
      'same.png',
      Buffer.from('replacement'),
      aliases,
    );
    assert.equal(
      await writeScreenshot(
        output,
        'copy.png',
        Buffer.from('original'),
        aliases,
      ),
      'copy.png',
    );
    assert.equal(aliases.length, 0);
    assert.equal(
      (await readFile(join(output, 'copy.png'))).toString(),
      'original',
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});

test('an early encoder stdin closure preserves its process diagnostics', async () => {
  const output = await mkdtemp(join(tmpdir(), 'tablemax-encoder-error-'));
  const previous = process.env.TABLEMAX_PYTHON;
  try {
    process.env.TABLEMAX_PYTHON = process.execPath;
    await assert.rejects(
      writeScreenshot(
        output,
        'preview.png',
        Buffer.concat([png(), Buffer.alloc(400000)]),
        [],
        { preview: true },
      ),
      /encoding failed \(exit .+\):[\s\S]+(?:SyntaxError|ERR_UNKNOWN_FILE_EXTENSION)/,
    );
  } finally {
    if (previous === undefined) delete process.env.TABLEMAX_PYTHON;
    else process.env.TABLEMAX_PYTHON = previous;
    await rm(output, { recursive: true, force: true });
  }
});
