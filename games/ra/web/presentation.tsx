import { useEffect, useState } from 'react';
import type { GameHost, GameSetupSettingsProps } from '@tablemax/web-host';
import type { RaView } from '../rules';
import { tile } from '../rules/data';
import type { Scene, Breakdown } from '../rules/state';
import { SunDisk, TableArt, TileFace } from './art';
import { liveRaFeedback } from './feedback';
import './presentation.css';

export function RaSetupSettings({
  value,
  disabled,
  onChange,
}: GameSetupSettingsProps) {
  const enabled = !!(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.publicScoring === true
  );
  return (
    <label className="ra-scoring-setting">
      <input
        type="checkbox"
        checked={enabled}
        disabled={disabled}
        onChange={(event) => onChange({ publicScoring: event.target.checked })}
      />
      <span>
        公开计分
        <small>开启后，全桌可看到各席累计分与时代分项。开局后锁定。</small>
      </span>
    </label>
  );
}

const categories = [
  ['pharaoh', '法老'],
  ['god', '神明'],
  ['gold', '黄金'],
  ['river', '河流'],
  ['civilization', '文明'],
  ['monument', '纪念物'],
  ['disks', '太阳圆盘'],
] as const;

function tilesFor(ids: string[], category: keyof Breakdown) {
  const pieces = ids
    .map(tile)
    .filter(({ kind }) =>
      category === 'river'
        ? kind === 'nile' || kind === 'flood'
        : kind === category,
    );
  return pieces;
}

type Frame = { scene: Scene; step: number; duration: number; game: RaView };
type Flight = { id?: string; disk?: number; from: DOMRect; to: DOMRect };

function buildFrames(game: RaView): Frame[] {
  return game.scenes.flatMap<Frame>((scene) => {
    if (scene.kind !== 'settlement')
      return [
        { scene, step: -1, duration: scene.kind === 'won' ? 620 : 460, game },
      ];
    const count = scene.epoch === 3 ? 7 : 5;
    return [
      { scene, step: -1, duration: 500, game },
      ...Array.from({ length: count }, (_, step) => ({
        scene,
        step,
        duration: 700,
        game,
      })),
      { scene, step: 7, duration: 1000, game },
    ];
  });
}

function flightsFor(scene: Scene): Flight[] {
  if (scene.kind !== 'won' && scene.kind !== 'god') return [];
  const card = Array.from(
    document.querySelectorAll<HTMLElement>('[data-ra-seat]'),
  ).find((item) => item.dataset.raSeat === scene.seat);
  const to = card
    ?.querySelector('.ra-seat-summary-disks')
    ?.getBoundingClientRect();
  if (!to) return [];
  const slots = document.querySelectorAll('.ra-lot > li');
  const boards =
    scene.kind === 'won' ? scene.tiles : [{ id: scene.id, slot: scene.slot }];
  const flights: Flight[] = boards.flatMap(({ id, slot }) => {
    const from = slots[slot]?.getBoundingClientRect();
    return from ? [{ id, from, to }] : [];
  });
  if (scene.kind === 'god') {
    const from = slots[scene.slot]?.getBoundingClientRect();
    if (from) flights.push({ id: scene.godId, from: to, to: from });
  } else {
    const from = document
      .querySelector('.ra-central-disk')
      ?.getBoundingClientRect();
    if (from) flights.push({ disk: scene.disk, from, to });
  }
  return flights;
}

const sceneTitles = {
  ra: '拉',
  auction: '开始拍卖',
  won: '成交',
  god: '神迹',
  disaster: '灾难',
  settlement: '时代结算',
};

