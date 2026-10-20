import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
  symlink,
  rename,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { createDevelopmentSession } from './session.mjs';

async function fixture(t) {
  await mkdir(resolve('tmp'), { recursive: true });
  const root = await mkdtemp(resolve('tmp/dev-session-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test('each startup isolates old room, browser and configured external data', async (t) => {
  const root = await fixture(t);
  const box = join(root, 'box');
  const external = join(root, 'formal-data');
  await mkdir(box);
  await mkdir(external);
  const historical = {
    'TableMax.config.json': JSON.stringify({ dataDirectory: external }),
    'tablemax.sqlite': 'old room and identities',
    'profile.json': 'old browser state',
  };
  for (const [name, value] of Object.entries(historical))
    await writeFile(join(box, name), value);
  await writeFile(join(external, 'save'), 'formal save');
  const env = {
    TABLEMAX_BOX_DIRECTORY: box,
    TABLEMAX_DATA_DIR: external,
    TABLEMAX_HOST: '127.0.0.1',
  };
  const first = await createDevelopmentSession(env);
  assert.notEqual(first.directory, box);
  assert.notEqual(first.directory, external);
  assert.equal(first.env.TABLEMAX_BOX_DIRECTORY, first.directory);
  assert.equal(first.env.TABLEMAX_DATA_DIR, first.directory);
  assert.equal(first.env.TABLEMAX_HOST, '127.0.0.1');
  await writeFile(
    join(first.directory, 'tablemax.sqlite'),
    'previous development game',
  );
  await mkdir(join(first.directory, 'desktop/webview2'), { recursive: true });
  await writeFile(
    join(first.directory, 'desktop/webview2/Local State'),
    'previous browser',
  );
  // Even a still-existing/crashed session is never selected on the next launch.
  const second = await createDevelopmentSession(env);
  assert.notEqual(second.directory, first.directory);
  assert.deepEqual(await readdir(second.directory), [
    '.tablemax-dev-session.json',
  ]);
  await first.dispose();
  assert.ok(
    (await readdir(join(box, 'sessions'))).includes(
      second.directory.split(/[\\/]/).at(-1),
    ),
  );
  await second.dispose();
  await second.dispose();
  assert.deepEqual(await readdir(join(box, 'sessions')), []);
  for (const [name, value] of Object.entries(historical))
    assert.equal(await readFile(join(box, name), 'utf8'), value);
  assert.equal(await readFile(join(external, 'save'), 'utf8'), 'formal save');
  assert.equal(env.TABLEMAX_DATA_DIR, external);
});

test('cleanup refuses a session whose ownership marker has changed', async (t) => {
  const root = await fixture(t);
  const session = await createDevelopmentSession({
    TABLEMAX_BOX_DIRECTORY: root,
  });
  await writeFile(
    join(session.directory, '.tablemax-dev-session.json'),
    'someone else',
  );
  await writeFile(join(session.directory, 'save'), 'preserve');
  await assert.rejects(session.dispose(), /ownership changed/);
  assert.equal(
    await readFile(join(session.directory, 'save'), 'utf8'),
    'preserve',
  );
});

test('cleanup refuses a directory replaced by a junction to other saves', async (t) => {
  const root = await fixture(t);
  const session = await createDevelopmentSession({
    TABLEMAX_BOX_DIRECTORY: root,
  });
  const original = join(root, 'original');
  const other = join(root, 'other');
  await mkdir(other);
  await writeFile(join(other, 'save'), 'preserve');
  await rename(session.directory, original);
  await symlink(
    other,
    session.directory,
    process.platform === 'win32' ? 'junction' : 'dir',
  );
  await assert.rejects(session.dispose(), /ownership changed/);
  assert.equal(await readFile(join(other, 'save'), 'utf8'), 'preserve');
});

test('default sessions live below the dedicated development cache', async () => {
  const session = await createDevelopmentSession({});
  try {
    assert.equal(
      dirname(session.directory),
      resolve('.cache/development/sessions'),
    );
  } finally {
    await session.dispose();
  }
});
