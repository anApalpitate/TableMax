param([string[]]$Only = @())
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..')).TrimEnd('\')
$fixture = Join-Path $root ('tmp/reviewed-files-test-' + [Guid]::NewGuid().ToString('N'))
$workspace = $fixture
$maintenance = Join-Path $workspace 'artifacts/maintenance'
$project = [PSCustomObject]@{version='1.0.6'}
$archiveHash = 'a' * 64
$cutoff = [DateTime]::UtcNow.AddMinutes(-30)
$Apply = $false
$busy = $false
$idleCalls = 0
$preservedFiles = @()
$checks = 0
$passed = @()
$junctions = @()
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
function Assert-Idle { $script:idleCalls++; if ($busy) { throw 'busy fixture' } }
function Assert-PreservedRelease { }
function Check([bool]$Condition, [string]$Message) { if (-not $Condition) { throw ('FAILED: ' + $Message) }; $script:checks++ }
function Refused([scriptblock]$Action, [string]$Message) {
  $rejected=$false
  try { & $Action | Out-Null } catch { $rejected=$true }
  Check $rejected $Message
}
function File([string]$Relative, [string]$Content = 'fixture') {
  $path=Join-Path $workspace $Relative
  New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
  [IO.File]::WriteAllText($path,$Content)
  (Get-Item -LiteralPath $path).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)
  $item=Get-Item -LiteralPath $path
  return [PSCustomObject]@{path=$Relative;bytes=$item.Length;lastWriteTimeUtcTicks=$item.LastWriteTimeUtc.Ticks;sha256=(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()}
}
function Plan([string]$Id, [string]$Path, [object[]]$Files, [string]$Origin='generated-copy') {
  $script:plan=[PSCustomObject]@{version=1;authorization='retire-reviewed-generated-once';id=$Id;currentVersion='1.0.6';currentArchiveSha256=$archiveHash;protectedPrefixes=@();protectedFiles=@();links=@();references=@();entries=@([PSCustomObject]@{path=$Path;reason='audited fixture';origin=$Origin;files=$Files})}
  $script:ReviewedFilesManifest=Join-Path $maintenance ($Id+'.json')
  $script:Apply=$false
  Save-Plan
}
function Save-Plan {
  $plan | ConvertTo-Json -Depth 9 | Set-Content -LiteralPath $ReviewedFilesManifest -Encoding utf8
  $script:ReviewedFilesManifestSha256=(Get-FileHash -LiteralPath $ReviewedFilesManifest).Hash.ToLowerInvariant()
}
function Journal { return Join-Path $maintenance ('reviewed-retirements/'+$plan.id+'.json') }
function Scenario([string]$Name, [scriptblock]$Action) {
  if ($Only.Count -and $Name -notin $Only) { return }
  & $Action
  $script:passed += $Name
}
try {
  New-Item -ItemType Directory -Path $maintenance -Force | Out-Null
  & git init --quiet $workspace
  if ($LASTEXITCODE -ne 0) { throw 'Cannot initialize isolated tracked-source fixture.' }
  . (Join-Path $PSScriptRoot 'reviewed-files.ps1')
  Scenario 'exact-and-once' {
    $first=File 'tmp/exact/deep/selected.txt'
    $other=File 'tmp/exact/keep.txt'
    $artifact=File 'artifacts/maintenance/old-copy/remove.txt'
    Plan 'exact-and-once' 'tmp/exact' @($first)
    $plan.entries += [PSCustomObject]@{path='artifacts/maintenance/old-copy';reason='cross-root generated copy';origin='generated-copy';files=@($artifact)}
    Save-Plan
    Invoke-ReviewedFilesRetirement
    Check ((Test-Path -LiteralPath (Join-Path $workspace $first.path)) -and -not (Test-Path -LiteralPath (Journal))) 'preview preserves files and ID'
    $new=File 'tmp/exact/new-after-preview.txt'
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    $record=Get-Content -LiteralPath (Journal) -Raw | ConvertFrom-Json
    Check ($record.result -eq 'passed' -and $record.deletedFiles -eq 2 -and $record.deletedBytes -eq ($first.bytes+$artifact.bytes) -and $record.recoveryArchive -eq $false) 'precise cross-root bytes and no recovery archive'
    Check ((Test-Path -LiteralPath (Join-Path $workspace $other.path)) -and -not (Test-Path -LiteralPath (Join-Path $workspace $first.path)) -and -not (Test-Path -LiteralPath (Join-Path $workspace $artifact.path))) 'unlisted file survives'
    Check (Test-Path -LiteralPath (Join-Path $workspace $new.path)) 'new file after preview survives'
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace 'tmp/exact/deep'))) 'only empty selected ancestors removed'
    Refused { Invoke-ReviewedFilesRetirement } 'consumed ID cannot run twice'
    Check (@(Get-ChildItem -LiteralPath $maintenance -Recurse -Filter selected.txt).Count -eq 0) 'no copied file backup'
  }
  Scenario 'single-file-root' {
    $one=File 'tmp/one-generated.tar' 'exact duplicate generated archive'
    $neighbor=File 'tmp/keep-generated.tar' 'canonical retained archive'
    Plan 'single-file-root' $one.path @($one)
    $outside=File 'tmp/outside.txt'
    $plan.entries[0].files=@($outside);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'single-file root refuses an outside sibling'
    $plan.entries[0].files=@($one);Save-Plan
    Invoke-ReviewedFilesRetirement
    Check (Test-Path -LiteralPath (Join-Path $workspace $one.path)) 'single-file preview preserves source'
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check ((Test-Path -LiteralPath (Join-Path $workspace $neighbor.path)) -and (Test-Path -LiteralPath (Join-Path $workspace $outside.path)) -and -not (Test-Path -LiteralPath (Join-Path $workspace $one.path))) 'single-file Apply preserves every unlisted sibling'
    $directory=Join-Path $workspace 'tmp/directory-impostor'
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    (Get-Item -LiteralPath $directory).LastWriteTimeUtc=[DateTime]::UtcNow.AddHours(-2)
    $fake=[PSCustomObject]@{path='tmp/directory-impostor';bytes=0;lastWriteTimeUtcTicks=(Get-Item -LiteralPath $directory).LastWriteTimeUtc.Ticks;sha256='0'*64}
    Plan 'directory-impostor' $fake.path @($fake)
    Refused { Invoke-ReviewedFilesRetirement } 'directory cannot impersonate exact ordinary file root'
  }
  Scenario 'path-and-source' {
    $file=File 'tmp/path/file.txt'
    Plan 'path-and-source' 'tmp/path' @($file)
    foreach ($invalid in @('../source.txt','tmp/../source.txt','E:/outside.txt','tmp/path/*','tmp/path\\file.txt','tmp/.git/config','assets/original.png','.cache/tools/file.bin')) {
      Refused { Resolve-ReviewedPath $invalid } ('invalid scope '+$invalid)
    }
    $plan.entries[0].files=@($file,$file);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'duplicate candidate rejected'
    $tracked=File 'artifacts/tracked-root/tracked.txt'
    & git -C $workspace add -- $tracked.path
    if ($LASTEXITCODE -ne 0) { throw 'Cannot stage isolated source fixture.' }
    Plan 'tracked-source' 'artifacts/tracked-root' @($tracked)
    Refused { Invoke-ReviewedFilesRetirement } 'tracked source is protected'
    foreach ($relative in @('tmp/originals/source.png','tmp/research/rule.pdf','tmp/secrets/key.json','artifacts/game-packages/old/blob.zip','tmp/formal/data/room.sqlite')) {
      $protected=File $relative
      Plan ('protected-'+$checks) (Split-Path $relative -Parent).Replace('\','/') @($protected)
      Refused { Invoke-ReviewedFilesRetirement } ('original secret repository or formal save protected '+$relative)
    }
  }
  Scenario 'build-generated-and-snapshot' {
    $generated=File 'build/desktop/generated.js'
    $unlisted=File 'build/desktop/keep.js'
    $latest=File 'build/snapshots/latest.json'
    $snapshot=File ('build/snapshots/'+('c'*64)+'.json')
    Plan 'build-generated' 'build/desktop' @($generated)
    Refused { Invoke-ReviewedFilesRetirement } 'build cleanup requires frozen references'
    $plan.references=@($latest,$snapshot);Save-Plan
    $plan.entries[0].origin='isolated-test';Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'build cleanup rejects non-generated origin'
    $plan.entries[0].origin='generated-copy';Save-Plan
    foreach ($invalid in @('build/snapshots/latest.json','build/unknown/output.js','build/desktop-old/file.js')) {
      if ($invalid -eq 'build/snapshots/latest.json') {
        Plan 'protected-build-pointer' 'build/snapshots' @($latest)
        $plan.references=@($latest,$snapshot);Save-Plan
        Refused { Invoke-ReviewedFilesRetirement } 'snapshot pointer stays protected'
        Plan 'build-generated' 'build/desktop' @($generated)
        $plan.references=@($latest,$snapshot);Save-Plan
      } else { Refused { Resolve-ReviewedPath $invalid } ('unapproved build scope '+$invalid) }
    }
    $savedHash=$plan.references[1].sha256
    $plan.references[1].sha256='d'*64;Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'changed frozen build reference blocks cleanup'
    $plan.references[1].sha256=$savedHash;Save-Plan
    Invoke-ReviewedFilesRetirement
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $generated.path))) 'exact generated build output retired'
    Check ((Test-Path -LiteralPath (Join-Path $workspace $unlisted.path)) -and (Test-Path -LiteralPath (Join-Path $workspace $latest.path)) -and (Test-Path -LiteralPath (Join-Path $workspace $snapshot.path))) 'unlisted outputs and frozen snapshots preserved'
  }
  Scenario 'archived-snapshot' {
    $latest=File 'build/snapshots/latest.json'
    $current=File ('build/snapshots/'+('e'*64)+'.json')
    $old=File ('build/snapshots/'+('f'*64)+'.json') 'complete historical frozen inputs'
    Plan 'archived-snapshot' 'build/snapshots' @($old)
    $plan.references=@($latest,$current);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'historical snapshots cannot be discarded without archival proof'
    $mixed=[PSCustomObject]@{path=$old.path.Replace('build/snapshots/','Build/Snapshots/');bytes=$old.bytes;lastWriteTimeUtcTicks=$old.lastWriteTimeUtcTicks;sha256=$old.sha256}
    $plan.entries[0].path='Build/Snapshots';$plan.entries[0].files=@($mixed);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'Windows mixed-case snapshots require archival proof'
    $plan.entries[0].path='build/snapshots';$plan.entries[0].files=@($old);Save-Plan
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archiveRelative='artifacts/maintenance/preserved/history.zip'
    $archivePath=Join-Path $workspace $archiveRelative
    [IO.Directory]::CreateDirectory((Split-Path $archivePath -Parent)) | Out-Null
    $zip=[IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
    try {
      $member=$zip.CreateEntry($old.path);$output=$member.Open();$input=[IO.File]::OpenRead((Join-Path $workspace $old.path))
      try { $input.CopyTo($output) } finally { $input.Dispose();$output.Dispose() }
    } finally { $zip.Dispose() }
    $archiveRef=[PSCustomObject]@{path=$archiveRelative;bytes=(Get-Item -LiteralPath $archivePath).Length;sha256=(Get-FileHash -LiteralPath $archivePath).Hash.ToLowerInvariant()}
    $old | Add-Member -NotePropertyName preservedArchive -NotePropertyValue ([PSCustomObject]@{path=$archiveRelative;sha256=$archiveRef.sha256;entryPath=$old.path})
    Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'preservation archive must be a frozen reference'
    $plan.references=@($latest,$current,$archiveRef)
    $old.preservedArchive.entryPath='build/snapshots/missing.json';Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'archive member path must equal original path'
    $old.preservedArchive.entryPath=$old.path.ToUpperInvariant();Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'ZIP entry names require exact case for restoration'
    $old.preservedArchive.entryPath=$old.path
    $old.preservedArchive.sha256='0'*64;Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'changed archive SHA is rejected'
    $old.preservedArchive.sha256=$archiveRef.sha256
    foreach ($extra in @(0,1)) {
      $badRelative='artifacts/maintenance/preserved/wrong-member-'+$extra+'.zip'
      $badPath=Join-Path $workspace $badRelative
      $zip=[IO.Compression.ZipFile]::Open($badPath,[IO.Compression.ZipArchiveMode]::Create)
      try {
        $member=$zip.CreateEntry($old.path);$output=$member.Open()
        try { $wrongBytes=[byte[]]::new(([int]$old.bytes+$extra));$output.Write($wrongBytes,0,$wrongBytes.Length) } finally { $output.Dispose() }
      } finally { $zip.Dispose() }
      $badRef=[PSCustomObject]@{path=$badRelative;bytes=(Get-Item -LiteralPath $badPath).Length;sha256=(Get-FileHash -LiteralPath $badPath).Hash.ToLowerInvariant()}
      $old.preservedArchive=[PSCustomObject]@{path=$badRelative;sha256=$badRef.sha256;entryPath=$old.path}
      $plan.references=@($latest,$current,$badRef);Save-Plan
      Refused { Invoke-ReviewedFilesRetirement } ('correct source metadata with wrong same-named ZIP member '+$extra)
    }
    $old.preservedArchive=[PSCustomObject]@{path=$archiveRelative;sha256=$archiveRef.sha256;entryPath=$old.path}
    $plan.references=@($latest,$current,$archiveRef)
    [IO.File]::AppendAllText($archivePath,'actual ZIP bytes changed');Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'actual preservation ZIP mutation blocks retirement'
    $stream=[IO.File]::OpenWrite($archivePath)
    try { $stream.SetLength($archiveRef.bytes) } finally { $stream.Dispose() }
    $missing=File ('build/snapshots/'+('a'*64)+'-assembly.json')
    $missing | Add-Member -NotePropertyName preservedArchive -NotePropertyValue $old.preservedArchive
    $missing.preservedArchive=[PSCustomObject]@{path=$archiveRelative;sha256=$archiveRef.sha256;entryPath=$missing.path}
    $plan.entries[0].files=@($missing);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'missing ZIP member preserves original snapshot'
    $plan.entries[0].files=@($old);Save-Plan
    Invoke-ReviewedFilesRetirement
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $old.path))) 'archived snapshot ordinary copy retired'
    Check ((Test-Path -LiteralPath $archivePath) -and (Test-Path -LiteralPath (Join-Path $workspace $current.path)) -and (Test-Path -LiteralPath (Join-Path $workspace $latest.path))) 'complete archive and current pointers retained'
  }
  Scenario 'solid-preserved-archive' {
    $old=File 'tmp/solid-original/record.txt' 'complete preserved original'
    $isolated=File 'tmp/solid-fixture/candidate/data/app/program.bin' 'isolated application program bytes'
    $archiveRelative='artifacts/maintenance/preserved-fixture.tar.xz'
    $archivePath=Join-Path $workspace $archiveRelative
    $tar='C:/Windows/System32/tar.exe'
    & $tar -cJf $archivePath --format=ustar -C $workspace $old.path $isolated.path
    if ($LASTEXITCODE -ne 0) { throw 'Could not create isolated solid archive fixture.' }
    $archiveRef=[PSCustomObject]@{path=$archiveRelative;sha256=(Get-FileHash -LiteralPath $archivePath).Hash.ToLowerInvariant()}
    $binding=[PSCustomObject]@{format='ustar-xz-v1';path=$archiveRelative;sha256=$archiveRef.sha256;entryPath=$old.path;tarSha256=(Get-FileHash -LiteralPath $tar).Hash.ToLowerInvariant()}
    $old | Add-Member -NotePropertyName preservedArchive -NotePropertyValue $binding
    $isolatedBinding=[PSCustomObject]@{format='ustar-xz-v1';path=$archiveRelative;sha256=$archiveRef.sha256;entryPath=$isolated.path;tarSha256=$binding.tarSha256}
    $isolated | Add-Member -NotePropertyName preservedArchive -NotePropertyValue $isolatedBinding
    Plan 'solid-preserved-archive' 'tmp/solid-original' @($old)
    $plan.entries += [PSCustomObject]@{path='tmp/solid-fixture';reason='audited isolated fixture application';origin='isolated-test';files=@($isolated)}
    $plan.references=@($archiveRef);Save-Plan
    Invoke-ReviewedFilesRetirement
    $plan.entries[1].origin='generated-copy';Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'ordinary data remains protected even when archived'
    $plan.entries[1].origin='isolated-test';Save-Plan
    $old.bytes++;Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'solid archive rejects byte-length mismatch'
    $old.bytes--; $originalHash=$old.sha256;$old.sha256='0'*64;Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'solid archive rejects member SHA mismatch'
    $old.sha256=$originalHash;$binding.format='unknown';Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'unknown preservation format rejected'
    $binding.format='ustar-xz-v1';$binding.tarSha256='0'*64;Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'changed system tar method rejected'
    $binding.tarSha256=(Get-FileHash -LiteralPath $tar).Hash.ToLowerInvariant();Save-Plan
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check ((Test-Path -LiteralPath $archivePath) -and -not (Test-Path -LiteralPath (Join-Path $workspace $old.path))) 'solid archived bytes retained after exact isolated retirement'
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $isolated.path))) 'isolated fixture program archived with complete bytes'
  }
  Scenario 'frozen-generated-program' {
    $app='tmp/installation-package-Abc123/candidate/data/app'
    $program=File ($app+'/server/main.cjs') 'frozen program bytes'
    $canonical=File '.cache/node/22.14.0/runtime/node.exe' 'identical canonical Node bytes'
    $node=File ($app+'/node.exe') 'identical canonical Node bytes'
    $saved=File ($app+'/nested/data/save.sqlite') 'save remains protected'
    $formal=File 'data/app/program.bin' 'production data remains protected'
    $manifest=File ($app+'/.tablemax-release.json') ((@{files=@(@{path='server/main.cjs';bytes=$program.bytes;sha256=$program.sha256})} | ConvertTo-Json -Depth 5))
    $archiveRelative='artifacts/maintenance/frozen-program-preservation.zip'
    $archivePath=Join-Path $workspace $archiveRelative
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip=[IO.Compression.ZipFile]::Open($archivePath,[IO.Compression.ZipArchiveMode]::Create)
    try {
      foreach ($file in @($program,$node,$saved,$formal)) {
        $member=$zip.CreateEntry($file.path);$output=$member.Open();$input=[IO.File]::OpenRead((Join-Path $workspace $file.path))
        try { $input.CopyTo($output) } finally { $input.Dispose();$output.Dispose() }
      }
    } finally { $zip.Dispose() }
    $archiveRef=[PSCustomObject]@{path=$archiveRelative;sha256=(Get-FileHash -LiteralPath $archivePath).Hash.ToLowerInvariant()}
    foreach ($file in @($program,$node,$saved,$formal)) {
      $file | Add-Member -NotePropertyName preservedArchive -NotePropertyValue ([PSCustomObject]@{path=$archiveRelative;sha256=$archiveRef.sha256;entryPath=$file.path})
    }
    $binding=[PSCustomObject]@{manifestPath=$manifest.path;manifestSha256=$manifest.sha256;memberPath='server/main.cjs'}
    $program | Add-Member -NotePropertyName frozenProgram -NotePropertyValue $binding
    $saved | Add-Member -NotePropertyName frozenProgram -NotePropertyValue $binding
    $formal | Add-Member -NotePropertyName frozenProgram -NotePropertyValue $binding
    $node | Add-Member -NotePropertyName canonicalProgram -NotePropertyValue ([PSCustomObject]@{path=$canonical.path;sha256=$canonical.sha256})
    Plan 'frozen-generated-program' $app @($program,$node)
    $plan.references=@($manifest,$canonical,$archiveRef);Save-Plan
    Initialize-ReviewedReferenceLookup $plan
    Check (Test-ReviewedReference $archiveRef.path.ToUpperInvariant() $archiveRef.sha256) 'archive reference lookup preserves case-insensitive paths'
    Check (Test-ReviewedReference $manifest.path $manifest.sha256.ToUpperInvariant() -ExactPath) 'reference SHA lookup preserves case-insensitive equality'
    Check (-not (Test-ReviewedReference $manifest.path.ToUpperInvariant() $manifest.sha256 -ExactPath)) 'frozen reference lookup requires exact path case'
    Check (-not (Test-ReviewedReference ($archiveRef.path+'-wrong') $archiveRef.sha256)) 'reference lookup rejects wrong path'
    Check (-not (Test-ReviewedReference $archiveRef.path ('0'*64))) 'reference lookup rejects wrong SHA'
    $lookupPlan=[PSCustomObject]@{references=@([PSCustomObject]@{path=$archiveRef.path;sha256=$archiveRef.sha256})}
    Initialize-ReviewedReferenceLookup $lookupPlan
    $lookupPlan.references=@()
    Initialize-ReviewedReferenceLookup $lookupPlan
    Check (-not (Test-ReviewedReference $archiveRef.path $archiveRef.sha256)) 'explicit reinitialization sees reference edits on the same object'
    Invoke-ReviewedFilesRetirement
    $caseManifest=[PSCustomObject]@{path=$manifest.path.ToUpperInvariant();sha256=$manifest.sha256}
    $plan.references=@($caseManifest,$canonical,$archiveRef);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'frozen manifest reference path case must be exact'
    $caseCanonical=[PSCustomObject]@{path=$canonical.path.ToUpperInvariant();sha256=$canonical.sha256}
    $plan.references=@($manifest,$caseCanonical,$archiveRef);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'canonical Node reference path case must be exact'
    $caseArchive=[PSCustomObject]@{path=$archiveRef.path.ToUpperInvariant();sha256=$archiveRef.sha256}
    $plan.references=@($manifest,$canonical,$caseArchive);Save-Plan
    Invoke-ReviewedFilesRetirement
    $plan.references=@($manifest,$canonical,$archiveRef);Save-Plan
    $binding.memberPath='server/wrong.cjs';Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'frozen member must equal exact program suffix'
    $binding.memberPath='server/main.cjs';$binding.manifestSha256='0'*64;Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'frozen manifest must bind original actual hash'
    $binding.manifestSha256=$manifest.sha256;$plan.references=@($canonical,$archiveRef);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'frozen manifest must remain a protected reference'
    $plan.references=@($manifest,$canonical,$archiveRef);$plan.protectedPrefixes=@($app);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'current protected program roots remain protected'
    $plan.protectedPrefixes=@();$plan.entries[0].files=@($saved);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'nested save data is never a generated program'
    $plan.entries[0].path='data';$plan.entries[0].files=@($formal);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'formal data is never a staging program'
    $plan.entries[0].path=$app;$plan.entries[0].files=@($program,$node);$node.canonicalProgram.path='tmp/not-canonical';Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'canonical Node source cannot be redirected'
    $node.canonicalProgram.path=$canonical.path;Save-Plan
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $program.path))) 'exact frozen manifest program retired only after full preservation'
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $node.path))) 'exact canonical Node copy retired only after full preservation'
    Check ((Test-Path -LiteralPath (Join-Path $workspace $saved.path)) -and (Test-Path -LiteralPath (Join-Path $workspace $formal.path)) -and (Test-Path -LiteralPath (Join-Path $workspace $manifest.path))) 'save, formal data and frozen manifest survive'
  }
  Scenario 'delivery-and-prefix' {
    $file=File 'artifacts/releases/current/current.exe'
    $script:preservedFiles=@([PSCustomObject]@{path=(Join-Path $workspace $file.path)})
    Plan 'delivery-protected' 'artifacts/releases/current' @($file)
    Refused { Invoke-ReviewedFilesRetirement } 'current delivery protected'
    $script:preservedFiles=@()
    $candidate=File 'tmp/protected/file.bin'
    Plan 'prefix-protected' 'tmp/protected' @($candidate)
    $plan.protectedPrefixes=@('tmp/protected');Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'audit protected prefix enforced'
    $proof=File 'artifacts/maintenance/proof.txt'
    Plan 'proof-protected' 'artifacts/maintenance' @($proof)
    $plan.protectedFiles=@($proof);Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'retained proof protected'
  }
  Scenario 'change-and-age' {
    $file=File 'tmp/change/file.txt' 'firstxx'
    Plan 'content-change' 'tmp/change' @($file)
    [IO.File]::WriteAllText((Join-Path $workspace $file.path),'changed')
    (Get-Item -LiteralPath (Join-Path $workspace $file.path)).LastWriteTimeUtc=[DateTime]::new($file.lastWriteTimeUtcTicks,[DateTimeKind]::Utc)
    Refused { Invoke-ReviewedFilesRetirement } 'same size and ticks with changed SHA rejected'
    $recent=File 'tmp/recent/file.txt'
    (Get-Item -LiteralPath (Join-Path $workspace $recent.path)).LastWriteTimeUtc=[DateTime]::UtcNow
    $recent.lastWriteTimeUtcTicks=(Get-Item -LiteralPath (Join-Path $workspace $recent.path)).LastWriteTimeUtc.Ticks
    Plan 'recent-file' 'tmp/recent' @($recent)
    Refused { Invoke-ReviewedFilesRetirement } '30 minute protection'
    $valid=File 'tmp/hash-bind/file.txt'
    Plan 'manifest-hash' 'tmp/hash-bind' @($valid)
    $script:ReviewedFilesManifestSha256='b'*64
    Refused { Invoke-ReviewedFilesRetirement } 'preview SHA binds exact manifest'
  }
  Scenario 'links-and-repositories' {
    $target=File 'tmp/link-target/keep.txt'
    $linkPath=Join-Path $workspace 'tmp/linked'
    New-Item -ItemType Junction -Path $linkPath -Target (Join-Path $workspace 'tmp/link-target') | Out-Null
    $script:junctions += $linkPath
    $actualLink=[PSCustomObject]@{path='tmp/linked';target=(Join-Path $workspace 'tmp/link-target')}
    Check ((Get-ReviewedLinkTarget $actualLink).Equals($actualLink.target,[StringComparison]::OrdinalIgnoreCase)) 'actual Junction Target resolves correctly as string or string-array'
    $actualLink | Add-Member -NotePropertyName rawTarget -NotePropertyValue ([string]@((Get-Item -LiteralPath $linkPath -Force).Target)[0])
    Check ((Get-ReviewedLinkTarget $actualLink).Equals($actualLink.target,[StringComparison]::OrdinalIgnoreCase)) 'normal Junction exact raw representation is bound'
    $rawNormal=$actualLink.rawTarget;$actualLink.rawTarget=$rawNormal.ToUpperInvariant()
    Refused { Get-ReviewedLinkTarget $actualLink } 'raw Junction representation uses exact ordinal comparison'
    $actualLink.rawTarget=$rawNormal
    $globalPath=Join-Path $workspace 'tmp/global-linked'
    New-Item -ItemType Junction -Path $globalPath -Target ('\??\Global\'+$actualLink.target) | Out-Null
    $script:junctions += $globalPath
    $globalRecord=[PSCustomObject]@{path='tmp/global-linked';target=$actualLink.target;rawTarget=([string]@((Get-Item -LiteralPath $globalPath -Force).Target)[0])}
    Check ((Get-ReviewedLinkTarget $globalRecord).Equals($actualLink.target,[StringComparison]::OrdinalIgnoreCase)) 'real Global Junction representation protects its normal absolute target without traversal'
    $globalRecord.rawTarget='incorrect raw representation'
    Refused { Get-ReviewedLinkTarget $globalRecord } 'Global raw target mismatch rejected'
    $globalRecord.rawTarget=[string]@((Get-Item -LiteralPath $globalPath -Force).Target)[0]
    $globalRecord.target=Join-Path $workspace 'tmp/different-target'
    Refused { Get-ReviewedLinkTarget $globalRecord } 'Global normalized target change rejected'
    $globalRecord.target=$actualLink.target
    Refused { Convert-ReviewedLinkTargetRepresentation '\??\Global\UNC\invalid' } 'non-drive Global target rejected without traversal'
    Check ((Convert-ReviewedLinkTargetRepresentation ('Global\'+$actualLink.target)) -ceq $actualLink.target) 'raw Global drive representation normalizes only its prefix'
    Plan 'target-protected' 'tmp/link-target' @($target)
    $plan.links=@([PSCustomObject]@{path='tmp/linked';target=(Join-Path $workspace 'tmp/link-target')});Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'inbound link target protected'
    $plan.links[0].target=Join-Path $workspace 'tmp/wrong-target';Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'changed link record rejected'
    $throughLink=[PSCustomObject]@{path='tmp/linked/keep.txt';bytes=$target.bytes;lastWriteTimeUtcTicks=$target.lastWriteTimeUtcTicks;sha256=$target.sha256}
    Plan 'ancestor-link' 'tmp/linked' @($throughLink)
    Refused { Invoke-ReviewedFilesRetirement } 'linked ancestor protected'
    $nested=File 'tmp/nested/file.txt'
    New-Item -ItemType Directory -Path (Join-Path $workspace 'tmp/nested/.git') | Out-Null
    Plan 'nested-repository' 'tmp/nested' @($nested)
    Refused { Invoke-ReviewedFilesRetirement } 'nested repository protected'
    $sibling=File 'tmp/link-sibling/delete.txt'
    $siblingLink=Join-Path $workspace 'tmp/link-sibling/link'
    New-Item -ItemType Junction -Path $siblingLink -Target (Join-Path $workspace 'tmp/link-target') | Out-Null
    $script:junctions += $siblingLink
    Plan 'link-sibling' 'tmp/link-sibling' @($sibling)
    $plan.links=@([PSCustomObject]@{path='tmp/link-sibling/link';target=(Join-Path $workspace 'tmp/link-target')});Save-Plan
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check ((Test-Path -LiteralPath $siblingLink) -and (Test-Path -LiteralPath (Join-Path $workspace $target.path))) 'unlisted sibling link and target survive'
  }
  Scenario 'bindings-and-cache' {
    $file=File '.cache/build-modules/v1/old-unit/expired/file.bin'
    $reference=File 'artifacts/maintenance/cache-reference.json'
    Plan 'cache-needs-references' '.cache/build-modules/v1/old-unit/expired' @($file) 'retired-cache'
    Refused { Invoke-ReviewedFilesRetirement } 'cache requires frozen retention references'
    $plan.references=@([PSCustomObject]@{path=$reference.path;sha256=$reference.sha256});Save-Plan
    Invoke-ReviewedFilesRetirement
    $originalReferences=@($script:reviewedPlan.references)
    $script:reviewedPlan.references=@([PSCustomObject]@{path=$reference.path;sha256=$reference.sha256.ToUpperInvariant()})
    Assert-ReviewedBindings
    Check $true 'compiled reference check preserves case-insensitive SHA equality'
    $script:reviewedPlan.references=@([PSCustomObject]@{path=$reference.path;sha256=('0'*64)})
    Refused { Assert-ReviewedBindings } 'compiled reference check rejects wrong SHA'
    $script:reviewedPlan.references=@([PSCustomObject]@{path='artifacts/maintenance';sha256=$reference.sha256})
    Refused { Assert-ReviewedBindings } 'compiled reference check rejects a directory'
    $referenceTarget=File 'tmp/retained-link-target/evidence.json'
    $referenceLink=Join-Path $workspace 'tmp/retained-reference-link'
    New-Item -ItemType Junction -Path $referenceLink -Target (Join-Path $workspace 'tmp/retained-link-target') | Out-Null
    $script:junctions += $referenceLink
    $script:reviewedPlan.references=@([PSCustomObject]@{path='tmp/retained-reference-link/evidence.json';sha256=$referenceTarget.sha256})
    Refused { Assert-ReviewedBindings } 'compiled reference check rejects a linked ancestor'
    $script:reviewedPlan.references=@([PSCustomObject]@{path=$reference.path;bytes=($reference.bytes+1);sha256=$reference.sha256})
    Refused { Assert-ReviewedBindings } 'compiled reference check preserves expected byte binding'
    $nestedReference=File 'tmp/retained-nested/evidence.json'
    New-Item -ItemType Directory -Path (Join-Path $workspace 'tmp/retained-nested/.git') | Out-Null
    $script:reviewedPlan.references=@([PSCustomObject]@{path=$nestedReference.path;sha256=$nestedReference.sha256})
    Refused { Assert-ReviewedBindings } 'compiled reference check rejects a nested repository'
    $script:reviewedPlan.references=$originalReferences
    Assert-ReviewedBindings
    $lock=File '.cache/build-modules/v1/owner.lock'
    Refused { Invoke-ReviewedFilesRetirement } 'active or unresolved cache lock protected'
    Remove-Item -LiteralPath (Join-Path $workspace $lock.path) -Force
    [IO.File]::WriteAllText((Join-Path $workspace $reference.path),'new retention')
    Refused { Invoke-ReviewedFilesRetirement } 'changed cache retention binding rejected'
  }
  Scenario 'busy-before-consumption' {
    $file=File 'tmp/busy/file.txt'
    Plan 'busy-before-consumption' 'tmp/busy' @($file)
    $script:Apply=$true;$script:busy=$true
    Refused { Invoke-ReviewedFilesRetirement } 'busy project blocks apply'
    $script:busy=$false
    Check ((Test-Path -LiteralPath (Join-Path $workspace $file.path)) -and -not (Test-Path -LiteralPath (Journal))) 'busy rejection does not consume ID or files'
  }
  Scenario 'partial-and-single-use' {
    $first=File 'tmp/partial/first.txt'
    $second=File 'tmp/partial/second.txt'
    Plan 'partial-and-single-use' 'tmp/partial' @($first,$second)
    $script:Apply=$true
    $handle=[IO.File]::Open((Join-Path $workspace $second.path),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try { Refused { Invoke-ReviewedFilesRetirement } 'locked second file safely stops partial cleanup' } finally { $handle.Dispose() }
    $record=Get-Content -LiteralPath (Journal) -Raw | ConvertFrom-Json
    Check ($record.result -eq 'failed' -and $record.deletedFiles -eq 1 -and (Test-Path -LiteralPath (Join-Path $workspace $second.path))) 'partial deletion records exact result and preserves remaining file'
    Refused { Invoke-ReviewedFilesRetirement } 'partial failure consumes ID permanently'
  }
  Scenario 'journal-save-failure' {
    $file=File 'tmp/save-failure/file.txt'
    Plan 'journal-save-failure' 'tmp/save-failure' @($file)
    $script:Apply=$true
    $originalWriter=(Get-Command Write-ReviewedJournal).ScriptBlock
    function Write-ReviewedJournal { throw 'injected journal write failure' }
    try { Refused { Invoke-ReviewedFilesRetirement } 'initial journal save failure stops before deletion' }
    finally { Set-Item -Path Function:Write-ReviewedJournal -Value $originalWriter }
    Check ((Test-Path -LiteralPath (Journal)) -and (Test-Path -LiteralPath (Join-Path $workspace $file.path))) 'failed journal creation preserves file and consumes ID'
    Refused { Invoke-ReviewedFilesRetirement } 'failed journal cannot retry consumed ID'
  }
  Scenario 'payload-and-macro' {
    $payload=File 'artifacts/package-payloads/v1.0.6/retired/full/runtime/node.exe'
    Plan 'retired-payload' 'artifacts/package-payloads/v1.0.6/retired/full/runtime' @($payload)
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $payload.path))) 'old payload generated copy permitted'
    $macro=File 'artifacts/author-toolkit/v1.0.6/macro-old/project-1/.tablemax/data/room.sqlite'
    Plan 'macro-isolated' 'artifacts/author-toolkit/v1.0.6/macro-old/project-1/.tablemax' @($macro) 'isolated-test'
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $macro.path))) 'audited macro fixture permitted'
    $toolkit=File 'artifacts/author-toolkit/v1.0.6/kit/TableMax-toolkit.zip'
    Plan 'toolkit-protected' 'artifacts/author-toolkit/v1.0.6/kit' @($toolkit) 'isolated-test'
    Refused { Invoke-ReviewedFilesRetirement } 'author toolkit outside exact macro fixture protected'
  }
  Scenario 'pages-retained-copy' {
    $original=File 'artifacts/game-packages/v1.0.6/TableMax-code-fixture.zip' 'identical retained ZIP'
    $paths=@(
      'artifacts/pages/verification-FIX123/site/games/v1.0.6/packages/TableMax-code-fixture.zip',
      'artifacts/pages/v1.0.6/ready-FIX123/site/games/v1.0.6/packages/TableMax-code-fixture.zip',
      'artifacts/pages/v1.0.6/published-history-FIX123/site/games/v1.0.6/packages/TableMax-code-fixture.zip',
      'artifacts/pages/v1.0.6/published-history-FIX123/packages/TableMax-code-fixture.zip'
    )
    $copies=@()
    foreach ($path in $paths) {
      $copy=File $path 'identical retained ZIP'
      $copy | Add-Member -NotePropertyName retainedCopy -NotePropertyValue ([PSCustomObject]@{path=$original.path;bytes=$original.bytes;sha256=$original.sha256})
      $copies += $copy
    }
    Plan 'pages-retained-copy' (Split-Path $copies[0].path -Parent).Replace('\','/') @($copies[0])
    foreach ($copy in $copies[1..3]) { $plan.entries += [PSCustomObject]@{path=(Split-Path $copy.path -Parent).Replace('\','/');reason='audited Pages duplicate ZIP';origin='generated-copy';files=@($copy)} }
    Save-Plan
    Invoke-ReviewedFilesRetirement
    Check ((Test-Path -LiteralPath (Join-Path $workspace $original.path)) -and -not (Test-Path -LiteralPath (Journal))) 'Pages preview preserves original and single-use ID'
    $savedPlan=$plan
    $savedManifest=$ReviewedFilesManifest
    foreach ($invalid in @(
      'artifacts/pages/verification-FIX123/site/games/v1.0.6/catalog.json',
      'artifacts/pages/verification-FIX123/site/index.html',
      'artifacts/pages/verification-FIX123/git-tree.zip',
      'artifacts/pages/verification-FIX123/site/games/v1.0.6/packages/source.zip',
      'artifacts/pages/v1.0.6/live-FIX123/site/games/v1.0.6/packages/TableMax-code-fixture.zip'
    )) {
      $bad=File $invalid 'identical retained ZIP'
      $bad | Add-Member -NotePropertyName retainedCopy -NotePropertyValue $copies[0].retainedCopy
      Plan ('pages-invalid-'+$checks) (Split-Path $bad.path -Parent).Replace('\','/') @($bad)
      Refused { Invoke-ReviewedFilesRetirement } ('Pages non-package source preserved '+$invalid)
    }
    $missing=File 'artifacts/pages/verification-MISS/site/games/v1.0.6/packages/TableMax-code-fixture.zip' 'identical retained ZIP'
    Plan 'pages-missing-copy' (Split-Path $missing.path -Parent).Replace('\','/') @($missing)
    Refused { Invoke-ReviewedFilesRetirement } 'Pages ZIP requires retainedCopy proof'
    foreach ($mutation in @('size','sha','path')) {
      $bad=File ('artifacts/pages/verification-'+$mutation+'/site/games/v1.0.6/packages/TableMax-code-fixture.zip') 'identical retained ZIP'
      $proof=[PSCustomObject]@{path=$original.path;bytes=$original.bytes;sha256=$original.sha256}
      if ($mutation -eq 'size') { $proof.bytes++ }
      if ($mutation -eq 'sha') { $proof.sha256='b'*64 }
      if ($mutation -eq 'path') { $proof.path=$copies[0].path }
      $bad | Add-Member -NotePropertyName retainedCopy -NotePropertyValue $proof
      Plan ('pages-proof-'+$mutation) (Split-Path $bad.path -Parent).Replace('\','/') @($bad)
      Refused { Invoke-ReviewedFilesRetirement } ('Pages retained-copy mismatch '+$mutation)
    }
    $script:plan=$savedPlan;$script:ReviewedFilesManifest=$savedManifest;Save-Plan
    [IO.File]::WriteAllText((Join-Path $workspace $original.path),'changed retained ZIP!')
    Refused { Invoke-ReviewedFilesRetirement } 'retained original SHA checked against actual bytes'
    $null=File $original.path 'identical retained ZIP'
    $plan.entries += [PSCustomObject]@{path='artifacts/game-packages/v1.0.6';reason='forbidden original';origin='generated-copy';files=@($original)}
    Save-Plan
    Refused { Invoke-ReviewedFilesRetirement } 'retained original cannot be selected in same plan'
    $plan.entries=$plan.entries[0..3];Save-Plan
    $script:Apply=$true
    Invoke-ReviewedFilesRetirement
    $record=Get-Content -LiteralPath (Journal) -Raw | ConvertFrom-Json
    Check ($record.result -eq 'passed' -and $record.deletedFiles -eq 4 -and (Test-Path -LiteralPath (Join-Path $workspace $original.path))) 'four exact Pages duplicate shapes removed while formal ZIP survives'
  }
  Scenario 'public-entry' {
    $null=File 'package.json' '{"name":"tablemax","version":"1.0.6"}'
    New-Item -ItemType Directory -Path (Join-Path $workspace 'tools/maintenance') -Force | Out-Null
    foreach ($support in @('cleanup-local.ps1','cleanup-guard.ps1','current-delivery.ps1','WorkspaceSnapshot.cs','reviewed-files.ps1','verify-preserved-tar.mjs')) {
      Copy-Item -LiteralPath (Join-Path $PSScriptRoot $support) -Destination (Join-Path $workspace 'tools/maintenance')
    }
    # The real current-delivery guard invokes its pinned Node and delivery-path
    # modules relative to the copied tool. Preserve that dependency boundary.
    foreach ($support in @('tools/release/delivery-paths.mjs','tools/release/windows-executable-name.mjs','tools/shared/workspace-root.mjs','.cache/node/22.14.0/runtime/node.exe')) {
      $target=Join-Path $workspace $support
      New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
      Copy-Item -LiteralPath (Join-Path $root $support) -Destination $target
    }
    New-Item -ItemType Directory -Path (Join-Path $workspace 'scripts') -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'scripts/Clean-Intermediates.ps1') -Destination (Join-Path $workspace 'scripts')
    $payload=File 'artifacts/package-payloads/v1.0.6/integration/full/payload.zip' 'verified full payload'
    $exe=File 'artifacts/releases/TableMax-1.0.6.2-win-x64.exe' 'verified full executable'
    $payloadAbsolute=Join-Path $workspace $payload.path
    $exeAbsolute=Join-Path $workspace $exe.path
    $manifestAbsolute=Join-Path $workspace 'artifacts/package-payloads/v1.0.6/integration/full/release-manifest.json'
    $executable=@{path=$exeAbsolute;bytes=$exe.bytes;sha256=$exe.sha256;payloadSha256=$payload.sha256}
    @{version='1.0.6';buildVersion='1.0.6.2';edition='full';archive=@{name='payload.zip';sha256=$payload.sha256;bytes=$payload.bytes}} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $manifestAbsolute -Encoding utf8
    @{version='1.0.6';buildVersion='1.0.6.2';snapshot='integration';deliveries=@(@{edition='full';archivePath=$payloadAbsolute;manifestPath=$manifestAbsolute;executable=$executable})} | ConvertTo-Json -Depth 7 | Set-Content -LiteralPath (Join-Path $workspace 'artifacts/package-payloads/v1.0.6/current.json') -Encoding utf8
    $proofAbsolute=Join-Path $maintenance 'v1.0.6/windows-editions/integration/shipping-executable-checks-full.json'
    New-Item -ItemType Directory -Path (Split-Path $proofAbsolute -Parent) -Force | Out-Null
    $proof=@{result='passed';executableSha256=$exe.sha256;payloadSha256=$payload.sha256}
    $proof | ConvertTo-Json | Set-Content -LiteralPath $proofAbsolute -Encoding utf8
    $script:archiveHash=$payload.sha256
    $candidate=File 'tmp/integration/candidate.txt'
    Plan 'public-entry' 'tmp/integration' @($candidate)
    $wrapper=Join-Path $workspace 'scripts/Clean-Intermediates.ps1'
    & $wrapper -ReviewedFilesManifest $ReviewedFilesManifest
    Check (Test-Path -LiteralPath (Join-Path $workspace $candidate.path)) 'real wrapper preview routes to exact reviewed entry'
    Refused { & $wrapper -ReviewedFilesManifest $ReviewedFilesManifest -Apply } 'real wrapper requires preview hash before Apply'
    Refused { & $wrapper -ReviewedFilesManifest $ReviewedFilesManifest -MinimumAgeMinutes 0 } 'real wrapper cannot weaken age protection'
    Refused { & $wrapper -ReviewedFilesManifest $ReviewedFilesManifest -TemporaryNames @('integration') } 'real wrapper refuses mixed cleanup modes'
    $proof.result='failed';$proof | ConvertTo-Json | Set-Content -LiteralPath $proofAbsolute -Encoding utf8
    Refused { & $wrapper -ReviewedFilesManifest $ReviewedFilesManifest -ReviewedFilesManifestSha256 $ReviewedFilesManifestSha256 -Apply } 'real current delivery proof required'
    Check (-not (Test-Path -LiteralPath (Journal))) 'bad current delivery proof does not consume ID'
    $proof.result='passed';$proof | ConvertTo-Json | Set-Content -LiteralPath $proofAbsolute -Encoding utf8
    & $wrapper -ReviewedFilesManifest $ReviewedFilesManifest -ReviewedFilesManifestSha256 $ReviewedFilesManifestSha256 -Apply
    Check (-not (Test-Path -LiteralPath (Join-Path $workspace $candidate.path))) 'real wrapper performs exact deletion with current full EXE proof'
  }
  Write-Host ('Reviewed generated files: ' + $passed.Count + ' scenarios, ' + $checks + ' checks passed: ' + ($passed -join ', '))
}
finally {
  foreach ($link in $junctions) { if (Test-Path -LiteralPath $link) { [IO.Directory]::Delete($link) } }
  if ($fixture.StartsWith($root+'\tmp\reviewed-files-test-',[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $fixture)) { Remove-Item -LiteralPath $fixture -Recurse -Force }
}
