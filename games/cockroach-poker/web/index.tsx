/* eslint-disable react-refresh/only-export-components -- Lazy module exports the platform client. */
import { useState } from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import {
  ScreenLink,
  SessionFeedback,
  RoomManagement,
  OverlayPanel,
  DisplaySettings,
  PlayModeControl,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { PokerView } from '../ui/view';
import type { Action } from '../rules';
import { Table } from '../ui/public';
import { PlayerControls } from '../ui/player';
import { Effects } from '../ui/Effects';
import { PokerRules } from '../ui/RulesGuide';
import '../ui/style.css';
function Screen({ session }: { session: GameHost }) {
  const [panel, setPanel] = useState<'rules' | 'menu' | null>(null);
  const { view, role } = session;
  const game = view?.gameView as unknown as PokerView | null;
  const names = Object.fromEntries(
    (view?.seats ?? []).map((s) => [s.id, s.name]),
  );
  const choose = (action: Action) => {
    if (
      view?.decisionId &&
      !session.locked &&
      session.connected &&
      view.status === 'playing' &&
      !view.paused
    )
      session.command({
        type: 'game',
        decisionId: view.decisionId,
        action: action as JsonValue,
      });
  };
  const boundary = `${view?.instanceId}:${view?.branch}:${view?.decisionId}`;
  return (
    <main className={`cp-game cp-${role}`}>
      <header className="cp-toolbar">
        <ScreenLink href={`/${role}`}>‹ 盒子</ScreenLink>
        <h1>德国小强</h1>
        <button onClick={() => setPanel('rules')}>图文规则</button>
        <button onClick={() => setPanel('menu')}>管理与设置</button>
      </header>
      <SessionFeedback session={session} />
      <Effects session={session} />
      {game ? (
        <>
          <Table game={game} names={names}>
            {role === 'player' && (
              <PlayerControls
                key={boundary}
                game={game}
                actions={(view?.actions ?? []) as unknown as Action[]}
                disabled={
                  session.locked ||
                  !session.connected ||
                  view?.status !== 'playing' ||
                  !!view.paused
                }
                choose={choose}
                names={names}
              />
            )}
          </Table>
        </>
      ) : (
        <p>等待准备牌桌</p>
      )}
      {panel && (
        <OverlayPanel
          title={panel === 'rules' ? '德国小强图文规则' : '牌桌管理与设置'}
          close={() => setPanel(null)}
          className="cp-dialog"
        >
          {panel === 'rules' ? (
            <PokerRules />
          ) : (
            <>
              <RoomManagement session={session} />
              <PlayModeControl session={session} />
              <DisplaySettings role={role} />
            </>
          )}
        </OverlayPanel>
      )}
    </main>
  );
}
export const client: GameClient = {
  Screen,
  savedChanges(before, after) {
    const a = before as PokerView | null,
      b = after as PokerView | null;
    if (!a || !b || a.serial === b.serial) return [];
    return [
      b.loser
        ? 'cockroach-poker:end'
        : b.last?.card !== a.last?.card
          ? 'cockroach-poker:reveal'
          : 'cockroach-poker:pass',
    ];
  },
  motionDuration: 450,
};
