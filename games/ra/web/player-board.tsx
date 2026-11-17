import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { OverlayPanel } from '@tablemax/web-host';
import type { RaView } from '../rules';
import { persists, tile, tileIds, tileNames, type Tile } from '../rules/data';
import type { Breakdown } from '../rules/state';
import { SunDisk, TableArt, TileFace } from './art';
import { seatSettlement, type SettlementTable } from './settlement';
import { RaScoreNumber } from './score-motion';
import './player-board.css';

const names = {
  monument: '纪念物',
  pharaoh: '法老',
  nile: '尼罗河',
  god: '神明',
  gold: '黄金',
  civilization: '文明',
  flood: '洪水',
  disks: '圆盘',
  river: '河流',
};
type Resource = Exclude<keyof typeof names, 'disks' | 'river'>;
type Icon = Resource | 'link' | 'group';
type Motif = Resource | 'disks' | 'wild';
type Badge = '=' | '≠' | '↑' | '↓';

const categories = [
  'pharaoh',
  'god',
  'gold',
  'river',
  'civilization',
  'monument',
] as const;
type Rule = Resource | 'disks';
type Projection = { parts: Omit<Breakdown, 'disks'>; delta: number };
const ruleText: Record<Rule, string> = {
  pharaoh: '数量最多者各 +5，最少者各 −2。全桌相同时为 0。',
  god: '未花费的神明每枚 +2。花费一枚可从拍卖行取走一枚非神明板块。',
  gold: '黄金每枚 +3。',
  civilization:
    '不同种类数为 0／1／2／3／4／5 时，得分是 −5／0／0／5／10／15。',
  monument:
    '第三时代将两项相加。每组 3／4／5 枚同类分别 +5／+10／+15。有 1–6 种时每种 +1，有 7／8 种时分别 +10／+15。',
  nile: '有洪水时尼罗河每枚 +1，否则为 0。洪水自身每枚 +1。',
  flood: '洪水每枚 +1，有至少一枚还能让每枚尼罗河 +1。旱灾先弃洪水再弃尼罗河。',
  disks:
    '第三时代比较各席正反面圆盘的合计。最高各 +5，最低各 −5，全桌相同为 0。中央盘不计。',
};
const pool = new Map<string, number>();
for (const id of tileIds) {
  const kind = tile(id).face;
  pool.set(kind, (pool.get(kind) ?? 0) + 1);
}

const diagrams: Record<Icon, ReactNode> = {
  monument: <path d="M1 17 10 5l8 12ZM14 8l3-4 6 13h-3Z" fill="currentColor" />,
  pharaoh: (
    <>
      <path
        d="M3 19v-7a9 9 0 0 1 18 0v7h-4v-6a5 5 0 0 0-10 0v6Z"
        fill="currentColor"
      />
      <path
        d="M3 11h4m-5 4h5m-4 3h4m10-7h4m-4 4h5m-5 3h4M6 5l2 4m3-7v6m3-5-1 5m5-3-3 4"
        stroke="var(--ra-slot)"
      />
    </>
  ),
  nile: <path d="m2 6 4 4 4-3 4 4 4-3 4 4M2 12l4 4 4-3 4 4 4-3 4 4" />,
  god: (
    <>
      <path d="M2 9c4-4 10-5 18-3M2 11c6-4 13-3 19 0-7 4-13 4-19 0Zm18 0-5 3 2 4m-7-4-4 6c-3 2-5-1-3-2" />
      <circle cx="11" cy="11" r="2.2" fill="currentColor" stroke="none" />
    </>
  ),
  gold: (
    <path
      d="M7 5a7 7 0 0 0 0 14c-4-4-4-10 0-14Zm6 0a7 7 0 0 0 0 14c-4-3-4-11 0-14Zm4 1a6 6 0 1 0 0 12 6 6 0 0 0 0-12Z"
      fill="currentColor"
    />
  ),
  civilization: (
    <>
      <path d="M12 19c1-7 4-12 8-15M12 19c-1-7-4-12-8-15M12 19V4m0 15c-4-5-8-6-10-6m10 6c4-5 8-6 10-6" />
      <path
        d="M12 14 7 3h10Zm-7-4L3 4l6 5Zm14 0 2-6-6 5Z"
        fill="currentColor"
        stroke="none"
      />
    </>
  ),
  flood: (
    <path d="m2 4 4 4 4-3 4 4 4-3 4 4M2 9l4 4 4-3 4 4 4-3 4 4M2 14l4 4 4-3 4 4 4-3 4 4" />
  ),
  link: (
    <path d="m10 8 2-2a4 4 0 1 1 6 6l-2 2m-2 2-2 2a4 4 0 1 1-6-6l2-2m1 5 6-6" />
  ),
  group: (
    <>
      <path d="M2 19v-5l3-2 3 2v5m1 0v-5l3-2 3 2v5m1 0v-5l3-2 3 2v5" />
      <path d="M5 9v.1m7-.1v.1m7-.1v.1" strokeWidth="4" />
    </>
  ),
};

