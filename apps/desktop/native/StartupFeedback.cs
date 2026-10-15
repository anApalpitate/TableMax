using System.Drawing;
using System.Windows.Forms;

namespace TableMax.Desktop
{
    internal sealed class StartupFeedback : Form
    {
        public StartupFeedback(bool updateRequest)
        {
            Text = "TableMax"; ClientSize = new Size(440, 122); FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterScreen; ControlBox = false; AutoScaleMode = AutoScaleMode.Dpi;
            BackColor = Color.FromArgb(244, 250, 246);
            Controls.Add(new Label { Dock = DockStyle.Fill, Padding = new Padding(24), Font = new Font("Microsoft YaHei UI", 12), TextAlign = ContentAlignment.MiddleLeft, Text = updateRequest ? "正在打开程序更新…\n正在连接本机 TableMax，请稍候。" : "正在启动 TableMax…\n正在准备本地服务和主机窗口，请稍候。" });
        }
    }
}
