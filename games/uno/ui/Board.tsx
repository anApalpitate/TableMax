import type { CSSProperties } from 'react';
import { avatarFor } from '@tablemax/web-host';
import type { GameHost } from '@tablemax/web-host';
import type { UnoView } from '../types';
import { Card } from './Card';
import { colorNames } from './Hand';

export function Seats({
  game,
  seats,
  compact = false,
}: {
  game: UnoView;
  seats: NonNullable<GameHost['view']>['seats'];
  compact?: boolean;
}) {
  const seatsById = new Map(seats.map((seat) => [seat.id, seat]));
  return (
    <div
      className={`uno-seats${compact ? ' uno-seats--compact' : ''}`}
      aria-label="围桌玩家"
    >
      {game.seatOrder.map((id, index) => {
        const seat = seatsById.get(id);
        const player = game.players[id]!;
        const angle =
          (index / game.seatOrder.length) * Math.PI * 2 - Math.PI / 2;
        const position = {
          '--seat-x': `${50 + Math.sin(angle) * 37}%`,
          '--seat-y': `${50 - Math.cos(angle) * 36}%`,
        } as CSSProperties;
        return (
          <article
            data-seat-id={id}
            style={position}
            key={id}
            className={`uno-seat${game.turnSeat === id ? ' uno-seat--current' : ''}${game.self?.seatId === id ? ' uno-seat--self' : ''}`}
          >
            <div className="uno-seat-avatar">
              <img src={avatarFor(seat?.avatarId ?? 'avatar-1')} alt="" />
              <span className="uno-seat-number">{index + 1}</span>
              {player.handCount === 1 && (
                <span className="uno-seat-uno">
                  {player.uno ? 'UNO!' : '1 张'}
                </span>
              )}
            </div>
            <div className="uno-seat-info">
              <strong title={seat?.name}>
                {seat?.name ?? `玩家 ${index + 1}`}
              </strong>
              <span>
                <b>{player.handCount}</b> 张{' '}
                <span className="uno-seat-points">{player.score} 分</span>
              </span>
            </div>
            <div className="uno-mini-hand" aria-hidden="true">
              {Array.from(
                { length: Math.min(player.handCount, 5) },
                (_, card) => (
                  <Card key={card} back />
                ),
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}

export function Board({
  game,
  seats,
  player,
}: {
  game: UnoView;
  seats: NonNullable<GameHost['view']>['seats'];
  player: boolean;
}) {
  return (
    <section
      className={`uno-table${player ? ' uno-table--player' : ''}`}
      aria-label="公开牌桌"
    >
      {!player && <Seats game={game} seats={seats} />}
      <div
        className={`uno-play-direction uno-play-direction--${game.direction === 1 ? 'clockwise' : 'counterclockwise'}`}
        aria-label={game.direction === 1 ? '顺时针行牌' : '逆时针行牌'}
      >
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <path d="M45 59a72 72 0 0 1 118 1M159 139a72 72 0 0 1-118 0" />
          <path d="m146 57 21 4-4-21m-9 103-21-4 4 21" />
        </svg>
      </div>
      <div className="uno-piles">
        <div className="uno-pile uno-draw-pile">
          <span className="uno-pile-layer uno-pile-layer--one">
            <Card back />
          </span>
          <span className="uno-pile-layer uno-pile-layer--two">
            <Card back />
          </span>
          <Card back />
          <span className="uno-pile-label">
            牌库 <strong>{game.drawCount}</strong>
          </span>
        </div>
        <div className="uno-pile uno-discard-pile">
          <span className="uno-pile-layer uno-pile-layer--one">
            <Card back />
          </span>
          <span className="uno-pile-layer uno-pile-layer--two">
            <Card back />
          </span>
          <Card card={game.topCard} />
          <span className="uno-pile-label">弃牌堆</span>
        </div>
      </div>
      <div
        className={`uno-active-color uno-active-color--${game.activeColor ?? 'wild'}`}
      >
        <span aria-hidden="true">
          {game.activeColor === 'red'
            ? '●'
            : game.activeColor === 'yellow'
              ? '▲'
              : game.activeColor === 'green'
                ? '■'
                : game.activeColor === 'blue'
                  ? '◆'
                  : '◆'}
        </span>
        {game.activeColor ? `跟${colorNames[game.activeColor]}` : '等待选色'}
      </div>
      {game.drawFour && <div className="uno-table-pending">+4 待回应</div>}
    </section>
  );
}
