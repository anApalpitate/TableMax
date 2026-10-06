/** Classic corrected Germany board: Torgelow, not the Recharged Stralsund map.
 * Edge prices were transcribed from the physical board and cross-checked against
 * the S.O.B. player aid. Art coordinates do not participate in rule calculation.
 */
export type RegionId =
  'north' | 'northeast' | 'northwest' | 'southwest' | 'east' | 'south';
export interface GermanyCity {
  id: string;
  name: string;
  nameDe: string;
  region: RegionId;
  x: number;
  y: number;
}
export interface GermanyEdge {
  from: string;
  to: string;
  cost: number;
}
export const BOARD_WIDTH = 900;
export const BOARD_HEIGHT = 1200;
export const GERMANY_REGIONS = [
  {
    id: 'north',
    name: '北部',
    color: '#78ada7',
    path: 'M318 30 L415 38 456 115 506 150 505 216 449 272 467 354 403 423 294 390 268 328 217 278 222 189 262 149 299 93 Z',
  },
  {
    id: 'northeast',
    name: '东北',
    color: '#b88961',
    path: 'M456 115 L520 146 575 115 645 120 673 175 757 166 790 220 799 299 778 343 833 408 842 471 751 479 694 434 614 457 559 388 467 354 449 272 505 216 506 150 Z',
  },
  {
    id: 'northwest',
    name: '西北',
    color: '#b7839a',
    path: 'M222 278 L268 328 294 390 403 423 442 521 374 554 305 534 287 578 210 607 172 575 110 562 62 509 72 445 162 414 190 345 Z',
  },
  {
    id: 'southwest',
    name: '西南',
    color: '#6c8da9',
    path: 'M62 509 L110 562 172 575 210 607 287 578 305 534 374 554 400 681 432 740 360 842 319 869 235 873 164 889 104 841 81 761 106 701 67 680 50 585 Z',
  },
  {
    id: 'east',
    name: '东部',
    color: '#cabf70',
    path: 'M403 423 L467 354 559 388 614 457 694 434 751 479 842 471 850 537 807 603 712 624 680 703 661 753 584 839 507 853 432 740 400 681 374 554 442 521 Z',
  },
  {
    id: 'south',
    name: '南部',
    color: '#8d81b6',
    path: 'M164 889 L235 873 319 869 360 842 432 740 507 853 584 839 661 753 714 823 744 895 794 948 751 979 708 1054 620 1086 560 1116 482 1111 416 1094 335 1104 265 1080 259 1027 184 972 Z',
  },
] as const;
const rows: readonly [string, string, string, RegionId, number, number][] = [
  ['flensburg', '弗伦斯堡', 'Flensburg', 'north', 365, 53],
  ['kiel', '基尔', 'Kiel', 'north', 399, 125],
  ['hamburg', '汉堡', 'Hamburg', 'north', 360, 228],
  ['hannover', '汉诺威', 'Hannover', 'north', 392, 386],
  ['bremen', '不来梅', 'Bremen', 'north', 304, 300],
  ['cuxhaven', '库克斯港', 'Cuxhaven', 'north', 289, 178],
  ['wilhelmshaven', '威廉港', 'Wilhelmshaven', 'north', 241, 228],
  ['lubeck', '吕贝克', 'Lübeck', 'northeast', 477, 202],
  ['schwerin', '什未林', 'Schwerin', 'northeast', 529, 227],
  ['rostock', '罗斯托克', 'Rostock', 'northeast', 601, 117],
  ['torgelow', '托尔格洛', 'Torgelow', 'northeast', 775, 204],
  ['berlin', '柏林', 'Berlin', 'northeast', 732, 347],
  [
    'frankfurt-oder',
    '奥得河畔法兰克福',
    'Frankfurt (Oder)',
    'northeast',
    813,
    381,
  ],
  ['magdeburg', '马格德堡', 'Magdeburg', 'northeast', 578, 389],
  ['osnabruck', '奥斯纳布吕克', 'Osnabrück', 'northwest', 239, 368],
  ['munster', '明斯特', 'Münster', 'northwest', 191, 433],
  ['duisburg', '杜伊斯堡', 'Duisburg', 'northwest', 55, 476],
  ['essen', '埃森', 'Essen', 'northwest', 122, 495],
  ['dortmund', '多特蒙德', 'Dortmund', 'northwest', 214, 523],
  ['dusseldorf', '杜塞尔多夫', 'Düsseldorf', 'northwest', 70, 547],
  ['kassel', '卡塞尔', 'Kassel', 'northwest', 358, 536],
  ['aachen', '亚琛', 'Aachen', 'southwest', 49, 638],
  ['koln', '科隆', 'Köln', 'southwest', 134, 610],
  ['trier', '特里尔', 'Trier', 'southwest', 80, 763],
  ['wiesbaden', '威斯巴登', 'Wiesbaden', 'southwest', 255, 731],
  ['frankfurt-main', '法兰克福', 'Frankfurt (Main)', 'southwest', 306, 702],
  ['saarbrucken', '萨尔布吕肯', 'Saarbrücken', 'southwest', 173, 843],
  ['mannheim', '曼海姆', 'Mannheim', 'southwest', 306, 836],
  ['halle', '哈勒', 'Halle', 'east', 605, 513],
  ['leipzig', '莱比锡', 'Leipzig', 'east', 657, 535],
  ['dresden', '德累斯顿', 'Dresden', 'east', 793, 587],
  ['erfurt', '埃尔福特', 'Erfurt', 'east', 524, 583],
  ['fulda', '富尔达', 'Fulda', 'east', 402, 652],
  ['wurzburg', '维尔茨堡', 'Würzburg', 'east', 431, 760],
  ['nurnberg', '纽伦堡', 'Nürnberg', 'east', 536, 807],
  ['stuttgart', '斯图加特', 'Stuttgart', 'south', 326, 926],
  ['freiburg', '弗赖堡', 'Freiburg', 'south', 216, 1018],
  ['konstanz', '康斯坦茨', 'Konstanz', 'south', 324, 1069],
  ['augsburg', '奥格斯堡', 'Augsburg', 'south', 489, 963],
  ['regensburg', '雷根斯堡', 'Regensburg', 'south', 601, 883],
  ['munchen', '慕尼黑', 'München', 'south', 590, 1024],
  ['passau', '帕绍', 'Passau', 'south', 759, 945],
];
export const GERMANY_CITIES: readonly GermanyCity[] = rows.map(
  ([id, name, nameDe, region, x, y]) => ({ id, name, nameDe, region, x, y }),
);
const connections: readonly [string, string, number][] = [
  ['flensburg', 'kiel', 4],
  ['kiel', 'hamburg', 8],
  ['kiel', 'lubeck', 4],
  ['hamburg', 'lubeck', 6],
  ['hamburg', 'schwerin', 8],
  ['hamburg', 'hannover', 17],
  ['hamburg', 'bremen', 11],
  ['hamburg', 'cuxhaven', 11],
  ['cuxhaven', 'bremen', 8],
  ['wilhelmshaven', 'bremen', 11],
  ['wilhelmshaven', 'osnabruck', 14],
  ['bremen', 'osnabruck', 11],
  ['bremen', 'hannover', 10],
  ['hannover', 'osnabruck', 16],
  ['hannover', 'schwerin', 19],
  ['hannover', 'magdeburg', 15],
  ['hannover', 'erfurt', 19],
  ['hannover', 'kassel', 15],
  ['lubeck', 'schwerin', 6],
  ['rostock', 'schwerin', 6],
  ['rostock', 'torgelow', 19],
  ['schwerin', 'torgelow', 19],
  ['schwerin', 'magdeburg', 16],
  ['schwerin', 'berlin', 18],
  ['torgelow', 'berlin', 15],
  ['magdeburg', 'berlin', 10],
  ['magdeburg', 'halle', 11],
  ['berlin', 'halle', 17],
  ['berlin', 'frankfurt-oder', 6],
  ['frankfurt-oder', 'leipzig', 21],
  ['frankfurt-oder', 'dresden', 16],
  ['halle', 'leipzig', 0],
  ['halle', 'erfurt', 6],
  ['leipzig', 'dresden', 13],
  ['erfurt', 'dresden', 19],
  ['erfurt', 'fulda', 13],
  ['erfurt', 'kassel', 15],
  ['erfurt', 'nurnberg', 21],
  ['osnabruck', 'munster', 7],
  ['osnabruck', 'kassel', 20],
  ['munster', 'essen', 6],
  ['munster', 'dortmund', 2],
  ['duisburg', 'essen', 0],
  ['essen', 'dortmund', 4],
  ['essen', 'dusseldorf', 2],
  ['dusseldorf', 'aachen', 9],
  ['dusseldorf', 'koln', 4],
  ['dortmund', 'koln', 10],
  ['dortmund', 'kassel', 18],
  ['dortmund', 'frankfurt-main', 20],
  ['kassel', 'frankfurt-main', 13],
  ['kassel', 'fulda', 8],
  ['fulda', 'frankfurt-main', 8],
  ['fulda', 'wurzburg', 11],
  ['frankfurt-main', 'wiesbaden', 0],
  ['frankfurt-main', 'wurzburg', 13],
  ['koln', 'aachen', 7],
  ['koln', 'trier', 20],
  ['koln', 'wiesbaden', 21],
  ['aachen', 'trier', 19],
  ['trier', 'wiesbaden', 18],
  ['trier', 'saarbrucken', 11],
  ['wiesbaden', 'saarbrucken', 10],
  ['wiesbaden', 'mannheim', 11],
  ['saarbrucken', 'mannheim', 11],
  ['saarbrucken', 'stuttgart', 17],
  ['mannheim', 'wurzburg', 10],
  ['mannheim', 'stuttgart', 6],
  ['wurzburg', 'stuttgart', 12],
  ['wurzburg', 'augsburg', 19],
  ['wurzburg', 'nurnberg', 8],
  ['nurnberg', 'augsburg', 18],
  ['nurnberg', 'regensburg', 12],
  ['stuttgart', 'augsburg', 15],
  ['stuttgart', 'freiburg', 16],
  ['stuttgart', 'konstanz', 16],
  ['freiburg', 'konstanz', 14],
  ['konstanz', 'augsburg', 17],
  ['augsburg', 'regensburg', 13],
  ['augsburg', 'munchen', 6],
  ['regensburg', 'munchen', 10],
  ['regensburg', 'passau', 12],
  ['munchen', 'passau', 14],
];
export const GERMANY_EDGES: readonly GermanyEdge[] = connections.map(
  ([from, to, cost]) => ({ from, to, cost }),
);
export const REGIONS = GERMANY_REGIONS;
export const CITIES = GERMANY_CITIES;
export const EDGES = GERMANY_EDGES;
const cityIndex = new Map(CITIES.map((city) => [city.id, city]));
export function getCity(id: string): GermanyCity {
  const city = cityIndex.get(id);
  if (!city) throw new Error('城市不存在。');
  return city;
}
export function isConnectedRegions(regions: readonly string[]): boolean {
  if (
    !regions.length ||
    new Set(regions).size !== regions.length ||
    regions.some((id) => !REGIONS.some((region) => region.id === id))
  )
    return false;
  const seen = new Set([regions[0]!]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of EDGES) {
      const a = getCity(edge.from).region,
        b = getCity(edge.to).region;
      if (!regions.includes(a) || !regions.includes(b)) continue;
      if (seen.has(a) && !seen.has(b)) {
        seen.add(b);
        changed = true;
      }
      if (seen.has(b) && !seen.has(a)) {
        seen.add(a);
        changed = true;
      }
    }
  }
  return seen.size === regions.length;
}
/** Dijkstra on the selected playing zone. Occupied cities remain traversable. */
export function shortestConnection(
  owned: readonly string[],
  target: string,
  regions: readonly string[],
): { cost: number; path: string[] } | null {
  if (!cityIndex.has(target) || !regions.includes(getCity(target).region))
    return null;
  if (!owned.length) return { cost: 0, path: [target] };
  const available = CITIES.filter((city) => regions.includes(city.region)).map(
    (city) => city.id,
  );
  const distance = new Map<string, number>();
  const paths = new Map<string, string[]>();
  for (const id of owned)
    if (available.includes(id)) {
      distance.set(id, 0);
      paths.set(id, [id]);
    }
  const remaining = new Set(available);
  while (remaining.size) {
    const current = [...remaining].sort(
      (a, b) => (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity),
    )[0]!;
    const currentDistance = distance.get(current) ?? Infinity;
    if (!Number.isFinite(currentDistance)) return null;
    if (current === target)
      return { cost: currentDistance, path: paths.get(current)! };
    remaining.delete(current);
    for (const edge of EDGES) {
      const next =
        edge.from === current
          ? edge.to
          : edge.to === current
            ? edge.from
            : null;
      if (!next || !remaining.has(next)) continue;
      const candidate = currentDistance + edge.cost;
      if (candidate < (distance.get(next) ?? Infinity)) {
        distance.set(next, candidate);
        paths.set(next, [...paths.get(current)!, next]);
      }
    }
  }
  return null;
}
