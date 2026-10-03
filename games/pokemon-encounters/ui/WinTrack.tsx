import { useContext } from 'react';
import { SavedMotion } from './motion';

export function WinTrack({
  wins,
  winner,
}: {
  wins: number;
  winner?: 'match' | 'round' | undefined;
}) {
  const motion = useContext(SavedMotion);
  const earnedNow = Boolean(winner) && motion.includes('@result');
  return (
    <span
      className="tag win-track"
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
            ★
          </i>
        ))}
      </span>
    </span>
  );
}
