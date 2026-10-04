export const powerGridIntroduction = {
  tagline: '德国电网，运筹竞逐',
  lead: '经营自己的电力公司，竞拍电厂、采购燃料，把供电网络连接到德国各地。',
  steps: [
    {
      icon: 'auction' as const,
      title: '竞拍电厂',
      text: '选择合适的发电能力，把握竞价与资金储备。',
    },
    {
      icon: 'coins' as const,
      title: '燃料与建设',
      text: '采购市场燃料，支付连接费用，扩大城市网络。',
    },
    {
      icon: 'cards' as const,
      title: '发电收入',
      text: '决定启动哪些电厂，获得收入，迎接下一轮。',
    },
  ],
  goal: '终局实际供电城市最多者获胜；同分时比较剩余现金。',
};
