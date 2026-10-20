import { describe, expect, it } from 'vitest';
import { normalizePlayerName } from './names';

describe('submitted nickname generation reversal', () => {
  it.each([
    [' 爸爸 ', '儿子'],
    ['我是你爸爸', '我是你儿子'],
    ['父爹爸爷', '子儿儿孙'],
    ['爹地', '儿子'],
    ['父親', '儿子'],
    ['老子来了', '小子来了'],
    ['爺爺', '孙子'],
    ['外公', '外孙'],
    ['姥爺', '外孙'],
    ['曾祖父', '曾孙子'],
    ['曾外祖父', '曾外孙'],
    ['太爺爺', '曾孙子'],
    ['家父', '家子'],
    ['祖爺爺', '曾孙子'],
    ['義父', '义子'],
    ['繼父', '继子'],
    ['干爹', '干儿'],
    ['父皇', '皇子'],
    ['父', '子'],
    ['爸 爸', '儿子'],
    ['爹\u200b地', '儿子'],
    ['外_祖-父', '外孙子'],
    ['老 · 父', '幼子'],
    ['DADDY123', '儿子123'],
    ['我是Father', '我是儿子'],
    ['GrandFather', '孙子'],
    ['b a b a', '儿子'],
    ['laoba', '儿子'],
  ])('maps %s once to %s', (input, expected) => {
    expect(normalizePlayerName(input)).toBe(expected);
    expect(normalizePlayerName(expected)).toBe(expected);
    expect(expected.length).toBeLessThanOrEqual(input.trim().length);
  });

  it.each([
    '媽媽',
    '娘亲',
    '父母',
    '爸媽',
    '爹娘',
    '奶奶',
    '外婆',
    '外祖母',
    '高祖母',
    '太奶奶',
    '老祖宗',
    '祖宗',
    '家母',
    '令尊',
    '令堂',
    '皇阿瑪',
    '阿嬤',
    '曾祖',
    '養母',
    '乾媽',
    '岳父',
    '岳母',
    '丈母娘',
    '公公',
    '婆婆',
    '叔叔',
    '伯父',
    '姑媽',
    '舅舅',
    '阿姨',
    '三叔',
    '師父',
    '教父',
    '母后',
    '母',
    '娘',
    '奶',
    '叔',
    'ＧＯＤＦＡＴＨＥＲ',
    'MOMMY',
    'grandma',
    '岳 父',
    '師_父',
    '叔-父',
    'mother',
    'uncle',
    'aunt',
    '奶茶',
    '奶油饼干',
    '字母',
    '母语',
    '姑娘',
    '新娘',
    '伯牙',
    '叔本华',
    '祖国',
    '阿里巴巴',
    'Alibaba',
    'address',
    'Grandmaster',
    'mammal',
    '陈小明',
    'constructor',
    '__proto__',
    'toString',
    '妹妹',
    '儿子',
    '外甥',
    '👨‍👩‍👧‍👦玩家',
  ])('keeps ordinary name %s', (name) => {
    expect(normalizePlayerName(name)).toBe(name);
  });

  it('does not expand 24-character limits, cascade or change repeated submissions', () => {
    const fragments = [
      '老',
      '爸',
      '父',
      '爹',
      '爷',
      '儿子',
      '老祖宗',
      '外婆',
      ' ',
      '·',
      '爸爸',
      '岳父',
      'DAD',
      'mother',
      '阿明',
    ];
    let seed = 91;
    for (let index = 0; index < 600; index++) {
      const name = Array.from({ length: 7 }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return fragments[seed % fragments.length]!;
      })
        .join('')
        .slice(0, 24);
      const result = normalizePlayerName(name);
      expect(result.length).toBeLessThanOrEqual(name.trim().length);
      expect(result.length).toBeLessThanOrEqual(24);
      expect(normalizePlayerName(result)).toBe(result);
    }
  });
});
