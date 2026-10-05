import { topology } from '../shared/topology';
import { card } from './cards';
import type { Score } from './scoring';
export const grid = topology({ rows: 3, columns: 3 });
export const lines = [...grid.rows, ...grid.columns, ...grid.diagonals];
export type ResearchTask = {
  id: string;
  name: string;
  description: string;
  reward: number;
  pool: 'opening' | 'hoenn';
};
const definitions: [string, string, string, number][] = [
  ['R01', '伙伴列队', '至少一行形成归零线', 3],
  ['R02', '高塔攀登', '至少一列形成归零线', 3],
  ['R03', '流星轨迹', '至少一条主对角线形成归零线', 4],
  ['R04', '波导十字', '中间行与中间列同时归零', 5],
  ['R05', '星陨交汇', '两条主对角线同时归零', 5],
  ['R06', '巨兽封印', '至少一条归零线的有效值≥10', 4],
  ['R07', '四角星座', '四角同值且该值≥0', 4],
  ['R08', '镜湖倒影', '上中＝下中，左中＝右中', 3],
  ['R09', '双子结界', '两组对角角格分别同值且两组值不同', 4],
  ['R10', '环形阶梯', '上中＜右中＜下中＜左中', 4],
  ['R11', '众星拱月', '中心严格小于其余八格', 3],
  ['R12', '王者之巅', '中心严格大于其余八格', 4],
  ['R13', '温柔生态', '九格有效值全部≤5', 4],
  ['R14', '阴阳调和', '一行之和为0且同时含正负值', 4],
  ['R15', '进化阶梯', '一行从左至右为三个连续整数', 3],
  ['R16', '跨级实验', '一列从上至下为等差数列且公差≥2', 4],
  ['R17', '三界平衡', '三行之和相等且每行至少两种值', 5],
  ['R18', '缤纷光谱', '至少六种不同有效值', 4],
  ['R19', '百花齐放', '九张牌属于九种不同角色', 3],
  ['R20', '异种协作', '一条归零线包含三种不同角色', 4],
  ['R21', '原野守护', '九张全部为普通牌', 3],
  ['R22', '海陆空同盟', '本人最终场地拥有三种丰缘神兽', 5],
  ['R23', '幻化桥梁', '合法解析的复制牌参加归零线', 3],
  ['R24', '幕后布阵', '揭示前至少三明三暗，归零线至少两格原暗牌', 4],
  ['H01', '天地初开', '上行全部≥8、中行全部4–7、下行全部≤3', 5],
  ['H02', '海渊回响', '中行全部≤0、上下两行全部≥6', 5],
  ['H03', '断崖隆升', '每列向下严格递增且底格减顶格均≥6', 5],
  ['H04', '天空环流', '四角均大于中心，四边均小于中心', 5],
  ['H05', '陨星天平', '两条主对角线之和相等且四角值互异', 4],
  ['H06', '终焉封印', '两条不同值归零线，一条≥8，另有未归零负值牌', 5],
];
export const tasks: ResearchTask[] = definitions.map(
  ([id, name, description, reward]) => ({
    id,
    name,
    description,
    reward,
    pool: id.startsWith('R') ? 'opening' : 'hoenn',
  }),
);
export const task = (id: string) => {
  const found = tasks.find((t) => t.id === id);
  if (!found) throw new Error('Invalid research task');
  return found;
};
export function matchesTask(
  id: string,
  board: readonly string[],
  score: Score,
  preReveal: readonly boolean[] = Array(9).fill(true),
): boolean {
  task(id);
  const v = score.values,
    matched = score.matchedLines,
    cat = board.map((i) => card(i)),
    distinct = (slots: readonly number[]) =>
      new Set(slots.map((i) => v[i])).size;
  const sum = (slots: readonly number[]) =>
      slots.reduce((n, i) => n + v[i]!, 0),
    eq = (a: number, b: number) => v[a] === v[b];
  const corners = [0, 2, 6, 8],
    edges = [1, 3, 5, 7];
  switch (id) {
    case 'R01':
      return matched.some((i) => i < 3);
    case 'R02':
      return matched.some((i) => i >= 3 && i < 6);
    case 'R03':
      return matched.some((i) => i >= 6);
    case 'R04':
      return matched.includes(1) && matched.includes(4);
    case 'R05':
      return matched.includes(6) && matched.includes(7);
    case 'R06':
      return matched.some((i) => v[lines[i]![0]!]! >= 10);
    case 'R07':
      return corners.every((i) => eq(i, 0)) && v[0]! >= 0;
    case 'R08':
      return eq(1, 7) && eq(3, 5);
    case 'R09':
      return eq(0, 8) && eq(2, 6) && !eq(0, 2);
    case 'R10':
      return v[1]! < v[5]! && v[5]! < v[7]! && v[7]! < v[3]!;
    case 'R11':
      return v.every((n, i) => i === 4 || n > v[4]!);
    case 'R12':
      return v.every((n, i) => i === 4 || n < v[4]!);
    case 'R13':
      return v.every((n) => n <= 5);
    case 'R14':
      return grid.rows.some(
        (r) =>
          sum(r) === 0 && r.some((i) => v[i]! < 0) && r.some((i) => v[i]! > 0),
      );
    case 'R15':
      return grid.rows.some(
        ([a, b, c]) => v[b!] === v[a!]! + 1 && v[c!] === v[b!]! + 1,
      );
    case 'R16':
      return grid.columns.some(
        ([a, b, c]) =>
          v[b!]! - v[a!]! >= 2 && v[c!]! - v[b!]! === v[b!]! - v[a!]!,
      );
    case 'R17':
      return (
        new Set(grid.rows.map(sum)).size === 1 &&
        grid.rows.every((r) => distinct(r) >= 2)
      );
    case 'R18':
      return new Set(v).size >= 6;
    case 'R19':
      return new Set(cat.map((c) => c.categoryId)).size === 9;
    case 'R20':
      return matched.some(
        (i) => new Set(lines[i]!.map((n) => cat[n]!.categoryId)).size === 3,
      );
    case 'R21':
      return cat.every((c) => c.categoryId.startsWith('ordinary-'));
    case 'R22':
      return ['groudon', 'kyogre', 'rayquaza'].every((id) =>
        cat.some((c) => c.ability === id),
      );
    case 'R23':
      return score.copies.some((c) => score.zeroSlots.includes(c.slot));
    case 'R24':
      return (
        preReveal.filter(Boolean).length >= 3 &&
        preReveal.filter((n) => !n).length >= 3 &&
        matched.some((i) => lines[i]!.filter((n) => !preReveal[n]).length >= 2)
      );
    case 'H01':
      return (
        grid.rows[0]!.every((i) => v[i]! >= 8) &&
        grid.rows[1]!.every((i) => v[i]! >= 4 && v[i]! <= 7) &&
        grid.rows[2]!.every((i) => v[i]! <= 3)
      );
    case 'H02':
      return (
        grid.rows[1]!.every((i) => v[i]! <= 0) &&
        [...grid.rows[0]!, ...grid.rows[2]!].every((i) => v[i]! >= 6)
      );
    case 'H03':
      return grid.columns.every(
        ([a, b, c]) =>
          v[a!]! < v[b!]! && v[b!]! < v[c!]! && v[c!]! - v[a!]! >= 6,
      );
    case 'H04':
      return (
        corners.every((i) => v[i]! > v[4]!) && edges.every((i) => v[i]! < v[4]!)
      );
    case 'H05':
      return (
        sum(grid.diagonals[0]!) === sum(grid.diagonals[1]!) &&
        distinct(corners) === 4
      );
    case 'H06':
      return (
        matched.some(
          (i) =>
            v[lines[i]![0]!]! >= 8 &&
            matched.some((j) => v[lines[j]![0]!] !== v[lines[i]![0]!]),
        ) && v.some((n, i) => n < 0 && !score.zeroSlots.includes(i))
      );
    default:
      return false;
  }
}
