import type { BotDifficulty } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';

const difficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};

export function SeatSettings({ session }: { session: RoomSession }) {
  const { view, isHost, locked, command } = session;
  if (!isHost || !view || view.status !== 'lobby')
    return <p>座位调整仅在准备大厅开放。</p>;
  return (
    <div className="seat-manager__list">
      {view.seats.map((seat, index) => (
        <div className="seat-manager__row" key={seat.id} data-seat-id={seat.id}>
          <span className="seat-manager__number">{index + 1}</span>
          <strong>{seat.name}</strong>
          {seat.controller === 'bot' && (
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
          )}
          <button
            type="button"
            className="secondary"
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
          <button
            type="button"
            className="secondary"
            aria-label={`移除${seat.name}`}
            disabled={locked}
            onClick={() => command({ type: 'remove-seat', seatId: seat.id })}
          >
            移除
          </button>
        </div>
      ))}
    </div>
  );
}
