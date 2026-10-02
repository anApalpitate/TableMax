import type { BotDifficulty, RoomView } from '@tablemax/protocol';
import { avatarFor } from '../assets/avatars';
import './room-table.css';

const botDifficultyNames: Record<BotDifficulty, string> = {
  default: '默认',
  doubao: '豆包',
  juewu: '绝悟',
};

interface RoomTableProps {
  seats: RoomView['seats'];
  capacity: number;
  selfId: string | null;
  lobby: boolean;
  status: string;
  everyoneReady: boolean;
}

export function RoomTable({
  seats,
  capacity,
  selfId,
  lobby,
  status,
  everyoneReady,
}: RoomTableProps) {
  return (
    <div
      className="room-table"
      data-capacity={Math.min(6, capacity)}
      role="group"
      aria-label="牌桌座位"
    >
      <div className="room-table__floor" aria-hidden="true" />
      <div className="room-table__felt">
        <span className="room-table__logo" aria-hidden="true">
          T
        </span>
        <strong>
          {seats.length === 0
            ? '朋友们，请入座'
            : lobby
              ? everyoneReady
                ? '准备就绪'
                : '等朋友们准备'
              : status}
        </strong>
        <span className="room-table__table-label">TableMax · 聚会牌桌</span>
        <div className="room-table__cards" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
      </div>
      {Array.from({ length: Math.min(6, capacity) }, (_, index) => {
        const seat = seats[index];
        const isSelf = Boolean(seat && seat.id === selfId);
        return (
          <article
            className={`room-table__seat room-table__seat--${index + 1} ${seat ? 'room-table__seat--occupied' : 'room-table__seat--empty'} ${isSelf ? 'room-table__seat--self' : ''}`}
            key={seat?.id ?? `empty-${index}`}
            data-seat-id={seat?.id}
            data-position={index + 1}
            data-self={isSelf}
            aria-label={
              seat
                ? `${index + 1} 号位，${seat.name}${isSelf ? '，你' : ''}，${seat.controller === 'bot' ? `${botDifficultyNames[seat.botDifficulty ?? 'default']}人机` : '手机玩家'}，${lobby ? (seat.ready ? '已准备' : '未准备') : '已入座'}`
                : `${index + 1} 号空座`
            }
          >
            <span className="room-table__seat-number">{index + 1}</span>
            {seat ? (
              <>
                <img
                  className="room-table__avatar"
                  src={avatarFor(seat.id)}
                  alt=""
                />
                <h3 className="room-table__name" title={seat.name}>
                  {seat.name}
                </h3>
                <div className="room-table__identity">
                  {isSelf && <span className="room-table__self">你</span>}
                  {seat.controller === 'bot' ? (
                    <span
                      className={`room-table__difficulty room-table__difficulty--${seat.botDifficulty ?? 'default'}`}
                    >
                      {botDifficultyNames[seat.botDifficulty ?? 'default']}人机
                    </span>
                  ) : (
                    <span
                      className={
                        seat.online
                          ? 'room-table__online'
                          : 'room-table__offline'
                      }
                    >
                      {seat.online ? '手机在线' : '手机离线'}
                    </span>
                  )}
                </div>
                <span
                  className={`room-table__ready ${seat.ready && lobby ? 'room-table__ready--yes' : ''}`}
                >
                  {lobby ? (seat.ready ? '已准备' : '未准备') : '已入座'}
                </span>
              </>
            ) : (
              <>
                <div className="room-table__empty-avatar" aria-hidden="true">
                  <span />
                </div>
                <h3>空座</h3>
                <p>等朋友入座</p>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
