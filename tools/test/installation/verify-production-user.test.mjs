import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const parentPath = path.join(
  repository,
  'tools/test/installation/verify-production-user.ps1',
);
const childPath = path.join(
  repository,
  'tools/test/installation/verify-production-user-child.ps1',
);
const nodePath = path.join(repository, '.cache/node/22.14.0/runtime/node.exe');
const systemPowerShell = path.join(
  process.env.WINDIR ?? 'C:/Windows',
  'System32/WindowsPowerShell/v1.0/powershell.exe',
);
const windows = process.platform === 'win32';
const quote = (value) => "'" + value.replaceAll("'", "''") + "'";
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// Select definitions through the PS parser; never invoke either script's main.
function importFunctions(sourcePath, names) {
  return `$taskTokens = $null; $taskErrors = $null
$taskAst = [Management.Automation.Language.Parser]::ParseFile(${quote(sourcePath)}, [ref]$taskTokens, [ref]$taskErrors)
if (@($taskErrors).Count) { throw ($taskErrors | Out-String) }
$taskDefinitions = @()
foreach ($taskName in @(${names.map(quote).join(',')})) {
  $taskMatches = @($taskAst.FindAll({ param($Node) $Node -is [Management.Automation.Language.FunctionDefinitionAst] -and $Node.Name -eq $taskName }, $true))
  if ($taskMatches.Count -ne 1) { throw ('Expected one isolated function: ' + $taskName) }
  $taskDefinitions += $taskMatches[0].Extent.Text
}
. ([scriptblock]::Create([string]::Join([Environment]::NewLine, [string[]]$taskDefinitions)))
`;
}

// Extract only the three actual main-body selection statements, not account setup.
function importEntrypointSelection(sourcePath) {
  return `$taskSelectionTokens = $null; $taskSelectionErrors = $null
$taskSelectionAst = [Management.Automation.Language.Parser]::ParseFile(${quote(sourcePath)}, [ref]$taskSelectionTokens, [ref]$taskSelectionErrors)
if (@($taskSelectionErrors).Count) { throw ($taskSelectionErrors | Out-String) }
$taskSelectionStatements = @($taskSelectionAst.EndBlock.Statements)
$taskSelectionAssignments = @($taskSelectionStatements | Where-Object { $_ -is [Management.Automation.Language.AssignmentStatementAst] -and $_.Operator -eq 'Equals' -and $_.Left -is [Management.Automation.Language.VariableExpressionAst] -and $_.Left.VariablePath.UserPath -eq 'taskEntrypoints' })
if ($taskSelectionAssignments.Count -ne 1) { throw 'Expected one actual entrypoint initialization.' }
$taskSelectionIndex = [Array]::IndexOf($taskSelectionStatements, $taskSelectionAssignments[0])
$taskSelectionAppend = $taskSelectionStatements[$taskSelectionIndex + 1]
$taskSelectionConditional = $taskSelectionStatements[$taskSelectionIndex + 2]
if ($taskSelectionAppend -isnot [Management.Automation.Language.AssignmentStatementAst] -or $taskSelectionAppend.Operator -ne 'PlusEquals' -or $taskSelectionAppend.Left.VariablePath.UserPath -ne 'taskEntrypoints' -or $taskSelectionConditional -isnot [Management.Automation.Language.IfStatementAst]) { throw 'The actual entrypoint selection boundary changed.' }
$taskSelectionBody = @($taskSelectionConditional.Clauses[0].Item2.Statements)
if ($taskSelectionConditional.Clauses.Count -ne 1 -or $taskSelectionConditional.ElseClause -or $taskSelectionBody.Count -ne 1 -or $taskSelectionBody[0] -isnot [Management.Automation.Language.AssignmentStatementAst] -or $taskSelectionBody[0].Operator -ne 'PlusEquals' -or $taskSelectionBody[0].Left.VariablePath.UserPath -ne 'taskEntrypoints') { throw 'The isolated selection must contain only the optional entrypoint append.' }
$taskSelectionBlock = [scriptblock]::Create([string]::Join([Environment]::NewLine, [string[]]@($taskSelectionAssignments[0].Extent.Text, $taskSelectionAppend.Extent.Text, $taskSelectionConditional.Extent.Text)))
`;
}

