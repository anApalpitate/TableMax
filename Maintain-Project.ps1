[CmdletBinding()]
param(
  [switch]$Apply,
  [string]$ProjectRoot,
  [ValidateRange(0.001, 1024)][double]$HighWaterGiB = 10,
  [ValidateRange(0, 1024)][double]$LowWaterGiB = 8
)

# Run at an idle engineering boundary, after build/verification processes exit.
# No timer, background worker, or runtime process is created by this entry point.
& (Join-Path $PSScriptRoot 'tools/maintenance/cleanup-local.ps1') -Kind Maintenance -Apply:$Apply -ProjectRoot $ProjectRoot -HighWaterGiB $HighWaterGiB -LowWaterGiB $LowWaterGiB
