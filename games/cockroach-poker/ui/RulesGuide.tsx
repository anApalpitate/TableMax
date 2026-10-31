import { RulesGuide } from '@tablemax/web-host';
import { asset, Card } from './Theme';
export function PokerRules({ playerCount = 3 }: { playerCount?: number }) {
  const threshold = playerCount === 2 ? 5 : 4;
  return (
    <RulesGuide
      className="cp-rulebook"
      summary="经典德国小强，2–6人。不要成为唯一输家：其他所有人共同获胜。"
      chapters={[
        {
          id: 'cards',
          label: '准备',
          title: '八种虫虫，64张牌',
          content: (
            <>
              <img
                src={asset('runtime/cover-reference.webp')}
                alt="经典40829实体八类牌面与灰色牌背组件照"
              />
              <p>
                蟑螂、椿象、蝙蝠、蜘蛛、苍蝇、蟾蜍、老鼠、蝎子各8张。洗混后全部轮流发给各席，手牌可相差1张。双人局先秘密随机移除10张，再各发27张。平台固定第一席起手。
              </p>
            </>
          ),
        },
        {
          id: 'offer',
          label: '出牌',
          title: '任意选人，真假由你',
          content: (
            <>
              <img
                src={asset('flow.svg')}
                alt="暗牌传给自由选择的对手，再选择判断或秘密查看转传"
              />
              <p>
                从手中选一张牌，交给任意其他玩家，声明八种动物之一；可以说真话，也可以诈唬。声明与路线公开，真实牌面仅给已看过者。
              </p>
            </>
          ),
        },
        {
          id: 'judge',
          label: '判断',
          title: '判断错的人收牌',
          content: (
            <>
              <table>
                <thead>
                  <tr>
                    <th>声明</th>
                    <th>相信</th>
                    <th>质疑</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>真实</th>
                    <td>传牌者收牌</td>
                    <td>判断者收牌</td>
                  </tr>
                  <tr>
                    <th>虚假</th>
                    <td>判断者收牌</td>
                    <td>传牌者收牌</td>
                  </tr>
                </tbody>
              </table>
              <p>
                传牌者指最近声明并传出此牌的人。收牌者把牌公开放到面前，并开始下一轮。
              </p>
            </>
          ),
        },
        {
          id: 'pass',
          label: '转传',
          title: '先承诺转传，再秘密查看',
          content: (
            <p>
              选择“看后转传”，之后必须传给从未看过它的另一人，声明可保持或改变。不能看后改为判断。最后一位未看过者必须判断。双人不能转传。
            </p>
          ),
        },
        {
          id: 'end',
          label: '结束',
          title: '四张同类就输；双人是五张',
          content: (
            <>
              <div
                className="cp-rule-threshold"
                aria-label={`${threshold}张同类`}
              >
                <span aria-hidden="true">
                  {Array.from({ length: threshold }, (_, card) => card).map(
                    (card) => (
                      <Card key={card} card={card} />
                    ),
                  )}
                </span>
                <strong>{threshold}</strong>
              </div>
              <p>
                3–6人中，收下第4张同类立即失败；双人是第5张。或轮到某人开始新一轮，而其手牌已空，此人失败。打出最后一张本身不会立即失败。其余玩家共同获胜。
              </p>
            </>
          ),
        },
      ]}
      source={
        <p>
          依据 Schmidt Spiele 40829
          经典版官方规则，英文印刷页9–14。第一席起手是项目确定性约定。牌面保留64张实体插画的独立身份，牌面与统一灰背为原图参考的AI精修衍生，并非官方扫描。
        </p>
      }
    />
  );
}
