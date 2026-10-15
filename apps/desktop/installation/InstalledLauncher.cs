using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace TableMax.Installation
{
    internal static class InstalledLauncher
    {
        private static string Quote(string value)
        {
            var result = new StringBuilder("\""); int slashes = 0;
            foreach (char character in value)
            {
                if (character == '\\') { slashes++; continue; }
                result.Append('\\', character == '"' ? slashes * 2 + 1 : slashes); result.Append(character); slashes = 0;
            }
            return result.Append('\\', slashes * 2).Append('"').ToString();
        }
        [STAThread]
        private static int Main(string[] args)
        {
            return Run(args, Array.IndexOf(args, "--check-updates") >= 0);
        }
        internal static int Run(string[] args, bool updateRequest)
        {
            InstallationCore.InitializeRuntime();
            bool silent = Array.IndexOf(args, "--foundation-test") >= 0 || Array.IndexOf(args, "--foundation-check") >= 0 || Array.IndexOf(args, "--inspect-install") >= 0
                || !String.IsNullOrEmpty(Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_PIPE"));
            if (silent)
            {
                try { return Launch(args); }
                catch (Exception error) { Console.Error.WriteLine(error.Message); return 1; }
            }
            Application.EnableVisualStyles(); Application.SetCompatibleTextRenderingDefault(false);
            int result = 1;
            using (var feedback = new Form { Text = "TableMax", ClientSize = new Size(440, 122), FormBorderStyle = FormBorderStyle.FixedDialog, StartPosition = FormStartPosition.CenterScreen, ControlBox = false, BackColor = Color.FromArgb(244, 250, 246), AutoScaleMode = AutoScaleMode.Dpi })
            {
                feedback.Controls.Add(new Label { Dock = DockStyle.Fill, Padding = new Padding(24), Font = new Font("Microsoft YaHei UI", 12), TextAlign = ContentAlignment.MiddleLeft, Text = updateRequest ? "正在打开程序更新…\n已有 TableMax 窗口将直接显示更新面板。" : "正在启动 TableMax…\n正在核对程序并打开主机窗口，请稍候。" });
                feedback.Shown += async (_, __) =>
                {
                    try { result = await Task.Run(() => Launch(args)); }
                    catch (Exception error) { MessageBox.Show(feedback, FailureMessage(error, updateRequest), updateRequest ? "TableMax 更新入口" : "TableMax 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error); }
                    finally { feedback.Close(); }
                };
                Application.Run(feedback);
            }
            return result;
        }
        private static string FailureMessage(Exception error, bool updateRequest)
        {
            var detail = error.GetType().FullName + " HResult=0x" + error.HResult.ToString("X8", System.Globalization.CultureInfo.InvariantCulture) + "\n" + error.StackTrace;
            Console.Error.WriteLine(detail);
            var message = updateRequest ? "无法打开程序更新。已有的 TableMax 和对局不会因此关闭，请稍后重试。" : "TableMax 未能启动。请查看诊断日志后重试；不要删除原数据。";
            try
            {
                var directory = Path.Combine(InstallationCore.Box(InstallationCore.Root(AppDomain.CurrentDomain.BaseDirectory)), "logs");
                InstallationCore.Safe(directory); System.IO.Directory.CreateDirectory(InstallationCore.IO(directory));
                var path = Path.Combine(directory, "launcher.log"); InstallationCore.Safe(path);
                System.IO.File.AppendAllText(InstallationCore.IO(path), DateTime.UtcNow.ToString("o") + " " + detail + "\n", InstallationCore.Utf8);
                return message + "\n\n诊断日志：" + path;
            }
            catch { return message + "\n\n诊断日志无法写入。请检查安装目录的写入权限和磁盘剩余空间，再重新启动。"; }
        }
        private static int Launch(string[] args)
        {
            string root = InstallationCore.Root(AppDomain.CurrentDomain.BaseDirectory);
            bool health = !String.IsNullOrEmpty(Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_PIPE"))
                && !String.IsNullOrEmpty(Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_HEALTH_TOKEN"));
            using (var operation = InstallationCore.Mutex("Operation", root))
            {
                bool locked = false;
                try
                {
                    if (!health && !(locked = InstallationCore.Acquire(operation, 30000))) throw new IOException("安装或卸载正在进行，请稍后启动。");
                    var identity = InstallationManifest.Load(root); identity.Verify(root);
                    if (identity.buildVersion != typeof(InstalledLauncher).Assembly.GetName().Version.ToString(4)) throw new IOException("入口与安装版本不匹配，请运行完整安装包修复。");
                    if (args.Length == 1 && args[0] == "--inspect-install") { Console.Out.WriteLine(InstallationCore.Encode(identity)); return 0; }
                    string program = Path.Combine(identity.boxRoot, "app", "TableMax.exe");
                    var arguments = new List<string>(); foreach (string argument in args) arguments.Add(Quote(argument));
                    var start = new ProcessStartInfo(program, String.Join(" ", arguments)) { WorkingDirectory = Path.GetDirectoryName(program), UseShellExecute = false };
                    start.EnvironmentVariables["TABLEMAX_BOX_DIRECTORY"] = identity.boxRoot;
                    start.EnvironmentVariables["TABLEMAX_INSTALL_ROOT"] = root;
                    start.EnvironmentVariables["TABLEMAX_INSTALLATION_ID"] = identity.installationId;
                    using (var child = Process.Start(start))
                    {
                        if (locked) { operation.ReleaseMutex(); locked = false; }
                        if (health || Array.IndexOf(args, "--foundation-check") >= 0) { child.WaitForExit(); return child.ExitCode; }
                    }
                    return 0;
                }
                finally { if (locked) operation.ReleaseMutex(); }
            }
        }
    }
}
