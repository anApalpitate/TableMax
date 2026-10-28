import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { assertWorkspaceRoot } from '../../shared/workspace-root.mjs';
import { failureLimit } from '../runner/failure-policy.mjs';

assertWorkspaceRoot();
const options = new Map();
for (const argument of process.argv.slice(2)) {
  const match = /^--(task|evidence|baseline-dir)=(.+)$/.exec(argument);
  assert.ok(
    match && !options.has(match[1]),
    'Use unique --task, --evidence and optional --baseline-dir options',
  );
  options.set(match[1], match[2]);
}
const task = resolve(options.get('task') ?? '');
assert.ok(
  task.startsWith(resolve('tmp') + sep),
  'Task must be inside workspace tmp',
);
const name = options.get('evidence');
assert.match(name ?? '', /^[a-z0-9-]{1,48}$/);
const output = resolve('artifacts/maintenance', basename(task), 'native', name);
await assert.rejects(stat(output), 'Evidence output must be new');
await mkdir(task, { recursive: true });
await mkdir(output, { recursive: true });
const work = await mkdtemp(join(task, 'native-' + name + '-'));
const environment = {
  ...process.env,
  DOTNET_CLI_HOME: resolve('.cache/dotnet-home'),
  DOTNET_NOLOGO: '1',
  DOTNET_CLI_TELEMETRY_OPTOUT: '1',
  TABLEMAX_AUTO_MAINTENANCE: '0',
  TABLEMAX_TEST_MAINTENANCE: '0',
  TABLEMAX_TEST_AUDIO: '0',
  TEMP: work,
  TMP: work,
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourcePaths = [
  ...(await readdir('apps/desktop/native'))
    .filter((file) => /\.(?:cs|csproj|js|json|manifest|props)$/.test(file))
    .map((file) => 'apps/desktop/native/' + file),
  'apps/desktop/installation-runtime/InstallationCore.cs',
  'apps/desktop/installation-runtime/UpdateProtocol.cs',
  'apps/desktop/installation-runtime/TrustRoots.cs',
  'assets/platform/app-icon.ico',
  'global.json',
  'tools/test/desktop/verify-window-startup.mjs',
  'tools/test/desktop/verify-window-startup.cs',
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      sourcePaths.map(async (path) => [path, hash(await readFile(path))]),
    ),
  );
