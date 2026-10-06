import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameHost } from '@tablemax/web-host';
import { categories, abilityText } from '../cards';
import type { View } from '../project';
import { PoseArt } from './poses';
import { poseSequences } from './poses/timeline';
import { BoardEffects } from './BoardEffects';
import {
  ordinaryTheme,
  presentationCreature,
  presentationTiming,
  savedBoardEffects,
  type OrdinaryTheme,
} from './presentation';

/** The parent is keyed by saved event and branch. A cancelled clock never resumes. */
function MotionPose({
  creatureId,
  durationMs,
}: {
  creatureId: string;
  durationMs: number;
}) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      start: number | undefined,
      stopped = media.matches,
      last = -1;
    const tick = (now: number) => {
      if (stopped) return;
      start ??= now;
      const elapsed = now - start;
      if (elapsed - last >= 30 || elapsed >= durationMs) {
        setProgress(Math.min(1, elapsed / durationMs));
        last = elapsed;
      }
      if (elapsed < durationMs) frame = requestAnimationFrame(tick);
    };
    const cancel = () => {
      if (!media.matches) return;
      stopped = true;
      cancelAnimationFrame(frame);
      setProgress(1);
    };
    if (!stopped) frame = requestAnimationFrame(tick);
    media.addEventListener('change', cancel);
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      media.removeEventListener('change', cancel);
    };
  }, [durationMs]);
  return (
    <PoseArt
      creatureId={creatureId}
      progress={progress}
      className="ex-pose-art"
    />
  );
}

/** Lightweight, distinct themes around a newly drawn public card, not hidden slots. */
function OrdinaryBurst({ theme }: { theme: OrdinaryTheme }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    const category = `ordinary-${theme}`;
    const anchor =
      document.querySelector<HTMLElement>(
        `.ex-held [data-category="${category}"], .ex-supply [data-category="${category}"]`,
      ) ?? document.querySelector<HTMLElement>('.ex-held, .ex-supply');
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    svg.style.left = `${rect.x + rect.width / 2}px`;
    svg.style.top = `${rect.y + rect.height / 2}px`;
    svg.style.visibility = 'visible';
  }, [theme]);
  const water = ['magikarp', 'piplup', 'psyduck'].includes(theme);
  return (
    <svg
      ref={ref}
      viewBox="0 0 180 180"
      className={`ex-ordinary-burst ex-burst-${theme}`}
      data-ordinary-theme={theme}
      aria-hidden="true"
    >
      {water ? (
        <>
          <ellipse
            className="ex-burst-wave"
            cx="90"
            cy="113"
            rx="58"
            ry="16"
            fill="none"
          />
          <ellipse
            className="ex-burst-wave ex-burst-wave-two"
            cx="90"
            cy="113"
            rx="35"
            ry="9"
            fill="none"
          />
          {theme !== 'psyduck' &&
            (theme === 'piplup' ? [48, 90, 132] : [35, 66, 116, 145]).map(
              (x, i) => (
                <path
                  key={x}
                  className="ex-burst-droplet"
                  style={{ '--particle': i } as CSSProperties}
                  d={`M ${x} ${theme === 'piplup' ? 35 + Math.abs(1 - i) * 18 : 45 + (i % 2) * 20} q -12 18 0 24 q 12 -6 0 -24`}
                />
              ),
            )}
        </>
      ) : theme === 'rowlet' ? (
        <>
          {[25, 60, 115, 145].map((x, i) => (
            <path
              key={x}
              className="ex-burst-particle"
              style={{ '--particle': i } as CSSProperties}
              d={`M ${x} 120 q -15 -45 20 -65 q 10 38 -20 65 M ${x} 120 l 18 -51`}
            />
          ))}
        </>
      ) : theme === 'garchomp' ? (
        <>
          <path
            className="ex-burst-slash"
            d="M 28 135 Q 77 56 151 35 L 91 98 Z"
          />
          <path
            className="ex-burst-slash"
            d="M 40 147 Q 88 95 158 78 L 101 130 Z"
          />
          {[34, 60, 123].map((x) => (
            <circle
              key={x}
              className="ex-burst-particle"
              cx={x}
              cy="138"
              r="3"
            />
          ))}
        </>
      ) : theme === 'dragonite' ? (
        <>
          <path
            className="ex-burst-wind"
            d="M 19 76 Q 65 20 139 61 Q 171 89 137 93 M 32 110 Q 105 51 164 113 M 41 135 Q 83 105 139 135"
            fill="none"
          />
          <path
            className="ex-burst-wing"
            d="M 25 89 Q 27 37 78 47 L 59 62 L 68 79 Z M 155 89 Q 153 37 102 47 L 121 62 L 112 79 Z"
          />
        </>
      ) : theme === 'metagross' ? (
        <>
          <ellipse
            className="ex-burst-magnet"
            cx="90"
            cy="90"
            rx="64"
            ry="31"
            fill="none"
          />
          <ellipse
            className="ex-burst-magnet"
            cx="90"
            cy="90"
            rx="31"
            ry="64"
            fill="none"
          />
          <path
            className="ex-burst-particle"
            d="M 50 48 L 60 31 L 70 48 M 110 132 L 120 149 L 130 132"
            fill="none"
          />
        </>
      ) : theme === 'mimikyu' ? (
        <>
          <path
            className="ex-burst-shadow"
            d="M 32 113 Q 29 80 51 91 Q 48 48 73 69 Q 94 39 106 80 Q 150 56 142 104 Q 159 134 118 132 Q 86 158 62 134 Q 29 145 32 113"
          />
          <path
            className="ex-burst-thread"
            d="M 45 111 l 20 7 l -2 12 M 118 104 l 16 8 l -6 12"
            fill="none"
          />
        </>
      ) : (
        <>
          {theme === 'togepi' && (
            <path
              className="ex-burst-shell"
              d="M 37 121 L 44 86 L 66 102 L 86 78 L 109 104 L 139 85 L 143 121 Q 90 147 37 121"
            />
          )}
          {[40, 70, 117, 145].map((x, i) => (
            <path
              key={x}
              className="ex-burst-particle"
              style={{ '--particle': i } as CSSProperties}
              d={`M ${x} ${40 + (i % 2) * 24} l 4 9 l 9 4 l -9 4 l -4 9 l -4 -9 l -9 -4 l 9 -4 Z`}
            />
          ))}
        </>
      )}
    </svg>
  );
}

