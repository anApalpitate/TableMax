import { useState } from 'react';
import { SettingHelp } from '@tablemax/web-host';
import type { JsonValue } from '@tablemax/game-sdk';
import type { RoomSession } from '../session/useRoomSession';
import { useGameClient } from '../game-clients/registry';

export function GameSetupSettings({ session }: { session: RoomSession }) {
  const game = session.view?.game;
  if (!game || game.setup === undefined) return null;
  return (
    <SelectedGameSetup
      key={`${game.id}:${game.variantId ?? ''}:${game.releaseRef ?? ''}:${JSON.stringify(game.setup)}`}
      session={session}
    />
  );
}

function SelectedGameSetup({ session }: { session: RoomSession }) {
  const game = session.view!.game!;
  const saved = JSON.stringify(game.setup);
  const [draft, setDraft] = useState<JsonValue>(
    () => JSON.parse(saved) as JsonValue,
  );
  const { client, error, retry } = useGameClient(
    game.id,
    game.variantId,
    game.releaseRef,
  );
  const editable =
    session.view?.status === 'lobby' &&
    session.view.capabilities.control &&
    !session.locked &&
    !session.awaitingConfirmation;
  const Settings = client?.SetupSettings;
  return (
    <section
      className="game-setup-settings"
      aria-label={`${game.name} 开局设置`}
    >
      <SettingHelp
        label={`${game.name} 开局设置`}
        hint={
          session.view?.status === 'lobby'
            ? '仅开局前可调整；应用后真人玩家需重新准备。'
            : '当前对局规则已固定，下一场开始前可调整。'
        }
      />
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
          {session.view?.status === 'lobby' &&
            session.view.capabilities.control && (
              <button
                type="button"
                disabled={!editable || JSON.stringify(draft) === saved}
                onClick={() =>
                  session.command({ type: 'set-game-setup', setup: draft })
                }
              >
                应用开局设置
              </button>
            )}
        </>
      ) : (
        <p role="status">正在载入开局设置…</p>
      )}
    </section>
  );
}
