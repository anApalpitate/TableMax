import { useContext, type CSSProperties } from 'react';
import type { JsonValue } from '../../../packages/game-sdk/src';
import type { PokemonView } from '../rules/project';
import { SeatResult, TableStatus } from './public';
import { PlayerControls } from './player';
import { SavedMotion, ActionTargets } from './motion';
import { SavedEffects } from './effects';
import { ActivityFeed } from './ActivityFeed';
import type { RoomFeedback } from '../../../packages/protocol/src';

export type TableSeat = {
  id: string;
  name: string;
  controller: 'human' | 'bot';
  online: boolean;
  portrait: string;
  botLabel?: string;
};
export function GameTable({
  game,
  seats,
  selfId,
  names,
  player,
  actions,
  locked,
  paused,
  playing,
  selectionKey,
  choose,
  nextRound,
  playAgain,
  showFriends,
  playMode = 'play',
  feedback = null,
}: {
  game: PokemonView;
  seats: readonly TableSeat[];
  selfId: string | null;
  names: Record<string, string>;
  player: boolean;
  actions: readonly JsonValue[];
  locked: boolean;
  paused: boolean;
  playing: boolean;
  selectionKey: string;
  choose(action: JsonValue): void;
  nextRound?: () => void;
  playAgain?: () => void;
  showFriends(): void;
  playMode?: 'play' | 'test';
  feedback?: RoomFeedback | null;
}) {
  const motion = useContext(SavedMotion);
  const thinkingSeat =
    game.phase === 'initial-flip'
      ? game.seatOrder.find((id) =>
          seats.some(
            (seat) =>
              seat.id === id &&
              seat.controller === 'bot' &&
              !game.initialDone.includes(id),
          ),
        )
      : (game.actorSeat ?? game.turnSeat);
  const latestAction = game.events.at(-1)?.action;
  const targets =
    latestAction?.targets.flatMap(({ seat, slots }) =>
      slots.map((slot) => `${seat}:${slot}`),
    ) ?? [];
  const winners = game.matchWinners.length
    ? game.matchWinners
    : (game.roundResult?.winners ?? []);
  return (
    <ActionTargets.Provider value={targets}>
      <section
        className={`game-table ${game.roundResult ? 'result-table' : ''}`}
        data-seats={seats.length}
        aria-label="游戏牌桌"
      >
        {playMode === 'play' && (
          <SavedEffects
            key={selectionKey}
            game={game}
            feedback={feedback}
            names={names}
          />
        )}
        <ActivityFeed game={game} names={names} />
        {!game.roundResult && (
          <TableStatus
            view={game}
            names={names}
            drawActions={paused || locked ? [] : actions}
            onDraw={selfId ? choose : undefined}
          />
        )}
        {game.roundResult && (
          <section
            className={`round-banner ${motion.includes('@phase') ? 'saved-motion' : ''}`}
            aria-label="本局结果"
          >
            <span className="winner-emblem" aria-hidden="true">
              ✦
            </span>
            <div>
              <p className="eyebrow">
                {game.matchWinners.length
                  ? '三胜达成 · 大局赢家'
                  : `第 ${game.roundNumber} 小局 · 最低分获胜`}
              </p>
              <h2>{winners.map((seat) => names[seat]).join('、')}</h2>
              <p>
                {winners.length > 1
                  ? '并列获胜，一起记一胜。'
                  : '这一胜，属于你。'}
              </p>
            </div>
            {nextRound && (
              <button disabled={locked} onClick={nextRound}>
                开始下一局
              </button>
            )}
            {playAgain && (
              <button disabled={locked} onClick={playAgain}>
                再玩一局
              </button>
            )}
          </section>
        )}
        <div
          className="game-seats"
          style={{ '--seat-count': seats.length } as CSSProperties}
        >
          {seats.map((seat) => (
            <article
              key={seat.id}
              className={`seat game-seat ${playing && !paused && (game.phase === 'initial-flip' ? !game.initialDone.includes(seat.id) : seat.id === (game.actorSeat ?? game.turnSeat)) ? 'active' : ''} ${winners.includes(seat.id) ? 'winner' : ''} ${latestAction?.actor === seat.id ? 'last-actor' : ''}`}
              data-seat={seat.id}
            >
              <div className="seat-heading">
                <img
                  className="avatar"
                  src={seat.portrait}
                  alt=""
                  width={44}
                  height={44}
                />
                <div>
                  <h3>
                    {seat.name}
                    {seat.id === selfId ? ' · 你' : ''}
                  </h3>
                  <p>
                    {seat.controller === 'bot'
                      ? (seat.botLabel ?? '人机')
                      : seat.online
                        ? '手机在线'
                        : '手机离线'}
                    {seat.id === game.actorSeat && !paused ? ' · 正在选择' : ''}
                  </p>
                  {playing &&
                    !paused &&
                    seat.controller === 'bot' &&
                    seat.id === thinkingSeat && (
                      <span className="bot-thinking" role="status">
                        {playMode === 'test' ? '快速决策' : '正在思考'}
                        <span aria-hidden="true">···</span>
                      </span>
                    )}
                </div>
              </div>
              {seat.id === selfId && actions.length && !paused && playing ? (
                <PlayerControls
                  key={`${selectionKey}:${seat.id}`}
                  view={game}
                  seatId={seat.id}
                  names={names}
                  actions={actions}
                  locked={locked}
                  choose={choose}
                />
              ) : (
                <SeatResult view={game} seatId={seat.id} />
              )}
              {player &&
                !actions.length &&
                !paused &&
                playing &&
                !game.roundResult && (
                  <p className="waiting-turn">
                    {game.phase === 'initial-flip'
                      ? '你已翻牌，等朋友们选好。'
                      : `轮到 ${names[game.actorSeat ?? game.turnSeat] ?? '朋友'}，看看桌上的变化。`}
                  </p>
                )}
            </article>
          ))}
        </div>
        {player && (
          <button className="secondary friends-control" onClick={showFriends}>
            看看朋友的牌桌
          </button>
        )}
      </section>
    </ActionTargets.Provider>
  );
}
