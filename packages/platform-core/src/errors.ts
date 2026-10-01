export class Rejection extends Error {}
export const requireThat: (ok: unknown, reason: string) => asserts ok = (
  ok,
  reason,
) => {
  if (!ok) throw new Rejection(reason);
};