function BoardIcon({ name }: { name: Icon }) {
  return (
    <svg
      className="ra-personal-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {diagrams[name]}
    </svg>
  );
}

function Epochs({ onlyThird = false }: { onlyThird?: boolean }) {
  return (
    <span
      className="ra-personal-epochs"
      role="img"
      aria-label={onlyThird ? '仅第三时代结算' : '每时代结算'}
    >
      {(onlyThird ? [3] : [1, 2, 3]).map((epoch) => (
        <svg
          key={epoch}
          data-epoch={epoch}
          viewBox="0 0 12 15"
          aria-hidden="true"
        >
          <path
            d="M2 1h8M2 14h8M3 2v2l3 3.5L3 11v2m6-11v2L6 7.5 9 11v2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <path
            d={
              epoch === 1
                ? 'M3.5 2.5h5L6 6.4Z'
                : epoch === 2
                  ? 'M4 4h4L6 6.8ZM6 8.5l2.4 4H3.6Z'
                  : 'M6 9l2.5 4h-5Z'
            }
            fill="currentColor"
          />
        </svg>
      ))}
    </span>
  );
}

function InscribedTile({ motif, badge }: { motif: Motif; badge?: Badge }) {
  return (
    <span className="ra-inscribed-tile" data-motif={motif}>
      {motif === 'disks' ? '?' : motif !== 'wild' && <BoardIcon name={motif} />}
      {badge && (
        <b className="ra-inscribed-badge" data-badge={badge}>
          {badge}
        </b>
      )}
    </span>
  );
}

function PointChip({ value }: { value: number }) {
  return (
    <span className="ra-point-mark" data-polarity={Math.sign(value)}>
      <span className="ra-point-sign">
        {value === 0 ? '' : value > 0 ? '+' : '−'}
      </span>
      <b className="ra-point-chip">{Math.abs(value)}</b>
    </span>
  );
}

function RuleRow({
  prefix,
  motif,
  badge,
  value,
  each = false,
}: {
  prefix: ReactNode;
  motif: Motif;
  badge?: Badge;
  value: number;
  each?: boolean;
}) {
  return (
    <div
      className="ra-inscription-row"
      data-motif={motif}
      data-comparison={badge}
    >
      <span className="ra-inscription-input">{prefix}</span>
      {badge ? (
        <InscribedTile motif={motif} badge={badge} />
      ) : (
        <InscribedTile motif={motif} />
      )}
      <span aria-hidden="true">:</span>
      <PointChip value={value} />
      {each && (
        <span className="ra-inscription-each">
          × <InscribedTile motif={motif} />
        </span>
      )}
    </div>
  );
}

function Comparison({ motif }: { motif: 'pharaoh' | 'disks' }) {
  const penalty = motif === 'pharaoh' ? -2 : -5;
  return (
    <div className="ra-inscription ra-comparison" aria-hidden="true">
      <RuleRow
        prefix={<BoardIcon name="group" />}
        motif={motif}
        badge="↑"
        value={5}
      />
      <RuleRow
        prefix={<BoardIcon name="group" />}
        motif={motif}
        badge="↓"
        value={penalty}
      />
      <RuleRow
        prefix={<BoardIcon name="group" />}
        motif={motif}
        badge="="
        value={0}
      />
    </div>
  );
}

