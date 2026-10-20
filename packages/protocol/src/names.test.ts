import { describe, expect, it } from 'vitest';
import { normalizePlayerName } from './names';

describe('submitted nickname generation reversal', () => {
  it.each([
    [' 爸爸 ', '儿子'],
    ['我是你爸爸', '我是你儿子'],
    ['父爹爸爷', '子儿儿孙'],
    ['爹地', '儿子'],
    ['父親', '儿子'],
    ['媽媽', '女儿'],
    ['娘亲', '女儿'],
    ['父母', '子女'],
    ['爸媽', '儿女'],
    ['爹娘', '儿女'],
    ['老子来了', '小子来了'],
    ['爺爺', '孙子'],
    ['奶奶', '孙女'],
    ['外公', '外孙'],
    ['外婆', '外孙'],
    ['姥爺', '外孙'],
    ['外祖母', '外孙女'],
    ['曾祖父', '曾孙子'],
    ['高祖母', '玄孙女'],
    ['曾外祖父', '曾外孙'],
    ['太爺爺', '曾孙子'],
    ['太奶奶', '曾孙女'],
    ['老祖宗', '小辈'],
    ['祖宗', '子孙'],
    ['家父', '家子'],
    ['家母', '家女'],
    ['令尊', '令郎'],
    ['令堂', '令嫒'],
    ['皇阿瑪', '皇儿'],
    ['阿嬤', '孙女'],
    ['曾祖', '曾孙'],
    ['祖爺爺', '曾孙子'],
    ['義父', '义子'],
    ['養母', '养女'],
    ['繼父', '继子'],
    ['干爹', '干儿'],
    ['乾媽', '干女'],
    ['岳父', '女婿'],
    ['岳母', '女婿'],
    ['丈母娘', '小女婿'],
    ['公公', '儿媳'],
    ['婆婆', '儿媳'],
    ['叔叔', '侄子'],
    ['伯父', '侄子'],
    ['姑媽', '侄女'],
    ['舅舅', '外甥'],
    ['阿姨', '外甥'],
    ['三叔', '侄子'],
    ['師父', '徒弟'],
    ['教父', '教子'],
    ['父皇', '儿臣'],
    ['母后', '儿臣'],
    ['父', '子'],
    ['母', '女'],
    ['娘', '女'],
    ['奶', '孙'],
    ['叔', '侄'],
    ['爸 爸', '儿子'],
    ['爹\u200b地', '儿子'],
    ['外_祖-父', '外孙子'],
    ['老 · 父', '幼子'],
    ['DADDY123', '儿子123'],
    ['我是Father', '我是儿子'],
    ['GrandFather', '孙子'],
    ['ＧＯＤＦＡＴＨＥＲ', '义子'],
    ['b a b a', '儿子'],
    ['MOMMY', '女儿'],
    ['grandma', '孙女'],
    ['laoba', '儿子'],
  ])('maps %s once to %s', (input, expected) => {
    expect(normalizePlayerName(input)).toBe(expected);
    expect(normalizePlayerName(expected)).toBe(expected);
    expect(expected.length).toBeLessThanOrEqual(input.trim().length);
  });

  it.each([
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
