using System;
using System.Windows.Forms;

namespace TableMax.Installation
{
    internal static class Updater
    {
        [STAThread]
        private static int Main(string[] args)
        {
            if (args.Length != 0 && !(args.Length == 1 && args[0] == "--check-updates"))
            {
                MessageBox.Show("请直接打开 Updater.exe 检查程序更新。", "TableMax 程序更新", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return 2;
            }
            return InstalledLauncher.Run(new[] { "--check-updates" }, true);
        }
    }
}
