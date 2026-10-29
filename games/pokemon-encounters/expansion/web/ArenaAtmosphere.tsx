import type { CSSProperties } from 'react';

/** Deterministic, decorative and independent of game state or hidden cards. */
export function ArenaAtmosphere() {
  return (
    <div className="ex-arena-atmosphere" aria-hidden="true">
      <div className="ex-arena-orbit" />
      {Array.from({ length: 18 }, (_, i) => (
        <i
          key={i}
          style={
            {
              '--particle-x': `${(i * 37 + 9) % 100}%`,
              '--particle-y': `${(i * 23 + 7) % 100}%`,
              '--particle-delay': `${-i * 1.7}s`,
              '--particle-duration': `${14 + (i % 5) * 3}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
