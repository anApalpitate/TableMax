param([string]$EvidenceDirectory)
$ErrorActionPreference='Stop'
$testProject=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$fixture=Join-Path $testProject ('tmp/historical-screenshot-test-'+[Guid]::NewGuid().ToString('N'))
$checks=New-Object 'System.Collections.Generic.List[string]'
function File([string]$Path,[string]$Text){$full=Join-Path $fixture $Path;New-Item -ItemType Directory -Path (Split-Path $full -Parent) -Force|Out-Null;[IO.File]::WriteAllText($full,$Text);(Get-Item $full).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)}
function Check([bool]$Value,[string]$Message){if(-not $Value){throw $Message};$checks.Add($Message)}
function Reject([scriptblock]$Action,[string]$Message){$failed=$false;try{& $Action|Out-Null}catch{$failed=$true};Check $failed $Message}
function Plan{File 'artifacts/maintenance/v1.0.3/audit/manifest.json' ($plan|ConvertTo-Json -Depth 8)}
function Run([switch]$Apply,[string]$Kind='Intermediates') { & (Join-Path $fixture 'tools/maintenance/cleanup-local.ps1') -Kind $Kind -HistoricalScreenshotsManifest 'artifacts/maintenance/v1.0.3/audit/manifest.json' -Apply:$Apply }
function Age{Get-ChildItem -LiteralPath $fixture -Recurse -Force|ForEach-Object{$_.LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)}}
try{
  File 'package.json' '{"name":"tablemax","version":"1.0.3"}'
  File 'artifacts/releases/TableMax-1.0.3-win-x64.zip' 'runtime'
  $archiveHash=(Get-FileHash (Join-Path $fixture 'artifacts/releases/TableMax-1.0.3-win-x64.zip')).Hash.ToLowerInvariant()
  File 'artifacts/maintenance/v1.0.3/proof/results.json' (@{portable=$true;result='passed';archiveSha256=$archiveHash}|ConvertTo-Json)
  File 'artifacts/maintenance/v1.0.3/audit/authorization.json' '{"scope":"User authorizes historical screenshot retirement"}'
  File 'artifacts/maintenance/v1.0.2/run/unique.png' 'unique-frame'
  File 'artifacts/maintenance/v1.0.2/run/results.json' '{"result":"failed","reason":"historical failure"}'
  File 'artifacts/maintenance/v1.0.2/run/room.sqlite' 'saved-data'
  File 'artifacts/maintenance/v1.0.2/imagegen/original.png' 'original-material'
  File 'artifacts/maintenance/v1.0.3/run/current.png' 'current-evidence'
  New-Item -ItemType Directory -Path (Join-Path $fixture 'tools/maintenance') -Force|Out-Null
  foreach($script in @('cleanup-local.ps1','cleanup-guard.ps1','WorkspaceSnapshot.cs','historical-screenshots.ps1')){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $script) -Destination (Join-Path $fixture ('tools/maintenance/'+$script))}
  $file=@{path='artifacts/maintenance/v1.0.2/run/unique.png';bytes=12;sha256=(Get-FileHash (Join-Path $fixture 'artifacts/maintenance/v1.0.2/run/unique.png')).Hash.ToLowerInvariant()}
  $evidence=@{path='artifacts/maintenance/v1.0.3/audit/authorization.json';sha256=(Get-FileHash (Join-Path $fixture 'artifacts/maintenance/v1.0.3/audit/authorization.json')).Hash.ToLowerInvariant()}
  $group=@{path='artifacts/maintenance/v1.0.2';reason='Authorized historical screenshots';files=@($file);evidence=@($evidence)}
  $plan=@{version=1;authorization='retire-historical-screenshots';currentVersion='1.0.3';currentArchiveSha256=$archiveHash;groups=@($group)}
  Plan;Age;Run|Out-Null
  Check (Test-Path (Join-Path $fixture $file.path)) 'Preview keeps unique historical screenshot'
  Check (@(Get-ChildItem (Join-Path $fixture 'artifacts/maintenance') -Directory -Filter 'local-cleanup-*').Count -eq 0) 'Preview creates no deletion report'
  Reject {Run -Kind Maintenance} 'Automatic mode rejects screenshot retirement'
  $plan.authorization='unapproved';Plan;Reject {Run} 'Missing explicit authorization rejected';$plan.authorization='retire-historical-screenshots'
  $plan.currentArchiveSha256='0'*64;Plan;Reject {Run} 'Wrong current archive hash rejected';$plan.currentArchiveSha256=$archiveHash
  $plan.groups=@($group,$group);Plan;Reject {Run} 'Repeated historical root rejected';$plan.groups=@($group)
  $savedPath=$group.path
  foreach($path in @('artifacts/maintenance/v1.0.3','artifacts/maintenance/v1.0.4','artifacts/maintenance/unknown','artifacts/maintenance/v1.0.2/../v1.0.3')){$group.path=$path;Plan;Reject {Run} ('Rejected root '+$path)}
  $group.path=$savedPath
  $savedFile=$file.path;$file.path='artifacts/maintenance/v1.0.3/run/current.png';Plan;Reject {Run} 'File cannot escape old root';$file.path=$savedFile
  $file.path='artifacts/maintenance/v1.0.2/imagegen/original.png';Plan;Reject {Run} 'Original material directory rejected';$file.path=$savedFile
  $file.path='artifacts/maintenance/v1.0.2/run/room.sqlite';Plan;Reject {Run} 'Platform save rejected';$file.path=$savedFile
  $savedHash=$file.sha256;$file.sha256='0'*64;Plan;Reject {Run -Apply} 'Changed screenshot hash blocks deletion';$file.sha256=$savedHash
  $file.bytes=999;Plan;Reject {Run} 'Changed screenshot size rejected';$file.bytes=12
  $group.files=@($file,$file);Plan;Reject {Run} 'Duplicate image paths rejected';$group.files=@($file)
  $savedEvidence=$evidence.sha256;$evidence.sha256='0'*64;Plan;Reject {Run} 'Changed retained text evidence rejected';$evidence.sha256=$savedEvidence
  New-Item -ItemType Directory -Path (Join-Path $fixture 'artifacts/maintenance/v1.0.2/.git')|Out-Null
  Plan;Reject {Run} 'Nested repository rejected'
  Remove-Item -LiteralPath (Join-Path $fixture 'artifacts/maintenance/v1.0.2/.git') -Force
  Plan;Age;(Get-Item (Join-Path $fixture $file.path)).LastWriteTimeUtc=[DateTime]::UtcNow
  Run -Apply|Out-Null;Check (Test-Path (Join-Path $fixture $file.path)) 'Recent evidence root protected'
  Age;Run -Apply|Out-Null;Check (-not (Test-Path (Join-Path $fixture $file.path))) 'Explicit unique historical screenshot deleted'
  foreach($path in @('artifacts/maintenance/v1.0.2/run/results.json','artifacts/maintenance/v1.0.2/run/room.sqlite','artifacts/maintenance/v1.0.2/imagegen/original.png','artifacts/maintenance/v1.0.3/run/current.png','artifacts/releases/TableMax-1.0.3-win-x64.zip')){Check (Test-Path (Join-Path $fixture $path)) ('Preserved '+$path)}
  $report=Get-ChildItem (Join-Path $fixture 'artifacts/maintenance') -Filter cleanup.json -Recurse|Select-Object -First 1
  $record=Get-Content $report.FullName -Raw|ConvertFrom-Json
  Check ($record.result -eq 'passed' -and $record.deletedBytes -eq 12 -and $record.candidates[0].historicalScreenshots.files[0].sha256 -eq $savedHash) 'Report preserves exact deleted hash and byte count'
  if(-not $EvidenceDirectory){$EvidenceDirectory=Join-Path $testProject 'artifacts/maintenance/historical-screenshot-tools'}
  New-Item -ItemType Directory -Path $EvidenceDirectory -Force|Out-Null
  @{result='passed';count=$checks.Count;checks=$checks.ToArray()}|ConvertTo-Json -Depth 4|Set-Content (Join-Path $EvidenceDirectory 'results.json') -Encoding utf8
  Write-Host ($checks.Count.ToString()+' historical screenshot retirement checks passed.')
}finally{
  if(Test-Path -LiteralPath $fixture){$absolute=[IO.Path]::GetFullPath($fixture);if(-not $absolute.StartsWith($testProject+'\tmp\',[StringComparison]::OrdinalIgnoreCase)){throw 'Fixture escapes project tmp.'};Remove-Item -LiteralPath $absolute -Recurse -Force}
}
