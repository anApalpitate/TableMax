export const kinds = [
  'cockroach',
  'stinkbug',
  'bat',
  'spider',
  'fly',
  'toad',
  'rat',
  'scorpion',
] as const;
export type Kind = (typeof kinds)[number];
export const names: Record<Kind, string> = {
  cockroach: '蟑螂',
  stinkbug: '椿象',
  bat: '蝙蝠',
  spider: '蜘蛛',
  fly: '苍蝇',
  toad: '蟾蜍',
  rat: '老鼠',
  scorpion: '蝎子',
};
export function kindOf(card: number): Kind {
  return kinds[Math.floor(card / 8)]!;
}
