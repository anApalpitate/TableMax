import { randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  lstat,
  readFile,
  realpath,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

// Only newly created development sessions are disposable. Never reset a caller's
// configured box/data directory, which can also contain real saved games.
export async function createDevelopmentSession(env = process.env) {
  const base = resolve(env.TABLEMAX_BOX_DIRECTORY ?? '.cache/development');
  const sessions = join(base, 'sessions');
  await mkdir(sessions, { recursive: true });
  const parent = await realpath(sessions);
  const directory = await mkdtemp(join(parent, 'session-'));
  const marker = join(directory, '.tablemax-dev-session.json');
  const identity = JSON.stringify({
    kind: 'disposable-development-session',
    id: randomUUID(),
  });
  await writeFile(marker, identity, { flag: 'wx' });
  let disposed = false;
  return {
    directory,
    env: {
      ...env,
      TABLEMAX_BOX_DIRECTORY: directory,
      // Override inherited data/config paths as well as the WebView2 profile.
      TABLEMAX_DATA_DIR: directory,
    },
    async dispose() {
      if (disposed) return;
      const info = await lstat(directory);
      if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        dirname(directory) !== parent ||
        (await realpath(directory)) !== directory ||
        (await readFile(marker, 'utf8')) !== identity
      )
        throw new Error(
          'Development session ownership changed; refusing cleanup: ' +
            directory,
        );
      await rm(directory, { recursive: true, maxRetries: 4, retryDelay: 250 });
      disposed = true;
    },
  };
}
