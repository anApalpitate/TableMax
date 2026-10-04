[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ProjectRoot,
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30,
  [switch]$KeepLatestOnly,
  [ValidatePattern('^\d+\.\d+\.\d+$')][string[]]$RetiredVersions = @()
)

& (Join-Path $PSScriptRoot 'scripts/cleanup-local.ps1') -Kind Releases -Apply:$Apply -ProjectRoot $ProjectRoot -MinimumAgeMinutes $MinimumAgeMinutes -KeepLatestOnly:$KeepLatestOnly -RetiredVersions $RetiredVersions
