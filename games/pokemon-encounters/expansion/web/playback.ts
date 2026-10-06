import type { View } from '../project';
import {
  ordinaryTheme,
  presentationCreature,
  savedBoardEffects,
  type EventEffect,
  type BoardEffects,
} from './presentation';
import { poseSequences } from './poses/timeline';

export type SavedEvent = View['events'][number] & { effect?: EventEffect };
export type PresentationStep = {
  key: string;
  revision: number;
  event: SavedEvent;
  kind: 'ability' | 'board' | 'research' | 'result';
  durationMs: number;
  creature: string | null;
  effects: BoardEffects;
  research: View['activeResearch'][number] | null;
  winners: string[];
  match: boolean;
};

/** Keep the saved win hidden until the terminal presentation reaches results. */
export function presentedWins(
  game: Pick<View, 'winsBySeat' | 'roundResult'>,
  seat: string,
  resultReady: boolean,
) {
  return Math.max(
    0,
    (game.winsBySeat[seat] ?? 0) -
      (!resultReady && game.roundResult?.winners.includes(seat) ? 1 : 0),
  );
}

/** Capture only saved public presentation facts, never peek cards or votes. */
export function presentationSteps(
  game: View,
  events: readonly SavedEvent[],
  revision: number,
  reduced: boolean,
): PresentationStep[] {
  const steps: PresentationStep[] = [];
  const add = (
    event: SavedEvent,
    kind: PresentationStep['kind'],
    durationMs: number,
    creature: string | null,
    effects: BoardEffects,
  ) => {
    steps.push({
      key: `${event.id}:${kind}`,
      revision,
      event: structuredClone(event),
      kind,
      durationMs,
      creature,
      effects,
      research:
        kind === 'research'
          ? structuredClone(game.activeResearch.at(-1) ?? null)
          : null,
      winners:
        kind === 'result'
          ? [
              ...(game.matchWinners.length
                ? game.matchWinners
                : (game.roundResult?.winners ?? [])),
            ]
          : [],
      match: game.matchWinners.length > 0,
    });
  };
  // A terminal action may append research/result before its action summary.
  const ordered = [
    ...events.filter((e) => e.action),
    ...events.filter((e) => !e.action),
  ];
  for (const event of ordered) {
    const creature = presentationCreature(event.action, event.effect ?? {});
    const effects = savedBoardEffects(event.action, game.boards, event.effect);
    if (creature && poseSequences[creature])
      add(
        event,
        'ability',
        reduced ? 350 : poseSequences[creature].durationMs,
        creature,
        effects,
      );
    if (
      Object.values(effects).some((v) => v.length) ||
      ordinaryTheme(event.action)
    )
      add(event, 'board', reduced ? 180 : 540, null, effects);
    if (event.kind === 'research')
      add(event, 'research', reduced ? 350 : 2500, null, effects);
    if (event.kind === 'round-result')
      add(event, 'result', reduced ? 600 : 1400, null, effects);
  }
  return steps;
}

/** Normal saves append; only a generation change/cancel discards pending work. */
export class PresentationQueue {
  private seen = new Set<number>();
  private scope = '';
  readonly steps: PresentationStep[] = [];
  reset(scope: string, committedIds: readonly number[] = []) {
    this.scope = scope;
    this.seen = new Set(committedIds);
    this.steps.length = 0;
  }
  append(scope: string, steps: readonly PresentationStep[]) {
    if (scope !== this.scope) this.reset(scope);
    const fresh = steps.filter((s) => !this.seen.has(s.event.id));
    fresh.forEach((s) => this.seen.add(s.event.id));
    this.steps.push(...fresh);
  }
  next() {
    return this.steps.shift() ?? null;
  }
  has(id: number) {
    return this.seen.has(id);
  }
}
