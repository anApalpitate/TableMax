import type { BotDifficulty } from '@tablemax/protocol';
import { useRef, useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from './OverlayPanel';
import { ConfirmationDialog } from './ConfirmationDialog';
import './seat-settings.css';

const difficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};

export function SeatSettings({ session }: { session: RoomSession }) {
  const { view, isHost, canManageSeats, locked, command } = session;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operation, setOperation] = useState<'menu' | 'rename' | 'remove'>(
    'menu',
  );
  const [draftName, setDraftName] = useState('');
  const [hint, setHint] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  if (!canManageSeats || !view) return null;
  const selected = view.seats.find((seat) => seat.id === selectedId);
  const playing = view.status === 'playing';
  const canOrder = isHost && view.status === 'lobby';
  const close = () => {
    setSelectedId(null);
    setHint('');
  };
  return (
    <>
      <div className="seat-manager__list">
        {view.seats.map((seat, index) => (
          <div
            className="seat-manager__row seat-settings-row"
            key={seat.id}
            data-seat-id={seat.id}
          >
            <span className="seat-manager__number">{index + 1}</span>
            <div className="seat-settings-identity">
              <strong>{seat.name}</strong>
              <span>
                {seat.controller === 'bot'
                  ? '人机'
                  : seat.online
                    ? '已连接'
                    : '离线'}
              </span>
            </div>
            {seat.controller === 'bot' && canOrder ? (
              <select
                className="seat-difficulty"
                aria-label={`${seat.name}的人机等级`}
                data-seat-id={seat.id}
                disabled={locked}
                value={seat.botDifficulty ?? 'default'}
                onChange={(event) =>
                  command({
                    type: 'set-bot-difficulty',
                    seatId: seat.id,
                    difficulty: event.target.value as BotDifficulty,
                  })
                }
              >
                {Object.entries(difficultyNames).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : seat.controller === 'bot' ? (
              <span className="seat-settings-level">
                {difficultyNames[seat.botDifficulty ?? 'default']}
              </span>
            ) : null}
            {canOrder && (
              <button
                type="button"
                className="secondary seat-settings-move"
                aria-label={`${seat.name}前移`}
                disabled={locked || index === 0}
                onClick={() => {
                  const ids = view.seats.map((entry) => entry.id);
                  [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
                  command({ type: 'order', seats: ids });
                }}
              >
                前移
              </button>
            )}
            <button
              type="button"
              className="secondary seat-settings-menu"
              aria-label={`${seat.name}座位操作`}
              disabled={locked}
              onClick={() => {
                setSelectedId(seat.id);
                setOperation('menu');
                setDraftName(seat.name);
                setHint('');
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="24"
                height="24"
                aria-hidden="true"
              >
                <circle cx="5" cy="12" r="2" fill="currentColor" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
                <circle cx="19" cy="12" r="2" fill="currentColor" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {selected && operation === 'menu' && (
        <OverlayPanel title={`${selected.name}的座位`} close={close}>
          <div className="seat-settings-operations">
            {selected.controller === 'bot' && (
              <button
                type="button"
                className="secondary seat-settings-rename"
                disabled={locked}
                onClick={() => {
                  if (playing) setHint('请先结束游戏，再修改人机名称。');
                  else setOperation('rename');
                }}
              >
                修改人机名称
              </button>
            )}
            <button
              type="button"
              className="secondary seat-settings-remove"
              disabled={locked || (!isHost && selected.id === view.self.seatId)}
              onClick={() => {
                if (playing) setHint('请先结束游戏，再移除座位。');
                else setOperation('remove');
              }}
            >
              移除{selected.controller === 'bot' ? '人机' : '玩家'}
            </button>
            {!isHost && selected.id === view.self.seatId && (
              <p className="seat-settings-hint">房主座位由电脑管理员管理。</p>
            )}
            {hint && (
              <p className="seat-settings-hint" role="status">
                {hint}
              </p>
            )}
          </div>
        </OverlayPanel>
      )}
      {selected && operation === 'rename' && (
        <OverlayPanel
          title="修改人机名称"
          close={close}
          initialFocus={nameInput}
        >
          <form
            className="seat-settings-rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (
                !locked &&
                !playing &&
                draftName.trim() &&
                draftName.trim() !== selected.name
              ) {
                command({
                  type: 'set-bot-name',
                  seatId: selected.id,
                  name: draftName.trim(),
                });
                close();
              }
            }}
          >
            <label htmlFor="bot-seat-name">人机名称</label>
            <input
              id="bot-seat-name"
              ref={nameInput}
              value={draftName}
              maxLength={24}
              disabled={locked || playing}
              onChange={(event) => setDraftName(event.target.value)}
            />
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={close}>
                取消
              </button>
              <button
                disabled={
                  locked ||
                  playing ||
                  !draftName.trim() ||
                  draftName.trim() === selected.name
                }
              >
                保存名称
              </button>
            </div>
          </form>
        </OverlayPanel>
      )}
      {selected && operation === 'remove' && (
        <ConfirmationDialog
          title="移除座位"
          confirmLabel="确认移除"
          cancel={close}
          disabled={locked || playing}
          confirm={() => {
            command({ type: 'remove-seat', seatId: selected.id });
            close();
          }}
        >
          <p>
            移除 {selected.name}？
            {selected.controller === 'human'
              ? '原手机身份将失效，需要重新入座。'
              : '这名人机将离开牌桌。'}
          </p>
        </ConfirmationDialog>
      )}
    </>
  );
}
