import { HostedGame } from '@tablemax/web-host';
import type { GameClient } from '../game-clients/registry';
import type { RoomSession } from '../session/useRoomSession';
import { ScreenLink } from '../components/ScreenLink';

export function GameScreen({
  session,
  client,
  error,
  retry,
}: {
  session: RoomSession;
  client: GameClient | null;
  error: string;
  retry(): void;
}) {
  if (client && session.view?.game) {
    return <HostedGame session={session} client={client} />;
  }
  return (
    <main
      className="shell game-loading"
      aria-busy={!error && Boolean(session.view?.game)}
    >
      <ScreenLink className="button secondary" href={`/${session.role}`}>
        ‹ 盒子
      </ScreenLink>
      <h1>{session.view?.game?.name ?? 'TableMax'}</h1>
      <p role="status">
        {error ||
          (session.view?.game
            ? '正在加载游戏…'
            : session.connected
              ? '请在盒子选择游戏。'
              : '正在重新连接本地服务…')}
      </p>
      {error && <button onClick={retry}>重新加载</button>}
    </main>
  );
}
