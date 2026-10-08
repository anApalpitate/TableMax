import type { InteractionEvent } from '@tablemax/protocol';
import type {
  RoomProjection,
  RoomStamp,
  RoomVersion,
} from './reliableRoomSync';

/** Ephemeral events are consumed once, including those ignored during recovery. */
export class InteractionInbox {
  private context: RoomStamp | null = null;
  private retiredThrough = 0;
  private highestReceived = 0;
  private readonly seen = new Set<string>();
  setContext(stamp: RoomStamp) {
    const old = this.context;
    if (
      !old ||
      old.serverSessionId !== stamp.serverSessionId ||
      old.instanceId !== stamp.instanceId ||
      old.branch !== stamp.branch
    ) {
      this.seen.clear();
      this.retiredThrough = 0;
      this.highestReceived = 0;
    }
    this.context = stamp;
  }
  restore<View extends RoomVersion>(projection: RoomProjection<View>) {
    this.setContext(projection.stamp);
    this.retiredThrough = Math.max(
      this.retiredThrough,
      projection.interactionWatermark,
    );
  }
  receive(event: InteractionEvent, allowed: boolean) {
    if (this.seen.has(event.eventId)) return false;
    this.seen.add(event.eventId);
    if (this.seen.size > 256)
      this.seen.delete(this.seen.values().next().value!);
    const context = this.context;
    if (
      !context ||
      event.serverSessionId !== context.serverSessionId ||
      event.instanceId !== context.instanceId ||
      event.branch !== context.branch
    )
      return false;
    if (
      event.interactionSeq <=
      Math.max(this.retiredThrough, this.highestReceived)
    )
      return false;
    this.highestReceived = event.interactionSeq;
    if (!allowed) {
      this.retiredThrough = Math.max(this.retiredThrough, event.interactionSeq);
      return false;
    }
    return true;
  }
}
