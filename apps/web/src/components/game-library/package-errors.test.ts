import { expect, it } from 'vitest';
import {
  packageErrorMessage,
  unknownCompatibilityIssue,
} from './package-errors';

it('preserves actionable version diagnostics instead of replacing them with retry advice', () => {
  for (const message of [
    '游戏包版本落后，请更新游戏包。',
    '盒子版本落后，请更新盒子。',
  ])
    expect(packageErrorMessage(new Error(message))).toBe(message);
  expect(packageErrorMessage('incompatible-game-module')).toBe(
    unknownCompatibilityIssue,
  );
  expect(unknownCompatibilityIssue).not.toContain('请先更新盒子');
});

it('distinguishes network, integrity, storage and authorization failures', () => {
  expect(packageErrorMessage('fetch failed')).toContain('无法连接下载服务器');
  expect(packageErrorMessage('archive-hash-mismatch')).toContain('校验失败');
  expect(packageErrorMessage('download-size-mismatch')).toContain('大小');
  expect(packageErrorMessage(new Error('ENOSPC: write'))).toContain('空间不足');
  expect(packageErrorMessage(new Error('EPERM: write'))).toContain('权限');
  expect(packageErrorMessage('unauthorized')).toContain('管理员身份');
  expect(packageErrorMessage(undefined)).toContain('未收到具体失败原因');
});
