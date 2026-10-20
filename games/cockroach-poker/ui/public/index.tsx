import type { PokerView } from '../view';
import type { ReactNode } from 'react';
import { kinds, kindOf, names } from '../../rules/cards';
import { Card, Critter, asset } from '../Theme';
export function Table({
  game,
  names: players,
  children,
}: {
  game: PokerView;
  names: Record<string, string>;
  children?: ReactNode;
}) {
  const o = game.offer;
  return (
    <>
      <section className="cp-stage" aria-label="当前传牌">
        <div className="cp-orbit" aria-hidden="true">
          ✦
        </div>
        {o ? (
          <>
            <Critter kind={o.claim} />
            <h2>
              {players[o.sender]} 声称：{names[o.claim]}
            </h2>
            <p className="cp-main-status">
              <span>交给 {players[o.target]}</span>
              <span>
                {o.passing
                  ? '已查看，须转传'
                  : game.seats.length === 2 ||
                      o.seen.length === game.seats.length - 1
                    ? '必须判断真假'
                    : '判断或查看转传'}
              </span>
            </p>
            <details className="cp-route">
              <summary>
                流转记录 <span>{o.route.length} 次传牌</span>
              </summary>
              <p>
                {o.route
                  .map(
                    (r) =>
                      `${players[r.sender]} → ${players[r.target]}：${names[r.claim]}`,
                  )
                  .join(' / ')}
              </p>
            </details>
          </>
        ) : game.loser ? (
          <>
            <h2>共同获胜</h2>
            <p className="cp-main-status">
              {game.winners.map((s) => players[s]).join('、')}
            </p>
            <p>{players[game.loser]} 失败</p>
          </>
        ) : (
          <>
            <img className="cp-back" src={asset('back.svg')} alt="虫虫牌背" />
            <h2>{players[game.turn]} 出牌</h2>
            <p>选择一张牌、一名对手与一种声明</p>
          </>
        )}
      </section>
      {children}
      <section className="cp-players" aria-label="公开收牌区">
        {game.seats.map((s) => (
          <article
            key={s}
            className={`cp-seat ${(o?.target ?? game.turn) === s && !game.loser ? 'cp-active' : ''}`}
          >
            <h3>{players[s]}</h3>
            <div className="cp-seat-stats">
              <span>手牌 {game.handCounts[s]}</span>
              <span>收牌 {game.piles[s]!.length}</span>
            </div>
            <div className="cp-collection">
              {kinds.map((k) => {
                const n = game.piles[s]!.filter((c) => kindOf(c) === k).length;
                return n ? (
                  <div key={k}>
                    <Critter kind={k} />
                    <span>
                      {names[k]}{' '}
                      <strong>
                        {n}/{game.threshold}
                      </strong>
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          </article>
        ))}
      </section>
      {game.last && (
        <aside className="cp-last">
          <Card card={game.last.card} />
          <p>最近揭晓：{players[game.last.collector]} 收下此牌。</p>
        </aside>
      )}
    </>
  );
}
