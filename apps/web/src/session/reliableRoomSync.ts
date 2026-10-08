export const ROOM_SYNC_TIMEOUT = 5000;
export const ROOM_SYNC_INTERVAL = 15000;
export const ACTION_CONFIRM_DELAY = 800;
export type SyncPhase =
  'connecting' | 'syncing' | 'ready' | 'degraded' | 'reconnecting';
export type RoomVersion = {
  instanceId: string;
  revision: number;
  branch: number;
};
export type RoomStamp = {
  serverSessionId: string;
  instanceId: string;
  branch: number;
  viewSeq: number;
};
export type RoomProjection<View> = {
  stamp: RoomStamp;
  syncHint: 'active' | 'idle';
  interactionWatermark: number;
  view: View;
};
export type RoomSyncReply<View> =
  | ({ ok: true; outcome?: unknown } & RoomProjection<View>)
  | {
      ok: true;
      unchanged: true;
      stamp: RoomStamp;
      syncHint: 'active' | 'idle';
      interactionWatermark: number;
    }
  | { ok: false; reason: string };
export type SyncRequestKind = 'full' | 'probe' | 'command';
type Ticket = {
  epoch: number;
  id: number;
  kind: SyncRequestKind;
  startedAt: number;
  timeout: number;
};
type Options<View> = {
  connected(): boolean;
  request(
    kind: SyncRequestKind,
    stamp: RoomStamp | null,
    timeout: number,
    receive: (error: Error | null, reply: RoomSyncReply<View> | null) => void,
  ): void;
  apply(view: View, source: 'broadcast' | 'sync', restoring: boolean): void;
  phase(phase: SyncPhase): void;
  reconnect(delay: number): void;
  rejected(reason: string): void;
  confirmed?(projection: RoomProjection<View>, restoring: boolean): void;
  commandReply?(reply: RoomSyncReply<View>): void;
  hasCommand?(): boolean;
  now?(): number;
  random?(): number;
};
export function sameRoomStamp(a: RoomStamp, b: RoomStamp) {
  return (
    a.serverSessionId === b.serverSessionId &&
    a.instanceId === b.instanceId &&
    a.branch === b.branch &&
    a.viewSeq === b.viewSeq
  );
}

