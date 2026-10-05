import { createServer } from 'node:net';
import { randomInt } from 'node:crypto';
/** Tests avoid the Fetch standard's forbidden ports in Windows' ephemeral range. */
export async function safeHttpPort(): Promise<number> {
  for (let attempt = 0; attempt < 16; attempt++) {
    const port = randomInt(49152, 65536),
      server = createServer();
    try {
      await new Promise<void>((done, reject) => {
        server.once('error', reject);
        server.listen(port, '127.0.0.1', done);
      });
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
      return port;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE') throw error;
    }
  }
  throw new Error('No safe local HTTP test port available');
}
