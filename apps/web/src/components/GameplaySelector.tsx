import { useState } from 'react';
import { BoxOverlayPanel } from './BoxOverlayPanel';
import { moduleFor } from '../catalog';
import type { RoomSession } from '../session/useRoomSession';
import { ResourceButton } from './game-library/resources';
import { feedbackText } from '../content/feedback';
import './gameplay-selector.css';
export function GameplaySelector({
  session,
  gameId,
}: {
  session: RoomSession;
  gameId?: string;
}) {
  const [open, setOpen] = useState(false);
  const game = moduleFor(gameId ?? session.view?.game?.id);
  const choices = game?.variants ?? [];
  if (!game || choices.length < 2) return null;
  const active = session.view?.game?.id === game.catalog.id;
  const selected =
    (active ? session.view?.game?.variantId : undefined) ??
    game.defaultVariantId ??
    choices[0]?.id;
  const editable =
    active &&
    session.view?.capabilities.manage &&
    session.view.status !== 'playing' &&
    !session.locked &&
    !session.awaitingConfirmation;
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        版本：
        {choices.find((variant) => variant.id === selected)?.name}
      </button>
      {open && (
        <BoxOverlayPanel
          title={game.catalog.name + '版本'}
          className="gameplay-selector-panel"
          close={() => setOpen(false)}
        >
          <p className="gameplay-selector-panel__notice">
            {session.view?.status === 'playing'
              ? feedbackText('library.endBeforeSwitchVersion')
              : feedbackText('library.switchVersionPreservesPlayers')}
          </p>
          <div className="gameplay-selector-panel__choices">
            {choices.map((v, index) => (
              <section
                className="gameplay-selector-card"
                data-selected={active && v.id === selected}
                key={v.id}
              >
                <div className="gameplay-selector-card__heading">
                  <span
                    className="gameplay-selector-card__number"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <h3>{v.name}</h3>
                  {active && v.id === selected && (
                    <span className="gameplay-selector-card__current">
                      当前版本
                    </span>
                  )}
                </div>
                <p>{v.description}</p>
                <ResourceButton
                  resource={{ gameId: game.catalog.id, variantId: v.id }}
                  canDownload={!!session.isHost && !session.locked}
                  disabled={!editable}
                  installedLabel={v.name}
                  current={active && v.id === selected}
                  currentReleaseRef={session.view?.game?.releaseRef}
                  select={() => {
                    session.command({
                      type: 'select-variant',
                      variantId: v.id,
                    });
                    setOpen(false);
                  }}
                />
              </section>
            ))}
          </div>
        </BoxOverlayPanel>
      )}
    </>
  );
}
