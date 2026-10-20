import { readFile, writeFile, open, unlink, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

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
async function withVersionLock(root, operation) {
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
    return await operation();
  } finally {
    await handle.close();
    await unlink(lockPath);
  }
}
const stateHash = (bytes) => createHash('sha256').update(bytes).digest('hex');
function validateSession(sessionId) {
  if (
    typeof sessionId !== 'string' ||
    !sessionId.trim() ||
    sessionId.length > 128 ||
    /[\x00-\x1f\x7f]/.test(sessionId)
  )
    throw new Error('Invalid delivery session');
}
async function readReservation(root) {
  try {
    const value = JSON.parse(
      await readFile(resolve(root, 'build-version.reservation.json'), 'utf8'),
    );
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Invalid delivery reservation');
    return value;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function validateReservation(reservation, sessionId, root) {
  validateSession(sessionId);
  if (
    reservation.sessionId !== sessionId ||
    !Number.isInteger(reservation.baseRevision) ||
    reservation.baseRevision < 0 ||
    reservation.revision !== reservation.baseRevision + 1
  )
    throw new Error('Pending delivery reservation conflicts with this session');
  const expected = versionIdentity(
    reservation.releaseVersion,
    reservation.revision,
  );
  const current = await applicationVersion(root);
  const bytes = await readFile(resolve(root, 'build-version.json'));
  if (
    current.buildVersion !== expected.buildVersion ||
    stateHash(bytes) !== reservation.stateSha256
  )
    throw new Error('Pending delivery reservation inputs changed');
  return expected;
}
/** Session reservations reuse a revision until explicitly confirmed after acceptance. */
export async function allocateBuildVersion(
  root = resolve('.'),
  { sessionId = process.env.TABLEMAX_DELIVERY_SESSION } = {},
) {
  if (sessionId !== undefined) validateSession(sessionId);
  return withVersionLock(root, async () => {
    const reservation = await readReservation(root);
    if (reservation) {
      if (sessionId === undefined)
        throw new Error('A delivery session reservation is pending');
      return validateReservation(reservation, sessionId, root);
    }
    const current = await applicationVersion(root);
    const next = versionIdentity(current.releaseVersion, current.revision + 1);
    const path = resolve(root, 'build-version.json');
    const bytes =
      JSON.stringify(
        { releaseVersion: next.releaseVersion, revision: next.revision },
        null,
        2,
      ) + '\n';
    // Reserve first: interrupted writes remain blocked rather than consuming another number.
    if (sessionId !== undefined)
      await writeFile(
        resolve(root, 'build-version.reservation.json'),
        JSON.stringify({
          sessionId,
          baseRevision: current.revision,
          releaseVersion: next.releaseVersion,
          revision: next.revision,
          stateSha256: stateHash(bytes),
        }) + '\n',
        { flag: 'wx' },
      );
    await writeFile(path + '.next', bytes);
    await rename(path + '.next', path);
    return next;
  });
}
export async function confirmBuildVersion(
  { sessionId, buildVersion },
  root = resolve('.'),
) {
  validateSession(sessionId);
  return withVersionLock(root, async () => {
    const reservation = await readReservation(root);
    if (!reservation) throw new Error('No delivery reservation to confirm');
    const identity = await validateReservation(reservation, sessionId, root);
    if (buildVersion !== identity.buildVersion)
      throw new Error(
        'Delivery confirmation version does not match reservation',
      );
    await unlink(resolve(root, 'build-version.reservation.json'));
    return identity;
  });
}
