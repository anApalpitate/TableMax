[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ProjectRoot,
  [ValidateRange(0.001, 1024)][double]$HighWaterGiB = 5,
  [ValidateRange(0, 1024)][double]$LowWaterGiB = 4
)

# Run at an idle engineering boundary, after build/verification processes exit.
# No timer, background worker, or runtime process is created by this entry point.
& (Join-Path $PSScriptRoot 'scripts/cleanup-local.ps1') -Kind Maintenance -Apply:$Apply -ProjectRoot $ProjectRoot -HighWaterGiB $HighWaterGiB -LowWaterGiB $LowWaterGiB
