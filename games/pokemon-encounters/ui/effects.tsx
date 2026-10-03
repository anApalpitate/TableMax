import { useContext, type CSSProperties } from 'react';
import type { PokemonView } from '../rules/project';
import { coinArt } from '../../../assets/games/pokemon-encounters/catalog';
import { SavedMotion } from './motion';
import type { RoomFeedback } from '../../../packages/protocol/src';
import { actionEffects } from './presentation-state';

const titles = {
  mew: '梦幻 · 念力交换',
  zapdos: '闪电鸟 · 接力传牌',
  snorlax: '卡比兽 · 两牌交换',
  charizard: '喷火龙 · 火焰窥探',
  rocket: '火箭队 · 突袭',
};
const marks = {
  mew: '✧',
  zapdos: 'ϟ',
  snorlax: '⇄',
  charizard: '♨',
  rocket: 'R',
};

/** Decoration only: outcomes and targets come from saved, authorized information. */
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
  const action = feedback?.events.at(-1)?.action ?? game.events.at(-1)?.action;
  const effects = actionEffects(action, game);
  const theme = motion.includes('@saved') ? effects.theme : undefined;
  const coin = motion.includes('@coin') ? effects.coin : null;
  const rocketReturn =
    motion.includes('@saved') && effects.rocketReturns.length > 0;
  if (!result && !coin && !theme) return null;
  const match = result && game.matchWinners.length > 0;
  return (
    <div
      className={`saved-effects ${result ? 'result-effects' : coin ? 'coin-effects' : `ability-effects theme-${theme}`} ${match ? 'match-fireworks' : ''}`}
      aria-hidden="true"
    >
      {result ? (
        <>
          {Array.from({ length: match ? 5 : 2 }, (_, burst) => (
            <div
              className="firework-burst"
              key={burst}
              style={
                {
                  '--burst-x': `${[18, 78, 48, 32, 88][burst]}%`,
                  '--burst-y': `${[26, 30, 15, 65, 63][burst]}%`,
                  '--burst-delay': `${burst * 110}ms`,
                } as CSSProperties
              }
            >
              {Array.from({ length: 12 }, (_, spark) => (
                <i
                  key={spark}
                  className="firework-spark"
                  style={
                    {
                      '--angle': `${spark * 30}deg`,
                      '--spark-color': ['#ffd85c', '#83e7ec', '#ff9ac7'][
                        burst % 3
                      ],
                    } as CSSProperties
                  }
                />
              ))}
            </div>
          ))}
          <span className="effect-title victory-title">
            {match ? '♛ 大局胜利！' : '本局揭晓！'}
            <small>
              {(match ? game.matchWinners : (game.roundResult?.winners ?? []))
                .map((seat) => names[seat] ?? seat)
                .join('、')}
            </small>
          </span>
        </>
      ) : coin ? (
        <>
          <div className="effect-ring" />
          <span className="tossed-coin">
            <img src={coinArt[coin]} alt="" />
          </span>
          <span className="coin-effect-label">
            {coin === 'meowth' ? '喵喵面' : '皮卡丘面'}
          </span>
        </>
      ) : theme ? (
        <div className="ability-toast">
          <span className="ability-toast-mark">
            {rocketReturn ? 'R' : marks[theme]}
          </span>
          <strong>{rocketReturn ? '我还会再回来的！' : titles[theme]}</strong>
        </div>
      ) : null}
    </div>
  );
}
