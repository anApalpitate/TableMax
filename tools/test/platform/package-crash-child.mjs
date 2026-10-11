import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PackageStore } from '../../../apps/server/src/game-packages/store.ts';

const [fixtureFile, root, mode, phase] = process.argv.slice(2);
const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
let armed = false;
const store = new PackageStore({
  root,
  publicKey: fixture.publicKey,
  protectedReleaseIds: () => [],
  assetUrl: (blob) => `https://fixture.invalid/${blob.id}`,
  fetch: async (url) => {
    const id = String(url).split('/').at(-1);
    return new Response(new Uint8Array(readFileSync(fixture.archives[id])));
  },
  fault: (at) => {
    if (armed && at === phase) {
      process.send({ type: 'fault-reached', phase: at, pid: process.pid });
      // The hook must not throw/return: neither catch nor finally may clean up.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
      throw new Error('unexpected-unblock');
    }
  },
});
store.setCatalog(fixture.envelope);
if (mode === 'crash') {
  await store.install(fixture.oldRef);
  armed = true;
  await store.install(fixture.newRef);
  throw new Error('fault-hook-not-reached');
}
const selectedBefore = store.selected('uno')?.releaseId;
const oldResolved = Boolean(store.resolveModule(fixture.oldRef));
const journalsAfterRecovery = readdirSync(join(root, '.transactions'));
await store.install(fixture.newRef);
process.send({
  type: 'recovered',
  selectedBefore,
  oldResolved,
  journalsAfterRecovery,
  selectedAfter: store.selected('uno')?.releaseId,
  newResolved: Boolean(store.resolveModule(fixture.newRef)),
});
process.disconnect();
