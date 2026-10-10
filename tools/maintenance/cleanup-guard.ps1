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
  $entry = [IO.Path]::GetFullPath($record.entrypoint)
  $entrypoints = @(
    'tools/build/build.mjs'
    'tools/release/package-release.mjs'
    'tools/release/package.mjs'
    'tools/test/games/avalon/verify-avalon.mjs'
    'tools/test/box/verify-box-avatars.mjs'
    'tools/test/box/verify-box-debug.mjs'
    'tools/test/box/verify-box-layout.mjs'
    'tools/test/box/verify-box-notifications.mjs'
    'tools/test/box/verify-box-repository.mjs'
    'tools/test/box/verify-box-seats.mjs'
    'tools/build/verify-cache-failures.mjs'
    'tools/test/platform/verify-card-layout.mjs'
    'tools/test/platform/verify-connection-entry.mjs'
    'tools/test/platform/verify-debug-20261007.mjs'
    'tools/test/platform/verify-debug-recovery.mjs'
    'tools/test/platform/verify-debug-remote.mjs'
    'tools/test/desktop/verify-desktop.mjs'
    'tools/test/desktop/verify-display.mjs'
    'tools/test/platform/verify-experience.mjs'
    'tools/test/desktop/verify-fullscreen.mjs'
    'tools/test/platform/verify-game-introduction.mjs'
    'tools/test/box/verify-game-library.mjs'
    'tools/test/platform/verify-game-prototype.mjs'
    'tools/test/platform/verify-game-ui.mjs'
    'tools/test/platform/verify-interactions.mjs'
    'tools/test/games/modern-art/verify-modern-art-audio.mjs'
    'tools/test/games/modern-art/verify-modern-art-debug.mjs'
    'tools/test/games/modern-art/verify-modern-art-empty-gallery.mjs'
    'tools/test/games/modern-art/verify-modern-art-polish-v2.mjs'
    'tools/test/platform/verify-modern-art-polish.mjs'
    'tools/test/platform/verify-modern-art.mjs'
    'tools/build/verify-module-build.mjs'
    'tools/build/verify-module-runtime-input.mjs'
    'tools/test/desktop/verify-native-safety.mjs'
    'tools/test/platform/verify-party.mjs'
    'tools/test/platform/verify-play-presentation.mjs'
    'tools/test/desktop/verify-player-display.mjs'
    'tools/test/platform/verify-player-interaction-audio.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-audio.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-effects.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-expansion-awards.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-expansion-effects.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-expansion-play.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-expansion.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-original-compatibility.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-polish.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-ui-redesign.mjs'
    'tools/test/games/pokemon-encounters/verify-pokemon-version.mjs'
    'tools/test/platform/verify-pokemon.mjs'
    'tools/test/desktop/verify-portable-storage.mjs'
    'tools/test/games/power-grid/verify-power-grid-audio.mjs'
    'tools/test/games/power-grid/verify-power-grid-ui.mjs'
    'tools/test/platform/verify-power-grid.mjs'
    'tools/maintenance/verify-project.mjs'
    'tools/test/platform/verify-prototype.mjs'
    'tools/release/verify-release-executable.mjs'
    'tools/test/platform/verify-room-levels.mjs'
    'tools/test/platform/verify-root-entry.mjs'
    'tools/test/platform/verify-rules-guides.mjs'
    'tools/test/games/rummikub/verify-rummikub-runtime.mjs'
    'tools/test/games/rummikub/verify-rummikub-ui.mjs'
    'tools/test/desktop/verify-runtime-memory.mjs'
    'tools/test/platform/verify-save-storage-games.mjs'
    'tools/release/verify-shipping-executable.mjs'
    'tools/test/platform/verify-speech-panel.mjs'
    'tools/test/platform/verify-test-silence.mjs'
    'tools/test/games/uno/verify-uno.mjs'
  )
  $relativeEntry = if ($entry.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { $entry.Substring($workspace.Length + 1).Replace('\', '/') } else { '' }
  if ($record.schemaVersion -ne 1 -or $record.phase -ne 'idle' -or $relativeEntry -notin $entrypoints -or -not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw 'Unknown idle coordinator; files preserved.' }
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
      $_.CommandLine -match '(tools[\\/](?:dev|build|release|test|assets|analysis|maintenance)[\\/]|apps[\\/]desktop[\\/]native|electron-builder|vitest|\b(pnpm|npm)\b.*\b(build|dev|test|check|package:win|release:github|verify:\w+)\b)'
    )
  })
  if ($busy.Count -gt 0) {
    throw ('Close TableMax and finish development/verification before cleanup. Busy PIDs: ' + (($busy | ForEach-Object { $_.ProcessId }) -join ', '))
  }
}
