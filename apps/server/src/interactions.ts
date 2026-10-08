import { randomUUID } from 'node:crypto';
import {
  INTERACTION_CATALOG,
  InteractionRequestSchema,
  interactionDuration,
  type InteractionContext,
  type InteractionEvent,
  type InteractionReply,
} from '@tablemax/protocol';

interface InteractionAuthority {
  identity(credential?: string): { role: string; seatId?: string };
  interactionContext(): InteractionContext;
}
interface Pending {
  credential: string;
  event: InteractionEvent;
}

/** Ephemeral room FIFO. Never submits game commands or persists credentials. */
export class InteractionQueue {
  private waiting: Pending[] = [];
  private active: Pending | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private receipts = new Map<
    string,
    { fingerprint: string; reply: InteractionReply }
  >();
  private context: InteractionContext;
  private disposed = false;
  constructor(
    private authority: InteractionAuthority,
    private publish: (event: InteractionEvent) => void,
  ) {
    this.context = authority.interactionContext();
  }
  synchronize() {
    const current = this.authority.interactionContext();
    if (
      current.instanceId === this.context.instanceId &&
      current.branch === this.context.branch
    )
      return false;
    this.context = current;
    clearTimeout(this.timer);
    this.timer = undefined;
    this.waiting = [];
    this.active = null;
    this.receipts.clear();
    return true;
  }
  send(credential: string | undefined, input: unknown): InteractionReply {
    this.synchronize();
    const parsed = InteractionRequestSchema.safeParse(input);
    if (!parsed.success || this.disposed)
      return { ok: false, reason: 'invalid-message' };
    const request = parsed.data;
    let seatId: string;
    try {
      const identity = this.authority.identity(credential);
      if (identity.role !== 'player' || !identity.seatId || !credential)
        return { ok: false, reason: 'unauthorized' };
      seatId = identity.seatId;
    } catch {
      return { ok: false, reason: 'invalid-identity' };
    }
    if (request.instanceId !== this.context.instanceId)
      return { ok: false, reason: 'stale-instance' };
    if (request.branch !== this.context.branch)
      return { ok: false, reason: 'stale-branch' };
    const key = `${credential}:${request.requestId}`;
    const fingerprint = JSON.stringify(request);
    const receipt = this.receipts.get(key);
    if (receipt)
      return receipt.fingerprint === fingerprint
        ? receipt.reply
        : { ok: false, reason: 'invalid-message' };
    if (this.active && this.waiting.length >= INTERACTION_CATALOG.queueLimit)
      return { ok: false, reason: 'queue-full' };
    const event: InteractionEvent = {
      ...request,
      actorSeatId: seatId,
      eventId: randomUUID(),
      durationMs: interactionDuration(request.interaction),
    };
    const reply: InteractionReply = { ok: true, eventId: event.eventId };
    this.receipts.set(key, { fingerprint, reply });
    if (this.receipts.size > 256)
      this.receipts.delete(this.receipts.keys().next().value!);
    this.waiting.push({ credential: credential!, event });
    if (!this.active) this.next();
    return reply;
  }
  private next() {
    if (this.disposed || this.synchronize()) return;
    this.active = null;
    let pending: Pending | undefined;
    while ((pending = this.waiting.shift())) {
      try {
        const identity = this.authority.identity(pending.credential);
        if (
          identity.role !== 'player' ||
          identity.seatId !== pending.event.actorSeatId
        )
          continue;
      } catch {
        continue;
      }
      this.active = pending;
      this.publish(pending.event);
      this.timer = setTimeout(
        () => this.next(),
        pending.event.durationMs + INTERACTION_CATALOG.cooldownMs,
      );
      return;
    }
    this.timer = undefined;
  }
  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.waiting = [];
    this.active = null;
    this.receipts.clear();
  }
}
