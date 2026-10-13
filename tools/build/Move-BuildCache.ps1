param(
    [Parameter(Mandatory = $true)][string]$Source,
    [Parameter(Mandatory = $true)][string]$Destination,
    [string]$CacheRoot
)
$ErrorActionPreference = 'Stop'
$taskCacheRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../.cache/build-modules/v1')) + [System.IO.Path]::DirectorySeparatorChar
$guardRoot = $taskCacheRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
if ($CacheRoot) {
    $requestedRoot = [System.IO.Path]::GetFullPath($CacheRoot).TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
    $fixtureParent = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../tmp')) + [System.IO.Path]::DirectorySeparatorChar
    if ($requestedRoot -ne $taskCacheRoot -and
        (-not $requestedRoot.StartsWith($fixtureParent, [System.StringComparison]::OrdinalIgnoreCase) -or
        $requestedRoot.Substring($fixtureParent.Length) -notmatch '^efficiency-build-[A-Za-z0-9]{6}[\\/]')) {
        throw 'Isolated cache root outside efficiency fixture rejected'
    }
    $taskCacheRoot = $requestedRoot
    if ($requestedRoot.StartsWith($fixtureParent, [System.StringComparison]::OrdinalIgnoreCase)) {
        $guardRoot = $fixtureParent.TrimEnd([System.IO.Path]::DirectorySeparatorChar)
    }
}
$sourcePath = [System.IO.Path]::GetFullPath($Source)
$destinationPath = [System.IO.Path]::GetFullPath($Destination)
foreach ($cachePath in @($sourcePath, $destinationPath)) {
    if (-not $cachePath.StartsWith($taskCacheRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Cache move outside workspace cache rejected'
    }
    $ancestorPath = $cachePath
    while ($ancestorPath.Length -ge $guardRoot.Length) {
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
