import { moduleFor } from '../catalog';
import type { RoomSession } from '../session/useRoomSession';
import { useEffect, useState } from 'react';
import { gameCover } from '../assets/game-covers';
import { gameIntroduction } from '../game-clients/introductions';
import { ConfirmationDialog } from './ConfirmationDialog';
import { PokemonVersion } from './PokemonVersion';

/** Catalog thumbnails are deliberately separate from the game client bundle. */
export function GameLibrary({
  session,
  close,
  openSeats,
}: {
  session: RoomSession;
  close?: () => void;
  openSeats?: () => void;
}) {
  const { view, isHost, locked, command } = session;
  const [targetId, setTargetId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    gameId: string;
    instanceId: string;
  } | null>(null);
  const target = view?.catalog.find((game) => game.id === targetId);
  useEffect(() => {
    if (
      submitted &&
      view?.game?.id === submitted.gameId &&
      view.instanceId !== submitted.instanceId
    ) {
      close?.();
    }
  }, [submitted, view?.game?.id, view?.instanceId, close]);
  return (
    <section className="game-library" aria-label="游戏库">
      <div>
        <h2>今天玩什么？</h2>
        {!isHost && <p>等待电脑管理员选择游戏。</p>}
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
              {moduleFor(game.id)?.versions && (
                <PokemonVersion session={session} gameId={game.id} />
              )}
              <p className="game-library__tagline">
                {gameIntroduction(game.id)?.tagline}
              </p>
              <span className="game-library__players">
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <circle
                    cx="9"
                    cy="7"
                    r="3"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M3 20v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                {game.min}–{game.max} 人
              </span>
            </div>
            {isHost && (
              <button
                disabled={
                  locked ||
                  view.seats.length > game.max ||
                  view.game?.id === game.id
                }
                onClick={() => {
                  if (view.status === 'playing') {
                    setTargetId(game.id);
                    return;
                  }
                  command({ type: 'select-game', gameId: game.id });
                  setSubmitted({
                    gameId: game.id,
                    instanceId: view.instanceId,
                  });
                }}
              >
                {view.game?.id === game.id
                  ? '已选中'
                  : view.seats.length > game.max
                    ? `最多 ${game.max} 席`
                    : '选择游戏'}
              </button>
            )}
          </article>
        ))}
      </div>
      {view && view.catalog.some((game) => view.seats.length > game.max) && (
        <div className="game-library__conflict">
          <p>人数超过游戏上限时，请先结束对局并调整座位。</p>
          {openSeats && (
            <button type="button" className="secondary" onClick={openSeats}>
              调整座位
            </button>
          )}
        </div>
      )}
      {submitted && !target && <p role="status">{session.message}</p>}
      {target && view && (
        <ConfirmationDialog
          title="结束并切换游戏"
          confirmLabel={view.status === 'playing' ? '结束并切换' : '切换游戏'}
          cancel={() => setTargetId(null)}
          disabled={
            locked ||
            view.seats.length > target.max ||
            view.game?.id === target.id
          }
          confirm={() => {
            command({
              type: 'select-game',
              gameId: target.id,
              ...(view.status === 'playing' ? { endCurrent: true } : {}),
            });
            setSubmitted({ gameId: target.id, instanceId: view.instanceId });
          }}
        >
          <p>
            {view.status === 'playing' ? '结束当前对局，切换到' : '切换到'}{' '}
            {target.name}？
          </p>
          <p>保留朋友们的身份、头像与座位，重新准备后开局。</p>
          {submitted && <p role="status">{session.message}</p>}
        </ConfirmationDialog>
      )}
    </section>
  );
}