const inputs = await hashes();
const report = {
  version: 1,
  startedAt: new Date().toISOString(),
  result: 'running',
  work,
  output,
  inputs,
  checks: [],
  runs: [],
  boundary:
    'Current production Program.Main, NativeWindow and ShowHost run inside a separate net48 harness process on a private desktop that is never switched to the user. Actual WinForms and shared WebView2 render a clearly marked loopback HTML fixture. No service, saved game, installer, actual user settings, OS display configuration, real multi-monitor or hardware-DPI acceptance. Explicit geometry fixtures cover requested DPI factors only.',
};
let server;
let failures = 0;
const limit = failureLimit();
async function execute(
  program,
  args,
  label,
  extraEnvironment = {},
  timeout = 60000,
) {
  return new Promise((done, reject) => {
    const child = spawn(program, args, {
      cwd: resolve('.'),
      env: { ...environment, ...extraEnvironment },
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '',
      timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeout);
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (bytes) => {
      stdout += bytes;
    });
    child.stderr.on('data', (bytes) => {
      stderr += bytes;
    });
    child.once('error', reject);
    child.once('close', async (code, signal) => {
      clearTimeout(timer);
      const details = { label, program, args, code, signal, timedOut };
      await writeFile(join(output, label + '.log'), stdout + stderr);
      report.checks.push({
        ...details,
        result: code === 0 && !timedOut ? 'passed' : 'failed',
      });
      if (code !== 0 || timedOut) {
        failures++;
        reject(
          new Error(label + ' failed; see ' + join(output, label + '.log')),
        );
      } else done(details);
    });
  });
}
try {
  assert.equal(process.platform, 'win32');
  await execute('whoami.exe', ['/groups'], 'token');
  const integrity =
    (await readFile(join(output, 'token.log'), 'utf8')).match(/S-1-16-\d+/g) ??
    [];
  assert.deepEqual(
    integrity,
    ['S-1-16-8192'],
    'Standard Medium integrity is required',
  );
  report.integrity = integrity;
  server = createServer((request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(
      '<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;font:22px "Microsoft YaHei UI",sans-serif;background:#f4efe3;color:#23414b}main{height:100%;box-sizing:border-box;padding:32px;display:flex;flex-direction:column;gap:24px}header{font-size:32px;font-weight:bold}section{flex:1;border:3px solid #41a4a6;border-radius:28px;background:#d9f0e7;display:grid;place-content:center;text-align:center;gap:20px}small{font-size:18px;color:#526a72}</style><main><header>TableMax · 原生管理窗口</header><section><strong>原生窗口几何测试夹具</strong><span>实际 WinForms / WebView2 渲染</span><small>仅验证窗口默认大小与恢复；此页不是产品界面</small></section><footer>私有桌面 · 静音 · 隔离数据</footer></main>',
    );
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const url = 'http://127.0.0.1:' + server.address().port + '/host';
  const dotnet = join(
    process.env.ProgramFiles ?? 'C:/Program Files',
    'dotnet/dotnet.exe',
  );
  const references = resolve(
    '.cache/nuget/microsoft.netframework.referenceassemblies.net48/1.0.3/build/.NETFramework/v4.8',
  );
  const overrides = [
    'NativeWindow.cs',
    'DesktopContext.cs',
    'NativeMethods.cs',
  ];
  const variants = [];
  if (options.has('baseline-dir')) {
    const baseline = resolve(options.get('baseline-dir'));
    assert.ok(
      baseline.startsWith(task + sep),
      'Baseline copies must stay inside this task',
    );
    const targets = join(work, 'baseline.targets');
    const xml = (value) =>
      value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    await writeFile(
      targets,
      '<Project><Target Name="WindowStartupBaselineSources" BeforeTargets="CoreCompile"><ItemGroup>' +
        overrides
          .map(
            (file) =>
              '<Compile Remove="' +
              file +
              '"/><Compile Include="' +
              xml(join(baseline, file)) +
              '"/>',
          )
          .join('') +
        '</ItemGroup></Target></Project>',
    );
    report.baselineInputs = Object.fromEntries(
      await Promise.all(
        overrides.map(async (file) => [
          join(baseline, file),
          hash(await readFile(join(baseline, file))),
        ]),
      ),
    );
    variants.push({ id: 'baseline', targets });
  }
  variants.push({ id: 'after' });
  for (const variant of variants) {
    assert.ok(failures < limit, 'Failure budget reached');
    const directory = join(work, variant.id);
    await mkdir(directory);
    await execute(
      dotnet,
      [
        'build',
        resolve('apps/desktop/native/TableMax.csproj'),
        '--configuration',
        'Release',
        '--source',
        resolve('.cache/nuget-downloads'),
        '-p:RestoreLockedMode=true',
        '-p:IncludeSourceRevisionInInformationalVersion=false',
        '-p:OutputPath=' + directory + '/',
        '-p:BaseIntermediateOutputPath=' +
          join(work, variant.id + '-obj') +
          '/',
        ...(variant.targets
          ? ['-p:CustomBeforeMicrosoftCommonTargets=' + variant.targets]
          : []),
      ],
      variant.id + '-native-compile',
    );
    await copyFile(
      join(directory, 'runtimes/win-x64/native/WebView2Loader.dll'),
      join(directory, 'WebView2Loader.dll'),
    );
    const executable = join(directory, 'WindowStartupHarness.exe');
    await writeFile(
      executable + '.config',
      '<?xml version="1.0"?><configuration><runtime><loadFromRemoteSources enabled="true"/></runtime></configuration>',
    );
    await execute(
      dotnet,
      [
        resolve(dirname(dotnet), 'sdk/9.0.102/Roslyn/bincore/csc.dll'),
        '/nologo',
        '/target:exe',
        '/platform:x64',
        '/langversion:12',
        '/optimize+',
        '/warnaserror+',
        '/nostdlib+',
        '/main:WindowStartupHarness',
        '/out:' + executable,
        ...[
          'mscorlib',
          'System',
          'System.Core',
          'System.Drawing',
          'System.Windows.Forms',
          'System.Web.Extensions',
        ].map((file) => '/reference:' + join(references, file + '.dll')),
        resolve('tools/test/desktop/verify-window-startup.cs'),
      ],
      variant.id + '-harness-compile',
    );
    const modes =
      variant.id === 'baseline' ? ['baseline'] : ['after', 'background'];
    for (const mode of modes) {
      const runOutput = join(output, mode);
      const runWork = join(work, mode + '-data');
      await mkdir(runOutput);
      await mkdir(runWork);
      const settings =
        JSON.stringify({
          version: 1,
          host: { resolution: 'auto', interfaceScale: 100 },
          public: { resolution: '3840x2160', interfaceScale: 150 },
        }) + '\n';
      const display = join(runWork, 'display-settings.json');
      await writeFile(display, settings);
      const plan = {
        mode,
        assembly: join(directory, 'TableMax.exe'),
        output: runOutput,
        result: join(runOutput, 'result.json'),
        url,
        failureLimit: limit - failures,
      };
      const planPath = join(work, mode + '-plan.json');
      await writeFile(planPath, JSON.stringify(plan));
      let runError;
      try {
        await execute(executable, [planPath], mode + '-native-run', {
          TABLEMAX_BOX_DIRECTORY: join(runWork, 'box-root'),
          TABLEMAX_DATA_DIR: runWork,
          TABLEMAX_PROTOTYPE_URL: url,
        });
      } catch (error) {
        runError = error;
      }
      const result = JSON.parse(await readFile(plan.result, 'utf8'));
      report.runs.push({
        mode,
        executableSha256: hash(await readFile(plan.assembly)),
        harnessSha256: hash(await readFile(executable)),
        ...result,
      });
      assert.equal(
        await readFile(display, 'utf8'),
        settings,
        'Window operations rewrote legacy display preferences',
      );
      if (runError) throw runError;
      assert.equal(result.result, 'passed');
      assert.equal(result.programExit, 0);
    }
  }
  assert.deepEqual(
    await hashes(),
    inputs,
    'Source inputs changed during native validation',
  );
  report.result = 'passed';
} catch (error) {
  report.result = 'failed';
  report.error = error.stack ?? String(error);
  process.exitCode = 1;
} finally {
  if (server) await new Promise((done) => server.close(done));
  report.finishedAt = new Date().toISOString();
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({
      result: report.result,
      output,
      checks: report.checks.length,
      runs: report.runs.map((run) => ({
        mode: run.mode,
        checks: run.checks.length,
        result: run.result,
      })),
    }),
  );
}
