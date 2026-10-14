using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Xml;

namespace TableMax.Installation
{
    internal sealed class UpdateDescriptor
    {
        public string releaseVersion, buildVersion, releaseTag, repo, assetName, assetUrl, sha256, payloadManifestSha256, currentMappingSha256;
        public int bytes;
        public const string Repository = "anApalpitate/TableMax";
        public const string Algorithm = "RSA3072-SHA256-PKCS1v15";
        private static byte[] Base64(string value, int maximum)
        {
            if (value.Length > maximum * 2) throw new IOException("更新签名描述过长。");
            byte[] bytes; try { bytes = Convert.FromBase64String(value); } catch (FormatException) { throw new IOException("更新签名编码无效。"); }
            if (bytes.Length > maximum || Convert.ToBase64String(bytes) != value) throw new IOException("更新签名编码无效。"); return bytes;
        }
        public static string Extract(string body, out string notes)
        {
            if (InstallationCore.Utf8.GetByteCount(body) > 131072) throw new IOException("更新说明过长。");
            var matches = Regex.Matches(body, @"<!-- TABLEMAX-APPLICATION-UPDATE-V1:([A-Za-z0-9+/]+={0,2}) -->");
            if (matches.Count != 1 || Regex.Matches(body, "TABLEMAX-APPLICATION-UPDATE").Count != 1) throw new IOException("该发布尚不支持可信在线更新。");
            notes = (body.Remove(matches[0].Index, matches[0].Length)).Trim();
            return InstallationCore.Utf8.GetString(Base64(matches[0].Groups[1].Value, 16384));
        }
        public static UpdateDescriptor Verify(string envelopeText, IDictionary<string, string> keys)
        {
            if (InstallationCore.Utf8.GetByteCount(envelopeText) > 16384) throw new IOException("更新签名描述过长。");
            var envelope = InstallationCore.Object(StrictJson.Parse(envelopeText, true));
            InstallationCore.Keys(envelope, "schemaVersion", "algorithm", "keyId", "payload", "signature");
            if (InstallationCore.Number(envelope, "schemaVersion") != 1 || InstallationCore.Text(envelope, "algorithm") != Algorithm) throw new IOException("更新签名协议不支持。");
            var keyId = InstallationCore.Text(envelope, "keyId"); if (!keys.TryGetValue(keyId, out var xml)) throw new IOException("更新签名密钥不受信任。");
            var payload = Base64(InstallationCore.Text(envelope, "payload"), 8192); var signature = Base64(InstallationCore.Text(envelope, "signature"), 384);
            if (signature.Length != 384) throw new IOException("更新签名长度无效。");
            using (var rsa = new RSACryptoServiceProvider())
            {
                rsa.PersistKeyInCsp = false; rsa.ImportParameters(PublicKey(xml));
                if (!rsa.VerifyData(payload, new SHA256CryptoServiceProvider(), signature)) throw new IOException("更新签名验证失败。");
            }
            var value = InstallationCore.Object(StrictJson.Parse(InstallationCore.Utf8.GetString(payload), true));
            InstallationCore.Keys(value, "schemaVersion", "productId", "channel", "os", "arch", "installProtocol", "releaseVersion", "buildVersion", "releaseTag", "repo", "assetName", "assetUrl", "bytes", "sha256", "payloadManifestSha256", "currentMappingSha256");
            if (InstallationCore.Number(value, "schemaVersion") != 1 || InstallationCore.Text(value, "productId") != InstallationCore.ProductId || InstallationCore.Text(value, "channel") != "stable" || InstallationCore.Text(value, "os") != "windows" || InstallationCore.Text(value, "arch") != "x64" || InstallationCore.Number(value, "installProtocol") != 1) throw new IOException("更新与本程序不兼容。");
            var result = new UpdateDescriptor { releaseVersion = InstallationCore.Text(value, "releaseVersion"), buildVersion = InstallationCore.Text(value, "buildVersion"), releaseTag = InstallationCore.Text(value, "releaseTag"), repo = InstallationCore.Text(value, "repo"), assetName = InstallationCore.Text(value, "assetName"), assetUrl = InstallationCore.Text(value, "assetUrl"), bytes = InstallationCore.Number(value, "bytes"), sha256 = InstallationCore.Digest(value, "sha256"), payloadManifestSha256 = InstallationCore.Digest(value, "payloadManifestSha256"), currentMappingSha256 = InstallationCore.Digest(value, "currentMappingSha256") };
            var version = InstallationCore.Version4(result.buildVersion); if (new[] { version.Major, version.Minor, version.Build, version.Revision }.Any(number => number > 65534) || version.ToString(3) != result.releaseVersion || result.releaseTag != "v" + result.releaseVersion || result.repo != Repository || result.assetName != "TableMax-" + result.releaseVersion + "-win-x64.exe" || result.assetUrl != "https://github.com/" + Repository + "/releases/download/" + result.releaseTag + "/" + result.assetName || result.bytes < 1 || result.bytes >= 120000000) throw new IOException("更新资产或版本身份不匹配。");
            return result;
        }
        public static RSAParameters PublicKey(string xml)
        {
            if (xml.Length > 2048) throw new IOException("公钥过长。");
            var document = new XmlDocument { XmlResolver = null };
            using (var text = new StringReader(xml)) using (var reader = XmlReader.Create(text, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null })) document.Load(reader);
            var root = document.DocumentElement;
            if (root == null || root.Name != "RSAKeyValue" || root.Attributes.Count != 0 || root.ChildNodes.Count != 2 || root.ChildNodes[0].Name != "Modulus" || root.ChildNodes[1].Name != "Exponent") throw new IOException("应用公钥无效。");
            var modulus = Base64(root.ChildNodes[0].InnerText, 384); var exponent = Base64(root.ChildNodes[1].InnerText, 3);
            if (modulus.Length != 384 || (modulus[0] & 128) == 0 || !exponent.SequenceEqual(new byte[] { 1, 0, 1 })) throw new IOException("应用公钥必须采用 RSA3072/65537。");
            return new RSAParameters { Modulus = modulus, Exponent = exponent };
        }
        public static bool DownloadUrl(Uri uri, string initial, int hop)
        {
            if (uri == null || uri.Scheme != "https" || uri.Port != 443 || uri.UserInfo.Length != 0 || uri.Fragment.Length != 0) return false;
            return hop == 0 ? uri.AbsoluteUri == initial : hop <= 3 && uri.Host == "release-assets.githubusercontent.com" && uri.AbsolutePath.StartsWith("/github-production-release-asset/", StringComparison.Ordinal);
        }
    }
}