function runPowerShell(script) {
  const code = `$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
function Assert-TaskRejected([scriptblock]$Action) {
  $taskRejected = $false
  try { & $Action | Out-Null } catch { $taskRejected = $true }
  if (-not $taskRejected) { throw 'Expected fail-closed rejection.' }
}
${script}
`;
  const result = spawnSync(
    systemPowerShell,
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(code, 'utf16le').toString('base64'),
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 20000,
      env: {
        ...process.env,
        PSModulePath: path.join(
          process.env.WINDIR ?? 'C:/Windows',
          'System32/WindowsPowerShell/v1.0/Modules',
        ),
      },
    },
  );
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

async function fixture() {
  const parent = path.join(repository, 'tmp');
  await mkdir(parent, { recursive: true });
  return mkdtemp(path.join(parent, 'production-user-unit-'));
}

const parentFunctions = [
  'Assert-TaskPathNoLinks',
  'Get-TaskSourceRecord',
  'Assert-TaskSourceRecords',
  'Get-TaskMethodFingerprint',
  'Copy-TaskSourceFile',
];

for (const scenario of [
  {
    name: 'default',
    portable: false,
    fixture: '',
    entrypoints: [
      'tools/test/installation/verify-application-handoff.mjs',
      'tools/test/installation/execution-method.mjs',
      'tools/release/installation-verifier.mjs',
    ],
  },
  {
    name: 'fixture',
    portable: false,
    fixture: 'chains',
    entrypoints: [
      'tools/test/installation/verify-application-handoff.mjs',
      'tools/test/installation/execution-method.mjs',
    ],
  },
  {
    name: 'portable',
    portable: true,
    fixture: '',
    entrypoints: [
      'tools/test/installation/verify-portable-migration.mjs',
      'tools/test/installation/execution-method.mjs',
    ],
  },
]) {
  test(
    `entrypoint selection preserves the actual ${scenario.name} array before account setup`,
    { skip: !windows },
    () => {
      const expected = scenario.entrypoints.map((entry) =>
        path.join(repository, entry),
      );
      const output = runPowerShell(
        importFunctions(parentPath, [
          ...parentFunctions,
          'Assert-TaskAcceptanceEnvironment',
        ]) +
          importEntrypointSelection(parentPath) +
          `
$taskRepository = ${quote(repository.replace(/[\\/]+$/, ''))}
$taskMethodEntrypoint = ${quote(path.join(repository, 'tools/test/installation/execution-method.mjs'))}
$PortableMigrationOnly = $${scenario.portable}
$FixtureScenario = ${quote(scenario.fixture)}
. $taskSelectionBlock
$taskExpectedEntrypoints = @(${expected.map(quote).join(',')})
if ($taskEntrypoints -isnot [Array] -or $taskEntrypoints.Count -ne $taskExpectedEntrypoints.Count) { throw 'Entrypoint initialization or append collapsed the array.' }
for ($taskIndex = 0; $taskIndex -lt $taskExpectedEntrypoints.Count; $taskIndex++) {
  if ($taskEntrypoints[$taskIndex] -isnot [string] -or $taskEntrypoints[$taskIndex] -cne $taskExpectedEntrypoints[$taskIndex]) { throw 'Entrypoint paths were concatenated, changed or reordered.' }
}
$taskEnvironment = Assert-TaskAcceptanceEnvironment ${quote(systemPowerShell)} ${quote(nodePath)} ${quote(childPath)} $taskEntrypoints { param($Name) $Name }
if ($taskEnvironment.entrypoints.Count -ne $taskExpectedEntrypoints.Count) { throw 'Preflight did not freeze every separate source.' }
'passed'
`,
      );
      assert.equal(output, 'passed');
    },
  );
}

