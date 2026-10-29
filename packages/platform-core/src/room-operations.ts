import { Rejection } from './errors';

export type RoomShutdownStatus = 'drained' | 'save-failed';

/** Serial admission and shutdown only. Save data and the sole commit path stay in RoomCoordinator. */
export class RoomOperations {
  private queue: Promise<unknown> = Promise.resolve();
  private shutdown?: Promise<RoomShutdownStatus>;
  private persistenceFailed = false;
  private closed = false;
  get closing() {
    return this.closed;
  }

  enqueue<T>(operation: () => T | Promise<T>): Promise<T> {
    if (this.closed) return Promise.reject(new Rejection('service-closing'));
    const pending = this.queue.then(operation);
    this.queue = pending.catch(() => undefined);
    return pending;
  }
  beginShutdown(): Promise<RoomShutdownStatus> {
    if (!this.shutdown) {
      this.closed = true;
      this.shutdown = this.queue.then(() =>
        this.persistenceFailed ? 'save-failed' : 'drained',
      );
    }
    return this.shutdown;
  }
  reserveUpdateShutdown(isPlaying: () => boolean): Promise<boolean> {
    if (this.closed) return Promise.resolve(false);
    this.closed = true;
    const reservation = this.queue.then(() => {
      if (isPlaying()) {
        if (!this.shutdown) this.closed = false;
        return false;
      }
      return true;
    });
    this.queue = reservation.catch(() => undefined);
    return reservation;
  }
  persist(write: () => void) {
    try {
      write();
      // Open admission can recover; shutdown must retain any failed admitted write.
      if (!this.closed) this.persistenceFailed = false;
    } catch (error) {
      this.persistenceFailed = true;
      throw error;
    }
  }
}
