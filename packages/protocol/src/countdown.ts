import { z } from 'zod';

export const COUNTDOWN_STEPS = [
  5, 8, 10, 12, 15, 20, 25, 30, 40, 50, 60, 75, 90, 105, 120,
] as const;
export const DEFAULT_COUNTDOWN_SECONDS = 20;
export const CountdownSecondsSchema = z
  .number()
  .int()
  .refine((value) => COUNTDOWN_STEPS.some((step) => step === value));
export const DecisionClockSchema = z
  .object({
    // An opaque presentation identity; never a game decision or secret action.
    id: z.string().uuid(),
    remainingMs: z.number().int().min(0).max(120_000),
    serverTime: z.number().int().nonnegative(),
    running: z.boolean(),
  })
  .strict();
export type DecisionClock = z.infer<typeof DecisionClockSchema>;
