import { useEffect, useState } from 'react';
import type { GameClient } from '@tablemax/web-host';
import { moduleFor } from '../catalog';
export type { GameClient } from '@tablemax/web-host';
const development = import.meta.glob<{ client: GameClient }>(
  '../../../../games/*/web/index.tsx',
);
const loaded = new Map<string, GameClient>();
const pending = new Map<string, Promise<GameClient>>();
export const getGameClient = (id: string) => loaded.get(id);
export function loadGameClient(id: string): Promise<GameClient> {
  if (loaded.has(id)) return Promise.resolve(loaded.get(id)!);
  if (pending.has(id)) return pending.get(id)!;
  const item = moduleFor(id);
  const loader = import.meta.env.PROD
    ? item && (() => loadProduction(item))
    : development['../../../../games/' + id + '/web/index.tsx'];
  if (!loader) return Promise.reject(new Error('此游戏的界面尚未安装。'));
  const request = loader().then(
    ({ client }) => {
      loaded.set(id, client);
      pending.delete(id);
      return client;
    },
    (error: unknown) => {
      pending.delete(id);
      throw error;
    },
  );
  pending.set(id, request);
  return request;
}
export function useGameClient(id: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    id: string;
    client: GameClient | null;
    error: string;
  }>({ id: '', client: null, error: '' });
  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadGameClient(id).then(
      (client) => {
        if (active) setState({ id, client, error: '' });
      },
      () => {
        if (active)
          setState({
            id,
            client: null,
            error: '游戏界面暂时无法加载，请重试。已保存的对局仍保留。',
          });
      },
    );
    return () => {
      active = false;
    };
  }, [id, attempt]);
  return {
    client: state.id === id ? state.client : null,
    error: state.id === id ? state.error : '',
    retry: () => {
      setState({ id: '', client: null, error: '' });
      setAttempt((value) => value + 1);
    },
  };
}

async function loadProduction(
  item: NonNullable<ReturnType<typeof moduleFor>>,
): Promise<{ client: GameClient }> {
  if (item.compatibility.webHost !== 1)
    throw new Error('incompatible-web-host');
  const entry = new URL(item.entries.web, location.origin);
  if (
    entry.origin !== location.origin ||
    !entry.pathname.startsWith('/games/' + item.id + '/web/')
  )
    throw new Error('invalid-web-entry');
  for (const style of item.styles ?? []) {
    const url = new URL(style, location.origin);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith('/games/' + item.id + '/web/')
    )
      throw new Error('invalid-web-style');
    if (
      !document.querySelector('link[data-game-style="' + url.pathname + '"]')
    ) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = url.href;
      link.dataset.gameStyle = url.pathname;
      await new Promise<void>((resolve, reject) => {
        link.onload = () => resolve();
        link.onerror = () => {
          link.remove();
          reject(new Error('style-load-failed'));
        };
        document.head.append(link);
      });
    }
  }
  return import(/* @vite-ignore */ entry.href);
}
