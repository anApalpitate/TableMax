export function startupError(error: unknown, port: number, dataDir: string) {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  let reason = '本地服务无法启动。';
  let remedy = '请查看日志中的具体原因，然后重新启动。';
  if (code === 'EADDRINUSE' || /EADDRINUSE/.test(message)) {
    reason = `端口 ${port} 已被其他程序占用。`;
    remedy =
      '请关闭重复运行的 TableMax 或占用该端口的程序，再启动；不要删除存档。';
  } else if (/incompatible/.test(message)) {
    reason = '存档版本与当前程序或电脑策略不兼容。';
    remedy = '请使用兼容版本打开，或先备份完整数据目录后排查；原存档已保留。';
  } else if (/damaged|SQLITE_CORRUPT|malformed|not a database/.test(message)) {
    reason = '存档损坏或无法通过校验。';
    remedy = '请备份整个数据目录（包括 WAL／SHM）后检查；不要删除原存档。';
  } else if (['EEXIST', 'ENOTDIR'].includes(code)) {
    reason = '数据目录路径不是可用的文件夹。';
    remedy = '请检查该路径是否被同名文件占用；保留原文件，改用可写的数据目录。';
  } else if (
    ['EACCES', 'EPERM', 'ENOSPC'].includes(code) ||
    /readonly|read-only|disk is full|unable to open database/.test(message)
  ) {
    reason = '数据目录不可写，或磁盘空间不足。';
    remedy = '请检查目录权限和磁盘剩余空间，再重新启动。';
  } else if (/timed out/.test(message)) {
    reason = '本地服务在 20 秒内没有完成启动。';
    remedy = '请检查磁盘、安全软件和日志，然后重新启动。';
  }
  return `${reason}\n${remedy}\n\n数据目录：${dataDir}\n日志目录：${dataDir}\\logs\n\n具体原因：${message.slice(0, 1500)}`;
}
