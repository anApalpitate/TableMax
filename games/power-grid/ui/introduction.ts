export const powerGridIntroduction = {
  tagline: '竞拍电厂，经营德国电网。',
  lead: '买电厂、备燃料、连城市，在扩张与现金之间作取舍。',
  steps: [
    {
      icon: 'auction',
      illustration: 'assets/games/power-grid/introduction-1-v1.svg',
      title: '竞拍发电能力',
      text: '选购合适的电厂，竞价时也要留够燃料和建城的钱。',
    },
    {
      icon: 'coins',
      illustration: 'assets/games/power-grid/introduction-2-v1.svg',
      title: '买燃料，连城市',
      text: '从市场采购燃料，支付城市与线路费用，拓展自己的网络。',
    },
    {
      icon: 'cards',
      illustration: 'assets/games/power-grid/introduction-3-v1.svg',
      title: '供电，赚取收入',
      text: '启动电厂为已连接的城市供电，把收入投入下一轮经营。',
    },
  ],
  goal: '终局实际供电城市最多者获胜；相同则依次比较现金与已连接城市数。',
} as const;
