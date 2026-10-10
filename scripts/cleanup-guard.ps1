function Get-MaintenanceCoordinatorPids([object[]]$Processes = $null) {
  if (-not $env:TABLEMAX_MAINTENANCE_COORDINATOR) { return @() }
  $path = [IO.Path]::GetFullPath($env:TABLEMAX_MAINTENANCE_COORDINATOR)
  if (-not $path.StartsWith($workspace + '\artifacts\maintenance\', [StringComparison]::OrdinalIgnoreCase) -or [IO.Path]::GetFileName($path) -ne 'coordinator.json') { throw 'Invalid idle coordinator record.' }
  $cursor = $path
  while ($cursor) {
    if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked idle coordinator record.' }
    $cursor = [IO.Path]::GetDirectoryName($cursor)
  }
  $record = Get-Content -LiteralPath $path -Raw -Encoding utf8 | ConvertFrom-Json
  if ($record.schemaVersion -ne 1 -or $record.phase -ne 'idle' -or $record.entrypoint -notmatch '[\\/]scripts[\\/](?:build|package(?:-release)?|verify-[a-z0-9-]+)\.mjs$') { throw 'Unknown idle coordinator; files preserved.' }
  $entry = [IO.Path]::GetFullPath($record.entrypoint)
  if (-not $entry.StartsWith($workspace + '\scripts\', [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'Coordinator belongs to another workspace or has no entrypoint.' }
  if ($null -eq $Processes) { $Processes = @(Get-CimInstance -ClassName Win32_Process) }
  $owner = $Processes | Where-Object { $_.ProcessId -eq [int]$record.pid } | Select-Object -First 1
  if (-not $owner -or $owner.Name -ne 'node.exe' -or -not $owner.CommandLine -or [Math]::Abs(([DateTime]$owner.CreationDate).ToUniversalTime().Subtract([DateTime]'1970-01-01').TotalMilliseconds - $record.startedAtMs) -gt 10000) { throw 'Idle coordinator identity changed.' }
  $relativeEntry = $entry.Substring($workspace.Length + 1)
  $ownerCommand = ([string]$owner.CommandLine).Replace('/', '\')
  if ($ownerCommand -match '\s(?:-e|--eval|--input-type)(?:[=\s]|$)') { throw 'Arbitrary Node evaluation is not an idle coordinator.' }
  if ($ownerCommand -notmatch ('(?:^|["\s])(?:' + [regex]::Escape($entry) + '|' + [regex]::Escape($relativeEntry) + ')(?:["\s]|$)')) { throw 'Idle coordinator command changed.' }
  $current = $Processes | Where-Object { $_.ProcessId -eq $PID } | Select-Object -First 1
  $found = $false
  for ($index = 0; $index -lt 5 -and $current; $index++) {
    if ($current.ProcessId -eq $owner.ProcessId) { $found = $true; break }
    $parentId = $current.ParentProcessId
    $current = $Processes | Where-Object { $_.ProcessId -eq $parentId } | Select-Object -First 1
  }
  if (-not $found) { throw 'Idle coordinator is not this cleanup parent.' }
  $allowed = @([int]$owner.ProcessId)
  $parent = $Processes | Where-Object { $_.ProcessId -eq $owner.ParentProcessId } | Select-Object -First 1
  for ($index = 0; $index -lt 3 -and $parent; $index++) {
    if ($parent.Name -ne 'node.exe' -or ([string]$parent.CommandLine) -notmatch '[\\/](?:pnpm|npm)(?:\.c?js|[\\/]bin[\\/][^"\s]+\.c?js)(?:["\s]|$)') { break }
    $allowed += [int]$parent.ProcessId
    $parentId = $parent.ParentProcessId
    $parent = $Processes | Where-Object { $_.ProcessId -eq $parentId } | Select-Object -First 1
  }
  return $allowed
}
function Assert-Idle {
  $idleProcesses = @(Get-CimInstance -ClassName Win32_Process)
  $idleCoordinators = @(Get-MaintenanceCoordinatorPids -Processes $idleProcesses)
  # Relative node commands do not expose cwd; treat matching tools as busy too.
  $busy = @($idleProcesses | Where-Object {
    # A downloaded app uses its own runtime tree, not this source workspace.
    # Unknown executable paths/arguments remain protected.
    $unrelatedDesktop = $_.Name -eq 'TableMax.exe' -and $_.ExecutablePath -and $_.CommandLine -and
      [IO.Path]::IsPathRooted([string]$_.ExecutablePath) -and
      -not ([string]$_.ExecutablePath).StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase) -and
      -not ([string]$_.ExecutablePath).StartsWith($sourceWorkspace + '\', [StringComparison]::OrdinalIgnoreCase) -and
      ([string]$_.CommandLine).IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -lt 0 -and
      ([string]$_.CommandLine).IndexOf($sourceWorkspace, [StringComparison]::OrdinalIgnoreCase) -lt 0
    # Codex's persistent interpreter carries cwd in its arguments even when idle.
    # Identify only its bundled bootstrap, never project children or unknown Node.
    $codexToolKernel = $_.Name -eq 'node.exe' -and
      ([string]$_.ExecutablePath) -match '[\\/]OpenAI[\\/]Codex[\\/]runtimes[\\/]cua_node[\\/][^\\/]+[\\/]bin[\\/]node\.exe$' -and
      ([string]$_.CommandLine) -match '--experimental-vm-modules' -and
      ([string]$_.CommandLine) -match '(?:[\\/]kernel\.js\s+--session-id\s+[0-9a-f]+\s+--working-dir\s+|[\\/]trusted-worker\.js\s+)'
    -not $codexToolKernel -and $_.ProcessId -notin $idleCoordinators -and $_.Name -match '^(node|electron|TableMax|dotnet|MSBuild|msedgewebview2|7za|7z)\.exe$' -and (
      -not $_.CommandLine -or ($_.Name -eq 'TableMax.exe' -and -not $unrelatedDesktop) -or
      ([string]$_.ExecutablePath).IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      ([string]$_.CommandLine).IndexOf($workspace, [StringComparison]::OrdinalIgnoreCase) -ge 0 -or
      $_.CommandLine -match '(scripts[\\/](verify|dev|build|package|publish|assemble|clean-build|launch)|apps[\\/]desktop[\\/]native|electron-builder|vitest|\b(pnpm|npm)\b.*\b(build|dev|test|check|package:win|release:github|verify:\w+)\b)'
    )
  })
  if ($busy.Count -gt 0) {
    throw ('Close TableMax and finish development/verification before cleanup. Busy PIDs: ' + (($busy | ForEach-Object { $_.ProcessId }) -join ', '))
  }
}
