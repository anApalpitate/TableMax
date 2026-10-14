using System;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;

namespace TableMax.Desktop
{
    internal static class ServiceStopHarness
    {
        private static int Main(string[] args)
        {
            try { return Run(args).GetAwaiter().GetResult(); }
            catch (Exception cause) { Console.Error.WriteLine(cause.Message); return 1; }
        }
        private static async Task<int> Run(string[] args)
        {
            string mode = args[0], directory = args[1], box = args[2], data = args[3];
            using (var service = new ServiceProcess(_ => { }))
            {
                int pid = 0;
                if (mode != "not-started")
                {
                    object config = mode == "real-entry"
                        ? (object)new { host = "127.0.0.1", port = 0, dataDir = data, webDir = Path.Combine(directory, "web"), gamesDir = Path.Combine(box, "games"), playMode = "test" }
                        : new { mode };
                    var ready = await service.Start(directory, config);
                    pid = service.Id;
                    if (mode == "real-entry")
                    {
                        var port = (int)Json.Number(ready, "port");
                        var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:" + port + "/api/session/join");
                        request.Method = "POST"; request.ContentType = "application/json"; request.Timeout = 5000;
                        var bytes = Encoding.UTF8.GetBytes("{\"name\":\"关闭测试\"}"); request.ContentLength = bytes.Length;
                        using (var stream = await request.GetRequestStreamAsync()) await stream.WriteAsync(bytes, 0, bytes.Length);
                        using (var response = await request.GetResponseAsync())
                        using (var reader = new StreamReader(response.GetResponseStream()))
                            if (!Json.Bool(Json.Decode(await reader.ReadToEndAsync()), "ok")) throw new IOException("Fixture join failed.");
                    }
                }
                var first = service.Stop();
                var second = service.Stop();
                var result = await first;
                if (!Object.ReferenceEquals(first, second)) throw new IOException("Repeated stop did not share its result.");
                bool restartRejected = false;
                if (mode == "not-started")
                {
                    try { await service.Start(directory, new { mode = "drained" }); }
                    catch (InvalidOperationException) { restartRejected = true; }
                    if (!restartRejected) throw new IOException("Stopped service accepted a new start.");
                }
                Console.WriteLine(Json.Encode(new { mode, pid, status = result.Status, exitCode = result.ExitCode, confirmed = result.Confirmed, repeatedStopShared = true, restartRejected }));
            }
            return 0;
        }
    }
}
