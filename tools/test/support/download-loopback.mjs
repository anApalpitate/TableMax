import { createServer } from 'node:http';

// A real loopback transport with controlled responses; never a real internet failure claim.
export async function downloadLoopback(archives) {
  let mode = 'normal';
  const requests = [],
    received = [];
  const server = createServer(async (request, response) => {
    const id = request.url.slice(1),
      bytes = archives.get(id);
    const record = {
      id,
      mode,
      startedAt: new Date().toISOString(),
      sentBytes: 0,
    };
    requests.push(record);
    const started = performance.now();
    response.once('close', () => {
      record.durationMs = performance.now() - started;
    });
    if (!bytes || record.mode === 'error') {
      response.writeHead(503);
      const body = 'controlled-unavailable';
      record.sentBytes = Buffer.byteLength(body);
      response.end(body);
      return;
    }
    response.writeHead(200, {
      'content-type': 'application/zip',
      'content-length': bytes.length,
    });
    if (record.mode === 'truncate') {
      response.write(bytes.subarray(0, 16));
      record.sentBytes = 16;
      setTimeout(() => response.destroy(), 10);
      return;
    }
    if (record.mode === 'stall') {
      response.write(bytes.subarray(0, 16));
      record.sentBytes = 16;
      return;
    }
    const body = record.mode === 'tamper' ? Buffer.from(bytes) : bytes;
    if (record.mode === 'tamper') body[0] ^= 1;
    for (
      let position = 0;
      position < body.length && !response.destroyed;
      position += 512
    ) {
      const chunk = body.subarray(position, position + 512);
      response.write(chunk);
      record.sentBytes += chunk.length;
      await new Promise((done) => setTimeout(done, 2));
    }
    response.end();
  });
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    requests,
    received,
    origin,
    setMode(value) {
      if (!['normal', 'truncate', 'stall', 'error', 'tamper'].includes(value))
        throw new Error('Unknown response mode');
      mode = value;
    },
    async fetch(url, options) {
      if (new URL(url).origin !== origin)
        throw new Error('Non-loopback request rejected');
      const started = performance.now(),
        record = { url, receivedBytes: 0 };
      received.push(record);
      try {
        const response = await fetch(url, options);
        record.headersMs = performance.now() - started;
        if (!response.body) return response;
        const reader = response.body.getReader();
        const body = new ReadableStream({
          async pull(controller) {
            try {
              const { value, done } = await reader.read();
              if (done) {
                record.bodyMs = performance.now() - started;
                record.eof = true;
                controller.close();
              } else {
                record.receivedBytes += value.byteLength;
                controller.enqueue(value);
              }
            } catch (error) {
              record.bodyMs = performance.now() - started;
              record.error = error.message;
              controller.error(error);
            }
          },
          async cancel(reason) {
            record.cancelled = true;
            record.bodyMs = performance.now() - started;
            await reader.cancel(reason);
          },
        });
        return new Response(body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch (error) {
        record.error = error.message;
        record.bodyMs = performance.now() - started;
        throw error;
      }
    },
    async close() {
      server.closeAllConnections();
      await new Promise((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    },
  };
}
