using System;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace TableMax.Desktop
{
    internal static class NativeMethods
    {
        [DllImport("user32.dll")] internal static extern bool SetProcessDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll")] internal static extern uint GetDpiForWindow(IntPtr window);
        [DllImport("user32.dll")] internal static extern bool SetForegroundWindow(IntPtr window);
        [DllImport("user32.dll", SetLastError = true)] internal static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
        [DllImport("kernel32.dll")] internal static extern uint SetThreadExecutionState(uint flags);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern IntPtr CreateJobObject(IntPtr attributes, string name);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref JobExtendedLimitInformation information, uint length);
        [DllImport("kernel32.dll", SetLastError = true)] internal static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
        [DllImport("kernel32.dll")] internal static extern bool CloseHandle(IntPtr handle);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool CreatePipe(out IntPtr read, out IntPtr write, ref SecurityAttributes attributes, uint size);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern bool SetHandleInformation(IntPtr handle, uint mask, uint flags);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] private static extern bool CreateProcess(string application, StringBuilder commandLine, IntPtr processAttributes, IntPtr threadAttributes, bool inheritHandles, uint flags, IntPtr environment, string directory, ref StartupInfo startup, out ProcessInformation information);
        [DllImport("kernel32.dll", SetLastError = true)] private static extern uint ResumeThread(IntPtr thread);
        [DllImport("kernel32.dll")] private static extern bool TerminateProcess(IntPtr process, uint exitCode);

        [StructLayout(LayoutKind.Sequential)] private struct SecurityAttributes { public int Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool Inherit; }
        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] private struct StartupInfo
        {
            public int Size;
            public string Reserved, Desktop, Title;
            public uint X, Y, XSize, YSize, XChars, YChars, Fill, Flags;
            public short Show, ReservedSize;
            public IntPtr ReservedData, Input, Output, Error;
        }
        [StructLayout(LayoutKind.Sequential)] private struct ProcessInformation { public IntPtr Process, Thread; public int ProcessId, ThreadId; }
        [StructLayout(LayoutKind.Sequential)] internal struct JobBasicLimitInformation
        {
            public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
            public uint LimitFlags;
            public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
            public uint ActiveProcessLimit;
            public UIntPtr Affinity;
            public uint PriorityClass, SchedulingClass;
        }
        [StructLayout(LayoutKind.Sequential)] internal struct IoCounters { public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
        [StructLayout(LayoutKind.Sequential)] internal struct JobExtendedLimitInformation
        {
            public JobBasicLimitInformation Basic;
            public IoCounters Io;
            public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
        }
        internal static IntPtr CreateKillJob()
        {
            var job = CreateJobObject(IntPtr.Zero, null);
            if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            var limits = new JobExtendedLimitInformation { Basic = new JobBasicLimitInformation { LimitFlags = 0x2000 } };
            if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(limits)))
            {
                var error = Marshal.GetLastWin32Error();
                CloseHandle(job);
                throw new Win32Exception(error);
            }
            return job;
        }
        // Start suspended: the service cannot run before its lifetime is bound to our job.
        internal static Process StartInJob(IntPtr job, string executable, string arguments, string directory, out StreamWriter input, out StreamReader output, out StreamReader error)
        {
            input = null; output = null; error = null;
            var attributes = new SecurityAttributes { Length = Marshal.SizeOf(typeof(SecurityAttributes)), Inherit = true };
            IntPtr inputRead = IntPtr.Zero, inputWrite = IntPtr.Zero, outputRead = IntPtr.Zero, outputWrite = IntPtr.Zero, errorRead = IntPtr.Zero, errorWrite = IntPtr.Zero;
            var information = new ProcessInformation();
            var resumed = false;
            try
            {
                if (!CreatePipe(out inputRead, out inputWrite, ref attributes, 0) || !CreatePipe(out outputRead, out outputWrite, ref attributes, 0) || !CreatePipe(out errorRead, out errorWrite, ref attributes, 0))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                if (!SetHandleInformation(inputWrite, 1, 0) || !SetHandleInformation(outputRead, 1, 0) || !SetHandleInformation(errorRead, 1, 0))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                var startup = new StartupInfo { Size = Marshal.SizeOf(typeof(StartupInfo)), Flags = 0x100, Input = inputRead, Output = outputWrite, Error = errorWrite };
                if (!CreateProcess(executable, new StringBuilder("\"" + executable + "\" " + arguments), IntPtr.Zero, IntPtr.Zero, true, 0x08000004, IntPtr.Zero, directory, ref startup, out information))
                    throw new Win32Exception(Marshal.GetLastWin32Error());
                if (!AssignProcessToJobObject(job, information.Process)) throw new Win32Exception(Marshal.GetLastWin32Error());
                var process = Process.GetProcessById(information.ProcessId);
                input = new StreamWriter(new FileStream(new SafeFileHandle(inputWrite, true), FileAccess.Write)) { AutoFlush = true };
                inputWrite = IntPtr.Zero;
                output = new StreamReader(new FileStream(new SafeFileHandle(outputRead, true), FileAccess.Read), Encoding.UTF8);
                outputRead = IntPtr.Zero;
                error = new StreamReader(new FileStream(new SafeFileHandle(errorRead, true), FileAccess.Read), Encoding.UTF8);
                errorRead = IntPtr.Zero;
                if (ResumeThread(information.Thread) == uint.MaxValue) throw new Win32Exception(Marshal.GetLastWin32Error());
                resumed = true;
                return process;
            }
            finally
            {
                if (!resumed && information.Process != IntPtr.Zero) TerminateProcess(information.Process, 1);
                foreach (var handle in new[] { inputRead, inputWrite, outputRead, outputWrite, errorRead, errorWrite, information.Thread, information.Process })
                    if (handle != IntPtr.Zero) CloseHandle(handle);
                if (!resumed) { input?.Dispose(); output?.Dispose(); error?.Dispose(); }
            }
        }
        internal static double Scale(IntPtr window)
        {
            try { return Math.Max(1, GetDpiForWindow(window) / 96.0); }
            catch (EntryPointNotFoundException) { return 1; }
        }
    }
}
