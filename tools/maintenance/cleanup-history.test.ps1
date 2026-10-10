param([string]$EvidenceDirectory)
$ErrorActionPreference='Stop'
$projectForTest=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$fixture=Join-Path $projectForTest ('tmp/cleanup-history-test-'+[Guid]::NewGuid().ToString('N'))
$checks=New-Object 'System.Collections.Generic.List[string]'
$busy=$null
function File([string]$Path,[string]$Text){$full=Join-Path $fixture $Path;New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force|Out-Null;[IO.File]::WriteAllText($full,$Text);(Get-Item $full).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)}
function Check([bool]$Value,[string]$Message){if(-not $Value){throw $Message};$checks.Add($Message)}
function Reject([scriptblock]$Action,[string]$Message){$failed=$false;try{& $Action|Out-Null}catch{$failed=$true};Check $failed $Message}
function Hash([string]$Path){(Get-FileHash -LiteralPath (Join-Path $fixture $Path)).Hash.ToLowerInvariant()}
function Plan{File 'artifacts/maintenance/cleanup-history/manifest.json' (@{version=1;currentArchiveSha256=$currentHash;entries=@($entry)}|ConvertTo-Json -Depth 8)}
function Run([switch]$Apply,[string]$Kind='Intermediates'){& (Join-Path $fixture 'tools/maintenance/cleanup-local.ps1') -Kind $Kind -RetiredGeneratedManifest 'artifacts/maintenance/cleanup-history/manifest.json' -Apply:$Apply}
function Age{Get-ChildItem -LiteralPath $fixture -Force -Recurse|Where-Object{$_.Name -ne 'TableMax.exe'}|ForEach-Object{$_.LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)}}
function Archive([switch]$OmitDatabase){
  $path=Join-Path $fixture $archiveRelative
  if(Test-Path -LiteralPath $path){Remove-Item -LiteralPath $path -Force}
  $zip=[IO.Compression.ZipFile]::Open($path,[IO.Compression.ZipArchiveMode]::Create)
  try{foreach($file in $entry.files){if($OmitDatabase -and $file.path.EndsWith('.sqlite')){continue};[IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip,(Join-Path $fixture $file.path),$file.path)|Out-Null}}finally{$zip.Dispose()}
  $entry.archive.sha256=Hash $archiveRelative;$entry.evidence[0].sha256=$entry.archive.sha256
}
try{
  File 'package.json' '{"name":"tablemax","version":"1.0.3"}'
  File 'artifacts/releases/TableMax-1.0.3-win-x64.zip' 'current-runtime'
  $currentHash=Hash 'artifacts/releases/TableMax-1.0.3-win-x64.zip'
  File 'artifacts/maintenance/v1.0.3/proof/results.json' (@{portable=$true;result='passed';archiveSha256=$currentHash}|ConvertTo-Json)
  $old='artifacts/maintenance/local-cleanup-20261003-195855-474-intermediates'
  File ($old+'/cleanup.json') '{"result":"failed","reason":"preserved historical result"}'
  File ($old+'/reviewed-temporary-content/data/room.sqlite') 'migration-original'
  File 'artifacts/maintenance/cleanup-history/records/old.json' '{"result":"failed","reason":"preserved historical result"}'
  New-Item -ItemType Directory -Path (Join-Path $fixture 'tools/maintenance') -Force|Out-Null
  foreach($script in @('cleanup-local.ps1','cleanup-guard.ps1','WorkspaceSnapshot.cs','retired-generated.ps1','cleanup-history.ps1')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $fixture ('tools/maintenance/'+$script))}
  $inventory=@(Get-ChildItem (Join-Path $fixture $old) -File -Recurse|ForEach-Object{@{path=$_.FullName.Substring($fixture.Length+1).Replace('\','/');bytes=$_.Length;sha256=(Get-FileHash $_.FullName).Hash.ToLowerInvariant()}})
  ($inventory|Where-Object{$_.path.EndsWith('/cleanup.json')}).retainedPath='artifacts/maintenance/cleanup-history/records/old.json'
  $archiveRelative='artifacts/maintenance/cleanup-history/preserved.zip'
  $entry=@{path=$old;kind='consolidated-cleanup-history';reason='Lossless verified consolidation';files=$inventory;archive=@{path=$archiveRelative;sha256=''};evidence=@(@{path=$archiveRelative;sha256=''})}
  Add-Type -AssemblyName System.IO.Compression;Add-Type -AssemblyName System.IO.Compression.FileSystem
  Archive;Plan;Age;Run|Out-Null
  Check (Test-Path (Join-Path $fixture $old)) 'Preview preserves original cleanup folder'
  Reject {Run -Kind Maintenance} 'Automatic cleanup cannot consolidate history'
  $saved=$entry.path;$entry.path='artifacts/maintenance/local-cleanup-unknown';Plan;Reject {Run} 'Unknown cleanup root rejected';$entry.path=$saved
  $savedKind=$entry.kind;$entry.kind='runtime-copy';Plan;Reject {Run} 'Cleanup history cannot masquerade as a regenerable runtime';$entry.kind=$savedKind
  $savedHash=$entry.archive.sha256;$entry.archive.sha256='0'*64;Plan;Reject {Run -Apply} 'Changed archive hash blocks deletion';$entry.archive.sha256=$savedHash
  Archive -OmitDatabase;Plan;Reject {Run -Apply} 'Archive missing database blocks deletion'
  Check (Test-Path (Join-Path $fixture ($old+'/reviewed-temporary-content/data/room.sqlite'))) 'Missing archive member preserves original database'
  Archive;Plan
  File 'artifacts/maintenance/cleanup-history/records/old.json' 'changed-result';Reject {Run} 'Changed readable report blocks deletion'
  File 'artifacts/maintenance/cleanup-history/records/old.json' '{"result":"failed","reason":"preserved historical result"}'
  $report=$entry.files|Where-Object{$_.path.EndsWith('/cleanup.json')};$savedRetained=$report.retainedPath;$report.retainedPath=$report.path;Plan;Reject {Run} 'Readable report inside deletion directory rejected';$report.retainedPath=$savedRetained
  Plan;Age
  Copy-Item -LiteralPath (Get-Command node).Source -Destination (Join-Path $fixture 'TableMax.exe')
  $busy=Start-Process -FilePath (Join-Path $fixture 'TableMax.exe') -ArgumentList '-e','"setInterval(() => {}, 1000)"' -WindowStyle Hidden -PassThru
  Reject {Run -Apply} 'Running TableMax inside the selected workspace blocks consolidation'
  Stop-Process -Id $busy.Id -Force;$busy.WaitForExit();$busy=$null
  Plan;Age;(Get-Item (Join-Path $fixture $old)).LastWriteTimeUtc=[DateTime]::UtcNow
  Run -Apply|Out-Null;Check (Test-Path (Join-Path $fixture $old)) 'Recent cleanup folder protected'
  Age;Run -Apply|Out-Null
  Check (-not (Test-Path (Join-Path $fixture $old))) 'Verified original cleanup folder removed'
  Check (Test-Path (Join-Path $fixture $archiveRelative)) 'Lossless archive retained'
  Check ((Hash 'artifacts/maintenance/cleanup-history/records/old.json') -eq $report.sha256) 'Original readable report hash retained'
  Check (@(Get-ChildItem (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter 'local-cleanup-*').Count -eq 0) 'Consolidation creates no new local-cleanup folder'
  $operation=Get-ChildItem (Join-Path $fixture 'artifacts/maintenance/cleanup-history/operations') -Filter cleanup.json -Recurse|Select-Object -First 1
  $result=Get-Content $operation.FullName -Raw|ConvertFrom-Json
  Check ($result.result -eq 'passed' -and $result.candidates[0].retiredGenerated.archive.sha256 -eq $entry.archive.sha256) 'Operation report links exact preservation archive'
  if(-not $EvidenceDirectory){$EvidenceDirectory=Join-Path $projectForTest 'artifacts/maintenance/cleanup-history/tool-checks/consolidation'}
  New-Item -ItemType Directory -Path $EvidenceDirectory -Force|Out-Null
  @{result='passed';count=$checks.Count;checks=$checks.ToArray()}|ConvertTo-Json -Depth 4|Set-Content (Join-Path $EvidenceDirectory 'results.json') -Encoding utf8
  Write-Host ($checks.Count.ToString()+' cleanup history consolidation checks passed.')
}finally{
  if($busy -and -not $busy.HasExited){Stop-Process -Id $busy.Id -Force;$busy.WaitForExit()}
  if(Test-Path -LiteralPath $fixture){$absolute=[IO.Path]::GetFullPath($fixture);if(-not $absolute.StartsWith($projectForTest+'\tmp\',[StringComparison]::OrdinalIgnoreCase)){throw 'Test fixture escapes project tmp.'};Remove-Item -LiteralPath $absolute -Recurse -Force}
}
