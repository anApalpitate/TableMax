import { useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from './OverlayPanel';
import { ConfirmationDialog } from './ConfirmationDialog';
import { SessionFeedback } from './SessionFeedback';

export function PlayerBindingControl({ session }: { session: RoomSession }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const { isHost, view, command, locked, bindingCode } = session;
  if (!isHost || !view) return null;
  const seat = view.seats.find(
    (entry) => entry.id === selected && entry.controller === 'human',
  );
  return (
    <>
      <button type="button" className="secondary" onClick={() => setOpen(true)}>
        换手机
      </button>
      {open && (
        <OverlayPanel
          title="换手机"
          close={() => {
            setOpen(false);
            setSelected(null);
          }}
        >
          <p>
            选择要换手机的朋友，确认后原手机身份立即失效，座位和游戏数据保留。
          </p>
          <SessionFeedback session={session} />
          {view.seats
            .filter((entry) => entry.controller === 'human')
            .map((entry) => (
              <div className="dialog-player-row" key={entry.id}>
                <strong>{entry.name}</strong>
                <button
                  type="button"
                  className="secondary"
                  disabled={locked}
                  onClick={() => setSelected(entry.id)}
                >
                  {entry.name} · 换手机
                </button>
              </div>
            ))}
          {!view.seats.some((entry) => entry.controller === 'human') && (
            <p>还没有手机玩家入座。</p>
          )}
          {bindingCode && (
            <section className="dialog-section">
              <h3>最新换绑码 · 两分钟有效</h3>
              <p>交给刚刚确认换手机的朋友，在新手机的“换手机绑定”窗口输入。</p>
              <textarea
                readOnly
                aria-label="一次性绑定码"
                value={bindingCode}
              />
            </section>
          )}
          {seat && (
            <ConfirmationDialog
              title="确认换手机"
              confirmLabel="确认换手机"
              disabled={locked}
              cancel={() => setSelected(null)}
              confirm={() => {
                command({ type: 'rebind', seatId: seat.id });
                setSelected(null);
              }}
            >
              <p>
                为 {seat.name} 换手机？原身份会立即失效，座位和游戏数据保留。
              </p>
            </ConfirmationDialog>
          )}
        </OverlayPanel>
      )}
    </>
  );
}
