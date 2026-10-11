import { useEffect, useState } from 'react';
import {
  projectGameDetails,
  type GameDetails,
} from '@tablemax/game-sdk/metadata';
import type { ModuleManifest } from '@tablemax/game-sdk/module-manifest';

const development = import.meta.glob<ModuleManifest>(
  '../../../../games/*/game-module.json',
  { import: 'default' },
);
const cached = new Map<string, GameDetails>();
const pending = new Map<string, Promise<GameDetails>>();
const detailsKey = (id: string, releaseRef?: string) =>
  `${id}:${releaseRef ?? 'source'}`;

export function loadGameDetails(
  id: string,
  releaseRef?: string,
): Promise<GameDetails> {
  const key = detailsKey(id, releaseRef);
  if (cached.has(key)) return Promise.resolve(cached.get(key)!);
  if (pending.has(key)) return pending.get(key)!;
  const request = (async () => {
    let details: GameDetails;
    if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new Error('invalid-game-id');
    if (releaseRef || import.meta.env.PROD) {
      if (releaseRef && !/^[a-f0-9]{64}$/.test(releaseRef))
        throw new Error('invalid-release');
      const response = await fetch(
        releaseRef
          ? `/api/game-packages/releases/${releaseRef}/details`
          : `/games/${id}/web/details.json`,
      );
      if (!response.ok) throw new Error('missing-game-details');
      details = (await response.json()) as GameDetails;
    } else {
      const loader = development[`../../../../games/${id}/game-module.json`];
      if (!loader) throw new Error('missing-game-details');
      details = projectGameDetails(await loader());
    }
    if (details.schemaVersion !== 1 || details.id !== id)
      throw new Error('incompatible-game-details');
    cached.set(key, details);
    return details;
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

export function useGameDetails(id?: string, releaseRef?: string) {
  const key = id ? detailsKey(id, releaseRef) : '';
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    key: string;
    details?: GameDetails;
    error?: string;
  }>({ key: '' });
  useEffect(() => {
    if (!id) return;
    let active = true;
    void loadGameDetails(id, releaseRef).then(
      (details) => {
        if (active) setState({ key, details });
      },
      () => {
        if (active) setState({ key, error: '游戏说明暂时无法加载，请重试。' });
      },
    );
    return () => {
      active = false;
    };
  }, [id, releaseRef, key, attempt]);
  return {
    details: cached.get(key) ?? (state.key === key ? state.details : undefined),
    error: state.key === key ? state.error : undefined,
    retry: () => {
      setState({ key: '' });
      setAttempt((value) => value + 1);
    },
  };
}
