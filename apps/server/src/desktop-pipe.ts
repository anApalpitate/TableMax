import type { Readable, Writable } from 'node:stream';
import { ServiceConfigSchema, type ServiceConfig } from '@tablemax/protocol';

export type DesktopMessage =
  { type: 'start'; config: ServiceConfig } | { type: 'stop' };

export class DesktopPipeError extends Error {
  constructor(public readonly code: string) {
    super('Invalid desktop service message');
  }
}

// This transport is explicitly enabled by the native parent. Credentials may
// only leave the service through this private stdout pipe, never ordinary logs.
export class DesktopPipe {
  private pending = '';
  private failed = false;

  constructor(
    input: Readable,
    private output: Writable,
    receive: (message: DesktopMessage) => void,
    closed: () => void,
    failure: (error: unknown) => void,
  ) {
    const reject = (code: string) => {
      if (this.failed) return;
      this.failed = true;
      failure(new DesktopPipeError(code));
    };
    const line = (value: string) => {
      if (this.failed) return;
      if (Buffer.byteLength(value, 'utf8') > 16 * 1024) {
        reject('DESKTOP_MESSAGE_TOO_LARGE');
        return;
      }
      let message: unknown;
      try {
        message = JSON.parse(value);
      } catch {
        reject('INVALID_DESKTOP_MESSAGE');
        return;
      }
      if (!message || typeof message !== 'object' || Array.isArray(message)) {
        reject('INVALID_DESKTOP_MESSAGE');
        return;
      }
      const envelope = message as Record<string, unknown>;
      const keys = Object.keys(envelope);
      if (envelope.type === 'stop' && keys.length === 1) {
        receive({ type: 'stop' });
      } else if (
        envelope.type === 'start' &&
        keys.length === 2 &&
        keys.includes('config')
      ) {
        const config = ServiceConfigSchema.strict().safeParse(envelope.config);
        if (config.success) receive({ type: 'start', config: config.data });
        else reject('INVALID_DESKTOP_CONFIG');
      } else {
        reject('INVALID_DESKTOP_MESSAGE');
      }
    };
    input.setEncoding('utf8');
    input.on('data', (chunk: string) => {
      if (this.failed) return;
      this.pending += chunk;
      let newline: number;
      while ((newline = this.pending.indexOf('\n')) !== -1) {
        line(this.pending.slice(0, newline));
        this.pending = this.pending.slice(newline + 1);
        if (this.failed) return;
      }
      if (Buffer.byteLength(this.pending, 'utf8') > 16 * 1024)
        reject('DESKTOP_MESSAGE_TOO_LARGE');
    });
    input.on('end', () => {
      if (this.pending) line(this.pending);
      if (!this.failed) closed();
    });
    input.on('error', () => reject('DESKTOP_PIPE_FAILED'));
  }

  send(message: unknown): Promise<void> {
    return new Promise((resolve, reject) => {
      this.output.write(`${JSON.stringify(message)}\n`, (error) =>
        error ? reject(error) : resolve(),
      );
    });
  }
}
