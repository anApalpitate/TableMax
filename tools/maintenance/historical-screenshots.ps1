# Explicit manual retirement of obsolete rendered screenshots; dot-sourced by cleanup-local.ps1.
function Initialize-HistoricalScreenshots {
  $script:historicalManifestPath = Assert-LocalPath (Join-Path $workspace $HistoricalScreenshotsManifest)
  if (-not $historicalManifestPath.StartsWith($maintenance + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Historical screenshot manifest must stay inside maintenance.' }
  $script:historicalManifestHash = (Get-FileHash -LiteralPath $historicalManifestPath).Hash
  $plan = Get-Content -LiteralPath $historicalManifestPath -Raw -Encoding utf8 | ConvertFrom-Json
  if ($plan.version -ne 1 -or $plan.authorization -ne 'retire-historical-screenshots' -or
      $plan.currentVersion -ne $project.version -or $plan.currentArchiveSha256 -ne $archiveHash -or -not $plan.groups.Count) { throw 'Historical screenshot plan requires explicit retirement authorization and the current verified ZIP.' }
  $allowedLegacy = @('archived-layout-diagnostics-20261003','display-resolution','game-experience','party-reliability','phone-table-levels','pokemon-refresh','six-player-presentation','visual-polish','local-cleanup-20261003-161509-970-intermediates','local-cleanup-20261004-061259-584-intermediates')
  $selectedRoots = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  if (-not ('TableMax.HistoricalScreenshotFilesV1' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
namespace TableMax {
  public static class HistoricalScreenshotFilesV1 {
    public static void Verify(string workspace, string root, string[] paths, long[] sizes, string[] hashes) {
      var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      var checkedDirectories = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      if (paths.Length == 0 || paths.Length != sizes.Length || paths.Length != hashes.Length) throw new Exception("Empty or inconsistent screenshot inventory.");
      for (int i = 0; i < paths.Length; i++) {
        var path = paths[i];
        if (String.IsNullOrEmpty(path) || path.Contains("\\") || path.Contains(":") || Regex.IsMatch(path, @"(^|/)\.\.?(?:/|$)") ||
            !Regex.IsMatch(hashes[i], @"^[a-f0-9]{64}$") ||
            Regex.IsMatch(path, @"(?:^|/)(?:assets?|imagegen|originals?|raw|sources?|references?|research|inputs?|materials?)/|/(?:original|source|raw|reference)[-_.][^/]*$", RegexOptions.IgnoreCase)) throw new Exception("Invalid screenshot path, hash, or protected source directory.");
        var absolute = Path.GetFullPath(Path.Combine(workspace, path.Replace('/', Path.DirectorySeparatorChar)));
        if (!absolute.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || !seen.Add(absolute)) throw new Exception("Screenshot escapes its historical root or is duplicated.");
        var extension = Path.GetExtension(absolute).ToLowerInvariant();
        if (extension != ".png" && extension != ".jpg" && extension != ".jpeg" && extension != ".webp") throw new Exception("Only explicit rendered image files may be retired.");
        var parent = Path.GetDirectoryName(absolute);
        while (parent != null && !String.Equals(parent, workspace, StringComparison.OrdinalIgnoreCase)) {
          if (!checkedDirectories.Add(parent)) break;
          if ((File.GetAttributes(parent) & FileAttributes.ReparsePoint) != 0 || Directory.Exists(Path.Combine(parent, ".git")) || File.Exists(Path.Combine(parent, ".git"))) throw new Exception("Screenshot retirement refuses links and nested repositories.");
          parent = Path.GetDirectoryName(parent);
        }
        var item = new FileInfo(absolute);
        if (!item.Exists || (item.Attributes & (FileAttributes.ReparsePoint | FileAttributes.Directory)) != 0 || item.Length != sizes[i]) throw new Exception("Historical screenshot size or type changed: " + path);
        using (var stream = File.OpenRead(absolute)) using (var hash = SHA256.Create()) {
          var actual = BitConverter.ToString(hash.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
          if (actual != hashes[i]) throw new Exception("Historical screenshot hash changed: " + path);
        }
      }
    }
  }
}
'@
  }
  foreach ($group in $plan.groups) {
    if ($group.path -notmatch '^artifacts/maintenance/([A-Za-z0-9][A-Za-z0-9.-]*)$' -or
        -not $group.files.Count -or -not $group.evidence.Count -or [string]::IsNullOrWhiteSpace($group.reason) -or -not $selectedRoots.Add($group.path)) { throw 'Screenshot retirement needs unique exact historical roots, files, reason and retained text evidence.' }
    $name = $Matches[1]
    if ($name -eq ('v' + $project.version)) { throw 'Current screenshot evidence is protected.' }
    if ($name -match '^v(\d+\.\d+\.\d+)$') {
      # Both are documented retired releases before the requested return to v1.0.2;
      # see project-slimming.md (2026-10-05). Never infer retirement by version order.
      if ([version]$Matches[1] -ge $currentVersion -and $name -notin @('v1.6.0','v1.0.4')) { throw 'Unknown future screenshot evidence is protected.' }
    }
    elseif ($name -notin $allowedLegacy) { throw 'Unknown unversioned evidence roots cannot be retired.' }
    $absolute = Assert-LocalPath (Join-Path $workspace $group.path)
    foreach ($evidence in $group.evidence) {
      $target = Assert-LocalPath (Join-Path $workspace $evidence.path)
      if ($evidence.path -match '\\|(^|/)\.\.?(?:/|$)|:' -or $evidence.path -notmatch '\.(?:json|md|log)$' -or
          -not $target.StartsWith((Join-Path $maintenance ('v' + $project.version)) + '\', [StringComparison]::OrdinalIgnoreCase) -or
          $evidence.sha256 -notmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $evidence.sha256) { throw 'Retirement requires unchanged retained text evidence inside the current version.' }
    }
    Assert-HistoricalScreenshots $group
    $countBefore = $candidates.Count
    Add-Candidate $absolute ('Explicit obsolete historical screenshot retirement: ' + $group.reason)
    if ($candidates.Count -gt $countBefore) {
      $candidate = $candidates[$candidates.Count - 1]
      $candidate.bytes = [long](($group.files | Measure-Object bytes -Sum).Sum)
      $candidate | Add-Member -NotePropertyName historicalScreenshots -NotePropertyValue $group
      $candidate | Add-Member -NotePropertyName deletionScope -NotePropertyValue 'Listed rendered image files only; directories, sources, text and saves retained'
    }
  }
}

function Assert-HistoricalScreenshots($Group) {
  if ((Get-FileHash -LiteralPath $historicalManifestPath).Hash -ne $historicalManifestHash) { throw 'Historical screenshot manifest changed.' }
  foreach ($evidence in $Group.evidence) {
    $target = Assert-LocalPath (Join-Path $workspace $evidence.path)
    if ((Get-FileHash -LiteralPath $target).Hash.ToLowerInvariant() -ne $evidence.sha256) { throw 'Retained historical screenshot text evidence changed.' }
  }
  [TableMax.HistoricalScreenshotFilesV1]::Verify($workspace, (Assert-LocalPath (Join-Path $workspace $Group.path)),
    [string[]]@($Group.files | ForEach-Object { $_.path }), [long[]]@($Group.files | ForEach-Object { $_.bytes }), [string[]]@($Group.files | ForEach-Object { $_.sha256 }))
}
