using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace TableMax.Release {
  internal sealed class PayloadFile { public string path { get; set; } public long bytes { get; set; } public string sha256 { get; set; } }
  internal sealed class PayloadArchive { public string sha256 { get; set; } }
  internal sealed class PayloadManifest { public string version { get; set; } public PayloadArchive archive { get; set; } public PayloadFile[] files { get; set; } }
  internal static class Launcher {
    private const string Marker = ".tablemax-release.json";
    private static void CheckOwnedTree(string root, PayloadManifest manifest) {
      var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
      names.Add(Marker);
      foreach (var file in manifest.files) names.Add(file.path);
      var pending = new Stack<DirectoryInfo>(); pending.Push(new DirectoryInfo(root));
      while (pending.Count != 0) {
        var directory = pending.Pop(); directory.Refresh(); SafePath(directory.FullName);
        foreach (var item in directory.GetFileSystemInfos()) {
          item.Refresh();
          if ((item.Attributes & FileAttributes.ReparsePoint) != 0) throw new IOException("程序目录包含链接，已停止更新。");
          if (item is DirectoryInfo) pending.Push((DirectoryInfo)item);
          else if (!names.Contains(item.FullName.Substring(root.Length + 1).Replace(Path.DirectorySeparatorChar, '/'))) throw new IOException("程序目录包含额外文件，已保留原内容并停止更新。");
        }
      }
    }
    private static string Hash(Stream stream) { using (var sha = SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(); }
    private static void SafePath(string path) {
      var current = Path.GetFullPath(path);
      while (!String.IsNullOrEmpty(current)) {
        if ((File.Exists(current) || Directory.Exists(current)) && (File.GetAttributes(current) & FileAttributes.ReparsePoint) != 0) throw new IOException("目标路径包含链接，无法安全更新。");
        current = Path.GetDirectoryName(current);
      }
    }
    private static bool Valid(string root, PayloadManifest manifest) {
      if (!Directory.Exists(root)) return false;
      try {
        SafePath(root);
        if (!File.Exists(Path.Combine(root, Marker))) return false;
        CheckOwnedTree(root, manifest);
        foreach (var file in manifest.files) {
          var path = Path.Combine(root, file.path.Replace('/', Path.DirectorySeparatorChar));
          SafePath(path);
          if (!File.Exists(path) || new FileInfo(path).Length != file.bytes) return false;
          using (var input = File.OpenRead(path)) if (Hash(input) != file.sha256) return false;
        }
        return Directory.GetFiles(root, "*", SearchOption.AllDirectories).Length == manifest.files.Length + 1;
      } catch (IOException) { return false; }
    }
    private static string Prepare(string requested, Action<string> status) {
      string target = Path.GetFullPath(requested).TrimEnd(Path.DirectorySeparatorChar);
      string parent = Path.GetDirectoryName(target);
      if (String.IsNullOrEmpty(parent) || target == Path.GetPathRoot(target)) throw new IOException("目标目录无效。");
      SafePath(target);
      Directory.CreateDirectory(parent);
      var assembly = Assembly.GetExecutingAssembly();
      PayloadManifest manifest;
      string manifestText;
      using (var text = new StreamReader(assembly.GetManifestResourceStream("payload.json"))) manifestText = text.ReadToEnd();
      manifest = new JavaScriptSerializer().Deserialize<PayloadManifest>(manifestText);
      if (manifest.files == null || manifest.files.Length == 0) throw new IOException("运行资源清单无效。");
      using (var payload = assembly.GetManifestResourceStream("payload.zip")) if (Hash(payload) != manifest.archive.sha256) throw new IOException("启动文件不完整，请重新下载。");
      string mutexName;
      using (var input = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(target.ToLowerInvariant()))) mutexName = "Local\\TableMax-Release-" + Hash(input);
      using (var mutex = new Mutex(false, mutexName)) {
        bool locked = false;
        try {
          try { locked = mutex.WaitOne(30000); } catch (AbandonedMutexException) { locked = true; }
          if (!locked) throw new IOException("另一启动包正在准备程序，请稍后重试。");
          if (Valid(target, manifest)) return Path.Combine(target, "TableMax.exe");
          if (Directory.Exists(target) && Directory.GetFileSystemEntries(target).Length != 0) {
            string marker = Path.Combine(target, Marker);
            if (!File.Exists(marker)) throw new IOException("目标目录不是受管理的 TableMax 程序目录，已保留原内容。");
            var previous = new JavaScriptSerializer().Deserialize<PayloadManifest>(File.ReadAllText(marker));
            if (previous.files == null) throw new IOException("原程序标记不完整，已停止更新。");
            CheckOwnedTree(target, previous);
          }
          foreach (var process in Process.GetProcesses()) {
            try {
              string executable = process.MainModule.FileName;
              if (executable.StartsWith(target + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("请先关闭正在运行的 TableMax，再打开新版启动包。");
            } catch (System.ComponentModel.Win32Exception) { } catch (InvalidOperationException) { }
            finally { process.Dispose(); }
          }
          string stage = Path.Combine(parent, ".tablemax-stage-" + Guid.NewGuid().ToString("N"));
          string backup = Path.Combine(parent, ".tablemax-previous-" + Guid.NewGuid().ToString("N"));
          var expected = new Dictionary<string, PayloadFile>(StringComparer.OrdinalIgnoreCase);
          long total = 0;
          foreach (var file in manifest.files) {
            string relative = file.path.Replace('/', Path.DirectorySeparatorChar);
            string output = Path.GetFullPath(Path.Combine(stage, relative));
            if (Path.IsPathRooted(relative) || relative.Contains(":") || !output.StartsWith(stage + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) || expected.ContainsKey(file.path)) throw new IOException("资源路径无效。");
            expected.Add(file.path, file); total += file.bytes;
          }
          if (total + System.Text.Encoding.UTF8.GetByteCount(manifestText) >= 100000000) throw new IOException("运行资源超过体积限制。");
          Directory.CreateDirectory(stage);
          bool moved = false;
          try {
            int count = 0;
            using (var payload = assembly.GetManifestResourceStream("payload.zip"))
            using (var archive = new ZipArchive(payload, ZipArchiveMode.Read)) {
              if (archive.Entries.Count != expected.Count) throw new IOException("资源数量不匹配。");
              foreach (var entry in archive.Entries) {
                string name = entry.FullName.Replace('\\', '/');
                PayloadFile file;
                if (!expected.TryGetValue(name, out file) || entry.Length != file.bytes) throw new IOException("未知或不完整的资源。");
                expected.Remove(name);
                string output = Path.GetFullPath(Path.Combine(stage, file.path.Replace('/', Path.DirectorySeparatorChar)));
                Directory.CreateDirectory(Path.GetDirectoryName(output));
                using (var input = entry.Open()) using (var destination = File.Create(output)) input.CopyTo(destination);
                using (var input = File.OpenRead(output)) if (Hash(input) != file.sha256) throw new IOException("资源校验失败。");
                status("正在准备 TableMax " + manifest.version + "… " + (++count) + "/" + manifest.files.Length);
              }
            }
            File.WriteAllText(Path.Combine(stage, Marker), manifestText, new System.Text.UTF8Encoding(false));
            SafePath(target);
            if (Directory.Exists(target)) { Directory.Move(target, backup); moved = true; }
            try { Directory.Move(stage, target); } catch { if (moved) Directory.Move(backup, target); throw; }
            if (moved) { try { Directory.Delete(backup, true); } catch (IOException) { } catch (UnauthorizedAccessException) { } }
            return Path.Combine(target, "TableMax.exe");
          } finally { if (Directory.Exists(stage)) Directory.Delete(stage, true); }
        } finally { if (locked) mutex.ReleaseMutex(); }
      }
    }
    [STAThread]
    private static int Main(string[] args) {
      string extract = null;
      foreach (string arg in args) if (arg.StartsWith("--extract-only=", StringComparison.Ordinal)) extract = arg.Substring(15);
      if (extract != null) {
        try { Prepare(extract, delegate { }); return 0; }
        catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
      }
      if (Array.IndexOf(args, "--foundation-check") >= 0) {
        try {
          var root = AppDomain.CurrentDomain.BaseDirectory;
          var configuration = new TableMax.Portable.StorageConfiguration(root);
          string program = Prepare(Path.Combine(root, ".tablemax", "app"), delegate { });
          var start = new ProcessStartInfo(program, "--foundation-check") { WorkingDirectory = Path.GetDirectoryName(program), UseShellExecute = false, CreateNoWindow = true };
          start.EnvironmentVariables["TABLEMAX_BOX_DIRECTORY"] = root;
          using (var child = Process.Start(start)) { child.WaitForExit(); return child.ExitCode; }
        } catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
      }
      Application.EnableVisualStyles();
      var form = new Form { Text = "TableMax", Width = 440, Height = 150, StartPosition = FormStartPosition.CenterScreen, FormBorderStyle = FormBorderStyle.FixedDialog, MaximizeBox = false };
      var label = new Label { Text = "正在检查运行资源…", Dock = DockStyle.Fill, TextAlign = System.Drawing.ContentAlignment.MiddleCenter };
      bool finished = false;
      form.FormClosing += delegate(object sender, FormClosingEventArgs closing) { if (!finished) closing.Cancel = true; };
      form.Controls.Add(label);
      form.Shown += async delegate {
        try {
          string target = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, ".tablemax", "app");
          string program = await Task.Run(() => Prepare(target, message => { if (!form.IsDisposed && form.IsHandleCreated) form.BeginInvoke((Action)(() => label.Text = message)); }));
          var launch = new ProcessStartInfo(program) { WorkingDirectory = Path.GetDirectoryName(program), UseShellExecute = false };
          launch.EnvironmentVariables["TABLEMAX_BOX_DIRECTORY"] = AppDomain.CurrentDomain.BaseDirectory;
          Process.Start(launch);
          finished = true; form.Close();
        } catch (Exception error) { MessageBox.Show(form, error.Message, "TableMax 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error); finished = true; form.Close(); }
      };
      Application.Run(form);
      return 0;
    }
  }
}
