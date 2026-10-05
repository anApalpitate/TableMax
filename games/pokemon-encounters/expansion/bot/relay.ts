import { copyTableFields, type TableFields } from './table';

export function previewRelay(
  fields: TableFields,
  order: readonly string[],
  incoming: string,
  firstSlot: number,
  score: (board: string[], up: boolean[]) => number,
) {
  const { boards, up } = copyTableFields(fields);
  const moves: {
    seat: string;
    slot: number;
    incoming: string;
    outgoing: string;
  }[] = [];
  let held = incoming;
  for (const [index, seat] of order.entries()) {
    const board = boards[seat]!,
      faces = up[seat]!;
    let slot = firstSlot;
    if (index > 0) {
      let best = Infinity;
      // Other seats are predicted by a stable, self-score greedy policy on
      // this same hypothesis. This is not a claim about their actual memory.
      for (let candidate = 0; candidate < 9; candidate++) {
        const outgoing = board[candidate]!,
          wasUp = faces[candidate]!;
        board[candidate] = held;
        faces[candidate] = true;
        const value = score(board, faces);
        board[candidate] = outgoing;
        faces[candidate] = wasUp;
        if (value < best) {
          best = value;
          slot = candidate;
        }
      }
    }
    const outgoing = board[slot]!;
    board[slot] = held;
    faces[slot] = true;
    moves.push({ seat, slot, incoming: held, outgoing });
    held = outgoing;
  }
  return { boards, up, moves, discarded: held };
}
