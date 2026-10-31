import {
  normalizePlayerName,
  playerNameError,
  PLAYER_NAME_INPUT_LIMIT,
  type BotDifficulty,
} from '@tablemax/protocol';
import { useRef, useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from './OverlayPanel';
import { feedbackText } from '../content/feedback';
import { useNotifications } from './notifications/context';
import { avatarFor } from '../assets/avatars';
import './seat-settings.css';
import { useGameClient } from '../game-clients/registry';

const difficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};

export function SeatSettings({
  session,
  removeSeat,
}: {
  session: RoomSession;
  removeSeat(id: string): void;
}) {
  const { view, isHost, canManageSeats, locked, command } = session;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [operation, setOperation] = useState<'menu' | 'rename'>('menu');
  const notifications = useNotifications();
  const [nameRejected, setNameRejected] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [hint, setHint] = useState('');
  const nameInput = useRef<HTMLInputElement>(null);
  const nameError = playerNameError(draftName);
  const { client } = useGameClient(
    view?.game?.id,
    view?.game?.variantId,
    view?.game?.releaseRef,
  );
  const BotDifficultyHelp = client?.BotDifficultyHelp;
  if (!canManageSeats || !view) return null;
  const selected = view.seats.find((seat) => seat.id === selectedId);
  const playing = view.status === 'playing';
  const canOrder = isHost && view.status === 'lobby';
  const close = () => {
    setSelectedId(null);
    setHint('');
    setNameRejected(false);
  };
  return (
    <>
      {BotDifficultyHelp &&
        view.seats.some((seat) => seat.controller === 'bot') && (
          <details className="seat-difficulty-help">
            <summary>电脑玩家等级说明</summary>
            <BotDifficultyHelp />
          </details>
        )}
      <div className="seat-manager__list">
        {view.seats.map((seat, index) => (
          <div
            className="seat-manager__row seat-settings-row"
            key={seat.id}
            data-seat-id={seat.id}
          >
            <div className="seat-settings-portrait">
              <img
                className="seat-settings-avatar"
                src={avatarFor(seat.avatarId)}
                alt=""
              />
              <span className="seat-manager__number">{index + 1}</span>
            </div>
            <div className="seat-settings-identity">
              <strong>{seat.name}</strong>
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
                      {label}人机
                    </option>
                  ))}
                </select>
              ) : seat.controller === 'bot' ? (
                <span className="seat-settings-level">
                  {difficultyNames[seat.botDifficulty ?? 'default']}人机
                </span>
              ) : (
                <span
                  className="seat-settings-status"
                  data-online={seat.online}
                >
                  {seat.online ? '已连接' : '离线'}
                </span>
              )}
            </div>
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
        <OverlayPanel title="座位操作" close={close}>
          <div className="seat-settings-operations">
            <div className="seat-settings-target">
              <img src={avatarFor(selected.avatarId)} alt="" />
              <strong>{selected.name}</strong>
            </div>
            {canOrder && (
              <button
                type="button"
                className="secondary seat-settings-move"
                aria-label={`${selected.name}前移`}
                disabled={locked || view.seats[0]?.id === selected.id}
                onClick={() => {
                  const ids = view.seats.map((entry) => entry.id);
                  const index = ids.indexOf(selected.id);
                  if (index < 1) return;
                  [ids[index - 1], ids[index]] = [ids[index]!, ids[index - 1]!];
                  command({ type: 'order', seats: ids });
                  close();
                }}
              >
                前移一位
              </button>
            )}
            <button
              type="button"
              className="secondary seat-settings-rename"
              disabled={locked}
              onClick={() => setOperation('rename')}
            >
              修改名称
            </button>
            <button
              type="button"
              className="secondary seat-settings-remove"
              disabled={locked || (!isHost && selected.id === view.self.seatId)}
              onClick={() => {
                if (playing) setHint(feedbackText('seats.removeWhilePlaying'));
                else {
                  const id = selected.id;
                  close();
                  removeSeat(id);
                }
              }}
            >
              移除{selected.controller === 'bot' ? '人机' : '玩家'}
            </button>
            {!isHost && selected.id === view.self.seatId && (
              <p className="seat-settings-hint">
                {feedbackText('seats.ownerManagedByHost')}
              </p>
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
        <OverlayPanel title="修改名称" close={close} initialFocus={nameInput}>
          <form
            className="seat-settings-rename-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (nameError) {
                setNameRejected(true);
                notifications?.show(nameError, 'error');
                return;
              }
              const name = normalizePlayerName(draftName);
              if (!locked && name) {
                if (name !== selected.name)
                  command({
                    type: 'set-seat-name',
                    seatId: selected.id,
                    name,
                  });
                close();
              }
            }}
          >
            <label htmlFor="player-seat-name">玩家名称</label>
            <input
              id="player-seat-name"
              ref={nameInput}
              title={feedbackText('seats.nameNormalization')}
              aria-description={feedbackText('seats.nameNormalization')}
              value={draftName}
              maxLength={PLAYER_NAME_INPUT_LIMIT}
              aria-invalid={nameRejected}
              disabled={locked}
              onChange={(event) => {
                setNameRejected(false);
                setDraftName(event.target.value);
              }}
            />
            <div className="dialog-actions">
              <button type="button" className="secondary" onClick={close}>
                取消
              </button>
              <button
                disabled={
                  locked ||
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
    </>
  );
}
