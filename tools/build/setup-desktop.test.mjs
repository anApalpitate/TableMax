import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

async function fixture(t) {
  await mkdir('tmp', { recursive: true });
  const root = await mkdtemp(resolve('tmp/setup-desktop-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, "source with 'quote");
  const runtime = join(root, "runtime with 'quote");
  const archive = join(root, "archive with 'quote.zip");
  const contents = {
    'node.exe': Buffer.from([0x4d, 0x5a, 0, 1, 2, 3, 255]),
    LICENSE: Buffer.from('small locked runtime fixture\r\n'),
  };
  const directory = join(source, 'node-v22.14.0-win-x64');
  await mkdir(directory, { recursive: true });
  await mkdir(runtime);
  for (const [name, bytes] of Object.entries(contents))
    await writeFile(join(directory, name), bytes);
  const script =
    '$ErrorActionPreference="Stop"; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; ' +
    '$taskZip = [IO.Compression.ZipFile]::Open($env:TABLEMAX_TEST_ARCHIVE, [IO.Compression.ZipArchiveMode]::Create); try { ' +
    'foreach ($taskName in @("node.exe", "LICENSE")) { ' +
    '$taskEntry = $taskZip.CreateEntry("node-v22.14.0-win-x64/" + $taskName); ' +
    '$taskStream = $taskEntry.Open(); try { ' +
    '$taskBytes = [IO.File]::ReadAllBytes((Join-Path $env:TABLEMAX_TEST_SOURCE ("node-v22.14.0-win-x64/" + $taskName))); ' +
    '$taskStream.Write($taskBytes, 0, $taskBytes.Length) ' +
    '} finally { $taskStream.Dispose() } } } finally { $taskZip.Dispose() }';
  const zipped = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64'),
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 15_000,
      env: {
        ...process.env,
        TABLEMAX_TEST_SOURCE: source,
        TABLEMAX_TEST_ARCHIVE: archive,
      },
    },
  );
  assert.equal(zipped.status, 0, zipped.stderr?.toString());
  return { archive, runtime, contents };
}

async function withOpenParentInput(fixture, extract) {
  const script = `
    import {extractNodeRuntimeArchive,verifyNodeRuntimeArchive} from ${JSON.stringify(new URL('./setup-desktop.mjs', import.meta.url).href)};
    if (process.env.TABLEMAX_TEST_EXTRACT === '1')
      await extractNodeRuntimeArchive(process.env.TABLEMAX_TEST_ARCHIVE,process.env.TABLEMAX_TEST_RUNTIME);
    await verifyNodeRuntimeArchive(process.env.TABLEMAX_TEST_ARCHIVE,process.env.TABLEMAX_TEST_RUNTIME);
    console.log('verified-small-runtime');
  `;
  const child = spawn(process.execPath, ['--input-type=module', '-e', script], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    timeout: 20_000,
    env: {
      ...process.env,
      TABLEMAX_TEST_ARCHIVE: fixture.archive,
      TABLEMAX_TEST_RUNTIME: fixture.runtime,
      TABLEMAX_TEST_EXTRACT: extract ? '1' : '0',
    },
  });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (bytes) => (stdout += bytes));
  child.stderr.on('data', (bytes) => (stderr += bytes));
  try {
    const result = await new Promise((done, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => done({ code, signal }));
    });
    // Keep the foundation-style input pipe open throughout archive work.
    assert.equal(child.stdin.writableEnded, false);
    assert.equal(result.signal, null, stderr);
    return { ...result, stdout, stderr };
  } finally {
    child.stdin.destroy();
  }
}

test(
  'real ZIP extraction and cache verification finish while parent stdin stays open',
  {
    skip: process.platform !== 'win32',
    timeout: 40_000,
  },
  async (t) => {
    const data = await fixture(t);
    const result = await withOpenParentInput(data, true);
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /verified-small-runtime/);
    for (const [name, bytes] of Object.entries(data.contents))
      assert.deepEqual(await readFile(join(data.runtime, name)), bytes);
  },
);

test(
  'real ZIP cache verification rejects modified bytes while parent stdin stays open',
  {
    skip: process.platform !== 'win32',
    timeout: 40_000,
  },
  async (t) => {
    const data = await fixture(t);
    for (const [name, bytes] of Object.entries(data.contents))
      await writeFile(join(data.runtime, name), bytes);
    await writeFile(join(data.runtime, 'node.exe'), 'tampered runtime bytes');
    const result = await withOpenParentInput(data, false);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, /Cached runtime hash mismatch: node.exe/);
    assert.doesNotMatch(result.stdout, /verified-small-runtime/);
    assert.equal(
      await readFile(join(data.runtime, 'node.exe'), 'utf8'),
      'tampered runtime bytes',
    );
  },
);
