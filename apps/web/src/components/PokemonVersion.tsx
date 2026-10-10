import { useState } from 'react';
import { OverlayPanel } from './OverlayPanel';
import { moduleFor } from '../catalog';
import type { RoomSession } from '../session/useRoomSession';
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
              <button
                type="button"
                disabled={!editable || v.id === selected}
                aria-current={v.id === selected}
                onClick={() => {
                  session.command({ type: 'select-variant', variantId: v.id });
                  setOpen(false);
                }}
              >
                {v.name}
                {v.id === selected ? ' · 已选中' : ''}
              </button>
              <p>{v.description}</p>
            </section>
          ))}
        </OverlayPanel>
      )}
    </>
  );
}
