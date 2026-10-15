using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading.Tasks;
using TableMax.Installation;

namespace TableMax.Desktop
{
    // This pipe can only request the existing update panel. It never accepts
    // paths, downloads, Apply, service shutdown or an arbitrary bridge command.
    internal sealed class UpdateActivation : IDisposable
    {
        private readonly InstallationManifest identity;
        private readonly Func<Task> activate;
        private readonly Action<string> log;
        private readonly object gate = new object();
        private NamedPipeServerStream current;
        private bool disposed;

        public UpdateActivation(InstallationManifest identity, Func<Task> activate, Action<string> log)
        {
            this.identity = identity; this.activate = activate; this.log = log;
            RequireOwner(identity); _ = Task.Run(Serve);
        }
        private static void RequireOwner(InstallationManifest identity)
        {
            using (var user = WindowsIdentity.GetCurrent())
                if (identity.ownerSid != user.User.Value) throw new UnauthorizedAccessException("更新入口与当前 Windows 用户不匹配。");
        }
        private static string PipeName(InstallationManifest identity)
        {
            using (var hash = SHA256.Create())
                return "TableMax.UpdateActivation." + BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(identity.root.ToUpperInvariant() + "\n" + identity.installationId + "\n" + identity.ownerSid))).Replace("-", "");
        }
        private static Process Peer(PipeStream pipe, bool server, InstallationManifest identity)
        {
            uint id;
            bool observed = server ? GetNamedPipeClientProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out id) : GetNamedPipeServerProcessId(pipe.SafePipeHandle.DangerousGetHandle(), out id);
            if (!observed) throw new Win32Exception(Marshal.GetLastWin32Error());
            var process = Process.GetProcessById(checked((int)id));
            try
            {
                var handle = process.Handle; var buffer = new StringBuilder(32768); uint length = (uint)buffer.Capacity;
                if (!QueryFullProcessImageName(handle, 0, buffer, ref length)) throw new Win32Exception(Marshal.GetLastWin32Error());
                if (!InstallationCore.Equal(buffer.ToString(), Path.Combine(identity.boxRoot, "app", "TableMax.exe"))) throw new UnauthorizedAccessException("更新唤起进程不属于这个安装实例。");
                IntPtr token;
                if (!OpenProcessToken(handle, 0x0008, out token)) throw new Win32Exception(Marshal.GetLastWin32Error());
                try { using (var owner = new WindowsIdentity(token)) if (owner.User.Value != identity.ownerSid) throw new UnauthorizedAccessException("更新唤起进程不属于当前 Windows 用户。"); }
                finally { CloseHandle(token); }
                return process;
            }
            catch { process.Dispose(); throw; }
        }
        private static async Task<string> ReadLine(StreamReader reader)
        {
            var text = new StringBuilder(); var character = new char[1];
            var deadline = DateTime.UtcNow.AddSeconds(10);
            while (text.Length < 4096)
            {
                var remaining = deadline - DateTime.UtcNow;
                if (remaining <= TimeSpan.Zero) throw new TimeoutException("更新入口响应超时。");
                var read = reader.ReadAsync(character, 0, 1);
                if (await Task.WhenAny(read, Task.Delay(remaining)).ConfigureAwait(false) != read) throw new TimeoutException("更新入口响应超时。");
                if (await read.ConfigureAwait(false) == 0) throw new IOException("更新入口连接已关闭。");
                if (character[0] == '\n') return text.ToString();
                if (character[0] == '\r') throw new IOException("更新入口消息格式无效。");
                text.Append(character[0]);
            }
            throw new IOException("更新入口消息过长。");
        }
        private static void WriteFrame(PipeStream pipe, object value)
        {
            var bytes = InstallationCore.Utf8.GetBytes(InstallationCore.Encode(value) + "\n");
            pipe.Write(bytes, 0, bytes.Length); pipe.Flush();
        }
        public static bool TryActivate(InstallationManifest identity)
        {
            RequireOwner(identity);
            using (var pipe = new NamedPipeClientStream(".", PipeName(identity), PipeDirection.InOut, PipeOptions.Asynchronous, TokenImpersonationLevel.Identification))
            {
                try { pipe.Connect(8000); } catch (TimeoutException) { return false; }
                using (var peer = Peer(pipe, false, identity))
                using (var input = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                {
                    WriteFrame(pipe, new { schemaVersion = 1, operation = "check-updates", root = identity.root, installationId = identity.installationId, ownerSid = identity.ownerSid, buildVersion = identity.buildVersion });
                    var result = InstallationCore.Object(StrictJson.Parse(ReadLine(input).GetAwaiter().GetResult(), true));
                    InstallationCore.Keys(result, "schemaVersion", "operation", "root", "installationId", "ownerSid", "buildVersion", "desktopPid", "accepted");
                    if (InstallationCore.Number(result, "schemaVersion") != 1 || InstallationCore.Text(result, "operation") != "check-updates" || !InstallationCore.Equal(InstallationCore.Text(result, "root"), identity.root) || InstallationCore.Text(result, "installationId") != identity.installationId || InstallationCore.Text(result, "ownerSid") != identity.ownerSid || InstallationCore.Text(result, "buildVersion") != identity.buildVersion || InstallationCore.Number(result, "desktopPid") != peer.Id || !(result["accepted"] is bool accepted) || !accepted)
                        throw new IOException("运行中的 TableMax 未确认这个安装实例的更新请求。");
                    return true;
                }
            }
        }
        private async Task Serve()
        {
            while (true)
            {
                lock (gate) if (disposed) return;
                try
                {
                    var security = new PipeSecurity(); security.SetAccessRuleProtection(true, false);
                    security.AddAccessRule(new PipeAccessRule(new SecurityIdentifier(identity.ownerSid), PipeAccessRights.FullControl, AccessControlType.Allow));
                    using (var pipe = new NamedPipeServerStream(PipeName(identity), PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous, 4096, 4096, security))
                    {
                        lock (gate) { if (disposed) return; current = pipe; }
                        await pipe.WaitForConnectionAsync();
                        using (var peer = Peer(pipe, true, identity))
                        using (var input = new StreamReader(pipe, InstallationCore.Utf8, false, 4096, true))
                        {
                            string owner = null; pipe.RunAsClient(() => { using (var user = WindowsIdentity.GetCurrent()) owner = user.User.Value; });
                            if (owner != identity.ownerSid) throw new UnauthorizedAccessException("更新请求不属于当前 Windows 用户。");
                            var request = InstallationCore.Object(StrictJson.Parse(await ReadLine(input), true));
                            InstallationCore.Keys(request, "schemaVersion", "operation", "root", "installationId", "ownerSid", "buildVersion");
                            if (InstallationCore.Number(request, "schemaVersion") != 1 || InstallationCore.Text(request, "operation") != "check-updates" || !InstallationCore.Equal(InstallationCore.Text(request, "root"), identity.root) || InstallationCore.Text(request, "installationId") != identity.installationId || InstallationCore.Text(request, "ownerSid") != identity.ownerSid || InstallationCore.Text(request, "buildVersion") != identity.buildVersion) throw new IOException("更新请求的安装身份不匹配。");
                            var shown = activate();
                            if (await Task.WhenAny(shown, Task.Delay(10000)) != shown) throw new TimeoutException("主机窗口尚未确认更新面板。");
                            await shown;
                            WriteFrame(pipe, new { schemaVersion = 1, operation = "check-updates", root = identity.root, installationId = identity.installationId, ownerSid = identity.ownerSid, buildVersion = identity.buildVersion, desktopPid = Process.GetCurrentProcess().Id, accepted = true });
                        }
                    }
                }
                catch (Exception error) { lock (gate) { if (disposed) return; } log("Update activation rejected: " + error.GetType().Name); await Task.Delay(200); }
                finally { lock (gate) current = null; }
            }
        }
        public void Dispose() { lock (gate) { disposed = true; current?.Dispose(); } }

        [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)] private static extern bool GetNamedPipeClientProcessId(IntPtr pipe, out uint clientProcessId);
        [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)] private static extern bool GetNamedPipeServerProcessId(IntPtr pipe, out uint serverProcessId);
        [DllImport("kernel32.dll", EntryPoint = "QueryFullProcessImageNameW", ExactSpelling = true, CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool QueryFullProcessImageName(IntPtr process, int flags, StringBuilder name, ref uint size);
        [DllImport("advapi32.dll", ExactSpelling = true, SetLastError = true)] private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
        [DllImport("kernel32.dll", ExactSpelling = true)] private static extern bool CloseHandle(IntPtr handle);
    }
}