export function RaPresentation({
  session,
  game,
}: {
  session: GameHost;
  game: RaView | null;
}) {
  const feedback = liveRaFeedback(session);
  const [active, setActive] = useState<{
    frames: Frame[];
    index: number;
    flights: Flight[];
    serial: string;
  }>();
  const revision = feedback?.revision;
  useEffect(() => {
    if (revision === undefined || !game?.scenes.length) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const frames = buildFrames(game);
    const frame = requestAnimationFrame(() => {
      const flights = flightsFor(frames[0]!.scene);
      setActive((current) => {
        if (current?.frames.some(({ scene }) => scene.kind === 'settlement')) {
          if (!frames.some(({ scene }) => scene.kind === 'settlement'))
            return current;
          return {
            ...current,
            frames: [...current.frames.slice(0, current.index + 1), ...frames],
          };
        }
        return { frames, index: 0, flights, serial: String(revision) };
      });
    });
    return () => cancelAnimationFrame(frame);
    // Start only from a new matching saved feedback revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);
  const frame = active?.frames[active.index];
  useEffect(() => {
    if (!frame || !active) return;
    const timer = window.setTimeout(() => {
      const index = active.index + 1;
      const next = active.frames[index];
      setActive(
        next
          ? { ...active, index, flights: flightsFor(next.scene) }
          : undefined,
      );
    }, frame.duration);
    return () => window.clearTimeout(timer);
  }, [active, frame]);
  if (!active || !frame) return null;
  const { scene, step, duration } = frame;
  const category = categories[step];
  const settlement = scene.kind === 'settlement';
  return (
    <>
      <div
        className="ra-scene"
        key={active.serial + ':' + active.index}
        data-scene={scene.kind}
        data-disaster={
          scene.kind === 'disaster' ? tile(scene.id).face : undefined
        }
        style={{ '--scene-time': duration + 'ms' } as React.CSSProperties}
        aria-hidden="true"
      >
        <span className="ra-scene-light" />
        {scene.kind === 'ra' && <span className="ra-scene-sunring" />}
        {active.flights.map(({ id, disk, from, to }, i) => (
          <div
            key={id ?? 'disk'}
            className="ra-scene-flight"
            style={
              {
                left: from.left + from.width / 2,
                top: from.top + from.height / 2,
                '--dx':
                  to.left + to.width / 2 - from.left - from.width / 2 + 'px',
                '--dy':
                  to.top + to.height / 2 - from.top - from.height / 2 + 'px',
                animationDelay: Math.min(i, 7) * 22 + 'ms',
              } as React.CSSProperties
            }
          >
            {id ? <TileFace tile={tile(id)} /> : <SunDisk value={disk!} />}
          </div>
        ))}
        {(scene.kind === 'ra' ||
          scene.kind === 'auction' ||
          scene.kind === 'disaster' ||
          settlement) && (
          <div className="ra-scene-caption">
            {scene.kind === 'ra' && <TileFace tile={tile('ra-1')} />}
            {scene.kind === 'auction' && (
              <TableArt piece="ra-statue" className="ra-scene-emblem" />
            )}
            {scene.kind === 'disaster' && <TileFace tile={tile(scene.id)} />}
            {settlement && step === -1 && (
              <TableArt piece="sun-boat" className="ra-scene-emblem" />
            )}
            <strong>
              {settlement
                ? (category?.[1] ??
                  (step === 7 ? '总分结算' : '第 ' + scene.epoch + ' 时代结算'))
                : sceneTitles[scene.kind]}
            </strong>
          </div>
        )}
        {scene.kind === 'disaster' && (
          <div className="ra-disaster-loss">
            <strong>
              {session.view?.seats.find(({ id }) => id === scene.seat)?.name}
            </strong>
            {scene.discarded.map((id) => (
              <TileFace key={id} tile={tile(id)} />
            ))}
          </div>
        )}
        {settlement &&
          step !== -1 &&
          (step !== 7 || frame.game.publicScores) && (
            <div className="ra-settlement-seats">
              {scene.holdings.map(({ seat, ids }) => {
                const score = frame.game.publicScores?.find(
                  (item) => item.seat === seat,
                )?.latest;
                const valid = score?.epoch === scene.epoch ? score : null;
                const delta =
                  category && valid ? valid.parts[category[0]] : undefined;
                const pieces = category ? tilesFor(ids, category[0]) : [];
                const pharaohCounts = scene.holdings.map(
                  ({ ids }) => tilesFor(ids, 'pharaoh').length,
                );
                const max = Math.max(...pharaohCounts);
                const min = Math.min(...pharaohCounts);
                const comparison =
                  category?.[0] === 'pharaoh' && max !== min
                    ? pieces.length === max
                      ? 'high'
                      : pieces.length === min
                        ? 'low'
                        : undefined
                    : undefined;
                const disks =
                  category?.[0] === 'disks'
                    ? frame.game.players.find((player) => player.seat === seat)
                    : undefined;
                const grouped = Object.entries(
                  pieces.reduce<Record<string, number>>((counts, piece) => {
                    counts[piece.face] = (counts[piece.face] ?? 0) + 1;
                    return counts;
                  }, {}),
                );
                const floor = valid
                  ? valid.delta -
                    Object.values(valid.parts).reduce(
                      (sum, value) => sum + value,
                      0,
                    )
                  : 0;
                return (
                  <article
                    key={seat}
                    data-category={category?.[0]}
                    data-comparison={comparison}
                  >
                    <b>
                      {session.view?.seats.find(({ id }) => id === seat)
                        ?.name ?? seat}
                    </b>
                    <div className="ra-settlement-tiles">
                      {grouped.map(([face, count]) => (
                        <span key={face} data-face={face}>
                          <TileFace
                            tile={pieces.find((piece) => piece.face === face)!}
                          />
                          {count > 1 && '×' + count}
                        </span>
                      ))}
                      {category?.[0] === 'river' &&
                        pieces.some(({ kind }) => kind === 'flood') && (
                          <i>洪水激活尼罗河</i>
                        )}
                      {category?.[0] === 'civilization' && (
                        <i>{grouped.length} 种</i>
                      )}
                      {category?.[0] === 'pharaoh' && (
                        <i>
                          {pieces.length} 枚{' '}
                          {comparison === 'high'
                            ? '最多'
                            : comparison === 'low'
                              ? '最少'
                              : ''}
                        </i>
                      )}
                      {disks &&
                        [
                          ...disks.disks,
                          ...(disks.private?.spentDisks ?? []),
                        ].map((disk) => <SunDisk key={disk} value={disk} />)}
                      {category?.[0] === 'god' && <i>每枚 ×2</i>}
                      {category?.[0] === 'gold' && <i>每枚 ×3</i>}
                      {category?.[0] === 'monument' && (
                        <i>{grouped.length} 种</i>
                      )}
                    </div>
                    {delta !== undefined && (
                      <strong
                        className="ra-stage-points"
                        data-negative={delta < 0}
                      >
                        {delta > 0
                          ? '+' + delta
                          : delta < 0
                            ? '−' + Math.abs(delta)
                            : '0'}
                      </strong>
                    )}
                    {step === 7 && valid && (
                      <strong className="ra-stage-points">
                        {valid.total}
                        {floor > 0 && <small> 下限修正 +{floor}</small>}
                      </strong>
                    )}
                  </article>
                );
              })}
            </div>
          )}
      </div>
      {active.frames.some(({ scene }) => scene.kind === 'settlement') && (
        <button
          className="ra-skip-presentation secondary"
          type="button"
          onClick={() => setActive(undefined)}
        >
          跳过演出
        </button>
      )}
    </>
  );
}
