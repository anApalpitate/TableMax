import { useState } from 'react';
import { OverlayPanel } from './OverlayPanel';
import { original } from '../../../../games/pokemon-encounters/variants/original';

/** Read-only preparation entry. No session commands or game-client imports. */
export function PokemonVersion() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        版本：{original.name}
      </button>
      {open && (
        <OverlayPanel title="宝可梦奇遇版本" close={() => setOpen(false)}>
          <p>在同一个游戏入口中选择版本。</p>
          <button type="button" disabled aria-current="true">
            原版 · 已选中
          </button>
          <p>2×3 场地，16 类／56 张牌，三胜。</p>
          <button type="button" disabled>
            扩展版 · 筹备中
          </button>
          <p>更多精灵、3×3 场地及获胜条件调整正在筹备。</p>
        </OverlayPanel>
      )}
    </>
  );
}
