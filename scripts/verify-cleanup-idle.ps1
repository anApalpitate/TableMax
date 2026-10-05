$ErrorActionPreference = 'Stop'
$taskParseTokens = $null
$taskParseErrors = $null
$taskAst = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'cleanup-local.ps1'), [ref]$taskParseTokens, [ref]$taskParseErrors)
if ($taskParseErrors.Count) { throw 'Cleanup source contains PowerShell parse errors.' }
$taskFunction = $taskAst.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Assert-Idle' }, $true)
Invoke-Expression $taskFunction.Extent.Text
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sourceWorkspace = $workspace
function Get-CimInstance { param($ClassName) return $script:taskProcesses }
$taskKernelPath = 'C:\Users\test\AppData\Local\OpenAI\Codex\runtimes\cua_node\123abc\bin\node.exe'
$taskCases = @(
  @{ name = 'Persistent Codex kernel is not a project build'; busy = $false; executable = $taskKernelPath; command = "node --experimental-vm-modules --eval bootstrap E:\Temp\kernel.js --session-id 012abc --working-dir $workspace" },
  @{ name = 'Persistent trusted worker is not a project build'; busy = $false; executable = $taskKernelPath; command = "node --experimental-vm-modules --eval bootstrap E:\Temp\trusted-worker.js $workspace" },
  @{ name = 'Actual project build remains protected'; busy = $true; executable = "$workspace\.tools\node\node.exe"; command = "node $workspace\scripts\build.mjs" },
  @{ name = 'Tool-spawned project verification remains protected'; busy = $true; executable = $taskKernelPath; command = "node $workspace\scripts\verify-pokemon.mjs" },
  @{ name = 'Unknown command remains protected'; busy = $true; executable = 'C:\Unknown\node.exe'; command = $null },
  @{ name = 'Lookalike interpreter outside Codex runtime remains protected'; busy = $true; executable = 'C:\Unknown\node.exe'; command = "node --experimental-vm-modules E:\Temp\trusted-worker.js $workspace" }
)
$taskResults = @()
foreach ($case in $taskCases) {
  $script:taskProcesses = @([PSCustomObject]@{ Name = 'node.exe'; ProcessId = 12345; ExecutablePath = $case.executable; CommandLine = $case.command })
  $taskBusy = $false
  try { Assert-Idle } catch { $taskBusy = $true }
  if ($taskBusy -ne $case.busy) { throw ('Process guard mismatch: ' + $case.name) }
  $taskResults += $case.name
}
$taskOutput = Join-Path $workspace 'artifacts/maintenance/v1.0.4/incremental-build-20261005/cleanup-idle-checks.json'
@{ result = 'passed'; checks = $taskResults; scope = 'Actual cleanup Assert-Idle function with deterministic process inventory; no deletion.' } | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $taskOutput -Encoding utf8
Write-Output ($taskResults.Count.ToString() + ' cleanup process guard cases passed.')
