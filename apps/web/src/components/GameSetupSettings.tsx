import { useState } from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import type { RoomSession } from '../session/useRoomSession';
import { useGameClient } from '../game-clients/registry';
import type { GameClient } from '@tablemax/web-host';

export function GameSetupSettings({
  session,
  settings,
}: {
  session: RoomSession;
  settings?: GameClient['SetupSettings'];
}) {
  const game = session.view?.game;
  if (!game || game.setup === undefined) return null;
  const ended = session.view?.status === 'ended';
  const saved =
    ended && game.nextSetup !== undefined ? game.nextSetup : game.setup;
  return (
    <SelectedGameSetup
      key={`${session.view?.instanceId}:${session.view?.status}:${game.id}:${game.variantId ?? ''}:${game.releaseRef ?? ''}:${JSON.stringify(saved)}`}
      session={session}
      saved={JSON.stringify(saved)}
      settings={settings}
    />
  );
}

function SelectedGameSetup({
  session,
  saved,
  settings,
}: {
  session: RoomSession;
  saved: string;
  settings: GameClient['SetupSettings'];
}) {
  const game = session.view!.game!;
  const [draft, setDraft] = useState<JsonValue>(
    () => JSON.parse(saved) as JsonValue,
  );
  const { client, error, retry } = useGameClient(
    settings ? undefined : game.id,
    game.variantId,
    game.releaseRef,
  );
  const [attempted, setAttempted] = useState(false);
  const ended = session.view?.status === 'ended';
  const canEdit =
    session.view!.capabilities.control &&
    (session.view?.status === 'lobby' || (ended && !game.restoreOnly));
  const editable = canEdit && !session.locked && !session.awaitingConfirmation;
  const Settings = settings ?? client?.SetupSettings;
  return (
    <section
      className="game-setup-settings"
      aria-label={`${game.name} 开局设置`}
    >
      {error ? (
        <p role="alert">
          {error}
          <button type="button" onClick={retry}>
            重试
          </button>
        </p>
      ) : Settings ? (
        <>
          <Settings value={draft} disabled={!editable} onChange={setDraft} />
          {canEdit && (
            <div className="dialog-actions">
              {attempted && session.awaitingConfirmation && (
                <button
                  type="button"
                  className="secondary"
                  disabled={!session.connected}
                  onClick={session.retry}
                >
                  重试确认
                </button>
              )}
              <button
                type="button"
                disabled={!editable || JSON.stringify(draft) === saved}
                onClick={() => {
                  setAttempted(true);
                  session.command({ type: 'set-game-setup', setup: draft });
                }}
              >
                {ended ? '保存下一局设置' : '保存开局设置'}
              </button>
            </div>
          )}
          {attempted && session.message && (
            <p role="status">{session.message}</p>
          )}
        </>
      ) : (
        <p role="status">正在载入开局设置…</p>
      )}
    </section>
  );
}
