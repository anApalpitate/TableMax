import type { ReactNode } from 'react';
import type { CargoId, ManilaView, ShareView } from '../rules/view';
import { cargoColors, cargoNames, seatColors } from './labels';
import { CargoArt, SiteArt, Worker, cargoStyle } from './pieces';

export function CopperMark({
  kind,
}: {
  kind:
    | 'shares'
    | 'coin'
    | 'credit'
    | 'ledger'
    | 'receipt'
    | 'list'
    | 'voyage'
    | 'rules'
    | 'menu';
}) {
  const paths = {
    shares: 'M5 7V4h12v3M3 7h18v15H3zM7 11h10M7 15h6M16 18l2 2 2-2',
    coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M15 8H10v8M8 11h7M8 14h6',
    credit: 'M5 3h14v18H5zM8 7h8M8 11h5M9 16h6M12 13v6',
    ledger:
      'M12 5C8 3 5 3 2 4v16c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1v16M5 8h4M15 8h4M5 12h4M15 12h4',
    receipt: 'M5 2h14v20l-3-2-4 2-4-2-3 2zM8 7h8M8 11h8M8 15h5',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1',
    voyage: 'M12 2v14M12 3l8 9h-8M9 6l-6 6h6M2 17h20l-4 4H6z',
    rules:
      'M6 3h14v18H6a3 3 0 0 1 0-6h14M6 3a3 3 0 0 0-3 3v12M10 7a2 2 0 0 1 4 0c0 1-2 1-2 3M12 12h.01',
    menu: 'M4 6h16M4 12h16M4 18h16',
  };
  return (
    <svg className="mn-copper-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[kind]} />
    </svg>
  );
}

export function CloseMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m7 7 10 10M17 7 7 17" />
    </svg>
  );
}

export function ShareCertificates({
  shares,
  publicView = false,
}: {
  shares: ShareView[];
  publicView?: boolean;
}) {
  return (
    <div className="mn-certificates">
      {shares.map((share) => (
        <article
          className={`mn-certificate${share.mortgaged ? ' mn-certificate--mortgaged' : ''}`}
          key={share.id}
          style={cargoStyle(cargoColors[share.cargo])}
        >
          <CargoArt cargo={share.cargo} />
          <div>
            <strong>{cargoNames[share.cargo]}股份</strong>
            <span>{publicView || share.revealed ? '已公开' : '仅你可见'}</span>
          </div>
          <span className="mn-certificate-seal">
            {share.mortgaged ? '抵押' : '持有'}
          </span>
        </article>
      ))}
      {!shares.length && <p>尚未持有股份</p>}
    </div>
  );
}

export function DetailScene({
  art,
  title,
  value,
  children,
}: {
  art: ReactNode;
  title: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mn-detail-scene">
      <div className="mn-detail-illustration">{art}</div>
      <div>
        <strong>{title}</strong>
        {value && <b>{value}</b>}
        {children}
      </div>
    </div>
  );
}

export function VoyageDetail({ game }: { game: ManilaView }) {
  return (
    <>
      <DetailScene
        art={<SiteArt kind="port" />}
        title={`第 ${game.voyage} 航次`}
        value={`航行 ${Math.min(game.movement, 3)} / 3`}
      >
        <span>派遣第 {game.placementRound} 轮</span>
      </DetailScene>
      <ol className="mn-voyage-steps">
        {['竞拍与装船', '派遣 → 掷骰，三次航行', '港口 / 修船坞结算'].map(
          (text, index) => (
            <li key={text}>
              <b>{index + 1}</b>
              <span>{text}</span>
            </li>
          ),
        )}
      </ol>
      <p className="mn-detail-note">
        船舱从最低空费位入座；分红由船上同伙均分。
      </p>
    </>
  );
}

