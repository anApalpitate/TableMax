using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using File = TableMax.Installation.InstallationFile;
using Directory = TableMax.Installation.InstallationDirectory;

namespace TableMax.Installation
{
    // Shared by the installed entry, native desktop and transient update helper.
    internal static class InstallationCore
    {
#if TABLEMAX_INSTALLATION_TEST
        public const string ProductId = "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}";
#else
        public const string ProductId = "{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}";
#endif
        public const int Protocol = 1;
        public static readonly UTF8Encoding Utf8 = new UTF8Encoding(false, true);
        // Run before the first System.IO call in every executable entry point.
        // Standalone csc-built helpers have no targeting config. The switches
        // enable extended syntax; InstallationFile/Directory add the IO prefix.
        public static void InitializeRuntime()
        {
            AppContext.SetSwitch("Switch.System.IO.UseLegacyPathHandling", false);
            AppContext.SetSwitch("Switch.System.IO.BlockLongPaths", false);
        }
        public static string TemporaryPath(string destination) => Path.Combine(Path.GetDirectoryName(destination), ".tm-" + Guid.NewGuid().ToString("N").Substring(0, 16) + ".tmp");
        private static string Ordinary(string path) => path.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase) ? @"\\" + path.Substring(8) : path.StartsWith(@"\\?\", StringComparison.Ordinal) ? path.Substring(4) : path;
        public static string Full(string path) => Path.GetFullPath(Ordinary(path)).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        // Internal IO only: identities and comparisons always retain ordinary
        // canonical paths; callers never gain acceptance for device root input.
        public static string IO(string path)
        {
            var full = Path.GetFullPath(Ordinary(path));
            return full.StartsWith(@"\\", StringComparison.Ordinal) ? @"\\?\UNC\" + full.Substring(2) : @"\\?\" + full;
        }
        public static void ValidateStartupPaths(string root, string dataDirectory)
        {
            var box = Box(root);
            foreach (var file in new[] { Path.Combine(root, "TableMax.exe"), Path.Combine(box, "app", "TableMax.exe"), Path.Combine(box, "app", "node.exe"), Path.Combine(box, "TableMax.config.json") })
                if (Full(file).Length >= 260) throw new IOException("安装位置太深，原生入口无法在此路径启动。请选择较短的安装位置；尚未替换程序。");
            if (dataDirectory != null && new[] { Path.Combine(dataDirectory, "desktop", "webview2"), Path.Combine(dataDirectory, "logs") }.Any(path => Full(path).Length >= 248))
                throw new IOException("配置的数据目录太深，原生浏览器无法在此路径启动。请选择较短的数据目录；尚未替换程序。");
        }
        public static bool Equal(string a, string b) => String.Equals(Full(a), Full(b), StringComparison.OrdinalIgnoreCase);
        public static string Hash(byte[] bytes) { using (var sha = SHA256.Create()) return Hex(sha.ComputeHash(bytes)); }
        public static string HashFile(string path) { Safe(path); using (var sha = SHA256.Create()) using (var stream = File.OpenRead(path)) return Hex(sha.ComputeHash(stream)); }
        private static string Hex(byte[] bytes) => BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        public static string Key(string root) => Hash(Utf8.GetBytes(Full(root).ToLowerInvariant()));
        public static string Box(string root) => Path.Combine(Full(root), "TableMax");
        public static string IdentityPath(string root) => Path.Combine(Box(root), ".install.json");
        public static string ReceiptPath(string root) => Path.Combine(Box(root), ".installer-receipt.json");
        public static string ControlPipe(string root) => "TableMax.Installation." + Key(root);
        public static void Safe(string path)
        {
            for (var cursor = Path.GetFullPath(path); !String.IsNullOrEmpty(cursor); cursor = Path.GetDirectoryName(cursor))
                if ((File.Exists(cursor) || Directory.Exists(cursor)) && (File.GetAttributes(cursor) & FileAttributes.ReparsePoint) != 0)
                    throw new IOException("安装路径包含链接，原内容已保留。");
        }
        public static string Root(string path)
        {
            // Keep installation identities in one ordinary local-drive syntax.
            // Device/UNC aliases must not bypass protected-directory checks.
            if (String.IsNullOrEmpty(path) || path.Length < 3 || !((path[0] >= 'A' && path[0] <= 'Z') || (path[0] >= 'a' && path[0] <= 'z')) || path[1] != ':' || !(path[2] == '\\' || path[2] == '/'))
                throw new IOException("安装根必须使用本机磁盘的标准绝对路径，不能使用 UNC 或设备路径。");
            var root = Full(path); Safe(root);
            if (String.IsNullOrEmpty(root) || Equal(root, Path.GetPathRoot(root))) throw new IOException("不能安装到磁盘根目录。");
            foreach (var special in new[] { Environment.GetFolderPath(Environment.SpecialFolder.Windows), Environment.GetFolderPath(Environment.SpecialFolder.System), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86) })
                if (!String.IsNullOrEmpty(special) && (Equal(root, special) || root.StartsWith(Full(special) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)))
                    throw new IOException("单用户安装不能写入系统保护目录。");
            return root;
        }
        public static string Member(string root, string relative)
        {
            if (String.IsNullOrEmpty(relative) || relative.Contains("\\") || relative.Contains(":") || relative.StartsWith("/") || relative.Split('/').Any(part => part.Length == 0 || part == "." || part == ".." || part.EndsWith(".") || part.EndsWith(" ") || part.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0 || System.Text.RegularExpressions.Regex.IsMatch(part.Split('.')[0], @"^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$", System.Text.RegularExpressions.RegexOptions.IgnoreCase)))
                throw new IOException("安装文件路径无效。");
            var path = Full(Path.Combine(root, relative.Replace('/', Path.DirectorySeparatorChar)));
            if (!path.StartsWith(Full(root) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new IOException("安装文件越出目标目录。");
            Safe(path); return path;
        }
        public static void Atomic(string path, object value)
        {
            Safe(path); Directory.CreateDirectory(Path.GetDirectoryName(path));
            var temporary = TemporaryPath(path); var created = false;
            try
            {
                using (var stream = new FileStream(IO(temporary), FileMode.CreateNew, FileAccess.Write, FileShare.None))
                {
                    created = true;
                    var bytes = Utf8.GetBytes(Encode(value)); stream.Write(bytes, 0, bytes.Length); stream.Flush(true);
                }
                if (File.Exists(path)) File.Replace(temporary, path, null); else File.Move(temporary, path);
            }
            finally { if (created && File.Exists(temporary)) { Safe(temporary); File.Delete(temporary); } }
        }
        public static string Encode(object value) => new JavaScriptSerializer { MaxJsonLength = 1024 * 1024, RecursionLimit = 32 }.Serialize(value);
        public static Dictionary<string, object> Object(object value) => value as Dictionary<string, object> ?? throw new IOException("安装描述不是对象。");
        public static string Text(Dictionary<string, object> value, string key) => value.TryGetValue(key, out var result) && result is string text ? text : throw new IOException("安装描述缺少 " + key + "。");
        public static int Number(Dictionary<string, object> value, string key) => value.TryGetValue(key, out var result) && result is decimal number && number == Decimal.Truncate(number) && number >= 0 && number <= Int32.MaxValue ? (int)number : throw new IOException("安装描述数值无效：" + key + "。");
        public static void Keys(Dictionary<string, object> value, params string[] keys) { if (value.Count != keys.Length || keys.Any(key => !value.ContainsKey(key))) throw new IOException("安装描述包含未知或缺失字段。"); }
        public static string Digest(Dictionary<string, object> value, string key) { var text = Text(value, key); if (text.Length != 64 || text.Any(c => !(c >= '0' && c <= '9') && !(c >= 'a' && c <= 'f'))) throw new IOException("摘要格式无效。"); return text; }
        public static Version Version4(string version) { var parts = version.Split('.'); if (parts.Length != 4 || parts.Any(p => p.Length == 0 || (p.Length > 1 && p[0] == '0') || p.Any(c => c < '0' || c > '9')) || !Version.TryParse(version, out var result) || result.Major != 1) throw new IOException("构建版本无效。"); return result; }
        public static Mutex Mutex(string kind, string root)
        {
            var security = new MutexSecurity(); security.AddAccessRule(new MutexAccessRule(WindowsIdentity.GetCurrent().User, MutexRights.FullControl, AccessControlType.Allow));
            return new Mutex(false, "Global\\TableMax-Installation-" + kind + "-" + Key(root), out _, security);
        }
        public static bool Acquire(Mutex mutex, int timeout) { try { return mutex.WaitOne(timeout); } catch (AbandonedMutexException) { return true; } }
    }

    // The Framework path switches remove managed MAX_PATH checks, but plain
    // Win32 paths still require machine policy. These internal adapters use
    // Unicode extended paths directly, independent of that global policy.
    internal static class InstallationFile
    {
        public static bool Exists(string path) => System.IO.File.Exists(InstallationCore.IO(path));
        public static FileAttributes GetAttributes(string path) => System.IO.File.GetAttributes(InstallationCore.IO(path));
        public static FileStream OpenRead(string path) => System.IO.File.OpenRead(InstallationCore.IO(path));
        public static string ReadAllText(string path, Encoding encoding) => System.IO.File.ReadAllText(InstallationCore.IO(path), encoding);
        public static void Copy(string source, string target, bool overwrite) => System.IO.File.Copy(InstallationCore.IO(source), InstallationCore.IO(target), overwrite);
        public static void Delete(string path) => System.IO.File.Delete(InstallationCore.IO(path));
        public static void Move(string source, string target) => System.IO.File.Move(InstallationCore.IO(source), InstallationCore.IO(target));
        public static void Replace(string source, string target, string backup) => System.IO.File.Replace(InstallationCore.IO(source), InstallationCore.IO(target), backup == null ? null : InstallationCore.IO(backup));
    }
    internal static class InstallationDirectory
    {
        public static bool Exists(string path) => System.IO.Directory.Exists(InstallationCore.IO(path));
        public static DirectoryInfo CreateDirectory(string path) => System.IO.Directory.CreateDirectory(InstallationCore.IO(path));
        public static void Delete(string path) => System.IO.Directory.Delete(InstallationCore.IO(path));
        public static string[] GetDirectories(string path) => System.IO.Directory.GetDirectories(InstallationCore.IO(path)).Select(InstallationCore.Full).ToArray();
        public static string[] GetFileSystemEntries(string path) => System.IO.Directory.GetFileSystemEntries(InstallationCore.IO(path)).Select(InstallationCore.Full).ToArray();
    }

    // JavaScriptSerializer accepts duplicate object keys. Signed and destructive
    // contracts use this bounded parser before any deserialization or side effect.
    internal sealed class StrictJson
    {
        private readonly string source; private readonly bool canonicalIntegers; private int cursor;
        private StrictJson(string source, bool canonicalIntegers) { if (source.Length > 1024 * 1024) throw new IOException("JSON 描述过长。"); this.source = source; this.canonicalIntegers = canonicalIntegers; }
        public static object Parse(string source, bool canonicalIntegers = false) { var parser = new StrictJson(source, canonicalIntegers); var value = parser.Value(0); parser.Space(); if (parser.cursor != source.Length) throw new IOException("JSON 尾部无效。"); return value; }
        private void Space() { while (cursor < source.Length && " \r\n\t".IndexOf(source[cursor]) >= 0) cursor++; }
        private char Take() { if (cursor >= source.Length) throw new IOException("JSON 意外结束。"); return source[cursor++]; }
        private bool At(char c) { Space(); return cursor < source.Length && source[cursor] == c; }
        private object Value(int depth)
        {
            if (depth > (canonicalIntegers ? 16 : 32)) throw new IOException("JSON 嵌套过深。"); Space();
            if (At('{')) { cursor++; var map = new Dictionary<string, object>(StringComparer.Ordinal); if (At('}')) { cursor++; return map; } do { Space(); var key = String(); if (map.ContainsKey(key)) throw new IOException("JSON 字段重复。"); if (!At(':')) throw new IOException("JSON 字段无效。"); cursor++; map.Add(key, Value(depth + 1)); if (At('}')) { cursor++; return map; } if (!At(',')) throw new IOException("JSON 对象无效。"); cursor++; } while (true); }
            if (At('[')) { cursor++; var list = new List<object>(); if (At(']')) { cursor++; return list.ToArray(); } do { list.Add(Value(depth + 1)); if (At(']')) { cursor++; return list.ToArray(); } if (!At(',')) throw new IOException("JSON 数组无效。"); cursor++; } while (true); }
            if (At('"')) return String();
            foreach (var literal in new[] { "true", "false", "null" }) if (source.Substring(cursor).StartsWith(literal, StringComparison.Ordinal)) { cursor += literal.Length; return literal == "null" ? null : (object)(literal == "true"); }
            var start = cursor; if (At('-')) cursor++; if (cursor >= source.Length) throw new IOException("JSON 数值无效。");
            if (source[cursor] == '0') cursor++; else { if (source[cursor] < '1' || source[cursor] > '9') throw new IOException("JSON 数值无效。"); while (cursor < source.Length && Char.IsDigit(source[cursor])) cursor++; }
            if (cursor < source.Length && source[cursor] == '.') { cursor++; var digit = cursor; while (cursor < source.Length && Char.IsDigit(source[cursor])) cursor++; if (digit == cursor) throw new IOException("JSON 数值无效。"); }
            if (cursor < source.Length && (source[cursor] == 'e' || source[cursor] == 'E')) { cursor++; if (cursor < source.Length && (source[cursor] == '+' || source[cursor] == '-')) cursor++; var digit = cursor; while (cursor < source.Length && Char.IsDigit(source[cursor])) cursor++; if (digit == cursor) throw new IOException("JSON 数值无效。"); }
            var raw = source.Substring(start, cursor - start);
            if (!Decimal.TryParse(raw, NumberStyles.Float, CultureInfo.InvariantCulture, out var number)) throw new IOException("JSON 数值超出范围。");
            if (canonicalIntegers && (!System.Text.RegularExpressions.Regex.IsMatch(raw, @"^(0|[1-9][0-9]*)$") || number > 9007199254740991M)) throw new IOException("签名JSON仅允许安全的标准整数。"); return number;
        }
        private string String()
        {
            if (Take() != '"') throw new IOException("JSON 字符串无效。"); var text = new StringBuilder();
            while (true) { var c = Take(); if (c == '"') return text.ToString(); if (c < 32) throw new IOException("JSON 包含控制字符。"); if (c != '\\') { text.Append(c); continue; } c = Take(); switch (c) { case '"': case '\\': case '/': text.Append(c); break; case 'b': text.Append('\b'); break; case 'f': text.Append('\f'); break; case 'n': text.Append('\n'); break; case 'r': text.Append('\r'); break; case 't': text.Append('\t'); break; case 'u': var hex = ""; for (var i = 0; i < 4; i++) hex += Take(); if (!UInt16.TryParse(hex, NumberStyles.HexNumber, CultureInfo.InvariantCulture, out var code)) throw new IOException("JSON 转义无效。"); text.Append((char)code); break; default: throw new IOException("JSON 转义无效。"); } }
        }
    }

    internal sealed class ManagedFile
    {
        public string path { get; set; } public int bytes { get; set; } public string sha256 { get; set; }
    }
    internal sealed class InstallerReceipt
    {
        public int schemaVersion { get; set; } public string productId { get; set; } public string installationId { get; set; } public string buildVersion { get; set; } public int bytes { get; set; } public string sha256 { get; set; }
        public static InstallerReceipt Read(string path, InstallationManifest identity)
        {
            InstallationCore.Safe(path); var value = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(path, InstallationCore.Utf8))); InstallationCore.Keys(value, "schemaVersion", "productId", "installationId", "buildVersion", "bytes", "sha256");
            var result = new InstallerReceipt { schemaVersion = InstallationCore.Number(value, "schemaVersion"), productId = InstallationCore.Text(value, "productId"), installationId = InstallationCore.Text(value, "installationId"), buildVersion = InstallationCore.Text(value, "buildVersion"), bytes = InstallationCore.Number(value, "bytes"), sha256 = InstallationCore.Digest(value, "sha256") };
            if (result.schemaVersion != 1 || result.productId != InstallationCore.ProductId || result.installationId != identity.installationId || result.buildVersion != identity.buildVersion || result.bytes < 1 || result.bytes >= 120000000) throw new IOException("安装器字节身份与安装实例不匹配。"); return result;
        }
    }
    internal sealed class InstallationManifest
    {
        public int schemaVersion { get; set; } public string productId { get; set; } public string arch { get; set; } public int installProtocol { get; set; }
        public string releaseVersion { get; set; } public string buildVersion { get; set; } public string payloadManifestSha256 { get; set; } public string currentMappingSha256 { get; set; } public ManagedFile[] files { get; set; }
        public string installationId { get; set; } public string root { get; set; } public string boxRoot { get; set; } public string ownerSid { get; set; }
        public static InstallationManifest Read(string path, bool installed)
        {
            InstallationCore.Safe(path); if (new FileInfo(InstallationCore.IO(path)).Length > 1024 * 1024) throw new IOException("安装清单过长。");
            var map = InstallationCore.Object(StrictJson.Parse(File.ReadAllText(path, InstallationCore.Utf8), true));
            var required = new[] { "schemaVersion", "productId", "arch", "installProtocol", "releaseVersion", "buildVersion", "payloadManifestSha256", "currentMappingSha256", "files" };
            InstallationCore.Keys(map, installed ? required.Concat(new[] { "installationId", "root", "boxRoot", "ownerSid" }).ToArray() : required);
            if (InstallationCore.Number(map, "schemaVersion") != 1 || InstallationCore.Text(map, "productId") != InstallationCore.ProductId || InstallationCore.Text(map, "arch") != "x64" || InstallationCore.Number(map, "installProtocol") != 1) throw new IOException("安装清单产品不匹配。");
            var version = InstallationCore.Text(map, "buildVersion"); var release = InstallationCore.Text(map, "releaseVersion"); if (InstallationCore.Version4(version).ToString(3) != release) throw new IOException("公开版本与构建不匹配。");
            var list = map["files"] as object[]; if (list == null || list.Length == 0 || list.Length > 20000) throw new IOException("安装文件集合无效。");
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase); var files = new List<ManagedFile>(); long total = 0;
            foreach (var entry in list) { var file = InstallationCore.Object(entry); InstallationCore.Keys(file, "path", "bytes", "sha256"); var relative = InstallationCore.Text(file, "path"); InstallationCore.Member(Path.GetTempPath(), relative); if (!(relative == "TableMax.exe" || relative == "UpdateHelper.exe" || relative.StartsWith("TableMax/app/", StringComparison.Ordinal)) || !names.Add(relative)) throw new IOException("安装文件归属或重复路径无效。"); var length = InstallationCore.Number(file, "bytes"); total += length; files.Add(new ManagedFile { path = relative, bytes = length, sha256 = InstallationCore.Digest(file, "sha256") }); }
            if (new[] { "TableMax.exe", "UpdateHelper.exe", "TableMax/app/TableMax.exe", "TableMax/app/node.exe", "TableMax/app/server.cjs", "TableMax/app/.tablemax-release.json", "TableMax/app/preinstalled-games/bootstrap.json" }.Any(name => !names.Contains(name)) || total >= 120000000) throw new IOException("安装文件不完整或超过体积限制。");
            var result = new InstallationManifest { schemaVersion = 1, productId = InstallationCore.ProductId, arch = "x64", installProtocol = 1, releaseVersion = release, buildVersion = version, payloadManifestSha256 = InstallationCore.Digest(map, "payloadManifestSha256"), currentMappingSha256 = InstallationCore.Digest(map, "currentMappingSha256"), files = files.ToArray() };
            if (installed) { result.installationId = InstallationCore.Text(map, "installationId"); if (!Guid.TryParse(result.installationId, out _)) throw new IOException("安装实例无效。"); result.root = InstallationCore.Root(InstallationCore.Text(map, "root")); result.boxRoot = InstallationCore.Full(InstallationCore.Text(map, "boxRoot")); if (!InstallationCore.Equal(result.boxRoot, InstallationCore.Box(result.root))) throw new IOException("安装配置根不匹配。"); result.ownerSid = InstallationCore.Text(map, "ownerSid"); if (result.ownerSid != WindowsIdentity.GetCurrent().User.Value) throw new IOException("此安装属于另一 Windows 用户，请在原用户账户运行。"); }
            return result;
        }
        public static InstallationManifest Load(string root) { var result = Read(InstallationCore.IdentityPath(root), true); if (!InstallationCore.Equal(result.root, root)) throw new IOException("安装根不匹配。"); return result; }
        public void Verify(string directory)
        {
            foreach (var file in files) { var path = InstallationCore.Member(directory, file.path); if (!File.Exists(path) || new FileInfo(InstallationCore.IO(path)).Length != file.bytes || InstallationCore.HashFile(path) != file.sha256) throw new IOException("安装文件校验失败：" + file.path); }
            if (InstallationCore.HashFile(InstallationCore.Member(directory, "TableMax/app/.tablemax-release.json")) != payloadManifestSha256 || InstallationCore.HashFile(InstallationCore.Member(directory, "TableMax/app/preinstalled-games/bootstrap.json")) != currentMappingSha256) throw new IOException("完整载荷或当前游戏映射身份不匹配。");
        }
    }
}
