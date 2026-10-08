import { randomUUID } from 'node:crypto';
import {
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
/** Publishes each new live interaction immediately, without game state changes. */
export class InteractionDispatcher {
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
    this.publish(event);
    return reply;
  }
  dispose() {
    this.disposed = true;
    this.receipts.clear();
  }
}
