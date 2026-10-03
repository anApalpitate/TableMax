import { useEffect, useState } from 'react';
import { OverlayPanel } from './OverlayPanel';
import type { RoomSession } from '../session/useRoomSession';

export function PlayModeControl({ session }: { session: RoomSession }) {
  const [open, setOpen] = useState(false);
  const { isHost, view, command, locked } = session;
  useEffect(() => {
    if (!isHost) return;
    const shortcut = (event: KeyboardEvent) => {
      if (
        event.key !== 'F12' ||
        !event.ctrlKey ||
        !event.shiftKey ||
        event.altKey ||
        event.metaKey ||
        event.repeat
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(true);
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [isHost]);
  if (!isHost || !view || !open) return null;
  return (
    <OverlayPanel title="运行模式" close={() => setOpen(false)}>
      <div className="mode-options">
        <button
          type="button"
          aria-label="游玩模式"
          disabled={locked}
          aria-pressed={view.playMode === 'play'}
          onClick={() => command({ type: 'set-play-mode', mode: 'play' })}
        >
          <strong>游玩模式</strong>
          <span>
            正常聚会游玩，显示已保存操作的动效，并允许公共屏播放声音。
          </span>
        </button>
        <button
          type="button"
          aria-label="测试模式"
          disabled={locked}
          aria-pressed={view.playMode === 'test'}
          onClick={() => command({ type: 'set-play-mode', mode: 'test' })}
        >
          <strong>测试模式</strong>
          <span>
            关闭动效与声音，用于快速检查和验证。各端显示测试模式标记。
          </span>
        </button>
      </div>
      <p>模式由电脑管理员统一设置，已保存的牌桌状态和玩家身份继续保留。</p>
    </OverlayPanel>
  );
}
