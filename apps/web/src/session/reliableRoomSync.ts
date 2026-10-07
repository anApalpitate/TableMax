export const ROOM_SYNC_TIMEOUT = 5000;
export const ROOM_SYNC_INTERVAL = 10000;
export type SyncPhase = 'connecting' | 'syncing' | 'ready' | 'reconnecting';
export type RoomVersion = {
  instanceId: string;
  revision: number;
  branch: number;
};
export type RoomSyncReply<View> =
  { ok: true; view: View } | { ok: false; reason: string };
type Ticket = {
  epoch: number;
  id: number;
  projectionSequence: number;
  startedAt: number;
};
type Options<View> = {
  connected: () => boolean;
  request: (
    receive: (error: Error | null, reply: RoomSyncReply<View> | null) => void,
  ) => void;
  apply: (view: View, source: 'broadcast' | 'sync', restoring: boolean) => void;
  phase: (phase: SyncPhase) => void;
  reconnect: () => void;
  rejected: (reason: string) => void;
  confirmed?: (view: View, restoring: boolean) => void;
  now?: () => number;
};

// Transport events and acknowledgements share one ordering guard. Its lifetime
// is one credential; every transport reconnect invalidates the old callbacks.
export class ReliableRoomSync<View extends RoomVersion> {
  private epoch = 0;
  private sequence = 0;
  private projectionSequence = 0;
  private inFlight: Ticket | null = null;
  private current: View | null = null;
  private retiredInstances = new Set<string>();
  private disposed = false;
  private state: SyncPhase = 'connecting';

  constructor(private readonly options: Options<View>) {}

  get ready() {
    return !this.disposed && this.state === 'ready';
  }

  private phase(state: SyncPhase) {
    if (this.disposed) return;
    this.state = state;
    this.options.phase(state);
  }

  transportConnected() {
    if (this.disposed) return;
    this.epoch++;
    this.inFlight = null;
    this.phase('syncing');
    this.request();
  }

  transportDisconnected() {
    if (this.disposed) return;
    this.epoch++;
    this.inFlight = null;
    this.phase('reconnecting');
  }

  observe(view: View) {
    if (this.disposed || this.obsolete(view)) return;
    this.apply(view, 'broadcast', !this.ready);
  }

  request(block = false) {
    if (this.disposed) return;
    if (block) this.phase('syncing');
    if (this.inFlight) {
      // The browser may dispatch visibilitychange before running a timeout
      // task that was suspended while the phone slept.
      if (
        (this.options.now?.() ?? Date.now()) - this.inFlight.startedAt >=
        ROOM_SYNC_TIMEOUT
      ) {
        this.transportDisconnected();
        this.options.reconnect();
      }
      return;
    }
    if (!this.options.connected()) {
      this.phase('reconnecting');
      this.options.reconnect();
      return;
    }
    const ticket = {
      epoch: this.epoch,
      id: ++this.sequence,
      projectionSequence: this.projectionSequence,
      startedAt: this.options.now?.() ?? Date.now(),
    };
    this.inFlight = ticket;
    this.options.request((error, reply) => {
      if (
        this.disposed ||
        ticket.epoch !== this.epoch ||
        ticket.id !== this.inFlight?.id
      )
        return;
      this.inFlight = null;
      if (error || !reply) {
        this.transportDisconnected();
        this.options.reconnect();
        return;
      }
      if (!reply.ok) {
        this.transportDisconnected();
        this.options.rejected(reply.reason);
        return;
      }
      const next = reply.view;
      if (
        this.retiredInstances.has(next.instanceId) ||
        (this.current &&
          this.projectionSequence > ticket.projectionSequence &&
          next.instanceId !== this.current.instanceId) ||
        (this.current?.instanceId === next.instanceId &&
          next.branch < this.current.branch)
      ) {
        // A later broadcast already moved the room to a new game or branch.
        // Confirm that room instead of restoring this older request's snapshot.
        this.request(true);
        return;
      }
      const restoring = !this.ready;
      const streamedSameStep =
        this.current?.instanceId === next.instanceId &&
        this.current.branch === next.branch &&
        this.current.revision === next.revision &&
        this.projectionSequence > ticket.projectionSequence;
      // Online seats and transfer requests can change without a game revision.
      // Preserve a newer streamed projection even when these counters match.
      if (!this.obsolete(next) && !streamedSameStep)
        this.apply(next, 'sync', restoring);
      this.phase('ready');
      if (this.current) this.options.confirmed?.(this.current, restoring);
    });
  }

  private obsolete(view: View) {
    if (this.retiredInstances.has(view.instanceId)) return true;
    return (
      this.current?.instanceId === view.instanceId &&
      (view.branch < this.current.branch ||
        view.revision < this.current.revision)
    );
  }

  private apply(view: View, source: 'broadcast' | 'sync', restoring: boolean) {
    if (this.current && this.current.instanceId !== view.instanceId)
      this.retiredInstances.add(this.current.instanceId);
    this.current = view;
    this.projectionSequence++;
    this.options.apply(view, source, restoring);
  }

  dispose() {
    this.disposed = true;
    this.epoch++;
    this.inFlight = null;
  }
}
