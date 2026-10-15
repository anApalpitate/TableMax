using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Reflection;
using System.Security.Cryptography;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using TableMax.Installation;
using File = TableMax.Installation.InstallationFile;
using Directory = TableMax.Installation.InstallationDirectory;

namespace TableMax.Desktop
{
    internal sealed class ApplicationUpdate : IDisposable
    {
        private readonly InstallationManifest installation;
        private readonly Func<Task<bool>> prepare;
        private readonly Action quit;
        private readonly Action<string> shutdownFailure;
        private readonly Action<object> changed;
        private readonly Dictionary<string, string> keys;
        private readonly InstallerReceipt installedReceipt;
        private readonly Func<HttpMessageHandler> handlerFactory;
        private readonly object gate = new object();
        private CancellationTokenSource cancellation;
        private string phase = "idle", error, notes, envelope, downloaded;
        private UpdateDescriptor target;
        private long received;
        private long releaseId, assetId;
        private int panelRequestId;
        private bool disposed;
        public const string ManualUrl = "https://github.com/" + UpdateDescriptor.Repository + "/releases";
        public ApplicationUpdate(InstallationManifest installation, bool testing, Func<Task<bool>> prepare, Action quit, Action<string> shutdownFailure, Action<object> changed, Func<HttpMessageHandler> handlerFactory = null)
        {
            this.installation = installation; this.prepare = prepare; this.quit = quit; this.shutdownFailure = shutdownFailure; this.changed = changed;
            this.handlerFactory = handlerFactory ?? (() => new HttpClientHandler { AllowAutoRedirect = false, UseDefaultCredentials = false });
            keys = TrustRoots.Read(typeof(ApplicationUpdate).Assembly);
            if (installation != null) installedReceipt = InstallerReceipt.Read(InstallationCore.ReceiptPath(installation.root), installation);
            var overridePath = testing ? Environment.GetEnvironmentVariable("TABLEMAX_TEST_APPLICATION_KEYS") : null;
            if (overridePath != null) keys = TrustRoots.Parse(File.ReadAllText(overridePath, InstallationCore.Utf8));
            if (installation != null && keys.Count > 0) InstallationLaunch.CleanupFinished(installation, installedReceipt, (signed, completedTarget, completedReceipt) =>
            {
                var completed = UpdateDescriptor.Verify(signed, keys);
                if (completed.buildVersion != completedTarget.buildVersion || completed.payloadManifestSha256 != completedTarget.payloadManifestSha256 || completed.currentMappingSha256 != completedTarget.currentMappingSha256 || completed.bytes != completedReceipt.bytes || completed.sha256 != completedReceipt.sha256) throw new IOException("已完成更新签名与安装事务不匹配，未清理。");
            });
            if (installation == null || keys.Count == 0) { phase = "unsupported"; error = installation == null ? "便携程序请手动运行完整安装器。" : "当前程序尚未配置应用更新信任根，请手动获取完整安装器。"; }
        }
        public object Read()
        {
            lock (gate) return new { supported = installation != null && keys.Count > 0, phase, panelRequestId, currentVersion = installation?.buildVersion ?? typeof(DesktopContext).Assembly.GetName().Version.ToString(4), targetVersion = target?.buildVersion, notes, downloadedBytes = received, totalBytes = target?.bytes ?? 0, error, manualUrl = ManualUrl };
        }
        public object OpenPanel()
        {
            bool check;
            lock (gate)
            {
                if (disposed) throw new IOException("程序正在关闭，请稍后检查更新。");
                panelRequestId = checked(panelRequestId + 1);
                check = phase == "idle" || phase == "up-to-date" || phase == "ahead" || phase == "error";
            }
            Publish();
            return check ? Check() : Read();
        }
        private void Publish() { if (!disposed) changed(Read()); }
        private bool Begin(string next)
        {
            lock (gate)
            {
                if (disposed || installation == null || keys.Count == 0) return false;
                if (phase == "checking" || phase == "downloading" || phase == "applying") throw new IOException("更新操作正在进行。");
                cancellation?.Dispose(); cancellation = new CancellationTokenSource(); cancellation.CancelAfter(TimeSpan.FromMinutes(next == "downloading" ? 10 : 1)); phase = next; error = null;
            }
            Publish(); return true;
        }
        public object Check()
        {
            if (!Begin("checking")) return Read();
            lock (gate) { target = null; downloaded = null; envelope = null; received = 0; notes = null; }
            _ = Task.Run(async () =>
            {
                try
                {
                    var json = await GetText(new Uri("https://api.github.com/repos/" + UpdateDescriptor.Repository + "/releases/latest"), 262144, cancellation.Token);
                    var release = InstallationCore.Object(StrictJson.Parse(json));
                    if (!release.TryGetValue("draft", out var draft) || !(draft is bool) || (bool)draft || !release.TryGetValue("prerelease", out var pre) || !(pre is bool) || (bool)pre) throw new IOException("发布不是正式 stable 版本。");
                    var body = InstallationCore.Text(release, "body"); var signed = UpdateDescriptor.Extract(body, out var humanNotes); var candidate = UpdateDescriptor.Verify(signed, keys);
                    if (InstallationCore.Text(release, "tag_name") != candidate.releaseTag || InstallationCore.Text(release, "html_url") != "https://github.com/" + UpdateDescriptor.Repository + "/releases/tag/" + candidate.releaseTag) throw new IOException("发布标签与签名不匹配。");
                    var assets = release["assets"] as object[]; if (assets == null) throw new IOException("发布附件无效。");
                    if (assets.Length != 2) throw new IOException("正式发布必须恰有完整安装器和源码ZIP两附件。");
                    var matches = assets.Select(InstallationCore.Object).Where(item => item.TryGetValue("name", out var name) && name is string && (string)name == candidate.assetName).ToArray();
                    if (matches.Length != 1 || InstallationCore.Number(matches[0], "size") != candidate.bytes || InstallationCore.Text(matches[0], "browser_download_url") != candidate.assetUrl) throw new IOException("发布附件与已签名资产不匹配。");
                    var sourceName = "TableMax-" + candidate.releaseVersion + "-source.zip";
                    var sources = assets.Select(InstallationCore.Object).Where(item => item.TryGetValue("name", out var name) && name is string && (string)name == sourceName).ToArray();
                    if (sources.Length != 1 || InstallationCore.Text(sources[0], "browser_download_url") != "https://github.com/" + UpdateDescriptor.Repository + "/releases/download/" + candidate.releaseTag + "/" + sourceName || InstallationCore.Number(sources[0], "size") < 1 || InstallationCore.Text(sources[0], "state") != "uploaded" || InstallationCore.Text(matches[0], "state") != "uploaded" || GitHubId(sources[0]) == GitHubId(matches[0])) throw new IOException("正式发布源码或安装器附件状态无效。");
                    if (matches[0].TryGetValue("digest", out var digest) && digest != null && (!(digest is string digestText) || digestText != "sha256:" + candidate.sha256)) throw new IOException("GitHub摘要与签名不匹配。");
                    var selectedRelease = GitHubId(release); var selectedAsset = GitHubId(matches[0]);
                    VerifyMonotonic(candidate, allowOlderInstalled: true);
                    var comparison = InstallationCore.Version4(candidate.buildVersion).CompareTo(InstallationCore.Version4(installation.buildVersion));
                    if (comparison == 0 && (candidate.sha256 != installedReceipt.sha256 || candidate.bytes != installedReceipt.bytes || candidate.payloadManifestSha256 != installation.payloadManifestSha256 || candidate.currentMappingSha256 != installation.currentMappingSha256)) throw new IOException("相同构建的内容身份不同，已拒绝更新。");
                    if (comparison >= 0) InstallationCore.Atomic(Path.Combine(installation.boxRoot, "updates", "highest-envelope.json"), StrictJson.Parse(signed));
                    lock (gate) { target = comparison > 0 ? candidate : null; envelope = signed; notes = humanNotes; releaseId = selectedRelease; assetId = selectedAsset; phase = comparison > 0 ? "available" : comparison == 0 ? "up-to-date" : "ahead"; }
                    Publish();
                }
                catch (Exception cause) { Failure(cause); }
            });
            return Read();
        }
        public object Download()
        {
            lock (gate) { if (target == null || phase != "available") throw new IOException("请先检查并选择可用更新。"); VerifyMonotonic(UpdateDescriptor.Verify(envelope, keys)); }
            if (!Begin("downloading")) return Read();
            _ = Task.Run(async () =>
            {
                string temporary = null; var temporaryCreated = false;
                try
                {
                    var directory = Path.Combine(installation.boxRoot, "updates", "downloads", target.sha256); InstallationCore.Safe(directory); Directory.CreateDirectory(directory);
                    var path = Path.Combine(directory, target.assetName); temporary = path + "." + Guid.NewGuid().ToString("N") + ".partial";
                    using (var handler = handlerFactory())
                    using (var client = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan })
                    {
                        client.DefaultRequestHeaders.UserAgent.ParseAdd("TableMax/" + installation.buildVersion);
                        var url = new Uri(target.assetUrl); var hop = 0;
                        while (true)
                        {
                            if (!UpdateDescriptor.DownloadUrl(url, target.assetUrl, hop)) throw new IOException("更新下载重定向不受支持。");
                            using (var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, cancellation.Token))
                            {
                                if ((int)response.StatusCode >= 300 && (int)response.StatusCode < 400) { if (++hop > 3 || response.Headers.Location == null) throw new IOException("更新下载重定向过多。"); url = new Uri(url, response.Headers.Location); continue; }
                                if (!response.IsSuccessStatusCode || (response.Content.Headers.ContentLength.HasValue && response.Content.Headers.ContentLength != target.bytes)) throw new IOException("更新下载长度或状态错误。");
                                using (var input = await response.Content.ReadAsStreamAsync())
                                using (var output = new FileStream(InstallationCore.IO(temporary), FileMode.CreateNew, FileAccess.Write, FileShare.None, 65536, true))
                                {
                                    temporaryCreated = true;
                                    using (var hash = SHA256.Create())
                                    {
                                        var buffer = new byte[65536]; long length = 0; var previous = Stopwatch.StartNew();
                                        while (true) { var count = await input.ReadAsync(buffer, 0, buffer.Length, cancellation.Token); if (count == 0) break; length += count; if (length > target.bytes) throw new IOException("更新下载超出已签名长度。"); hash.TransformBlock(buffer, 0, count, null, 0); await output.WriteAsync(buffer, 0, count, cancellation.Token); lock (gate) received = length; if (previous.ElapsedMilliseconds >= 200) { Publish(); previous.Restart(); } }
                                        hash.TransformFinalBlock(new byte[0], 0, 0); output.Flush(true);
                                        if (length != target.bytes || BitConverter.ToString(hash.Hash).Replace("-", "").ToLowerInvariant() != target.sha256) throw new IOException("更新下载摘要不匹配。");
                                    }
                                }
                                break;
                            }
                        }
                    }
                    InstallationCore.Safe(path);
                    if (File.Exists(path)) { if (InstallationCore.HashFile(path) != target.sha256) throw new IOException("更新暂存目录已有未知文件，已保留。"); var cleanup = RetirePartial(temporary, ref temporaryCreated); if (cleanup != null) throw new IOException(cleanup); }
                    else { File.Move(temporary, path); temporaryCreated = false; }
                    temporary = null;
                    InstallationCore.Atomic(Path.Combine(directory, "envelope.json"), StrictJson.Parse(envelope));
                    InstallationCore.Atomic(Path.Combine(directory, "receipt.json"), new { schemaVersion = 1, repo = target.repo, releaseTag = target.releaseTag, releaseId, assetId, target.assetName, target.sha256, target.bytes });
                    lock (gate) { downloaded = path; phase = "ready"; }
                    Publish();
                }
                catch (Exception cause) { Failure(cause); }
                finally { var cleanup = RetirePartial(temporary, ref temporaryCreated); if (cleanup != null) Failure(new IOException(cleanup)); }
            });
            return Read();
        }
        public object Cancel()
        {
            lock (gate) { if (phase == "applying") throw new IOException("更新已进入关闭交接，不能取消。"); cancellation?.Cancel(); }
            return Read();
        }
        private static string RetirePartial(string path, ref bool created)
        {
            if (!created || path == null) return null;
            created = false;
            try
            {
                InstallationCore.Safe(path);
                if ((File.GetAttributes(path) & FileAttributes.Directory) != 0) throw new IOException("临时下载路径已变成文件夹。");
                File.Delete(path); return null;
            }
            catch (FileNotFoundException) { return null; }
            catch (DirectoryNotFoundException) { return null; }
            catch (Exception) { return "更新临时下载文件未能安全清理，已保留：" + path; }
        }
        public async Task<object> Apply()
        {
            lock (gate) if (phase != "ready" || target == null || downloaded == null) throw new IOException("完整更新尚未就绪。");
            if (!Begin("applying")) return Read();
            var shutdownTaken = false; var helperStarted = false; InstallationLaunch launch = null;
            try
            {
                var verified = UpdateDescriptor.Verify(envelope, keys); VerifyMonotonic(verified); installation.Verify(installation.root);
                if (verified.buildVersion != target.buildVersion || InstallationCore.Version4(verified.buildVersion) <= InstallationCore.Version4(installation.buildVersion) || new FileInfo(InstallationCore.IO(downloaded)).Length != verified.bytes || InstallationCore.HashFile(downloaded) != verified.sha256) throw new IOException("更新候选已改变，已停止应用。");
                // Prepare the already-verified helper before taking the irreversible
                // service shutdown barrier. It runs outside the service Job.
                var helperFile = installation.files.Single(file => file.path == "UpdateHelper.exe");
                var directory = Path.Combine(installation.boxRoot, "updates", "handoff-" + Guid.NewGuid().ToString("N")); InstallationCore.Safe(directory); Directory.CreateDirectory(directory);
                var helper = Path.Combine(directory, "UpdateHelper.exe"); File.Copy(Path.Combine(installation.root, helperFile.path), helper, false);
                if (InstallationCore.HashFile(helper) != helperFile.sha256) throw new IOException("更新协调器校验失败。");
                var envelopePath = Path.Combine(directory, "envelope.json"); InstallationCore.Atomic(envelopePath, StrictJson.Parse(envelope));
                launch = InstallationLaunch.Create(installation, helper, downloaded, envelopePath, verified.buildVersion, verified.bytes, verified.sha256, verified.payloadManifestSha256, verified.currentMappingSha256);
                if (!await prepare()) { lock (gate) { phase = "ready"; error = "请先结束当前对局；保存失败时不能应用更新。"; } Publish(); return Read(); }
                shutdownTaken = true;
                var handoff = "TableMax.Handoff." + Guid.NewGuid().ToString("N"); var tokenBytes = new byte[32]; using (var rng = RandomNumberGenerator.Create()) rng.GetBytes(tokenBytes); var token = BitConverter.ToString(tokenBytes).Replace("-", "").ToLowerInvariant();
                var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false); security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
                using (var pipe = new NamedPipeServerStream(handoff, PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 4096, 4096, security))
                {
                    var start = new ProcessStartInfo(launch.HelperPath, "--apply-installer --root=" + Quote(installation.root) + " --installer=" + Quote(downloaded) + " --target=" + Quote(envelopePath) + " --parent-pid=" + Process.GetCurrentProcess().Id) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = launch.DirectoryPath };
                    start.EnvironmentVariables["TABLEMAX_PARENT_HANDOFF_PIPE"] = handoff; start.EnvironmentVariables["TABLEMAX_PARENT_HANDOFF_TOKEN"] = token;
                    using (var process = Process.Start(start))
                    {
                        if (process == null) throw new IOException("无法启动更新协调器。");
                        helperStarted = true;
                        var connected = pipe.WaitForConnectionAsync(); if (await Task.WhenAny(connected, Task.Delay(10000)) != connected) throw new IOException("更新协调器未确认持有原进程句柄。"); await connected;
                        using (var reader = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                        {
                            var ready = InstallationCore.Object(StrictJson.Parse(await InstallationSession.ReadLine(reader, 4096, 5000))); InstallationCore.Keys(ready, "token", "helperPid");
                            if (InstallationCore.Text(ready, "token") != token || InstallationCore.Number(ready, "helperPid") != process.Id) throw new IOException("更新协调器交接身份不匹配。");
                        }
                    }
                }
                quit(); return Read();
            }
            catch (Exception cause) { Failure(cause); if (shutdownTaken) shutdownFailure("更新已停止：程序已安全关闭，但无法启动安装器。请重新打开 TableMax；原存档和完整更新候选已保留。"); throw; }
            finally { if (launch != null && !helperStarted) { var cleanup = launch.CleanupUnstarted(); if (cleanup != null) Failure(new IOException(cleanup)); } }
        }
        private void Failure(Exception cause)
        {
            lock (gate)
            {
                if (disposed) return;
                var cancelled = cause is OperationCanceledException;
                phase = cancelled && target != null ? "available" : "error";
                var reason = cause is HttpRequestException ? "无法连接更新服务或读取发布信息。请检查网络连接后重试。"
                    : cause is TimeoutException ? "更新请求超时。请检查网络连接后重试。"
                    : "更新操作失败。请检查网络、磁盘空间和安装目录权限，再重试；也可打开发布页获取完整安装器。";
                var message = cause.Message;
                if (cause is IOException && !String.IsNullOrWhiteSpace(message) && message.Length <= 240 && !message.Any(Char.IsControl) && message.Any(character => character >= '\u4e00' && character <= '\u9fff')) reason = message;
                error = cancelled ? "更新操作已取消。" : reason;
                try
                {
                    var directory = Path.Combine(installation.boxRoot, "logs"); InstallationCore.Safe(directory); Directory.CreateDirectory(directory);
                    var path = Path.Combine(directory, "application-update.log"); InstallationCore.Safe(path);
                    System.IO.File.AppendAllText(InstallationCore.IO(path), DateTime.UtcNow.ToString("o") + " " + cause + "\n", InstallationCore.Utf8);
                    if (!cancelled) error += "\n诊断日志：" + path;
                }
                catch { error += "\n诊断日志无法写入。请检查安装目录的写入权限和磁盘剩余空间；不要删除原数据。"; }
            }
            Publish();
        }
        private async Task<string> GetText(Uri url, int limit, CancellationToken token)
        {
            using (var handler = handlerFactory())
            using (var client = new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan })
            {
                client.DefaultRequestHeaders.UserAgent.ParseAdd("TableMax-application-update"); client.DefaultRequestHeaders.Accept.ParseAdd("application/vnd.github+json");
                using (var response = await client.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, token))
                {
                    if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > limit) throw new IOException("无法读取正式更新发布。");
                    using (var input = await response.Content.ReadAsStreamAsync()) using (var output = new MemoryStream()) { var buffer = new byte[8192]; while (true) { var count = await input.ReadAsync(buffer, 0, buffer.Length, token); if (count == 0) break; if (output.Length + count > limit) throw new IOException("更新发布响应过长。"); output.Write(buffer, 0, count); } return InstallationCore.Utf8.GetString(output.ToArray()); }
                }
            }
        }
        private static long GitHubId(Dictionary<string, object> value)
        {
            if (!value.TryGetValue("id", out var id) || !(id is decimal number) || number <= 0 || number != Decimal.Truncate(number) || number > 9007199254740991M) throw new IOException("GitHub 发布或附件标识无效。"); return (long)number;
        }
        private void VerifyMonotonic(UpdateDescriptor candidate, bool allowOlderInstalled = false)
        {
            var comparison = InstallationCore.Version4(candidate.buildVersion).CompareTo(InstallationCore.Version4(installedReceipt.buildVersion));
            if ((!allowOlderInstalled && comparison < 0) || (comparison == 0 && (candidate.sha256 != installedReceipt.sha256 || candidate.bytes != installedReceipt.bytes))) throw new IOException("降级或相同构建不同安装器字节已被拒绝。");
            var path = Path.Combine(installation.boxRoot, "updates", "highest-envelope.json"); InstallationCore.Safe(path);
            if (!File.Exists(path)) return;
            if (new FileInfo(InstallationCore.IO(path)).Length > 16384) throw new IOException("已接受更新描述损坏，未重置信任水位。");
            var highest = UpdateDescriptor.Verify(File.ReadAllText(path, InstallationCore.Utf8), keys);
            comparison = InstallationCore.Version4(candidate.buildVersion).CompareTo(InstallationCore.Version4(highest.buildVersion));
            if (comparison < 0 || (comparison == 0 && (candidate.sha256 != highest.sha256 || candidate.bytes != highest.bytes || candidate.payloadManifestSha256 != highest.payloadManifestSha256 || candidate.currentMappingSha256 != highest.currentMappingSha256))) throw new IOException("更新低于已接受版本，或相同版本字节已改变。");
        }
        internal static string Quote(string value) { if (value.IndexOf('"') >= 0 || value.EndsWith("\\", StringComparison.Ordinal)) throw new IOException("路径不能安全传递。"); return "\"" + value + "\""; }
        public void Dispose() { lock (gate) { disposed = true; cancellation?.Cancel(); } }
    }
}