export function SavedEffects({
  game,
  session,
  portraitFor,
}: {
  game: View;
  session: GameHost;
  portraitFor: (categoryId: string) => string | undefined;
}) {
  if (
    session.view?.playMode === 'test' ||
    session.view?.paused ||
    !session.connected
  )
    return null;
  const fresh = game.events.filter((event) =>
    session.motion.includes(`event:${event.id}`),
  );
  const research = fresh.find((event) => event.kind === 'research');
  const action = [...fresh]
    .reverse()
    .find((event) => presentationCreature(event.action));
  const saved = [...fresh].reverse().find((event) => event.action);
  const draw = [...fresh]
    .reverse()
    .find((event) => ordinaryTheme(event.action));
  const creature = presentationCreature(action?.action);
  const sequence = creature ? poseSequences[creature] : undefined;
  const category = creature
    ? categories.find((c) => c.categoryId === `special-${creature}`)
    : undefined;
  const effects = savedBoardEffects(saved?.action, game.boards);
  const hasBoard =
    effects.moves.length +
      effects.cover.length +
      effects.reveal.length +
      effects.pulse.length >
    0;
  const duration = sequence?.durationMs ?? 0;
  const timing = presentationTiming(
    fresh,
    Object.fromEntries(
      Object.entries(poseSequences).map(([id, pose]) => [id, pose.durationMs]),
    ),
  );
  const scope = `${session.view?.instanceId}:${session.view?.branch}`;
  return (
    <>
      {draw && (
        <OrdinaryBurst
          key={`${scope}:draw:${draw.id}`}
          theme={ordinaryTheme(draw.action)!}
        />
      )}
      {hasBoard && saved && (
        <BoardEffects
          key={`${scope}:board:${saved.id}`}
          effects={effects}
          delay={duration}
        />
      )}
      {creature && sequence && category && action && (
        <>
          <div
            className={`${sequence.fullscreen ? 'ex-cinematic' : 'ex-local-ability'} ex-theme-${creature}`}
            key={`${scope}:pose:${action.id}`}
            style={{ '--ex-duration': `${duration}ms` } as CSSProperties}
            data-sequence={creature}
            aria-hidden="true"
          >
            <div className="ex-cinematic-rings" />
            {sequence.fullscreen && <div className="ex-cinematic-streaks" />}
            <div className="ex-cinematic-creature">
              <MotionPose creatureId={creature} durationMs={duration} />
            </div>
            <strong>{category.name}</strong>
            <span>
              {category.ability
                ? abilityText[category.ability]
                : category.copy === 'vertical'
                  ? '上下寻源 · 纵向复制'
                  : '左右寻源 · 横向复制'}
            </span>
          </div>
          <aside className="ex-static-hero" role="status">
            {portraitFor(category.categoryId) && (
              <img src={portraitFor(category.categoryId)} alt="" />
            )}
            <div>
              <strong>{category.name}</strong>
              <p>
                {category.ability
                  ? abilityText[category.ability]
                  : category.copy === 'vertical'
                    ? '复制上下紧邻有效值'
                    : '复制左右紧邻有效值'}
              </p>
            </div>
          </aside>
        </>
      )}
      {research && game.activeResearch.length > 0 && (
        <div
          key={`${scope}:research:${research.id}`}
          className="ex-research-reveal"
          data-research-event={research.id}
          style={
            {
              '--ex-delay': `${timing.researchDelayMs}ms`,
            } as CSSProperties
          }
        >
          <span>特殊研究发布</span>
          <strong>{game.activeResearch.at(-1)!.name}</strong>
          <p>{game.activeResearch.at(-1)!.description}</p>
          <b>结算减 {game.activeResearch.at(-1)!.reward} 分</b>
          {game.voteCounts && game.activeResearch.length === 1 && (
            <div className="ex-reveal-votes">
              {game.researchCandidates.map((task) => (
                <span key={task.id}>
                  {task.name} {game.voteCounts![task.id]}票
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
