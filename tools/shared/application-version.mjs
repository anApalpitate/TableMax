import { readFile, writeFile, open, unlink, rename } from 'node:fs/promises';
import { resolve } from 'node:path';

export function versionIdentity(releaseVersion, revision = 0) {
  if (
    !/^1\.\d+\.\d+$/.test(releaseVersion) ||
    releaseVersion.split('.').some((n) => Number(n) > 65534) ||
    !Number.isInteger(revision) ||
    revision < 0 ||
    revision > 65534
  )
    throw new Error('Invalid application version');
  return {
    releaseVersion,
    revision,
    buildVersion: `${releaseVersion}.${revision}`,
  };
}
export async function applicationVersion(root = resolve('.')) {
  const project = JSON.parse(
    await readFile(resolve(root, 'package.json'), 'utf8'),
  );
  const state = JSON.parse(
    await readFile(resolve(root, 'build-version.json'), 'utf8'),
  );
  versionIdentity(state.releaseVersion, state.revision);
  return versionIdentity(
    project.version,
    state.releaseVersion === project.version ? state.revision : 0,
  );
}
/** Allocate once for a new delivery; consumed failed build numbers are never reused. */
export async function allocateBuildVersion(root = resolve('.')) {
  const lockPath = resolve(root, 'build-version.lock');
  let handle;
  const deadline = Date.now() + 30000;
  while (!handle) {
    try {
      handle = await open(lockPath, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST' || Date.now() >= deadline) throw error;
      await new Promise((done) => setTimeout(done, 50));
    }
  }
  try {
    const current = await applicationVersion(root);
    const next = versionIdentity(current.releaseVersion, current.revision + 1);
    const path = resolve(root, 'build-version.json');
    await writeFile(
      path + '.next',
      JSON.stringify(
        { releaseVersion: next.releaseVersion, revision: next.revision },
        null,
        2,
      ) + '\n',
    );
    await rename(path + '.next', path);
    return next;
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}
