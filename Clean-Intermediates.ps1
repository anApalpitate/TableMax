[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$IncludeBuild,
  [string]$ProjectRoot,
  [string[]]$TemporaryNames = @(),
  [string[]]$VerificationCopies = @(),
  [string]$DuplicateScreenshotsManifest,
  [string]$RetiredGeneratedManifest,
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30
)

$cleanupOptions = @{
  Kind = 'Intermediates'; Apply = $Apply; ProjectRoot = $ProjectRoot
  IncludeBuild = $IncludeBuild; TemporaryNames = $TemporaryNames; MinimumAgeMinutes = $MinimumAgeMinutes
}
if ($PSBoundParameters.ContainsKey('VerificationCopies')) { $cleanupOptions.VerificationCopies = $VerificationCopies }
if ($PSBoundParameters.ContainsKey('DuplicateScreenshotsManifest')) { $cleanupOptions.DuplicateScreenshotsManifest = $DuplicateScreenshotsManifest }
if ($PSBoundParameters.ContainsKey('RetiredGeneratedManifest')) { $cleanupOptions.RetiredGeneratedManifest = $RetiredGeneratedManifest }
& (Join-Path $PSScriptRoot 'scripts/cleanup-local.ps1') @cleanupOptions
