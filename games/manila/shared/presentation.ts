import type { ManilaView } from '../rules/view';

/** Public projection differences only; never inspect a hidden share identity. */
export function presentationChanges(
  previous: ManilaView,
  next: ManilaView,
): string[] {
  if (previous.gameId !== 'manila' || next.gameId !== 'manila') return [];
  const changes: string[] = [];
  const add = (name: string) => changes.push(`manila:${name}`);
  if (previous.voyage !== next.voyage) {
    add('voyage');
    return changes;
  }
  if (
    previous.phase === 'auction' &&
    next.phase !== 'auction' &&
    next.phase !== 'financing'
  )
    add('auction');
  if (
    previous.phase === 'financing' &&
    previous.payment?.reason === 'auction' &&
    next.phase !== 'financing'
  )
    add('auction');
  if (next.boats.length && !previous.boats.length) add('setup');
  for (const space of next.spaces) {
    const before = previous.spaces.find((entry) => entry.id === space.id);
    if (space.occupant && space.occupant !== before?.occupant) {
      add(`place:${space.id}`);
      if (space.kind === 'insurance') add('insurance-income');
    }
  }
  const sailed = next.dice.length > previous.dice.length;
  if (sailed) add('sail');
  for (const boat of next.boats) {
    const before = previous.boats.find((entry) => entry.cargo === boat.cargo);
    if (!before) continue;
    if (boat.destination === 'port' && before.destination !== 'port')
      add(`arrive:${boat.cargo}`);
    if (boat.destination === 'shipyard' && before.destination !== 'shipyard')
      add(`repair:${boat.cargo}`);
    if (boat.plundered && !before.plundered) add(`plunder:${boat.cargo}`);
    if (
      !sailed &&
      previous.phase.startsWith('pilot') &&
      boat.position !== before.position
    )
      add(`pilot:${boat.cargo}`);
    if (
      previous.phase === 'board' &&
      boat.crew.some((seat) => !before.crew.includes(seat))
    )
      add(`board:${boat.cargo}`);
  }
  if (next.result && !previous.result) {
    if (
      next.spaces.some(
        (entry) => entry.kind === 'insurance' && entry.occupant,
      ) &&
      next.result.shipyard.length
    )
      add('insurance-pay');
    add('result');
  }
  if (next.phase === 'ended' && previous.phase !== 'ended') add('ended');
  for (const cargo of next.cargos)
    if (next.market[cargo.id] !== previous.market[cargo.id])
      add(`market:${cargo.id}`);
  if (next.auction.bid !== previous.auction.bid) add('bid');
  if (
    next.seatOrder.some((seat) => {
      const before = previous.players[seat],
        after = next.players[seat];
      return (
        before &&
        after &&
        (before.shareCount !== after.shareCount ||
          before.mortgageCount !== after.mortgageCount ||
          before.revealedShares.length !== after.revealedShares.length)
      );
    })
  )
    add('trade');
  return [...new Set(changes)];
}
