import type { ReactNode } from 'react';
import type { RaView } from '../rules';
import { tile, tileIds, type Tile } from '../rules/data';
import { SunDisk, TileFace } from './art';
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
type Icon = Resource | 'keep' | 'discard' | 'link' | 'group';
type Motif = Resource | 'disks' | 'wild';
type Badge = '=' | '≠' | '↑' | '↓';

const left = ['monument', 'pharaoh', 'nile'] as const;
const right = ['god', 'gold', 'civilization', 'flood'] as const;
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
  keep: (
    <path d="M12 12c-3-4-5-5-7-4-4 2-3 8 1 8 2 0 4-2 6-4 3-4 5-5 7-4 4 2 3 8-1 8-2 0-4-2-6-4Z" />
  ),
  discard: (
    <>
      <path
        d="M3 18V8a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v7l-3 3Z"
        fill="#a89071"
        stroke="none"
      />
      <path
        d="M9 11q8-1 11 7m-5-1 5 2 1-5"
        stroke="#ed8c76"
        strokeWidth="2.5"
      />
    </>
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
    <>
      {motif === 'disks' && (
        <span className="ra-rule-sigil" aria-hidden="true">
          <PointChip value={5} />
          <PointChip value={penalty} />
        </span>
      )}
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
    </>
  );
}

function PerTile({ motif, points }: { motif: Motif; points: number }) {
  return (
    <span className="ra-per-tile">
      <PointChip value={points} /> × <InscribedTile motif={motif} />
    </span>
  );
}

