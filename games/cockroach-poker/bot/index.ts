import type { BotStrategy } from '@tablemax/game-sdk';
import type { PokerView } from '../ui/view';
import { kindOf } from '../rules/cards';
import type { Action } from '../rules';
export const bot: BotStrategy = {
  id: 'cockroach-poker-local',
  version: '1.0.0',
  gameId: 'cockroach-poker',
  rulesVersion: 'classic-40829-1',
  difficulties: ['default', 'doubao', 'juewu'],
  validateMemory(input) {
    if (input !== null) throw new Error('Invalid memory');
    return null;
  },
  async decide({ view, actions, random, difficulty = 'default' }) {
    if (!actions.length) throw new Error('No legal action');
    const v = view as unknown as PokerView;
    const list = actions as unknown as Action[];
    const pick = (a: readonly Action[]) =>
      a[Math.floor(random.next() * a.length)]!;
    if (difficulty === 'default') return { action: pick(list), memory: null };
    if (list.some((a) => a.type === 'judge')) {
      if (
        list.some((a) => a.type === 'peek') &&
        random.next() < (difficulty === 'doubao' ? 0.65 : 0.3)
      )
        return { action: { type: 'peek' }, memory: null };
      const known = [...Object.values(v.piles).flat(), ...v.ownHand];
      const chance =
        (8 - known.filter((c) => kindOf(c) === v.offer!.claim).length) /
        Math.max(1, 64 - known.length);
      const belief =
        random.next() <
        (difficulty === 'juewu'
          ? Math.min(0.8, Math.max(0.08, chance * 2))
          : 0.4);
      return { action: { type: 'judge', belief }, memory: null };
    }
    const scored = list.map((a) => {
      if (a.type !== 'offer' && a.type !== 'pass') return { a, score: 0 };
      const card = a.type === 'offer' ? a.card : v.offer!.knownCard;
      const actual = card === null ? null : kindOf(card);
      const pressure = v.piles[a.target]!.filter(
        (c) => kindOf(c) === actual,
      ).length;
      const truth = actual === a.claim;
      const score =
        difficulty === 'juewu'
          ? pressure * 3 +
            (truth ? 0.4 : 0.7) +
            (v.handCounts[a.target] === 0 ? 1 : 0)
          : pressure + (truth ? 0.6 : 0.1);
      return {
        a,
        score: score + random.next() * (difficulty === 'juewu' ? 0.8 : 2),
      };
    });
    scored.sort((a, b) => b.score - a.score);
    return { action: scored[0]!.a, memory: null };
  },
};
