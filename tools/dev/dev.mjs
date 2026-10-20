import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();
import { buildProject } from '../build/build.mjs';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { normalizeBuiltExecutableSecurity } from '../shared/windows-executable-security.mjs';
import { createDevelopmentSession } from './session.mjs';

await buildProject();
// A build directory can inherit a sandbox Low label. Starting that EXE from a
// normal terminal still makes the box Low, where Windows can ignore browser
// activation. Normalize only this freshly built, marked development entry.
if (process.platform === 'win32') {
  const receipt = await normalizeBuiltExecutableSecurity(
    resolve('build/desktop/TableMax.exe'),
  );
  await writeFile(
    resolve('build/desktop/.tablemax-development-security.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
}
// Use the same assembled browser runtime and game release as the service.
// A separate Vite origin cannot serve immutable game resources or share React.
const session = await createDevelopmentSession();
try {
  const desktop = spawn(
    resolve('build/desktop/TableMax.exe'),
    process.argv.slice(2).filter((argument) => argument !== '--'),
    {
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...session.env,
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_WEB_DEV_URL: undefined,
        TABLEMAX_PACKAGED: '0',
      },
    },
  );
  const stop = () => desktop.kill();
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  try {
    await new Promise((done) => {
      desktop.on('error', (error) => {
        console.error(error);
        process.exitCode = 1;
      });
      desktop.on('close', (code) => {
        process.exitCode = code ?? 1;
        done();
      });
    });
  } finally {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
} finally {
  await session.dispose().catch((error) => console.warn(error.message));
}
