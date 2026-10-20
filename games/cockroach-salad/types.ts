export const vegetables = [
  'tomato',
  'lettuce',
  'cauliflower',
  'pepper',
] as const;
export type Vegetable = (typeof vegetables)[number];
export type Answer = Vegetable | 'cockroach';
export type Card = { id: number; vegetable: Vegetable; taboo: boolean };
export type Setup = { speed: 'accelerating' | 'relaxed' | 'classic' | 'fast' };
export type Action =
  | { type: 'answer'; answer: Answer }
  | { type: 'challenge' }
  | { type: 'pass' }
  | { type: 'next-round' };
export type State = {
  seats: string[];
  hands: Record<string, number[]>;
  spare: number[];
  piles: [number[], number[]];
  pile: number;
  actor: string;
  phase: 'thinking' | 'overtime' | 'review' | 'ended';
  step: number;
  turn: number;
  current: number;
  previousVegetable: Vegetable | null;
  previousAnswer: Answer | null;
  taboo: Vegetable[];
  answer: Answer | null;
  late: boolean;
  responses: Record<string, 'challenge' | 'pass'>;
  winners: string[];
  setup: Setup;
  accepted: number;
  lastResult: string;
};
export type SaladView = {
  seats: string[];
  counts: Record<string, number>;
  piles: [Card | null, Card | null];
  pileCounts: number[];
  pile: number;
  actor: string;
  phase: State['phase'];
  step: number;
  current: Card;
  previousVegetable: Vegetable | null;
  previousAnswer: Answer | null;
  taboo: Vegetable[];
  answer: Answer | null;
  late: boolean;
  winners: string[];
  setup: Setup;
  accepted: number;
  lastResult: string;
  selfResponse: 'challenge' | 'pass' | null;
};
export const names: Record<Answer, string> = {
  tomato: '番茄',
  lettuce: '生菜',
  cauliflower: '花椰菜',
  pepper: '甜椒',
  cockroach: '蟑螂',
};
export function card(id: number): Card {
  return {
    id,
    vegetable: vegetables[Math.floor(id / 32)]!,
    taboo: id % 32 >= 28,
  };
}
export const setupDefaults: Setup = { speed: 'accelerating' };
export function validateSetup(input: unknown): Setup {
  const x = input as Setup;
  if (
    !x ||
    typeof x !== 'object' ||
    Object.keys(x).length !== 1 ||
    !['accelerating', 'relaxed', 'classic', 'fast'].includes(x.speed)
  )
    throw new Error('无效沙拉速度');
  return { speed: x.speed };
}
/** Only public information is used, both by adjudication and local strategies. */
export function correctAnswers(
  view: Pick<
    SaladView,
    'current' | 'previousVegetable' | 'previousAnswer' | 'taboo'
  >,
): Answer[] {
  const { current, previousVegetable, previousAnswer, taboo } = view;
  if (current.taboo) return ['cockroach'];
  const forbidden = new Set<Answer>(taboo);
  if (previousVegetable) forbidden.add(previousVegetable);
  if (previousAnswer) forbidden.add(previousAnswer);
  return forbidden.has(current.vegetable)
    ? vegetables.filter((v) => !forbidden.has(v))
    : [current.vegetable];
}
export function thoughtMs(s: Pick<State, 'setup' | 'accepted'>): number {
  return s.setup.speed === 'accelerating'
    ? Math.max(1800, 6500 - s.accepted * 100)
    : { relaxed: 6500, classic: 3000, fast: 1800 }[s.setup.speed];
}
