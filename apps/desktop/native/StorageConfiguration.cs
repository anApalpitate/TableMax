using System;
using System.IO;
using System.Web.Script.Serialization;

namespace TableMax.Portable
{
    internal sealed class StorageConfiguration
    {
        public string Root { get; private set; }
        public string Pathname { get { return Path.Combine(Root, "TableMax.config.json"); } }
        public string DataDirectory { get; private set; }
        public StorageConfiguration(string root)
        {
            Root = Path.GetFullPath(root);
            Directory.CreateDirectory(Root);
            if (!File.Exists(Pathname))
            {
                try { using (var file = new FileStream(Pathname, FileMode.CreateNew, FileAccess.Write))
                    using (var text = new StreamWriter(file, new System.Text.UTF8Encoding(false)))
                        text.Write("{\"dataDirectory\":\".\"}\n"); }
                catch (IOException) { if (!File.Exists(Pathname)) throw; }
            }
            var value = new JavaScriptSerializer().DeserializeObject(File.ReadAllText(Pathname)) as System.Collections.Generic.Dictionary<string, object>;
            var directory = value != null && value.ContainsKey("dataDirectory") ? value["dataDirectory"] as string : null;
            if (String.IsNullOrWhiteSpace(directory))
                throw new IOException("TableMax.config.json 的 dataDirectory 无效，请填写存档目录。");
            DataDirectory = Resolve(directory);
        }
        private string Resolve(string directory) { return Path.GetFullPath(Path.IsPathRooted(directory) ? directory : Path.Combine(Root, directory)); }
        public void Save(string directory)
        {
            var resolved = Resolve(directory);
            Directory.CreateDirectory(resolved);
            var probe = Path.Combine(resolved, ".tablemax-write-" + Guid.NewGuid().ToString("N"));
            using (new FileStream(probe, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1, FileOptions.DeleteOnClose)) { }
            var temporary = Pathname + "." + Guid.NewGuid().ToString("N") + ".tmp";
            try
            {
                File.WriteAllText(temporary, new JavaScriptSerializer().Serialize(new { dataDirectory = resolved == Root ? "." : resolved }) + "\n", new System.Text.UTF8Encoding(false));
                File.Replace(temporary, Pathname, null);
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }
    }
}
