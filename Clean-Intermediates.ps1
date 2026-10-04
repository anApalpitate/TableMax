[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$IncludeBuild,
  [string]$ProjectRoot,
  [string[]]$TemporaryNames = @(),
  [string[]]$VerificationCopies = @(),
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30
)

$cleanupOptions = @{
  Kind = 'Intermediates'; Apply = $Apply; ProjectRoot = $ProjectRoot
  IncludeBuild = $IncludeBuild; TemporaryNames = $TemporaryNames; MinimumAgeMinutes = $MinimumAgeMinutes
}
if ($PSBoundParameters.ContainsKey('VerificationCopies')) { $cleanupOptions.VerificationCopies = $VerificationCopies }
& (Join-Path $PSScriptRoot 'scripts/cleanup-local.ps1') @cleanupOptions
