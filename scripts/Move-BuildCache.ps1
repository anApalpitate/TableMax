param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination
)
$ErrorActionPreference = 'Stop'
$cacheRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.cache/build-modules/v1')) + [System.IO.Path]::DirectorySeparatorChar
$sourcePath = [System.IO.Path]::GetFullPath($Source)
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
foreach ($cachePath in @($sourcePath, $destinationPath)) {
    if (-not $cachePath.StartsWith($cacheRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Cache move outside workspace cache rejected'
    }
    $ancestorPath = $cachePath
    while ($ancestorPath.Length -ge $cacheRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar).Length) {
        if (Test-Path -LiteralPath $ancestorPath) {
            $ancestorItem = Get-Item -LiteralPath $ancestorPath
            if ($ancestorItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
                throw 'Linked cache ancestor rejected'
            }
        }
        $parentPath = [System.IO.Path]::GetDirectoryName($ancestorPath)
        if (-not $parentPath -or $parentPath -eq $ancestorPath) { break }
        $ancestorPath = $parentPath
    }
}
if (Test-Path -LiteralPath $destinationPath) { throw 'Cache destination already exists' }
$sourceItem = Get-Item -LiteralPath $sourcePath
if ($sourceItem.Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'Linked cache rejected' }
Move-Item -LiteralPath $sourcePath -Destination $destinationPath
