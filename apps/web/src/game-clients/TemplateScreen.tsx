/* eslint-disable react-refresh/only-export-components -- Lazy adapters expose one platform client object. */
import type { GameClient } from './registry';
import type { JsonValue } from '../../../../packages/game-sdk/src';
import type { RoomSession } from '../session/useRoomSession';
import type { TemplateView } from '../../../../games/template/ui/view';
import { PlayerControls } from '../../../../games/template/ui/player';
import { SeatResult } from '../../../../games/template/ui/public';
import { ScreenLink } from '../components/ScreenLink';
import { SessionFeedback } from '../components/SessionFeedback';
import { RoomManagement } from '../components/RoomManagement';

function TemplateScreen({ session }: { session: RoomSession }) {
  const { view, locked, command } = session;
  const game = view?.gameView as TemplateView | null;
  return (
    <main className="shell">
      <ScreenLink className="button secondary" href={`/${session.role}`}>
        ‹ 盒子
      </ScreenLink>
      <h1>{view?.game?.name}</h1>
      <SessionFeedback session={session} />
      {game &&
        view?.seats.map((seat) => (
          <section className="card" key={seat.id}>
            <h2>{seat.name}</h2>
            <SeatResult view={game} seatId={seat.id} />
            {seat.id === session.self?.id && (
              <PlayerControls
                view={game}
                actions={view.actions as JsonValue[]}
                locked={locked}
                choose={(action) => {
                  if (view.decisionId)
                    command({
                      type: 'game',
                      decisionId: view.decisionId,
                      action,
                    });
                }}
              />
            )}
          </section>
        ))}
      <RoomManagement session={session} />
    </main>
  );
}
export const client: GameClient = {
  Screen: TemplateScreen,
  savedChanges: () => [],
  motionDuration: 0,
};
