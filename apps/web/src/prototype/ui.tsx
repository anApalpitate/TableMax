import type { ButtonHTMLAttributes } from 'react';
import { avatarFor } from './art';
import type { Seat } from './model';

const paths = {
  play: 'm9 5 10 7-10 7Z',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  check: 'm5 12 4 4L19 6',
  arrow: 'M5 12h14m-6-6 6 6-6 6',
  up: 'M12 19V5m-6 6 6-6 6 6',
  pause: 'M8 5v14M16 5v14',
  back: 'M8 8H3V3m0 5a9 9 0 1 1 0 8',
  phone: 'M7 3h10v18H7ZM10 17h4',
  close: 'm6 6 12 12M18 6 6 18',
  wifi: 'M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0m-9 4a5 5 0 0 1 6 0M12 20h.01',
  mute: 'M11 4 6 8H3v8h3l5 4Zm5 5 5 6m0-6-5 6',
  sound: 'M11 4 6 8H3v8h3l5 4Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  people:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0m4-4a4 4 0 0 1 0 8',
  lock: 'M5 10h14v11H5ZM8 10V7a4 4 0 0 1 8 0v3',
  qr: 'M3 3h6v6H3Zm12 0h6v6h-6ZM3 15h6v6H3Zm12 0h3v3h3v3h-6Zm6-3v3M12 12h.01',
  box: 'm3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4m-9 4v10',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function IconButton({
  icon,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName }) {
  return (
    <button {...props}>
      <Icon name={icon} />
      {children}
    </button>
  );
}
export function SeatTile({
  seat,
  own,
  move,
  first,
}: {
  seat: Seat;
  own: boolean;
  move?: () => void;
  first: boolean;
}) {
  return (
    <li className={`seat-tile ${own ? 'own-seat' : ''}`} data-seat={seat.id}>
      <div className="avatar-disc">
        <img src={avatarFor(seat.id)} alt="" />
        <span className={`ready-mark ${seat.ready ? 'is-ready' : ''}`}>
          <Icon name={seat.ready ? 'check' : 'people'} />
        </span>
      </div>
      <strong>
        {seat.nickname}
        {seat.control === 'bot' ? ' · 电脑' : ''}
      </strong>
      <small>
        {seat.id}
        {own ? ' · 你' : ''}
      </small>
      <span className="seat-status">{seat.ready ? '已准备' : '未准备'}</span>
      {move && (
        <IconButton
          icon="up"
          className="seat-move"
          aria-label={`上移座位 ${seat.id}`}
          disabled={first}
          onClick={move}
        >
          上移
        </IconButton>
      )}
    </li>
  );
}
