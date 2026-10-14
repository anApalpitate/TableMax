using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

namespace TableMax.Desktop
{
    internal sealed class ServiceStopResult
    {
        public string Status { get; }
        public int? ExitCode { get; }
        public bool Confirmed => Status == "drained" && ExitCode == 0;
        public ServiceStopResult(string status, int? exitCode) { Status = status; ExitCode = exitCode; }
    }
    internal sealed class ServiceProcess : IDisposable
    {
        private IntPtr job;
        private Process process;
        private StreamWriter input;
        private StreamReader output, error;
        private readonly Action<string> diagnostics;
        private readonly TaskCompletionSource<Dictionary<string, object>> ready = new TaskCompletionSource<Dictionary<string, object>>();
        private readonly TaskCompletionSource<int> exited = new TaskCompletionSource<int>();
        private volatile bool stopping;
        private readonly object stopLock = new object();
        private Task<ServiceStopResult> stopTask;
        private Task stdoutPump = Task.CompletedTask;
        private string stoppedStatus;
        private bool responseFailed;
        private long migrationProgressTicks;
        private int exitReported;
        public event Action<int> UnexpectedExit;
        public int Id => process?.Id ?? 0;
        public bool HasExited => exited.Task.IsCompleted || (process != null && process.HasExited);
        public ServiceProcess(Action<string> diagnostics) { this.diagnostics = diagnostics; }
        public async Task<Dictionary<string, object>> Start(string directory, object configuration)
        {
            lock (stopLock) if (stopping || process != null) throw new InvalidOperationException("Local service cannot start after shutdown or start twice.");
            var executable = Path.Combine(directory, "node.exe");
            var service = Path.Combine(directory, "server.cjs");
            if (!File.Exists(executable) || !File.Exists(service)) throw new FileNotFoundException("便携包缺少本地服务文件，请重新解压完整程序包。");
            lock (stopLock)
            {
                if (stopping || process != null) throw new InvalidOperationException("Local service cannot start after shutdown or start twice.");
                job = NativeMethods.CreateKillJob();
                try { process = NativeMethods.StartInJob(job, executable, "\"" + service + "\" --desktop-pipe", directory, out input, out output, out error); }
                catch { CloseJob(); throw; }
            }
            process.Exited += (_, __) =>
            {
                if (System.Threading.Interlocked.Exchange(ref exitReported, 1) != 0) return;
                var code = process.ExitCode;
                exited.TrySetResult(code);
                if (!stopping) UnexpectedExit?.Invoke(code);
            };
            process.EnableRaisingEvents = true;
            stdoutPump = Task.Run(async () =>
            {
                try
                {
                    string line;
                    while ((line = await output.ReadLineAsync()) != null)
                    {
                        if (line.Length > 1048576) throw new IOException("Invalid service startup response.");
                        var message = Json.Decode(line);
                        if (Json.String(message, "type") == "ready")
                        {
                            if (!(Json.Value(message, "port") is int port) || port < 1 || port > 65535 || string.IsNullOrEmpty(Json.String(message, "hostToken")) || !(Json.Value(message, "health") is Dictionary<string, object>))
                                throw new IOException("Invalid service ready response.");
                            ready.TrySetResult(message);
                        }
                        else if (Json.String(message, "type") == "startup-progress")
                        {
                            if (message.Count != 2 || Json.String(message, "stage") != "save-migration")
                                throw new IOException("Invalid service startup progress.");
                            System.Threading.Interlocked.Exchange(ref migrationProgressTicks, Stopwatch.GetTimestamp());
                            diagnostics("正在迁移并核验旧存档，请等待完成。不会删除原存档。");
                        }
                        else if (Json.String(message, "type") == "error")
                        {
                            responseFailed = true;
                            ready.TrySetException(new IOException(Json.String(message, "message", "Local service startup failed.") + " " + Json.String(message, "code", "")));
                        }
                        else if (Json.String(message, "type") == "stopped")
                        {
                            var status = Json.String(message, "status");
                            if (!stopping || message.Count != 2 || stoppedStatus != null || (status != "drained" && status != "save-failed"))
                                throw new IOException("Invalid service stop confirmation.");
                            stoppedStatus = status;
                        }
                        else throw new IOException("Unexpected service response.");
                    }
                    // The process can exit before its already-written error
                    // line has been read. Drain stdout first so EADDRINUSE and
                    // damaged-save diagnostics win over a generic exit error.
                    ready.TrySetException(new IOException("Local service exited before reporting readiness."));
                }
                catch (Exception cause) { responseFailed = true; ready.TrySetException(cause); }
            });
            _ = Task.Run(async () =>
            {
                try { string line; while ((line = await error.ReadLineAsync()) != null) diagnostics(line); }
                catch (ObjectDisposedException) { }
                catch (IOException) { }
            });
            input.WriteLine(Json.Encode(new { type = "start", config = configuration }));
            var waiting = Stopwatch.StartNew();
            while (!ready.Task.IsCompleted)
            {
                await Task.WhenAny(ready.Task, Task.Delay(250));
                if (ready.Task.IsCompleted) break;
                var progress = System.Threading.Interlocked.Read(ref migrationProgressTicks);
                if (progress == 0 && waiting.Elapsed.TotalSeconds >= 20)
                    throw new TimeoutException("Local service startup timed out.");
                if (progress != 0 && ((Stopwatch.GetTimestamp() - progress) / (double)Stopwatch.Frequency >= 120 || waiting.Elapsed.TotalMinutes >= 30))
                    throw new TimeoutException("Save migration startup timed out.");
            }
            return await ready.Task;
        }
        public Task<ServiceStopResult> Stop()
        {
            lock (stopLock) return stopTask ?? (stopTask = StopCore());
        }
        private async Task<ServiceStopResult> StopCore()
        {
            stopping = true;
            if (process == null) return new ServiceStopResult("not-started", null);
            try { input?.WriteLine(Json.Encode(new { type = "stop" })); input?.Close(); }
            catch (IOException) { }
            catch (ObjectDisposedException) { }
            // A zero process exit is insufficient: drain the private stdout pump
            // so a confirmation written immediately before exit is not lost.
            var complete = Task.WhenAll(exited.Task, stdoutPump);
            if (await Task.WhenAny(complete, Task.Delay(5000)) != complete)
            {
                // Closing the job stops the service and every remaining descendant.
                CloseJob();
                await Task.WhenAny(exited.Task, Task.Delay(1000));
                return new ServiceStopResult("forced", exited.Task.IsCompleted ? (int?)await exited.Task : null);
            }
            await complete;
            var code = await exited.Task;
            return new ServiceStopResult(!responseFailed && stoppedStatus == "drained" && code == 0 ? "drained"
                : !responseFailed && stoppedStatus == "save-failed" ? "save-failed" : "failed", code);
        }
        private void CloseJob() { if (job != IntPtr.Zero) { NativeMethods.CloseHandle(job); job = IntPtr.Zero; } }
        public void Dispose()
        {
            CloseJob();
            input?.Dispose(); output?.Dispose(); error?.Dispose(); process?.Dispose();
        }
    }
}