test(
  'method CLI binds both tracked PS sources and rejects duplicate or changed declarations',
  { skip: !windows },
  async () => {
    const root = await fixture();
    const records = [];
    for (const sourcePath of [parentPath, childPath]) {
      const bytes = await readFile(sourcePath);
      records.push({
        path: path.relative(repository, sourcePath).replaceAll('\\', '/'),
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }
    const entrypoints = {};
    for (const [name, value] of Object.entries({
      valid: records,
      duplicate: [records[0], records[0]],
      changed: [records[0], { ...records[1], sha256: '0'.repeat(64) }],
      object: { records },
      scalar: 'not-an-array',
      null: null,
      empty: [],
      singleton: [records[0]],
      nested: [records, records],
    })) {
      const entrypoint = path.join(root, name + '.mjs');
      await writeFile(
        entrypoint,
        'console.log(' + JSON.stringify(JSON.stringify(value)) + ');\n',
        { flag: 'wx' },
      );
      entrypoints[name] = entrypoint;
    }
    const output = runPowerShell(
      importFunctions(parentPath, [
        ...parentFunctions,
        'Get-TaskExecutionMethod',
      ]) +
        `
$taskSources = @(Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.valid)} ${quote(repository.replace(/[\\/]+$/, ''))})
if ($taskSources.Count -ne 2) { throw 'The complete method records were not returned.' }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.duplicate)} ${quote(repository.replace(/[\\/]+$/, ''))} }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.changed)} ${quote(repository.replace(/[\\/]+$/, ''))} }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.object)} ${quote(repository.replace(/[\\/]+$/, ''))} }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.scalar)} ${quote(repository.replace(/[\\/]+$/, ''))} }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.null)} ${quote(repository.replace(/[\\/]+$/, ''))} }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.empty)} ${quote(repository.replace(/[\\/]+$/, ''))} }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.singleton)} ${quote(repository.replace(/[\\/]+$/, ''))} }
Assert-TaskRejected { Get-TaskExecutionMethod ${quote(nodePath)} ${quote(entrypoints.nested)} ${quote(repository.replace(/[\\/]+$/, ''))} }
'passed'
`,
    );
    assert.equal(output, 'passed');
  },
);

test(
  'environment preflight validates inputs, child syntax and required commands without account actions',
  { skip: !windows },
  async () => {
    const root = await fixture();
    const entrypoint = path.join(root, 'entry.mjs');
    const invalidChild = path.join(root, 'invalid.ps1');
    await writeFile(entrypoint, 'export {};\n', { flag: 'wx' });
    await writeFile(invalidChild, 'function Broken( {', { flag: 'wx' });
    const output = runPowerShell(
      importFunctions(parentPath, [
        ...parentFunctions,
        'Assert-TaskAcceptanceEnvironment',
      ]) +
        `
$taskResolver = { param($Name) $Name }
$taskEnvironment = Assert-TaskAcceptanceEnvironment ${quote(systemPowerShell)} ${quote(nodePath)} ${quote(childPath)} @(${quote(entrypoint)}) $taskResolver
if ($taskEnvironment.child.bytes -lt 1 -or $taskEnvironment.entrypoints.Count -ne 1) { throw 'Preflight lost its frozen input records.' }
Assert-TaskRejected { Assert-TaskAcceptanceEnvironment ${quote(systemPowerShell)} ${quote(nodePath)} ${quote(childPath)} @(${quote(entrypoint)}) { param($Name) if ($Name -ne 'New-LocalUser') { $Name } } }
Assert-TaskRejected { Assert-TaskAcceptanceEnvironment ${quote(systemPowerShell)} ${quote(nodePath)} ${quote(invalidChild)} @(${quote(entrypoint)}) $taskResolver }
Assert-TaskRejected { Assert-TaskAcceptanceEnvironment ${quote(systemPowerShell)} ${quote(nodePath)} ${quote(childPath)} @(${quote(path.join(root, 'absent.mjs'))}) $taskResolver }
'passed'
`,
    );
    assert.equal(output, 'passed');
  },
);

test(
  'child content copy, method identity and self-check reject overwrite or changed bytes',
  { skip: !windows },
  async () => {
    const root = await fixture();
    const copy = path.join(root, 'run.ps1');
    const output = runPowerShell(
      importFunctions(parentPath, parentFunctions) +
        importFunctions(childPath, ['Assert-TaskChildSource']) +
        `
$taskSources = @((Get-TaskSourceRecord ${quote(parentPath)}), (Get-TaskSourceRecord ${quote(childPath)}))
$taskBefore = Get-TaskMethodFingerprint $taskSources
$taskCopied = Copy-TaskSourceFile ${quote(childPath)} ${quote(copy)} $taskSources[1]
Assert-TaskChildSource ${quote(copy)} $taskCopied
Assert-TaskRejected { Copy-TaskSourceFile ${quote(childPath)} ${quote(copy)} $taskSources[1] }
$taskChangedSources = @($taskSources[0], [ordered]@{ path = $taskSources[1].path; bytes = $taskSources[1].bytes; sha256 = ('0' * 64) })
if ((Get-TaskMethodFingerprint $taskChangedSources) -eq $taskBefore) { throw 'The child must affect method identity.' }
Assert-TaskRejected { Assert-TaskSourceRecords $taskChangedSources }
[IO.File]::AppendAllText(${quote(copy)}, '# changed', [Text.UTF8Encoding]::new($false))
Assert-TaskRejected { Assert-TaskChildSource ${quote(copy)} $taskCopied }
'passed'
`,
    );
    assert.equal(output, 'passed');
  },
);

test(
  'isolated Node invocation preserves UTF-8 streams and actual zero/nonzero exit codes',
  { skip: !windows },
  async () => {
    const root = await fixture();
    const script = path.join(root, '参数 空格.mjs');
    const firstLog = path.join(root, 'explicit.log');
    const secondLog = path.join(root, 'fallback.log');
    await writeFile(
      script,
      "process.stdout.write('中文🙂:'+process.argv[2]);process.stderr.write('错误流');process.exitCode=Number(process.argv[3]);\n",
      { flag: 'wx' },
    );
    const output = runPowerShell(
      importFunctions(childPath, ['Invoke-TaskNode']) +
        `
$taskPlan = @{ repository = ${quote(repository)} }
$taskNodeExecutable = ${quote(nodePath)}
$taskFirst = Invoke-TaskNode ${quote(script)} @('实参 空格', '0') ${quote(firstLog)}
$taskNodeExecutable = $null
$taskSecond = Invoke-TaskNode ${quote(script)} @('实参 空格', '7') ${quote(secondLog)}
Assert-TaskRejected { Invoke-TaskNode ${quote(script)} @('invalid"argument') ${quote(path.join(root, 'unsafe.log'))} }
Assert-TaskRejected { Invoke-TaskNode ${quote(script)} @('invalid\\') ${quote(path.join(root, 'trailing.log'))} }
@($taskFirst, $taskSecond) | ConvertTo-Json -Compress
`,
    );
    assert.deepEqual(JSON.parse(output), [0, 7]);
    for (const log of [firstLog, secondLog]) {
      assert.equal(
        (await readFile(log)).toString('utf8'),
        '中文🙂:实参 空格\n[stderr]\n错误流',
      );
    }
  },
);

test(
  'execution receipt preserves raw child proof and successful cleanup independently of later binding',
  { skip: !windows },
  async () => {
    const root = await fixture();
    const proof = path.join(root, 'shipping-executable-checks-full.json');
    const isolation = path.join(root, 'isolated-account.json');
    const delivery = path.join(root, 'delivery.json');
    const proofBytes = Buffer.from('{"result":"passed","child":"原始"}\n');
    const isolationBytes = Buffer.from(
      JSON.stringify({
        result: 'passed',
        exitCode: 0,
        accountRemoved: true,
        profileRemoved: true,
        errors: [],
        ownerSid: 'S-1-5-21-fixture',
      }) + '\n',
    );
    await writeFile(proof, proofBytes, { flag: 'wx' });
    await writeFile(isolation, isolationBytes, { flag: 'wx' });
    await writeFile(delivery, '{"fixture":"pure receipt input"}\n', {
      flag: 'wx',
    });
    const output = runPowerShell(
      importFunctions(parentPath, [
        ...parentFunctions,
        'Write-TaskNewJson',
        'Write-TaskExecutionReceipt',
      ]) +
        `
$taskSources = @((Get-TaskSourceRecord ${quote(parentPath)}), (Get-TaskSourceRecord ${quote(childPath)}))
$taskDelivery = Get-TaskSourceRecord ${quote(delivery)}
$taskReceipt = Write-TaskExecutionReceipt ${quote(root)} $taskDelivery ${quote(proof)} ${quote(isolation)} $taskSources
Assert-TaskRejected { Write-TaskExecutionReceipt ${quote(root)} $taskDelivery ${quote(proof)} ${quote(isolation)} $taskSources }
$taskReceipt | ConvertTo-Json -Compress
`,
    );
    const receiptRecord = JSON.parse(output);
    const receipt = JSON.parse(await readFile(receiptRecord.path, 'utf8'));
    assert.equal(receipt.kind, 'installation-execution-receipt');
    assert.equal(receipt.proof.sha256, sha256(proofBytes));
    assert.deepEqual(await readFile(receipt.proof.path), proofBytes);
    assert.equal(receipt.isolation.sha256, sha256(isolationBytes));
    assert.equal(
      receipt.methodSources[1].path.toLowerCase(),
      childPath.toLowerCase(),
    );
    await writeFile(proof, '{"later":"bound"}\n');
    assert.deepEqual(await readFile(receipt.proof.path), proofBytes);
    assert.deepEqual(await readFile(isolation), isolationBytes);
  },
);
