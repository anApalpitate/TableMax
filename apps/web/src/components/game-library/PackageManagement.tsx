import { useRef, useState } from 'react';
import type {} from '../../../../desktop/src/package-types';
import type { RoomSession } from '../../session/useRoomSession';
import { useInstalledResources } from './server-resources';
import './packages.css';

export function PackageManagement({ session }: { session: RoomSession }) {
  const library = useInstalledResources(session);
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!session.isHost || !library.snapshot) return null;
  const run = async (work: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '游戏包操作失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="package-management">
      <summary>游戏包管理</summary>
      <div className="package-management__actions">
        <button
          disabled={busy}
          onClick={() => void run(() => library.manage('refresh'))}
        >
          刷新发行目录
        </button>
        <button
          disabled={busy}
          onClick={() =>
            void run(async () => {
              if (!window.tablemaxPackages) {
                picker.current?.click();
                return;
              }
              const file = await window.tablemaxPackages.pick();
              if (file)
                await library.importFile(
                  new Blob([
                    Uint8Array.from(atob(file.base64), (char) =>
                      char.charCodeAt(0),
                    ),
                  ]),
                );
            })
          }
        >
          导入离线包
        </button>
        <input
          ref={picker}
          type="file"
          accept=".zip"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void run(() => library.importFile(file));
            event.target.value = '';
          }}
        />
      </div>
      <p role="status">
        {error || library.error || (busy ? '正在处理游戏包…' : '')}
      </p>
      {library.snapshot.tasks
        .filter((task) => !['complete', 'cancelled'].includes(task.phase))
        .map((task) => (
          <div className="package-management__row" key={task.releaseId}>
            <span>
              {library.snapshot!.catalog.releases.find(
                (r) => r.releaseId === task.releaseId,
              )?.module.catalog.name ?? '游戏包'}{' '}
              ·{' '}
              {task.phase === 'failed'
                ? '失败，可重试'
                : task.phase === 'verifying'
                  ? '校验中'
                  : task.phase === 'installing'
                    ? '安装中'
                    : `下载 ${task.totalBytes ? Math.round((task.transferredBytes / task.totalBytes) * 100) : 0}%`}
            </span>
            <button
              disabled={busy}
              onClick={() =>
                void run(() =>
                  library.manage(
                    task.phase === 'failed' ? 'install' : 'cancel',
                    task.releaseId,
                  ),
                )
              }
            >
              {task.phase === 'failed' ? '重试' : '取消'}
            </button>
          </div>
        ))}
      {library.snapshot.catalog.releases
        .filter((release) => {
          const key = `${release.gameId}:${release.variantId ?? ''}`;
          return (
            library.snapshot!.index.selected[key] &&
            library.snapshot!.index.selected[key] !== release.releaseId
          );
        })
        .map((release) => (
          <div className="package-management__row" key={release.releaseId}>
            <span>
              {release.module.catalog.name}{' '}
              {
                release.module.variants?.find((v) => v.id === release.variantId)
                  ?.name
              }{' '}
              · 可更新
            </span>
            <button
              disabled={busy}
              onClick={() =>
                void run(() => library.manage('install', release.releaseId))
              }
            >
              更新游戏包
            </button>
          </div>
        ))}
      {Object.values(library.snapshot.index.releases).map((release) => (
        <div className="package-management__row" key={release.releaseId}>
          <span>
            {release.module.catalog.name}{' '}
            {
              release.module.variants?.find((v) => v.id === release.variantId)
                ?.name
            }{' '}
            ·{' '}
            {release.releaseTag === 'legacy' ? '保留原包' : release.releaseTag}
          </span>
          <div>
            {library.snapshot!.unavailableReleaseIds.includes(
              release.releaseId,
            ) && (
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => library.manage('install', release.releaseId))
                }
              >
                补装原版本
              </button>
            )}
            <button
              disabled={busy}
              onClick={() =>
                void run(() => library.manage('rollback', release.releaseId))
              }
            >
              设为选局版本
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm('卸载这个版本？存档或对局使用中的版本会保留。')
                )
                  void run(() =>
                    library.manage('uninstall', release.releaseId),
                  );
              }}
            >
              卸载
            </button>
          </div>
        </div>
      ))}
    </details>
  );
}
