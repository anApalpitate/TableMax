[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$IncludeBuild,
  [string]$ProjectRoot,
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30
)

& (Join-Path $PSScriptRoot 'scripts/cleanup-local.ps1') -Kind Intermediates -Apply:$Apply -ProjectRoot $ProjectRoot -IncludeBuild:$IncludeBuild -MinimumAgeMinutes $MinimumAgeMinutes
