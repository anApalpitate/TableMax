import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { GameHost } from '@tablemax/web-host';
import { categories, abilityText, categoryPresentation } from '../cards';
import { AbilityEntrance } from '../../ui/AbilityEntrance';
import { coinArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { useExpansionPresentation } from './PresentationContext';
import type { View } from '../project';
import { PoseArt } from './poses';
import { poseSequences } from './poses/timeline';
import { BoardEffects } from './BoardEffects';
import { ordinaryTheme, type OrdinaryTheme } from './presentation';

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
  portraitFor,
}: {
  game: View;
  session: GameHost;
  portraitFor: (categoryId: string) => string | undefined;
}) {
  const { current, anchors } = useExpansionPresentation();
  if (!current) return null;
  const creature = current.kind === 'ability' ? current.creature : null;
  const sequence = creature ? poseSequences[creature] : undefined;
  const category = creature
    ? categories.find((c) => c.categoryId === 'special-' + creature)
    : undefined;
  const draw =
    current.kind === 'board' ? ordinaryTheme(current.event.action) : null;
  const coin = current.kind === 'ability' ? current.event.effect?.coin : null;
  const key = current.key;
  return (
    <>
      {draw && <OrdinaryBurst key={'draw:' + key} theme={draw} />}
      {current.kind === 'board' && (
        <BoardEffects
          key={'board:' + key}
          effects={current.effects}
          delay={0}
          anchors={anchors}
        />
      )}
      {creature && sequence && category && (
        <>
          {sequence.fullscreen ? (
            <div
              className="pokemon-screen ex-original-effects"
              data-sequence={creature}
              key={'pose:' + key}
            >
              <AbilityEntrance
                image={undefined}
                character={
                  <MotionPose
                    creatureId={creature}
                    durationMs={current.durationMs}
                  />
                }
                definition={{
                  id: creature,
                  motif:
                    creature === 'team-rocket'
                      ? 'comic'
                      : ['zapdos', 'arceus', 'lucario'].includes(creature)
                        ? 'electric'
                        : 'psychic',
                  side: 'left',
                  duration: current.durationMs,
                  title: category.name,
                  subtitle: categoryPresentation(category.categoryId)
                    .abilitySummary,
                }}
              />
            </div>
          ) : (
            <div
              className={'ex-local-ability ex-theme-' + creature}
              key={'pose:' + key}
              data-sequence={creature}
              style={
                { '--ex-duration': current.durationMs + 'ms' } as CSSProperties
              }
              aria-hidden="true"
            >
              <div className="ex-cinematic-creature">
                <MotionPose
                  creatureId={creature}
                  durationMs={current.durationMs}
                />
              </div>
              <strong>{category.name}</strong>
              <span>
                {categoryPresentation(category.categoryId).abilitySummary}
              </span>
            </div>
          )}
          <aside className="ex-static-hero" role="status">
            {portraitFor(category.categoryId) && (
              <img src={portraitFor(category.categoryId)} alt="" />
            )}
            <div>
              <strong>{category.name}</strong>
              <p>
                {category.ability
                  ? abilityText[category.ability]
                  : '复制相邻有效值'}
              </p>
            </div>
          </aside>
        </>
      )}
      {coin && (
        <div className="pokemon-screen ex-original-effects" key={'coin:' + key}>
          <div
            className="saved-effects coin-effects"
            data-coin={coin}
            aria-hidden="true"
          >
            <div className="effect-ring" />
            <span className="tossed-coin">
              <img src={coinArt[coin]} alt="" />
            </span>
            <span className="coin-effect-label">
              {coin === 'meowth' ? '喵喵面' : '皮卡丘面'}
            </span>
          </div>
        </div>
      )}
      {current.kind === 'research' && current.research && (
        <div
          key={'research:' + key}
          className="ex-research-reveal"
          data-research-event={current.event.id}
        >
          <span>研究任务发布</span>
          <strong>{current.research.name}</strong>
          <p>{current.research.description}</p>
          <b>结算减 {current.research.reward} 分</b>
        </div>
      )}
      {current.kind === 'result' && (
        <div
          className="pokemon-screen ex-original-effects"
          key={'result:' + key}
        >
          <BoardEffects
            effects={{ moves: [], cover: [], reveal: [], pulse: [] }}
            delay={0}
            anchors={anchors}
            winners={current.winners}
          />
          <div
            className={
              'saved-effects result-effects ' +
              (current.match ? 'match-fireworks' : '')
            }
            aria-hidden="true"
          >
            {Array.from({ length: current.match ? 5 : 2 }, (_, burst) => (
              <div
                className="firework-burst"
                key={burst}
                style={
                  {
                    '--burst-x': [18, 78, 48, 32, 88][burst] + '%',
                    '--burst-y': [26, 30, 15, 65, 63][burst] + '%',
                    '--burst-delay': burst * 110 + 'ms',
                  } as CSSProperties
                }
              >
                {Array.from({ length: 12 }, (_, spark) => (
                  <i
                    className="firework-spark"
                    key={spark}
                    style={
                      {
                        '--angle': spark * 30 + 'deg',
                        '--spark-color': ['#ffd85c', '#83e7ec', '#ff9ac7'][
                          burst % 3
                        ],
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
