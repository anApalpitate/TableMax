import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { launchDesktop } from '../support/desktop-test.mjs';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { createHash } from 'node:crypto';

assertWorkspaceRoot();
const native = process.argv
  .find((arg) => arg.startsWith('--native='))
  ?.slice(9);
const server = process.argv
  .find((arg) => arg.startsWith('--server='))
  ?.slice(9);
await mkdir('tmp', { recursive: true });
const work = await mkdtemp(resolve('tmp/desktop-verify-'));
const box = join(work, 'TableMax');
const app = join(box, 'app');
const current = JSON.parse(
  await readFile('artifacts/package-payloads/v1.0.6/current.json', 'utf8'),
);
const source = current.deliveries.find((item) => item.edition === 'full')
  .executable.path;
const output = resolve(
  'artifacts/maintenance/v1.0.6',
  native
    ? 'desktop-shutdown-candidate'
    : 'desktop-shutdown-' + current.buildVersion,
  'run-' + Date.now(),
);
await mkdir(output, { recursive: true });
const checks = [];
let desktop;
let failure;
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') return false;
    throw error;
  }
};
async function prepare() {
  execFileSync(source, ['--extract-only=' + app], { windowsHide: true });
  if (native)
    for (const name of [
      'TableMax.exe',
      'TableMax.exe.config',
      'Microsoft.Web.WebView2.Core.dll',
      'Microsoft.Web.WebView2.WinForms.dll',
    ])
      await cp(join(resolve(native), name), join(app, name));
  if (server)
    for (const name of ['server.cjs', 'server.cjs.br'])
      await cp(join(resolve(server), name), join(app, name));
}
try {
  await prepare();
  for (const scenario of [
    'last-window',
    'quit-two-windows',
    'delete-recreate',
  ]) {
    desktop = await launchDesktop({
      executablePath: join(app, 'TableMax.exe'),
      env: {
        ...process.env,
        TABLEMAX_HOST: '127.0.0.1',
        TABLEMAX_PORT: '0',
        TABLEMAX_DATA_DIR: join(box, 'data'),
        TABLEMAX_BOX_DIRECTORY: box,
      },
      timeout: 45000,
    });
    const host = await desktop.firstWindow();
    await host.locator('.connection.online').waitFor();
    if (scenario === 'quit-two-windows') await desktop.request('open-public');
    const cdp = await host.context().browser().newBrowserCDPSession();
    const { processInfo } = await cdp.send('SystemInfo.getProcessInfo');
    const pids = [
      desktop.startup.desktopPid,
      desktop.startup.servicePid,
      ...processInfo.map((item) => item.id),
    ];
    await cdp.detach();
    if (scenario === 'last-window') await host.close();
    await desktop.close();
    assert.equal(desktop.process().exitCode, 0);
    desktop = undefined;
    for (const pid of pids)
      assert.equal(alive(pid), false, `Process ${pid} survived ${scenario}`);
    // FileShare.None detects an image/DLL mapping that survived window closure.
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        '$stream = [IO.File]::Open($env:TABLEMAX_SHUTDOWN_DLL, [IO.FileMode]::Open, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None); $stream.Dispose()',
      ],
      {
        env: {
          ...process.env,
          TABLEMAX_SHUTDOWN_DLL: join(
            app,
            'Microsoft.Web.WebView2.WinForms.dll',
          ),
        },
        windowsHide: true,
      },
    );
    checks.push({ scenario, pids, dllExclusiveOpen: true });
    if (scenario === 'quit-two-windows') {
      assert.equal(resolve(box), join(work, 'TableMax'));
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          "$target = [IO.Path]::GetFullPath($env:TABLEMAX_SHUTDOWN_BOX); $expected = [IO.Path]::GetFullPath([IO.Path]::Combine($env:TABLEMAX_SHUTDOWN_WORK, 'TableMax')); if ($target -ne $expected) { throw 'Unsafe test deletion' }; Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop",
        ],
        {
          env: {
            ...process.env,
            TABLEMAX_SHUTDOWN_BOX: box,
            TABLEMAX_SHUTDOWN_WORK: work,
          },
          windowsHide: true,
        },
      );
      await prepare();
    }
  }
} catch (error) {
  failure = error.stack;
  throw error;
} finally {
  await desktop?.close().catch(() => undefined);
  await writeFile(
    join(output, 'results.json'),
    JSON.stringify(
      {
        result: failure ? 'failed' : 'passed',
        work,
        native: native ? resolve(native) : null,
        server: server ? resolve(server) : null,
        candidateFiles: await Promise.all(
          [
            ...(native ? [join(resolve(native), 'TableMax.exe')] : []),
            ...(server
              ? ['server.cjs', 'server.cjs.br'].map((name) =>
                  join(resolve(server), name),
                )
              : []),
          ].map(async (path) => ({
            path,
            sha256: createHash('sha256')
              .update(await readFile(path))
              .digest('hex'),
          })),
        ),
        source,
        checks,
        failure,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({ result: failure ? 'failed' : 'passed', checks, output }),
  );
}
