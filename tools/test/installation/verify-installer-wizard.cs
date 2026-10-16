using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Security.Principal;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;
using System.Windows.Forms;
using Microsoft.Win32;
using Accessibility;

// Independent test entry point. No product code or installer commit entry point is linked.
internal static class InstallerWizardHarness
{
    private const string Notice = "不推荐安装在C盘，因为这是一个有良心的安装包";
    private const string DesktopTask = "创建桌面快捷方式";
    private const string MigrationTask = "是否进行版本迁移";
    private static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 1024 * 1024 };
    private static readonly List<object> Checks = new List<object>();
    private static readonly List<object> Captures = new List<object>();
    private static readonly Dictionary<int, object> Processes = new Dictionary<int, object>();
    private static readonly Stopwatch Budget = Stopwatch.StartNew();
    private static Dictionary<string, object> Plan;
    private static IntPtr Job, Desktop, OriginalDesktop;
    private static string Work, Sid;
    private static string ProgressResultPath;
    private static Process ProgressOwner;
    private static Process OriginalLaunchProcess;
    private static IntPtr LastWindow;

    [MTAThread]
    private static int Main(string[] args)
    {
        if (args.Length == 1 && args[0] == "--check-updates" && Environment.GetEnvironmentVariable("TABLEMAX_ENTRY_COMPONENT") == "1") return UpdaterNativeChild(args);
        // Process-local capture coordinates must be physical pixels at the actual window DPI.
        Require(SetProcessDpiAwarenessContext(new IntPtr(-4)), "Harness PerMonitorV2 initialization failed: " + Marshal.GetLastWin32Error());
        if (args.Length == 1 && args[0] == "--probe-child") return ProbeChild();
        var result = new Dictionary<string, object> { { "passed", false }, { "checks", Checks }, { "captures", Captures }, { "remainingOwnProcesses", -1 }, { "captureDpiContext", "PER_MONITOR_AWARE_V2" } };
        int exit = 1;
        try
        {
            Require(args.Length == 2 && args[0] == "--plan", "Only a scoped plan is accepted");
            Plan = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(args[1], Encoding.UTF8));
            if (Text("mode") == "installer-progress")
            {
                InstallerProgress(result);
                result["passed"] = true; result["failureDomain"] = null; exit = 0;
            }
            else if (Text("mode") == "updater-entry")
            {
                EntryWindows(result);
                result["passed"] = true; result["failureDomain"] = null; exit = 0;
            }
            else
            {
                string[] keys = { "schemaVersion", "mode", "work", "temporary", "captures", "target", "installer", "installerSha256", "productId", "migrationSource", "migrationSourceState" };
                Require(Plan.Count == keys.Length && keys.All(Plan.ContainsKey), "Unknown plan field");
                Require(Convert.ToInt32(Plan["schemaVersion"]) == 1, "Unknown plan version");
                Require(Text("mode") == "api-probe" || Text("mode") == "installer-wizard" || Text("mode") == "original-installer", "Unknown plan mode");
                Work = Path.GetFullPath(Text("work"));
                Require(Directory.Exists(Work) && Path.GetFileName(Work).StartsWith("installer-wizard-", StringComparison.Ordinal), "Fresh wizard work required");
                Safe(Work);
                foreach (string key in new[] { "temporary", "captures", "target", "migrationSource" }) Scoped(Text(key));
                if (Text("mode") == "original-installer") {
                    Safe(Text("installer"));
                    Require(System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(Text("installer")), @"^TableMax-1\.\d+\.\d+\.\d+-installer-win-x64\.exe$"), "Canonical original installer name required");
                    Require(Text("migrationSourceState") == "absent", "Original directory must not receive fixture files");
                    Require(Environment.GetEnvironmentVariable("TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_ROOT") != null, "Verified profile required for original launch");
                    Require(Work.StartsWith(Path.GetFullPath(Environment.GetEnvironmentVariable("TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_ROOT")).TrimEnd('\\') + "\\work\\", StringComparison.OrdinalIgnoreCase), "Original harness work escaped the verified profile");
                    Require(Environment.GetEnvironmentVariable("TABLEMAX_WINDOWS_ACCEPTANCE_PROFILE_SID") == WindowsIdentity.GetCurrent().User.Value, "Original profile SID differs");
                } else Scoped(Text("installer"));
                Require(Text("migrationSourceState") == "absent" || Text("migrationSourceState") == "present", "Unknown migration source state");
                Require(!Directory.Exists(Text("target")) && !File.Exists(Text("target")), "Target must not exist");
                Require(Hash(Text("installer")) == Text("installerSha256"), "Installer bytes changed");
                Require(Text("productId") == "{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}" || Text("productId") == "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}", "Unknown product identity");
                var principal = new WindowsPrincipal(WindowsIdentity.GetCurrent());
                Require(!principal.IsInRole(WindowsBuiltInRole.Administrator), "Standard token required; no elevation is attempted");
                Sid = WindowsIdentity.GetCurrent().User.Value;
                result["ownerSid"] = Sid;
                result["mode"] = Text("mode");
                result["failureDomain"] = "tool-or-environment-not-product-installation";
                result["sourceDirectory"] = Path.GetDirectoryName(Text("installer"));
                result["migrationSourceState"] = Text("migrationSourceState");
                if (Text("mode") == "installer-wizard" || Text("mode") == "original-installer")
                {
                    string automatic = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(Text("installer")), "TableMax"));
                    if (Text("mode") == "original-installer") Safe(automatic); else Scoped(automatic);
                    Require(Directory.Exists(automatic) == (Text("migrationSourceState") == "present"), "Automatic migration source fixture state changed");
                    Require(File.Exists(Path.Combine(Text("migrationSource"), "TableMax.config.json")), "Manual migration fixture config is required");
                    Require(SamePath(Text("migrationSource"), automatic) == false, "Manual fixture must differ from automatic migration source");
                }
                object registrationBefore = Registrations();
                result["registrationBefore"] = registrationBefore;
                Require(((List<object>)registrationBefore).Count == 0, "Existing product registration must be preserved; use a clean SID");
                string desktopName = "TMVerify_" + Guid.NewGuid().ToString("N");
                OriginalDesktop = GetThreadDesktop(GetCurrentThreadId());
                // Never SwitchDesktop: all controls and captures stay off the user's active desktop.
                Desktop = CreateDesktop(desktopName, null, IntPtr.Zero, 0, 0x01FF, IntPtr.Zero);
                Require(Desktop != IntPtr.Zero, "CreateDesktop failed: " + Marshal.GetLastWin32Error());
                Require(SetThreadDesktop(Desktop), "SetThreadDesktop failed: " + Marshal.GetLastWin32Error());
                Job = CreateJobObject(IntPtr.Zero, null);
                Require(Job != IntPtr.Zero, "CreateJobObject failed");
                var limits = new JobExtendedLimits();
                limits.Basic.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
                Require(SetInformationJobObject(Job, 9, ref limits, (uint)Marshal.SizeOf(typeof(JobExtendedLimits))), "Job cleanup policy failed");
                Start(Text("installer"), Text("mode") == "api-probe" ? "--probe-child" : "/SP- /NORESTART /LOG=\"" + Scoped(Path.Combine(Work, "installer.log")) + "\"", desktopName);
                if (Text("mode") == "api-probe") Probe(); else Wizard();
                Wait(() => OwnProcesses().Length == 0, "Own process exit", 15000);
                if (OriginalLaunchProcess != null) {
                    Require(OriginalLaunchProcess.WaitForExit(5000), "Original installer did not exit after cancellation");
                    result["originalProcessExitCode"] = OriginalLaunchProcess.ExitCode;
                    result["originalProcessExitedBeforeCleanup"] = true;
                    Require(OriginalLaunchProcess.ExitCode == 2, "Original installer did not return the normal user-cancel exit code");
                }
                object registrationAfter = Registrations();
                result["registrationAfter"] = registrationAfter;
                Require(((List<object>)registrationAfter).Count == 0, "Browsing changed product registration");
                Require(!Directory.Exists(Text("target")) && !File.Exists(Text("target")), "Browsing created target files");
                Require(!Directory.Exists(Path.Combine(Text("target"), "data")), "Browsing created internal data files");
                Check("no-registration-or-target-after-cancel", new { registrationCount = 0, targetExists = false, boxRoot = Path.Combine(Text("target"), "data"), boxRootExists = false, applicationRoot = Path.Combine(Text("target"), "data", "app"), installed = false });
                Require(Hash(Text("installer")) == Text("installerSha256"), "Launch copy changed");
                result["passed"] = true;
                result["failureDomain"] = null;
                exit = 0;
            }
        }
        catch (Exception error)
        {
            result["error"] = error.ToString();
            if (LastWindow != IntPtr.Zero)
            {
                try { Capture(LastWindow, "failure", true); }
                catch (Exception captureError) { result["failureCaptureError"] = captureError.Message; }
            }
        }
        finally
        {
            try
            {
                if (Job != IntPtr.Zero)
                {
                    int[] before = OwnProcesses();
                    result["cleanupTerminatedOwnProcesses"] = before;
                    if (before.Length != 0) Require(TerminateJobObject(Job, 91), "Own Job termination failed");
                    var stop = Stopwatch.StartNew();
                    while (OwnProcesses().Length != 0 && stop.ElapsedMilliseconds < 10000) Thread.Sleep(50);
                    result["remainingOwnProcesses"] = OwnProcesses().Length;
                    Require(Convert.ToInt32(result["remainingOwnProcesses"]) == 0, "Own process survived cleanup");
                    CloseHandle(Job);
                    Job = IntPtr.Zero;
                }
                else result["remainingOwnProcesses"] = 0;
                ProgressOwner?.Dispose(); ProgressOwner = null;
                OriginalLaunchProcess?.Dispose(); OriginalLaunchProcess = null;
                if (Desktop != IntPtr.Zero)
                {
                    // UIA may retain a hidden window on its STA until process exit; report that honestly.
                    result["restoredOriginalDesktop"] = SetThreadDesktop(OriginalDesktop);
                    result["closedPrivateDesktop"] = CloseDesktop(Desktop);
                    Desktop = IntPtr.Zero;
                }
            }
            catch (Exception error) { result["cleanupError"] = error.ToString(); result["passed"] = false; exit = 1; }
            result["elapsedMs"] = Budget.ElapsedMilliseconds;
            result["processes"] = Processes.Values.ToArray();
            if (Work != null) File.WriteAllText(ProgressResultPath ?? Path.Combine(Work, "result.json"), Json.Serialize(result), new UTF8Encoding(false));
            Console.WriteLine(Json.Serialize(new { passed = result["passed"], exitCode = exit, mode = Plan == null ? "invalid-plan" : Text("mode") }));
        }
        return exit;
    }

    private static void InstallerProgress(Dictionary<string, object> result)
    {
        string[] keys = { "schemaVersion", "mode", "work", "temporary", "captures", "target", "installer", "installerBytes", "installerSha256", "productId", "ownerSid", "profileRoot", "result", "log", "unknownSha256" };
        Require(Plan.Count == keys.Length && keys.All(Plan.ContainsKey) && Convert.ToInt32(Plan["schemaVersion"]) == 1, "Unknown progress plan");
        Require(Text("productId") == "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}", "Only fixture installation progress is permitted");
        Work = Path.GetFullPath(Text("work")); Safe(Work);
        Sid = WindowsIdentity.GetCurrent().User.Value;
        string profile = Path.GetFullPath(Text("profileRoot")); Safe(profile);
        string profileParent = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "TableMaxAcceptance");
        Require(SamePath(Path.GetDirectoryName(profile), profileParent) && System.Text.RegularExpressions.Regex.IsMatch(Path.GetFileName(profile), "^[a-fA-F0-9]{32}$"), "Actual private profile scope required");
        Require(Work.StartsWith(Path.Combine(profile, "work") + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase) && Path.GetFileName(Work).StartsWith("application-handoff-", StringComparison.Ordinal), "Only this handoff work may install");
        using (var user = WindowsIdentity.GetCurrent()) Require(Sid == Text("ownerSid") && System.Text.RegularExpressions.Regex.IsMatch(user.Name.Split('\\').Last(), "^TMVerify_[a-fA-F0-9]{8}$") && !new WindowsPrincipal(user).IsInRole(WindowsBuiltInRole.Administrator), "Owned standard account required");
        foreach (string key in new[] { "captures", "target", "installer", "result", "log" }) Scoped(Text(key));
        Require(SamePath(Text("temporary"), Work), "Progress TEMP must retain the original bounded handoff work path");
        ProgressResultPath = Text("result");
        Require(!File.Exists(ProgressResultPath) && !File.Exists(Text("log")), "Progress outputs must be fresh");
        Require(new FileInfo(Text("installer")).Length == Convert.ToInt64(Plan["installerBytes"]) && Hash(Text("installer")) == Text("installerSha256"), "Actual signed fixture input changed");
        string[] targetEntries = Directory.GetFileSystemEntries(Text("target"));
        Require(targetEntries.Length == 1 && SamePath(targetEntries[0], Path.Combine(Text("target"), "朋友资料.txt")) && File.Exists(targetEntries[0]) && Hash(targetEntries[0]) == Text("unknownSha256"), "Only the known friend file may predate installation");
        Require(((List<object>)Registrations()).Count == 0, "An existing fixture registration must be preserved");
        result["mode"] = "installer-progress"; result["ownerSid"] = Sid; result["failureDomain"] = "actual-fixture-installation-progress";
        string desktopName = "TMVerify_" + Guid.NewGuid().ToString("N");
        OriginalDesktop = GetThreadDesktop(GetCurrentThreadId());
        Desktop = CreateDesktop(desktopName, null, IntPtr.Zero, 0, 0x01FF, IntPtr.Zero);
        Require(Desktop != IntPtr.Zero && SetThreadDesktop(Desktop), "Private progress desktop initialization failed");
        Job = CreateJobObject(IntPtr.Zero, null); Require(Job != IntPtr.Zero, "Progress Job creation failed");
        var limits = new JobExtendedLimits(); limits.Basic.LimitFlags = 0x2000;
        Require(SetInformationJobObject(Job, 9, ref limits, (uint)Marshal.SizeOf(typeof(JobExtendedLimits))), "Progress Job cleanup policy failed");
        var samples = new List<object>(); var seen = new HashSet<string>(); bool marquee = false, counted = false;
        var crossProcess = new List<object>(); var crossProcessSeen = new HashSet<string>();
        var captionFailures = new List<object>();
        IntPtr progressWindow = IntPtr.Zero; int progressPid = 0;
        result["progressSamples"] = samples;
        result["skippedCrossProcessWindows"] = crossProcess;
        result["skippedCaptionSamples"] = captionFailures;
        result["captionDiagnosticLimit"] = 128;
        string arguments = "/SP- /SILENT /SUPPRESSMSGBOXES /NORESTART /TASKS=!desktopicon /DIR=" + ProgressQuote(Text("target")) + " /LOG=" + ProgressQuote(Text("log"));
        using (var installer = StartTracked(Text("installer"), desktopName, arguments))
        {
            int pid = installer.Id; IntPtr held = installer.Handle;
            result["installer"] = new { pid, modulePath = installer.MainModule.FileName, ownerSid = Sid, handleHeld = held != IntPtr.Zero, arguments, bytes = new FileInfo(Text("installer")).Length, sha256 = Hash(Text("installer")), desktop = desktopName, switchedDesktop = false };
            var elapsed = Stopwatch.StartNew();
            while (!installer.HasExited && elapsed.ElapsedMilliseconds < 300000)
            {
                foreach (IntPtr window in progressWindow == IntPtr.Zero ? Windows() : IsWindow(progressWindow) ? new List<IntPtr> { progressWindow } : new List<IntPtr>())
                {
                    List<IntPtr> controls = null;
                    try
                    {
                        if (progressPid != 0) Require(ProcessId(window) == progressPid, "Pinned installer progress HWND changed owner");
                        controls = ProgressChildren(window, ProcessId(window), crossProcess, crossProcessSeen);
                        int samplePid = ProcessId(window);
                        var captions = new Dictionary<IntPtr, string>();
                        foreach (IntPtr control in controls) { string caption; if (TryProgressCaption(control, samplePid, captionFailures, out caption)) captions[control] = caption; }
                        string[] texts = captions.Values.Where(text => text.Length != 0).ToArray();
                        if (!texts.Any(text => text.Contains("请稍候，安装完成后会自动进入下一步。"))) continue;
                        if (progressWindow == IntPtr.Zero)
                        {
                            progressWindow = window; progressPid = ProcessId(window);
                            ProgressOwner = Process.GetProcessById(progressPid); _ = ProgressOwner.Handle;
                            result["progressWindowOwner"] = new { pid = progressPid, modulePath = ProgressOwner.MainModule.FileName, ownerSid = Sid, window = window.ToInt64().ToString("X"), originalInstallerJob = true, originalProcessHandleHeld = true };
                        }
                        foreach (IntPtr bar in controls.Where(handle => Class(handle).IndexOf("Progress", StringComparison.OrdinalIgnoreCase) >= 0))
                        {
                            uint style = unchecked((uint)GetWindowLong(bar, -16));
                            bool rolling = (style & 8) != 0;
                            IntPtr countControl = controls.FirstOrDefault(handle => captions.ContainsKey(handle) && System.Text.RegularExpressions.Regex.IsMatch(captions[handle], @"文件 ([0-9]+) / ([0-9]+)"));
                            string countBefore = "", countAfter = "";
                            if (countControl != IntPtr.Zero && !TryProgressCaption(countControl, samplePid, captionFailures, out countBefore)) continue;
                            int position = checked((int)Send(bar, 0x0408, IntPtr.Zero, IntPtr.Zero).ToInt64());
                            int maximum = checked((int)Send(bar, 0x0407, IntPtr.Zero, IntPtr.Zero).ToInt64());
                            int minimum = checked((int)Send(bar, 0x0407, new IntPtr(1), IntPtr.Zero).ToInt64());
                            if (countControl != IntPtr.Zero && !TryProgressCaption(countControl, samplePid, captionFailures, out countAfter)) continue;
                            var count = System.Text.RegularExpressions.Regex.Match(countBefore, @"文件 ([0-9]+) / ([0-9]+)");
                            int completed = count.Success ? Int32.Parse(count.Groups[1].Value) : 0, total = count.Success ? Int32.Parse(count.Groups[2].Value) : 0;
                            // Locked Inno 6.7.3 NewProgressBar.pas uses a native
                            // 0..65535 range and MulDiv(Position,65535,Max).
                            int expectedPosition = total > 0 ? MulDiv(completed, 65535, total) : 0;
                            int residual = position - expectedPosition;
                            bool stable = count.Success && countBefore == countAfter;
                            bool consistent = !rolling && stable && minimum == 0 && maximum == 65535 && completed > 0 && completed <= total && Math.Abs((long)residual) <= 1;
                            string key = String.Join("|", texts) + "|" + style + "|" + position + "|" + maximum;
                            if (seen.Add(key) && samples.Count < 256) samples.Add(new { observedAtUtc = DateTime.UtcNow.ToString("o"), window = window.ToInt64().ToString("X"), progressHandle = bar.ToInt64().ToString("X"), className = Class(bar), style, marquee = rolling, position, minimum, maximum, texts, fileCompleted = completed, fileTotal = total, countBefore, countAfter, stableFileCountText = stable, expectedNativePosition = expectedPosition, quantizationResidual = residual, fileCountMatched = consistent });
                            if (rolling && !marquee) { Capture(window, "installer-progress-marquee"); marquee = true; }
                            if (consistent && !counted) { Capture(window, "installer-progress-file-count"); counted = true; }
                        }
                    }
                    catch (InvalidOperationException) when (!IsWindow(window) || (controls != null && controls.Any(handle => !IsWindow(handle)))) { }
                }
                Thread.Sleep(10);
            }
            Require(installer.HasExited, "Actual progress installation exceeded five minutes");
            Require(installer.WaitForExit(5000), "Original installer exit was not observed");
            result["installerExit"] = new { pid, exitCode = installer.ExitCode, handleHeld = true, actualProcessExited = installer.HasExited };
            Require(installer.ExitCode == 0, "Actual progress installer returned " + installer.ExitCode);
        }
        var drain = Stopwatch.StartNew(); while (OwnProcesses().Length != 0 && drain.ElapsedMilliseconds < 20000) Thread.Sleep(50);
        Require(OwnProcesses().Length == 0, "Installer Job did not naturally drain");
        result["naturalJobDrain"] = true;
        Require(marquee && counted, "Actual Chinese marquee and matching native file-count progress must both be observed");
        Require(Hash(Path.Combine(Text("target"), "朋友资料.txt")) == Text("unknownSha256"), "Friend file changed");
        Require(Hash(Text("installer")) == Text("installerSha256"), "Installer copy changed");
        Check("actual-fixture-progress-and-install-exit", new { marqueeObserved = marquee, matchingNativeFileCountObserved = counted, switchedDesktop = false, registrationAndSavedDataChecks = "Original handoff scenario continues after this observer" });
    }

    // Progress captions are observational only. A vanished/replaced or temporarily
    // busy HWND loses this sample, never the required eventual progress evidence.
    // Navigation/editing and native progress-value reads retain strict Send/Caption.
    private static bool TryProgressCaption(IntPtr handle, int expectedPid, List<object> failures, out string caption)
    {
        caption = ""; IntPtr length;
        if (!TryProgressCaptionMessage(handle, expectedPid, 0x000E, IntPtr.Zero, IntPtr.Zero, failures, out length)) return false;
        int count = checked((int)length.ToInt64());
        Require(count >= 0 && count < 65536, "Unexpected progress caption length");
        IntPtr buffer = Marshal.AllocHGlobal((count + 1) * 2);
        try
        {
            Marshal.WriteInt16(buffer, 0); IntPtr copied;
            if (!TryProgressCaptionMessage(handle, expectedPid, 0x000D, new IntPtr(count + 1), buffer, failures, out copied)) return false;
            caption = Marshal.PtrToStringUni(buffer) ?? ""; return true;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static bool TryProgressCaptionMessage(IntPtr handle, int expectedPid, uint message, IntPtr wParam, IntPtr lParam, List<object> failures, out IntPtr value)
    {
        Require(message == 0x000E || message == 0x000D, "Only read-only progress caption samples may be skipped");
        value = IntPtr.Zero;
        bool alive = IsWindow(handle); int pid = ProcessId(handle);
        if (alive && pid == expectedPid)
        {
            try
            {
                OwnWindow(handle);
                if (SendMessageTimeout(handle, message, wParam, lParam, 0x0002, 2000, out value) != IntPtr.Zero)
                {
                    if (IsWindow(handle) && ProcessId(handle) == expectedPid) return true;
                    RecordProgressCaptionFailure(failures, handle, expectedPid, message, 0, "HWND disappeared or changed owner during caption read"); return false;
                }
                int error = Marshal.GetLastWin32Error();
                RecordProgressCaptionFailure(failures, handle, expectedPid, message, error, "Read-only caption did not respond within the existing 2000ms budget"); return false;
            }
            catch (InvalidOperationException) when (!IsWindow(handle))
            {
                RecordProgressCaptionFailure(failures, handle, expectedPid, message, 0, "HWND disappeared before caption ownership verification"); return false;
            }
        }
        RecordProgressCaptionFailure(failures, handle, expectedPid, message, 0, "Stale or replaced child HWND; no control message sent"); return false;
    }

    private static void RecordProgressCaptionFailure(List<object> failures, IntPtr handle, int expectedPid, uint message, int error, string reason)
    {
        if (failures.Count < 128) failures.Add(new { observedAtUtc = DateTime.UtcNow.ToString("o"), window = handle.ToInt64().ToString("X"), expectedPid, observedPid = ProcessId(handle), isWindow = IsWindow(handle), message, win32Error = error, reason, sampleSkipped = true, actionInvoked = false });
    }

    private static List<IntPtr> ProgressChildren(IntPtr window, int expectedPid, List<object> skipped, HashSet<string> seen)
    {
        OwnWindow(window); Require(ProcessId(window) == expectedPid, "Progress top-level owner differs");
        var controls = new List<IntPtr>();
        EnumChildWindows(window, (handle, unused) =>
        {
            if (!IsWindowVisible(handle)) return true;
            int pid = ProcessId(handle);
            if (pid != expectedPid)
            {
                string key = handle.ToInt64().ToString("X") + ":" + pid;
                if (seen.Add(key) && skipped.Count < 64)
                {
                    string image = null, error = null;
                    IntPtr peer = OpenProcess(0x1000, false, (uint)pid);
                    try { var path = new StringBuilder(32768); int length = path.Capacity; if (peer != IntPtr.Zero && QueryFullProcessImageName(peer, 0, path, ref length)) image = path.ToString(); else error = "Image query code " + Marshal.GetLastWin32Error(); }
                    finally { if (peer != IntPtr.Zero) CloseHandle(peer); }
                    skipped.Add(new { window = handle.ToInt64().ToString("X"), pid, modulePath = image, queryError = error, inspectedControlMessages = false, reason = "Foreign-process child is outside the pinned Inno control tree" });
                }
                return true;
            }
            OwnWindow(handle); controls.Add(handle); return true;
        }, IntPtr.Zero);
        return controls;
    }

    private static string ProgressQuote(string path) { Require(!path.Contains("\"") && !path.EndsWith("\\", StringComparison.Ordinal), "Unsafe progress path argument"); return "\"" + path + "\""; }

    private static int UpdaterNativeChild(string[] args)
    {
        string root = Environment.GetEnvironmentVariable("TABLEMAX_INSTALL_ROOT"), nonce = Environment.GetEnvironmentVariable("TABLEMAX_ENTRY_NONCE");
        string receipt = Environment.GetEnvironmentVariable("TABLEMAX_ENTRY_RECEIPT"), release = Environment.GetEnvironmentVariable("TABLEMAX_ENTRY_RELEASE");
        Require(!String.IsNullOrEmpty(root) && !String.IsNullOrEmpty(nonce), "Private entry fixture context required");
        root = Path.GetFullPath(root); Safe(root);
        Require(SamePath(AppDomain.CurrentDomain.BaseDirectory, Path.Combine(root, "data", "app")), "Only the private synthetic Native may run");
        Require(SamePath(Path.GetDirectoryName(receipt), root) && SamePath(Path.GetDirectoryName(release), root), "Receipt escaped the synthetic root");
        Require(File.ReadAllText(Path.Combine(root, ".entry-component-nonce"), Encoding.UTF8) == nonce, "Synthetic Native marker mismatch");
        using (var self = Process.GetCurrentProcess())
        {
            string module = self.MainModule.FileName;
            var bytes = new UTF8Encoding(false).GetBytes(Json.Serialize(new { schemaVersion = 1, nonce, arguments = args, processId = self.Id, modulePath = module, moduleSha256 = Hash(module), ownerSid = WindowsIdentity.GetCurrent().User.Value, root, boxRoot = Environment.GetEnvironmentVariable("TABLEMAX_BOX_DIRECTORY"), installationId = Environment.GetEnvironmentVariable("TABLEMAX_INSTALLATION_ID"), scope = "Synthetic argv receipt only; no Native, service, pipe, registry or network implementation." }));
            string pending = receipt + ".writing";
            using (var output = new FileStream(pending, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { output.Write(bytes, 0, bytes.Length); output.Flush(true); }
            File.Move(pending, receipt);
        }
        var budget = Stopwatch.StartNew();
        while (budget.ElapsedMilliseconds < 20000)
        {
            if (File.Exists(release)) { Require(File.ReadAllText(release, Encoding.UTF8) == nonce, "Synthetic Native release mismatch"); return 0; }
            Thread.Sleep(25);
        }
        return 94;
    }

    private static void EntryWindows(Dictionary<string, object> result)
    {
        string[] keys = { "schemaVersion", "mode", "work", "temporary", "captures", "root", "updater", "updaterSha256", "helper", "helperSha256", "native", "nativeSha256", "manifest", "manifestSha256", "receipt", "release", "nonce", "unknown", "unknownSha256" };
        Require(Plan.Count == keys.Length && keys.All(Plan.ContainsKey) && Convert.ToInt32(Plan["schemaVersion"]) == 1, "Unknown entry component plan");
        Work = Path.GetFullPath(Text("work")); Safe(Work);
        Require(Directory.Exists(Work) && Path.GetFileName(Work).StartsWith("installer-wizard-", StringComparison.Ordinal), "Fresh entry work required");
        foreach (string key in new[] { "temporary", "captures", "root", "updater", "helper", "native", "manifest", "receipt", "release", "unknown" }) Scoped(Text(key));
        foreach (string key in new[] { "updater", "helper", "native", "manifest", "unknown" }) Require(Hash(Text(key)) == Text(key + "Sha256"), "Entry component input changed: " + key);
        Require(!File.Exists(Text("receipt")) && !File.Exists(Text("release")), "Entry coordination files must be new");
        var identity = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Text("manifest"), Encoding.UTF8));
        Sid = WindowsIdentity.GetCurrent().User.Value;
        Require(!new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator), "Standard token required");
        Require((string)identity["ownerSid"] == Sid && (string)identity["productId"] == "{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}" && SamePath((string)identity["root"], Text("root")), "Only the owned fixture identity is accepted");
        result["ownerSid"] = Sid; result["mode"] = "updater-entry"; result["failureDomain"] = "entry-component-not-system-installation";
        string desktopName = "TMVerify_" + Guid.NewGuid().ToString("N");
        OriginalDesktop = GetThreadDesktop(GetCurrentThreadId());
        Desktop = CreateDesktop(desktopName, null, IntPtr.Zero, 0, 0x01FF, IntPtr.Zero);
        Require(Desktop != IntPtr.Zero && SetThreadDesktop(Desktop), "Private entry desktop initialization failed");
        Job = CreateJobObject(IntPtr.Zero, null); Require(Job != IntPtr.Zero, "Own entry Job failed");
        var limits = new JobExtendedLimits(); limits.Basic.LimitFlags = 0x2000;
        Require(SetInformationJobObject(Job, 9, ref limits, (uint)Marshal.SizeOf(typeof(JobExtendedLimits))), "Own entry Job cleanup policy failed");
        string operationKey;
        using (var sha = SHA256.Create()) operationKey = BitConverter.ToString(sha.ComputeHash(new UTF8Encoding(false).GetBytes(Path.GetFullPath(Text("root")).TrimEnd('\\', '/').ToLowerInvariant()))).Replace("-", "").ToLowerInvariant();
        using (var operation = new Mutex(false, "Global\\TableMax-Installation-Operation-" + operationKey))
        {
            Require(operation.WaitOne(0), "Own fixture operation mutex is unexpectedly busy");
            bool held = true;
            try
            {
                using (var updater = StartTracked(Text("updater"), desktopName))
                {
                    IntPtr feedback = Wait(() => Windows().FirstOrDefault(handle => ProcessId(handle) == updater.Id && Caption(handle) == "TableMax"), "First real Updater feedback", 10000);
                    LastWindow = feedback;
                    string[] texts = Children(feedback).Select(Caption).Where(value => value.Length != 0).ToArray();
                    Require(texts.Any(value => value.Contains("正在打开程序更新") && value.Contains("已有 TableMax 窗口将直接显示更新面板")), "First Updater feedback is not the expected Chinese text");
                    Require(!File.Exists(Text("receipt")), "Native started before initial feedback and mutex release");
                    Require(OwnProcesses().SequenceEqual(new[] { updater.Id }), "Another Native started before operation release");
                    Capture(feedback, "updater-first-chinese-feedback");
                    Check("updater-first-chinese-feedback-before-native", new { processId = updater.Id, modulePath = Text("updater"), sha256 = Hash(Text("updater")), texts, nativeReceiptPresent = false, operationHeld = true, capturedBeforeRelease = true });
                    operation.ReleaseMutex(); held = false;
                    Wait(() => File.Exists(Text("receipt")), "Synthetic Native argv receipt", 10000);
                    var receipt = Json.Deserialize<Dictionary<string, object>>(File.ReadAllText(Text("receipt"), Encoding.UTF8));
                    Require((string)receipt["nonce"] == Text("nonce") && (string)receipt["ownerSid"] == Sid && SamePath((string)receipt["modulePath"], Text("native")) && (string)receipt["moduleSha256"] == Text("nativeSha256"), "Synthetic Native receipt identity mismatch");
                    var arguments = ((System.Collections.IEnumerable)receipt["arguments"]).Cast<object>().Select(value => (string)value).ToArray();
                    Require(arguments.SequenceEqual(new[] { "--check-updates" }), "Updater must forward exactly one check-updates argument");
                    Require(SamePath((string)receipt["boxRoot"], Path.Combine(Text("root"), "data")) && (string)receipt["installationId"] == (string)identity["installationId"], "Installed launch context mismatch");
                    int nativePid = Convert.ToInt32(receipt["processId"]); OwnProcess(nativePid);
                    using (var native = Process.GetProcessById(nativePid))
                    {
                        _ = native.Handle;
                        Require(SamePath(native.MainModule.FileName, Text("native")), "Actual synthetic Native module differs");
                        Require(updater.WaitForExit(5000) && updater.ExitCode == 0, "Updater did not exit normally after handoff");
                        Require(!File.Exists(Text("release")), "Synthetic Native release already exists");
                        string pending = Text("release") + ".writing";
                        using (var output = new FileStream(pending, FileMode.CreateNew, FileAccess.Write, FileShare.None)) { var bytes = new UTF8Encoding(false).GetBytes(Text("nonce")); output.Write(bytes, 0, bytes.Length); output.Flush(true); }
                        File.Move(pending, Text("release"));
                        Require(native.WaitForExit(5000) && native.ExitCode == 0, "Synthetic Native did not exit normally");
                        Check("updater-managed-native-argv-and-exits", new { updaterPid = updater.Id, updaterExitCode = updater.ExitCode, nativePid, nativeExitCode = native.ExitCode, receipt, existingNativeIpcProved = false });
                    }
                }
            }
            finally { if (held) operation.ReleaseMutex(); }
        }
        Wait(() => OwnProcesses().Length == 0, "Own Updater and synthetic Native exit", 5000);
        using (var helper = StartTracked(Text("helper"), desktopName))
        {
            IntPtr dialog = Wait(() => Windows().FirstOrDefault(handle => ProcessId(handle) == helper.Id && Caption(handle) == "TableMax 程序更新"), "Real no-argument helper Chinese guidance", 10000);
            LastWindow = dialog;
            string[] texts = Children(dialog).Select(Caption).Where(value => value.Length != 0).ToArray();
            Require(texts.Any(value => value.Contains("内部安装与卸载协调程序") && value.Contains("Updater.exe") && value.Contains("存档和配置不会因此改变")), "Helper guidance text missing");
            IntPtr ok = Wait(() =>
            {
                var controls = Children(dialog);
                result["helperConfirmationControls"] = new { observedAtUtc = DateTime.UtcNow.ToString("o"), dialogHandle = dialog.ToInt64().ToString("X"), processId = Owner(dialog), controls = controls.Select(handle => new { controlId = GetDlgCtrlID(handle), className = Class(handle), caption = Caption(handle), enabled = IsWindowEnabled(handle) }).ToArray() };
                // MessageBoxW's documented return value is distinct from the
                // concrete child HWND ID. This Windows MB_OK dialog exposes
                // its sole Chinese confirmation as control 2; keep both the
                // observed ID and exact caption, class, ownership and count.
                var matches = controls.Where(handle => (GetDlgCtrlID(handle) == 1 || GetDlgCtrlID(handle) == 2) && Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && Caption(handle).Replace("&", "").Trim() == "确定" && IsWindowEnabled(handle)).ToArray();
                Require(matches.Length <= 1, "Ambiguous own Chinese helper confirmation buttons");
                return matches.SingleOrDefault();
            }, "Unique own enabled Chinese helper confirmation button (ID 1 or 2)", 5000);
            string buttonText = Caption(ok), buttonClass = Class(ok); int buttonId = GetDlgCtrlID(ok);
            Capture(dialog, "helper-no-argument-chinese-guidance");
            Require(PostMessage(ok, 0x00F5, IntPtr.Zero, IntPtr.Zero), "Own helper confirmation click failed");
            Require(helper.WaitForExit(5000) && helper.ExitCode == 0, "Helper guidance did not exit normally");
            Check("helper-no-argument-chinese-guidance-and-exit", new { processId = helper.Id, modulePath = Text("helper"), sha256 = Hash(Text("helper")), texts, buttonId, buttonClass, buttonText, exitCode = helper.ExitCode, uninstallInvoked = false });
        }
        Wait(() => OwnProcesses().Length == 0, "Own entry process exit", 5000);
        foreach (string input in new[] { "updater", "helper", "native", "manifest", "unknown" }) Require(Hash(Text(input)) == Text(input + "Sha256"), "Entry source or unknown file changed: " + input);
        Check("entry-inputs-and-unknown-preserved", new { unknownPath = Text("unknown"), sha256 = Text("unknownSha256"), manifestPath = Text("manifest"), manifestSha256 = Text("manifestSha256"), registrationInvoked = false, serviceStarted = false });
    }

    private static Process StartTracked(string executable, string desktopName, string arguments = "")
    {
        var startup = new StartupInfo { Size = (uint)Marshal.SizeOf(typeof(StartupInfo)), Desktop = desktopName };
        ProcessInformation process;
        Require(CreateProcess(executable, new StringBuilder(ProgressQuote(executable) + (arguments.Length == 0 ? "" : " " + arguments)), IntPtr.Zero, IntPtr.Zero, false, 0x00000004, IntPtr.Zero, Work, ref startup, out process), "Own entry CreateProcess failed: " + Marshal.GetLastWin32Error());
        bool assigned = false; Process tracked = null;
        try
        {
            Require(AssignProcessToJobObject(Job, process.Process), "Own entry Job assignment failed"); assigned = true;
            OwnProcess((int)process.ProcessId); tracked = Process.GetProcessById((int)process.ProcessId); _ = tracked.Handle;
            var image = new StringBuilder(32768); int length = image.Capacity;
            Require(QueryFullProcessImageName(tracked.Handle, 0, image, ref length) && SamePath(image.ToString(), executable), "Own entry image path differs");
            Require(ResumeThread(process.Thread) != 0xFFFFFFFF, "Own entry process resume failed");
            return tracked;
        }
        catch { tracked?.Dispose(); if (!assigned) TerminateProcess(process.Process, 92); throw; }
        finally { CloseHandle(process.Thread); CloseHandle(process.Process); }
    }

    private static void Wizard()
    {
        IntPtr window = WaitWindow("installer wizard");
        LastWindow = window;
        string expectedDefault = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(Text("installer")), "TableMax"));
        if (Text("mode") == "original-installer") Safe(expectedDefault); else Scoped(expectedDefault);
        IntPtr edit = IntPtr.Zero;
        for (int attempt = 0; attempt < 3 && edit == IntPtr.Zero; attempt++)
        {
            edit = Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0 && SamePath(Caption(handle), expectedDefault));
            if (edit == IntPtr.Zero)
            {
                Click(window, "next");
                Thread.Sleep(200);
                window = WaitWindow("directory page");
            }
        }
        Require(edit != IntPtr.Zero, "Initial directory edit must equal the actual installer parent plus TableMax");
        Require(Children(window).Any(handle => Caption(handle) == Notice), "Exact Chinese C-drive notice missing");
        string initial = Caption(edit);
        Check("actual-initial-directory-and-exact-notice", new { directory = initial, expected = expectedDefault, sourceDirectory = Path.GetDirectoryName(Text("installer")), notice = Notice, processId = Owner(window) });
        Capture(window, "directory-initial");
        SendText(edit, Text("target"));
        Require(SamePath(Caption(edit), Text("target")), "Directory edit must retain the exact final target without appending TableMax");
        Capture(window, "directory-changed");
        Click(window, "next");
        TaskControl task = Wait(() => FindTask(window), "Accessible desktop shortcut task", 10000);
        IntPtr migration = Wait(() => FindMigrationCheck(window), "Visible Chinese migration option", 5000);
        Require(!MigrationState(migration), "Version migration must initially be unchecked");
        bool initialTask = TaskState(task);
        SetTask(task, false);
        SetTask(task, true);
        Capture(window, "desktop-task-on");
        SetTask(task, false);
        Capture(window, "desktop-task-off");
        Check("desktop-task-on-off", new { initial = initialTask, transitions = new[] { "off", "on", "off" }, checkedObserved = true, uncheckedObserved = true });
        Click(window, "next");
        WaitReady(window);
        Check("migration-default-unchecked-and-skip", new { selected = false, readyObserved = true, migrationPageObserved = false, installInvoked = false });
        Capture(window, "ready-migration-unselected");
        Click(window, "back");
        migration = Wait(() => FindMigrationCheck(window), "Migration option after Back", 5000);
        Require(!MigrationState(migration), "Back must retain the unchecked migration option");
        SetMigration(migration, true);
        Click(window, "next");
        IntPtr migrationEdit = WaitMigrationEdit(window);
        string automaticValue = Caption(migrationEdit);
        if (Text("migrationSourceState") == "present") Require(SamePath(automaticValue, expectedDefault), "Existing src/TableMax must prefill the migration directory");
        else Require(automaticValue == "", "Absent src/TableMax must leave migration directory empty");
        Check("migration-auto-source-" + Text("migrationSourceState"), new { sourceExists = Text("migrationSourceState") == "present", value = automaticValue, expected = Text("migrationSourceState") == "present" ? expectedDefault : "", selected = true });
        Capture(window, "migration-automatic-" + Text("migrationSourceState"));
        SendText(migrationEdit, Text("migrationSource"));
        Require(SamePath(Caption(migrationEdit), Text("migrationSource")), "Manual migration path must be retained");
        Click(window, "back");
        migration = Wait(() => FindMigrationCheck(window), "Migration option before deselection", 5000);
        Require(MigrationState(migration), "Migration selection disappeared after Back");
        SetMigration(migration, false);
        Click(window, "next");
        WaitReady(window);
        Capture(window, "ready-migration-deselected");
        Click(window, "back");
        migration = Wait(() => FindMigrationCheck(window), "Migration option before reselection", 5000);
        Require(!MigrationState(migration), "Deselected migration must stay deselected");
        SetMigration(migration, true);
        Click(window, "next");
        migrationEdit = WaitMigrationEdit(window);
        Require(SamePath(Caption(migrationEdit), Text("migrationSource")), "Toggling migration must preserve the manually entered directory");
        Check("migration-manual-source-preserved-and-controlled", new { selected = true, manualSource = Caption(migrationEdit), unselectedSkipped = true, reselectedRetainedManual = true, commitInvoked = false });
        Capture(window, "migration-manual-retained");
        Click(window, "next");
        WaitReady(window);
        Check("ready-observed-without-install-invocation", new { installButtonObserved = true, installInvoked = false });
        Capture(window, "ready-no-install");
        Click(window, "back");
        for (int page = 0; page < 3 && FindTask(window) == null; page++) { Click(window, "back"); Thread.Sleep(200); }
        task = Wait(() => FindTask(window), "Tasks after Back", 5000);
        Require(!TaskState(task), "Desktop task changed after Back");
        Click(window, "back");
        Wait(() => Children(window).Any(handle => Caption(handle) == Notice), "Directory after Back", 5000);
        edit = Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0 && SamePath(Caption(handle), Text("target")));
        Require(edit != IntPtr.Zero, "Target did not persist after Back");
        Check("back-retains-target-and-shortcut-choice", new { target = Caption(edit), desktopTask = false, notice = Notice });
        Capture(window, "back-directory");
        Click(window, "cancel");
        bool confirmationObserved = false;
        var end = Stopwatch.StartNew();
        while (OwnProcesses().Length != 0 && end.ElapsedMilliseconds < 10000)
        {
            foreach (IntPtr dialog in Windows().Where(handle => Class(handle) == "#32770"))
            {
                IntPtr yes = Children(dialog).FirstOrDefault(handle => Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && GetDlgCtrlID(handle) == 6);
                if (yes != IntPtr.Zero)
                {
                    string[] message = Children(dialog).Where(handle => Class(handle).IndexOf("Static", StringComparison.OrdinalIgnoreCase) >= 0).Select(Caption).ToArray();
                    Require(Caption(dialog) == "退出安装程序", "Cancel confirmation title must be Simplified Chinese");
                    Require(message.Any(value => value.Contains("安装程序尚未完成。") && value.Contains("现在退出安装程序吗？")), "Expected full Simplified Chinese cancel confirmation text missing");
                    IntPtr no = Children(dialog).FirstOrDefault(handle => Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && GetDlgCtrlID(handle) == 7);
                    Require(Caption(yes).Replace("&", "").StartsWith("是", StringComparison.Ordinal) && no != IntPtr.Zero && Caption(no).Replace("&", "").StartsWith("否", StringComparison.Ordinal), "Cancel confirmation buttons must be Simplified Chinese");
                    int processId = Owner(dialog);
                    Capture(dialog, "cancel-confirmation");
                    ClickHandle(yes, "cancel-confirm-yes");
                    confirmationObserved = true;
                    Check("owned-cancel-confirmation", new { processId, buttonId = 6, message, title = "退出安装程序", language = "zh-CN", confirmed = true });
                }
            }
            Thread.Sleep(100);
        }
        Require(confirmationObserved, "The actual Chinese exit confirmation must be observed before accepting cancellation");
    }

    private static IntPtr FindMigrationCheck(IntPtr window)
    {
        return Children(window).FirstOrDefault(handle => Caption(handle) == MigrationTask && (Class(handle).IndexOf("CheckBox", StringComparison.OrdinalIgnoreCase) >= 0 || Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0));
    }

    private static bool MigrationState(IntPtr checkbox)
    {
        OwnWindow(checkbox);
        Require(Caption(checkbox) == MigrationTask, "Only the exact migration checkbox may be read");
        long state = Send(checkbox, 0x00F0, IntPtr.Zero, IntPtr.Zero).ToInt64(); // BM_GETCHECK
        Require(state == 0 || state == 1, "Migration checkbox state must be determinate");
        return state == 1;
    }

    private static void SetMigration(IntPtr checkbox, bool expected)
    {
        Require(IsWindowEnabled(checkbox), "The exact migration checkbox must be enabled");
        if (MigrationState(checkbox) != expected) Send(checkbox, 0x00F5, IntPtr.Zero, IntPtr.Zero); // Own HWND BM_CLICK only
        Wait(() => MigrationState(checkbox) == expected, "Migration checked state", 5000);
    }

    private static IntPtr WaitMigrationEdit(IntPtr window)
    {
        return Wait(() => Children(window).Any(handle => Caption(handle) == "继续使用旧版本数据") ? Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0) : IntPtr.Zero, "Selected migration page", 5000);
    }

    private static void WaitReady(IntPtr window)
    {
        Wait(() => FindButton(window, "install") != IntPtr.Zero && Children(window).Any(handle => Caption(handle).Contains("已准备在所选位置安装完整 TableMax")), "Chinese Ready page without invoking Install", 5000);
        Require(FindMigrationCheck(window) == IntPtr.Zero, "Migration option must not be exposed on Ready");
        Require(Children(window).Where(handle => Class(handle).IndexOf("Memo", StringComparison.OrdinalIgnoreCase) >= 0).Any(handle => Caption(handle).IndexOf(Text("target"), StringComparison.OrdinalIgnoreCase) >= 0 && Caption(handle).IndexOf(Path.Combine(Text("target"), "TableMax"), StringComparison.OrdinalIgnoreCase) < 0), "Ready must retain the exact chosen final root without adding a product directory");
    }

    private static void Probe()
    {
        IntPtr window = WaitWindow("private-desktop API probe");
        LastWindow = window;
        Require(Caption(window) == "TableMax wizard API probe", "Wrong probe window");
        IntPtr edit = Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0);
        Require(edit != IntPtr.Zero, "Probe edit missing");
        SendText(edit, Text("target"));
        Require(Caption(edit) == Text("target"), "Private desktop edit read/write failed");
        IntPtr observed = Children(window).FirstOrDefault(handle => Caption(handle) == "caption observation probe");
        Require(observed != IntPtr.Zero, "Caption observation probe missing");
        var skipped = new List<object>(); string sampled; int owner = Owner(window);
        Require(TryProgressCaption(observed, owner, skipped, out sampled) && sampled == "caption observation probe" && skipped.Count == 0, "Readable own caption sample failed");
        Send(observed, 0x8001, IntPtr.Zero, IntPtr.Zero);
        Require(!TryProgressCaption(observed, owner, skipped, out sampled) && skipped.Count == 1, "Busy own caption must lose only its observational sample");
        Require(Caption(observed) == "caption observation probe", "Strict caption must remain usable after the one-shot probe delay");
        Send(observed, 0x8002, IntPtr.Zero, IntPtr.Zero);
        Require(!IsWindow(observed) && !TryProgressCaption(observed, owner, skipped, out sampled) && skipped.Count == 2, "Destroyed own caption must be skipped without a control message");
        Check("api-probe-caption-sampling-busy-and-destroyed", new { actualOwnControls = true, installerProof = false, skippedCaptionSamples = skipped });
        TaskControl task = Wait(() => FindTask(window), "Probe accessible checkbox", 5000);
        SetTask(task, true);
        SetTask(task, false);
        Capture(window, "api-probe-actual-window");
        Check("api-probe-private-desktop-control-and-capture", new { actualWindow = true, installerProof = false, processId = Owner(window) });
        Click(window, "cancel");
    }

    private static int ProbeChild()
    {
        Exception failure = null;
        var thread = new Thread(() => { try { ProbeForm(); } catch (Exception error) { failure = error; } });
        thread.SetApartmentState(ApartmentState.STA);
        thread.Start();
        thread.Join();
        if (failure != null) throw failure;
        return 0;
    }

    private static void ProbeForm()
    {
        Application.EnableVisualStyles();
        using (var form = new Form { Text = "TableMax wizard API probe", Width = 720, Height = 440, StartPosition = FormStartPosition.CenterScreen, Font = new Font("Microsoft YaHei UI", 12) })
        {
            form.Controls.Add(new Label { Text = Notice, AutoSize = true, Left = 24, Top = 32 });
            form.Controls.Add(new TextBox { Text = "probe", Left = 24, Top = 90, Width = 620 });
            form.Controls.Add(new CheckBox { Text = DesktopTask, AccessibleName = DesktopTask, Left = 24, Top = 150, Width = 420 });
            form.Controls.Add(new CaptionProbeLabel { Text = "caption observation probe", Left = 24, Top = 210, Width = 500, Height = 32 });
            var cancel = new Button { Text = "取消", Left = 550, Top = 300, Width = 110 };
            cancel.Click += (sender, e) => form.Close();
            form.Controls.Add(cancel);
            Application.Run(form);
        }
    }

    private sealed class CaptionProbeLabel : Label
    {
        private bool pauseNextRead;
        protected override void WndProc(ref Message message)
        {
            if (message.Msg == 0x8001) { pauseNextRead = true; message.Result = new IntPtr(1); return; }
            if (message.Msg == 0x8002) { Dispose(); message.Result = new IntPtr(1); return; }
            if (message.Msg == 0x000E && pauseNextRead) { pauseNextRead = false; Thread.Sleep(2300); }
            base.WndProc(ref message);
        }
    }

    private sealed class TaskControl
    {
        public AutomationElement Element;
        public IAccessible Accessible;
        public object Child;
        public IntPtr Window;
    }

    private static TaskControl FindTask(IntPtr window)
    {
        OwnWindow(window);
        // Inno 6.7.3 exposes real checked children through its MSAA provider.
        // Its accDoDefaultAction is deliberately unsupported; do not trust a proxy Toggle.
        foreach (IntPtr handle in Children(window).Where(child => Class(child).IndexOf("NewCheckListBox", StringComparison.OrdinalIgnoreCase) >= 0))
        {
            Guid iid = new Guid("618736e0-3c3d-11cf-810c-00aa00389b71");
            object accessible;
            if (AccessibleObjectFromWindow(handle, 0xFFFFFFFC, ref iid, out accessible) != 0) continue;
            var match = AccessibleTask(accessible as IAccessible, handle, 0);
            if (match != null) return match;
        }
        var root = AutomationElement.FromHandle(window);
        var items = root.FindAll(TreeScope.Descendants, new PropertyCondition(AutomationElement.NameProperty, DesktopTask));
        foreach (AutomationElement item in items)
        {
            Require(OwnProcesses().Contains(item.Current.ProcessId), "Accessible element belongs to another process");
            object pattern;
            if (item.TryGetCurrentPattern(TogglePattern.Pattern, out pattern)) return new TaskControl { Element = item, Window = window };
        }
        return null;
    }

    private static TaskControl AccessibleTask(IAccessible accessible, IntPtr window, int depth)
    {
        if (accessible == null || depth > 8) return null;
        try
        {
            if (accessible.get_accName(0) == DesktopTask && Convert.ToInt32(accessible.get_accRole(0)) == 44)
                return new TaskControl { Accessible = accessible, Child = 0, Window = window };
            int count = accessible.accChildCount;
            Require(count >= 0 && count <= 512, "Unexpected accessible child count");
            if (count == 0) return null;
            var children = new object[count];
            int obtained;
            if (AccessibleChildren(accessible, 0, count, children, out obtained) != 0) return null;
            for (int i = 0; i < obtained; i++)
            {
                var child = children[i] as IAccessible;
                if (child != null)
                {
                    var match = AccessibleTask(child, window, depth + 1);
                    if (match != null) return match;
                }
                else if (children[i] is int && accessible.get_accName(children[i]) == DesktopTask && Convert.ToInt32(accessible.get_accRole(children[i])) == 44)
                    return new TaskControl { Accessible = accessible, Child = children[i], Window = window };
            }
        }
        catch (COMException) { return null; }
        return null;
    }

    private static bool TaskState(TaskControl item)
    {
        OwnWindow(item.Window);
        object pattern;
        if (item.Element != null)
        {
            Require(OwnProcesses().Contains(item.Element.Current.ProcessId), "Foreign accessible task");
            Require(item.Element.TryGetCurrentPattern(TogglePattern.Pattern, out pattern), "Task TogglePattern vanished");
            var state = ((TogglePattern)pattern).Current.ToggleState;
            Require(state != ToggleState.Indeterminate, "Indeterminate desktop task");
            return state == ToggleState.On;
        }
        Require(item.Accessible != null, "Desktop task has no observable check state");
        int flags = Convert.ToInt32(item.Accessible.get_accState(item.Child));
        Require((flags & 0x1) == 0, "Accessible task is unavailable");
        Require((flags & 0x20) == 0, "Accessible task has mixed check state");
        return (flags & 0x10) != 0; // STATE_SYSTEM_CHECKED
    }

    private static void SetTask(TaskControl item, bool expected)
    {
        for (int attempt = 0; attempt < 2 && TaskState(item) != expected; attempt++)
        {
            object pattern;
            OwnWindow(item.Window);
            if (item.Element != null)
            {
                // UIA's legacy checkbox proxy can call global SendInput; use only its read pattern.
                Require(item.Element.TryGetCurrentPattern(TogglePattern.Pattern, out pattern), "Task state unavailable");
                IntPtr handle = new IntPtr(item.Element.Current.NativeWindowHandle);
                OwnWindow(handle);
                Require(Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && Caption(handle) == DesktopTask, "Exact own checkbox HWND required");
                Send(handle, 0x00F5, IntPtr.Zero, IntPtr.Zero);
            }
            else
            {
                Require(Class(item.Window).IndexOf("NewCheckListBox", StringComparison.OrdinalIgnoreCase) >= 0, "Only the own Inno checklist can receive task key messages");
                Require(item.Child is int && (int)item.Child > 0, "Exact Inno checklist child required");
                item.Accessible.accSelect(0x1 | 0x2, item.Child); // TAKEFOCUS | TAKESELECTION
                Send(item.Window, 0x0100, new IntPtr(0x20), IntPtr.Zero); // WM_KEYDOWN / VK_SPACE
                Send(item.Window, 0x0101, new IntPtr(0x20), IntPtr.Zero); // WM_KEYUP
            }
            Thread.Sleep(100);
        }
        Require(TaskState(item) == expected, "Task checked state did not change");
    }

    private static IntPtr WaitWindow(string label)
    {
        return Wait(() => Windows().FirstOrDefault(handle => Children(handle).Any(child => FindButtonCaption(Caption(child), "cancel"))), label, 15000);
    }

    private static List<IntPtr> Windows()
    {
        var windows = new List<IntPtr>();
        SetLastError(0);
        bool enumerated = EnumDesktopWindows(Desktop, (handle, unused) => { if (IsWindowVisible(handle) && OwnProcesses().Contains(ProcessId(handle))) { OwnWindow(handle); windows.Add(handle); } return true; }, IntPtr.Zero);
        int error = Marshal.GetLastWin32Error();
        // A fresh desktop can have no top-level windows before the child starts its UI.
        // That empty result is only retried within WaitWindow's budget, never accepted as proof.
        Require(enumerated || (windows.Count == 0 && error == 0), "EnumDesktopWindows failed: " + error);
        return windows;
    }

    private static List<IntPtr> Children(IntPtr window)
    {
        OwnWindow(window);
        var controls = new List<IntPtr>();
        EnumChildWindows(window, (handle, unused) => { if (IsWindowVisible(handle)) { OwnWindow(handle); controls.Add(handle); } return true; }, IntPtr.Zero);
        return controls;
    }

    private static IntPtr FindButton(IntPtr window, string role)
    {
        return Children(window).FirstOrDefault(handle => Class(handle).IndexOf("Button", StringComparison.OrdinalIgnoreCase) >= 0 && FindButtonCaption(Caption(handle), role));
    }

    private static bool FindButtonCaption(string text, string role)
    {
        string normalized = text.Replace("&", "").Replace("(", "").Replace(")", "").Replace("<", "").Replace(">", "").Trim();
        if (role == "next") return normalized.StartsWith("下一步", StringComparison.Ordinal);
        if (role == "back") return normalized.StartsWith("上一步", StringComparison.Ordinal);
        if (role == "cancel") return normalized == "取消";
        if (role == "install") return normalized.StartsWith("安装", StringComparison.Ordinal);
        return false;
    }

    private static void Click(IntPtr window, string role)
    {
        Require(role == "next" || role == "back" || role == "cancel", "Install/Finish invocation is prohibited");
        IntPtr button = Wait(() => FindButton(window, role), "Owned " + role + " button", 5000);
        Require(IsWindowEnabled(button), "Navigation button disabled");
        Require(!FindButtonCaption(Caption(button), "install"), "Install button must never be invoked");
        ClickHandle(button, role);
    }

    private static void ClickHandle(IntPtr button, string role)
    {
        OwnWindow(button);
        Require(role == "next" || role == "back" || role == "cancel" || (role == "cancel-confirm-yes" && GetDlgCtrlID(button) == 6), "Unsupported UI action");
        Require(!FindButtonCaption(Caption(button), "install"), "Install caption rejected");
        if (role == "cancel" || role == "cancel-confirm-yes")
            Require(PostMessage(button, 0x00F5, IntPtr.Zero, IntPtr.Zero), "Own asynchronous Cancel click failed");
        else Send(button, 0x00F5, IntPtr.Zero, IntPtr.Zero); // BM_CLICK, targeted HWND only
    }

    private static void SendText(IntPtr edit, string value)
    {
        OwnWindow(edit);
        Require(Class(edit).IndexOf("Edit", StringComparison.OrdinalIgnoreCase) >= 0, "Only a directory edit may be written");
        IntPtr pointer = Marshal.StringToHGlobalUni(value);
        try { Send(edit, 0x000C, IntPtr.Zero, pointer); } finally { Marshal.FreeHGlobal(pointer); }
    }

    private static string Caption(IntPtr handle)
    {
        OwnWindow(handle);
        IntPtr length = Send(handle, 0x000E, IntPtr.Zero, IntPtr.Zero);
        int count = checked((int)length.ToInt64());
        Require(count >= 0 && count < 65536, "Unexpected control text length");
        IntPtr buffer = Marshal.AllocHGlobal((count + 1) * 2);
        try { Send(handle, 0x000D, new IntPtr(count + 1), buffer); return Marshal.PtrToStringUni(buffer) ?? ""; }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static string Class(IntPtr handle)
    {
        OwnWindow(handle);
        var value = new StringBuilder(256);
        Require(GetClassName(handle, value, value.Capacity) != 0, "Class lookup failed");
        return value.ToString();
    }

    private static IntPtr Send(IntPtr handle, uint message, IntPtr wParam, IntPtr lParam)
    {
        OwnWindow(handle);
        IntPtr result;
        Require(SendMessageTimeout(handle, message, wParam, lParam, 0x0002, 2000, out result) != IntPtr.Zero, "Owned control did not respond: " + message);
        return result;
    }

    private static void Capture(IntPtr window, string page, bool failure = false)
    {
        OwnWindow(window);
        LastWindow = window;
        Require(SetThreadDpiAwarenessContext(new IntPtr(-4)) != IntPtr.Zero, "Harness capture thread DPI context failed");
        Rect rect;
        Require(GetWindowRect(window, out rect), "Window bounds unavailable");
        int width = rect.Right - rect.Left, height = rect.Bottom - rect.Top;
        Require(width >= 100 && height >= 80 && width <= 8192 && height <= 8192, "Unexpected capture size");
        string path = Scoped(Path.Combine(Text("captures"), (Captures.Count + 1).ToString("D2") + "-" + page + ".png"));
        using (var image = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        using (var graphics = Graphics.FromImage(image))
        {
            IntPtr dc = graphics.GetHdc();
            bool rendered;
            try { rendered = PrintWindow(window, dc, 2); }
            finally { graphics.ReleaseHdc(dc); }
            Require(rendered, "Actual-window PrintWindow failed");
            var colors = new HashSet<int>();
            for (int y = 0; y < height; y += Math.Max(1, height / 80))
                for (int x = 0; x < width; x += Math.Max(1, width / 80)) colors.Add(image.GetPixel(x, y).ToArgb());
            Require(colors.Count >= 8, "Blank private-desktop capture rejected");
            image.Save(path, ImageFormat.Png);
            Captures.Add(new { path, page, failure, processId = Owner(window), windowHandle = window.ToInt64().ToString("X"), width, height, dpi = GetDpiForWindow(window), windowRect = new { left = rect.Left, top = rect.Top, right = rect.Right, bottom = rect.Bottom }, captureDpiContext = "PER_MONITOR_AWARE_V2", sampledColors = colors.Count, method = "PrintWindow actual HWND" });
        }
    }

    private static void Start(string executable, string arguments, string desktopName)
    {
        var startup = new StartupInfo { Size = (uint)Marshal.SizeOf(typeof(StartupInfo)), Desktop = desktopName };
        ProcessInformation process;
        Require(CreateProcess(executable, new StringBuilder("\"" + executable + "\" " + arguments), IntPtr.Zero, IntPtr.Zero, false, 0x00000004, IntPtr.Zero, Work, ref startup, out process), "Own CreateProcess failed: " + Marshal.GetLastWin32Error());
        bool assigned = false;
        try
        {
            Require(AssignProcessToJobObject(Job, process.Process), "Own process Job assignment failed: " + Marshal.GetLastWin32Error());
            assigned = true;
            OwnProcess((int)process.ProcessId);
            if (Text("mode") == "original-installer" && SamePath(executable, Text("installer"))) {
                OriginalLaunchProcess = Process.GetProcessById((int)process.ProcessId);
                Require(OriginalLaunchProcess.Handle != IntPtr.Zero, "Original process handle unavailable");
            }
            Require(ResumeThread(process.Thread) != 0xFFFFFFFF, "Own process resume failed");
            Check("own-process-private-desktop-job", new { processId = process.ProcessId, desktop = desktopName, switchedDesktop = false, sid = Sid, executable });
        }
        finally
        {
            if (!assigned) TerminateProcess(process.Process, 92);
            CloseHandle(process.Thread);
            CloseHandle(process.Process);
        }
    }

    private static int[] OwnProcesses()
    {
        if (Job == IntPtr.Zero) return new int[0];
        int length = 8 + IntPtr.Size * 128;
        IntPtr buffer = Marshal.AllocHGlobal(length);
        try
        {
            uint returned;
            Require(QueryInformationJobObject(Job, 3, buffer, (uint)length, out returned), "Own Job process query failed");
            int count = Marshal.ReadInt32(buffer, 4);
            Require(count >= 0 && count <= 128, "Unexpected own process count");
            var ids = new int[count];
            for (int i = 0; i < count; i++) ids[i] = checked((int)Marshal.ReadIntPtr(buffer, 8 + i * IntPtr.Size).ToInt64());
            return ids;
        }
        finally { Marshal.FreeHGlobal(buffer); }
    }

    private static void OwnProcess(int id)
    {
        Require(OwnProcesses().Contains(id), "Process is outside the own Job");
        IntPtr process = OpenProcess(0x1000, false, (uint)id);
        Require(process != IntPtr.Zero, "Own process cannot be identified");
        IntPtr token = IntPtr.Zero;
        try
        {
            var path = new StringBuilder(32768);
            int length = path.Capacity;
            Require(QueryFullProcessImageName(process, 0, path, ref length), "Own image path unavailable");
            if (Text("mode") == "original-installer" && SamePath(path.ToString(), Text("installer"))) Safe(path.ToString());
            else Scoped(path.ToString());
            Require(OpenProcessToken(process, 0x0008, out token), "Own process SID unavailable");
            using (var identity = new WindowsIdentity(token)) Require(identity.User.Value == Sid, "Process SID differs from test owner");
            if (Text("mode") == "original-installer") {
                string integrity = TokenIntegrity(token);
                bool elevated = TokenElevated(token);
                Require(integrity == "S-1-16-8192" && !elevated, "Original launch requires actual Medium non-elevated processes");
                Processes[id] = new { pid = id, path = path.ToString(), ownerSid = Sid, integritySid = integrity, elevated };
            }
        }
        finally { if (token != IntPtr.Zero) CloseHandle(token); CloseHandle(process); }
    }

    private static string TokenIntegrity(IntPtr token)
    {
        int length; GetTokenInformation(token, 25, IntPtr.Zero, 0, out length);
        Require(length > 0 && length < 65536, "Mandatory token label size invalid");
        IntPtr data = Marshal.AllocHGlobal(length);
        try { Require(GetTokenInformation(token, 25, data, length, out length), "Mandatory token label unavailable"); return new SecurityIdentifier(Marshal.ReadIntPtr(data)).Value; }
        finally { Marshal.FreeHGlobal(data); }
    }

    private static bool TokenElevated(IntPtr token)
    {
        int length; IntPtr data = Marshal.AllocHGlobal(4);
        try { Require(GetTokenInformation(token, 20, data, 4, out length), "Token elevation unavailable"); return Marshal.ReadInt32(data) != 0; }
        finally { Marshal.FreeHGlobal(data); }
    }

    private static void OwnWindow(IntPtr handle)
    {
        Require(handle != IntPtr.Zero && IsWindow(handle), "Owned HWND unavailable");
        OwnProcess(ProcessId(handle));
    }

    private static int Owner(IntPtr handle) { OwnWindow(handle); return ProcessId(handle); }
    private static int ProcessId(IntPtr handle) { uint id; GetWindowThreadProcessId(handle, out id); return checked((int)id); }

    private static object Registrations()
    {
        var records = new List<object>();
        foreach (RegistryHive hive in new[] { RegistryHive.CurrentUser, RegistryHive.LocalMachine })
            foreach (RegistryView view in new[] { RegistryView.Registry64, RegistryView.Registry32 })
                using (var baseKey = RegistryKey.OpenBaseKey(hive, view))
                using (var key = baseKey.OpenSubKey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\" + Text("productId") + "_is1", false))
                    if (key != null) records.Add(new { hive = hive.ToString(), view = view.ToString(), values = key.GetValueNames().ToDictionary(name => name, name => key.GetValue(name)) });
        return records;
    }

    private static string Text(string key) { return (string)Plan[key]; }
    private static string Scoped(string path)
    {
        string full = Path.GetFullPath(path);
        Require(full.StartsWith(Work.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase), "Path escaped own work");
        Safe(full);
        return full;
    }
    private static void Safe(string path)
    {
        for (string cursor = Path.GetFullPath(path); cursor != null; cursor = Path.GetDirectoryName(cursor))
            if (File.Exists(cursor) || Directory.Exists(cursor)) Require((File.GetAttributes(cursor) & FileAttributes.ReparsePoint) == 0, "Linked wizard path refused");
    }
    private static string Hash(string path) { using (var sha = SHA256.Create()) using (var stream = File.OpenRead(path)) return BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant(); }
    private static bool SamePath(string a, string b) { try { return String.Equals(Path.GetFullPath(a).TrimEnd('\\'), Path.GetFullPath(b).TrimEnd('\\'), StringComparison.OrdinalIgnoreCase); } catch (ArgumentException) { return false; } }
    private static void Check(string name, object details) { Checks.Add(new { name, passed = true, details }); }
    private static void Require(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
    private static void Wait(Func<bool> predicate, string label, int timeout) { Wait(() => predicate() ? new object() : null, label, timeout); }
    private static T Wait<T>(Func<T> callback, string label, int timeout)
    {
        var timer = Stopwatch.StartNew();
        while (timer.ElapsedMilliseconds < timeout && Budget.ElapsedMilliseconds < 90000)
        {
            T value = callback();
            if (!EqualityComparer<T>.Default.Equals(value, default(T))) return value;
            Thread.Sleep(100);
        }
        throw new TimeoutException(label + " timed out");
    }

    [StructLayout(LayoutKind.Sequential)] private struct Rect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct StartupInfo
    {
        public uint Size; public string Reserved, Desktop, Title; public uint X, Y, XSize, YSize, XCountChars, YCountChars, FillAttribute, Flags; public ushort ShowWindow, Reserved2; public IntPtr ReservedPointer, StdInput, StdOutput, StdError;
    }
    [StructLayout(LayoutKind.Sequential)] private struct ProcessInformation { public IntPtr Process, Thread; public uint ProcessId, ThreadId; }
    [StructLayout(LayoutKind.Sequential)] private struct JobBasicLimits { public long PerProcessUserTime, PerJobUserTime; public uint LimitFlags; public UIntPtr MinimumWorkingSet, MaximumWorkingSet; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
    [StructLayout(LayoutKind.Sequential)] private struct IoCounters { public ulong ReadOperations, WriteOperations, OtherOperations, ReadBytes, WriteBytes, OtherBytes; }
    [StructLayout(LayoutKind.Sequential)] private struct JobExtendedLimits { public JobBasicLimits Basic; public IoCounters Io; public UIntPtr ProcessMemory, JobMemory, PeakProcessMemory, PeakJobMemory; }
    private delegate bool EnumWindowsCallback(IntPtr handle, IntPtr parameter);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateDesktop(string name, string device, IntPtr mode, uint flags, uint access, IntPtr security);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetThreadDesktop(IntPtr desktop);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseDesktop(IntPtr desktop);
    [DllImport("user32.dll")] private static extern IntPtr GetThreadDesktop(uint thread);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("kernel32.dll")] private static extern void SetLastError(uint error);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr CreateJobObject(IntPtr security, string name);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetInformationJobObject(IntPtr job, int information, ref JobExtendedLimits value, uint length);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryInformationJobObject(IntPtr job, int information, IntPtr value, uint length, out uint returned);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool TerminateJobObject(IntPtr job, uint exit);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CreateProcess(string application, StringBuilder command, IntPtr processSecurity, IntPtr threadSecurity, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInformation process);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
    [DllImport("kernel32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool TerminateProcess(IntPtr process, uint exit);
    [DllImport("kernel32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")] private static extern int MulDiv(int number, int numerator, int denominator);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern IntPtr OpenProcess(uint access, [MarshalAs(UnmanagedType.Bool)] bool inherit, uint id);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool QueryFullProcessImageName(IntPtr process, uint flags, StringBuilder path, ref int length);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetTokenInformation(IntPtr token, int information, IntPtr data, int length, out int returned);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EnumDesktopWindows(IntPtr desktop, EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool EnumChildWindows(IntPtr window, EnumWindowsCallback callback, IntPtr parameter);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindowEnabled(IntPtr window);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr window, StringBuilder text, int length);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern IntPtr SendMessageTimeout(IntPtr window, uint message, IntPtr wParam, IntPtr lParam, uint flags, uint timeout, out IntPtr result);
    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern int GetDlgCtrlID(IntPtr window);
    [DllImport("user32.dll", EntryPoint = "GetWindowLongW", SetLastError = true)] private static extern int GetWindowLong(IntPtr window, int index);
    [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool GetWindowRect(IntPtr window, out Rect rect);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool PrintWindow(IntPtr window, IntPtr dc, uint flags);
    [DllImport("user32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr window);
    [DllImport("oleacc.dll")] private static extern int AccessibleObjectFromWindow(IntPtr window, uint objectId, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out object accessible);
    [DllImport("oleacc.dll")] private static extern int AccessibleChildren(IAccessible accessible, int start, int count, [Out, MarshalAs(UnmanagedType.LPArray, SizeParamIndex = 2)] object[] children, out int obtained);
}
