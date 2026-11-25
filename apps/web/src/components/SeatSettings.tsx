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
import {
  botDifficultyNames,
  availableBotDifficulties,
} from '../content/bot-difficulty';
import './seat-settings.css';
import { useGameClient } from '../game-clients/registry';

export function SeatSettings({
  session,
  removeSeat,
}: {
  session: RoomSession;
  removeSeat(id: string): void;
}) {
  const { view, isHost, canManageSeats, locked, command } = session;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const notifications = useNotifications();
  const [nameRejected, setNameRejected] = useState(false);
  const [draftName, setDraftName] = useState('');
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
  const move = (index: number, offset: number) => {
    const target = index + offset;
    if (locked || !canOrder || target < 0 || target >= view.seats.length)
      return;
    const ids = view.seats.map((seat) => seat.id);
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    command({ type: 'order', seats: ids });
  };
  const close = () => {
    setSelectedId(null);
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
              {view.ownerSeatId === seat.id && (
                <span
                  className="seat-settings-owner"
                  role="img"
                  aria-label="房主"
                  title="房主"
                >
                  <SeatActionIcon kind="owner" />
                </span>
              )}
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
                  {availableBotDifficulties(view.game).map((value) => (
                    <option value={value} key={value}>
                      {botDifficultyNames[value]}人机
                    </option>
                  ))}
                </select>
              ) : seat.controller === 'bot' ? (
                <span className="seat-settings-level">
                  {botDifficultyNames[seat.botDifficulty ?? 'default']}人机
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
            <div
              className="seat-settings-actions"
              role="group"
              aria-label={seat.name + '座位操作'}
            >
              <button
                type="button"
                className="secondary seat-settings-up"
                aria-label={seat.name + '前移'}
                title={canOrder ? '前移一位' : '仅管理员可在开局前调整顺序'}
                disabled={locked || !canOrder || index === 0}
                onClick={() => move(index, -1)}
              >
                <SeatActionIcon kind="up" />
              </button>
              <button
                type="button"
                className="secondary seat-settings-down"
                aria-label={seat.name + '后移'}
                title={canOrder ? '后移一位' : '仅管理员可在开局前调整顺序'}
                disabled={
                  locked || !canOrder || index === view.seats.length - 1
                }
                onClick={() => move(index, 1)}
              >
                <SeatActionIcon kind="down" />
              </button>
              <button
                type="button"
                className="secondary seat-settings-rename"
                aria-label={seat.name + '编辑名称'}
                title="编辑名称"
                disabled={locked}
                onClick={() => {
                  setSelectedId(seat.id);
                  setDraftName(seat.name);
                  setNameRejected(false);
                }}
              >
                <SeatActionIcon kind="edit" />
              </button>
              <button
                type="button"
                className="secondary seat-settings-remove"
                aria-label={'移除' + seat.name}
                title={
                  playing
                    ? '请先结束对局再移除座位'
                    : !isHost && seat.id === view.self.seatId
                      ? '房主本人由管理员移除'
                      : '移除座位'
                }
                disabled={
                  locked || playing || (!isHost && seat.id === view.self.seatId)
                }
                onClick={() => removeSeat(seat.id)}
              >
                <SeatActionIcon kind="remove" />
              </button>
              {isHost &&
                seat.controller === 'human' &&
                seat.id !== view.ownerSeatId && (
                  <button
                    type="button"
                    className="secondary seat-settings-owner-action"
                    aria-label={seat.name + '设为房主'}
                    title="设为房主"
                    disabled={locked}
                    onClick={() =>
                      command({ type: 'set-owner', seatId: seat.id })
                    }
                  >
                    <SeatActionIcon kind="owner" />
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>
      {selected && (
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
                setNameRejected(Boolean(playerNameError(event.target.value)));
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
                  Boolean(nameError) ||
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

const seatActionPaths = {
  up: 'M12 19V5m-6 6 6-6 6 6',
  down: 'M12 5v14m-6-6 6 6 6-6',
  edit: 'm15 4 5 5M4 15 16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L9 20l-6 1 1-6Z',
  remove: 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
  owner:
    'm12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2-4.5-4.4 6.3-.9L12 3Z',
};
function SeatActionIcon({ kind }: { kind: keyof typeof seatActionPaths }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={seatActionPaths[kind]} />
    </svg>
  );
}
