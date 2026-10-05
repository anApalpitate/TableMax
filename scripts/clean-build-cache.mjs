import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  stat,
  lstat,
  rm,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { assertIdle } from './assemble.mjs';
import { lock, validateCached } from './module-build.mjs';
const base = resolve('.cache/build-modules/v1');
await lock('build-cache-maintenance', async () => {
  await assertIdle();
  for (const entry of await readdir(base))
    if (entry.endsWith('.lock')) {
      const owner = JSON.parse(await readFile(join(base, entry), 'utf8'));
      if (owner.pid !== process.pid)
        throw new Error('Active or unresolved cache lock: ' + owner.name);
    }
  const retained = new Set();
  const retain = (units) => {
    for (const unit of units ?? [])
      retained.add(unit.id + '/' + unit.fingerprint);
  };
  const latest = JSON.parse(
    await readFile(resolve('build/snapshots/latest.json'), 'utf8'),
  );
  retain(JSON.parse(await readFile(latest.snapshotPath, 'utf8')).units);
  const project = JSON.parse(await readFile('package.json', 'utf8'));
  try {
    retain(
      JSON.parse(
        await readFile(
          resolve(
            `artifacts/releases/TableMax-${project.version}-win-x64-manifest.json`,
          ),
          'utf8',
        ),
      ).units,
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const candidates = [];
  for (const unit of await readdir(base, { withFileTypes: true })) {
    if (!unit.isDirectory() || unit.name === 'work') continue;
    const successes = [];
    for (const key of await readdir(join(base, unit.name), {
      withFileTypes: true,
    }))
      if (key.isDirectory() && /^[a-f0-9]{64}$/.test(key.name)) {
        const path = join(base, unit.name, key.name);
        const info = await stat(join(path, 'manifest.json'));
        successes.push({
          path,
          key: unit.name + '/' + key.name,
          mtime: info.mtimeMs,
        });
      }
    successes.sort((a, b) => b.mtime - a.mtime);
    for (const item of successes.slice(0, 2)) retained.add(item.key);
    for (const item of successes)
      if (!retained.has(item.key) && Date.now() - item.mtime > 30 * 60000) {
        if ((await lstat(item.path)).isSymbolicLink())
          throw new Error('Linked cache directory rejected');
        const manifest = await validateCached(item.path);
        candidates.push({
          ...item,
          files: manifest.files,
          bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0),
        });
      }
  }
  const report = {
    mode: process.argv.includes('--apply') ? 'apply' : 'preview',
    retention:
      'Current development snapshot, current release units, active locks/work and two latest successful products per unit. 30-minute protection.',
    retained: [...retained],
    candidates: [],
  };
  for (const item of candidates) {
    let result = 'preview';
    if (process.argv.includes('--apply')) {
      await assertIdle();
      if (
        !item.path.startsWith(base + '\\') &&
        !item.path.startsWith(base + '/')
      )
        throw new Error('Cache path outside root');
      if ((await lstat(item.path)).isSymbolicLink())
        throw new Error('Linked cache directory rejected');
      const current = await validateCached(item.path);
      if (
        JSON.stringify(current.files) !== JSON.stringify(item.files) ||
        (await stat(join(item.path, 'manifest.json'))).mtimeMs !== item.mtime
      )
        throw new Error('Cache changed during cleanup');
      await rm(item.path, { recursive: true });
      result = 'removed';
    }
    report.candidates.push({ ...item, result });
  }
  const output = resolve(
    'artifacts/maintenance/v1.0.4/incremental-build-20261005/cache-cleanup',
  );
  await mkdir(output, { recursive: true });
  await writeFile(
    join(output, Date.now() + '-' + report.mode + '.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      mode: report.mode,
      candidates: report.candidates.length,
      bytes: report.candidates.reduce((sum, item) => sum + item.bytes, 0),
    }),
  );
});
