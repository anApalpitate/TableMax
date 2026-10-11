import { expect, it } from 'vitest';
import { alignment, questSizes } from './state';
import { validateState, rulesByVariant } from './index';
import { approve, fixture, quest, reveal } from './test-fixtures';
import { project } from './project';

it('2012同版5–10人的角色、任务与公开投影保持一致', () => {
  const sizes = [
    [2, 3, 2, 3, 3],
    [2, 3, 4, 3, 4],
    [2, 3, 3, 4, 4],
    [3, 4, 4, 5, 5],
    [3, 4, 4, 5, 5],
    [3, 4, 4, 5, 5],
  ];
  for (const variant of ['classic', 'court'] as const)
    for (const count of [10, 9, 8, 7, 6, 5]) {
      const s = fixture(variant, count);
      expect(s.seats).toHaveLength(count);
      expect(
        Object.values(s.roles).filter((r) => alignment(r) === 'evil'),
      ).toHaveLength(count === 10 ? 4 : count >= 7 ? 3 : 2);
      expect(questSizes(count)).toEqual(sizes[count - 5]);
      expect(validateState(structuredClone(s), s.seats)).toEqual(s);
      const publicView = project(s, { role: 'public' });
      expect(publicView.self).toBeNull();
      expect(publicView.revealedRoles).toBeNull();
      expect(publicView.questFailThresholds).toEqual(
        count >= 7 ? [1, 1, 1, 2, 1] : [1, 1, 1, 1, 1],
      );
      expect(rulesByVariant[variant].manifest.players.max).toBe(10);
    }
});

it('7–10人第四任务的一张失败仍成功、两张失败才失败，篡改结果拒绝恢复', () => {
  for (const count of [7, 8, 9, 10])
    for (const variant of ['classic', 'court'] as const)
      for (const fails of [0, 1, 2]) {
        let s = reveal(fixture(variant, count));
        const evil = s.seats.filter((id) => alignment(s.roles[id]!) === 'evil');
        const good = s.seats.filter((id) => alignment(s.roles[id]!) === 'good');
        for (const round of [1, 2, 3, 4]) {
          const size = questSizes(count)[round - 1]!;
          const failSeats =
            round === 4
              ? evil.slice(0, fails)
              : round === 2
                ? []
                : evil.slice(0, 1);
          const team = [...evil.slice(0, 2), ...good].slice(0, size);
          s = quest(approve(s, team), failSeats);
          expect(s.quests.at(-1)!.succeeded).toBe(
            round === 4 ? fails < 2 : round === 2,
          );
        }
        const corrupted = structuredClone(s);
        corrupted.quests[3]!.succeeded = !corrupted.quests[3]!.succeeded;
        expect(() => validateState(corrupted, corrupted.seats)).toThrow();
      }
});
