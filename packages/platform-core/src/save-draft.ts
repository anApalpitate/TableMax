import type { Save } from './model';
// Saved states/checkpoints are immutable after commit. Copy only the containers
// that a command can change, instead of cloning every historical game state.
export function copySave(data: Save): Save {
  return {
    ...data,
    seats: data.seats.map((seat) => ({ ...seat })),
    snapshot: data.snapshot
      ? { ...data.snapshot, bots: { ...data.snapshot.bots } }
      : null,
    history: [...data.history],
    receipts: { ...data.receipts },
    sessionReceipts: { ...data.sessionReceipts },
    transferRequests: Object.fromEntries(
      Object.entries(data.transferRequests ?? {}).map(([key, value]) => [
        key,
        { ...value },
      ]),
    ),
  };
}
