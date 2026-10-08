import { z } from 'zod';
import catalog from './interaction-catalog.json';

export const ShotIdSchema = z.enum([
  'egg',
  'cappuccino',
  'tomato',
  'flower',
  'poop',
]);
export const PhraseIdSchema = z.enum([
  'hurry',
  'nice',
  'carry',
  'seventeen',
  'shameless',
  'friendly',
]);
export type ShotId = z.infer<typeof ShotIdSchema>;
export type PhraseId = z.infer<typeof PhraseIdSchema>;
const duration = z.number().int().min(1).max(30_000);
const asset = z.string().regex(/^[a-z][a-z0-9-]*\.(mp3|svg|webp)$/);
export const INTERACTION_CATALOG = z
  .object({
    version: z.literal(1),
    playbackPolicy: z.literal('replace'),
    shots: z
      .array(
        z.object({
          id: ShotIdSchema,
          label: z.string().min(1),
          durationMs: duration,
          audio: asset,
          image: asset,
          pourAtMs: z.number().int().min(0).optional(),
          steps: z
            .array(
              z.object({
                object: z.enum([
                  'egg',
                  'slipper',
                  'cappuccino',
                  'tomato',
                  'flower',
                  'poop',
                ]),
                atMs: z.number().int().min(0),
                hitMs: z.number().int().min(0).optional(),
              }),
            )
            .min(1),
        }),
      )
      .length(5),
    phrases: z
      .array(
        z.object({
          id: PhraseIdSchema,
          text: z.string().min(1),
          audio: asset,
          durationMs: duration,
        }),
      )
      .length(6),
  })
  .parse(catalog);
if (
  new Set(INTERACTION_CATALOG.shots.map((s) => s.id)).size !== 5 ||
  new Set(INTERACTION_CATALOG.phrases.map((p) => p.id)).size !== 6
)
  throw new Error('Duplicate interaction slot');
for (const shot of INTERACTION_CATALOG.shots) {
  if (shot.steps.some((step) => step.atMs >= shot.durationMs || (step.hitMs !== undefined && (step.hitMs < step.atMs || step.hitMs >= shot.durationMs))) || (shot.pourAtMs !== undefined && shot.pourAtMs >= shot.durationMs))
    throw new Error(`Interaction timeline exceeds audio: ${shot.id}`);
}

export const InteractionContextSchema = z
  .object({
    instanceId: z.string().uuid(),
    branch: z.number().int().nonnegative(),
  })
  .strict();
export type InteractionContext = z.infer<typeof InteractionContextSchema>;
export const InteractionPayloadSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('shot'),
      effectId: ShotIdSchema,
      point: z
        .object({
          x: z.number().finite().min(0).max(1),
          y: z.number().finite().min(0).max(1),
        })
        .strict(),
    })
    .strict(),
  z.object({ type: z.literal('speech'), phraseId: PhraseIdSchema }).strict(),
]);
export type InteractionPayload = z.infer<typeof InteractionPayloadSchema>;
export const InteractionRequestSchema = InteractionContextSchema.extend({
  requestId: z.string().regex(/^[a-f0-9]{32}$/),
  interaction: InteractionPayloadSchema,
}).strict();
export type InteractionRequest = z.infer<typeof InteractionRequestSchema>;
export const InteractionEventSchema = InteractionRequestSchema.extend({
  eventId: z.string().uuid(),
  actorSeatId: z.string().min(1),
  durationMs: duration,
}).strict();
export type InteractionEvent = z.infer<typeof InteractionEventSchema>;
export const InteractionReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), eventId: z.string().uuid() }).strict(),
  z
    .object({
      ok: z.literal(false),
      reason: z.enum([
        'invalid-message',
        'invalid-identity',
        'unauthorized',
        'stale-instance',
        'stale-branch',
      ]),
    })
    .strict(),
]);
export type InteractionReply = z.infer<typeof InteractionReplySchema>;
export function interactionDuration(payload: InteractionPayload) {
  return payload.type === 'shot'
    ? INTERACTION_CATALOG.shots.find((s) => s.id === payload.effectId)!
        .durationMs
    : INTERACTION_CATALOG.phrases.find((p) => p.id === payload.phraseId)!
        .durationMs;
}
