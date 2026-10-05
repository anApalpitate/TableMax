import { useState } from 'react';
import { OverlayPanel } from './OverlayPanel';
import { moduleFor } from '../catalog';
export function PokemonVersion({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false);
  const game = moduleFor(gameId);
  if (!game?.versions) return null;
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        版本：{game.versions.find((v) => v.selected)?.name}
      </button>
      {open && (
        <OverlayPanel
          title={game.catalog.name + '版本'}
          close={() => setOpen(false)}
        >
          <p>当前版本已选中，筹备中的版本暂不可切换。</p>
          {game.versions.map((v) => (
            <section key={v.name}>
              <button type="button" disabled aria-current={v.selected}>
                {v.name} · {v.selected ? '已选中' : '筹备中'}
              </button>
              <p>{v.description}</p>
            </section>
          ))}
        </OverlayPanel>
      )}
    </>
  );
}
