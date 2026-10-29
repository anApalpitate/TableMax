/* eslint-disable react-refresh/only-export-components -- Game-local adapter and presentation helpers. */
import type { GameClient, GameHost } from '@tablemax/web-host';
import { SessionFeedback } from '@tablemax/web-host';
import type { View } from '../project';
import { maximumEntranceMs } from './entrance-descriptors';
import { ExpansionPresentation } from './PresentationContext';
import { ScreenBody } from './ScreenBody';
import './legacy.css';
import './layout.css';
import './arena.css';

function Screen({ session }: { session: GameHost }) {
  const game = session.view?.gameView as View | null;
  if (!game)
    return (
      <main className="expansion-screen">
        <p>正在连接扩展牌桌…</p>
        <SessionFeedback session={session} mode="messages" />
      </main>
    );
  return (
    <ExpansionPresentation session={session} game={game}>
      <ScreenBody session={session} game={game} />
    </ExpansionPresentation>
  );
}

export const client: GameClient = {
  Screen,
  savedChanges: (before, after) => {
    if (!before || !after) return [];
    const a = before as View,
      b = after as View;
    if (a.variantId !== b.variantId || a.roundNumber !== b.roundNumber)
      return [];
    const last = a.events.at(-1)?.id ?? 0;
    return [
      ...b.events.filter((e) => e.id > last).map((e) => `event:${e.id}`),
      ...b.seatOrder.flatMap((id) =>
        (b.boards[id] ?? []).flatMap((c, i) =>
          JSON.stringify(c) !== JSON.stringify(a.boards[id]?.[i])
            ? [c.slotId]
            : [],
        ),
      ),
    ];
  },
  motionDuration: maximumEntranceMs + 650 + 2500 + 150,
};
