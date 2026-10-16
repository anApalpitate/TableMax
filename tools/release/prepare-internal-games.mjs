import assert from 'node:assert/strict';
import { readFile, mkdtemp, lstat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { packageGames, verifyRetainedGameSnapshot } from './game-packages.mjs';

/** A same-content catalog can only be returned under its actual public tag. */
export async function canReuseInternalGames(snapshot, priorDirectory, prior) {
  const units = snapshot.units.filter((unit) => unit.id.startsWith('game-'));
  const releaseTag = 'v' + snapshot.version;
  let equal =
    prior?.releaseTag === releaseTag && prior.units.length === units.length;
  if (equal) {
    for (const unit of units) {
      const old = prior.units.find((item) => item.id === unit.id);
      if (!old) {
        equal = false;
        break;
      }
      try {
        const manifest = JSON.parse(
          await readFile(join(old.directory, 'manifest.json'), 'utf8'),
        );
        if (JSON.stringify(manifest.files) !== JSON.stringify(unit.files))
          equal = false;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        equal = false;
      }
      if (!equal) break;
    }
  }
  if (!equal) return false;
  const catalog = await lstat(
    join(priorDirectory, `TableMax-game-catalog-${releaseTag}.json`),
  ).catch((error) => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (!catalog) return false;
  assert.ok(
    catalog.isFile() && !catalog.isSymbolicLink(),
    'Invalid reusable catalog',
  );
  return true;
}

/** Reuse signed bytes only when every game unit equals the frozen build. */
export async function prepareInternalGames(
  snapshot,
  priorDirectory,
  payloadRoot,
) {
  if (snapshot.retainedGameSnapshot) await verifyRetainedGameSnapshot(snapshot);
  let prior;
  try {
    prior = JSON.parse(
      await readFile(join(priorDirectory, 'build-record.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (await canReuseInternalGames(snapshot, priorDirectory, prior))
    return priorDirectory;
  const directory = await mkdtemp(join(payloadRoot, 'internal-games-'));
  await packageGames({
    out: directory,
    snapshot,
    releaseTag: 'v' + snapshot.version,
    keyPath:
      process.env.TABLEMAX_GAME_SIGNING_KEY ??
      resolve('secrets/game-release-ed25519.pem'),
    history: prior ? [priorDirectory] : [],
  });
  return directory;
}
