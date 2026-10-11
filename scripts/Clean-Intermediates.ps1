[CmdletBinding()]
param(
  [switch]$Apply,
  [switch]$IncludeBuild,
  [string]$ProjectRoot,
  [string[]]$TemporaryNames = @(),
  [string]$TemporaryManifest,
  [string]$ReviewedFilesManifest,
  [string]$ReviewedFilesManifestSha256,
  [string[]]$VerificationCopies = @(),
  [string]$DuplicateScreenshotsManifest,
  [string]$RetiredGeneratedManifest,
  [string]$HistoricalScreenshotsManifest,
  [string]$ImageCopiesManifest,
  [ValidateRange(0, 10080)][int]$MinimumAgeMinutes = 30
)

$cleanupOptions = @{
  Kind = 'Intermediates'; Apply = $Apply; ProjectRoot = $ProjectRoot
  IncludeBuild = $IncludeBuild; TemporaryNames = $TemporaryNames; MinimumAgeMinutes = $MinimumAgeMinutes
}
if ($PSBoundParameters.ContainsKey('TemporaryManifest')) { $cleanupOptions.TemporaryManifest = $TemporaryManifest }
if ($PSBoundParameters.ContainsKey('ReviewedFilesManifest')) { $cleanupOptions.ReviewedFilesManifest = $ReviewedFilesManifest }
if ($PSBoundParameters.ContainsKey('ReviewedFilesManifestSha256')) { $cleanupOptions.ReviewedFilesManifestSha256 = $ReviewedFilesManifestSha256 }
if ($PSBoundParameters.ContainsKey('VerificationCopies')) { $cleanupOptions.VerificationCopies = $VerificationCopies }
if ($PSBoundParameters.ContainsKey('DuplicateScreenshotsManifest')) { $cleanupOptions.DuplicateScreenshotsManifest = $DuplicateScreenshotsManifest }
if ($PSBoundParameters.ContainsKey('RetiredGeneratedManifest')) { $cleanupOptions.RetiredGeneratedManifest = $RetiredGeneratedManifest }
if ($PSBoundParameters.ContainsKey('HistoricalScreenshotsManifest')) { $cleanupOptions.HistoricalScreenshotsManifest = $HistoricalScreenshotsManifest }
if ($PSBoundParameters.ContainsKey('ImageCopiesManifest')) { $cleanupOptions.ImageCopiesManifest = $ImageCopiesManifest }
& (Join-Path $PSScriptRoot '../tools/maintenance/cleanup-local.ps1') @cleanupOptions