/** One credential and transport generation owns all state-confirming requests. */
export class ReliableRoomSync<View extends RoomVersion> {
  private epoch = 0;
  private sequence = 0;
  private inFlight: Ticket | null = null;
  private current: RoomProjection<View> | null = null;
  private disposed = false;
  private foreground = true;
  private restoring = true;
  private state: SyncPhase = 'connecting';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private nextProbe = Infinity;
  private nextFull = Infinity;
  private leaseUntil = 0;
  private failures = 0;
  private reconnectAttempts = 0;
  private rtt = 0;
  private samples = 0;
  private needsFull = false;
  private needsCommand = false;
  constructor(private readonly options: Options<View>) {}
  private now() {
    return this.options.now?.() ?? performance.now();
  }
  private random() {
    return this.options.random?.() ?? Math.random();
  }
  get ready() {
    return (
      !this.disposed &&
      this.foreground &&
      !this.restoring &&
      (this.state === 'ready' || this.state === 'degraded') &&
      this.now() < this.leaseUntil
    );
  }
  get stamp() {
    return this.current?.stamp ?? null;
  }
  get probeTimeout() {
    return this.samples < 5
      ? 1500
      : Math.max(1000, Math.min(3000, 4 * this.rtt + 250));
  }
  get probeInterval() {
    return this.current?.syncHint === 'active' ? 500 : 2000;
  }
  private phase(state: SyncPhase) {
    if (this.disposed || this.state === state) return;
    this.state = state;
    this.options.phase(state);
  }
  private cancelTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  private renewLease() {
    this.leaseUntil =
      this.now() + Math.min(8000, 2 * this.probeTimeout + this.probeInterval);
  }
  private jitter(ms: number) {
    return ms * (0.9 + this.random() * 0.2);
  }
  transportConnected() {
    if (this.disposed) return;
    this.epoch++;
    this.inFlight = null;
    this.failures = 0;
    this.restoring = true;
    this.phase('syncing');
    this.needsFull = true;
    this.pump();
  }
  transportDisconnected() {
    if (this.disposed) return;
    this.epoch++;
    this.inFlight = null;
    this.cancelTimer();
    this.restoring = true;
    this.phase('reconnecting');
    const delay = Math.min(
      4000,
      500 * 2 ** Math.min(this.reconnectAttempts++, 3),
    );
    this.options.reconnect(delay * (0.8 + this.random() * 0.4));
  }
  setForeground(value: boolean) {
    if (this.disposed || value === this.foreground) return;
    this.foreground = value;
    if (!value) {
      this.epoch++;
      this.inFlight = null;
      this.cancelTimer();
      this.restoring = true;
      this.phase('syncing');
    } else this.request(true);
  }
  observe(projection: RoomProjection<View>) {
    if (this.disposed || !this.foreground) return;
    if (
      this.current &&
      projection.stamp.serverSessionId !== this.current.stamp.serverSessionId
    ) {
      this.request(true);
      return;
    }
    if (!this.accept(projection, 'broadcast')) return;
    if (!this.restoring) {
      this.renewLease();
      this.schedule();
    }
  }
  request(block = false) {
    if (this.disposed) return;
    if (block) {
      this.restoring = true;
      this.phase('syncing');
      // A wake can precede the suspended request's timeout callback.
      if (
        this.inFlight &&
        this.now() - this.inFlight.startedAt >= this.inFlight.timeout
      ) {
        this.epoch++;
        this.inFlight = null;
      }
    }
    this.needsFull = true;
    this.pump();
  }
  queryCommand() {
    if (this.disposed || !this.options.hasCommand?.()) return;
    this.needsCommand = true;
    if (this.inFlight && !this.restoring && this.inFlight.kind !== 'command') {
      // Retire a routine ticket so an 800 ms action check need not wait for it.
      // Its eventual callback is fenced by the new ticket's id.
      this.inFlight = null;
    }
    this.pump();
  }
  private accept(
    projection: RoomProjection<View>,
    source: 'broadcast' | 'sync',
  ) {
    const { stamp, view } = projection;
    if (stamp.instanceId !== view.instanceId || stamp.branch !== view.branch)
      return false;
    const old = this.current;
    if (old && stamp.serverSessionId === old.stamp.serverSessionId) {
      if (stamp.viewSeq < old.stamp.viewSeq) return false;
      if (
        stamp.viewSeq === old.stamp.viewSeq &&
        (source !== 'sync' || !sameRoomStamp(stamp, old.stamp))
      )
        return false;
      if (
        stamp.instanceId === old.stamp.instanceId &&
        stamp.branch < old.stamp.branch
      )
        return false;
    }
    this.current = projection;
    this.options.apply(view, source, this.restoring);
    return true;
  }
  private pump() {
    if (this.disposed || !this.foreground) return;
    if (!this.options.connected()) {
      if (this.state !== 'reconnecting') this.transportDisconnected();
      return;
    }
    const now = this.now();
    if (!this.restoring && now >= this.leaseUntil) {
      this.restoring = true;
      this.phase('syncing');
      this.needsFull = true;
    }
    if (this.inFlight) {
      this.schedule();
      return;
    }
    const kind: SyncRequestKind | null =
      this.needsFull && this.restoring
        ? 'full'
        : this.needsCommand && this.options.hasCommand?.()
          ? 'command'
          : this.needsFull || now >= this.nextFull
            ? 'full'
            : now >= this.nextProbe
              ? 'probe'
              : null;
    if (!kind) {
      this.schedule();
      return;
    }
    if (kind === 'full') this.needsFull = false;
    if (kind === 'command') this.needsCommand = false;
    const ticket: Ticket = {
      epoch: this.epoch,
      id: ++this.sequence,
      kind,
      startedAt: now,
      timeout: kind === 'probe' ? this.probeTimeout : ROOM_SYNC_TIMEOUT,
    };
    this.inFlight = ticket;
    this.options.request(kind, this.stamp, ticket.timeout, (error, reply) => {
      if (
        this.disposed ||
        ticket.epoch !== this.epoch ||
        ticket.id !== this.inFlight?.id
      )
        return;
      this.inFlight = null;
      if (error || !reply) {
        this.failed(ticket.kind);
        return;
      }
      if (!reply.ok) {
        this.restoring = true;
        this.phase('reconnecting');
        this.options.rejected(reply.reason);
        return;
      }
      this.recordRtt(this.now() - ticket.startedAt);
      const incoming = reply.stamp;
      const old = this.current?.stamp;
      if ('view' in reply) {
        if (
          old &&
          incoming.serverSessionId !== old.serverSessionId &&
          !this.restoring
        ) {
          this.request(true);
          return;
        }
        const staleRecovery =
          old &&
          incoming.serverSessionId === old.serverSessionId &&
          incoming.viewSeq < old.viewSeq;
        if (staleRecovery && this.restoring) {
          this.needsFull = true;
          this.pump();
          return;
        }
        this.accept(reply, 'sync');
      } else if (!old || !sameRoomStamp(incoming, old)) {
        if (
          !old ||
          incoming.serverSessionId !== old.serverSessionId ||
          incoming.viewSeq > old.viewSeq
        ) {
          this.needsFull = true;
          this.pump();
          return;
        }
      }
      if (!this.current) {
        this.needsFull = true;
        this.pump();
        return;
      }
      const restoring = this.restoring;
      this.restoring = false;
      this.failures = 0;
      this.renewLease();
      this.phase('ready');
      this.nextProbe = this.now() + this.jitter(this.probeInterval);
      if ('view' in reply) {
        this.needsFull = false;
        this.nextFull = this.now() + this.jitter(ROOM_SYNC_INTERVAL);
        this.reconnectAttempts = 0;
      }
      this.options.confirmed?.(
        {
          ...this.current,
          interactionWatermark: Math.max(
            this.current.interactionWatermark,
            reply.interactionWatermark,
          ),
        },
        restoring,
      );
      if (kind === 'command') this.options.commandReply?.(reply);
      this.pump();
    });
    this.schedule();
  }
  private recordRtt(value: number) {
    this.rtt = this.samples ? 0.8 * this.rtt + 0.2 * value : value;
    this.samples++;
  }
  private failed(kind: SyncRequestKind) {
    this.failures++;
    if (
      (kind === 'probe' || kind === 'command') &&
      this.failures === 1 &&
      !this.restoring
    ) {
      this.phase('degraded');
      this.needsFull = true;
      this.pump();
    } else this.transportDisconnected();
  }
  private schedule() {
    this.cancelTimer();
    if (this.disposed || !this.foreground || this.state === 'reconnecting')
      return;
    let due = this.inFlight
      ? this.inFlight.startedAt + this.inFlight.timeout
      : Math.min(this.nextProbe, this.nextFull);
    if (!this.restoring) due = Math.min(due, this.leaseUntil);
    if (!Number.isFinite(due)) return;
    this.timer = setTimeout(
      () => {
        this.timer = null;
        if (
          this.inFlight &&
          this.now() >= this.inFlight.startedAt + this.inFlight.timeout
        ) {
          const kind = this.inFlight.kind;
          this.inFlight = null;
          this.failed(kind);
        } else this.pump();
      },
      Math.max(1, due - this.now()),
    );
  }
  dispose() {
    this.disposed = true;
    this.epoch++;
    this.inFlight = null;
    this.cancelTimer();
  }
}
