import { useGameDetails } from '../game-clients/details';
import type { RoomView } from '@tablemax/protocol';
import {
  botDifficultyNames,
  availableBotDifficulties,
} from '../content/bot-difficulty';
import './box-overlays.css';

export function BotInformation({
  game,
}: {
  game: NonNullable<RoomView['game']>;
}) {
  const { details, error, retry } = useGameDetails(game.id, game.releaseRef);
  const introduction = details?.botIntroduction;
  const levels = availableBotDifficulties(game);
  return (
    <div className="bot-information">
      <p className="bot-information__game">{game.name}</p>
      {!details && <p role="status">{error ?? '正在加载人机说明…'}</p>}
      {error && (
        <button type="button" onClick={retry}>
          重试
        </button>
      )}
      {introduction &&
        levels
          .filter((level) => level !== 'mischief')
          .map((level, index) => (
            <section className="bot-information__level" key={level}>
              <span className="bot-information__rank" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{botDifficultyNames[level]}</h3>
                <p>{introduction[level].lead}</p>
                <p className="bot-information__detail">
                  {introduction[level].details.join(' ')}
                </p>
              </div>
            </section>
          ))}
      {levels.includes('mischief') && (
        <section className="bot-information__level">
          <div>
            <h3>{botDifficultyNames.mischief}</h3>
            <p>独立对局风格，倾向干扰场上领先的对手。</p>
          </div>
        </section>
      )}
      <p className="bot-information__note">
        人机在本机运行，只使用本席获准信息。
      </p>
    </div>
  );
}
