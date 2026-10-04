import type { Fuel, PowerGridView } from '../types';
export const PLAYER_COLORS = [
  '#d92726',
  '#2459bd',
  '#f5c92b',
  '#248b48',
  '#7a4aa0',
  '#333631',
];
export const PHASE_LABELS: Record<PowerGridView['phase'], string> = {
  regions: '选择区域',
  offer: '电厂拍卖',
  auction: '电厂竞价',
  replace: '电厂换代',
  resources: '采购燃料',
  building: '建设电网',
  powering: '发电收入',
  ended: '供电结算',
};
export const FUEL_LABELS: Record<Fuel, string> = {
  coal: '燃煤',
  oil: '燃油',
  hybrid: '煤油混燃',
  garbage: '垃圾处理',
  uranium: '核能',
  green: '清洁能源',
  fusion: '聚变能源',
};
