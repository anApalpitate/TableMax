import type { RoomView } from '@tablemax/protocol';
import { getGameClient } from '../game-clients/registry';
export function changedGameSlots(before: RoomView, after: RoomView) {
  return after.game
    ? (getGameClient(after.game.id)?.savedChanges(
        before.gameView,
        after.gameView,
      ) ?? [])
    : [];
}
export function gameMotionDuration(view: RoomView) {
  const duration = view.game && getGameClient(view.game.id)?.motionDuration;
  return (
    (typeof duration === 'function' ? duration(view.gameView) : duration) ||
    1200
  );
}
