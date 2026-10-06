import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

it('keeps every streaming migration statement alive under Node 22.14 garbage collection', async () => {
  const bundle = await build({
    stdin: {
      sourcefile: 'storage-gc-runner.ts',
      resolveDir: dirname(fileURLToPath(import.meta.url)),
      contents: `
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync,readFileSync,readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteSaveRepository } from './save-repository';
import { readCurrentSave,readJournalSave } from './save-audit';
assert.equal(process.version,'v22.14.0');
assert.equal(typeof global.gc,'function');
const path=mkdtempSync(join(tmpdir(),'tablemax-storage-gc-')),file=join(path,'room.sqlite');
const legacy=new DatabaseSync(file),values=[];
legacy.exec('CREATE TABLE saves(id INTEGER PRIMARY KEY,data TEXT NOT NULL) STRICT; CREATE TABLE journal(instance TEXT,revision INTEGER,data TEXT,PRIMARY KEY(instance,revision)) STRICT; CREATE TABLE avatar_images(id TEXT PRIMARY KEY,png BLOB NOT NULL) STRICT; PRAGMA user_version=1;');
for(let revision=0;revision<12;revision++){
 const value={formatVersion:1,manifest:null,instanceId:'gc-instance',revision,branch:0,status:'lobby',paused:false,joinOpen:true,seats:[],snapshot:null,history:[{id:'checkpoint-'+revision,label:'gc',revealedInformation:false,before:{state:{payload:'x'.repeat(1024)},random:revision+1,bots:{}}}],receipts:{['receipt-'+revision]:{fingerprint:'fingerprint-'+revision,reply:{ok:true,revision,branch:0}}},botError:null,endReason:null};
 values.push(value);legacy.prepare('INSERT INTO journal VALUES(?,?,?)').run(value.instanceId,revision,JSON.stringify(value));
}
legacy.prepare('INSERT INTO saves VALUES(1,?)').run(JSON.stringify(values.at(-1)));
for(let index=0;index<2;index++)legacy.prepare('INSERT INTO avatar_images VALUES(?,?)').run('avatar-'+index,Buffer.from('avatar-bytes-'+index));
legacy.close();
const original=readFileSync(file),prepare=DatabaseSync.prototype.prepare;
let collected=0;
DatabaseSync.prototype.prepare=function(...args){
 const statement=Reflect.apply(prepare,this,args),iterate=statement.iterate;
 statement.iterate=function(...parameters){
  const iterator=Reflect.apply(iterate,this,parameters);
  return (function*(){for(const row of iterator){global.gc();collected++;yield row;}})();
 };
 return statement;
};
let repository;
try{
 repository=new SqliteSaveRepository(path);
 const next={...values.at(-1),revision:12};
 repository.save(next);assert.deepEqual(repository.load(),next);repository.close();repository=undefined;
 const audit=new DatabaseSync(file,{readOnly:true});
 assert.equal(audit.prepare('PRAGMA user_version').get().user_version,2);
 for(let index=0;index<values.length;index++)assert.deepEqual(readJournalSave(audit,index+1),values[index]);
 for(let index=0;index<2;index++)assert.deepEqual(Buffer.from(audit.prepare('SELECT png FROM avatar_images WHERE id=?').get('avatar-'+index).png),Buffer.from('avatar-bytes-'+index));
 assert.deepEqual(readCurrentSave(audit),next);audit.close();
 const backup=readdirSync(path).find(name=>name.startsWith('room-v1-backup-'));
 assert.deepEqual(readFileSync(join(path,backup,'room.sqlite')),original);
 assert.equal(collected,28);
 console.log(JSON.stringify({node:process.version,collected,journal:values.length,avatars:2,originalBackup:'equal',result:'passed'}));
}catch(error){
 repository?.close();
 console.log(JSON.stringify({node:process.version,collected,message:error.message,originalUnchanged:readFileSync(file).equals(original)}));
 process.exitCode=1;
}
`,
    },
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    write: false,
    logLevel: 'silent',
  });
  const result = spawnSync(
    process.env.TABLEMAX_STORAGE_NODE ?? process.execPath,
    ['--expose-gc', '-e', bundle.outputFiles[0]!.text],
    { encoding: 'utf8', timeout: 30000, windowsHide: true },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(JSON.parse(result.stdout.trim())).toEqual({
    node: 'v22.14.0',
    collected: 28,
    journal: 12,
    avatars: 2,
    originalBackup: 'equal',
    result: 'passed',
  });
}, 40000);

it.skipIf(!process.env.TABLEMAX_STORAGE_V1_SOURCE)(
  'migrates a read-only copy of the failed portable v1 fixture under forced GC',
  async () => {
    const bundle = await build({
      stdin: {
        sourcefile: 'storage-gc-portable-fixture.ts',
        resolveDir: dirname(fileURLToPath(import.meta.url)),
        contents: `
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync,existsSync,mkdtempSync,readFileSync,readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteSaveRepository } from './save-repository';
import { readCurrentSave,readJournalSave } from './save-audit';
assert.equal(process.version,'v22.14.0');
const originalPath=process.env.TABLEMAX_STORAGE_V1_SOURCE,originalBytes=readFileSync(originalPath);
const path=mkdtempSync(join(tmpdir(),'tablemax-storage-gc-copy-')),file=join(path,'room.sqlite');
for(const suffix of ['','-wal','-shm'])if(existsSync(originalPath+suffix))copyFileSync(originalPath+suffix,file+suffix);
const source=new DatabaseSync(file,{readOnly:true});
assert.equal(source.prepare('PRAGMA user_version').get().user_version,1);
const current=readCurrentSave(source),journal=source.prepare('SELECT rowid,data FROM journal ORDER BY rowid').all();
const revision=Number(source.prepare('SELECT max(revision) AS maximum FROM journal WHERE instance=?').get(current.instanceId).maximum)+1;
source.close();
const prepare=DatabaseSync.prototype.prepare;let collected=0;
DatabaseSync.prototype.prepare=function(...args){
 const statement=Reflect.apply(prepare,this,args),iterate=statement.iterate;
 statement.iterate=function(...parameters){const iterator=Reflect.apply(iterate,this,parameters);return(function*(){for(const row of iterator){global.gc();collected++;yield row;}})();};
 return statement;
};
const repository=new SqliteSaveRepository(path),next={...current,revision};
repository.save(next);assert.deepEqual(repository.load(),next);repository.close();
const audit=new DatabaseSync(file,{readOnly:true});
assert.equal(audit.prepare('PRAGMA user_version').get().user_version,2);
for(const row of journal)assert.deepEqual(readJournalSave(audit,row.rowid),JSON.parse(row.data));
audit.close();
const backup=readdirSync(path).find(name=>name.startsWith('room-v1-backup-'));
assert.deepEqual(readFileSync(join(path,backup,'room.sqlite')),originalBytes);
assert.deepEqual(readFileSync(originalPath),originalBytes);
console.log(JSON.stringify({node:process.version,journal:journal.length,collected,originalUnchanged:true,originalBackup:'equal',result:'passed'}));
`,
      },
      bundle: true,
      platform: 'node',
      target: 'node22',
      format: 'cjs',
      write: false,
      logLevel: 'silent',
    });
    const result = spawnSync(
      process.env.TABLEMAX_STORAGE_NODE ?? process.execPath,
      ['--expose-gc', '-e', bundle.outputFiles[0]!.text],
      { encoding: 'utf8', timeout: 30000, windowsHide: true },
    );
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
    const report = JSON.parse(result.stdout.trim());
    expect(report).toMatchObject({
      node: 'v22.14.0',
      originalUnchanged: true,
      originalBackup: 'equal',
      result: 'passed',
    });
    expect(report.journal).toBeGreaterThan(1);
    expect(report.collected).toBeGreaterThanOrEqual(report.journal * 2);
  },
  40000,
);
