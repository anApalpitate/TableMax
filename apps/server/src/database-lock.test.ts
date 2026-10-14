import { it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { openFoundationDatabase } from './database';

const runtime = resolve('.cache/node/22.14.0/runtime/node.exe');
function fixture() {
  mkdirSync('tmp', { recursive: true });
  return mkdtempSync(resolve('tmp/foundation-lease-'));
}
function client(path: string, writable: boolean) {
  const source = `const {DatabaseSync}=require('node:sqlite'); let db; try { db=new DatabaseSync(process.argv[1],{readOnly:process.argv[2]!=='write'}); db.prepare("SELECT value FROM foundation WHERE key='starts'").get(); if(process.argv[2]==='write'){db.exec("BEGIN IMMEDIATE; UPDATE foundation SET value=999 WHERE key='starts'; ROLLBACK");} console.log(JSON.stringify({blocked:false})); } catch(e) {console.log(JSON.stringify({blocked:[5,6].includes(e.errcode&255),code:e.errcode}));} finally {db?.close();}`;
  const result = spawnSync(
    runtime,
    ['-e', source, path, writable ? 'write' : 'read'],
    { windowsHide: true, encoding: 'utf8', timeout: 8000 },
  );
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout.trim()) as {
    blocked: boolean;
    code?: number;
  };
}
async function stop(child: ChildProcess) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.stdin!.end('close\n');
  const timer = setTimeout(() => child.kill(), 5000);
  try {
    expect((await exited)[0]).toBe(0);
  } finally {
    clearTimeout(timer);
  }
}

it('keeps D exclusive across processes until the service connection closes, including read-only clients', () => {
  const directory = fixture();
  const storage = openFoundationDatabase(directory);
  const path = join(directory, 'foundation.sqlite');
  const original = readFileSync(path);
  try {
    expect(storage.starts).toBe(1);
    expect(client(path, false).blocked).toBe(true);
    expect(client(path, true).blocked).toBe(true);
    expect(readFileSync(path)).toEqual(original);
    expect(
      storage.database
        .prepare("SELECT value FROM foundation WHERE key='starts'")
        .get()?.value,
    ).toBe(1);
  } finally {
    storage.close();
  }
  expect(client(path, true).blocked).toBe(false);
  const reopened = openFoundationDatabase(directory);
  try {
    expect(reopened.starts).toBe(2);
  } finally {
    reopened.close();
  }
});

it('refuses a frozen normal-WAL connection even when its old process is idle and preserves its main database', async () => {
  const directory = fixture();
  const storage = openFoundationDatabase(directory);
  storage.close();
  const path = join(directory, 'foundation.sqlite');
  // Frozen portable services use normal WAL mode and keep this connection open
  // for their whole lifetime. No cooperation with the new global lock is needed.
  const source = `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec('PRAGMA journal_mode=WAL');db.prepare("SELECT value FROM foundation WHERE key='starts'").get();console.log('ready');process.stdin.once('data',()=>{db.close();process.exit(0)});`;
  const child = spawn(runtime, ['-e', source, path], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const lines = createInterface({ input: child.stdout });
  let diagnostic = '';
  child.stderr.on('data', (chunk: Buffer) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-4000);
  });
  try {
    await new Promise<void>((done, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(
              'Old SQLite connection readiness timed out: ' + diagnostic,
            ),
          ),
        8000,
      );
      lines.once('line', (line) => {
        clearTimeout(timer);
        if (line === 'ready') done();
        else reject(new Error('Invalid old connection readiness'));
      });
      child.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    const original = readFileSync(path);
    expect(() => openFoundationDatabase(directory)).toThrow(
      'data-directory-in-use',
    );
    expect(readFileSync(path)).toEqual(original);
  } finally {
    lines.close();
    await stop(child);
  }
  const reopened = openFoundationDatabase(directory);
  try {
    expect(reopened.starts).toBe(2);
  } finally {
    reopened.close();
  }
}, 20000);
