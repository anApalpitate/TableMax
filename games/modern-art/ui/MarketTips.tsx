import { useEffect, useState } from 'react';

const tips = [
  '第 5 幅上拍，立即结算且不成交',
  '数量相同，市场左侧画家优先',
  '前三名兑现历史加本轮增值',
  '跌出前三兑 0，历史价值保留',
  '双拍补画触发第 5 幅，两幅不成交',
  '别人补画，接任拍卖人收款',
  '收藏每轮清空，手牌跨轮保留',
  '前三名增值 30／20／10 千元',
];

export function MarketTips() {
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const restart = () => {
      clearInterval(timer);
      if (!document.hidden && !hovered)
        timer = setInterval(() => setIndex((n) => (n + 1) % tips.length), 7000);
    };
    restart();
    document.addEventListener('visibilitychange', restart);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', restart);
    };
  }, [hovered]);
  return (
    <div
      className="ma-market-tips"
      aria-label="拍卖提示"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span aria-hidden="true">◇</span>
      <p key={index} title={tips[index]}>
        {tips[index]}
      </p>
    </div>
  );
}
