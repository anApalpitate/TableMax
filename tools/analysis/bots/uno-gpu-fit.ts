import { spawn } from 'node:child_process';

export function fitUnoOnGpu(
  script: string,
  input: string,
  checkpoint: () => void,
): Promise<string> {
  checkpoint();
  return new Promise((resolve, reject) => {
    const worker = spawn('python', ['-B', script], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const messages: Buffer[] = [];
    let outputBytes = 0;
    let diagnostic = '';
    let cancelled: unknown;
    const monitor = setInterval(() => {
      try {
        checkpoint();
      } catch (error) {
        cancelled = error;
        clearInterval(monitor);
        worker.kill();
      }
    }, 150);
    worker.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > 1024 * 1024) {
        cancelled = new Error(
          'GPU coefficient report exceeded its format limit',
        );
        worker.kill();
      } else {
        messages.push(chunk);
      }
    });
    worker.stderr.on('data', (chunk: Buffer) => {
      diagnostic = (diagnostic + chunk.toString('utf8')).slice(-8192);
    });
    worker.stdin.on('error', () => {
      // Exit status and stderr are the authoritative subprocess failure.
    });
    worker.once('error', (error) => {
      clearInterval(monitor);
      reject(error);
    });
    worker.once('close', (code) => {
      clearInterval(monitor);
      if (cancelled) reject(cancelled);
      else if (code !== 0)
        reject(new Error(diagnostic || 'UNO residual GPU fit failed'));
      else resolve(Buffer.concat(messages).toString('utf8'));
    });
    worker.stdin.end(input);
  });
}
