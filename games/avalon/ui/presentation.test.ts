import { describe, expect, it } from 'vitest';
import { initialize } from '../rules/engine';
import { project } from '../rules/project';
import {
  AvalonSavedFeedback,
  avalonCue,
  avalonFeedbackKey,
  type Feedback,
} from './presentation';

const feedback = (revision = 1, branch = 0): Feedback => ({
  instanceId: '00000000-0000-4000-8000-000000000001',
  revision,
  branch,
  events: [{ kind: 'avalon-action', text: '已保存' }],
});
const game = () =>
  project(
    initialize({
      seats: ['a', 'b', 'c', 'd', 'e'],
      random: { next: () => 0.25 },
    }),
    { role: 'public' },
  );

describe('Avalon saved public presentation', () => {
  it('does not replay initial snapshots, repeated feedback, or consumed muted events', () => {
    const seen = new AvalonSavedFeedback(feedback());
    expect(seen.accept(feedback())).toBe(false);
    expect(seen.accept(null)).toBe(false);
    expect(seen.accept(feedback(2))).toBe(true);
    expect(seen.accept(feedback(2))).toBe(false);
    expect(seen.accept(feedback(2, 1))).toBe(true);
    expect(avalonFeedbackKey(feedback(2, 1))).not.toBe(
      avalonFeedbackKey(feedback(2)),
    );
  });
  it('prioritizes the sword performance for both assassination outcomes', () => {
    for (const winner of ['good', 'evil'] as const) {
      const view = game();
      view.phase = 'ended';
      view.winner = winner;
      view.latest = {
        serial: 12,
        actor: 'c',
        verb: 'assassination',
        text: '最后一剑',
        targets: ['a'],
      };
      expect(avalonCue(feedback(), view)).toBe('assassination');
      view.latest.verb = 'game-ended';
      expect(avalonCue(feedback(), view)).toBe(`${winner}-win`);
    }
  });
  it('uses the same neutral cue for every concealed vote and quest submission', () => {
    const view = game();
    for (const verb of ['vote-submitted', 'quest-submitted']) {
      view.latest = {
        serial: 1,
        actor: 'a',
        verb,
        text: '已密封',
        targets: [],
      };
      expect(avalonCue(feedback(), view)).toBe('ballot');
      expect(avalonCue(null, view)).toBeNull();
      expect(avalonCue({ ...feedback(), events: [] }, view)).toBeNull();
    }
  });
});
