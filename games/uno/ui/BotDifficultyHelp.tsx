export function BotDifficultyHelp() {
  return (
    <dl>
      <div>
        <dt>默认</dt>
        <dd>优先出普通牌，选择手中较多的颜色。</dd>
      </div>
      <div>
        <dt>豆包</dt>
        <dd>比较牌分和颜色衔接，也会关注下家的张数。</dd>
      </div>
      <div>
        <dt>绝悟</dt>
        <dd>结合公开出牌与各人张数安排攻击和留牌，只使用本人获授权的信息。</dd>
      </div>
    </dl>
  );
}
