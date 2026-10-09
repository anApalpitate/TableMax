import {
  constants,
  copyFileSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { join } from 'node:path';

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  // Bare hosts (including host:port) use HTTP for manually mapped entries.
  const value = /^(?:https?:\/\/|[a-z][a-z0-9+.-]*:\/\/)/i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  const parts = /^(https?):\/\/([^/?#]+)([^?#]*)$/i.exec(value);
  if (
    trimmed.length > 2048 ||
    /[\s\\]/.test(value) ||
    !parts ||
    parts[2]!.includes('@') ||
    !['', '/', '/player', '/player/'].includes(parts[3]!)
  )
    throw new Error(
      '请填写域名、IP 或 HTTP／HTTPS 网址；仅支持网站根地址或 /player，不支持路径前缀、登录信息或查询参数。',
    );

  let address: URL;
  try {
    address = new URL(value);
  } catch {
    throw new Error('外部入口的网址或端口无效，请检查后重试。');
  }
  const hostname = address.hostname;
  const domain = hostname.replace(/\.$/, '');
  if (
    !hostname ||
    (hostname.startsWith('[')
      ? isIP(hostname.slice(1, -1)) !== 6
      : domain.length > 253 ||
        !domain
          .split('.')
          .every((label) =>
            /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label),
          ))
  )
    throw new Error('外部入口的域名或 IP 地址无效，请检查后重试。');
  return address.origin;
}

export class NetworkSettings {
  private readonly filename: string;
  private externalJoinUrl: string | null = null;
  private networkMessage: string | undefined;
  private corrupt = false;
  private backup: string | undefined;

  constructor(private readonly dataDir: string) {
    this.filename = join(dataDir, 'network-settings.json');
    try {
      const value: unknown = JSON.parse(readFileSync(this.filename, 'utf8'));
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== 1 ||
        !('externalJoinUrl' in value) ||
        (value.externalJoinUrl !== null &&
          typeof value.externalJoinUrl !== 'string')
      )
        throw new Error('invalid-network-settings');
      this.externalJoinUrl =
        value.externalJoinUrl === null
          ? null
          : normalizeUrl(value.externalJoinUrl);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      this.corrupt = true;
      this.networkMessage =
        '外部入口配置无法读取，原文件已保留。请在连接帮助中重新保存；当前使用局域网地址。';
    }
  }

  read(): { externalJoinUrl: string | null; networkMessage?: string } {
    return {
      externalJoinUrl: this.externalJoinUrl,
      ...(this.networkMessage ? { networkMessage: this.networkMessage } : {}),
    };
  }

  save(value: string | null): void {
    const normalized = value === null ? null : normalizeUrl(value);
    mkdirSync(this.dataDir, { recursive: true });
    const temporary = `${this.filename}.${randomUUID()}.tmp`;
    try {
      writeFileSync(
        temporary,
        `${JSON.stringify({ externalJoinUrl: normalized })}\n`,
        { encoding: 'utf8', flag: 'wx' },
      );
      if (this.corrupt && !this.backup) {
        const backup = join(
          this.dataDir,
          `network-settings.corrupt-${randomUUID()}.json`,
        );
        copyFileSync(this.filename, backup, constants.COPYFILE_EXCL);
        this.backup = backup;
      }
      renameSync(temporary, this.filename);
      this.externalJoinUrl = normalized;
      this.networkMessage = undefined;
      this.corrupt = false;
    } finally {
      try {
        unlinkSync(temporary);
      } catch {
        // Cleanup must not conceal the replacement error or change a saved value.
      }
    }
  }
}
