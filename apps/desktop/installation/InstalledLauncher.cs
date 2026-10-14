using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
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
            InstallationCore.InitializeRuntime();
            try
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
            catch (Exception error)
            {
                Console.Error.WriteLine(error.Message);
                if (args.Length == 0) MessageBox.Show(error.Message, "TableMax 启动失败", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return 1;
            }
        }
    }
}
