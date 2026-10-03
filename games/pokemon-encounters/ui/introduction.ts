export const pokemonIntroduction = {
  tagline: '记住暗牌，换牌降分，发动宝可梦能力。',
  lead: '用换牌和宝可梦能力，让自己的六张牌总分最低。',
  steps: [
    {
      icon: 'cards',
      title: '六张牌，先翻一张',
      text: '每人六张暗牌排成两行，先选一张公开，记住自己的牌。',
    },
    {
      icon: 'swap',
      title: '取牌，换牌，发动能力',
      text: '从牌库或弃牌堆取牌，换入自己的场地。特殊宝可梦还能看牌、交换或影响朋友。',
    },
    {
      icon: 'pair',
      title: '配对，让分数更低',
      text: '同一列两张分值相同就计零分。有人六张牌全明、能力处理完后，大家一起结算。',
    },
  ],
  goal: '每小局总分最低者获一星，先拿三颗星获胜。',
} as const;
