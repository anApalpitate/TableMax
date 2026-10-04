import type { CSSProperties } from 'react';
import type { ModernArtView } from './view';
import { artistPresentation } from './artist-presentation';
import { ArtistMark, AuctionMark } from './painting-display';
import { money } from './public/labels';

export function AuctionTheme({
  view,
  names,
  activityMessage,
}: {
  view: ModernArtView;
  names: Record<string, string>;
  activityMessage?: string | undefined;
}) {
  const auction = view.auction;
  if (!auction) return null;
  const kind = view.phase === 'double' ? 'double' : auction.kind;
  const identity = (seat: string) => (
    <span className="ma-theme__identity" title={names[seat] ?? '玩家'}>
      <b className="ma-seat-number" data-seat-id={seat}>
        {view.seatOrder.indexOf(seat) + 1}
      </b>
      <span>{names[seat] ?? '玩家'}</span>
    </span>
  );
  const acting = auction.actingSeats[0];
  const message = activityMessage ?? null;
  return (
    <div
      className={`ma-auction__price ma-theme ma-theme--${kind}`}
      data-activity-message={message ? 'true' : undefined}
    >
      {kind === 'open' && (
        <>
          <div className="ma-theme__stairs" aria-hidden="true">
            <i />
            <i />
            <i />
            <AuctionMark kind="open" />
          </div>
          <span>当前最高出价</span>
          <strong>{money(auction.currentBid)}</strong>
          {auction.highBidder ? (
            <div className="ma-theme__lead">
              {identity(auction.highBidder)}
              <span>领拍</span>
            </div>
          ) : (
            <span>等待第一声报价</span>
          )}
          <span className="ma-theme__caption">
            {message ??
              `已确认 ${new Set([...auction.passes, ...(auction.highBidder ? [auction.highBidder] : [])]).size} / ${view.seatOrder.length}；加价后重新确认`}
          </span>
        </>
      )}
      {kind === 'once' && (
        <>
          <div className="ma-theme__ring" aria-label="顺时针一次出价席位">
            <svg viewBox="0 0 180 150" aria-hidden="true">
              <path d="M90 17a58 58 0 1 1-45 21" />
              <path d="m38 31 7 8 10-3" />
            </svg>
            {view.seatOrder.map((seat, index) => {
              const angle =
                (index * 2 * Math.PI) / view.seatOrder.length - Math.PI / 2;
              return (
                <b
                  key={seat}
                  className={`ma-seat-number ${!message && auction.actingSeats.includes(seat) ? 'ma-theme__current' : ''}`}
                  title={names[seat] ?? '玩家'}
                  style={
                    {
                      left: `${50 + 35 * Math.cos(angle)}%`,
                      top: `${50 + 36 * Math.sin(angle)}%`,
                    } as CSSProperties
                  }
                >
                  {index + 1}
                </b>
              );
            })}
            <span>一次机会</span>
          </div>
          <strong>{money(auction.currentBid)}</strong>
          <div className="ma-theme__lead">
            {message ??
              (acting ? (
                <>
                  {identity(acting)}
                  <span>轮到出价</span>
                </>
              ) : (
                '本轮出价完成'
              ))}
          </div>
          {auction.highBidder && (
            <span className="ma-theme__caption">
              领拍：{identity(auction.highBidder)}
            </span>
          )}
        </>
      )}
      {kind === 'sealed' && (
        <>
          <div className="ma-theme__envelopes" aria-label="暗标封存状态">
            {view.seatOrder.map((seat, index) => (
              <span
                key={seat}
                className={
                  auction.submitted.includes(seat) ? 'ma-theme__sealed' : ''
                }
                title={`${names[seat] ?? '玩家'} ${auction.submitted.includes(seat) ? '已封存' : '待提交'}`}
              >
                <AuctionMark kind="sealed" />
                <b className="ma-seat-number">{index + 1}</b>
                <span>
                  {auction.submitted.includes(seat) ? '已封存' : '待提交'}
                </span>
              </span>
            ))}
          </div>
          <strong>
            {auction.submitted.length} / {view.seatOrder.length}
          </strong>
          <span>{message ?? '全部封存后一起揭标'}</span>
        </>
      )}
      {kind === 'fixed' && (
        <>
          <div className="ma-theme__price-tag">
            <span>一口价</span>
            <strong>
              {auction.fixedPrice === null
                ? '待定价'
                : money(auction.fixedPrice)}
            </strong>
          </div>
          <div className="ma-theme__lead">
            {message ??
              (acting ? (
                <>
                  {identity(acting)}
                  <span>
                    {auction.fixedPrice === null
                      ? '正在定价'
                      : acting === auction.seller
                        ? '卖家自购'
                        : '正在询价'}
                  </span>
                </>
              ) : (
                '等待买入'
              ))}
          </div>
          <span className="ma-theme__caption">
            顺时针询价 → 无人买入则卖家按原价自购
          </span>
        </>
      )}
      {kind === 'double' && (
        <>
          <div
            className="ma-theme__pair"
            style={
              {
                '--ma-artist':
                  artistPresentation[auction.cards[0]!.artistId].color,
              } as CSSProperties
            }
            aria-label="同画家双拍配对"
          >
            <span>
              <ArtistMark artistId={auction.cards[0]!.artistId} />
            </span>
            <b aria-hidden="true">＋</b>
            <span className="ma-theme__pair-slot">?</span>
          </div>
          <strong>
            {artistPresentation[auction.cards[0]!.artistId].shortName}
          </strong>
          <span>同画家，非双拍</span>
          <div className="ma-theme__lead">
            {message ??
              (acting ? (
                <>
                  {identity(acting)}
                  <span>可补画或跳过</span>
                </>
              ) : (
                '等待补画'
              ))}
          </div>
        </>
      )}
    </div>
  );
}
