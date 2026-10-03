import type { CSSProperties } from 'react';
import type { ModernArtLog, ModernArtView } from '../view';
import { ArtCard } from '../ArtCard';
import { auctionNames, auctionMarks, money } from './labels';

function paintingsLabel(view: ModernArtView, entry: ModernArtLog) {
  return entry.cards
    .map(
      (card) =>
        `${view.artists.find((a) => a.id === card.artistId)?.name.split(' ')[0] ?? card.artistId} · ${card.title}`,
    )
    .join(' + ');
}

export function SavedAction({
  view,
  names,
}: {
  view: ModernArtView;
  names: Record<string, string>;
}) {
  const entry = view.latest;
  if (!entry) return null;
  return (
    <div className="ma-latest" aria-live="polite">
      <span>已保存</span>
      <div className="ma-latest__copy">
        <p>
          <strong>
            {entry.actor ? (names[entry.actor] ?? '玩家') : '拍卖行'}
          </strong>{' '}
          · {entry.text}
        </p>
        {(entry.cards.length > 0 || entry.winner) && (
          <p className="ma-latest__details">
            {paintingsLabel(view, entry)}
            {entry.winner && (
              <strong> → {names[entry.winner] ?? '玩家'}</strong>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function MarketBoard({ view }: { view: ModernArtView }) {
  const settled = view.phase === 'round-result' || view.phase === 'ended';
  return (
    <section className="ma-market" aria-label="艺术家估值板">
      <div className="ma-section-heading">
        <h2>艺术市场</h2>
        <span>{settled ? '本轮结算价' : '当前估值 · 预估'}</span>
      </div>
      <div className="ma-market__columns">
        {view.artists.map((artist) => (
          <div
            key={artist.id}
            className="ma-artist"
            style={{ '--ma-artist': artist.color } as CSSProperties}
          >
            <div className="ma-artist__swatch" aria-hidden="true" />
            <h3>{artist.name}</h3>
            <div className="ma-artist__count">
              <strong>{artist.playedCount}</strong>
              <span> / 5 张</span>
            </div>
            <div className="ma-artist__pips" aria-hidden="true">
              {Array.from({ length: 5 }, (_, n) => (
                <i
                  key={n}
                  className={n < artist.playedCount ? 'ma-filled' : ''}
                />
              ))}
            </div>
            <strong className="ma-artist__value">{artist.currentValue}</strong>
            <span className="ma-artist__unit">千元 / 张</span>
            <div
              className="ma-artist__history"
              aria-label={`${artist.name}各轮价格标记`}
            >
              {Array.from({ length: 4 }, (_, n) => (
                <span
                  key={n}
                  className={n < artist.history.length ? 'ma-complete' : ''}
                >
                  <small>{n + 1}</small>
                  <b>{artist.history[n] ?? '—'}</b>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="ma-market__supply">
        <span>牌库 {view.deckCount} 张</span>
        <span>弃牌 {view.discardCount} 张</span>
      </div>
    </section>
  );
}

export function AuctionStage({
  view,
  names,
}: {
  view: ModernArtView;
  names: Record<string, string>;
}) {
  const auction = view.auction;
  const actor = view.turnSeat ? (names[view.turnSeat] ?? '玩家') : '';
  if (!auction)
    return (
      <section className="ma-auction ma-auction--waiting" aria-label="拍卖台">
        <span className="ma-gavel" aria-hidden="true">
          <svg width="64" height="64" viewBox="0 0 64 64">
            <g fill="currentColor" transform="rotate(-35 32 30)">
              <rect x="17" y="9" width="30" height="14" rx="3" />
              <rect x="14" y="7" width="6" height="18" rx="2" />
              <rect x="44" y="7" width="6" height="18" rx="2" />
              <rect x="28" y="22" width="8" height="30" rx="3" />
            </g>
            <path d="M8 57h33v5H8z" fill="currentColor" />
          </svg>
        </span>
        <span className="ma-kicker">MODERN ART · AUCTION HOUSE</span>
        <h2>
          {view.phase === 'offer' ? `${actor} 正在选画` : '本轮拍卖已结束'}
        </h2>
        <p>{view.phase === 'offer' ? '等待新画作上拍' : '画作已完成结算'}</p>
      </section>
    );
  const title =
    view.phase === 'double' ? '征集第二幅画作' : auctionNames[auction.kind];
  const price = auction.fixedPrice ?? auction.currentBid;
  return (
    <section className="ma-auction" aria-label="拍卖台">
      <div className="ma-auction__label">
        <span className="ma-auction__mark" aria-hidden="true">
          {auctionMarks[auction.kind]}
        </span>
        <div>
          <span className="ma-kicker">正在上拍</span>
          <h2>{title}</h2>
          <p>拍卖人 · {names[auction.seller] ?? '玩家'}</p>
        </div>
      </div>
      <div className="ma-auction__paintings">
        {auction.cards.map((card) => (
          <ArtCard
            key={card.id}
            card={card}
            artist={view.artists.find((a) => a.id === card.artistId)}
          />
        ))}
      </div>
      <div className="ma-auction__price">
        <span>
          {auction.kind === 'sealed'
            ? '暗标进度'
            : auction.fixedPrice !== null
              ? '一口价'
              : '当前最高出价'}
        </span>
        <strong>
          {auction.kind === 'sealed'
            ? `${auction.submitted.length} / ${view.seatOrder.length}`
            : money(price)}
        </strong>
        <small>
          {auction.kind === 'sealed'
            ? '提交金额将在揭标时公开'
            : auction.highBidder
              ? `${names[auction.highBidder] ?? '玩家'} 领拍`
              : view.phase === 'double'
                ? '等待同艺术家的另一幅画'
                : auction.kind === 'fixed' && auction.fixedPrice === null
                  ? '等待拍卖人定价'
                  : '尚无出价'}
        </small>
      </div>
      <div className="ma-auction__participants" aria-label="拍卖参与状态">
        {view.seatOrder.map((seat) => (
          <span
            key={seat}
            className={auction.actingSeats.includes(seat) ? 'ma-active' : ''}
          >
            {names[seat] ?? '玩家'}
            {auction.submitted.includes(seat)
              ? ' · 已提交'
              : auction.passes.includes(seat)
                ? ' · 已放弃'
                : auction.actingSeats.includes(seat)
                  ? ' · 可行动'
                  : ''}
          </span>
        ))}
      </div>
    </section>
  );
}

export function Museums({
  view,
  names,
  selfId,
}: {
  view: ModernArtView;
  names: Record<string, string>;
  selfId: string | null;
}) {
  return (
    <section
      className="ma-museums"
      aria-label="各位玩家的博物馆"
      style={{ '--ma-seats': view.seatOrder.length } as CSSProperties}
    >
      {view.seatOrder.map((seat, index) => {
        const player = view.players[seat];
        if (!player) return null;
        const active =
          view.auction?.actingSeats.includes(seat) || view.turnSeat === seat;
        return (
          <article
            key={seat}
            className={`ma-museum ${active ? 'ma-museum--active' : ''} ${view.winners.includes(seat) ? 'ma-museum--winner' : ''}`}
          >
            <div className="ma-museum__screen">
              <span aria-hidden="true">▥</span>
              <div>
                <h3>
                  {names[seat] ?? `玩家 ${index + 1}`}
                  {seat === selfId ? ' · 你' : ''}
                </h3>
                <p>
                  手牌 {player.handCount} 张 · 收藏 {player.collection.length}{' '}
                  幅
                </p>
              </div>
              <b className="ma-museum__number">
                {String(index + 1).padStart(2, '0')}
              </b>
            </div>
            {view.finalCash && (
              <strong className="ma-museum__cash">
                {money(view.finalCash[seat] ?? 0)}
                {view.winners.includes(seat) ? ' · 冠军' : ''}
              </strong>
            )}
            <div className="ma-museum__collection">
              {player.collection.length ? (
                player.collection.map((card) => (
                  <ArtCard
                    key={card.id}
                    card={card}
                    compact
                    artist={view.artists.find((a) => a.id === card.artistId)}
                  />
                ))
              ) : (
                <span className="ma-museum__empty">等待收藏</span>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}

export function RoundResult({
  view,
  names,
}: {
  view: ModernArtView;
  names: Record<string, string>;
}) {
  const result = view.roundResult;
  if (!result) return null;
  return (
    <section
      className="ma-results"
      aria-label={view.phase === 'ended' ? '最终成绩' : '本轮结算'}
    >
      <div className="ma-section-heading">
        <h2>
          {view.phase === 'ended'
            ? '四轮拍卖落槌'
            : `第 ${result.round} 轮落槌`}
        </h2>
        <span>
          {result.reason === 'fifth-card'
            ? '第 5 张画作结束本轮'
            : '本轮画作全部上拍'}
        </span>
      </div>
      {view.phase === 'ended' && (
        <p className="ma-winner">
          {view.winners.map((s) => names[s] ?? '玩家').join('、')} · 获胜
        </p>
      )}
      <div className="ma-results__ranking">
        {result.ranking.map((id, n) => (
          <div key={id}>
            <b>{n + 1}</b>
            <span>{view.artists.find((a) => a.id === id)?.name ?? id}</span>
            <strong>{money(result.values[id] ?? 0)} / 张</strong>
          </div>
        ))}
      </div>
      <div className="ma-results__income">
        {view.seatOrder.map((seat) => (
          <div key={seat}>
            <span>{names[seat] ?? '玩家'}</span>
            <strong>+{money(result.income[seat] ?? 0)}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export function PublicLog({
  view,
  names,
}: {
  view: ModernArtView;
  names: Record<string, string>;
}) {
  return (
    <div className="ma-log">
      {[...view.history].reverse().map((entry) => (
        <article key={entry.id}>
          <strong>
            {entry.actor ? (names[entry.actor] ?? '玩家') : '拍卖行'}
          </strong>
          <p>{entry.text}</p>
          {entry.cards.length > 0 && (
            <p className="ma-log__cards">{paintingsLabel(view, entry)}</p>
          )}
          {entry.amount !== null && <span>{money(entry.amount)}</span>}
          {entry.winner && (
            <span> · 收藏人 {names[entry.winner] ?? '玩家'}</span>
          )}
          {entry.sealedBids && (
            <div className="ma-log__bids">
              {Object.entries(entry.sealedBids).map(([seat, amount]) => (
                <span key={seat}>
                  {names[seat] ?? '玩家'} · {money(amount ?? 0)}
                </span>
              ))}
            </div>
          )}
        </article>
      ))}
      {!view.history.length && <p>尚无已保存的拍卖操作。</p>}
    </div>
  );
}
