import { useEffect, useState } from 'react';
import type { GameHost, GameSetupSettingsProps } from '@tablemax/web-host';
import type { RaView } from '../rules';
import { tile } from '../rules/data';
import type { Scene, Breakdown } from '../rules/state';
import { SunDisk, TileFace } from './art';
import { RaEntrance } from './entrance';
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

type Frame = {
  scene: Scene;
  step: number;
  duration: number;
  game: RaView;
  key: string;
  reducedMotion: boolean;
};
type Flight = { id?: string; disk?: number; from: DOMRect; to: DOMRect };
const entranceDuration = 1600;
const reducedEntranceDuration = 500;

function buildFrames(
  game: RaView,
  receipt: string,
  reducedMotion: boolean,
): Frame[] {
  const drawnRa = game.scenes.some(({ kind }) => kind === 'ra');
  return game.scenes.flatMap<Frame>((scene, index) => {
    // A drawn Ra already introduces the auction it opens in this receipt.
    if (scene.kind === 'auction' && drawnRa) return [];
    const frame = (step: number, duration: number) => ({
      scene,
      step,
      duration,
      game,
      reducedMotion,
      key: `${receipt}:${index}:${step}`,
    });
    const intro = frame(
      -1,
      reducedMotion ? reducedEntranceDuration : entranceDuration,
    );
    if (scene.kind !== 'settlement') return [intro];
    return [
      intro,
      ...Array.from({ length: scene.epoch === 3 ? 7 : 5 }, (_, step) =>
        frame(step, 700),
      ),
      frame(7, 1000),
    ];
  });
}

function flightsFor(scene: Scene): Flight[] {
  if (scene.kind !== 'won' && scene.kind !== 'god') return [];
  const card = Array.from(
    document.querySelectorAll<HTMLElement>('[data-ra-seat]'),
  ).find((item) => item.dataset.raSeat === scene.seat);
  const to = card?.querySelector('.ra-seat-holdings')?.getBoundingClientRect();
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
    const disks = card
      ?.querySelector('.ra-seat-summary-disks')
      ?.getBoundingClientRect();
    if (from && disks) flights.push({ disk: scene.disk, from, to: disks });
  }
  return flights;
}

export function RaPresentation({
  session,
  game,
  audioEnabled,
}: {
  session: GameHost;
  game: RaView | null;
  audioEnabled: boolean;
}) {
  const feedback = liveRaFeedback(session);
  const [active, setActive] = useState<{
    queue: Frame[];
    flights: Flight[];
  }>();
  const [queuedRevision, setQueuedRevision] = useState<number>();
  const revision = feedback?.revision;
  useEffect(() => {
    if (!feedback || !game?.scenes.length) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const receipt = `${feedback.instanceId}:${feedback.branch}:${feedback.revision}`;
    const frames = buildFrames(game, receipt, reduced);
    const flights = reduced ? [] : flightsFor(frames[0]!.scene);
    const request = requestAnimationFrame(() => {
      setQueuedRevision(feedback.revision);
      setActive((current) =>
        current
          ? { ...current, queue: [...current.queue, ...frames] }
          : { queue: frames, flights },
      );
    });
    return () => cancelAnimationFrame(request);
    // Start only from a new matching saved feedback revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);
  const frame = active?.queue[0];
  useEffect(() => {
    if (!frame) return;
    const timer = window.setTimeout(() => {
      setActive((current) => {
        if (current?.queue[0] !== frame) return current;
        const queue = current.queue.slice(1);
        const next = queue[0];
        if (!next) return undefined;
        return {
          queue,
          flights: next.reducedMotion ? [] : flightsFor(next.scene),
        };
      });
    }, frame.duration);
    return () => window.clearTimeout(timer);
  }, [frame]);
  const settlementPending =
    (revision !== undefined &&
      queuedRevision !== revision &&
      game?.scenes.some(({ kind }) => kind === 'settlement')) ||
    active?.queue.some(({ scene }) => scene.kind === 'settlement');
  const curtain = settlementPending && (
    <span className="ra-settlement-pending" hidden />
  );
  if (!active || !frame) return curtain || null;
  const { scene, step, duration } = frame;
  const category = categories[step];
  const settlement = scene.kind === 'settlement';
  return (
    <>
      {curtain}
      <div
        className="ra-scene"
        key={frame.key}
        data-scene={scene.kind}
        data-beat={step === -1 ? 'entrance' : 'scoring'}
        data-reduced={frame.reducedMotion || undefined}
        data-disaster={
          scene.kind === 'disaster' ? tile(scene.id).face : undefined
        }
        style={{ '--scene-time': duration + 'ms' } as React.CSSProperties}
        aria-hidden="true"
      >
        {step === -1 && (
          <RaEntrance
            scene={scene}
            soundKey={frame.key}
            reducedMotion={frame.reducedMotion}
            audioEnabled={audioEnabled}
          />
        )}
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
                '--flight-size': Math.min(101, from.width) + 'px',
                '--flight-delay': Math.min(i, 8) * 20 + 'ms',
              } as React.CSSProperties
            }
          >
            {id ? (
              <TileFace tile={tile(id)} preview decorative />
            ) : (
              <SunDisk value={disk!} />
            )}
          </div>
        ))}
        {settlement && step !== -1 && (
          <div className="ra-scene-caption">
            <strong>{category?.[1] ?? '总分结算'}</strong>
          </div>
        )}
        {scene.kind === 'disaster' &&
          scene.discarded.length > 0 &&
          !frame.reducedMotion && (
            <div className="ra-disaster-loss">
              {scene.discarded.map((id) => (
                <TileFace key={id} tile={tile(id)} preview decorative />
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
      <button
        className="ra-skip-presentation secondary"
        type="button"
        onClick={() => setActive(undefined)}
      >
        跳过演出
      </button>
    </>
  );
}
