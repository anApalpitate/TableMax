import { OverlayPanel } from '@tablemax/web-host';
import { tile } from '../rules/data';
import type { State } from '../rules/state';
import { SunDisk } from './art';
import { PreviewTile } from './player-board';

type AuctionRecord = NonNullable<State['lastAuction']>;
type AuctionInfo = {
  record: AuctionRecord;
  name(seat: string): string;
};

function winningBid(record: AuctionRecord) {
  return record.bids.find((bid) => bid.seat === record.winner)?.disk;
}

function Exchange({ record }: { record: AuctionRecord }) {
  const paid = winningBid(record);
  if (paid == null || record.received === null)
    return <div className="ra-recap-exchange">中央盘未更换</div>;
  return (
    <div className="ra-recap-exchange">
      <span>
        付出 <SunDisk value={paid} />
      </span>
      <span aria-hidden="true">→</span>
      <span>
        换回 <SunDisk value={record.received} />
      </span>
    </div>
  );
}

function Lots({ record }: { record: AuctionRecord }) {
  const label = record.winner
    ? '拍下的石板'
    : record.cause === 'invokeFull'
      ? '弃置的石板'
      : '留在拍卖行的石板';
  return (
    <div className="ra-recap-lots">
      {record.tiles?.length ? (
        <>
          <p>{label}</p>
          <div className="ra-recap-tiles" role="group" aria-label={label}>
            {record.tiles.map((id) => (
              <PreviewTile key={id} tile={tile(id)} count={1} />
            ))}
          </div>
        </>
      ) : (
        <p>{record.tiles ? '本场无石板' : '此场未保存石板明细'}</p>
      )}
    </div>
  );
}

function outcome(record: AuctionRecord, name: AuctionInfo['name']) {
  return record.winner ? `${name(record.winner)}赢标` : '无人出价';
}

export function AuctionRecap({
  record,
  name,
  open,
}: AuctionInfo & { open(): void }) {
  const paid = winningBid(record);
  return (
    <section className="ra-auction-recap" aria-label="上一场拍卖">
      <div className="ra-recap-wide">
        <div className="ra-recap-result">
          <h2>上一场拍卖</h2>
          <strong>{outcome(record, name)}</strong>
          <Exchange record={record} />
        </div>
        <Lots record={record} />
        <button type="button" aria-haspopup="dialog" onClick={open}>
          查看出价 <span aria-hidden="true">↗</span>
        </button>
      </div>
      <button
        className="ra-recap-compact"
        type="button"
        aria-haspopup="dialog"
        onClick={open}
      >
        上一场拍卖 <strong>{outcome(record, name)}</strong>
        {paid != null && record.received !== null && (
          <span>
            {paid} 换 {record.received}
          </span>
        )}
        <span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}

export function AuctionRecordPanel({
  record,
  name,
  close,
  player,
}: {
  record: State['lastAuction'];
  name: AuctionInfo['name'];
  close(): void;
  player: boolean;
}) {
  return (
    <OverlayPanel
      title={player ? '拍卖记录' : '上一场拍卖'}
      close={close}
      className={`ra-detail-panel${player ? ' ra-detail-panel--player' : ''}`}
    >
      {record ? (
        <>
          <div className="ra-recap-detail">
            <strong>{outcome(record, name)}</strong>
            <Exchange record={record} />
            <Lots record={record} />
          </div>
          <ol className="ra-recap-bids" aria-label="按出价顺序">
            {record.bids.map(({ seat, disk }) => (
              <li key={seat} data-winner={seat === record.winner || undefined}>
                <span>{name(seat)}</span>
                <span>
                  {disk === null ? '跳过' : <SunDisk value={disk} />}
                  {seat === record.winner && <strong>赢标</strong>}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="ra-recap-detail">本局还没有拍卖记录</p>
      )}
    </OverlayPanel>
  );
}
