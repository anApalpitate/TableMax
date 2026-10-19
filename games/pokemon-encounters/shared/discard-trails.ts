/** Public origins only: no card identities or private choices enter a trail. */
export type DiscardSource = '@held' | { seat: string; slot: number };
export type DiscardEffect = { discardSources: DiscardSource[] };

export function validDiscardSources(
  input: unknown,
  seats: readonly string[],
  slotCount: number,
): input is DiscardSource[] {
  if (!Array.isArray(input) || input.length > seats.length + 1) return false;
  const keys = new Set<string>();
  for (const source of input) {
    if (source !== '@held') {
      if (
        !source ||
        typeof source !== 'object' ||
        Array.isArray(source) ||
        Object.keys(source).sort().join(',') !== 'seat,slot' ||
        !seats.includes(source.seat) ||
        !Number.isInteger(source.slot) ||
        source.slot < 0 ||
        source.slot >= slotCount
      )
        return false;
    }
    const key = discardSourceAnchor(source);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
}

export function discardSourceAnchor(source: DiscardSource): string {
  return source === '@held' ? source : `${source.seat}:${source.slot}`;
}
