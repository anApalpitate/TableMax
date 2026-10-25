import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { accessSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const methodSha256 = () => digest(readFileSync(new URL(import.meta.url)));
const versionNumber = (value) =>
  String(value ?? '').match(/^\d+\.\d+\.\d+\.\d+/)?.[0];
function file(path) {
  const resolved = realpathSync(path);
  assert(lstatSync(resolved).isFile(), `Expected runtime file: ${resolved}`);
  const bytes = readFileSync(resolved);
  return { path: resolved, bytes: bytes.length, sha256: digest(bytes) };
}
function accessible(path) {
  try {
    accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Matches the installed, locked Playwright msedge channel lookup order. */
export function resolveMsEdgeExecutable(environment = process.env) {
  const prefixes = [
    environment.LOCALAPPDATA,
    environment.PROGRAMFILES,
    environment['PROGRAMFILES(X86)'],
    environment.HOMEDRIVE
      ? environment.HOMEDRIVE + '\\Program Files'
      : undefined,
    environment.HOMEDRIVE
      ? environment.HOMEDRIVE + '\\Program Files (x86)'
      : undefined,
  ].filter(Boolean);
  for (const prefix of prefixes) {
    const path = join(prefix, 'Microsoft', 'Edge', 'Application', 'msedge.exe');
    if (accessible(path)) return realpathSync(path);
  }
  throw new Error('Actual msedge channel executable is unavailable');
}

function windowsFileVersion(path) {
  const result = execFileSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '$v=[Diagnostics.FileVersionInfo]::GetVersionInfo($env:TABLEMAX_RUNTIME_VERSION_FILE); [ordered]@{fileVersion=$v.FileVersion;productVersion=$v.ProductVersion}|ConvertTo-Json -Compress',
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15000,
      env: { ...process.env, TABLEMAX_RUNTIME_VERSION_FILE: path },
    },
  );
  return JSON.parse(result);
}

/** Reading only: never starts, installs or updates the browser. */
export function readMsEdgeRuntime({
  environment = process.env,
  readVersion = windowsFileVersion,
} = {}) {
  const executable = file(resolveMsEdgeExecutable(environment));
  const executableVersion = readVersion(executable.path);
  const version = versionNumber(executableVersion.productVersion);
  assert(
    version && versionNumber(executableVersion.fileVersion) === version,
    'Missing or inconsistent msedge executable version',
  );
  const engine = file(join(dirname(executable.path), version, 'msedge.dll'));
  const engineVersion = readVersion(engine.path);
  assert.equal(
    versionNumber(engineVersion.fileVersion),
    version,
    'msedge.dll file version differs from the selected executable',
  );
  assert.equal(
    versionNumber(engineVersion.productVersion),
    version,
    'msedge.dll product version differs from the selected executable',
  );
  return {
    channel: 'msedge',
    version,
    executable,
    engine,
    methodSha256: methodSha256(),
  };
}

export const controlledCanvasFontFaces = [
  {
    id: 'arial-regular',
    family: 'TableMaxContractLatin',
    weight: 400,
    file: 'arial.ttf',
  },
  {
    id: 'arial-bold',
    family: 'TableMaxContractLatin',
    weight: 700,
    file: 'arialbd.ttf',
  },
  {
    id: 'yahei-regular',
    family: 'TableMaxContractCJK',
    weight: 400,
    file: 'msyh.ttc',
  },
  {
    id: 'yahei-bold',
    family: 'TableMaxContractCJK',
    weight: 700,
    file: 'msyhbd.ttc',
  },
];

/** The verifier serves these exact bytes as named faces, without OS font mapping. */
export function readControlledCanvasFonts(environment = process.env) {
  const windows = environment.WINDIR ?? environment.SystemRoot;
  assert(windows, 'Windows font root is unavailable');
  return {
    policy: 'fixed-canvas-controlled-fonts-v1',
    methodSha256: methodSha256(),
    faces: controlledCanvasFontFaces.map((face) => ({
      ...face,
      ...file(join(windows, 'Fonts', face.file)),
    })),
  };
}
