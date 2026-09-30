import './build.mjs';
import { build } from 'electron-builder';
import { resolve } from 'node:path';

process.env.ELECTRON_CACHE = resolve('.cache/electron');
process.env.ELECTRON_BUILDER_CACHE = resolve('.cache/electron-builder');
await build({
  projectDir: resolve('build/desktop'),
  config: {
    extends: resolve('electron-builder.yml'),
    electronDist: resolve('node_modules/electron/dist'),
  },
});
