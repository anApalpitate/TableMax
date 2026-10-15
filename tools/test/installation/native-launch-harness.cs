using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.AccessControl;
using System.Security.Principal;
using TableMax.Installation;

internal static class NativeLaunchHarness
{
    private static readonly string[] CaseIds = { "private-copy-bindings", "temp-drive-root", "nonprivate-directory", "metadata-tamper", "target-source-tamper", "unknown-member", "unstarted-owned-cleanup", "installer-cleanup", "completed-cleanup", "completed-cleanup-pending", "completed-cleanup-unknown", "completed-cleanup-tamper", "completed-cleanup-in-use" };
    private static string work;
    private static string signedEnvelope;
    private static Dictionary<string, string> trustedKeys;
    private sealed class Result { public string id; public bool passed; public object details; public string error; }
    private sealed class Fixture
    {
        public string root, temp, helper, installer, target, audit;
        public InstallationManifest identity;
        public byte[] helperBytes, installerBytes, targetBytes;
        public string payload = InstallationCore.Hash(InstallationCore.Utf8.GetBytes("synthetic-next-payload"));
        public string mapping = InstallationCore.Hash(InstallationCore.Utf8.GetBytes("synthetic-next-mapping"));
        public InstallationLaunch Create() => InstallationLaunch.Create(identity, helper, installer, target, "1.0.6.11", installerBytes.Length, InstallationCore.Hash(installerBytes), payload, mapping);
        public InstallationLaunch Read(InstallationLaunch stage) => ReadAt(stage.HelperPath);
        public InstallationLaunch ReadAt(string helperPath) => InstallationLaunch.Read(helperPath, identity, installer, target, "1.0.6.11", installerBytes.Length, InstallationCore.Hash(installerBytes), payload, mapping);
        public Dictionary<string, string> Snapshot(InstallationLaunch stage)
        {
            var paths = new List<string> { helper, installer, target, audit, Path.Combine(root, "UpdateHelper.exe") };
            if (stage != null) paths.AddRange(new[] { stage.HelperPath, stage.InstallerPath, stage.MetadataPath });
            var result = paths.ToDictionary(path => path, Fingerprint, StringComparer.OrdinalIgnoreCase);
            if (stage != null) result[stage.DirectoryPath] = Directory.Exists(InstallationCore.IO(stage.DirectoryPath)) ? String.Join("|", Directory.GetFileSystemEntries(InstallationCore.IO(stage.DirectoryPath)).Select(Path.GetFileName).OrderBy(name => name, StringComparer.Ordinal)) : "missing";
            return result;
        }
    }
    private sealed class CompletedFixture
    {
        public Fixture source;
        public InstallationLaunch stage;
        public InstallationManifest current;
        public InstallerReceipt receipt;
        public string transaction;
        public string[] protectedPaths;
        public object Cleanup() => InstallationLaunch.CleanupFinished(current, receipt, (envelope, completedTarget, completedReceipt) =>
        {
            var target = UpdateDescriptor.Verify(envelope, trustedKeys);
            Require(target.releaseVersion == completedTarget.releaseVersion && target.buildVersion == completedTarget.buildVersion && target.bytes == completedReceipt.bytes && target.sha256 == completedReceipt.sha256 && target.payloadManifestSha256 == completedTarget.payloadManifestSha256 && target.currentMappingSha256 == completedTarget.currentMappingSha256, "Signed cleanup target differs from completed installation or receipt.");
        });
    }
    private static void Require(bool condition, string message) { if (!condition) throw new IOException(message); }
    private static string Fingerprint(string path)
    {
        if (Directory.Exists(InstallationCore.IO(path))) return "directory";
        return File.Exists(InstallationCore.IO(path)) ? new FileInfo(InstallationCore.IO(path)).Length + ":" + InstallationCore.HashFile(path) : "missing";
    }
    private static byte[] Bytes(string path) => File.ReadAllBytes(InstallationCore.IO(path));
    private static void Write(string path, byte[] bytes, bool createNew = false)
    {
        InstallationCore.Safe(path); Directory.CreateDirectory(InstallationCore.IO(Path.GetDirectoryName(path)));
        using (var output = new FileStream(InstallationCore.IO(path), createNew ? FileMode.CreateNew : FileMode.Create, FileAccess.Write, FileShare.None)) { output.Write(bytes, 0, bytes.Length); output.Flush(true); }
    }
    private static void WriteJson(string path, object value) => Write(path, InstallationCore.Utf8.GetBytes(InstallationCore.Encode(value)));
    private static Dictionary<string, object> ReadJson(string path) => InstallationCore.Object(StrictJson.Parse(InstallationCore.Utf8.GetString(Bytes(path)), true));
    private static void Same(Dictionary<string, string> before, Dictionary<string, string> after)
    {
        Require(before.Count == after.Count && before.All(entry => after.TryGetValue(entry.Key, out var value) && value == entry.Value), "A rejected operation changed the synthetic source or stage inventory.");
    }
    private static Dictionary<string, string> Inventory(string directory)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        Action<string> visit = null;
        visit = parent =>
        {
            InstallationCore.Safe(parent); result.Add(parent, "directory");
            foreach (var path in Directory.GetFileSystemEntries(InstallationCore.IO(parent)))
            {
                var ordinary = Path.Combine(parent, Path.GetFileName(path)); InstallationCore.Safe(ordinary);
                if (Directory.Exists(InstallationCore.IO(ordinary))) visit(ordinary); else result.Add(ordinary, Fingerprint(ordinary));
            }
        };
        visit(directory); return result;
    }
    private static ManagedFile[] ManagedMembers(Fixture fixture, bool next)
    {
        var paths = new[] { "TableMax.exe", "UpdateHelper.exe", "TableMax/app/TableMax.exe", "TableMax/app/node.exe", "TableMax/app/server.cjs", "TableMax/app/.tablemax-release.json", "TableMax/app/preinstalled-games/bootstrap.json" };
        return paths.Select(path =>
        {
            var bytes = path == "UpdateHelper.exe" ? (next ? InstallationCore.Utf8.GetBytes("synthetic current helper bytes; never executed") : fixture.helperBytes) : path == "TableMax/app/.tablemax-release.json" ? (next ? InstallationCore.Utf8.GetBytes("synthetic-next-payload") : new byte[] { 1 }) : path == "TableMax/app/preinstalled-games/bootstrap.json" ? (next ? InstallationCore.Utf8.GetBytes("synthetic-next-mapping") : new byte[] { 2 }) : InstallationCore.Utf8.GetBytes((next ? "current " : "previous ") + path + "; never executed");
            Write(InstallationCore.Member(fixture.root, path), bytes);
            return new ManagedFile { path = path, bytes = bytes.Length, sha256 = InstallationCore.Hash(bytes) };
        }).ToArray();
    }
    private static CompletedFixture CompletedInputs(string name, bool invalidSignature = false)
    {
        var fixture = Inputs(name); fixture.identity.files = ManagedMembers(fixture, false);
        var envelope = signedEnvelope;
        if (invalidSignature) { var invalid = InstallationCore.Object(StrictJson.Parse(envelope, true)); invalid["signature"] = Convert.ToBase64String(new byte[384]); envelope = InstallationCore.Encode(invalid); }
        fixture.targetBytes = InstallationCore.Utf8.GetBytes(envelope); Write(fixture.target, fixture.targetBytes);
        var stage = fixture.Create();
        var current = new InstallationManifest { schemaVersion = 1, productId = InstallationCore.ProductId, arch = "x64", installProtocol = 1, releaseVersion = "1.0.6", buildVersion = "1.0.6.11", installationId = fixture.identity.installationId, ownerSid = fixture.identity.ownerSid, root = fixture.root, boxRoot = fixture.identity.boxRoot, payloadManifestSha256 = fixture.payload, currentMappingSha256 = fixture.mapping, files = ManagedMembers(fixture, true) };
        current.Verify(current.root); WriteJson(InstallationCore.IdentityPath(current.root), current);
        var receipt = new InstallerReceipt { schemaVersion = 1, productId = InstallationCore.ProductId, installationId = current.installationId, buildVersion = current.buildVersion, bytes = fixture.installerBytes.Length, sha256 = InstallationCore.Hash(fixture.installerBytes) };
        WriteJson(InstallationCore.ReceiptPath(current.root), receipt);
        var transaction = Path.Combine(current.boxRoot, ".installation-transactions", Guid.NewGuid().ToString("D"));
        WriteJson(Path.Combine(transaction, "previous.json"), fixture.identity); WriteJson(Path.Combine(transaction, "target.json"), current); WriteJson(Path.Combine(transaction, "target-receipt.json"), receipt);
        WriteJson(Path.Combine(transaction, "state.json"), new { schemaVersion = 1, root = current.root, phase = "completed", dataDirectory = (string)null, databaseFingerprint = (string)null });
        var protectedPaths = new[] { Path.Combine(current.boxRoot, "games", "unrelated.keep"), Path.Combine(Path.GetDirectoryName(fixture.root), "external-data", "saved.keep"), Path.Combine(fixture.temp, "unrelated-temp", "unknown.keep") };
        foreach (var path in protectedPaths) Write(path, InstallationCore.Utf8.GetBytes("unrelated original bytes"), true);
        WriteJson(Path.Combine(Path.GetDirectoryName(fixture.target), "handoff.json"), new { schemaVersion = 1, root = current.root, buildVersion = current.buildVersion, status = "installer-finished", exitCode = 0, actualHelper = SyntheticObservation(stage.HelperTuple, true), actualInstaller = SyntheticObservation(stage.InstallerTuple, false), sourceInstaller = stage.InstallerTuple, launchMetadataPath = stage.MetadataPath, launchMetadataSha256 = stage.MetadataSha256, cleanup = new { installerDeleted = false, selfHelperRetained = true, reason = "Synthetic completed record; no executable was started." } });
        return new CompletedFixture { source = fixture, stage = stage, current = current, receipt = receipt, transaction = transaction, protectedPaths = protectedPaths };
    }
    private static object SyntheticObservation(object tuple, bool helper)
    {
        var value = InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(tuple), true));
        var path = InstallationCore.Text(value, "path"); var pid = Int32.MaxValue;
        try { using (System.Diagnostics.Process.GetProcessById(pid)) throw new IOException("Synthetic absent PID unexpectedly exists; fixture creation stopped."); }
        catch (ArgumentException) { }
        value.Add("expectedPath", path); value.Add("pid", pid); value.Add("modulePath", path); value.Add("pathObserved", true); value.Add("processStarted", true); value.Add("queriedFromProcessHandle", true);
        if (helper) value.Add("assemblyLocation", path);
        return value;
    }
    private static Dictionary<string, object> CleanupResult(object value, string status)
    {
        var report = InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(value), true)); InstallationCore.Keys(report, "schemaVersion", "results");
        Require(InstallationCore.Number(report, "schemaVersion") == 1, "Unexpected cleanup report version.");
        var results = report["results"] as object[]; Require(results != null && results.Length == 1, "Exactly one completed fixture handoff must be considered.");
        var result = InstallationCore.Object(results[0]); InstallationCore.Keys(result, "handoff", "status", "reason");
        Require(InstallationCore.Text(result, "status") == status && !String.IsNullOrEmpty(InstallationCore.Text(result, "reason")), "Cleanup had an unexpected result.");
        return result;
    }
    private static object RetainedCompleted(CompletedFixture fixture, string reasonPart)
    {
        var directory = Path.GetDirectoryName(fixture.source.root); var before = Inventory(directory);
        var result = CleanupResult(fixture.Cleanup(), "retained"); Same(before, Inventory(directory));
        Require(InstallationCore.Text(result, "reason").Contains(reasonPart), "Cleanup retained the fixture at an unexpected boundary: " + InstallationCore.Text(result, "reason"));
        Require(!File.Exists(InstallationCore.IO(Path.Combine(Path.GetDirectoryName(fixture.source.target), "cleanup.json"))), "Rejected cleanup created a completion audit.");
        return new { result, allSyntheticFilesAndDirectoriesUnchanged = true, fileCount = before.Count(entry => entry.Value != "directory") };
    }
    private static object RunCompleted(string id, int index)
    {
        var name = "c" + index.ToString("00");
        if (id == "completed-cleanup-tamper")
        {
            var helper = CompletedInputs(name + "h"); var changed = Bytes(helper.stage.HelperPath); changed[0] ^= 1; Write(helper.stage.HelperPath, changed);
            var helperResult = RetainedCompleted(helper, "清理成员已变化");
            var metadata = CompletedInputs(name + "m"); Write(metadata.stage.MetadataPath, Bytes(metadata.stage.MetadataPath).Concat(new byte[] { 32 }).ToArray());
            var metadataResult = RetainedCompleted(metadata, "清理元数据");
            var signature = CompletedInputs(name + "s", true); var signatureResult = RetainedCompleted(signature, "更新签名验证失败");
            return new { helperResult, metadataResult, signatureResult, realRsaRejectionRequired = true };
        }
        var fixture = CompletedInputs(name);
        if (id == "completed-cleanup-pending")
        {
            WriteJson(Path.Combine(fixture.transaction, "state.json"), new { schemaVersion = 1, root = fixture.current.root, phase = "health-failed", dataDirectory = (string)null, databaseFingerprint = (string)null });
            return RetainedCompleted(fixture, "安装事务尚未完成");
        }
        if (id == "completed-cleanup-unknown")
        {
            Write(Path.Combine(fixture.stage.DirectoryPath, "unknown.keep"), InstallationCore.Utf8.GetBytes("unknown launch member must survive"), true);
            return RetainedCompleted(fixture, "临时目录含未知成员");
        }
        if (id == "completed-cleanup-in-use")
        {
            using (var held = new FileStream(InstallationCore.IO(fixture.stage.HelperPath), FileMode.Open, FileAccess.Read, FileShare.Read))
            {
                Require(held.Length > 0, "The synthetic helper lease is empty.");
                return RetainedCompleted(fixture, "清理成员被占用");
            }
        }
        Require(id == "completed-cleanup", "Unknown completed cleanup case.");
        var currentResult = CleanedCompleted(fixture);
        var historical = CompletedInputs(name + "history");
        historical.current = InstallationManifest.Read(Path.Combine(historical.transaction, "target.json"), true); historical.current.buildVersion = "1.0.6.12";
        var historicalTarget = InstallationManifest.Read(Path.Combine(historical.transaction, "target.json"), true);
        historical.receipt = InstallerReceipt.Read(Path.Combine(historical.transaction, "target-receipt.json"), historicalTarget); historical.receipt.buildVersion = historical.current.buildVersion;
        var latestInstaller = InstallationCore.Utf8.GetBytes("synthetic current version 12 installer; never executed"); historical.receipt.bytes = latestInstaller.Length; historical.receipt.sha256 = InstallationCore.Hash(latestInstaller);
        historical.current.Verify(historical.current.root); WriteJson(InstallationCore.IdentityPath(historical.current.root), historical.current); WriteJson(InstallationCore.ReceiptPath(historical.current.root), historical.receipt);
        return new { sameCurrentTarget = currentResult, historicalTarget = CleanedCompleted(historical), historicalTargetBuildVersion = "1.0.6.11", installedBuildVersion = "1.0.6.12" };
    }
    private static object CleanedCompleted(CompletedFixture fixture)
    {
        var preserved = fixture.protectedPaths.Concat(new[] { fixture.source.installer, fixture.source.target, fixture.source.audit, Path.Combine(Path.GetDirectoryName(fixture.source.target), "handoff.json"), InstallationCore.IdentityPath(fixture.current.root), InstallationCore.ReceiptPath(fixture.current.root) }).ToDictionary(path => path, Fingerprint, StringComparer.OrdinalIgnoreCase);
        var removed = new[] { fixture.stage.HelperPath, fixture.stage.InstallerPath, fixture.stage.MetadataPath, fixture.source.helper }.ToDictionary(path => path, Fingerprint, StringComparer.OrdinalIgnoreCase);
        var result = CleanupResult(fixture.Cleanup(), "cleaned");
        Require(!Directory.Exists(InstallationCore.IO(fixture.stage.DirectoryPath)) && removed.Keys.All(path => !File.Exists(InstallationCore.IO(path))), "Completed cleanup left an exact owned launch file.");
        Same(preserved, preserved.Keys.ToDictionary(path => path, Fingerprint, StringComparer.OrdinalIgnoreCase));
        var cleanupPath = Path.Combine(Path.GetDirectoryName(fixture.source.target), "cleanup.json"); var audit = ReadJson(cleanupPath);
        InstallationCore.Keys(audit, "schemaVersion", "kind", "status", "root", "boxRoot", "installationId", "ownerSid", "buildVersion", "currentBuildVersion", "payloadManifestSha256", "currentMappingSha256", "receiptSha256", "launchAuditSha256", "handoffSha256", "launchMetadataPath", "launchMetadataSha256", "targetEnvelopeSha256", "temporaryDirectory", "removed", "retainedSourceInstaller");
        Require(InstallationCore.Text(audit, "kind") == "TableMax.ApplicationUpdate.Cleanup" && InstallationCore.Text(audit, "status") == "completed", "Cleanup audit lacks the completed public terminal state.");
        Require(InstallationCore.Text(audit, "buildVersion") == "1.0.6.11" && InstallationCore.Text(audit, "currentBuildVersion") == fixture.current.buildVersion && InstallationCore.Digest(audit, "receiptSha256") == InstallationCore.HashFile(Path.Combine(fixture.transaction, "target-receipt.json")), "Cleanup audit confused the completed signed target with the later installed identity.");
        var tuples = audit["removed"] as object[]; Require(tuples != null && tuples.Length == removed.Count, "Cleanup audit removed inventory differs.");
        foreach (var tuple in tuples)
        {
            var file = InstallationCore.Object(tuple); InstallationCore.Keys(file, "sourcePath", "path", "bytes", "sha256"); var path = InstallationCore.Text(file, "path");
            Require(removed.TryGetValue(path, out var fingerprint) && fingerprint == InstallationCore.Number(file, "bytes") + ":" + InstallationCore.Digest(file, "sha256"), "Cleanup audit did not bind exact removed raw bytes.");
        }
        var retained = InstallationCore.Object(audit["retainedSourceInstaller"]); InstallationCore.Keys(retained, "sourcePath", "path", "bytes", "sha256");
        Require(InstallationCore.Equal(InstallationCore.Text(retained, "sourcePath"), fixture.source.installer) && InstallationCore.Equal(InstallationCore.Text(retained, "path"), fixture.source.installer) && InstallationCore.Number(retained, "bytes") == fixture.source.installerBytes.Length && InstallationCore.Digest(retained, "sha256") == InstallationCore.Hash(fixture.source.installerBytes), "Canonical signed download retention tuple differs.");
        var beforeSecond = Inventory(Path.GetDirectoryName(fixture.source.root)); var again = CleanupResult(fixture.Cleanup(), "retained"); Same(beforeSecond, Inventory(Path.GetDirectoryName(fixture.source.root)));
        return new { result, repeated = again, cleanupPath, removed = removed.Keys.ToArray(), canonicalDownloadRetained = true, unrelatedGamesDataAndTemporaryFilesRetained = true, idempotentInventoryUnchanged = true, rsaVerifiedWithInMemoryTestKey = true, observationsAreSyntheticRecordsOnly = true, executableStarted = false };
    }
    private static string Reject(Action action, string messagePart = null)
    {
        try { action(); } catch (IOException cause) { Require(messagePart == null || cause.Message.Contains(messagePart), "Rejection occurred at an unexpected boundary: " + cause.Message); return cause.Message; }
        throw new IOException("The deliberately invalid launch state was accepted.");
    }
    private static Fixture Inputs(string name)
    {
        var directory = Path.Combine(work, name); Require(!Directory.Exists(directory) && !File.Exists(directory), "Use a new fixture directory.");
        Directory.CreateDirectory(directory);
        var fixture = new Fixture { root = InstallationCore.Root(Path.Combine(directory, "I")), temp = Path.Combine(directory, "temp"), helperBytes = InstallationCore.Utf8.GetBytes("synthetic helper bytes; never executed"), installerBytes = InstallationCore.Utf8.GetBytes("synthetic installer bytes; never executed"), targetBytes = InstallationCore.Utf8.GetBytes("{\"syntheticTarget\":1}") };
        Directory.CreateDirectory(fixture.temp);
        var handoff = Path.Combine(InstallationCore.Box(fixture.root), "updates", "handoff-" + Guid.NewGuid().ToString("N"));
        fixture.helper = Path.Combine(handoff, "UpdateHelper.exe"); fixture.target = Path.Combine(handoff, "envelope.json"); fixture.audit = Path.Combine(handoff, "launch.json");
        fixture.installer = Path.Combine(InstallationCore.Box(fixture.root), "updates", "downloads", InstallationCore.Hash(fixture.installerBytes), "TableMax-1.0.6-win-x64.exe");
        Write(fixture.helper, fixture.helperBytes, true); Write(fixture.installer, fixture.installerBytes, true); Write(fixture.target, fixture.targetBytes, true); Write(Path.Combine(fixture.root, "UpdateHelper.exe"), fixture.helperBytes, true);
        using (var user = WindowsIdentity.GetCurrent()) fixture.identity = new InstallationManifest { schemaVersion = 1, productId = InstallationCore.ProductId, arch = "x64", installProtocol = 1, releaseVersion = "1.0.6", buildVersion = "1.0.6.10", installationId = Guid.NewGuid().ToString(), ownerSid = user.User.Value, root = fixture.root, boxRoot = InstallationCore.Box(fixture.root), payloadManifestSha256 = InstallationCore.Hash(new byte[] { 1 }), currentMappingSha256 = InstallationCore.Hash(new byte[] { 2 }), files = new[] { new ManagedFile { path = "UpdateHelper.exe", bytes = fixture.helperBytes.Length, sha256 = InstallationCore.Hash(fixture.helperBytes) } } };
        Environment.SetEnvironmentVariable("TEMP", fixture.temp); Environment.SetEnvironmentVariable("TMP", fixture.temp);
        Require(InstallationCore.Equal(Path.GetTempPath(), fixture.temp), "The process TEMP override was not observed.");
        return fixture;
    }
    private static object Acl(InstallationLaunch stage, Fixture fixture)
    {
        var security = Directory.GetAccessControl(InstallationCore.IO(stage.DirectoryPath), AccessControlSections.Owner | AccessControlSections.Access);
        var rules = security.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().ToArray();
        Require(security.AreAccessRulesProtected && security.GetOwner(typeof(SecurityIdentifier)).Value == fixture.identity.ownerSid, "Launch ACL owner or protection differs.");
        var expected = new HashSet<string>(new[] { fixture.identity.ownerSid, "S-1-5-18" }, StringComparer.Ordinal);
        Require(rules.Length == 2, "Launch ACL must contain exactly owner and SYSTEM.");
        foreach (var rule in rules) Require(!rule.IsInherited && rule.AccessControlType == AccessControlType.Allow && rule.FileSystemRights == FileSystemRights.FullControl && rule.InheritanceFlags == (InheritanceFlags.ContainerInherit | InheritanceFlags.ObjectInherit) && rule.PropagationFlags == PropagationFlags.None && expected.Remove(rule.IdentityReference.Value), "Unexpected private launch ACL rule.");
        Require(expected.Count == 0, "Private launch ACL is incomplete.");
        return new { ownerSid = fixture.identity.ownerSid, protectedAcl = security.AreAccessRulesProtected, rules = rules.Select(rule => new { sid = rule.IdentityReference.Value, rights = rule.FileSystemRights.ToString(), inherited = rule.IsInherited, inheritance = rule.InheritanceFlags.ToString() }).ToArray() };
    }
    private static object Run(string id, int index)
    {
        if (id.StartsWith("completed-cleanup", StringComparison.Ordinal)) return RunCompleted(id, index);
        var fixture = Inputs("c" + index.ToString("00"));
        if (id == "temp-drive-root")
        {
            var before = fixture.Snapshot(null); var diskRoot = Path.GetPathRoot(fixture.temp);
            Environment.SetEnvironmentVariable("TEMP", diskRoot); Environment.SetEnvironmentVariable("TMP", diskRoot);
            var error = Reject(() => fixture.Create(), "TEMP 不能是磁盘根目录"); Same(before, fixture.Snapshot(null));
            return new { error, directoryCreated = false, sourceUnchanged = true, processEnvironmentOnly = true };
        }
        if (id == "nonprivate-directory")
        {
            // A new ordinary directory inherits its ACL. No existing ACL is changed.
            var ordinary = Path.Combine(fixture.temp, "TableMax-update-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(ordinary);
            var security = Directory.GetAccessControl(ordinary, AccessControlSections.Owner | AccessControlSections.Access);
            Require(!security.AreAccessRulesProtected, "The new ordinary fixture unexpectedly has a protected ACL.");
            var error = Reject(() => fixture.ReadAt(Path.Combine(ordinary, "h.exe")), "私有权限");
            Require(Directory.Exists(ordinary) && Directory.GetFileSystemEntries(ordinary).Length == 0, "ACL rejection changed the ordinary directory.");
            return new { error, directory = ordinary, protectedAcl = security.AreAccessRulesProtected, existingPermissionsChanged = false };
        }
        var stage = fixture.Create(); var originalMetadata = Bytes(stage.MetadataPath);
        if (id == "private-copy-bindings")
        {
            var acl = Acl(stage, fixture); var before = fixture.Snapshot(stage); var read = fixture.Read(stage); read.VerifyForLaunch(fixture.identity); Same(before, fixture.Snapshot(stage));
            Require(Bytes(stage.HelperPath).SequenceEqual(fixture.helperBytes) && Bytes(stage.InstallerPath).SequenceEqual(fixture.installerBytes), "CreateNew copies differ from original synthetic bytes.");
            var metadata = ReadJson(stage.MetadataPath); var audit = ReadJson(fixture.audit);
            InstallationCore.Keys(metadata, "schemaVersion", "kind", "productId", "installationId", "ownerSid", "root", "boxRoot", "installedBuildVersion", "targetBuildVersion", "payloadManifestSha256", "currentMappingSha256", "temporaryParent", "temporaryDirectory", "auditPath", "helper", "installer", "target");
            InstallationCore.Keys(audit, "schemaVersion", "root", "installationId", "ownerSid", "temporaryDirectory", "metadataPath", "metadataSha256", "actualHelper", "sourceInstaller", "target");
            Require(InstallationCore.Text(audit, "metadataSha256") == InstallationCore.Hash(originalMetadata) && stage.MetadataSha256 == InstallationCore.Hash(originalMetadata), "Audit did not bind exact raw metadata bytes.");
            return new { acl, sourceAndCopies = before, metadataSha256 = stage.MetadataSha256, createNewCopiesVerified = true, strictReadAndVerifyPassed = true };
        }
        if (id == "metadata-tamper")
        {
            var metadata = ReadJson(stage.MetadataPath); metadata["unknownFixtureField"] = true; WriteJson(stage.MetadataPath, metadata);
            var before = fixture.Snapshot(stage); var strict = Reject(() => fixture.Read(stage)); Same(before, fixture.Snapshot(stage));
            Write(stage.MetadataPath, originalMetadata); fixture.Read(stage).VerifyForLaunch(fixture.identity);
            Write(stage.MetadataPath, originalMetadata.Concat(new byte[] { 32 }).ToArray());
            before = fixture.Snapshot(stage); var raw = Reject(() => fixture.Read(stage)); var existing = Reject(() => stage.VerifyForLaunch(fixture.identity)); Same(before, fixture.Snapshot(stage));
            return new { strictFieldRejection = strict, rawMetadataShaRejection = raw, existingObjectRejection = existing, rejectedBytesPreserved = true };
        }
        if (id == "target-source-tamper")
        {
            var failures = new List<string>();
            Write(fixture.target, fixture.targetBytes.Concat(new byte[] { 32 }).ToArray()); var before = fixture.Snapshot(stage); failures.Add(Reject(() => fixture.Read(stage))); Same(before, fixture.Snapshot(stage)); Write(fixture.target, fixture.targetBytes);
            var changed = (byte[])fixture.helperBytes.Clone(); changed[0] ^= 1; Write(fixture.helper, changed); before = fixture.Snapshot(stage); failures.Add(Reject(() => fixture.Read(stage))); Same(before, fixture.Snapshot(stage)); Write(fixture.helper, fixture.helperBytes);
            var metadata = ReadJson(stage.MetadataPath); InstallationCore.Object(metadata["installer"])["sourcePath"] = Path.Combine(fixture.root, "different-source.exe"); WriteJson(stage.MetadataPath, metadata);
            before = fixture.Snapshot(stage); failures.Add(Reject(() => fixture.Read(stage))); Same(before, fixture.Snapshot(stage));
            Write(stage.MetadataPath, originalMetadata); fixture.Read(stage).VerifyForLaunch(fixture.identity);
            return new { targetRawShaSourceBytesAndSourceTupleRejected = failures, rejectionInventoriesUnchanged = true, exactRestorationAccepted = true };
        }
        if (id == "unknown-member")
        {
            var unknown = Path.Combine(stage.DirectoryPath, "unknown.keep"); Write(unknown, InstallationCore.Utf8.GetBytes("preserve this unknown file"), true); var fingerprint = Fingerprint(unknown); var before = fixture.Snapshot(stage);
            var readError = Reject(() => fixture.Read(stage)); var verifyError = Reject(() => stage.VerifyForLaunch(fixture.identity));
            var cleanup = InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(stage.CleanupInstaller(true))));
            Require(cleanup["installerDeleted"] is bool deleted && !deleted, "Unknown member must block installer cleanup."); Same(before, fixture.Snapshot(stage));
            var unstarted = stage.CleanupUnstarted(); Require(unstarted != null && Fingerprint(unknown) == fingerprint && Directory.Exists(InstallationCore.IO(stage.DirectoryPath)), "Owned cleanup removed an unknown file or directory.");
            return new { readError, verifyError, cleanup, unstarted, unknownSha256 = InstallationCore.HashFile(unknown), unknownRetained = true };
        }
        if (id == "unstarted-owned-cleanup")
        {
            var audit = Fingerprint(fixture.audit); Require(stage.CleanupUnstarted() == null && !Directory.Exists(InstallationCore.IO(stage.DirectoryPath)), "Exact unstarted owned files were not removed.");
            Require(Fingerprint(fixture.audit) == audit && Bytes(fixture.helper).SequenceEqual(fixture.helperBytes) && Bytes(fixture.installer).SequenceEqual(fixture.installerBytes), "Owned cleanup altered the B audit or canonical source.");
            var other = Inputs("c" + index.ToString("00") + "b"); var damaged = other.Create(); var changed = Bytes(damaged.HelperPath); changed[0] ^= 1; Write(damaged.HelperPath, changed); var badFingerprint = Fingerprint(damaged.HelperPath);
            var diagnostic = damaged.CleanupUnstarted(); Require(diagnostic != null && Fingerprint(damaged.HelperPath) == badFingerprint, "Cleanup deleted a changed owned file.");
            return new { exactOwnedDirectoryRemoved = true, auditAndSourcesRetained = true, changedOwnedRetained = true, diagnostic };
        }
        Require(id == "installer-cleanup", "Unknown case.");
        var retained = fixture.Snapshot(stage); var pending = InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(stage.CleanupInstaller(false)))); Same(retained, fixture.Snapshot(stage));
        Require(pending["installerDeleted"] is bool pendingDeleted && !pendingDeleted, "Pending cleanup deleted installer.");
        var success = InstallationCore.Object(StrictJson.Parse(InstallationCore.Encode(stage.CleanupInstaller(true))));
        Require(success["installerDeleted"] is bool successDeleted && successDeleted && !File.Exists(InstallationCore.IO(stage.InstallerPath)), "Successful cleanup did not remove only installer.");
        foreach (var path in new[] { stage.HelperPath, stage.MetadataPath, fixture.audit, fixture.helper, fixture.installer, fixture.target }) Require(Fingerprint(path) == retained[path], "Successful cleanup changed a preserved member.");
        return new { pending, success, helperMetadataAuditAndSourcesRetained = true, moduleExecuted = false };
    }
    public static int Main(string[] args)
    {
        InstallationCore.InitializeRuntime();
        Console.SetOut(new StreamWriter(Console.OpenStandardOutput(), InstallationCore.Utf8) { AutoFlush = true });
        var previousTemp = Environment.GetEnvironmentVariable("TEMP"); var previousTmp = Environment.GetEnvironmentVariable("TMP");
        var results = new List<Result>(); var selected = CaseIds; var priorFailures = 0; var failures = 0;
        try
        {
            Require(args.Length >= 1 && args.Length <= 4, "Use isolated work directory and unique --only/--prior-failures/--signed-fixture.");
            work = InstallationCore.Root(args[0]); Require(Directory.Exists(InstallationCore.IO(work)) && Directory.GetFileSystemEntries(InstallationCore.IO(work)).Length == 0, "The fixture work directory must already exist and be empty.");
            var options = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var argument in args.Skip(1)) { var split = argument.IndexOf('='); Require(split > 0, "Missing option value."); var key = argument.Substring(0, split); Require((key == "--only" || key == "--prior-failures" || key == "--signed-fixture") && !options.ContainsKey(key), "Unknown or duplicate option."); options.Add(key, argument.Substring(split + 1)); }
            if (options.TryGetValue("--only", out var only)) { var names = only.Split(','); Require(names.Length > 0 && names.All(name => CaseIds.Contains(name)) && names.Distinct(StringComparer.Ordinal).Count() == names.Length, "Select unique known case IDs."); selected = CaseIds.Where(names.Contains).ToArray(); }
            if (options.TryGetValue("--prior-failures", out var prior)) { Require(prior == "0" || prior == "1" || prior == "2", "Prior failures must be 0..2."); priorFailures = Int32.Parse(prior); }
            if (selected.Any(id => id.StartsWith("completed-cleanup", StringComparison.Ordinal)))
            {
                Require(options.TryGetValue("--signed-fixture", out var signedFixture), "Completed cleanup cases require the public in-memory-key fixture.");
                Require(InstallationCore.Equal(Path.GetDirectoryName(signedFixture), Path.GetDirectoryName(work)) && Path.GetFileName(signedFixture) == "public-signature-fixture.json", "Signed fixture must belong to this new harness work parent.");
                InstallationCore.Safe(signedFixture); var signed = ReadJson(signedFixture); InstallationCore.Keys(signed, "trust", "envelope");
                trustedKeys = TrustRoots.Parse(InstallationCore.Encode(signed["trust"])); signedEnvelope = InstallationCore.Encode(signed["envelope"]);
                UpdateDescriptor.Verify(signedEnvelope, trustedKeys);
            }
            foreach (var id in selected)
            {
                if (priorFailures + failures >= 3) break;
                try { results.Add(new Result { id = id, passed = true, details = Run(id, Array.IndexOf(CaseIds, id)) }); }
                catch (Exception cause) { failures++; results.Add(new Result { id = id, passed = false, error = cause.ToString() }); }
                finally { Environment.SetEnvironmentVariable("TEMP", previousTemp); Environment.SetEnvironmentVariable("TMP", previousTmp); }
            }
        }
        catch (Exception cause) { failures++; results.Add(new Result { id = "harness-input", passed = false, error = cause.ToString() }); }
        finally { Environment.SetEnvironmentVariable("TEMP", previousTemp); Environment.SetEnvironmentVariable("TMP", previousTmp); }
        var passed = failures == 0 && results.Count == selected.Length;
        Console.WriteLine(InstallationCore.Encode(new { schemaVersion = 1, passed, boundary = "Actual net48 InstallationCore/InstallationLaunch, fixture RSA verification and new engineering-temp objects with synthetic non-PE files and synthetic absent-PID completed records. No Native/helper/installer execution, actual module observation, parent pipe, service, registry, account, existing-object ACL changes or global policy changes. Canonical signed downloads remain as measured cache; only exact completed launch copies are cleanup candidates.", selectedCases = selected, priorFailures, failures, totalFailures = priorFailures + failures, failureLimit = 3, stoppedEarly = results.Count < selected.Length, processEnvironmentRestored = Environment.GetEnvironmentVariable("TEMP") == previousTemp && Environment.GetEnvironmentVariable("TMP") == previousTmp, results }));
        return passed ? 0 : 1;
    }
}
