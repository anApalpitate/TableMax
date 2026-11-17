import { useEffect, useId, useState, type ReactNode } from 'react';
import { SettingHelp, type GameHost, type GameSetupSettingsProps } from '@tablemax/web-host';
import type { RaView } from '../rules';
import { tile } from '../rules/data';
import type { Scene } from '../rules/state';
import { SunDisk, TileFace } from './art';
import { RaEntrance } from './entrance';
import { liveRaFeedback } from './feedback';
import {
  scoringStep,
  totalStep,
  scoreCategories,
  type SettlementTable,
} from './settlement';
import { RaScoreSound } from './score-motion';
import './presentation.css';

export function RaSetupSettings({
  value,
  disabled,
  onChange,
}: GameSetupSettingsProps) {
  const labelId = useId();
  const enabled = !!(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.publicScoring === true
  );
  return (
    <div className="display-settings-choice ra-scoring-setting">
      <SettingHelp
        id={labelId}
        label="公开计分"
        hint="开启后，全桌可看到各席累计分与时代分项。开局后锁定。"
      />
      <button
        type="button"
        className="secondary"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={labelId}
        disabled={disabled}
        onClick={() => onChange({ publicScoring: !enabled })}
      >
        <span className={`settings-switch${enabled ? ' settings-switch--on' : ''}`} aria-hidden="true" />
        {enabled ? '已开启' : '已关闭'}
      </button>
    </div>
  );
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
      frame(totalStep, 1000),
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
  children,
}: {
  session: GameHost;
  game: RaView | null;
  audioEnabled: boolean;
  children: (table?: SettlementTable) => ReactNode;
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
  const queued = active?.queue.find(({ scene }) => scene.kind === 'settlement');
  const pending =
    revision !== undefined && queuedRevision !== revision
      ? game?.scenes.find((scene) => scene.kind === 'settlement')
      : undefined;
  const table: SettlementTable | undefined =
    queued?.scene.kind === 'settlement'
      ? { ...queued, scene: queued.scene }
      : pending && game
        ? {
            scene: pending,
            game,
            step: -1,
            key: String(revision),
          }
        : undefined;
  const curtain = table && <span className="ra-settlement-pending" hidden />;
  if (!active || !frame)
    return (
      <>
        {curtain}
        {children(table)}
      </>
    );
  const { scene, step, duration } = frame;
  const category = scoreCategories[step];
  const settlement = scene.kind === 'settlement';
  const scoreStep = settlement ? scoringStep(step) : undefined;
  return (
    <>
      {curtain}
      {children(table)}
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
              <TileFace tile={tile(id)} decorative />
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
        {scoreStep && table && (
          <RaScoreSound
            table={table}
            category={scoreStep}
            enabled={audioEnabled}
          />
        )}
        {scene.kind === 'disaster' &&
          scene.discarded.length > 0 &&
          !frame.reducedMotion && (
            <div className="ra-disaster-loss">
              {scene.discarded.map((id) => (
                <TileFace key={id} tile={tile(id)} decorative />
              ))}
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
