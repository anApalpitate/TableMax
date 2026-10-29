import { PresentationQueue, type PresentationStep } from './playback';
export type AnchorRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type Snapshot = {
  scope: string;
  current: PresentationStep | null;
  last: PresentationStep | null;
  resultReady: boolean;
  anchors: Readonly<Record<string, AnchorRect>>;
  seen: readonly number[];
};
export class PresentationClock {
  private initialized = true;
  private authorityKey: string;
  private queue = new PresentationQueue();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private listeners = new Set<() => void>();
  private state: Snapshot = {
    scope: '',
    current: null,
    last: null,
    resultReady: true,
    anchors: {},
    seen: [],
  };
  constructor(
    scope: string,
    committedIds: readonly number[],
    authorityKey = scope,
  ) {
    this.authorityKey = authorityKey;
    this.queue.reset(scope, committedIds);
    this.state = { ...this.state, scope, seen: [...committedIds] };
  }
  snapshot = () => this.state;
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  private publish(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  cancel(scope: string, committedIds: readonly number[] = []) {
    clearTimeout(this.timer);
    this.queue.reset(scope, committedIds);
    this.publish({
      scope,
      current: null,
      last: null,
      resultReady: true,
      seen: [...committedIds],
    });
  }
  dispose() {
    this.initialized = false;
    this.cancel('disposed');
  }
  receive(
    scope: string,
    steps: PresentationStep[],
    disabled: boolean,
    committedIds: readonly number[],
    authorityKey = scope,
  ) {
    if (!this.initialized) {
      this.initialized = true;
      this.authorityKey = authorityKey;
      this.cancel(scope, committedIds);
      return;
    }
    if (disabled) {
      this.authorityKey = authorityKey;
      this.cancel(scope, committedIds);
      return;
    }
    if (this.state.scope !== scope) {
      const continuing = this.authorityKey === authorityKey;
      this.authorityKey = authorityKey;
      // Restore/identity changes consume old feedback. A live next round within
      // the same authority may still have a newly saved research/event cue.
      const incoming = new Set(
        continuing ? steps.map((step) => step.event.id) : [],
      );
      this.cancel(
        scope,
        committedIds.filter((id) => !incoming.has(id)),
      );
      if (!continuing) return;
    }
    const fresh = steps.filter((s) => !this.queue.has(s.event.id));
    if (!fresh.length) return;
    this.queue.append(scope, fresh);
    this.publish({
      seen: [...new Set([...this.state.seen, ...fresh.map((s) => s.event.id)])],
      ...(fresh.some((s) => s.kind === 'result') ? { resultReady: false } : {}),
    });
    if (!this.state.current) this.advance();
  }
  private advance() {
    const current = this.queue.next();
    this.publish({
      current,
      ...(current ? { last: current } : {}),
      ...(current?.kind === 'result' ? { resultReady: true } : {}),
    });
    if (current)
      this.timer = setTimeout(() => this.advance(), current.durationMs);
  }
  measure(measured: Readonly<Record<string, AnchorRect>>) {
    const anchors = { ...this.state.anchors, ...measured };
    if (JSON.stringify(anchors) !== JSON.stringify(this.state.anchors))
      this.publish({ anchors });
  }
}
