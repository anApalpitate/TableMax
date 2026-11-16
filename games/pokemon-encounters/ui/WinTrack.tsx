import { useContext } from 'react';
import { SavedMotion } from './motion';
import './win-track.css';

export function WinTrack({
  wins,
  winner,
  earnedNow: providedEarnedNow,
}: {
  wins: number;
  winner?: 'match' | 'round' | undefined;
  earnedNow?: boolean | undefined;
}) {
  const motion = useContext(SavedMotion);
  const earnedNow =
    providedEarnedNow ?? (Boolean(winner) && motion.includes('@result'));
  return (
    <span
      className="win-track"
      role="img"
      aria-label={`${wins} 胜，三胜赢得大局${winner === 'match' ? '，大局赢家' : winner === 'round' ? '，小局赢家' : ''}`}
      title={`${wins} / 3 胜`}
    >
      <span className="win-pips" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <i
            key={i}
            className={`${i < wins ? 'earned' : ''} ${earnedNow && i === wins - 1 ? 'newly-earned' : ''}`}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path
                d="M10 2.4 12.6 7.1 18 8 14.2 11.8 14.8 17.2 10 14.9 5.2 17.2 5.8 11.8 2 8 7.4 7.1Z"
                fill={i < wins ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          </i>
        ))}
      </span>
    </span>
  );
}
