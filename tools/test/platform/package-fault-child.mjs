// Filesystem injection is confined to this process and its private fixture root.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, relative, resolve, sep } from 'node:path';
import { sha256 } from '../../release/game-package-format.mjs';

const [fixturePath, rootArgument, mode, specArgument = '{}'] =
  process.argv.slice(2);
const root = resolve(rootArgument);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const spec = JSON.parse(specArgument);
const originals = Object.fromEntries(
  [
    'mkdirSync',
    'writeFileSync',
    'openSync',
    'fsyncSync',
    'closeSync',
    'renameSync',
    'rmSync',
  ].map((name) => [name, fs[name]]),
);
const descriptors = new Map();
const events = [];
const occurrences = new Map();
let armed = false;
let reached = false;
let indexCommitted = false;

function local(value) {
  const path = typeof value === 'number' ? descriptors.get(value) : value;
  if (typeof path !== 'string') return undefined;
  const absolute = resolve(path);
  if (absolute !== root && !absolute.startsWith(root + sep)) return undefined;
  return absolute;
}
function label(path) {
  return relative(root, path)
    .replaceAll('\\', '/')
    .replace(/\.staging\/[a-f0-9-]+/g, '.staging/<txn>')
    .replace(/\.transactions\/[a-f0-9-]+\.json/g, '.transactions/<txn>.json')
    .replace(/\.[a-f0-9-]+\.tmp/g, '.<atomic>.tmp');
}
function interrupt(event, when) {
  reached = true;
  const reachedEvent = { ...event, when, indexCommitted };
  if (spec.action === 'kill') {
    process.send({
      type: 'fault-reached',
      event: reachedEvent,
      pid: process.pid,
    });
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
    throw new Error('unexpected-unblock');
  }
  throw Object.assign(
    new Error(`injected-io-failure:${event.operation}:${when}`),
    { code: 'EIO' },
  );
}
for (const [name, original] of Object.entries(originals)) {
  fs[name] = function (...args) {
    const first = local(args[0]);
    const second = name === 'renameSync' ? local(args[1]) : undefined;
    // readFileSync also calls exported open/close functions. Read handles are
    // deliberately excluded: this matrix targets installation mutations.
    const scoped =
      (first !== undefined || second !== undefined) &&
      (name !== 'openSync' || /[wa+]/.test(String(args[1])));
    let event;
    if (armed && scoped) {
      event = {
        ordinal: events.length,
        operation: name,
        ...(first ? { path: label(first) } : {}),
        ...(second ? { target: label(second) } : {}),
      };
      events.push(event);
      const location = JSON.stringify({
        operation: event.operation,
        path: event.path,
        target: event.target,
      });
      const occurrence = occurrences.get(location) ?? 0;
      occurrences.set(location, occurrence + 1);
      event.matchesFault =
        spec.event &&
        event.operation === spec.event.operation &&
        event.path === spec.event.path &&
        event.target === spec.event.target &&
        occurrence === (spec.occurrence ?? 0);
      if (!reached && event.matchesFault) {
        if (spec.when === 'before') interrupt(event, 'before');
        if (spec.when === 'partial') {
          assert.equal(name, 'writeFileSync');
          const bytes = Buffer.isBuffer(args[1])
            ? args[1]
            : Buffer.from(args[1]);
          original(
            args[0],
            bytes.subarray(0, Math.max(1, Math.floor(bytes.length / 2))),
            args[2],
          );
          interrupt(event, 'partial');
        }
      }
    }
    const result = original(...args);
    if (name === 'openSync' && scoped)
      descriptors.set(result, resolve(args[0]));
    if (name === 'renameSync' && second === join(root, 'index.json') && armed)
      indexCommitted = true;
    if (event && !reached && event.matchesFault && spec.when === 'after')
      interrupt(event, 'after');
    if (name === 'closeSync') descriptors.delete(args[0]);
    return result;
  };
}
syncBuiltinESMExports();
const { PackageStore } =
  await import('../../../apps/server/src/game-packages/store.ts');
const networkScenario =
  mode === 'recover' ? 'normal' : (spec.network ?? 'normal');
let transferred = 0;
let requests = 0;
const store = new PackageStore({
  root,
  publicKey: fixture.publicKey,
  protectedReleaseIds: () => [fixture.oldRef],
  assetUrl: (blob) =>
    `${fixture.url}/${armed ? networkScenario : 'normal'}/${blob.id}`,
  fetch: (...args) => {
    requests++;
    return globalThis.fetch(...args);
  },
});