function PerTile({ motif, points }: { motif: Motif; points: number }) {
  return (
    <span className="ra-per-tile">
      <PointChip value={points} /> × <InscribedTile motif={motif} />
    </span>
  );
}

function groupTiles(tiles: Tile[]) {
  const groups = new Map<string, { tile: Tile; count: number }>();
  for (const tile of tiles) {
    const group = groups.get(tile.face);
    if (group) group.count++;
    else groups.set(tile.face, { tile, count: 1 });
  }
  return [...groups.values()];
}

type TileMotion = ReturnType<ReturnType<typeof seatSettlement>['motion']>;

function PreviewTile({
  tile,
  count,
  motion,
}: {
  tile: Tile;
  count: number;
  motion?: TileMotion;
}) {
  const [preview, setPreview] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  }>();
  const show = (target: HTMLButtonElement) => {
    const rect = target.getBoundingClientRect();
    const height = Math.min(
      288,
      window.innerHeight - 16,
      (window.innerWidth - 16) / 0.87,
    );
    const width = Math.round(height * 0.87);
    setPreview({
      width,
      height,
      left: Math.min(
        window.innerWidth - width - 8,
        Math.max(8, rect.left + (rect.width - width) / 2),
      ),
      top:
        rect.top >= height + 14
          ? rect.top - height - 6
          : Math.max(
              8,
              Math.min(rect.bottom + 6, window.innerHeight - height - 8),
            ),
    });
  };
  return (
    <>
      <button
        type="button"
        className="ra-personal-stack ra-preview-tile"
        data-ra-score-hit={motion?.hit}
        data-ra-score-hidden={motion?.hidden || undefined}
        data-ra-score-set={motion?.set || undefined}
        data-ra-score-discard={motion?.discard || undefined}
        style={
          motion?.hit
            ? ({ '--ra-prelight': `${motion.start}ms` } as React.CSSProperties)
            : undefined
        }
        aria-label={`${tileNames[tile.face]}${count > 1 ? `，${count} 枚` : ''}，查看石板`}
        aria-expanded={Boolean(preview)}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') show(event.currentTarget);
        }}
        onPointerLeave={() => setPreview(undefined)}
        onFocus={(event) => {
          if (event.currentTarget.matches(':focus-visible'))
            show(event.currentTarget);
        }}
        onBlur={() => setPreview(undefined)}
        onClick={(event) => {
          if (preview) setPreview(undefined);
          else show(event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && preview) {
            event.stopPropagation();
            setPreview(undefined);
          }
        }}
      >
        <TileFace tile={tile} decorative />
        {count > 1 && <b aria-hidden="true">×{count}</b>}
      </button>
      {preview &&
        createPortal(
          <div className="ra-tile-popover" style={preview} aria-hidden="true">
            <TileFace tile={tile} decorative />
          </div>,
          document.body,
        )}
    </>
  );
}

function Tokens({
  tiles,
  limit,
  motion,
}: {
  tiles: Tile[];
  limit?: number;
  motion?: ReturnType<typeof seatSettlement>['motion'] | undefined;
}) {
  const groups = groupTiles(tiles);
  return (
    <div className="ra-personal-tiles">
      {groups.slice(0, limit ?? groups.length).map(({ tile, count }) => (
        <PreviewTile
          key={tile.face}
          tile={tile}
          count={count}
          motion={motion?.(tile, count)}
        />
      ))}
    </div>
  );
}

