import type { RoomCoordinator } from './room';

/** Only the server schedules rule deadlines. Every expiry re-enters the same
 * serialized transaction queue as player actions and rechecks its phase. */
export class AutomaticScheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private stopped = false;
  private unsubscribe: () => void;
  constructor(private room: RoomCoordinator) {
    this.unsubscribe = room.subscribe(() => this.schedule());
    this.schedule();
  }
  private schedule() {
    clearTimeout(this.timer);
    if (this.stopped) return;
    const task = this.room.automaticTask();
    if (!task) return;
    this.timer = setTimeout(
      () => {
        void this.room
          .runAutomatic(task)
          .then(() => this.schedule())
          .catch(() => {
            // A closed coordinator refuses new operations. A storage/rules failure
            // inside an admitted operation is paused by runAutomatic, not retried.
          });
      },
      Math.max(1, task.remainingMs),
    );
    this.timer.unref?.();
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.unsubscribe();
  }
}
