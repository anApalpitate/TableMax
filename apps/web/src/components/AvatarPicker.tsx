import type { AvatarId, RoomView } from '@tablemax/protocol';
import { avatarChoices } from '../assets/avatars';
import { feedbackText } from '../content/feedback';
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
        {feedbackText('avatar.pickerHint')}
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
              <img
                src={avatar.src || undefined}
                alt=""
                width="88"
                height="88"
              />
              <strong>{avatar.name}</strong>
              {occupied ? (
                <span className="avatar-choice__claimed">
                  {feedbackText('avatar.claimed')}
                </span>
              ) : current ? (
                <span className="avatar-choice__current">
                  {feedbackText('avatar.current')}
                </span>
              ) : selectedId === avatar.id ? (
                <span className="avatar-choice__current">
                  {feedbackText('avatar.selected')}
                </span>
              ) : (
                <span className="avatar-choice__available">
                  {feedbackText('avatar.available')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