function RulesDiagram({ kind }: { kind: Resource }) {
  switch (kind) {
    case 'monument':
      return (
        <div
          className="ra-inscription ra-monument-inscription"
          aria-hidden="true"
        >
          {[5, 10, 15].map((value, index) => (
            <RuleRow
              key={value}
              prefix={index + 3}
              motif="monument"
              badge="="
              value={value}
            />
          ))}
          <span className="ra-inscription-conjunction">&amp;</span>
          <RuleRow prefix="1–6" motif="monument" badge="≠" value={1} each />
          <RuleRow prefix="7" motif="monument" badge="≠" value={10} />
          <RuleRow prefix="8" motif="monument" badge="≠" value={15} />
        </div>
      );
    case 'civilization':
      return (
        <div className="ra-inscription" aria-hidden="true">
          <RuleRow prefix={0} motif="civilization" value={-5} />
          {[5, 10, 15].map((value, index) => (
            <RuleRow
              key={value}
              prefix={index + 3}
              motif="civilization"
              badge="≠"
              value={value}
            />
          ))}
        </div>
      );
    case 'pharaoh':
      return <Comparison motif="pharaoh" />;
    case 'god':
      return (
        <div
          className="ra-inscription ra-inscription-single"
          aria-hidden="true"
        >
          <PerTile motif="god" points={2} />
          <div className="ra-inscription-exchange">
            <InscribedTile motif="god" badge="↓" />
            <span>:</span>
            <InscribedTile motif="wild" badge="↑" />
          </div>
        </div>
      );
    case 'gold':
      return (
        <div
          className="ra-inscription-single ra-gold-inscription"
          aria-hidden="true"
        >
          <PerTile motif="gold" points={3} />
        </div>
      );
    case 'nile':
    case 'flood':
      return null;
  }
}

type Player = RaView['players'][number];
type PublicPlayer = Pick<Player, 'seat' | 'disks' | 'spent' | 'held'>;

function Disks({
  available,
  spent,
  scoring = false,
}: {
  available: Player['disks'];
  spent: readonly (number | undefined)[];
  scoring?: boolean;
}) {
  return (
    <>
      {available.map((disk) => (
        <span key={disk} data-ra-score-hit={scoring ? 'disk' : undefined}>
          <SunDisk value={disk} />
        </span>
      ))}
      {spent.map((disk, index) => (
        <span
          key={`spent-${index}`}
          data-spent="true"
          data-ra-score-hit={scoring ? 'disk' : undefined}
          role="img"
          aria-label={disk === undefined ? '已用太阳盘' : `已用太阳盘 ${disk}`}
        >
          {disk === undefined ? <SunDisk /> : <SunDisk value={disk} />}
        </span>
      ))}
    </>
  );
}

type AuctionStatus = {
  caller?: string | undefined;
  bid?: number | null | undefined;
  highest: boolean;
};

export function AuctionBadge({
  status,
}: {
  status?: AuctionStatus | undefined;
}) {
  return (
    <div className="ra-seat-badges">
      {status?.caller && (
        <span
          className="ra-caller-badge"
          role="img"
          aria-label={status.caller}
          title={status.caller}
        >
          <TableArt piece="ra-statue" className="ra-auction-statue" />
        </span>
      )}
      {status?.bid === null && (
        <span
          role="img"
          className="ra-pass-badge"
          aria-label="已跳过"
          title="已跳过"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="8" />
            <path d="m6.5 17.5 11-11" />
          </svg>
        </span>
      )}
      {typeof status?.bid === 'number' && (
        <span
          className="ra-bid-badge"
          role="img"
          data-highest={status.highest}
          aria-label={`${status.highest ? '最高出价' : '出价'} ${status.bid}`}
          title={`${status.highest ? '最高出价' : '出价'} ${status.bid}`}
        >
          <SunDisk value={status.bid} />
        </span>
      )}
    </div>
  );
}

