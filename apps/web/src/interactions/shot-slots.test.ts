import { expect, it } from 'vitest';
import { InteractionShotSlots } from './shot-slots';
it('keeps three pending/active shots and the fourth retires exactly the oldest', () => {
  const slots = new InteractionShotSlots<number>(3);
  const first = slots.reserve('one', 1).ticket;
  slots.reserve('two', 2);
  slots.reserve('three', 3);
  expect(slots.reserve('four', 4).evicted).toBe('one');
  expect(slots.current(first)).toBe(false);
  expect(slots.values().map((s) => s.value)).toEqual([2, 3, 4]);
});
it('expiry of one shot does not clear another and duplicate delivery never renews its slot', () => {
  const slots = new InteractionShotSlots<number>(3);
  const one = slots.reserve('one', 1).ticket;
  const two = slots.reserve('two', 2).ticket;
  expect(slots.reserve('one', 99)).toMatchObject({ added: false, ticket: one });
  expect(slots.remove(one)).toBe(true);
  expect(slots.current(two)).toBe(true);
});
it('late preparation or expiry from before reset cannot touch a new slot', () => {
  const slots = new InteractionShotSlots<number>(3);
  const old = slots.reserve('same', 1).ticket;
  slots.clear();
  const newer = slots.reserve('same', 2).ticket;
  expect(slots.current(old)).toBe(false);
  expect(slots.remove(old)).toBe(false);
  expect(slots.current(newer)).toBe(true);
});
