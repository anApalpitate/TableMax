import type { RoomSession } from '../session/useRoomSession';
export function OwnerControl({ session }: { session: RoomSession }) {
  const { view, locked, command, isHost } = session;
  if (!view || !isHost) return null;
  return (
    <section className="owner-control">
      <label htmlFor="room-owner">手机房主</label>
      <select
        id="room-owner"
        value={view.ownerSeatId ?? ''}
        disabled={locked}
        onChange={(event) =>
          command({ type: 'set-owner', seatId: event.target.value || null })
        }
      >
        <option value="">未指定 · 由电脑控制对局</option>
        {view.seats
          .filter((seat) => seat.controller === 'human')
          .map((seat) => (
            <option key={seat.id} value={seat.id}>
              {seat.name}
              {seat.online ? '' : '（离线）'}
            </option>
          ))}
      </select>
      <p>房主可在手机上开局、开始下一局、再玩、暂停与恢复。</p>
    </section>
  );
}
