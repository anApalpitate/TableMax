import type { BotStrategy } from '@tablemax/game-sdk';
import { correctAnswers, type SaladView, type Action } from '../types';
export const profiles = {
  default: { error: 0.18, miss: 0.35, falseAlarm: 0.035 },
  doubao: { error: 0.08, miss: 0.16, falseAlarm: 0.015 },
  juewu: { error: 0.025, miss: 0.06, falseAlarm: 0.005 },
} as const;
export const bot: BotStrategy = {
  id: 'cockroach-salad-local',
  version: '1.0.0',
  gameId: 'cockroach-salad',
  rulesVersion: 'classic-40839-digital-v1',
  difficulties: ['default', 'doubao', 'juewu'],
  concurrentActions: ['challenge', 'pass'],
  validateMemory(input) {
    if (input !== null) throw new Error('沙拉人机记忆必须为空');
    return null;
  },
  async decide({ view, actions, difficulty = 'default', random }) {
    const v = view as unknown as SaladView;
    const p = profiles[difficulty];
    const choices = actions as Action[];
    const answers = choices.filter((a) => a.type === 'answer');
    const correct = correctAnswers(v);
    if (answers.length) {
      const mistake = random.next() < p.error;
      const pool = answers.filter(
        (a) => a.type === 'answer' && correct.includes(a.answer) !== mistake,
      );
      return {
        action: pool[Math.floor(random.next() * pool.length)]!,
        memory: null,
      };
    }
    const wrong = v.late || (v.answer !== null && !correct.includes(v.answer));
    const challenge = wrong
      ? random.next() >= p.miss
      : random.next() < p.falseAlarm;
    const action = choices.find(
      (a) => a.type === (challenge ? 'challenge' : 'pass'),
    );
    if (!action) throw new Error('无合法沙拉人机动作');
    return { action, memory: null };
  },
};
