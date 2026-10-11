/* eslint-disable react-refresh/only-export-components -- The resource context and typed adapter are one frontend boundary. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useNotifications } from '../notifications/context';

export type ResourceKey = { gameId: string; variantId?: string };
export type ResourceStatus =
  | { state: 'installed' }
  | { state: 'missing' }
  | { state: 'downloading'; progress?: number }
  | { state: 'failed'; error?: string };
export type ResourceEntry = {
  key: ResourceKey;
  name: string;
  status: ResourceStatus;
};
export interface GameResourceAdapter {
  /** Stable snapshot until the next subscription notification. */
  getSnapshot(): readonly ResourceEntry[];
  subscribe(listener: () => void): () => void;
  download?(key: ResourceKey): Promise<void>;
}
const installed: ResourceStatus = Object.freeze({ state: 'installed' });
const empty: readonly ResourceEntry[] = Object.freeze([]);
export const bundledResources: GameResourceAdapter = {
  getSnapshot: () => empty,
  subscribe: () => () => {},
};
const Resources = createContext(bundledResources);
function useResourceEntries(adapter: GameResourceAdapter) {
  const subscribe = useCallback(
    (listener: () => void) => adapter.subscribe(listener),
    [adapter],
  );
  const snapshot = useCallback(() => adapter.getSnapshot(), [adapter]);
  return useSyncExternalStore(subscribe, snapshot);
}
export const resourceKey = (key: ResourceKey) =>
  JSON.stringify([key.gameId, key.variantId ?? null]);
export function GameResources({
  adapter = bundledResources,
  children,
}: {
  adapter?: GameResourceAdapter;
  children: ReactNode;
}) {
  const entries = useResourceEntries(adapter);
  const previous = useRef<readonly ResourceEntry[]>(entries);
  const notifications = useNotifications();
  useEffect(() => {
    for (const entry of entries) {
      const before = previous.current.find(
        (old) => resourceKey(old.key) === resourceKey(entry.key),
      );
      if (
        before?.status.state === 'downloading' &&
        entry.status.state === 'installed'
      )
        notifications?.show(`${entry.name}资源下载完成`, 'success');
    }
    previous.current = entries;
  }, [entries, notifications]);
  return <Resources.Provider value={adapter}>{children}</Resources.Provider>;
}
export function useGameResource(key: ResourceKey) {
  const adapter = useContext(Resources);
  const entries = useResourceEntries(adapter);
  const status =
    entries.find((entry) => resourceKey(entry.key) === resourceKey(key))
      ?.status ?? installed;
  return {
    status,
    download: adapter.download ? () => adapter.download!(key) : undefined,
  };
}
export function resourceLabel(status: ResourceStatus): string | null {
  switch (status.state) {
    case 'installed':
      return null;
    case 'missing':
      return '下载资源';
    case 'failed':
      return '重试下载';
    case 'downloading':
      return status.progress === undefined
        ? '下载中'
        : `下载中 ${Math.round(Math.max(0, Math.min(1, status.progress)) * 100)}%`;
  }
}
export function ResourceButton({
  resource,
  canDownload,
  disabled = false,
  installedLabel,
  current = false,
  select,
}: {
  resource: ResourceKey;
  canDownload: boolean;
  disabled?: boolean;
  installedLabel: string;
  current?: boolean;
  select(): void;
}) {
  const { status, download } = useGameResource(resource);
  const notifications = useNotifications();
  const label = resourceLabel(status);
  const pending = useRef(false);
  return (
    <button
      type="button"
      data-resource-state={status.state}
      aria-current={current ? 'true' : undefined}
      disabled={
        status.state === 'installed'
          ? disabled
          : !canDownload || !download || status.state === 'downloading'
      }
      onClick={() => {
        if (status.state === 'installed') {
          select();
          return;
        }
        if (!canDownload || !download || pending.current) return;
        pending.current = true;
        void download()
          .catch(() => notifications?.show('资源下载失败，请重试。', 'error'))
          .finally(() => {
            pending.current = false;
          });
      }}
    >
      {label ?? installedLabel}
    </button>
  );
}
