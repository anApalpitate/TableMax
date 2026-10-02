import './build.mjs';
import { build } from 'electron-builder';
import { resolve } from 'node:path';
import { copyFile, mkdir, mkdtemp, readFile } from 'node:fs/promises';

process.env.ELECTRON_CACHE = resolve('.cache/electron');
process.env.ELECTRON_BUILDER_CACHE = resolve('.cache/electron-builder');
const project = JSON.parse(await readFile('package.json', 'utf8'));
const releases = resolve('artifacts/releases');
await mkdir(releases, { recursive: true });
// A user may be playing the previous unpacked build. Each packaging run owns
// its output directory; publish the ZIP only after the build has succeeded.
const output = await mkdtemp(resolve(releases, `package-${project.version}-`));
await build({
  projectDir: resolve('build/desktop'),
  config: {
    extends: resolve('electron-builder.yml'),
    electronDist: resolve('node_modules/electron/dist'),
    directories: { output },
  },
});
const archive = `TableMax-${project.version}-win-x64.zip`;
await copyFile(resolve(output, archive), resolve(releases, archive));
console.log(`Release ZIP: ${resolve(releases, archive)}`);
