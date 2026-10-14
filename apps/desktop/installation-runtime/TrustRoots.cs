using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;

namespace TableMax.Installation
{
    internal static class TrustRoots
    {
        public static Dictionary<string, string> Read(Assembly assembly)
        {
            var name = assembly.GetManifestResourceNames().SingleOrDefault(value => value.EndsWith("ApplicationUpdateKeys.json", System.StringComparison.Ordinal));
            if (name == null) return new Dictionary<string, string>();
            using (var input = assembly.GetManifestResourceStream(name)) using (var text = new StreamReader(input, InstallationCore.Utf8)) return Parse(text.ReadToEnd());
        }
        public static Dictionary<string, string> Parse(string text)
        {
            var value = InstallationCore.Object(StrictJson.Parse(text)); InstallationCore.Keys(value, "schemaVersion", "keys"); if (InstallationCore.Number(value, "schemaVersion") != 1) throw new IOException("应用公钥协议不支持。");
            var result = new Dictionary<string, string>(); foreach (var key in InstallationCore.Object(value["keys"])) { if (!(key.Value is string xml) || key.Key.Length < 1 || key.Key.Length > 64) throw new IOException("应用公钥格式无效。"); UpdateDescriptor.PublicKey(xml); result.Add(key.Key, xml); } return result;
        }
    }
}
