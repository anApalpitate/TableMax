import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GameResourceAdapter,
  ResourceEntry,
  ResourceKey,
  ResourceStatus,
} from './resources';
import type { RoomSession } from '../../session/useRoomSession';
import type {
  PackageCatalog,
  InstallIndex,
  PackageTask,
} from '../../../../server/src/game-packages/types';

type Snapshot = {
  catalog: PackageCatalog;
  index: InstallIndex;
  tasks: PackageTask[];
  unavailableReleaseIds: string[];
};
export function useInstalledResources(session: RoomSession) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const response = await fetch('/api/game-packages');
    if (response.ok) {
      setSnapshot((await response.json()) as Snapshot);
      setError('');
    }
  }, []);
  useEffect(() => {
    let active = true;
    const read = () => {
      if (!document.hidden)
        void fetch('/api/game-packages')
          .then(async (response) => {
            if (response.ok && active)
              setSnapshot((await response.json()) as Snapshot);
          })
          .catch(() => {});
    };
    read();
    const timer = setInterval(read, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);
  const manage = useCallback(
    async (operation: string, releaseId?: string) => {
      if (!session.isHost) throw new Error('unauthorized');
      const response = await fetch('/api/game-packages/manage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.credential}`,
        },
        body: JSON.stringify({ operation, releaseId }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        reason?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.reason ?? '游戏包操作失败');
        throw new Error(result.reason);
      }
      await refresh();
    },
    [session.isHost, session.credential, refresh],
  );
  const entries = useMemo<readonly ResourceEntry[]>(() => {
    if (!snapshot) return [];
    const keys = new Map<string, ResourceEntry>();
    for (const release of [
      ...Object.values(snapshot.index.releases),
      ...snapshot.catalog.releases,
    ]) {
      const key = `${release.gameId}:${release.variantId ?? ''}`;
      const installedRef = snapshot.index.selected[key];
      const task = snapshot.tasks.find(
        (t) => t.releaseId === release.releaseId,
      );
      const compatible =
        release.module.compatibility.sdk === 1 &&
        release.module.compatibility.protocol === 7 &&
        release.module.compatibility.webHost === 1;
      const available = Boolean(
        installedRef &&
        snapshot.index.releases[installedRef] &&
        !snapshot.unavailableReleaseIds.includes(installedRef),
      );
      const state: ResourceStatus = !compatible
        ? { state: 'incompatible' }
        : task &&
            ['queued', 'downloading', 'verifying', 'installing'].includes(
              task.phase,
            )
          ? {
              state:
                task.phase === 'verifying'
                  ? 'verifying'
                  : task.phase === 'installing'
                    ? 'installing'
                    : 'downloading',
              progress: task.totalBytes
                ? task.transferredBytes / task.totalBytes
                : 0,
              available,
            }
          : task?.phase === 'failed'
            ? { state: 'failed', available, error: task.error }
            : available
              ? installedRef === release.releaseId
                ? { state: 'installed' }
                : { state: 'update', available: true }
              : { state: 'missing' };
      const resourceKey: ResourceKey = {
        gameId: release.gameId,
        ...(release.variantId ? { variantId: release.variantId } : {}),
      };
      keys.set(key, {
        key: resourceKey,
        name: release.module.catalog.name,
        status: state,
        ...(available ? { releaseRef: installedRef } : {}),
      });
      if (release.variantId === release.module.defaultVariantId)
        keys.set(`${release.gameId}:`, {
          key: { gameId: release.gameId },
          name: release.module.catalog.name,
          status: state,
          ...(available ? { releaseRef: installedRef } : {}),
        });
    }
    for (const entry of [...keys.values()]) {
      if (!entry.key.variantId) continue;
      const available =
        entry.status.state === 'installed' ||
        ('available' in entry.status && entry.status.available);
      const baseKey = `${entry.key.gameId}:`;
      const base = keys.get(baseKey);
      const baseAvailable =
        base?.status.state === 'installed' ||
        (base && 'available' in base.status && base.status.available);
      if (available && !baseAvailable)
        keys.set(baseKey, {
          ...entry,
          key: { gameId: entry.key.gameId },
        });
    }
    return [...keys.values()];
  }, [snapshot]);
  const adapter = useMemo<GameResourceAdapter>(
    () => ({
      getSnapshot: () => entries,
      fallbackStatus:
        snapshot || import.meta.env.PROD
          ? { state: 'missing' }
          : { state: 'installed' },
      subscribe: () => () => {},
      download: async (key) => {
        const release = snapshot?.catalog.releases
          .filter(
            (r) =>
              r.gameId === key.gameId &&
              r.variantId === (key.variantId ?? r.module.defaultVariantId),
          )
          .at(-1);
        if (!release)
          throw new Error('暂时没有可下载的发行包，请刷新目录或导入离线包。');
        await manage('install', release.releaseId);
      },
    }),
    [entries, snapshot, manage],
  );
  return {
    adapter,
    snapshot,
    error,
    manage,
    refresh,
    async importFile(file: Blob) {
      if (!session.isHost) throw new Error('unauthorized');
      const response = await fetch('/api/game-packages/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          Authorization: `Bearer ${session.credential}`,
        },
        body: file,
      });
      const result = (await response.json()) as {
        ok: boolean;
        reason?: string;
      };
      if (!response.ok || !result.ok) {
        setError(result.reason ?? '离线包导入失败');
        return;
      }
      await refresh();
    },
  };
}
