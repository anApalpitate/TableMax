import {
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react';
import './anime-entrance.css';

export type EntranceDefinition = {
  id: string;
  motif: 'psychic' | 'electric' | 'comic';
  side: 'left' | 'right';
  duration: number;
  title: string;
  subtitle: string;
};

/** A decorative cut-in; it receives no game state, targets or private card values. */
export function AbilityEntrance({
  definition,
  image,
  character,
}: {
  definition: EntranceDefinition;
  image: string | undefined;
  character?: ReactNode;
}) {
  const surface = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const scene = surface.current;
    const screen =
      scene?.closest('.expansion-screen') ?? scene?.closest('.pokemon-screen');
    if (!scene || !screen) return;
    const measure = () => {
      const dashboard = screen
        .querySelector('.pokemon-status, .ex-round-banner')
        ?.getBoundingClientRect();
      const toolbar = screen
        .querySelector('.game-toolbar')
        ?.getBoundingClientRect();
      const actions = screen
        .querySelector('.player-action-bar, .ex-confirm-bar')
        ?.getBoundingClientRect();
      const top = Math.max(toolbar?.bottom ?? 0, dashboard?.bottom ?? 0) + 8;
      const bottom =
        actions && actions.bottom > top && actions.top < innerHeight
          ? Math.max(top, actions.top - 8)
          : innerHeight - 12;
      const height = Math.max(0, bottom - top);
      scene.style.setProperty('--entrance-top', `${top}px`);
      scene.style.setProperty('--entrance-height', `${height}px`);
      scene.style.setProperty(
        '--cutin-height',
        `${Math.min(height * 0.65, innerHeight * 0.37, 420)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, []);
  return (
    <div
      ref={surface}
      className={`pokemon-scene anime-entrance scene-${definition.id} motif-${definition.motif} entry-${definition.side}`}
      data-scene={definition.id}
      style={{ '--scene-ms': `${definition.duration}ms` } as CSSProperties}
      aria-hidden="true"
    >
      <div className="entrance-energy-field">
        <div className="scene-wash" />
        <svg
          className="entrance-energy"
          viewBox="0 0 1000 600"
          preserveAspectRatio="none"
        >
          {definition.motif === 'electric' ? (
            <>
              <path d="M0 60L180 100 140 170 310 120 280 250 460 190" />
              <path d="M1000 560L840 460 890 390 700 450 740 330 550 370" />
              <path d="M90 600L130 460 45 490 190 300M950 0L850 140 930 110 810 280" />
            </>
          ) : definition.motif === 'comic' ? (
            Array.from({ length: 20 }, (_, i) => (
              <path key={i} d={`M${i * 70 - 180} 0L${i * 70 + 160} 600`} />
            ))
          ) : (
            <>
              <ellipse cx="500" cy="300" rx="430" ry="160" />
              <ellipse cx="500" cy="300" rx="250" ry="280" />
              <circle cx="500" cy="300" r="200" />
            </>
          )}
        </svg>
        <div className="entrance-impact" />
        {Array.from({ length: 10 }, (_, index) => (
          <i
            key={index}
            className="entrance-particle"
            style={{ '--particle-angle': `${index * 36}deg` } as CSSProperties}
          />
        ))}
      </div>
      <div className="anime-cut-in">
        <div className="cut-in-stripes" />
        {character ? (
          <div className="cut-in-character">{character}</div>
        ) : (
          image && <img className="cut-in-character" src={image} alt="" />
        )}
        <div className="cut-in-title">
          <strong>{definition.title}</strong>
          <span>{definition.subtitle}</span>
        </div>
        {definition.motif === 'comic' && (
          <strong className="cut-in-r">R</strong>
        )}
      </div>
    </div>
  );
}
