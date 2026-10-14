using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Threading;
using System.Threading.Tasks;
using TableMax.Installation;

namespace TableMax.Desktop
{
    internal sealed class InstallationSession : IDisposable
    {
        private readonly InstallationManifest identity;
        private readonly Func<string, Task<object>> control;
        private readonly Action stopped;
        private NamedPipeServerStream server;
        private bool disposed;
        public InstallationSession(InstallationManifest identity, Func<string, Task<object>> control, Action stopped)
        {
            this.identity = identity; this.control = control; this.stopped = stopped;
            _ = Task.Run(Serve);
        }
        private async Task Serve()
        {
            while (!disposed)
            {
                try
                {
                    var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false);
                    security.AddAccessRule(new PipeAccessRule(WindowsIdentity.GetCurrent().User, PipeAccessRights.FullControl, AccessControlType.Allow));
                    using (var pipe = new NamedPipeServerStream(InstallationCore.ControlPipe(identity.root), PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 16384, 16384, security))
                    {
                        server = pipe; if (disposed) return; await pipe.WaitForConnectionAsync();
                        using (var input = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                        using (var output = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true })
                        {
                            var line = await ReadLine(input, 16384, 10000);
                            var request = InstallationCore.Object(StrictJson.Parse(line)); InstallationCore.Keys(request, "schemaVersion", "root", "operation");
                            if (InstallationCore.Number(request, "schemaVersion") != 1 || !InstallationCore.Equal(InstallationCore.Text(request, "root"), identity.root)) throw new IOException("安装控制请求不匹配。");
                            var operation = InstallationCore.Text(request, "operation"); if (operation != "inspect" && operation != "update" && operation != "uninstall") throw new IOException("安装控制操作无效。");
                            var result = await control(operation); await output.WriteLineAsync(InstallationCore.Encode(result));
                            if (operation != "inspect")
                            {
                                var map = Json.Object(result); if (Json.Bool(map, "confirmed")) stopped();
                            }
                        }
                    }
                }
                catch (Exception) { if (disposed) return; /* Local malformed requests cannot terminate the desktop. */ }
                finally { server = null; }
            }
        }
        internal static async Task<string> ReadLine(StreamReader reader, int limit, int timeout)
        {
            var text = new System.Text.StringBuilder(); var buffer = new char[1];
            var reading = Task.Run(async () => { while (true) { var count = await reader.ReadAsync(buffer, 0, 1); if (count == 0 || buffer[0] == '\n') return text.ToString(); if (text.Length >= limit) throw new IOException("安装控制消息过长。"); text.Append(buffer[0]); } });
            if (await Task.WhenAny(reading, Task.Delay(timeout)) != reading) throw new TimeoutException("安装控制超时。"); return await reading;
        }
        public static async Task ConfirmHealth(InstallationManifest identity, string dataDirectory, string mapping, object health, int servicePid, string name, string token)
        {
            if (name == null && token == null) return;
            if (name == null || !name.StartsWith("TableMax.Health.", StringComparison.Ordinal) || token == null || token.Length != 64) throw new IOException("安装健康交接无效。");
            identity.Verify(identity.root);
            var build = typeof(DesktopContext).Assembly.GetName().Version.ToString(4);
            if (build != identity.buildVersion || mapping != identity.currentMappingSha256 || Json.String(Json.Object(health), "status") != "ready" || servicePid <= 0) throw new IOException("新版程序健康身份不匹配。");
            using (var pipe = new NamedPipeClientStream(".", name, PipeDirection.InOut, PipeOptions.Asynchronous))
            {
                await Task.Run(() => pipe.Connect(10000));
                using (var writer = new StreamWriter(pipe, InstallationCore.Utf8, 4096, true) { AutoFlush = true })
                using (var reader = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                {
                    await writer.WriteLineAsync(InstallationCore.Encode(new { schemaVersion = 1, token, installationId = identity.installationId, root = identity.root, boxRoot = identity.boxRoot, dataDirectory = InstallationCore.Full(dataDirectory), buildVersion = build, payloadManifestSha256 = identity.payloadManifestSha256, currentMappingSha256 = mapping, desktopPid = Process.GetCurrentProcess().Id, servicePid, health = "ready" }));
                    var acknowledgement = InstallationCore.Object(StrictJson.Parse(await ReadLine(reader, 4096, 10000))); InstallationCore.Keys(acknowledgement, "accepted"); if (!(acknowledgement["accepted"] is bool accepted) || !accepted) throw new IOException("安装健康确认未被接受。");
                }
            }
        }
        public void Dispose() { disposed = true; try { server?.Dispose(); } catch (IOException) { } }
    }
}
