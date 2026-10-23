using System;
using System.Collections.Generic;
using System.IO;

namespace TableMax.Desktop
{
    internal sealed class DisplayPreferences
    {
        public string Resolution = "auto";
        public int InterfaceScale = 100;
        public DisplayPreferences Copy() => new DisplayPreferences { Resolution = Resolution, InterfaceScale = InterfaceScale };
        public object Snapshot() => new { resolution = Resolution, interfaceScale = InterfaceScale };
        public static DisplayPreferences Parse(object input)
        {
            var values = Json.Object(input);
            var resolution = Json.String(values, "resolution");
            var scale = Json.Number(values, "interfaceScale", -1);
            if (values.Count != 2 || !new[] { "auto", "1280x720", "1920x1080", "2560x1440", "3840x2160" }.ContainsValue(resolution) || (scale != 100 && scale != 125 && scale != 150))
                throw new ArgumentException("显示设置参数无效。");
            return new DisplayPreferences { Resolution = resolution, InterfaceScale = (int)scale };
        }
    }
    internal static class ArrayUtilities
    {
        public static bool ContainsValue<T>(this T[] values, T value) => Array.IndexOf(values, value) >= 0;
    }
    internal sealed class DisplayGeometry
    {
        public double Width, Height, ScreenWidth, ScreenHeight, ScaleFactor;
        public object Snapshot(DisplayPreferences preferences)
        {
            var targetWidth = Width;
            var targetHeight = Height;
            if (preferences.Resolution != "auto")
            {
                var parts = preferences.Resolution.Split('x');
                targetWidth = double.Parse(parts[0]) / ScaleFactor;
                targetHeight = double.Parse(parts[1]) / ScaleFactor;
            }
            var requested = Math.Max(1, Math.Min(targetWidth / 1920, targetHeight / 1080)) * preferences.InterfaceScale / 100;
            var limit = Math.Max(1, Math.Min(Width / 1100, Height / 720));
            var factor = Math.Min(Math.Min(requested, limit), 3);
            return new
            {
                preferences = preferences.Snapshot(),
                viewport = new { width = Width, height = Height },
                screen = new { width = ScreenWidth, height = ScreenHeight, scaleFactor = ScaleFactor },
                zoomFactor = factor,
                limited = factor + 1e-9 < requested
            };
        }
    }
    internal sealed class DisplaySettingsStore
    {
        private readonly string path;
        private DisplayPreferences host = new DisplayPreferences();
        public DisplaySettingsStore(string dataDirectory)
        {
            path = Path.Combine(dataDirectory, "display-settings.json");
            try
            {
                var input = Json.Decode(File.ReadAllText(path));
                var version = Json.Number(input, "version");
                if (!((version == 1 && input.Count == 3 && input.ContainsKey("public")) || (version == 2 && input.Count == 2))) throw new ArgumentException("Invalid display settings file.");
                // Reading an old configuration never rewrites it. The retired
                // public preference cannot invalidate a usable host preference.
                host = DisplayPreferences.Parse(Json.Value(input, "host"));
            }
            catch { /* Invalid display preferences must not prevent game recovery. */ }
        }
        public DisplayPreferences Read() => host.Copy();
        public void Save(DisplayPreferences preferences)
        {
            var temporary = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                Directory.CreateDirectory(Path.GetDirectoryName(path));
                using (var stream = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None))
                using (var writer = new StreamWriter(stream))
                {
                    writer.Write(Json.Encode(new { version = 2, host = preferences.Snapshot() }) + "\n");
                    writer.Flush();
                    stream.Flush(true);
                }
                if (File.Exists(path)) File.Replace(temporary, path, null);
                else File.Move(temporary, path);
                host = preferences.Copy();
            }
            catch (Exception cause)
            {
                try { File.Delete(temporary); } catch { }
                throw new IOException("显示设置保存失败，请检查数据目录的写入权限或磁盘空间。", cause);
            }
        }
    }
}
