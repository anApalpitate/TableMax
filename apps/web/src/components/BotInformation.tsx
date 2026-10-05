import { moduleFor } from '../catalog';
import type { BotDifficulty, RoomView } from '@tablemax/protocol';
import './box-overlays.css';

const names: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};
export function BotInformation({
  game,
}: {
  game: NonNullable<RoomView['game']>;
}) {
  const introduction = moduleFor(game.id)?.botIntroduction;
  return (
    <div className="bot-information">
      <p className="bot-information__game">{game.name}</p>
      {introduction &&
        (Object.keys(names) as BotDifficulty[]).map((level, index) => (
          <section className="bot-information__level" key={level}>
            <span className="bot-information__rank" aria-hidden="true">
              {index + 1}
            </span>
            <div>
              <h3>{names[level]}</h3>
              <p>{introduction[level].lead}</p>
              <p className="bot-information__detail">
                {introduction[level].details.join(' ')}
              </p>
            </div>
          </section>
        ))}
      <p className="bot-information__note">
        三档均为本地策略，只用本人获准信息。名称不代表云端模型；不保证高等级一定获胜。
      </p>
    </div>
  );
}
