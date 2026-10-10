import { useLayoutEffect, useRef, type CSSProperties } from 'react';
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
  const container = useRef<HTMLDivElement>(null);
  const seatIdentity = game.seatOrder.join('|');
  useLayoutEffect(() => {
    if (compact || !container.current) return;
    const root = container.current;
    const place = () => {
      const bounds = root.getBoundingClientRect();
      const central = [
        ...(root.parentElement?.querySelectorAll(
          '.uno-piles .uno-card,.uno-pile-label,.uno-active-color,.uno-table-pending',
        ) ?? []),
      ].map((element) => element.getBoundingClientRect());
      const pile = central.length
        ? {
            left: Math.min(...central.map((rect) => rect.left)),
            right: Math.max(...central.map((rect) => rect.right)),
            top: Math.min(...central.map((rect) => rect.top)),
            bottom: Math.max(...central.map((rect) => rect.bottom)),
          }
        : null;
      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(max, value));
      [...root.querySelectorAll<HTMLElement>('.uno-seat')].forEach(
        (seat, index, all) => {
          const angle = (index / all.length) * Math.PI * 2 - Math.PI / 2;
          const halfW = seat.offsetWidth / 2,
            halfH = seat.offsetHeight / 2;
          const minX = halfW + 12,
            maxX = bounds.width - halfW - 12;
          const minY = halfH + 12,
            maxY = bounds.height - halfH - 12;
          let x = clamp(
            bounds.width * (0.5 + Math.sin(angle) * 0.44),
            minX,
            maxX,
          );
          let y = clamp(
            bounds.height * (0.5 - Math.cos(angle) * 0.43),
            minY,
            maxY,
          );
          if (pile) {
            const left = pile.left - bounds.left - 16 - halfW;
            const right = pile.right - bounds.left + 16 + halfW;
            const top = pile.top - bounds.top - 16 - halfH;
            const bottom = pile.bottom - bounds.top + 16 + halfH;
            if (x > left && x < right && y > top && y < bottom) {
              const options = [
                { x: left, y },
                { x: right, y },
                { x, y: top },
                { x, y: bottom },
              ]
                .filter(
                  (point) =>
                    point.x >= minX &&
                    point.x <= maxX &&
                    point.y >= minY &&
                    point.y <= maxY,
                )
                .sort(
                  (a, b) =>
                    Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
                );
              if (options[0]) ({ x, y } = options[0]);
            }
          }
          seat.style.setProperty('--seat-x', `${x}px`);
          seat.style.setProperty('--seat-y', `${y}px`);
        },
      );
    };
    const observer = new ResizeObserver(place);
    observer.observe(root);
    root
      .querySelectorAll('.uno-seat')
      .forEach((seat) => observer.observe(seat));
    place();
    return () => observer.disconnect();
  }, [compact, seatIdentity, game.stage]);
  const seatsById = new Map(seats.map((seat) => [seat.id, seat]));
  return (
    <div
      ref={container}
      className={`uno-seats${compact ? ' uno-seats--compact' : ''}`}
      aria-label="围桌玩家"
    >
      {game.seatOrder.map((id, index) => {
        const seat = seatsById.get(id);
        const player = game.players[id]!;
        const angle =
          (index / game.seatOrder.length) * Math.PI * 2 - Math.PI / 2;
        const position = {
          '--seat-x': `${50 + Math.sin(angle) * 44}%`,
          '--seat-y': `${50 - Math.cos(angle) * 43}%`,
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

export function Leaderboard({
  game,
  seats,
}: {
  game: UnoView;
  seats: NonNullable<GameHost['view']>['seats'];
}) {
  const order = [...game.seatOrder].sort(
    (a, b) => game.players[b]!.score - game.players[a]!.score,
  );
  return (
    <ol className="uno-leaderboard" aria-label="累计积分榜">
      {order.map((id, index) => {
        const seat = seats.find((entry) => entry.id === id);
        const score = game.players[id]!.score;
        const rank =
          order.findIndex((other) => game.players[other]!.score === score) + 1;
        return (
          <li key={id} data-rank={rank}>
            <b className="uno-rank">{rank}</b>
            <img src={avatarFor(seat?.avatarId ?? 'avatar-1')} alt="" />
            <strong>{seat?.name ?? `玩家 ${index + 1}`}</strong>
            <span>
              <b>{score}</b> 分 · {game.players[id]!.handCount} 张
            </span>
          </li>
        );
      })}
    </ol>
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
