import { useEffect, useState, type ComponentType } from 'react';
import type { RoomSession } from '../session/useRoomSession';

export interface GameClient {
  Screen: ComponentType<{ session: RoomSession }>;
  savedChanges(before: unknown, after: unknown): string[];
  motionDuration: number;
}
const loaders: Record<string, () => Promise<{ client: GameClient }>> = {
  'modern-art': () => import('./ModernArtScreen'),
  'pokemon-encounters': () => import('./PokemonScreen'),
  template: () => import('./TemplateScreen'),
};
const loaded = new Map<string, GameClient>();
const pending = new Map<string, Promise<GameClient>>();
export const getGameClient = (id: string) => loaded.get(id);
export function loadGameClient(id: string): Promise<GameClient> {
  if (loaded.has(id)) return Promise.resolve(loaded.get(id)!);
  if (pending.has(id)) return pending.get(id)!;
  const loader = loaders[id];
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
