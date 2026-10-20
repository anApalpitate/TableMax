import type { RoomSession } from '../session/useRoomSession';
import { feedbackText } from '../content/feedback';
import { SettingHelp } from '@tablemax/web-host';
export function OwnerControl({ session }: { session: RoomSession }) {
  const { view, locked, command, isHost } = session;
  if (!view || !isHost) return null;
  return (
    <section className="owner-control room-management-row">
      <SettingHelp
        id="room-owner-label"
        label="手机房主"
        hint={`未指定时由电脑管理员控制对局。${feedbackText('management.ownerCapabilities')}`}
      />
      <select
        id="room-owner"
        aria-labelledby="room-owner-label"
        value={view.ownerSeatId ?? ''}
        disabled={locked}
        onChange={(event) =>
          command({ type: 'set-owner', seatId: event.target.value || null })
        }
      >
        <option value="">未指定</option>
        {view.seats
          .filter((seat) => seat.controller === 'human')
          .map((seat) => (
            <option key={seat.id} value={seat.id}>
              {seat.name}
              {seat.online ? '' : '（离线）'}
            </option>
          ))}
      </select>
    </section>
  );
}
