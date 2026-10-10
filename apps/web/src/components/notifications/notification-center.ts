export type NotificationTone = 'info' | 'success' | 'error';
export type Notification = {
  id: number;
  message: string;
  tone: NotificationTone;
  leaving: boolean;
};
type Timer = {
  handle: ReturnType<typeof setTimeout> | undefined;
  remaining: number;
  started: number;
  holds: Set<string>;
};

export const NOTIFICATION_FADE_MS = 320;

/** One mounted surface owns its notifications and their bounded lifetime. */
export class NotificationCenter {
  private items: readonly Notification[] = [];
  private listeners = new Set<() => void>();
  private timers = new Map<number, Timer>();
  private sequence = 0;
  private hidden = false;

  constructor(readonly limit = 3) {
    if (!Number.isSafeInteger(limit) || limit < 1)
      throw new Error('Notification limit must be a positive integer');
  }

  snapshot = () => this.items;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  show(message: string, tone: NotificationTone = 'info', duration?: number) {
    if (!message.trim()) return;
    const existing = this.items.find(
      (item) => item.message === message && item.tone === tone,
    );
    const id = existing?.id ?? ++this.sequence;
    const holds = new Set(this.timers.get(id)?.holds);
    this.stopTimer(id);
    const item = { id, message, tone, leaving: false };
    const remaining = this.items.filter((value) => value.id !== id);
    while (remaining.length >= this.limit) {
      const oldest = remaining.shift()!;
      this.stopTimer(oldest.id);
    }
    this.items = [...remaining, item];
    this.timers.set(id, {
      handle: undefined,
      remaining: Math.max(0, duration ?? (tone === 'error' ? 8500 : 5500)),
      started: Date.now(),
      holds,
    });
    this.schedule(id);
    this.emit();
    return id;
  }

  dismiss = (id: number) => {
    const item = this.items.find((value) => value.id === id);
    if (!item || item.leaving) return;
    this.stopTimer(id);
    this.items = this.items.map((value) =>
      value.id === id ? { ...value, leaving: true } : value,
    );
    this.timers.set(id, {
      handle: setTimeout(() => this.remove(id), NOTIFICATION_FADE_MS),
      remaining: 0,
      started: Date.now(),
      holds: new Set(),
    });
    this.emit();
  };

  hold(id: number, reason: string, active: boolean) {
    const timer = this.timers.get(id);
    if (!timer || this.items.find((item) => item.id === id)?.leaving) return;
    if (active) {
      this.pause(timer);
      timer.holds.add(reason);
    } else {
      timer.holds.delete(reason);
      this.schedule(id);
    }
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    for (const [id, timer] of this.timers) {
      if (this.items.find((item) => item.id === id)?.leaving) continue;
      if (hidden) this.pause(timer);
      else this.schedule(id);
    }
  }

  clear = () => {
    for (const id of this.timers.keys()) this.stopTimer(id);
    this.items = [];
    this.emit();
  };

  private pause(timer: Timer) {
    if (timer.handle === undefined) return;
    clearTimeout(timer.handle);
    timer.handle = undefined;
    timer.remaining = Math.max(
      0,
      timer.remaining - (Date.now() - timer.started),
    );
  }

  private schedule(id: number) {
    const timer = this.timers.get(id);
    if (!timer || timer.handle !== undefined || timer.holds.size || this.hidden)
      return;
    timer.started = Date.now();
    timer.handle = setTimeout(() => this.dismiss(id), timer.remaining);
  }

  private stopTimer(id: number) {
    clearTimeout(this.timers.get(id)?.handle);
    this.timers.delete(id);
  }

  private remove(id: number) {
    this.stopTimer(id);
    this.items = this.items.filter((item) => item.id !== id);
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }
}
