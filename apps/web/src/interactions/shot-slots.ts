export interface ShotTicket<T> {
  eventId: string;
  token: number;
  value: T;
}
/** Pending preparations count as slots, so a fourth event also retires slow work. */
export class InteractionShotSlots<T> {
  private sequence = 0;
  private readonly slots = new Map<string, ShotTicket<T>>();
  constructor(private readonly limit: number) {}
  reserve(eventId: string, value: T) {
    const existing = this.slots.get(eventId);
    if (existing) return { ticket: existing, evicted: undefined, added: false };
    const ticket = { eventId, token: ++this.sequence, value };
    this.slots.set(eventId, ticket);
    const evicted =
      this.slots.size > this.limit ? this.slots.keys().next().value : undefined;
    if (evicted !== undefined) this.slots.delete(evicted);
    return { ticket, evicted, added: true };
  }
  current(ticket: ShotTicket<T>) {
    return this.slots.get(ticket.eventId)?.token === ticket.token;
  }
  remove(ticket: ShotTicket<T>) {
    if (!this.current(ticket)) return false;
    this.slots.delete(ticket.eventId);
    return true;
  }
  values() {
    return [...this.slots.values()];
  }
  clear() {
    this.slots.clear();
  }
}
