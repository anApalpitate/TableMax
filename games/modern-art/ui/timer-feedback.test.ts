import { describe, expect, it } from 'vitest';
import { ModernArtTimerFeedback } from './timer-feedback';

describe('saved decision time reminders', () => {
  it('reminds once across zero, independent of repeated samples and synchronization', () => {
    const reminder = new ModernArtTimerFeedback();
    expect(reminder.accept('instance:0:clock', 5000, true)).toBe(false);
    expect(reminder.accept('instance:0:clock', 100, true)).toBe(false);
    expect(reminder.accept('instance:0:clock', 0, true)).toBe(true);
    expect(reminder.accept('instance:0:clock', 0, true)).toBe(false);
    expect(reminder.accept('instance:0:clock', 100, true)).toBe(false);
    expect(reminder.accept('instance:0:clock', 0, true)).toBe(false);
  });
  it('does not replay elapsed clocks on mount, reload or paused zero samples', () => {
    const reminder = new ModernArtTimerFeedback();
    expect(reminder.accept('already-elapsed', 0, true)).toBe(false);
    expect(reminder.accept('paused', 1000, false)).toBe(false);
    expect(reminder.accept('paused', 0, false)).toBe(false);
    expect(reminder.accept('paused', 0, true)).toBe(false);
  });
  it('resumes a positive paused clock and allows a new clock or branch to remind', () => {
    const reminder = new ModernArtTimerFeedback();
    reminder.accept('instance:0:first', 1000, true);
    reminder.accept('instance:0:first', 600, false);
    expect(reminder.accept('instance:0:first', 0, true)).toBe(true);
    reminder.accept('instance:1:first', 1000, true);
    expect(reminder.accept('instance:1:first', 0, true)).toBe(true);
    reminder.accept('instance:1:second', 1000, true);
    expect(reminder.accept('instance:1:second', 0, true)).toBe(true);
  });
});
