import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { portraitBoundsFor } from './portrait-bounds';
import './cinematic.css';

// Art direction is independent from rules and the authoritative presentation clock.
const treatments: Record<
  string,
  { accent: string; motif: string; focus?: string }
> = {
  zapdos: { accent: '#ffe52c', motif: 'electric', focus: '46% 45%' },
  mewtwo: { accent: '#d1a3ff', motif: 'psychic', focus: '54% 24%' },
  mew: { accent: '#ffb9df', motif: 'psychic', focus: '48% 32%' },
  arceus: { accent: '#fff1a1', motif: 'divine', focus: '53% 25%' },
  groudon: { accent: '#ff6a42', motif: 'magma', focus: '50% 40%' },
  kyogre: { accent: '#6fe4ff', motif: 'tide', focus: '48% 50%' },
  rayquaza: { accent: '#88f5b3', motif: 'wind', focus: '52% 40%' },
  greninja: { accent: '#86cfff', motif: 'blade', focus: '54% 42%' },
  'team-rocket': { accent: '#ff506b', motif: 'rocket', focus: '50% 35%' },
  charizard: { accent: '#ffa34d', motif: 'magma' },
  snorlax: { accent: '#b3e5db', motif: 'impact' },
  lucario: { accent: '#5ce6ff', motif: 'aura' },
  ditto: { accent: '#e2b8ff', motif: 'psychic' },
  zorua: { accent: '#f397b8', motif: 'wind' },
};

// Authored face windows in the unchanged source image coordinates; never deform a limb.
const closeups: Record<string, string> = {
  zapdos: '125 110 320 250',
  mewtwo: '105 0 200 165',
  mew: '125 90 300 260',
  arceus: '60 0 210 190',
  groudon: '170 40 210 180',
  kyogre: '30 105 235 155',
  rayquaza: '15 60 225 170',
  greninja: '90 80 205 170',
  'team-rocket': '270 30 690 590',
};

/** Public saved-result decoration only. Never receives a hand, target or private face. */
export function CinematicEntrance({
  creature,
  image,
  title,
  subtitle,
  durationMs,
  fullscreen,
}: {
  creature: string;
  image: string | undefined;
  title: string;
  subtitle: string;
  durationMs: number;
  fullscreen: boolean;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const treatment = treatments[creature] ?? treatments.mew!;
  const bounds = portraitBoundsFor(`special-${creature}`);
  useLayoutEffect(() => {
    const scene = surface.current;
    const screen = anchor.current?.closest('.expansion-screen');
    if (!scene || !screen) return;
    const measure = () => {
      const toolbar = screen
        .querySelector('.ex-toolbar')
        ?.getBoundingClientRect();
      const heading = screen
        .querySelector('.ex-round-banner')
        ?.getBoundingClientRect();
      const portrait = screen.getAttribute('data-layout') === 'P';
      const actions = portrait
        ? screen.querySelector('.ex-submit')?.getBoundingClientRect()
        : null;
      const top = Math.max(toolbar?.bottom ?? 0, heading?.bottom ?? 0) + 8;
      const bottom =
        actions && actions.top > top
          ? Math.min(innerHeight - 8, actions.top - 8)
          : innerHeight - 8;
      scene.style.setProperty('--entrance-top', `${top}px`);
      scene.style.setProperty(
        '--entrance-height',
        `${Math.max(0, bottom - top)}px`,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(screen);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return (
    <>
      <span ref={anchor} hidden />
      {createPortal(
        <div
          ref={surface}
          className={`ex-cinematic anime-entrance ${fullscreen ? 'ex-cinematic-full' : 'ex-cinematic-local'}`}
          data-scene={creature}
          data-motif={treatment.motif}
          aria-hidden="true"
          style={
            {
              '--cinematic-ms': `${durationMs}ms`,
              '--cinematic-accent': treatment.accent,
              '--portrait-focus': treatment.focus ?? '50% 40%',
            } as CSSProperties
          }
        >
          <div className="entrance-energy-field ex-cinematic-energy">
            <div className="ex-pressure-wash" />
            <svg
              className="ex-impact-lines"
              viewBox="0 0 1600 900"
              preserveAspectRatio="none"
            >
              {Array.from({ length: 20 }, (_, i) => (
                <path
                  key={i}
                  d={`M${i % 2 ? -400 : 1100} ${i * 49 - 130} l${i % 2 ? 1000 : 800} -80 l-460 20 Z`}
                />
              ))}
            </svg>
          </div>
          <div className="anime-cut-in ex-brush-stage">
            <div className="ex-brush-rim" />
            <div className="ex-brush-aperture">
              <div className="ex-halftone" />
              <svg
                className="ex-motif-mark"
                viewBox="0 0 1000 400"
                preserveAspectRatio="none"
              >
                {treatment.motif === 'electric' ? (
                  <path d="M0 100L340 135 230 225 740 170 610 310 1000 240 M50 360L300 300 220 250 610 80 570 160 980 20" />
                ) : treatment.motif === 'magma' ? (
                  <path d="M0 380L160 240 180 320 340 100 390 270 600 30 570 260 800 120 740 350 1000 210" />
                ) : ['tide', 'wind', 'blade'].includes(treatment.motif) ? (
                  <>
                    <path d="M-100 350Q300 -50 1100 80M-100 420Q400 0 1100 200M0 400Q400 160 1100 320" />
                    <path d="M500 390L680 20 740 260 980 60" />
                  </>
                ) : (
                  <>
                    <ellipse cx="430" cy="220" rx="370" ry="170" />
                    <ellipse cx="430" cy="220" rx="260" ry="110" />
                    <path d="M0 360L1000 60M400 0L460 400" />
                  </>
                )}
              </svg>
              {image && (
                <div className="ex-closeup-camera">
                  <svg
                    className="ex-closeup"
                    viewBox={
                      closeups[creature] ??
                      bounds?.viewBox.join(' ') ??
                      '0 0 630 630'
                    }
                    preserveAspectRatio={
                      creature === 'team-rocket'
                        ? 'xMidYMid meet'
                        : 'xMidYMid slice'
                    }
                  >
                    <image
                      href={image}
                      width={bounds?.size[0] ?? 630}
                      height={bounds?.size[1] ?? 630}
                    />
                  </svg>
                </div>
              )}
              <div className="ex-ink-speed" />
              {treatment.motif === 'rocket' && (
                <b className="ex-rocket-insignia">R</b>
              )}
            </div>
            <div className="ex-cinematic-caption">
              <strong>{title}</strong>
              <span>{creature === 'mewtwo' ? '私看与交换' : subtitle}</span>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
