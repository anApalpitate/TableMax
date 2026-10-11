$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$workspace = Join-Path $root ('tmp/tmp-retirement-test-' + [Guid]::NewGuid().ToString('N'))
$maintenance = Join-Path $workspace 'artifacts/maintenance'
$temporary = Join-Path $workspace 'tmp'
$releases = Join-Path $workspace 'artifacts/releases'
$project = [PSCustomObject]@{version='1.0.6'}
$archiveHash = 'a' * 64
$cutoff = [DateTime]::UtcNow.AddMinutes(-30)
$Apply = $false
$checks = 0
$busy = $false
$idleCalls = 0
$idleHook = $null
function Assert-LocalPath([string]$Path) {
  $absolute = [IO.Path]::GetFullPath($Path)
  if (-not $absolute.StartsWith($workspace + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'outside fixture' }
  $cursor = $absolute
  while ($cursor -and $cursor -ne $workspace) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'linked fixture' }
    $cursor = Split-Path $cursor -Parent
  }
  return $absolute
}
function Assert-Idle { if ($busy) { throw 'busy fixture' }; $script:idleCalls++; if ($idleHook) { & $idleHook } }
function Assert-PreservedRelease { }
function Check([bool]$Condition) { if (-not $Condition) { throw 'Retirement assertion failed.' }; $script:checks++ }
function Write-Fixture([string]$Name) {
  $path=Join-Path $workspace ('tmp/' + $Name)
  New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($path,'fixture')
  (Get-Item -LiteralPath $path).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)
  $item=Get-Item -LiteralPath $path
  return [PSCustomObject]@{path='tmp/'+$Name;bytes=$item.Length;lastWriteTimeUtcTicks=$item.LastWriteTimeUtc.Ticks}
}
try {
  New-Item -ItemType Directory -Path $maintenance -Force | Out-Null
  . (Join-Path $PSScriptRoot 'temporary-retirement.ps1')
  $selected=Write-Fixture 'selected/old.txt'
  $unlisted=Write-Fixture 'selected/unlisted.txt'
  $TemporaryManifest=Join-Path $maintenance 'plan.json'
  New-Item -ItemType Directory -Path $releases -Force | Out-Null
  $payload=Join-Path $releases 'TableMax-1.0.6-win-x64.zip';[IO.File]::WriteAllText($payload,'proven payload')
  $archiveHash=(Get-FileHash -LiteralPath $payload -Algorithm SHA256).Hash.ToLowerInvariant()
  $proofPath=Join-Path $maintenance 'proof.json'
  $validProof=[PSCustomObject]@{result='passed';portable=$true;archiveSha256=$archiveHash}
  $validProof | ConvertTo-Json | Set-Content -LiteralPath $proofPath -Encoding utf8
  $plan=[PSCustomObject]@{version=1;authorization='retire-reviewed-tmp-once';id='fixture-once';currentVersion='1.0.6';archivePath='artifacts/releases/TableMax-1.0.6-win-x64.zip';proofPath='artifacts/maintenance/proof.json';archiveSha256=$archiveHash;entries=@([PSCustomObject]@{name='selected';reason='reviewed fixture';files=@($selected)})}
  function Save-Plan { $plan | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $TemporaryManifest -Encoding utf8 }
  Save-Plan
  $verified=Read-TmpRetirementProof
  Check ($verified.archiveSha256 -eq $archiveHash -and $verified.files.Count -eq 2)
  foreach ($mutation in @('hash','result','outside','old-version')) {
    if($mutation -eq 'hash'){$plan.archiveSha256='0'*64}
    if($mutation -eq 'result'){[IO.File]::WriteAllText($proofPath,'{"result":"failed","portable":true}')}
    if($mutation -eq 'outside'){$plan.archivePath='tmp/selected/old.txt'}
    if($mutation -eq 'old-version'){$plan.archivePath='artifacts/releases/TableMax-1.0.5-win-x64.zip'}
    Save-Plan;$refused=$false;try{Read-TmpRetirementProof | Out-Null}catch{$refused=$true};Check $refused
    $plan.archiveSha256=$archiveHash;$plan.archivePath='artifacts/releases/TableMax-1.0.6-win-x64.zip';$validProof | ConvertTo-Json | Set-Content -LiteralPath $proofPath -Encoding utf8
  }
  Save-Plan
  Invoke-TemporaryRetirement
  Check ((Test-Path -LiteralPath (Join-Path $workspace $selected.path)) -and -not (Test-Path -LiteralPath (Join-Path $maintenance 'tmp-retirements')))
  foreach ($invalid in @('tmp/../source.txt','tmp/selected/../../source.txt','tmp/selected/*','tmp/selected\\old.txt','assets/old.txt','tmp/.git/config')) {
    $refused=$false;try { Resolve-TmpRetirementPath $invalid | Out-Null } catch { $refused=$true };Check $refused
  }
  $plan.entries[0].files=@($selected,$selected);Save-Plan
  $refused=$false;try { Invoke-TemporaryRetirement } catch { $refused=$true };Check $refused
  $plan.entries[0].files=@($selected);Save-Plan
  $busy=$true;$Apply=$true
  $refused=$false;try { Invoke-TemporaryRetirement } catch { $refused=$true };Check ($refused -and -not (Test-Path -LiteralPath (Join-Path $maintenance 'tmp-retirements')))
  $busy=$false
  [IO.File]::WriteAllText((Join-Path $workspace $selected.path),'changed')
  Invoke-TemporaryRetirement
  Check (Test-Path -LiteralPath (Join-Path $workspace $selected.path))
  # The changed selection is skipped, and this application consumes the manifest.
  Check ((Get-Content (Join-Path $maintenance 'tmp-retirements/fixture-once.json') -Raw | ConvertFrom-Json).deletedFiles -eq 0)
  $refused=$false;try { Invoke-TemporaryRetirement } catch { $refused=$true };Check $refused
  $plan.id='fixture-delete';$plan.entries[0].files=@($unlisted);Save-Plan
  Invoke-TemporaryRetirement
  Check (-not (Test-Path -LiteralPath (Join-Path $workspace $unlisted.path)))
  Check (Test-Path -LiteralPath (Join-Path $workspace $selected.path))
  Check (@(Get-ChildItem -LiteralPath $maintenance -Recurse -Filter unlisted.txt).Count -eq 0)
  $plan.id='fixture-linked';$target=Join-Path $workspace 'outside';New-Item -ItemType Directory -Path $target | Out-Null
  [IO.File]::WriteAllText((Join-Path $target 'keep.txt'),'outside')
  New-Item -ItemType Junction -Path (Join-Path $temporary 'linked') -Target $target | Out-Null
  $refused=$false;try { Resolve-TmpRetirementPath 'tmp/linked/keep.txt' | Out-Null } catch { $refused=$true };Check $refused
  $nested=Write-Fixture 'nested/keep.txt';New-Item -ItemType Directory -Path (Join-Path $temporary 'nested/.git') | Out-Null
  $refused=$false;try { Assert-TmpRetirementFile $nested | Out-Null } catch { $refused=$true };Check $refused
  $siblingFile=Write-Fixture 'siblings/selected.txt'
  New-Item -ItemType Junction -Path (Join-Path $temporary 'siblings/link') -Target $target | Out-Null
  $plan.id='fixture-link-sibling';$plan.entries=@([PSCustomObject]@{name='siblings';reason='regular file beside junction';files=@($siblingFile)});Save-Plan
  Invoke-TemporaryRetirement
  Check ((Test-Path -LiteralPath (Join-Path $target 'keep.txt')) -and (Test-Path -LiteralPath (Join-Path $temporary 'siblings/link')) -and -not (Test-Path -LiteralPath (Join-Path $workspace $siblingFile.path)))
  $first=Write-Fixture 'partial/first.txt';$second=Write-Fixture 'partial/second.txt'
  $plan.id='fixture-partial';$plan.entries=@([PSCustomObject]@{name='partial';reason='mutation before second deletion';files=@($first,$second)});Save-Plan
  $idleCalls=0;$idleHook={if($idleCalls -eq 2){[IO.File]::WriteAllText((Join-Path $workspace $second.path),'mutated')}}
  $refused=$false;try { Invoke-TemporaryRetirement } catch { $refused=$true };$idleHook=$null
  $partial=Get-Content (Join-Path $maintenance 'tmp-retirements/fixture-partial.json') -Raw | ConvertFrom-Json
  Check ($refused -and $partial.result -eq 'failed' -and $partial.deletedFiles -eq 1 -and (Test-Path -LiteralPath (Join-Path $workspace $second.path)))
  $refused=$false;try { Invoke-TemporaryRetirement } catch { $refused=$true };Check $refused
  Write-Host ('Temporary retirement: ' + $checks + ' checks passed.')
}
finally {
  $link=Join-Path $temporary 'linked'
  if (Test-Path -LiteralPath $link) { [IO.Directory]::Delete($link) }
  $siblingLink=Join-Path $temporary 'siblings/link'
  if (Test-Path -LiteralPath $siblingLink) { [IO.Directory]::Delete($siblingLink) }
  if ($workspace.StartsWith($root+'\tmp\tmp-retirement-test-') -and (Test-Path -LiteralPath $workspace)) { Remove-Item -LiteralPath $workspace -Recurse -Force }
}
