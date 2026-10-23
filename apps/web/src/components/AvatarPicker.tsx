import type { AvatarId, RoomView } from '@tablemax/protocol';
import { avatarChoices } from '../assets/avatars';
import { feedbackText } from '../content/feedback';
import './box-overlays.css';
import './avatar-picker.css';

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
      <div className="avatar-picker__heading">
        <h3>预设头像</h3>
        <p>每个头像限一人使用</p>
      </div>
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
          const selected = selectedId === avatar.id;
          return (
            <button
              type="button"
              className="avatar-choice avatar-option"
              key={avatar.id}
              data-avatar-id={avatar.id}
              data-occupied={occupied}
              aria-pressed={selected}
              aria-label={
                occupied
                  ? feedbackText('avatar.occupiedDescription', {
                      avatar: avatar.name,
                      owner: owner!.name,
                    })
                  : current
                    ? feedbackText('avatar.currentDescription', {
                        avatar: avatar.name,
                      })
                    : avatar.name
              }
              disabled={disabled || occupied || !avatar.src}
              onClick={() => onSelect(avatar.id)}
            >
              <span className="avatar-option__portrait">
                <img
                  src={avatar.src || undefined}
                  alt=""
                  width="112"
                  height="112"
                />
                {(occupied || current || selected) && (
                  <span className="avatar-option__mark" aria-hidden="true">
                    {occupied ? (
                      <svg viewBox="0 0 24 24" fill="none">
                        <rect x="5" y="10" width="14" height="10" rx="3" />
                        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v2" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="m6 12 4 4 8-8" />
                      </svg>
                    )}
                  </span>
                )}
              </span>
              <strong className="avatar-option__name">{avatar.name}</strong>
              {occupied ? (
                <span className="avatar-choice__claimed avatar-option__status">
                  <span>{owner!.name}</span>
                  <span>在用</span>
                </span>
              ) : current ? (
                <span className="avatar-choice__current avatar-option__status">
                  {feedbackText('avatar.current')}
                </span>
              ) : selected ? (
                <span className="avatar-choice__current avatar-option__status">
                  {feedbackText('avatar.selected')}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
