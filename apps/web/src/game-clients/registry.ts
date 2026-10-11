import { useEffect, useState } from 'react';
import type { GameClient } from '@tablemax/web-host';
import { moduleFor } from '../catalog';
import { activateGameStyles, loadGameStyle } from './styles';
export type { GameClient } from '@tablemax/web-host';
type ClientExports = {
  client: GameClient;
  clientsByVariant?: Record<string, GameClient>;
};
const development = import.meta.glob<ClientExports>(
  '../../../../games/*/web/index.tsx',
);
const loaded = new Map<string, GameClient>();
const pending = new Map<string, Promise<GameClient>>();
const clientKey = (id: string, variantId?: string, releaseRef?: string) =>
  `${id}:${variantId ?? ''}:${releaseRef ?? 'source'}`;
export const getGameClient = (
  id: string,
  variantId?: string,
  releaseRef?: string,
) => loaded.get(clientKey(id, variantId, releaseRef));
export function loadGameClient(
  id: string,
  variantId?: string,
  releaseRef?: string,
): Promise<GameClient> {
  const key = clientKey(id, variantId, releaseRef);
  if (loaded.has(key)) return Promise.resolve(loaded.get(key)!);
  if (pending.has(key)) return pending.get(key)!;
  const item = moduleFor(id);
  const loader = releaseRef
    ? () => loadRelease(releaseRef, id)
    : import.meta.env.PROD
      ? item && (() => loadProduction(item))
      : development['../../../../games/' + id + '/web/index.tsx'];
  if (!loader) return Promise.reject(new Error('此游戏的界面尚未安装。'));
  const request = loader()
    .then(({ client: originalClient, clientsByVariant }) => {
      const client =
        variantId === undefined
          ? originalClient
          : clientsByVariant?.[variantId];
      if (!client) throw new Error('incompatible-game-variant');
      loaded.set(key, client);
      pending.delete(key);
      return client;
    })
    .catch((error: unknown) => {
      pending.delete(key);
      throw error;
    });
  pending.set(key, request);
  return request;
}
export function useGameClient(
  id: string | undefined,
  variantId?: string,
  releaseRef?: string,
) {
  const key = id ? clientKey(id, variantId, releaseRef) : undefined;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    id: string;
    client: GameClient | null;
    error: string;
  }>({ id: '', client: null, error: '' });
  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadGameClient(id, variantId, releaseRef).then(
      (client) => {
        if (active) {
          activateGameStyles(
            releaseRef
              ? `/game-packages/${releaseRef}/web/`
              : `/games/${id}/web/`,
          );
          setState({ id: key!, client, error: '' });
        }
      },
      () => {
        if (active)
          setState({
            id: key!,
            client: null,
            error: '游戏界面暂时无法加载，请重试。已保存的对局仍保留。',
          });
      },
    );
    return () => {
      active = false;
    };
  }, [id, key, variantId, releaseRef, attempt]);
  return {
    client: state.id === key ? state.client : null,
    error: state.id === key ? state.error : '',
    retry: () => {
      setState({ id: '', client: null, error: '' });
      setAttempt((value) => value + 1);
    },
  };
}

async function loadProduction(
  item: NonNullable<ReturnType<typeof moduleFor>>,
): Promise<ClientExports> {
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
    await loadGameStyle(url);
  }
  return import(/* @vite-ignore */ entry.href);
}

async function loadRelease(
  ref: string,
  gameId: string,
): Promise<ClientExports> {
  if (!/^[a-f0-9]{64}$/.test(ref)) throw new Error('invalid-release');
  const response = await fetch(`/api/game-packages/releases/${ref}`);
  if (!response.ok) throw new Error('missing-game-release');
  const item = (await response.json()) as {
    gameId: string;
    module: NonNullable<ReturnType<typeof moduleFor>>;
  };
  if (item.gameId !== gameId || item.module.compatibility.webHost !== 1)
    throw new Error('incompatible-web-host');
  const prefix = `/game-packages/${ref}/`;
  const local = (path: string) => {
    const url = new URL(prefix + path, location.origin);
    if (
      url.origin !== location.origin ||
      !url.pathname.startsWith(prefix + 'web/')
    )
      throw new Error('invalid-web-entry');
    return url;
  };
  for (const style of item.module.styles ?? [])
    await loadGameStyle(local(style));
  return import(/* @vite-ignore */ local(item.module.entries.web).href);
}