export function PlayerSummary({
  player,
  name,
  active,
  auction,
  result,
  score,
  showScores,
  table = false,
  settlementTable,
}: {
  player: PublicPlayer;
  name: string;
  active: boolean;
  auction?: AuctionStatus | undefined;
  result?:
    { rank: number; total: number; tied: boolean; highest: number } | undefined;
  score?: number | undefined;
  showScores?: () => void;
  table?: boolean;
  settlementTable?: SettlementTable | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const settlement =
    settlementTable && seatSettlement(settlementTable, player.seat);
  const held = settlement?.held ?? player.held;
  const limit = 8;
  const overflow = groupTiles(player.held)
    .slice(limit)
    .reduce((count, item) => count + item.count, 0);
  return (
    <article
      aria-label={`${name}的公开摘要`}
      className="ra-seat-summary"
      data-ra-seat={player.seat}
      data-active={active}
      data-rank={result?.rank}
      data-ra-settling={settlementTable ? settlementTable.step : undefined}
    >
      <header className="ra-seat-head">
        <h2 className="ra-seat-summary-heading" title={name}>
          {name}
        </h2>
        {result ? (
          <button
            type="button"
            className="ra-rank"
            onClick={showScores}
            aria-haspopup="dialog"
            aria-label={`第 ${result.rank} 名，${result.total} 分，查看时代计分`}
          >
            <span aria-hidden="true">{result.rank}</span>
            <strong>{result.total} 分</strong>
          </button>
        ) : (
          <AuctionBadge status={auction} />
        )}
      </header>
      {!result && score !== undefined && (
        <span className="ra-running-score" aria-label={'累计 ' + score + ' 分'}>
          {score}
          <small> 分</small>
        </span>
      )}
      <div className="ra-seat-summary-disks" role="group" aria-label="太阳圆盘">
        <Disks
          available={settlement?.player?.disks ?? player.disks}
          spent={
            settlement?.spent ??
            Array.from(
              { length: settlement?.player?.spent ?? player.spent },
              () => undefined,
            )
          }
          scoring={settlement?.category === 'disks'}
        />
        {result?.tied && (
          <span className="ra-tiebreak" title="同分，比较最高太阳圆盘">
            决胜盘 {result.highest}
          </span>
        )}
      </div>
      {table ? (
        <div className="ra-seat-holdings">
          {[
            {
              name: '跨时代',
              band: 'persistent',
              tiles: held.filter(({ id }) => persists(id)),
            },
            {
              name: '本时代',
              band: 'temporary',
              tiles: held.filter(({ id }) => !persists(id)),
            },
          ]
            .filter(({ tiles }) => tiles.length)
            .map(({ name, band, tiles }) => (
              <section
                className="ra-holding-band"
                data-ra-holding-band={band}
                aria-label={name}
                key={name}
              >
                <span className="ra-holding-label">{name}</span>
                <Tokens tiles={tiles} motion={settlement?.motion} />
              </section>
            ))}
        </div>
      ) : (
        <Tokens tiles={player.held} limit={limit} />
      )}
      {settlement?.category && settlement.points !== undefined && (
        <RaScoreNumber
          key={settlementTable?.key}
          points={settlement.points}
          category={settlement.category}
          floor={settlement.floor}
        />
      )}
      {!table && overflow > 0 && (
        <button
          type="button"
          className="ra-more-tiles"
          aria-haspopup="dialog"
          onClick={() => setExpanded(true)}
        >
          另有 {overflow} 枚
        </button>
      )}
      {expanded && (
        <OverlayPanel title={`${name}的石板`} close={() => setExpanded(false)}>
          <Tokens tiles={player.held} />
        </OverlayPanel>
      )}
    </article>
  );
}

function ScoreHistory({
  scores,
  ended,
}: {
  scores: NonNullable<Player['private']>['scores'];
  ended: boolean;
}) {
  return (
    <details className="ra-personal-score">
      <summary>{ended ? '时代计分' : '我的时代计分'}</summary>
      {scores.map((score) => (
        <section key={score.epoch}>
          <strong>
            第 {score.epoch} 时代 · 累计 {score.total} 分
          </strong>
          <p>
            本次变动 {score.delta > 0 ? '+' : ''}
            {score.delta} 分
          </p>
          {score.total === 0 &&
            Object.values(score.parts).reduce((sum, value) => sum + value, 0) <
              score.delta && <p>累计分按 0 分下限记录。</p>}
          <ul>
            {Object.entries(score.parts).map(([part, value]) => (
              <li key={part}>
                {names[part as keyof typeof names]} {value}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </details>
  );
}

function RuleButton({
  label,
  className,
  face,
  dialog,
  onOpen,
  children,
}: {
  label: string;
  className: string;
  face?: string;
  dialog: string;
  onOpen: () => void;
  children: ReactNode;
}) {
  const press = useRef<{
    id: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const moved = useRef(false);
  const cancel = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };
  useEffect(
    () => () => {
      if (press.current) clearTimeout(press.current.timer);
    },
    [],
  );

  return (
    <button
      type="button"
      aria-label={label}
      aria-haspopup="dialog"
      aria-controls={dialog}
      className={className}
      data-face={face}
      onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return;
        cancel();
        moved.current = false;
        press.current = {
          id: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          timer: setTimeout(onOpen, 480),
        };
      }}
      onPointerMove={(event) => {
        const start = press.current;
        if (
          start?.id === event.pointerId &&
          Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10
        ) {
          moved.current = true;
          cancel();
        }
      }}
      onPointerLeave={cancel}
      onPointerUp={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onClick={(event) => {
        if (event.detail === 0 || !moved.current) onOpen();
      }}
    >
      {children}
    </button>
  );
}

function RiverDiagram({ flooded }: { flooded: boolean }) {
  return (
    <div
      className="ra-river-inscription"
      data-flooded={flooded}
      aria-hidden="true"
    >
      <div className="ra-inscription ra-nile-inscription">
        <div data-current={flooded}>
          <span>1+</span> <InscribedTile motif="flood" /> <span>:</span>{' '}
          <PerTile motif="nile" points={1} />
        </div>
        <div data-current={!flooded}>
          <span>0</span> <InscribedTile motif="flood" /> <span>:</span>{' '}
          <PerTile motif="nile" points={0} />
        </div>
      </div>
      <PerTile motif="flood" points={1} />
      <span className="ra-personal-drought">
        <BoardIcon name="nile" />
        <span>←</span>
        <BoardIcon name="link" />
        <b>×{pool.get('drought')}</b>
        <BoardIcon name="flood" />
      </span>
    </div>
  );
}

function RuleArtwork({ rule, flooded }: { rule: Rule; flooded: boolean }) {
  return (
    <div className="ra-rule-artwork">
      <div className="ra-personal-resource-head">
        {rule !== 'disks' && <BoardIcon name={rule} />}
        <Epochs onlyThird={rule === 'disks' || rule === 'monument'} />
      </div>
      {rule === 'disks' ? (
        <Comparison motif="disks" />
      ) : rule === 'flood' || rule === 'nile' ? (
        <RiverDiagram flooded={flooded} />
      ) : (
        <RulesDiagram kind={rule} />
      )}
    </div>
  );
}

function HoldingShelf({
  held,
  projection,
  epoch,
  ended,
}: {
  held: Tile[];
  projection: Projection | null;
  epoch: number;
  ended: boolean;
}) {
  const [rule, setRule] = useState<Rule>();
  const dialog = useRef<HTMLDialogElement>(null);
  const dialogId = useId();
  const titleId = useId();
  const groups = groupTiles(held);
  const flooded = held.some((tile) => tile.kind === 'flood');
  useEffect(() => {
    const panel = dialog.current;
    if (rule && panel && !panel.open) panel.showModal();
  }, [rule]);

  return (
    <>
      <section
        className="ra-forecast"
        aria-label="石板和预期收益"
        data-state={ended ? 'ended' : projection ? 'ready' : 'pending'}
      >
        <header className="ra-forecast-heading">
          <span>已有石板</span>
          {!ended && (
            <div className="ra-forecast-label">
              本时代预期收益
              <strong
                className="ra-forecast-total"
                data-points={projection?.delta}
              >
                {projection ? <PointChip value={projection.delta} /> : '—'}
              </strong>
            </div>
          )}
        </header>
        {!ended && !projection && (
          <p className="ra-forecast-hint">灾难处理后更新</p>
        )}
        {epoch === 3 && !ended && (
          <RuleButton
            className="ra-forecast-disk-rule"
            label="圆盘另计，查看规则"
            dialog={dialogId}
            onOpen={() => setRule('disks')}
          >
            <SunDisk /> 圆盘另计
          </RuleButton>
        )}
        {held.length === 0 && <p className="ra-forecast-hint">尚无石板</p>}
        <div className="ra-holding-rows">
          {categories.map((category) => {
            const entries = groups.filter(({ tile }) =>
              category === 'river'
                ? tile.kind === 'nile' || tile.kind === 'flood'
                : tile.kind === category,
            );
            const points = projection?.parts[category];
            if (entries.length === 0 && !points) return null;
            return (
              <div
                className="ra-holding-row"
                data-category={category}
                role="group"
                aria-label={names[category]}
                key={category}
              >
                <div className="ra-holding-shelf">
                  {entries.length ? (
                    entries.map(({ tile, count }) => (
                      <RuleButton
                        key={tile.face}
                        className="ra-holding-tile"
                        label={`${tileNames[tile.face]} ×${count}，查看计分规则`}
                        face={tile.face}
                        dialog={dialogId}
                        onOpen={() => setRule(tile.kind as Resource)}
                      >
                        <TileFace tile={tile} decorative />
                        {count > 1 && <b aria-hidden="true">×{count}</b>}
                      </RuleButton>
                    ))
                  ) : (
                    <RuleButton
                      className="ra-holding-tile"
                      label={`查看${names[category]}计分规则`}
                      dialog={dialogId}
                      onOpen={() =>
                        setRule(category === 'river' ? 'nile' : category)
                      }
                    >
                      <BoardIcon
                        name={category === 'river' ? 'nile' : category}
                      />
                    </RuleButton>
                  )}
                </div>
                {!ended && (
                  <div
                    className="ra-holding-gain"
                    data-points={points}
                    aria-label={
                      points === undefined ? '待处理' : `预期收益 ${points} 分`
                    }
                  >
                    {points === undefined ? '—' : <PointChip value={points} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {held.length > 0 && <p className="ra-forecast-hint">按住石板看计分</p>}
      </section>
      <dialog
        ref={dialog}
        id={dialogId}
        className="ra-holding-dialog"
        data-rule={rule}
        aria-labelledby={titleId}
        onClose={() => setRule(undefined)}
      >
        {rule && (
          <>
            <header>
              <h3 id={titleId}>{names[rule]}计分</h3>
              <button type="button" onClick={() => dialog.current?.close()}>
                关闭
              </button>
            </header>
            <RuleArtwork rule={rule} flooded={flooded} />
            <p>{ruleText[rule]}</p>
          </>
        )}
      </dialog>
    </>
  );
}

export function PlayerBoard({
  player,
  name,
  active,
  primary = false,
  ended = false,
  projection,
  epoch,
}: {
  player: Player;
  name: string;
  active: boolean;
  primary?: boolean;
  ended?: boolean;
  projection: Projection | null;
  epoch: number;
}) {
  const spent =
    player.private?.spentDisks ??
    Array.from({ length: player.spent }, () => undefined);

  return (
    <article
      aria-label={`${name}的玩家板`}
      className="ra-personal"
      data-active={active}
      data-primary={primary}
    >
      <header className="ra-personal-heading">
        <h2>{name}</h2>
        {player.private && <strong>{player.private.score} 分</strong>}
      </header>
      <div className="ra-personal-disc-row" role="group" aria-label="太阳圆盘">
        <div className="ra-personal-discs">
          <Disks available={player.disks} spent={spent} />
        </div>
      </div>
      <HoldingShelf
        held={player.held}
        projection={projection}
        epoch={epoch}
        ended={ended}
      />
      {player.private && player.private.scores.length > 0 && (
        <ScoreHistory scores={player.private.scores} ended={ended} />
      )}
    </article>
  );
}