function preserved() {
  for (const blob of fixture.oldBlobs) {
    for (const file of blob.files) {
      const path = join(root, 'uno', 'blobs', blob.id, file.path);
      assert.equal(
        sha256(fs.readFileSync(path)),
        file.sha256,
        'Old installed bytes changed',
      );
    }
  }
  assert.equal(
    sha256(fs.readFileSync(join(root, 'save-sentinel.json'))),
    fixture.saveSha256,
  );
  assert.ok(
    store.resolveModule(fixture.oldRef),
    'Protected old release must remain available',
  );
}

try {
  if (mode === 'recover') {
    preserved();
    const selectedBefore = store.selected('uno')?.releaseId;
    assert.equal(
      selectedBefore,
      spec.committed ? fixture.newRef : fixture.oldRef,
    );
    assert.deepEqual(fs.readdirSync(join(root, '.transactions')), []);
    if (selectedBefore === fixture.newRef)
      assert.ok(store.resolveModule(fixture.newRef));
    // Signed-malformed archive cases persisted their deliberately bad descriptor.
    // Repair retries must refresh the valid signed catalog as well as the bytes.
    store.setCatalog(fixture.envelope);
    await store.install(fixture.newRef);
    preserved();
    assert.equal(store.selected('uno')?.releaseId, fixture.newRef);
    assert.ok(store.resolveModule(fixture.newRef));
    const before = requests;
    await store.install(fixture.newRef);
    assert.equal(
      requests,
      before,
      'Already installed immutable bytes must not be downloaded again',
    );
    process.send({
      type: 'recovered',
      selectedBefore,
      selectedAfter: fixture.newRef,
      oldBytesPreserved: true,
      savePreserved: true,
    });
  } else {
    store.setCatalog(fixture.envelope);
    await store.install(fixture.oldRef);
    fs.writeFileSync(join(root, 'save-sentinel.json'), fixture.saveBytes);
    const phases = [];
    let cancelled = false;
    store.subscribe(() => {
      if (!armed) return;
      const task = store
        .snapshot()
        .tasks.find((item) => item.releaseId === fixture.newRef);
      if (!task) return;
      phases.push({
        phase: task.phase,
        transferredBytes: task.transferredBytes,
        error: task.error,
      });
      transferred = Math.max(transferred, task.transferredBytes);
      if (
        task.transferredBytes > 0 &&
        !cancelled &&
        ['cancel', 'kill-download'].includes(spec.action)
      ) {
        cancelled = true;
        if (spec.action === 'cancel') store.cancel(fixture.newRef);
        else {
          process.send({
            type: 'fault-reached',
            event: { operation: 'download', indexCommitted: false },
            pid: process.pid,
          });
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
        }
      }
    });
    if (spec.network?.startsWith('signed-'))
      store.setCatalog(fixture.envelopes[spec.network]);
    if (spec.network === 'signature') {
      assert.throws(
        () => store.setCatalog({ ...fixture.envelope, signature: 'AA==' }),
        /invalid-catalog-signature/,
      );
      preserved();
      process.send({
        type: 'completed',
        indexCommitted: false,
        signatureRejected: true,
      });
    } else {
      armed = true;
      let installError;
      try {
        await store.install(fixture.newRef);
      } catch (error) {
        installError = error.message;
      }
      armed = false;
      if (mode !== 'trace') {
        assert.ok(installError, 'Fault scenario must reject the install');
        if (spec.ordinal !== undefined)
          assert.equal(
            reached,
            true,
            `The intended operation was not reached: ${installError}; observed ${JSON.stringify(events.slice(-5))}`,
          );
        if (spec.expectedError)
          assert.match(installError, new RegExp(spec.expectedError));
        if (spec.network)
          assert.ok(
            phases.some((phase) =>
              ['failed', 'cancelled'].includes(phase.phase),
            ),
            'Visible error or cancellation is required',
          );
      } else assert.equal(installError, undefined);
      preserved();
      process.send({
        type: 'completed',
        events,
        indexCommitted,
        installError,
        phases,
        transferredBytes: transferred,
      });
    }
  }
} catch (error) {
  process.send({ type: 'error', error: error.stack ?? String(error) });
  process.exitCode = 1;
} finally {
  armed = false;
  process.disconnect();
}
