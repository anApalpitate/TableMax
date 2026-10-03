import type { RoomSession } from '../session/useRoomSession';
import { gameCover } from '../assets/game-covers';

/** Catalog thumbnails are deliberately separate from the game client bundle. */
export function GameLibrary({
  session,
  close,
}: {
  session: RoomSession;
  close?: () => void;
}) {
  const { view, isHost, locked, command } = session;
  return (
    <section className="game-library" aria-label="游戏库">
      <div>
        <h2>今天玩什么？</h2>
        <p>
          {isHost ? '选好游戏，再邀请朋友们入座。' : '等待电脑管理员选择游戏。'}
        </p>
      </div>
      <div className="game-library__list">
        {view?.catalog.map((game) => (
          <article className="game-library__item" key={game.id}>
            {gameCover(game.id) ? (
              <img src={gameCover(game.id)} alt="" width="96" height="120" />
            ) : (
              <span className="game-library__placeholder" aria-hidden="true">
                ⚄
              </span>
            )}
            <div>
              <h3>{game.name}</h3>
              <p>
                {game.min}–{game.max} 位玩家 · 本地游玩
              </p>
            </div>
            {isHost && (
              <button
                disabled={
                  locked ||
                  view.status === 'playing' ||
                  view.game?.id === game.id
                }
                onClick={() => {
                  command({ type: 'select-game', gameId: game.id });
                  close?.();
                }}
              >
                {view.game?.id === game.id ? '已选中' : '选择游戏'}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
