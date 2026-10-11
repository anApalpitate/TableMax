export const unknownCompatibilityIssue =
  '游戏包与当前盒子不兼容；旧目录未提供具体版本原因，请刷新发行目录后查看。';

const reasons: Record<string, string> = {
  'incompatible-game-module': unknownCompatibilityIssue,
  'download-not-configured':
    '此游戏包尚未提供下载地址，请刷新发行目录或导入离线包。',
  'download-failed': '下载服务器未能提供游戏包，请检查网络后重试。',
  'fetch failed': '无法连接下载服务器，请检查网络后重试。',
  'Failed to fetch': '无法连接服务器，请检查网络及盒子服务后重试。',
  'download-size-mismatch':
    '下载文件大小与发行目录不符，请刷新目录后重新下载。',
  'archive-hash-mismatch': '下载文件校验失败，文件可能不完整，请重新下载。',
  'package-file-hash-mismatch':
    '游戏包内文件校验失败，请重新下载或更换离线包。',
  'extra-package-file': '游戏包含有发行目录未声明的文件，请更换正确的游戏包。',
  'installed-package-corrupt': '本机游戏包已损坏，请重新安装。',
  'unknown-release': '此发行包已不在当前目录中，请刷新发行目录。',
  'installation-cancelled': '游戏包安装已取消。',
  unauthorized: '管理员身份失效，请重新连接后操作。',
  'release-in-use': '此版本正被对局或存档使用，暂时无法卸载。',
};

export function packageErrorMessage(cause: unknown): string {
  const reason = cause instanceof Error ? cause.message : cause;
  if (typeof reason !== 'string' || !reason.trim())
    return '未收到具体失败原因，请检查网络及盒子服务后重试。';
  if (reasons[reason]) return reasons[reason];
  if (/\b(?:ENOSPC)\b/.test(reason))
    return '存储空间不足，请释放盒子所在磁盘的空间后重试。';
  if (/\b(?:EACCES|EPERM)\b/.test(reason))
    return '无法写入游戏包目录，请检查目录权限或文件占用后重试。';
  if (/\b(?:ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND)\b/.test(reason))
    return '下载连接失败或超时，请检查网络及下载服务器后重试。';
  return reason;
}
