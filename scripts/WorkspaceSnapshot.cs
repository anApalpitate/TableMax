using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace TableMax {
  public sealed class SnapshotResult {
    public long Bytes;
    public int Entries;
    public DateTime Newest = DateTime.MinValue;
    public string Fingerprint;
  }
  public static class WorkspaceSnapshotV2 {
    private static IEnumerable<FileSystemInfo> Walk(string path) {
      FileSystemInfo first = Directory.Exists(path)
        ? (FileSystemInfo)new DirectoryInfo(path) : new FileInfo(path);
      var pending = new Stack<FileSystemInfo>();
      pending.Push(first);
      while (pending.Count != 0) {
        var item = pending.Pop();
        item.Refresh();
        if (!item.Exists) throw new IOException("Cleanup entry disappeared: " + item.FullName);
        if ((item.Attributes & FileAttributes.ReparsePoint) != 0)
          throw new IOException("Cleanup refuses reparse points: " + item.FullName);
        var directory = item as DirectoryInfo;
        if (directory != null && (Directory.Exists(Path.Combine(directory.FullName, ".git")) || File.Exists(Path.Combine(directory.FullName, ".git"))))
          throw new IOException("Cleanup refuses nested repositories: " + item.FullName);
        yield return item;
        if (directory == null) continue;
        var children = directory.GetFileSystemInfos();
        Array.Sort(children, (a, b) => StringComparer.OrdinalIgnoreCase.Compare(a.Name, b.Name));
        for (int index = children.Length - 1; index >= 0; index--) pending.Push(children[index]);
      }
    }
    public static SnapshotResult Read(string path) {
      var result = new SnapshotResult();
      using (var digest = SHA256.Create()) {
        foreach (var item in Walk(path)) {
          result.Entries++;
          long length = item is FileInfo ? ((FileInfo)item).Length : 0;
          result.Bytes += length;
          if (item.LastWriteTimeUtc > result.Newest) result.Newest = item.LastWriteTimeUtc;
          var metadata = Encoding.UTF8.GetBytes(item.FullName + "|" + length + "|" + item.LastWriteTimeUtc.Ticks + "|" + item.Attributes + "\n");
          digest.TransformBlock(metadata, 0, metadata.Length, metadata, 0);
        }
        digest.TransformFinalBlock(new byte[0], 0, 0);
        result.Fingerprint = BitConverter.ToString(digest.Hash);
      }
      return result;
    }
    public static string[] FindReports(string path) {
      var results = new List<string>();
      foreach (var item in Walk(path))
        if (item is FileInfo && String.Equals(item.Name, "results.json", StringComparison.OrdinalIgnoreCase)) results.Add(item.FullName);
      return results.ToArray();
    }
  }
}
