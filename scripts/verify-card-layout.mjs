import assert from 'node:assert/strict';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { _electron } from 'playwright';
import { build } from 'vite';
import react from '@vitejs/plugin-react';
const require = createRequire(import.meta.url);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/card-layout-'));
const output = resolve('artifacts/maintenance/pokemon-refresh/cards');
await mkdir(output, { recursive: true });
const relativeRoot = '../..';
await writeFile(
  join(work, 'index.html'),
  '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"></head><body><div id="root"></div><script type="module" src="/cards.tsx"></script></body></html>',
);
await writeFile(
  join(work, 'cards.tsx'),
  `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {CardFace} from '${relativeRoot}/games/pokemon-encounters/ui/cards';
import {categories} from '${relativeRoot}/games/pokemon-encounters/rules/cards';
import '${relativeRoot}/apps/web/src/styles.css';
import '${relativeRoot}/games/pokemon-encounters/ui/style.css';
const width = Number(new URLSearchParams(location.search).get('width') || 90);
createRoot(document.getElementById('root')!).render(<main style={{padding:20}}>
<h1 style={{fontSize:22}}>16 类卡面 · {width}px</h1>
<div style={{display:'grid', gridTemplateColumns:'repeat(8, '+width+'px)', gap:12}}>
{categories.map(c => <CardFace key={c.categoryId} card={{categoryId:c.categoryId,name:c.displayName,value:c.value.kind === 'fixed' ? c.value.number! : null,ability:c.abilityDefinition?.adoptedText ?? null}}/>)}</div></main>);
`,
);
await build({
  root: work,
  base: './',
  configFile: false,
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^react(?=\/|$)/,
        replacement: resolve('apps/web/node_modules/react'),
      },
      {
        find: /^react-dom(?=\/|$)/,
        replacement: resolve('apps/web/node_modules/react-dom'),
      },
    ],
  },
  build: { outDir: join(work, 'dist'), emptyOutDir: true },
  logLevel: 'warn',
});
await writeFile(
  join(work, 'main.cjs'),
  `const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({show:false,width:1400,height:700,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,offscreen:true,backgroundThrottling:false}});w.loadFile(${JSON.stringify(join(work, 'dist/index.html'))});});`,
);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
delete env.NODE_PATH;
const desktop = await _electron.launch({
  executablePath: require('electron'),
  args: [join(work, 'main.cjs')],
  env,
});
const evidence = {
  verifiedAt: new Date().toISOString(),
  scope:
    'Actual production CardFace and CSS, all 16 public category definitions in a verification-only gallery; independent of match-state UI validation',
  sizes: [],
};
try {
  const page = await desktop.firstWindow();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const window = await desktop.browserWindow(page);
  for (const width of [60, 68, 90, 110, 140]) {
    await window.evaluate(
      (w, size) => w.setContentSize(...size),
      [width * 8 + 124, Math.ceil(((width * 740) / 529) * 2 + 160)],
    );
    await page.goto(new URL(`?width=${width}`, page.url()).href);
    await page.locator('.pokemon-card').last().waitFor();
    await page.evaluate(() =>
      Promise.all([...document.images].map((image) => image.decode())),
    );
    const cards = await page.locator('.pokemon-card').evaluateAll((cards) =>
      cards.map((card) => {
        const rect = card.getBoundingClientRect(),
          value = card.querySelector('.card-value').getBoundingClientRect(),
          ability = card
            .querySelector('.ability-mark')
            ?.getBoundingClientRect(),
          name = card.querySelector('.card-name'),
          art = card.querySelector('img').getBoundingClientRect();
        return {
          name: name.textContent,
          font: parseFloat(getComputedStyle(name).fontSize),
          clipped: name.scrollWidth > name.clientWidth,
          overlap:
            !!ability &&
            value.left < ability.right &&
            value.right > ability.left,
          artHeight: art.height,
          inside:
            value.left >= rect.left &&
            value.right <= rect.right &&
            art.bottom <= name.getBoundingClientRect().top + 1,
        };
      }),
    );
    assert.equal(cards.length, 16);
    assert.ok(
      cards.every(
        (card) =>
          card.font >= 12 &&
          !card.clipped &&
          !card.overlap &&
          card.artHeight >= 25 &&
          card.inside,
      ),
      `All cards readable at ${width}px: ${JSON.stringify(cards.filter((card) => card.clipped || card.overlap || !card.inside))}`,
    );
    const image = await window.evaluate(async (w) =>
      (
        await w.webContents.capturePage(undefined, {
          stayHidden: true,
          stayAwake: true,
        })
      )
        .toPNG()
        .toString('base64'),
    );
    await writeFile(
      join(output, `cards-${width}.png`),
      Buffer.from(image, 'base64'),
    );
    evidence.sizes.push({ width, cards });
  }
  assert.deepEqual(errors, []);
} finally {
  await desktop.close();
}
await writeFile(
  join(output, 'results.json'),
  JSON.stringify(evidence, null, 2) + '\n',
);
console.log('Verified all 16 cards at five actual UI sizes.');
