/** This reminder observes the saved clock; it never creates a game action. */
export class ModernArtTimerFeedback {
  private readonly clocks = new Map<
    string,
    { armed: boolean; consumed: boolean }
  >();
  accept(key: string, remainingMs: number, running: boolean) {
    let entry = this.clocks.get(key);
    if (!entry) {
      entry = { armed: remainingMs > 0, consumed: remainingMs <= 0 };
      this.clocks.set(key, entry);
      if (this.clocks.size > 32)
        this.clocks.delete(this.clocks.keys().next().value!);
      return false;
    }
    if (entry.consumed || remainingMs > 0) return false;
    entry.consumed = true;
    return entry.armed && running;
  }
}
