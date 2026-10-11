import { useState } from 'react';
import { OverlayPanel } from './OverlayPanel';
import { moduleFor } from '../catalog';
import type { RoomSession } from '../session/useRoomSession';
import { ResourceButton } from './game-library/resources';
import { feedbackText } from '../content/feedback';
export function PokemonVersion({
  session,
  gameId,
}: {
  session: RoomSession;
  gameId?: string;
}) {
  const [open, setOpen] = useState(false);
  const game = moduleFor(gameId ?? session.view?.game?.id);
  if (!game?.versions) return null;
  const active = session.view?.game?.id === game.catalog.id;
  const selected =
    (active ? session.view?.game?.variantId : undefined) ??
    game.defaultVariantId;
  const choices = game.variants ?? [];
  const editable =
    active &&
    session.view?.capabilities.manage &&
    session.view.status !== 'playing' &&
    !session.awaitingConfirmation;
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        版本：
        {choices.find((v) => v.id === selected)?.name ??
          game.versions.find((v) => v.selected)?.name}
      </button>
      {open && (
        <OverlayPanel
          title={game.catalog.name + '版本'}
          close={() => setOpen(false)}
        >
          <p>
            {session.view?.status === 'playing'
              ? feedbackText('library.endBeforeSwitchVersion')
              : feedbackText('library.switchVersionPreservesPlayers')}
          </p>
          {choices.map((v) => (
            <section key={v.id}>
              <ResourceButton
                resource={{ gameId: game.catalog.id, variantId: v.id }}
                canDownload={!!session.isHost && !session.locked}
                disabled={!editable}
                installedLabel={v.name}
                current={active && v.id === selected}
                currentReleaseRef={session.view?.game?.releaseRef}
                select={() => {
                  session.command({ type: 'select-variant', variantId: v.id });
                  setOpen(false);
                }}
              />
              <p>{v.description}</p>
            </section>
          ))}
        </OverlayPanel>
      )}
    </>
  );
}
