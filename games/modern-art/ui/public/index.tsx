import type { CSSProperties, ReactNode } from 'react';
import type { ModernArtLog, ModernArtView } from '../view';
import { ArtCard } from '../ArtCard';
import { auctionNames, money } from './labels';
import { ArtistMark, AuctionMark } from '../painting-display';
import { artistPresentation } from '../artist-presentation';
import { sortPaintings, type PaintingSort } from '../sorting';

function paintingsLabel(view: ModernArtView, entry: ModernArtLog) {
  return entry.cards
    .map(
      (card) =>
        `${view.artists.find((a) => a.id === card.artistId)?.name.split(' ')[0] ?? card.artistId} ${card.title}`,
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
        <p
          title={`${entry.actor ? (names[entry.actor] ?? '玩家') : '拍卖行'} ${entry.text}`}
        >
          <strong>
            {entry.actor ? (names[entry.actor] ?? '玩家') : '拍卖行'}
          </strong>{' '}
          <span>{entry.verb === 'offer' ? '出画' : entry.text}</span>
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

export function MarketBoard({
  view,
  showHistory,
}: {
  view: ModernArtView;
  showHistory(): void;
}) {
  const settled = view.phase === 'round-result' || view.phase === 'ended';
  return (
    <section className="ma-market" aria-label="艺术家估值板">
      <div className="ma-section-heading">
        <h2>艺术市场</h2>
        <span>{settled ? '结算 千元/张' : '预估 千元/张'}</span>
      </div>
      <div className="ma-market__columns">
        {view.artists.map((artist) => (
          <div
            key={artist.id}
            className="ma-artist"
            style={
              {
                '--ma-artist': artistPresentation[artist.id].color,
              } as CSSProperties
            }
          >
            <div className="ma-artist__identity">
              <span className="ma-artist__swatch" aria-hidden="true">
                <ArtistMark artistId={artist.id} />
              </span>
              <h3 title={artist.name}>
                {artistPresentation[artist.id].shortName}
              </h3>
            </div>
            <div className="ma-artist__count">
              <strong>{artist.playedCount}</strong>
              <span> / 5</span>
            </div>
            <div className="ma-artist__pips" aria-hidden="true">
              {Array.from({ length: 5 }, (_, n) => (
                <i
                  key={n}
                  className={n < artist.playedCount ? 'ma-filled' : ''}
                />
              ))}
            </div>
            <strong
              className="ma-artist__value"
              data-three-digit={artist.currentValue >= 100 ? 'true' : undefined}
            >
              {artist.currentValue}
            </strong>
          </div>
        ))}
      </div>
      <div className="ma-market__supply">
        <span>牌库 {view.deckCount} 张</span>
        <span>弃牌 {view.discardCount} 张</span>
        <button
          type="button"
          className="secondary ma-market-history-control"
          onClick={showHistory}
        >
          历轮估值
        </button>
      </div>
    </section>
  );
}

export function MarketHistory({ view }: { view: ModernArtView }) {
  return (
    <div className="ma-market-history">
      <table>
        <thead>
          <tr>
            <th scope="col">画家</th>
            {[1, 2, 3, 4].map((round) => (
              <th key={round} scope="col">
                第 {round} 轮
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.artists.map((artist) => (
            <tr key={artist.id}>
              <th scope="row" title={artist.name}>
                {artistPresentation[artist.id].shortName}
              </th>
              {[0, 1, 2, 3].map((round) => (
                <td key={round}>{artist.history[round] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p>单位：千元 / 张</p>
    </div>
  );
}

export function AuctionStage({
  view,
  names,
  countdown,
}: {
  view: ModernArtView;
  names: Record<string, string>;
  countdown?: ReactNode;
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
        <h2>
          {view.phase === 'offer' ? `${actor} 正在选画` : '本轮拍卖已结束'}
        </h2>
        {countdown}
      </section>
    );
  const title =
    view.phase === 'double' ? '征集第二幅画作' : auctionNames[auction.kind];
  const price = auction.fixedPrice ?? auction.currentBid;
  return (
    <section className="ma-auction" aria-label="拍卖台">
      <div className="ma-auction__label">
        <span className="ma-auction__mark" aria-hidden="true">
          <AuctionMark kind={auction.kind} />
        </span>
        <div>
          <h2>{title}</h2>
          <p title={`拍卖人 ${names[auction.seller] ?? '玩家'}`}>
            拍卖人 {names[auction.seller] ?? '玩家'}
          </p>
        </div>
        {countdown}
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
      <div
        className="ma-auction__participants"
        aria-label="拍卖参与状态"
        style={{ '--ma-seats': view.seatOrder.length } as CSSProperties}
      >
        {view.seatOrder.map((seat) => (
          <span
            key={seat}
            className={auction.actingSeats.includes(seat) ? 'ma-active' : ''}
            title={`${names[seat] ?? '玩家'} ${auction.submitted.includes(seat) ? '已提交' : auction.passes.includes(seat) ? '本次不参与' : auction.actingSeats.includes(seat) ? '可行动' : '等待'}`}
          >
            <strong>{names[seat] ?? '玩家'}</strong>
            <span
              className="ma-auction__seat-status"
              role="img"
              aria-label={
                auction.submitted.includes(seat)
                  ? '已提交'
                  : auction.passes.includes(seat)
                    ? '本次不参与'
                    : auction.actingSeats.includes(seat)
                      ? '可行动'
                      : '等待'
              }
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {auction.submitted.includes(seat) ? (
                  <path d="m4 12 5 5 11-11" />
                ) : auction.passes.includes(seat) ? (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M6 18 18 6" />
                  </>
                ) : auction.actingSeats.includes(seat) ? (
                  <path d="m9 4 10 8-10 8Z" />
                ) : (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 6v6l4 3" />
                  </>
                )}
              </svg>
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}

export function Museums({
  view,
  names,
  portraits,
  selfId,
  sort = 'artist',
}: {
  view: ModernArtView;
  names: Record<string, string>;
  portraits: Record<string, string>;
  selfId: string | null;
  sort?: PaintingSort;
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
            data-seat-id={seat}
            className={`ma-museum ${active ? 'ma-museum--active' : ''} ${view.winners.includes(seat) ? 'ma-museum--winner' : ''}`}
          >
            <div className="ma-museum__screen">
              {portraits[seat] && (
                <img
                  className="ma-museum__portrait"
                  src={portraits[seat]}
                  alt=""
                />
              )}
              <div>
                <h3 title={names[seat] ?? `玩家 ${index + 1}`}>
                  <span className="ma-museum__name">
                    {names[seat] ?? `玩家 ${index + 1}`}
                  </span>
                  {seat === selfId && (
                    <span className="ma-museum__self">你</span>
                  )}
                </h3>
                <p>
                  <span>手牌 {player.handCount}</span>
                  <span>收藏 {player.collection.length}</span>
                </p>
              </div>
              <b className="ma-museum__number">
                {String(index + 1).padStart(2, '0')}
              </b>
            </div>
            {view.finalCash && (
              <strong className="ma-museum__cash">
                {money(view.finalCash[seat] ?? 0)}
                {view.winners.includes(seat) ? ' 冠军' : ''}
              </strong>
            )}
            {player.collection.length > 0 && (
              <div className="ma-museum__collection">
                {sortPaintings(player.collection, sort).map((card) => (
                  <ArtCard
                    key={card.id}
                    card={card}
                    compact
                    artist={view.artists.find((a) => a.id === card.artistId)}
                  />
                ))}
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}

export function RoundResult({
  view,
  names,
  portraits,
}: {
  view: ModernArtView;
  names: Record<string, string>;
  portraits: Record<string, string>;
}) {
  const result = view.roundResult;
  if (!result) return null;
  const ended = view.phase === 'ended';
  return (
    <section
      className={`ma-results ${ended ? 'ma-results--ended' : ''}`}
      aria-label={ended ? '最终成绩' : '本轮结算'}
    >
      <div className="ma-section-heading">
        <h2>{ended ? '总资产' : `第 ${result.round} 轮落槌`}</h2>
        <span>
          {ended
            ? '四轮拍卖结束'
            : result.reason === 'fifth-card'
              ? '第 5 张画作结束本轮'
              : '本轮画作全部上拍'}
        </span>
      </div>
      {!ended && (
        <div className="ma-results__ranking">
          {result.ranking.map((id, n) => (
            <div key={id}>
              <b>{n + 1}</b>
              <span>{view.artists.find((a) => a.id === id)?.name ?? id}</span>
              <strong>{money(result.values[id] ?? 0)} / 张</strong>
            </div>
          ))}
        </div>
      )}
      <div className="ma-results__income">
        {view.seatOrder.map((seat) => {
          const finalCash = view.finalCash?.[seat];
          const winner = ended && view.winners.includes(seat);
          return (
            <div
              key={seat}
              data-seat-id={seat}
              data-final-cash={ended ? finalCash : undefined}
              data-champion={winner ? 'true' : undefined}
            >
              <div className="ma-results__identity">
                {portraits[seat] && (
                  <img
                    className="ma-results__portrait"
                    src={portraits[seat]}
                    alt=""
                  />
                )}
                <span title={names[seat] ?? '玩家'}>
                  {names[seat] ?? '玩家'}
                </span>
                {winner && (
                  <span
                    className="ma-results__champion"
                    role="img"
                    aria-label="冠军"
                    title="冠军"
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z" />
                    </svg>
                  </span>
                )}
              </div>
              <strong>
                {ended
                  ? typeof finalCash === 'number' && Number.isFinite(finalCash)
                    ? money(finalCash)
                    : '待同步'
                  : `+${money(result.income[seat] ?? 0)}`}
              </strong>
            </div>
          );
        })}
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
          {entry.winner && <span> 收藏人 {names[entry.winner] ?? '玩家'}</span>}
          {entry.sealedBids && (
            <div className="ma-log__bids">
              {Object.entries(entry.sealedBids).map(([seat, amount]) => (
                <span key={seat}>
                  {names[seat] ?? '玩家'} {money(amount ?? 0)}
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
