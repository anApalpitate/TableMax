import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { leanCatalogPlugin } from '../../build/lean-catalog.mjs';
export async function start(taskPath, phase = 'before') {
  const task = path.resolve(taskPath);
  const source = path.join(
    task,
    'work',
    phase === 'before' ? 'before' : 'after',
  );
  const work = path.join(task, 'serve-' + phase);
  await fs.mkdir(work, { recursive: true });
  const file = (p) => JSON.stringify(path.join(source, p));
  const entry = `import React from 'react';import {createRoot} from 'react-dom/client';import {flushSync} from 'react-dom';
import {BoxScreen} from ${file('apps/web/src/screens/BoxScreen.tsx')};
import {PlatformGame} from ${file('apps/web/src/session/gameHostAdapter.tsx')};
import {loadGameClient} from ${file('apps/web/src/game-clients/registry.ts')};
import ${file('apps/web/src/styles.css')};import ${file('apps/web/src/screens/box-screen.css')};import ${file('apps/web/src/scrollbars.css')};
import fixtures from './fixtures.json';
const root=createRoot(document.getElementById('root'));const noop=()=>{};let seq=0;window.fixtureCommands=[];
function session(key,role,status='playing',anonymous=false){const item=fixtures.games[key][status];const view=anonymous?item.anonymous:item[role];return{role,view,isHost:view.self.role==='host',canControl:view.capabilities.control,canManageSeats:view.capabilities.manageSeats,self:view.seats.find(seat=>seat.id===view.self.seatId),credential:anonymous?'':'fixture',connected:true,locked:false,busy:false,message:'',messageKind:'none',admissionPending:false,awaitingConfirmation:false,feedback:null,errorId:'',motion:[],saved:false,submitting:false,name:'',setName:noop,command:command=>window.fixtureCommands.push(command),retry:noop,retryAdmission:noop,subscribeInteractions:()=>noop,subscribeInteractionReset:()=>noop,addresses:['127.0.0.1'],adapters:[],port:38473,catalog:view.catalog,games:view.catalog,address:'127.0.0.1',joinUrl:'http://127.0.0.1:38473/',externalJoinUrl:null,networkMessage:'',refreshNetwork:noop,setAddress:noop,saveExternalJoinUrl:async()=>true,join:noop,setPlayerCredential:noop};}
window.renderCase=async({kind='game',key='uno',role='host',owner=false,paused=false,loadFailure=false})=>{window.fixtureCommands=[];history.replaceState(null,'','/'+role+(kind==='game'?'/game':''));document.documentElement.dataset.playerDisplay=role==='player'&&innerWidth>=640?'wide':'portrait';const s=session(key,role,kind==='game'?'playing':'lobby');s.view=structuredClone(s.view);delete s.view.game.releaseRef;if(key==='expansion')s.view.game.variantId='expansion';else if(key==='pokemon-encounters')s.view.game.variantId='original';s.view.paused=paused;if(owner){s.canControl=true;s.view.capabilities.control=true;s.view.ownerSeatId=s.self?.id;}const client=await loadGameClient(s.view.game.id,s.view.game.variantId);if(loadFailure)s.view.game.releaseRef='f'.repeat(64);window.fixtureSession=s;flushSync(()=>root.render(kind==='game'?<PlatformGame key={++seq} session={s} client={client}/>:<BoxScreen key={++seq} session={s}/>));};`;
  await fs.writeFile(path.join(work, 'entry.tsx'), entry);
  await fs.copyFile(
    path.join(task, 'legal-fixtures.json'),
    path.join(work, 'fixtures.json'),
  );
  await fs.writeFile(
    path.join(work, 'index.html'),
    '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/entry.tsx"></script></html>',
  );
  const aliases = {
    '@tablemax/web-host/platform': 'packages/web-host/src/platform.ts',
    '@tablemax/web-host': 'packages/web-host/src/index.tsx',
    '@tablemax/protocol': 'packages/protocol/src/index.ts',
    '@tablemax/game-sdk/module-manifest':
      'packages/game-sdk/src/module-manifest.ts',
    '@tablemax/game-sdk/metadata': 'packages/game-sdk/src/metadata.mjs',
    '@tablemax/game-sdk': 'packages/game-sdk/src/index.ts',
  };
  const alias = Object.entries(aliases).map(([find, p]) => ({
    find,
    replacement: path.join(source, p),
  }));
  for (const [find, p] of [
    ['react', 'apps/web/node_modules/react'],
    ['react-dom', 'apps/web/node_modules/react-dom'],
    ['zod', 'packages/protocol/node_modules/zod'],
    ['socket.io-client', 'apps/web/node_modules/socket.io-client'],
  ])
    alias.push({ find, replacement: path.resolve(p) });
  const inputs = new Map();
  const s = await createServer({
    root: work,
    configFile: false,
    plugins: [
      {
        name: 'snapshot-assets',
        enforce: 'pre',
        resolveId() {
          return null;
        },
        async transform() {
          return null;
        },
        async load(id) {
          const p = id.split('?')[0];
          if (path.isAbsolute(p) && !p.includes('node_modules'))
            try {
              inputs.set(p, await fs.readFile(p));
            } catch {
              // Virtual Vite module IDs have no filesystem bytes to bind.
            }
          return null;
        },
      },
      leanCatalogPlugin(source),
      react(),
    ],
    assetsInclude: ['**/*.flac'],
    resolve: { alias, dedupe: ['react', 'react-dom'] },
    server: {
      host: '127.0.0.1',
      port: 0,
      hmr: false,
      watch: null,
      fs: { allow: [path.resolve('.')] },
    },
    logLevel: 'error',
  });
  await s.listen();
  return { server: s, url: s.resolvedUrls.local[0], inputs };
}
