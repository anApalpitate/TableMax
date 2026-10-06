using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace TableMax.Desktop
{
    internal static class Program
    {
        internal static int ExitCode;
        [STAThread]
        private static int Main(string[] arguments)
        {
            // WinExe has no console code page. Redirected Node test pipes still
            // have real handles, so bind explicit UTF-8 readers/writers directly.
            Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = true });
            Console.SetError(new StreamWriter(Console.OpenStandardError(), new UTF8Encoding(false)) { AutoFlush = true });
            Console.SetIn(new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false)));
            var testing = arguments.Contains("--foundation-test");
            var checking = arguments.Contains("--foundation-check");
            var boxDirectory = Environment.GetEnvironmentVariable("TABLEMAX_BOX_DIRECTORY") ?? AppDomain.CurrentDomain.BaseDirectory;
            var dataDirectory = boxDirectory;
            try
            {
                var storage = new TableMax.Portable.StorageConfiguration(boxDirectory);
                dataDirectory = Path.GetFullPath(Environment.GetEnvironmentVariable("TABLEMAX_DATA_DIR") ?? storage.DataDirectory);
                Directory.CreateDirectory(dataDirectory);
                string key;
                using (var hash = SHA256.Create()) key = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(dataDirectory.ToUpperInvariant()))).Replace("-", "").Substring(0, 32);
                using (var mutex = new Mutex(true, "Local\\TableMax-" + key, out var first))
                using (var reopen = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\TableMax-reopen-" + key))
                {
                    if (!first) { reopen.Set(); return 0; }
                    try { NativeMethods.SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) { }
                    Application.EnableVisualStyles();
                    Application.SetCompatibleTextRenderingDefault(false);
                    using (var context = new DesktopContext(dataDirectory, arguments, testing, checking, reopen, storage)) Application.Run(context);
                    mutex.ReleaseMutex();
                }
            }
            catch (Exception cause)
            {
                ExitCode = 1;
                var detail = StartupError.Describe(cause, dataDirectory);
                try { Directory.CreateDirectory(Path.Combine(dataDirectory, "logs")); File.AppendAllText(Path.Combine(dataDirectory, "logs", "desktop.log"), DateTime.UtcNow.ToString("o") + " " + detail + "\n"); } catch { }
                Console.Error.WriteLine(detail);
                if (!testing && !checking) MessageBox.Show(detail, "TableMax 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
            return ExitCode;
        }
    }
    internal static class StartupError
    {
        public static string Describe(Exception cause, string dataDirectory)
        {
            var message = cause.Message;
            var reason = "本地服务无法启动。";
            var remedy = "请查看日志中的具体原因，然后重新启动。";
            if (message.Contains("EADDRINUSE")) { reason = "端口 " + (Environment.GetEnvironmentVariable("TABLEMAX_PORT") ?? "38473") + " 已被其他程序占用。"; remedy = "请关闭重复运行的 TableMax 或占用该端口的程序，再启动；不要删除存档。"; }
            else if (message.Contains("incompatible")) { reason = "存档版本与当前程序或电脑策略不兼容。"; remedy = "请使用兼容版本打开，或先备份完整数据目录后排查；原存档已保留。"; }
            else if (new[] { "damaged", "SQLITE_CORRUPT", "malformed", "not a database" }.Any(message.Contains)) { reason = "存档损坏或无法通过校验。"; remedy = "请备份整个数据目录（包括 WAL／SHM）后检查；不要删除原存档。"; }
            else if (new[] { "EEXIST", "ENOTDIR" }.Any(message.Contains)) { reason = "数据目录路径不是可用的文件夹。"; remedy = "请检查该路径是否被同名文件占用；保留原文件，改用可写的数据目录。"; }
            else if (cause is UnauthorizedAccessException || new[] { "EACCES", "EPERM", "ENOSPC", "read-only", "unable to open database" }.Any(message.Contains)) { reason = "数据目录不可写，或磁盘空间不足。"; remedy = "请检查目录权限和磁盘剩余空间，再重新启动。"; }
            else if (cause is TimeoutException && cause.Message == "Save migration startup timed out.") { reason = "旧存档迁移长时间没有进展，启动已停止。"; remedy = "原存档及迁移备份保留。请检查磁盘空间和日志，然后重新启动。"; }
            else if (cause is TimeoutException) { reason = "本地服务在 20 秒内没有完成启动。"; remedy = "请检查磁盘、安全软件和日志，然后重新启动。"; }
            return reason + "\n" + remedy + "\n\n数据目录：" + dataDirectory + "\n日志目录：" + Path.Combine(dataDirectory, "logs") + "\n\n具体原因：" + message.Substring(0, Math.Min(1500, message.Length));
        }
    }
}
