import { readFile, mkdtemp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { packageGames } from './game-packages.mjs';

/** Reuse signed bytes only when every game unit equals the frozen build. */
export async function prepareInternalGames(
  snapshot,
  priorDirectory,
  payloadRoot,
) {
  const units = snapshot.units.filter((unit) => unit.id.startsWith('game-'));
  let prior;
  try {
    prior = JSON.parse(
      await readFile(join(priorDirectory, 'build-record.json'), 'utf8'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let equal = prior?.units.length === units.length;
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
  if (equal) return priorDirectory;
  const directory = await mkdtemp(join(payloadRoot, 'internal-games-'));
  await packageGames({
    out: directory,
    snapshot,
    keyPath:
      process.env.TABLEMAX_GAME_SIGNING_KEY ??
      resolve('secrets/game-release-ed25519.pem'),
    history: prior ? [priorDirectory] : [],
  });
  return directory;
}
