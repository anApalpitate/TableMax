export const abilityGuides: Record<
  string,
  {
    summary: string;
    chapter: string;
    trigger: 'required' | 'optional' | 'scoring';
  }
> = {
  'special-mew': {
    summary:
      '先用梦幻换朋友的一张牌，再用所得牌换入自己。转移得到的能力牌不再次发动。',
    chapter: 'pokemon-rules-mew',
    trigger: 'required',
  },
  'special-team-rocket': {
    summary:
      '喵喵面换自己一格；皮卡丘面让全员同一个位置弃牌并补牌。补牌不发动能力。',
    chapter: 'pokemon-rules-rocket',
    trigger: 'required',
  },
  'special-zapdos': {
    summary:
      '换入后，将换出的牌顺时针传给下一位；每人自己选换入位置，最后一张弃底。传来的能力牌不再次发动。',
    chapter: 'pokemon-rules-zapdos',
    trigger: 'required',
  },
  'special-snorlax': {
    summary: '换入后可交换自己两个不同位置，明暗朝向随牌移动。也可以不发动。',
    chapter: 'pokemon-rules-abilities',
    trigger: 'optional',
  },
  'special-charizard': {
    summary:
      '换入后可私看自己一张暗牌，只有你能看见，也可以不发动。看完关闭，原牌仍朝下。',
    chapter: 'pokemon-rules-abilities',
    trigger: 'optional',
  },
  'special-ditto': {
    summary:
      '结算时复制本行左右紧邻的数字，系统选择全场地总分最低的合法组合。无需主动发动。',
    chapter: 'pokemon-rules-scoring',
    trigger: 'scoring',
  },
};

export const abilityPhases: Record<string, string> = {
  'mew-other': 'special-mew',
  'mew-self': 'special-mew',
  'rocket-meowth': 'special-team-rocket',
  'rocket-pikachu': 'special-team-rocket',
  'zapdos-self': 'special-zapdos',
  'zapdos-receive': 'special-zapdos',
  'snorlax-choice': 'special-snorlax',
  'charizard-choice': 'special-charizard',
  'charizard-view': 'special-charizard',
};

export const decisionInstructions: Record<string, string> = {
  'initial-flip': '选一张暗牌翻开；初翻不发动能力。',
  draw: '点牌堆取牌；牌库普通牌可换入或弃掉，弃牌顶必须使用。',
  place: '换入牌朝上，换出的牌公开放到弃牌顶。',
  'mew-other': '先选一位朋友，再选其场地的一张牌；明牌、暗牌都可以。',
  'mew-self': '用刚得到的牌换入自己一格，换出的牌放到弃牌顶。',
  'rocket-meowth': '喵喵面：选择自己一格，用火箭队换入。',
  'rocket-pikachu': '皮卡丘面：选一个位置，全员同位置弃牌并补牌。',
  'zapdos-self': '选自己一格换入闪电鸟，换出的牌将传给下一位。',
  'zapdos-receive': '选自己的换入位置，再传出换出的牌；接牌不再次发动能力。',
  'snorlax-choice': '选两个不同位置交换，明暗朝向保持；也可不发动。',
  'charizard-choice': '选自己一张暗牌私看，也可不发动。',
  'charizard-view': '记住这张牌后关闭查看；它仍在原位朝下。',
};
