export const pokemonBotIntroduction = {
  default: {
    lead: '简单陪玩，优先摸牌与基础换牌。',
    details: ['使用固定顺序处理能力，不记忆暗牌。'],
  },
  doubao: {
    lead: '比较换牌、配对与能力带来的分数变化。',
    details: ['记住本人合法看过的暗牌，评估翻完最后一张的风险。'],
  },
  juewu: {
    lead: '结合全桌公开局势，推演当前能力的后续结果。',
    details: [
      '共同优化百变怪方向与列消除，考虑对手接近结束及三胜临界。未知牌使用概率估计。',
    ],
  },
} as const;