export function CargoDetail({
  game,
  cargo,
  names,
  destination,
  plundered = false,
}: {
  game: ManilaView;
  cargo: CargoId;
  names: Record<string, string>;
  destination?: string;
  plundered?: boolean;
}) {
  const data = game.cargos.find((entry) => entry.id === cargo)!;
  const crew = game.spaces.filter(
    (entry) => entry.kind === 'cargo' && entry.cargo === cargo,
  );
  return (
    <>
      <DetailScene
        art={<CargoArt cargo={cargo} />}
        title={cargoNames[cargo]}
        value={`整船分红池 ${data.payout} ₱`}
      >
        <span>{destination ?? '抵港后由船上同伙均分'}</span>
        {plundered && <span>已被掠夺</span>}
      </DetailScene>
      <div className="mn-detail-rows">
        {crew.map((space) => (
          <div key={space.id}>
            <span className="mn-position-badge">{space.index + 1}</span>
            {space.occupant ? (
              <Worker
                number={game.seatOrder.indexOf(space.occupant) + 1}
                color={seatColors[game.seatOrder.indexOf(space.occupant)]!}
                label={names[space.occupant] ?? '商人'}
              />
            ) : (
              <span className="mn-empty-worker" aria-hidden="true" />
            )}
            <strong>{space.occupant ? names[space.occupant] : '空位'}</strong>
            <span>费用 {space.cost} ₱</span>
          </div>
        ))}
      </div>
      <p className="mn-detail-note">抵港平分分红池；失航或遭掠夺无船员分红。</p>
    </>
  );
}

export function DockDetail({
  game,
  kind,
}: {
  game: ManilaView;
  kind: 'port' | 'shipyard';
}) {
  return (
    <>
      <DetailScene
        art={<SiteArt kind={kind} />}
        title={kind === 'port' ? '抵港收益' : '入坞收益'}
        value="6 / 8 / 15 ₱"
      >
        <span>按本航次{kind === 'port' ? '抵港' : '入坞'}船数结算</span>
      </DetailScene>
      <div className="mn-detail-rows mn-dock-table">
        {game.spaces
          .filter((space) => space.kind === kind)
          .map((space) => (
            <div key={space.id}>
              <b className="mn-position-badge">{'ABC'[space.index]}</b>
              <span>至少 {space.index + 1} 船</span>
              <span>付 {space.cost} ₱</span>
              <strong>领 {space.payout} ₱</strong>
            </div>
          ))}
      </div>
      <p className="mn-detail-note">
        伙伴选择具体岗位；掠夺送船仅选择港口或修船坞。
      </p>
    </>
  );
}

export function SpecialistDetail({
  kind,
}: {
  kind: 'pirate' | 'pilot' | 'insurance';
}) {
  const content = {
    pirate: {
      title: '海盗船',
      value: '船长 / 船员各 5 ₱',
      rows: [
        ['第二掷停13格', '登上货船的空位'],
        ['第三掷停13格', '掠夺货船，选择送往港口或修船坞'],
      ],
      note: '先船长、后船员；没有触发机会，派遣费用不退。',
    },
    pilot: {
      title: '领航员',
      value: '只调整海上的货船',
      rows: [
        ['小领航员', '费用 2 ₱，移动 1 格'],
        ['大领航员', '费用 5 ₱，合计最多 2 格'],
      ],
      note: '可前进或后退，可放弃全部或部分额度；确认后保存。',
    },
    insurance: {
      title: '保险行',
      value: '免费入驻即领 10 ₱',
      rows: [
        ['修船坞 A / B / C', '赔付 6 / 8 / 15 ₱'],
        ['最多赔付', '29 ₱'],
      ],
      note: '承担实际修船费用；本人占据的修船岗位免自付。',
    },
  }[kind];
  return (
    <>
      <DetailScene
        art={<SiteArt kind={kind} />}
        title={content.title}
        value={content.value}
      />
      <div className="mn-specialist-facts">
        {content.rows.map(([label, value]) => (
          <div key={label}>
            <strong>{label}</strong>
            <span>{value}</span>
          </div>
        ))}
      </div>
      <p className="mn-detail-note">{content.note}</p>
    </>
  );
}

export function ReceiptDetail({
  voyage,
  text,
}: {
  voyage: number;
  text: string;
}) {
  return (
    <>
      <DetailScene
        art={<CopperMark kind="receipt" />}
        title={`第 ${voyage} 航次回执`}
        value="已保存"
      />
      <p className="mn-receipt-entry">{text}</p>
    </>
  );
}
