/* eslint-disable react-refresh/only-export-components -- The resource context and typed adapter are one frontend boundary. */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { useNotifications } from '../notifications/context';
import { packageErrorMessage } from './package-errors';

export type ResourceKey = { gameId: string; variantId?: string };
export type ResourceStatus =
  | { state: 'installed' }
  | { state: 'update'; available: true }
  | { state: 'incompatible'; error?: string }
  | {
      state: 'verifying' | 'installing';
      progress?: number;
      available?: boolean;
    }
  | { state: 'missing' }
  | { state: 'downloading'; progress?: number; available?: boolean }
  | { state: 'failed'; error?: string | undefined; available?: boolean };
export type ResourceEntry = {
  key: ResourceKey;
  name: string;
  status: ResourceStatus;
  releaseRef?: string;
};
export interface GameResourceAdapter {
  /** Stable snapshot until the next subscription notification. */
  getSnapshot(): readonly ResourceEntry[];
  subscribe(listener: () => void): () => void;
  download?(key: ResourceKey): Promise<void>;
  fallbackStatus?: ResourceStatus;
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
    const completed = new Set<string>();
    for (const entry of entries) {
      const before = previous.current.find(
        (old) => resourceKey(old.key) === resourceKey(entry.key),
      );
      if (
        before &&
        ['downloading', 'verifying', 'installing'].includes(
          before.status.state,
        ) &&
        entry.status.state === 'installed'
      ) {
        const completionKey = entry.releaseRef ?? resourceKey(entry.key);
        if (!completed.has(completionKey))
          notifications?.show(`${entry.name}资源下载完成`, 'success');
        completed.add(completionKey);
      }
    }
    previous.current = entries;
  }, [entries, notifications]);
  return <Resources.Provider value={adapter}>{children}</Resources.Provider>;
}
export function useGameResource(key: ResourceKey) {
  const adapter = useContext(Resources);
  const entries = useResourceEntries(adapter);
  const entry = entries.find(
    (entry) => resourceKey(entry.key) === resourceKey(key),
  );
  const status = entry?.status ?? adapter.fallbackStatus ?? installed;
  return {
    status,
    releaseRef: entry?.releaseRef,
    download: adapter.download ? () => adapter.download!(key) : undefined,
  };
}
export function resourceLabel(status: ResourceStatus): string | null {
  switch (status.state) {
    case 'installed':
      return null;
    case 'update':
      return '可更新';
    case 'incompatible':
      return '不兼容';
    case 'verifying':
      return '校验中';
    case 'installing':
      return '安装中';
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
  currentReleaseRef,
  select,
}: {
  resource: ResourceKey;
  canDownload: boolean;
  disabled?: boolean;
  installedLabel: string;
  current?: boolean;
  currentReleaseRef?: string | undefined;
  select(): void;
}) {
  const { status, releaseRef, download } = useGameResource(resource);
  const sameCurrent =
    current && (!releaseRef || releaseRef === currentReleaseRef);
  const notifications = useNotifications();
  const label = resourceLabel(status);
  const available =
    status.state === 'installed' || ('available' in status && status.available);
  const busy = ['downloading', 'verifying', 'installing'].includes(
    status.state,
  );
  const progress = 'progress' in status ? status.progress : undefined;
  const pending = useRef(false);
  return (
    <>
      <button
        type="button"
        data-resource-state={status.state}
        style={
          progress === undefined
            ? undefined
            : ({
                '--download-progress': `${Math.max(0, Math.min(1, progress)) * 100}%`,
                backgroundImage:
                  'linear-gradient(to right, #8abb6c var(--download-progress), #edf2df var(--download-progress))',
              } as CSSProperties)
        }
        aria-busy={busy}
        aria-current={sameCurrent ? 'true' : undefined}
        disabled={
          available
            ? disabled || sameCurrent
            : !canDownload ||
              !download ||
              busy ||
              status.state === 'incompatible'
        }
        onClick={() => {
          if (available) {
            select();
            return;
          }
          if (!canDownload || !download || pending.current) return;
          pending.current = true;
          void download()
            .catch((cause) =>
              notifications?.show(
                `资源下载失败：${packageErrorMessage(cause)}`,
                'error',
              ),
            )
            .finally(() => {
              pending.current = false;
            });
        }}
      >
        {available
          ? installedLabel +
            (sameCurrent ? ' · 已选中' : '') +
            (busy ? ` · ${label}` : '')
          : (label ?? installedLabel)}
      </button>
      {(status.state === 'incompatible' || status.state === 'failed') &&
        status.error && (
          <p className="game-resource-error" role="status">
            {packageErrorMessage(status.error)}
          </p>
        )}
    </>
  );
}

export function ResourceStatusLabel({ resource }: { resource: ResourceKey }) {
  const { status } = useGameResource(resource);
  const available =
    status.state === 'installed' || ('available' in status && status.available);
  const label =
    status.state === 'missing'
      ? '未安装'
      : status.state === 'failed'
        ? '下载失败，等待管理员重试'
        : (resourceLabel(status) ?? '已安装');
  return (
    <span role="status" data-resource-state={status.state}>
      {available && status.state !== 'installed' ? '可用 · ' : ''}
      {label}
      {(status.state === 'incompatible' || status.state === 'failed') &&
      status.error
        ? `：${packageErrorMessage(status.error)}`
        : ''}
    </span>
  );
}
