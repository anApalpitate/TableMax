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
  constructor(scope: string, committedIds: readonly number[]) {
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
  ) {
    if (!this.initialized) {
      this.initialized = true;
      this.cancel(scope, committedIds);
      return;
    }
    if (disabled) {
      this.cancel(scope, committedIds);
      return;
    }
    if (this.state.scope !== scope) {
      // A changed instance/branch/round starts from its committed projection.
      this.cancel(scope, committedIds);
      return;
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
