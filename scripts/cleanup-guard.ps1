function Assert-Idle {
  # Relative node commands do not expose cwd; treat matching tools as busy too.
  $busy = @(Get-CimInstance -ClassName Win32_Process | Where-Object {
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
    -not $codexToolKernel -and $_.Name -match '^(node|electron|TableMax|dotnet|MSBuild|msedgewebview2|7za|7z)\.exe$' -and (
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
