import type { CSSProperties } from 'react';
import type { PowerGridView } from '../types';
import { PLAYER_COLORS } from './labels';

export function TurnOrder({
  view,
  names,
  active,
  compact = false,
}: {
  view: PowerGridView;
  names: Record<string, string>;
  active: boolean;
  compact?: boolean;
}) {
  if (view.phase === 'regions' || view.phase === 'ended') return null;
  const purchasing = ['offer', 'auction', 'replace'].includes(view.phase);
  const reversed = view.phase === 'resources' || view.phase === 'building';
  const order = reversed ? [...view.playerOrder].reverse() : view.playerOrder;
  const currentIndex = order.indexOf(view.actor ?? '');
  const title = purchasing
    ? '购厂发起顺序'
    : view.phase === 'resources'
      ? '燃料购买顺序'
      : view.phase === 'building'
        ? '建城顺序'
        : '发电顺序';
  const note = purchasing
    ? view.phase === 'auction'
      ? '本场按座位顺时针报价'
      : view.phase === 'replace'
        ? '先完成换厂，再继续竞拍'
        : '每轮每人最多买一座电厂'
    : reversed
      ? '按排名逆序，每人完成后再换人'
      : '排名正序';
  const current =
    view.phase === 'auction'
      ? (view.auction?.opener ?? view.actor)
      : view.actor;
  const next =
    view.phase === 'auction'
      ? view.auction?.actor
      : purchasing
        ? order.find(
            (seat) =>
              seat !== current &&
              !view.bought.includes(seat) &&
              !view.passed.includes(seat),
          )
        : order[currentIndex + 1];
  const fullOrder = (
    <ol style={{ '--pg-player-count': order.length } as CSSProperties}>
      {order.map((seat, index) => {
        const rank = view.playerOrder.indexOf(seat) + 1;
        const acting = active && seat === view.actor;
        const completed = !purchasing && index < currentIndex;
        const status = purchasing
          ? view.phase === 'replace' && view.replacement?.buyer === seat
            ? '正在换厂'
            : view.bought.includes(seat)
              ? '已购厂'
              : view.passed.includes(seat)
                ? '本轮不买'
                : view.phase === 'auction'
                  ? seat === view.auction?.actor
                    ? '轮到报价'
                    : seat === view.auction?.highBidder
                      ? '最高价'
                      : view.auction?.passes.includes(seat)
                        ? '已退本场'
                        : '可竞拍'
                  : seat === view.actor
                    ? '轮到发起'
                    : '待购厂'
          : completed
            ? '已完成'
            : seat === view.actor
              ? '当前行动'
              : '等待';
        const done = purchasing
          ? view.bought.includes(seat) || view.passed.includes(seat)
          : completed;
        return (
          <li
            key={seat}
            data-seat={seat}
            className={`${acting ? 'pg-turn-order--acting' : ''}${done ? ' pg-turn-order--done' : ''}`}
            aria-current={acting ? 'step' : undefined}
            style={
              {
                '--pg-player-color':
                  PLAYER_COLORS[view.seatOrder.indexOf(seat)],
              } as CSSProperties
            }
          >
            <span className="pg-order-position">{index + 1}</span>
            <div>
              <strong title={names[seat]}>{names[seat] ?? seat}</strong>
              <div className="pg-order-state">
                <span>排名{rank}</span>
                <span>
                  {!active && seat === view.actor ? '等待继续' : status}
                </span>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
  return (
    <section
      className={`pg-turn-order${compact ? ' pg-turn-order--compact' : ''}`}
      aria-label={title}
    >
      {compact ? (
        <details className="pg-turn-order-details">
          <summary>
            <span className="pg-order-compact-title">
              <strong>{title}</strong>
              <span>完整顺序</span>
            </span>
            {view.phase !== 'auction' && (
              <span className="pg-order-preview">
                <span>
                  <span>
                    {view.phase === 'replace'
                      ? active
                        ? '正在换厂'
                        : '待完成换厂'
                      : view.phase === 'offer'
                        ? '轮到选厂'
                        : '当前'}
                  </span>
                  <strong>
                    {current ? (names[current] ?? current) : '等待'}
                  </strong>
                </span>
                <span>
                  <span>
                    {view.phase === 'replace'
                      ? '待选厂'
                      : view.phase === 'offer'
                        ? '后续顺位'
                        : '下一家'}
                  </span>
                  <strong>
                    {next ? (names[next] ?? next) : '本阶段最后一家'}
                  </strong>
                </span>
              </span>
            )}
          </summary>
          <p className="pg-order-note">{note}</p>
          {fullOrder}
        </details>
      ) : (
        <>
          <header>
            <h2>{title}</h2>
            <span>{note}</span>
          </header>
          {fullOrder}
        </>
      )}
    </section>
  );
}
