import { useContext, type CSSProperties } from 'react';
import type { PokemonView } from '../rules/project';
import { coinArt } from '../../../assets/games/pokemon-encounters/catalog';
import { SavedMotion } from './motion';
import type { RoomFeedback } from '../../../packages/protocol/src';
import { presentAction } from './action-presentation';

/** Decorative presentation of already committed public information; never decides an outcome. */
export function SavedEffects({
  game,
  feedback = null,
  names = {},
}: {
  game: PokemonView;
  feedback?: RoomFeedback | null;
  names?: Record<string, string>;
}) {
  const motion = useContext(SavedMotion);
  const result = motion.includes('@result');
  const coin = motion.includes('@coin') && game.coin;
  const ability = motion.includes('@ability');
  const action = feedback?.events.at(-1)?.action ?? game.events.at(-1)?.action;
  const label = action ? presentAction(action, names) : null;
  if (!result && !coin && !ability) return null;
  return (
    <div
      className={`saved-effects ${result ? 'result-effects' : coin ? 'coin-effects' : 'ability-effects'}`}
      aria-hidden="true"
    >
      <div className="effect-ring" />
      {Array.from({ length: result ? 24 : 12 }, (_, i) => (
        <i
          key={i}
          className="effect-spark"
          style={
            {
              '--angle': `${i * (result ? 15 : 30)}deg`,
              '--delay': `${(i % 4) * 45}ms`,
              '--spark-color': ['#ffdb62', '#7ccee2', '#ef97ba'][i % 3],
            } as CSSProperties
          }
        >
          ✦
        </i>
      ))}
      {coin ? (
        <span className="tossed-coin">
          <img src={coinArt[coin]} alt="" />
        </span>
      ) : (
        <span className="effect-title">
          {result
            ? game.matchWinners.length
              ? '大局胜利！'
              : '本局揭晓！'
            : label
              ? `${label.actor} · ${label.title}`
              : '能力已保存'}
        </span>
      )}
    </div>
  );
}
