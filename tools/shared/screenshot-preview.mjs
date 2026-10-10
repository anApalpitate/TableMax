import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { assertWorkspaceRoot } from './workspace-root.mjs';

// Native/Playwright capture stays PNG in memory; only ordinary saved previews
// use the pinned encoder. Never overwrite original captures or product assets.
export async function encodeScreenshotPreview(png) {
  const root = assertWorkspaceRoot();
  const script = fileURLToPath(
    new URL('../assets/images/encode-preview.py', import.meta.url),
  );
  return new Promise((resolve, reject) => {
    const child = spawn(process.env.TABLEMAX_PYTHON || 'python', [script], {
      cwd: root,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output = [],
      diagnostics = [];
    let bytes = 0,
      diagnosticBytes = 0,
      inputError;
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Screenshot preview encoder exceeded 60 seconds'));
    }, 60000);
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > 100_000_000) child.kill();
      else output.push(chunk);
    });
    child.stderr.on('data', (chunk) => {
      diagnosticBytes += chunk.length;
      if (diagnosticBytes <= 16384) diagnostics.push(chunk);
    });
    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.stdin.on('error', (error) => {
      // A missing/incorrect runtime can close stdin before Python reports its
      // useful error. Wait for close to keep the encoder diagnostics.
      inputError = error;
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const message = Buffer.concat(diagnostics).toString('utf8').trim();
      if (code !== 0 || inputError)
        return reject(
          new Error(
            `Screenshot preview encoding failed (exit ${code}): ${message || inputError?.message}`,
          ),
        );
      try {
        const image = Buffer.concat(output);
        const metadata = JSON.parse(message);
        if (
          image.toString('ascii', 0, 4) !== 'RIFF' ||
          image.toString('ascii', 8, 12) !== 'WEBP' ||
          metadata.quality !== 90 ||
          metadata.bytes !== image.length
        )
          throw new Error('Invalid WebP preview output');
        resolve({ image, metadata });
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.end(png);
  });
}
