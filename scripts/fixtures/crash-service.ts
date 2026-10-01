// Only the verification parent receives the administration credential via IPC.
import { createService } from '../../apps/server/src/service';
async function run() {
  const service = await createService({
    host: '127.0.0.1',
    port: 0,
    dataDir: process.env.TABLEMAX_CRASH_DATA!,
    webDir: process.env.TABLEMAX_CRASH_WEB!,
  });
  const port = await service.listen();
  process.send!({ port, hostToken: service.hostToken });
}
void run();
