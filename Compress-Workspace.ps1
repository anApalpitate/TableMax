[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ProjectRoot,
  [ValidateRange(4096, 1073741824)][long]$MinimumBytes = 65536
)

& (Join-Path $PSScriptRoot 'tools/maintenance/compress-workspace.ps1') -Apply:$Apply -ProjectRoot $ProjectRoot -MinimumBytes $MinimumBytes
