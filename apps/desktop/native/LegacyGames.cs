using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Collections.Generic;

namespace TableMax.Portable {
    internal static class LegacyGames {
        private static void Safe(string path) {
            for (var item = Path.GetFullPath(path); !String.IsNullOrEmpty(item); item = Path.GetDirectoryName(item))
                if ((File.Exists(item) || Directory.Exists(item)) && (File.GetAttributes(item) & FileAttributes.ReparsePoint) != 0)
                    throw new IOException("游戏迁移路径包含链接，已保留原程序。");
        }
        private static string Hash(string path) { using (var hash = SHA256.Create()) using (var file = File.OpenRead(path)) return BitConverter.ToString(hash.ComputeHash(file)).Replace("-", "").ToLowerInvariant(); }
        public static void Preserve(string application, string gamesRoot) {
            if (!File.Exists(Path.Combine(application, "modules.json")) || !Directory.Exists(Path.Combine(application, "games")) || Directory.GetFiles(Path.Combine(application, "games"), "*.cjs").Length == 0) return;
            Safe(application); Safe(gamesRoot);
            var files = new List<string> { "modules.json" };
            Action<string> visit = null;
            visit = relative => {
                var path = Path.Combine(application, relative); Safe(path);
                if (!Directory.Exists(path)) return;
                foreach (var child in Directory.GetFileSystemEntries(path).OrderBy(value => value, StringComparer.Ordinal)) {
                    Safe(child); var name = relative + "/" + Path.GetFileName(child);
                    if (Directory.Exists(child)) visit(name); else files.Add(name);
                }
            };
            visit("games"); visit("bots"); visit("web/games");
            var inventory = files.OrderBy(value => value, StringComparer.Ordinal).Select(name => name + "\t" + new FileInfo(Path.Combine(application, name)).Length + "\t" + Hash(Path.Combine(application, name))).ToArray();
            string id; using (var hash = SHA256.Create()) id = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(String.Join("\n", inventory)))).Replace("-", "").ToLowerInvariant();
            var root = Path.Combine(gamesRoot, ".legacy"); Directory.CreateDirectory(root); Safe(root);
            var target = Path.Combine(root, id); Safe(target);
            if (Directory.Exists(target)) { foreach (var name in files) if (Hash(Path.Combine(target, name)) != Hash(Path.Combine(application, name))) throw new IOException("旧游戏保全副本不完整。"); return; }
            var stage = Path.Combine(root, ".stage-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(stage);
            try {
                foreach (var name in files) { var output = Path.Combine(stage, name); Directory.CreateDirectory(Path.GetDirectoryName(output)); File.Copy(Path.Combine(application, name), output); if (Hash(output) != Hash(Path.Combine(application, name))) throw new IOException("旧游戏迁移校验失败。"); }
                File.WriteAllLines(Path.Combine(stage, "inventory.tsv"), inventory, new UTF8Encoding(false));
                Directory.Move(stage, target);
            } finally { if (Directory.Exists(stage)) Directory.Delete(stage, true); }
        }
    }
}
