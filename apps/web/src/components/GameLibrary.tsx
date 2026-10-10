import { moduleFor } from '../catalog';
import type { RoomSession } from '../session/useRoomSession';
import { useEffect, useState } from 'react';
import { gameCover } from '../assets/game-covers';
import { gameIntroduction } from '../game-clients/introductions';
import { ConfirmationDialog } from './ConfirmationDialog';
import { PokemonVersion } from './PokemonVersion';
import { feedbackText } from '../content/feedback';
import {
  availableLibraryTags,
  filterLibraryGames,
} from './game-library/filter';
import './game-library/library.css';

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
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [players, setPlayers] = useState<number | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<{
    gameId: string;
    instanceId: string;
  } | null>(null);
  const target = view?.catalog.find((game) => game.id === targetId);
  const games = (view?.catalog ?? []).map((game) => {
    const module = moduleFor(game.id);
    return {
      ...game,
      tags: module?.library?.tags ?? ['未分类'],
      searchTerms: [
        ...(module?.library?.searchTerms ?? []),
        ...(module?.variants?.map((variant) => variant.name) ?? []),
      ],
      tagline: gameIntroduction(game.id)?.tagline ?? '',
      development: module?.development ?? false,
    };
  });
  const tags = availableLibraryTags(games);
  const maximumPlayers = Math.min(
    12,
    Math.max(2, ...games.map((game) => game.max)),
  );
  const visible = filterLibraryGames(games, { query, tag, players });
  const filtered = Boolean(query || tag !== null || players !== null);
  const resetFilters = () => {
    setQuery('');
    setTag(null);
    setPlayers(null);
  };
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
      <div className="game-library__heading">
        <h2>今天玩什么？</h2>
        <span role="status" aria-live="polite">
          {visible.length} / {games.length} 款
        </span>
      </div>
      {!isHost && <p>{feedbackText('library.waitingForHost')}</p>}
      <div
        className="game-library__filters"
        role="search"
        aria-label="筛选游戏"
      >
        <div className="game-library__search-row">
          <label className="game-library__search">
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="10.5" cy="10.5" r="6.5" />
              <path d="m16 16 5 5" />
            </svg>
            <input
              type="search"
              aria-label="搜索游戏"
              placeholder="搜索名称、玩法或分类"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <label className="game-library__player-filter">
            <span>人数</span>
            <select
              aria-label="按人数筛选"
              value={players ?? ''}
              onChange={(event) =>
                setPlayers(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            >
              <option value="">不限</option>
              {Array.from({ length: maximumPlayers - 1 }, (_, i) => i + 2).map(
                (count) => (
                  <option key={count} value={count}>
                    {count} 人
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <div
          className="game-library__categories"
          role="group"
          aria-label="游戏分类"
        >
          <button
            type="button"
            className="secondary"
            aria-pressed={tag === null}
            onClick={() => setTag(null)}
          >
            全部
          </button>
          {tags.map((value) => (
            <button
              type="button"
              className="secondary"
              key={value}
              aria-pressed={tag === value}
              onClick={() => setTag(value)}
            >
              {value}
            </button>
          ))}
          {filtered && (
            <button
              type="button"
              className="secondary game-library__reset"
              onClick={resetFilters}
            >
              重置筛选
            </button>
          )}
        </div>
      </div>
      <div className="game-library__list">
        {visible.map((game) => (
          <article
            className="game-library__item"
            key={game.id}
            data-game-id={game.id}
          >
            {gameCover(game.id) ? (
              <img src={gameCover(game.id)} alt="" width="96" height="120" />
            ) : (
              <span className="game-library__placeholder" aria-hidden="true">
                ⚄
              </span>
            )}
            <div className="game-library__details">
              <h3>{game.name}</h3>
              {moduleFor(game.id)?.versions && (
                <PokemonVersion session={session} gameId={game.id} />
              )}
              <div className="game-library__tags" aria-label="分类标签">
                {game.tags.map((value) => (
                  <span key={value}>{value}</span>
                ))}
              </div>
              <p className="game-library__tagline">{game.tagline}</p>
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
                  game.development ||
                  locked ||
                  (view?.seats.length ?? 0) > game.max ||
                  view?.game?.id === game.id
                }
                onClick={() => {
                  if (game.development || !view) return;
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
                {game.development
                  ? '开发中'
                  : view?.game?.id === game.id
                    ? '已选中'
                    : (view?.seats.length ?? 0) > game.max
                      ? `最多 ${game.max} 席`
                      : '选择游戏'}
              </button>
            )}
          </article>
        ))}
      </div>
      {!visible.length && (
        <div className="game-library__empty" role="status">
          <p>
            {feedbackText(
              games.length ? 'library.noResults' : 'library.emptyCatalog',
            )}
          </p>
          {filtered && (
            <button type="button" className="secondary" onClick={resetFilters}>
              重置筛选
            </button>
          )}
        </div>
      )}
      {view && view.catalog.some((game) => view.seats.length > game.max) && (
        <div className="game-library__conflict">
          <p>{feedbackText('library.seatLimitConflict')}</p>
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
            moduleFor(target.id)?.development ||
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
            {feedbackText(
              view.status === 'playing'
                ? 'library.confirmEndAndSwitch'
                : 'library.confirmSwitch',
              { game: target.name },
            )}
          </p>
          <p>{feedbackText('library.switchPreservesSeats')}</p>
          {submitted && <p role="status">{session.message}</p>}
        </ConfirmationDialog>
      )}
    </section>
  );
}
