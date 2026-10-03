import type { AvatarId, RoomView } from '@tablemax/protocol';
import { avatarChoices } from '../assets/avatars';
import './box-overlays.css';

export function AvatarPicker({
  seats,
  selfId,
  selectedId,
  disabled,
  message,
  onSelect,
}: {
  seats: RoomView['seats'];
  selfId: string | null;
  selectedId: AvatarId | null;
  disabled: boolean;
  message: string;
  onSelect(id: AvatarId): void;
}) {
  return (
    <section className="avatar-picker">
      <p className="avatar-picker__intro">
        选个喜欢的伙伴，入座后就是你的专属头像。
      </p>
      {message && (
        <p className="avatar-picker__message" role="status">
          {message}
        </p>
      )}
      <div className="avatar-picker__grid" role="group" aria-label="头像预设">
        {avatarChoices.map((avatar) => {
          const owner = seats.find((seat) => seat.avatarId === avatar.id);
          const occupied = Boolean(owner && owner.id !== selfId);
          const current = Boolean(owner && owner.id === selfId);
          return (
            <button
              type="button"
              className="avatar-choice"
              key={avatar.id}
              data-avatar-id={avatar.id}
              data-occupied={occupied}
              aria-pressed={selectedId === avatar.id}
              aria-label={`${avatar.name}${occupied ? `，已被选择，${owner!.name}` : current ? '，当前头像' : ''}`}
              disabled={disabled || occupied || !avatar.src}
              onClick={() => onSelect(avatar.id)}
            >
              <img
                src={avatar.src || undefined}
                alt=""
                width="88"
                height="88"
              />
              <strong>{avatar.name}</strong>
              {occupied ? (
                <span className="avatar-choice__claimed">已被选择</span>
              ) : current ? (
                <span className="avatar-choice__current">当前头像</span>
              ) : selectedId === avatar.id ? (
                <span className="avatar-choice__current">已选中</span>
              ) : (
                <span className="avatar-choice__available">可选择</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
