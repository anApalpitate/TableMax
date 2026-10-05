import type { RoomFeedback } from '../../../packages/protocol/src';
import type { PowerGridView } from '../types';

export type SoundCue = 'bid' | 'fuel' | 'build' | 'plant' | 'run' | 'end';
export type SavedPresentation = {
  theme: string;
  cue: SoundCue | null;
  priority: number;
  major: boolean;
  duration: number;
  actor: string | null;
  plantId: number | null;
  cityId: string | null;
  text: string;
  label: string;
};
const themes: Record<string, [SoundCue | null, number, string]> = {
  end: ['end', 100, '电网结算'],
  step: ['run', 90, 'STEP 生效'],
  'purchase-plant': ['plant', 80, '电厂入网'],
  supply: ['run', 70, '供电到账'],
  build: ['build', 60, '电网连接'],
  offer: ['bid', 50, '电厂开拍'],
  run: ['run', 40, '电厂启动'],
  'buy-resource': ['fuel', 30, '燃料入库'],
  transfer: ['fuel', 30, '燃料转存'],
  'swap-resources': ['fuel', 30, '燃料交换'],
  salvage: ['fuel', 30, '燃料安置'],
  'discard-salvage': ['fuel', 30, '燃料丢弃'],
  bid: ['bid', 20, '报价更新'],
  'discard-plant': [null, 20, '淘汰旧厂'],
  round: [null, 10, '新一轮'],
  'select-regions': [null, 10, '区域已确认'],
  pass: [null, 5, '退出竞拍'],
  'pass-round': [null, 5, '本轮不买'],
};

/** Only called for a newly accepted saved key; ordinary view changes are silent. */
export function classifySaved(
  feedback: RoomFeedback,
  game: PowerGridView,
  previous: PowerGridView | null,
): SavedPresentation | null {
  const events = feedback.events.map((event) => ({
    event,
    verb: event.kind === 'game-ended' ? 'end' : (event.action?.verb ?? ''),
  }));
  if (previous && previous.step !== game.step)
    events.push({
      event: {
        kind: 'effect-complete',
        text: `STEP ${game.step} 已生效`,
      },
      verb: 'step',
    });
  const chosen = events
    .filter((entry) => themes[entry.verb])
    .sort((a, b) => themes[b.verb]![1] - themes[a.verb]![1])[0];
  if (!chosen) return null;
  const [cue, priority, label] = themes[chosen.verb]!;
  const log = [...game.history]
    .reverse()
    .find(
      (entry) =>
        entry.verb === chosen.verb &&
        (chosen.event.action?.actor == null ||
          entry.actor === chosen.event.action.actor),
    );
  const major = priority >= 70 || chosen.verb === 'offer';
  const secondary =
    chosen.verb === 'step'
      ? events.find((entry) => entry.verb === 'supply')?.event.text
      : null;
  return {
    theme: chosen.verb,
    cue,
    priority,
    major,
    duration: chosen.verb === 'end' ? 1800 : major ? 750 : 350,
    actor: log?.actor ?? chosen.event.action?.actor ?? null,
    plantId: log?.plantId ?? null,
    cityId: log?.cityId ?? null,
    label,
    text: secondary ? `${secondary}；${chosen.event.text}` : chosen.event.text,
  };
}

export function soundAllowed(
  previous: { time: number; until: number; priority: number } | null,
  item: SavedPresentation,
  now: number,
) {
  if (!item.cue) return false;
  if (!previous) return true;
  if (now < previous.until && item.priority < previous.priority) return false;
  const interval = item.theme === 'bid' ? 500 : item.cue === 'fuel' ? 650 : 0;
  return now - previous.time >= interval;
}