function Tokens({ tiles }: { tiles: Tile[] }) {
  const groups = new Map<string, { tile: Tile; count: number }>();
  for (const tile of tiles) {
    const group = groups.get(tile.face);
    if (group) group.count++;
    else groups.set(tile.face, { tile, count: 1 });
  }
  return (
    <div className="ra-personal-tiles">
      {[...groups.values()].map(({ tile, count }) => (
        <span
          key={tile.face}
          className="ra-personal-stack"
          data-stacked={count > 1}
        >
          <TileFace tile={tile} />
          {count > 1 && <b>×{count}</b>}
        </span>
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

function ResourcePanel({
  kind,
  held,
  flooded,
}: {
  kind: Resource;
  held: Tile[];
  flooded: boolean;
}) {
  return (
    <div
      className="ra-personal-resource"
      data-kind={kind}
      aria-label={names[kind]}
      role="group"
    >
      <div className="ra-personal-resource-head">
        <BoardIcon name={kind} />
        <Epochs onlyThird={kind === 'monument'} />
      </div>
      <RulesDiagram kind={kind} />
      {kind === 'nile' && (
        <div className="ra-inscription ra-nile-inscription" aria-hidden="true">
          <div data-current={flooded}>
            <span>1+</span> <InscribedTile motif="flood" /> <span>:</span>{' '}
            <PerTile motif="nile" points={1} />
          </div>
          <div data-current={!flooded}>
            <span>0</span> <InscribedTile motif="flood" /> <span>:</span>{' '}
            <PerTile motif="nile" points={0} />
          </div>
        </div>
      )}
      {kind === 'flood' && (
        <div
          className="ra-inscription-single ra-flood-inscription"
          aria-hidden="true"
        >
          <PerTile motif="flood" points={1} />
        </div>
      )}
      <Tokens tiles={held.filter((tile) => tile.kind === kind)} />
    </div>
  );
}

function PlayerLegend() {
  return (
    <details className="ra-personal-legend">
      <summary>图例</summary>
      <div className="ra-expanded-inscriptions">
        {(['monument', 'pharaoh', 'god', 'gold', 'civilization'] as const).map(
          (kind) => (
            <section
              key={kind}
              aria-label={names[kind]}
              className="ra-legend-resource"
            >
              <div className="ra-personal-resource-head">
                <BoardIcon name={kind} />
                <Epochs onlyThird={kind === 'monument'} />
              </div>
              <RulesDiagram kind={kind} />
            </section>
          ),
        )}
        <section aria-label="太阳圆盘" className="ra-legend-disks">
          <Epochs onlyThird />
          <Comparison motif="disks" />
        </section>
      </div>
      <dl>
        <dt>
          <BoardIcon name="keep" /> 保留
        </dt>
        <dd>左侧跨时代保留，仍可被相应灾难弃置。</dd>
        <dt>
          <BoardIcon name="discard" /> 弃置
        </dt>
        <dd>右侧在时代计分后弃置。</dd>
        <dt>
          <Epochs /> 每时代计分
        </dt>
        <dd>
          法老最多 +5、最少 −2；全桌相同则为 0。神明剩余每枚 +2，黄金每枚
          +3。文明按不同种类数计分，0／1／2／3／4／5 类对应 −5／0／0／5／10／15
          分。
        </dd>
        <dt>
          <Epochs onlyThird /> 仅第三时代
        </dt>
        <dd>
          纪念物相同的每组 3／4／5 枚得 5／10／15 分，再以不同种类数加分，1–6
          种每种 1 分，7／8 种得 10／15 分。圆盘两面合计，最高 +5、最低
          −5、全桌相同为 0，中央盘不算。
        </dd>
        <dt>
          <BoardIcon name="flood" /> 河流
        </dt>
        <dd>
          洪水本身每枚 +1；有洪水时尼罗河每枚 +1，无洪水时尼罗河 0
          分。旱灾先弃洪水再弃尼罗河。
        </dd>
      </dl>
      <p>开局供给／相关灾难总数</p>
      <ul className="ra-personal-pool">
        <li>
          <BoardIcon name="monument" /> 8×{pool.get('pyramid')} /{' '}
          {pool.get('earthquake')}
        </li>
        <li>
          <BoardIcon name="pharaoh" /> {pool.get('pharaoh')} /{' '}
          {pool.get('funeral')}
        </li>
        <li>
          <BoardIcon name="god" /> {pool.get('god')} / 0
        </li>
        <li>
          <BoardIcon name="gold" /> {pool.get('gold')} / 0
        </li>
        <li>
          <BoardIcon name="civilization" /> 5×{pool.get('art')} /{' '}
          {pool.get('war')}
        </li>
        <li>
          <BoardIcon name="nile" /> {pool.get('nile')} <BoardIcon name="link" />{' '}
          <BoardIcon name="flood" /> {pool.get('flood')} / {pool.get('drought')}
        </li>
      </ul>
    </details>
  );
}

type Player = RaView['players'][number];
type PublicPlayer = Pick<Player, 'disks' | 'spent' | 'held'>;

function Disks({
  available,
  spent,
}: {
  available: Player['disks'];
  spent: readonly (number | undefined)[];
}) {
  return (
    <>
      {available.map((disk) => (
        <span key={disk}>
          <SunDisk value={disk} />
        </span>
      ))}
      {spent.map((disk, index) => (
        <span
          key={`spent-${index}`}
          data-spent="true"
          role="img"
          aria-label={disk === undefined ? '已用太阳盘' : `已用太阳盘 ${disk}`}
        >
          {disk === undefined ? <SunDisk /> : <SunDisk value={disk} />}
        </span>
      ))}
    </>
  );
}

export function PlayerSummary({
  player,
  name,
  active,
}: {
  player: PublicPlayer;
  name: string;
  active: boolean;
}) {
  return (
    <article
      aria-label={`${name}的公开摘要`}
      className="ra-seat-summary"
      data-active={active}
    >
      <h2 className="ra-seat-summary-heading">{name}</h2>
      <div className="ra-seat-summary-disks" role="group" aria-label="太阳圆盘">
        <Disks
          available={player.disks}
          spent={Array.from({ length: player.spent }, () => undefined)}
        />
      </div>
      <Tokens tiles={player.held} />
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

export function PlayerBoard({
  player,
  name,
  active,
  primary = false,
  ended = false,
}: {
  player: Player;
  name: string;
  active: boolean;
  primary?: boolean;
  ended?: boolean;
}) {
  const flooded = player.held.some((tile) => tile.kind === 'flood');
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
      <div className="ra-personal-grid">
        <div
          className="ra-personal-side ra-personal-keep"
          role="group"
          aria-label="跨时代保留"
        >
          <span className="ra-personal-life" aria-hidden="true">
            <BoardIcon name="keep" />
          </span>
          {left.map((kind) => (
            <ResourcePanel
              key={kind}
              kind={kind}
              held={player.held}
              flooded={flooded}
            />
          ))}
        </div>
        <div
          className="ra-personal-disc-row"
          role="group"
          aria-label="太阳圆盘"
        >
          <div className="ra-personal-discs">
            <Disks available={player.disks} spent={spent} />
          </div>
          <Epochs onlyThird />
          <Comparison motif="disks" />
        </div>
        <div
          className="ra-personal-side ra-personal-discard"
          role="group"
          aria-label="时代结算后弃置"
        >
          <span className="ra-personal-life" aria-hidden="true">
            <BoardIcon name="discard" />
          </span>
          {right.map((kind) => (
            <ResourcePanel
              key={kind}
              kind={kind}
              held={player.held}
              flooded={flooded}
            />
          ))}
        </div>
        <div
          className="ra-personal-water"
          data-flooded={flooded}
          role="img"
          aria-label={
            flooded
              ? '洪水已激活尼罗河，每枚洪水与尼罗河各一分。开局两枚旱灾，先弃洪水，再弃尼罗河。'
              : '至少一枚洪水才能激活尼罗河计分，当前未激活。开局两枚旱灾，先弃洪水，再弃尼罗河。'
          }
        >
          <PerTile motif="nile" points={flooded ? 1 : 0} />
          <span className="ra-personal-water-bridge">
            <i aria-hidden="true" />
            <span>
              ≥1 <InscribedTile motif="flood" />
            </span>
          </span>
          <PerTile motif="flood" points={1} />
          <span className="ra-personal-drought" aria-hidden="true">
            <BoardIcon name="nile" />
            <span>←</span>
            <BoardIcon name="link" />
            <b>×{pool.get('drought')}</b>
            <BoardIcon name="flood" />
          </span>
        </div>
      </div>
      <PlayerLegend />
      {player.private && player.private.scores.length > 0 && (
        <ScoreHistory scores={player.private.scores} ended={ended} />
      )}
    </article>
  );
}
