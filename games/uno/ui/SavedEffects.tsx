import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import type { UnoView } from '../types';
import { Card } from './Card';
import {
  unoCuePresentation,
  unoCueSymbol,
  unoSavedCue,
  type UnoCue,
} from './saved-feedback';

const colors = {
  red: '#d94c3d',
  yellow: '#dfb936',
  green: '#3c9461',
  blue: '#318bbb',
};

function CueEmblem({ cue }: { cue: UnoCue }) {
  const wheel = cue === 'wild' || cue === 'draw-four';
  const cards =
    cue === 'draw-two'
      ? 2
      : cue === 'challenge-failure'
        ? 6
        : cue === 'draw-four' || cue === 'accept-four'
          ? 4
          : 0;
  return (
    <svg className="uno-cue-emblem" viewBox="0 0 160 160" aria-hidden="true">
      {wheel && (
        <g className="uno-cue-wheel">
          <path d="M80 80V15a65 65 0 0 1 65 65Z" fill={colors.red} />
          <path d="M80 80h65a65 65 0 0 1-65 65Z" fill={colors.yellow} />
          <path d="M80 80v65a65 65 0 0 1-65-65Z" fill={colors.green} />
          <path d="M80 80H15a65 65 0 0 1 65-65Z" fill={colors.blue} />
          <circle
            cx="80"
            cy="80"
            r="65"
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
          />
        </g>
      )}
      {cue === 'reverse' && (
        <g
          className="uno-cue-arrows"
          fill="none"
          stroke="currentColor"
          strokeWidth="12"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M26 60a58 58 0 0 1 99-25l12 15M137 22v29h-29" />
          <path d="M134 100a58 58 0 0 1-99 25l-12-15M23 138v-29h29" />
        </g>
      )}
      {cue === 'skip' && (
        <g
          className="uno-cue-stop"
          fill="none"
          stroke="currentColor"
          strokeWidth="13"
        >
          <circle cx="80" cy="80" r="59" />
          <path d="m38 122 84-84" />
        </g>
      )}
      {cards > 0 && (
        <g className="uno-cue-cards">
          {Array.from({ length: cards }, (_, index) => (
            <rect
              key={index}
              x="51"
              y="25"
              width="58"
              height="96"
              rx="9"
              transform={`rotate(${(index - (cards - 1) / 2) * 13} 80 126)`}
              fill={Object.values(colors)[index % 4]}
              stroke="currentColor"
              strokeWidth="5"
            />
          ))}
        </g>
      )}
      {(cue === 'uno' || cue === 'catch-uno') && (
        <g
          className="uno-cue-callout"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeLinecap="round"
        >
          {cue === 'uno' ? (
            <>
              <circle cx="80" cy="80" r="49" />
              <path d="M80 8v12m0 120v12M8 80h12m120 0h12M29 29l9 9m84 84 9 9M29 131l9-9m84-84 9-9" />
            </>
          ) : (
            <>
              <circle cx="68" cy="65" r="47" />
              <path d="m103 101 37 37M68 40v30m0 16v2" />
            </>
          )}
        </g>
      )}
      {cue.startsWith('challenge') && (
        <g
          className="uno-cue-verdict"
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M80 16v119M47 137h66M33 48h94M33 48 15 87h36Zm94 0-18 39h36Z" />
          {cue === 'challenge-success' ? (
            <path d="m54 99 19 18 36-39" />
          ) : cue === 'challenge-failure' ? (
            <path d="m61 90 38 38m0-38-38 38" />
          ) : (
            <path d="M66 105c0-18 27-16 27-34M79 127v1" />
          )}
        </g>
      )}
      {cue === 'win' && (
        <path
          className="uno-cue-victory"
          d="m80 12 19 43 47 5-35 33 10 46-41-24-41 24 10-46L14 60l47-5Z"
          fill="#f3ce54"
          stroke="currentColor"
          strokeWidth="7"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

/** Mounted only by the existing new-saved-result gate in the UNO screen. */
export function SavedEffect({ game }: { game: UnoView }) {
  const layer = useRef<HTMLDivElement>(null);
  const latest = game.latest;
  useLayoutEffect(() => {
    const element = layer.current;
    if (!element || !latest) return;
    const seat = (id: string | null) =>
      id
        ? document.querySelector<HTMLElement>(
            `.uno-seat[data-seat-id="${CSS.escape(id)}"]`,
          )
        : null;
    const discard = document.querySelector<HTMLElement>(
      '.uno-discard-pile > .uno-card',
    );
    const deck = document.querySelector<HTMLElement>(
      '.uno-draw-pile > .uno-card',
    );
    const hand = document.querySelector<HTMLElement>('.uno-hand-scroll');
    const point = (node: HTMLElement | null, fallback: HTMLElement) => {
      const rect = (node ?? fallback).getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        width: rect.width,
      };
    };
    if (discard) {
      const land = point(discard, element);
      element.style.setProperty('--land-x', `${land.x}px`);
      element.style.setProperty('--land-y', `${land.y}px`);
    }
    for (const flight of element.querySelectorAll<HTMLElement>('.uno-flight')) {
      const draw = flight.dataset.flight === 'draw';
      const owner = draw ? (latest.targets[0] ?? latest.actor) : latest.actor;
      const actor = owner === game.self?.seatId && hand ? hand : seat(owner);
      const from = point(draw ? deck : actor, element);
      const to = point(draw ? actor : discard, element);
      flight.style.setProperty('--from-x', `${from.x}px`);
      flight.style.setProperty('--from-y', `${from.y}px`);
      flight.style.setProperty('--to-x', `${to.x}px`);
      flight.style.setProperty('--to-y', `${to.y}px`);
      flight.style.setProperty(
        '--uno-card-width',
        `${draw ? 76 : Math.min(190, to.width)}px`,
      );
    }
    const highlighted = latest.targets
      .map((id) => seat(id))
      .filter((node): node is HTMLElement => Boolean(node));
    for (const target of highlighted) target.dataset.feedbackTarget = 'true';
    return () => {
      for (const target of highlighted)
        target.removeAttribute('data-feedback-target');
    };
  }, [latest, game.self?.seatId]);
  if (!latest) return null;
  const cue = unoSavedCue(latest, game.phase);
  const presentation = cue ? unoCuePresentation[cue] : null;
  const kind = presentation?.kind ?? latest.card?.kind ?? latest.verb;
  const rich = Boolean(presentation?.symbol);
  return (
    <div
      ref={layer}
      className={`uno-saved-effect uno-saved-effect--${kind}`}
      data-uno-cue={cue ?? 'none'}
      data-uno-draw-count={latest.drawCount}
      data-uno-card-kind={latest.card?.kind}
      style={
        {
          '--uno-cue-color': latest.color ? colors[latest.color] : '#dfb936',
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <div className="uno-effect-ring" />
      {latest.card && (
        <div className="uno-flight uno-flying-card" data-flight="play">
          <Card card={latest.card} />
        </div>
      )}
      {Array.from(
        { length: Math.min(6, Math.max(0, latest.drawCount)) },
        (_, index) => (
          <div
            className="uno-flight uno-drawing-card"
            data-flight="draw"
            key={index}
            style={{ '--flight-delay': `${index * 70}ms` } as CSSProperties}
          >
            <Card back />
          </div>
        ),
      )}
      {rich && cue && presentation && (
        <>
          <div className="uno-cue-pulses">
            {Array.from({ length: 3 }, (_, index) => (
              <i
                key={index}
                style={{ '--cue-pulse': index } as CSSProperties}
              />
            ))}
          </div>
          <div className="uno-cue-accents">
            {Array.from({ length: 8 }, (_, index) => (
              <i
                key={index}
                style={{ '--cue-accent': index } as CSSProperties}
              />
            ))}
          </div>
          <span className="uno-effect-symbol">
            <CueEmblem cue={cue} />
            <b className="uno-cue-mark">{unoCueSymbol(cue, latest)}</b>
            <small className="uno-cue-caption">
              {cue === 'win' && game.phase === 'ended'
                ? '整场结束'
                : presentation.caption}
            </small>
          </span>
        </>
      )}
      {presentation?.celebration && (
        <div className="uno-confetti">
          {Array.from({ length: 18 }, (_, index) => (
            <i
              key={index}
              style={
                {
                  '--piece': index,
                  '--piece-drop': `${(index % 4) * 30}px`,
                } as CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
