import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PublicPackageSnapshot } from '@tablemax/protocol';
import type {
  GameResourceAdapter,
  ResourceEntry,
  ResourceKey,
  ResourceStatus,
} from './resources';
import type { RoomSession } from '../../session/useRoomSession';
// The box and its management panel can request the same trusted refresh.
// Only explicit administrator operations reach the network catalog endpoint.
const catalogRefreshes = new Map<string, Promise<PublicPackageSnapshot>>();
export function useInstalledResources(session: RoomSession) {
  const [snapshot, setSnapshot] = useState<PublicPackageSnapshot | null>(null);
  const snapshotRef = useRef<PublicPackageSnapshot | null>(null);
  const authorizationRef = useRef({
    isHost: session.isHost,
    credential: session.credential,
  });
  const [error, setError] = useState('');
  useEffect(() => {
    authorizationRef.current = {
      isHost: session.isHost,
      credential: session.credential,
    };
  }, [session.isHost, session.credential]);
  const acceptSnapshot = useCallback((next: PublicPackageSnapshot) => {
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  const refresh = useCallback(async () => {
    const response = await fetch('/api/game-packages');
    if (!response.ok) throw new Error('无法读取本机游戏包目录，请重试。');
    const next = (await response.json()) as PublicPackageSnapshot;
    acceptSnapshot(next);
    setError('');
    return next;
  }, [acceptSnapshot]);
  useEffect(() => {
    let active = true;
    const read = () => {
      if (!document.hidden)
        void fetch('/api/game-packages')
          .then(async (response) => {
            if (response.ok && active)
              acceptSnapshot((await response.json()) as PublicPackageSnapshot);
          })
          .catch(() => {});
    };
    read();
    const timer = setInterval(read, 1500);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [acceptSnapshot]);
  const manage = useCallback(
    async (operation: string, releaseId?: string) => {
      if (!session.isHost) throw new Error('unauthorized');
      const execute = async () => {
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
          const reason = result.reason ?? '游戏包操作失败';
          setError(reason);
          throw new Error(reason);
        }
        return refresh();
      };
      if (operation !== 'refresh') return execute();
      const credential = session.credential;
      if (!credential) throw new Error('管理员身份失效，请重新连接。');
      let pending = catalogRefreshes.get(credential);
      if (!pending) {
        pending = execute();
        catalogRefreshes.set(credential, pending);
        const remove = () => {
          if (catalogRefreshes.get(credential) === pending)
            catalogRefreshes.delete(credential);
        };
        void pending.then(remove, remove);
      }
      const next = await pending;
      acceptSnapshot(next);
      return next;
    },
    [session.isHost, session.credential, refresh, acceptSnapshot],
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
      const compatible = release.compatible;
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
        name: release.name,
        status: state,
        ...(available ? { releaseRef: installedRef } : {}),
      });
      if (release.variantId === release.defaultVariantId)
        keys.set(`${release.gameId}:`, {
          key: { gameId: release.gameId },
          name: release.name,
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
        if (!session.isHost || !session.credential)
          throw new Error('仅电脑管理员可以下载游戏包。');
        const administratorCredential = session.credential;
        const findRelease = (current: PublicPackageSnapshot | null) =>
          current?.catalog.releases
            .filter(
              (release) =>
                release.gameId === key.gameId &&
                release.variantId ===
                  (key.variantId ?? release.defaultVariantId),
            )
            .at(-1);
        let release = findRelease(snapshotRef.current);
        if (!release) {
          try {
            const next = await manage('refresh');
            release = findRelease(next);
          } catch (cause) {
            const reason = `无法刷新可信发行目录：${cause instanceof Error ? cause.message : '请检查网络后重试。'}`;
            setError(reason);
            throw new Error(reason, { cause });
          }
        }
        if (!release) {
          const reason =
            '可信目录中暂时没有此玩法的发行包，请稍后重试或导入离线包。';
          setError(reason);
          throw new Error(reason);
        }
        if (!release.compatible) {
          const reason = '此发行包与当前盒子不兼容，请先更新盒子。';
          setError(reason);
          throw new Error(reason);
        }
        if (
          !authorizationRef.current.isHost ||
          authorizationRef.current.credential !== administratorCredential
        )
          throw new Error('管理员身份已变化，请重新下载。');
        await manage('install', release.releaseId);
      },
    }),
    [entries, snapshot, manage, session.isHost, session.credential],
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
