import { z } from 'zod';

// Only public engineering diagnostics. No game state, identities, or data paths.
export const HealthSchema = z.object({
  status: z.literal('ready'),
  phase: z.literal('platform-foundation'),
  protocolVersion: z.literal(5),
  database: z.literal('ok'),
  starts: z.number().int().positive(),
  runtime: z.object({
    node: z.string(),
    electron: z.string().nullable(),
    sqlite: z.string(),
  }),
});
export type Health = z.infer<typeof HealthSchema>;

export const EchoSchema = z
  .object({ text: z.string().min(1).max(80) })
  .strict();
export const EchoReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), text: z.string().max(80) }),
  z.object({ ok: z.literal(false), reason: z.literal('invalid-message') }),
]);
export type EchoReply = z.infer<typeof EchoReplySchema>;

export const PlayModeSchema = z.enum(['play', 'test']);
export type PlayMode = z.infer<typeof PlayModeSchema>;
export const ServiceConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(0).max(65535),
  dataDir: z.string().min(1),
  webDir: z.string().min(1),
  botWorkerPath: z.string().min(1).optional(),
  playMode: PlayModeSchema.optional(),
});
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export const ServiceReadySchema = z.object({
  type: z.literal('ready'),
  port: z.number().int().positive(),
  health: HealthSchema,
  hostToken: z.string().min(32),
});

export const CredentialSchema = z.string().min(32).max(128);
export const BotDifficultySchema = z.enum(['default', 'doubao', 'juewu']);
export type BotDifficulty = z.infer<typeof BotDifficultySchema>;
export const CommandSchema = z
  .object({
    actionId: z.string().min(1).max(128),
    instanceId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    branch: z.number().int().nonnegative(),
    command: z.discriminatedUnion('type', [
      z
        .object({ type: z.literal('set-play-mode'), mode: PlayModeSchema })
        .strict(),
      z.object({ type: z.literal('join-open'), open: z.boolean() }).strict(),
      z.object({ type: z.literal('ready'), ready: z.boolean() }).strict(),
      z
        .object({
          type: z.literal('add-bot'),
          name: z.string().trim().min(1).max(24),
          difficulty: BotDifficultySchema.optional(),
        })
        .strict(),
      z
        .object({
          type: z.literal('set-bot-difficulty'),
          seatId: z.string(),
          difficulty: BotDifficultySchema,
        })
        .strict(),
      z.object({ type: z.literal('remove-seat'), seatId: z.string() }).strict(),
      z
        .object({
          type: z.literal('order'),
          seats: z.array(z.string()).max(16),
        })
        .strict(),
      z.object({ type: z.literal('start') }).strict(),
      z.object({ type: z.literal('lifecycle'), action: z.json() }).strict(),
      z.object({ type: z.literal('pause') }).strict(),
      z.object({ type: z.literal('resume') }).strict(),
      z.object({ type: z.literal('end') }).strict(),
      z.object({ type: z.literal('new-room') }).strict(),
      z.object({ type: z.literal('replay') }).strict(),
      z.object({ type: z.literal('rebind'), seatId: z.string() }).strict(),
      z
        .object({ type: z.literal('rollback'), checkpointId: z.string() })
        .strict(),
      z
        .object({
          type: z.literal('game'),
          decisionId: z.string(),
          action: z.json(),
        })
        .strict(),
    ]),
  })
  .strict();
export type Command = z.infer<typeof CommandSchema>;
export const JoinSchema = z
  .object({
    name: z.string().trim().min(1).max(24),
    requestKey: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();
export const RedeemSchema = z
  .object({
    code: CredentialSchema,
    requestKey: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();
export const SessionReplySchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      token: CredentialSchema,
      duplicateName: z.boolean().optional(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.string() }).strict(),
]);
export const NetworkSchema = z.object({
  addresses: z.array(z.string()),
  adapters: z.array(
    z.object({
      address: z.string(),
      name: z.string(),
      kind: z.enum(['lan', 'virtual', 'link-local']),
    }),
  ),
  port: z.number().int().positive(),
});
export const SessionSchema = z
  .object({ token: CredentialSchema.optional() })
  .strict();
export const PublicActionSchema = z
  .object({
    actor: z.string().nullable(),
    verb: z.enum([
      'initial-flip',
      'draw',
      'replace',
      'discard',
      'mew-target',
      'rocket-refill',
      'zapdos-pass',
      'swap',
      'peek',
      'close-peek',
      'decline',
      'deal',
      'round-result',
    ]),
    cardCategory: z.string().nullable(),
    ability: z.string().nullable(),
    source: z.enum(['deck', 'discard']).optional(),
    targets: z
      .array(
        z
          .object({
            seat: z.string(),
            slots: z.array(z.number().int().min(0).max(5)).max(6),
          })
          .strict(),
      )
      .max(6),
  })
  .strict();
export type PublicAction = z.infer<typeof PublicActionSchema>;
export const RoomFeedbackSchema = z
  .object({
    instanceId: z.string().uuid(),
    branch: z.number().int().nonnegative(),
    revision: z.number().int().positive(),
    events: z
      .array(
        z
          .object({
            kind: z.enum([
              'draw',
              'replace',
              'effect-complete',
              'round-result',
            ]),
            text: z.string().max(100),
            action: PublicActionSchema.optional(),
          })
          .strict(),
      )
      .max(8),
  })
  .strict();
export type RoomFeedback = z.infer<typeof RoomFeedbackSchema>;

export interface RoomView {
  instanceId: string;
  revision: number;
  branch: number;
  status: 'lobby' | 'playing' | 'ended';
  paused: boolean;
  restored: boolean;
  joinOpen: boolean;
  playMode: PlayMode;
  game: { id: string; name: string; min: number; max: number };
  seats: {
    id: string;
    name: string;
    controller: 'human' | 'bot';
    ready: boolean;
    online: boolean;
    botDifficulty: BotDifficulty | null;
  }[];
  self: { role: 'public' | 'host' | 'player'; seatId: string | null };
  gameView: unknown;
  decisionId: string | null;
  actions: unknown[];
  lifecycleActions: unknown[];
  history: {
    id: string;
    label: string;
    revealedInformation: boolean;
    step: number;
    seatId: string | null;
    roundNumber: number | null;
  }[];
  botError: string | null;
  endReason: string | null;
}
export type CommandReply =
  | { ok: true; revision: number; branch: number; bindingCode?: string }
  | { ok: false; reason: string };

export const RoomViewSchema = z
  .object({
    instanceId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    branch: z.number().int().nonnegative(),
    status: z.enum(['lobby', 'playing', 'ended']),
    paused: z.boolean(),
    restored: z.boolean(),
    joinOpen: z.boolean(),
    playMode: PlayModeSchema,
    game: z
      .object({
        id: z.string(),
        name: z.string(),
        min: z.number().int().positive(),
        max: z.number().int().positive(),
      })
      .strict(),
    seats: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          controller: z.enum(['human', 'bot']),
          ready: z.boolean(),
          online: z.boolean(),
          botDifficulty: BotDifficultySchema.nullable(),
        })
        .strict(),
    ),
    self: z
      .object({
        role: z.enum(['public', 'host', 'player']),
        seatId: z.string().nullable(),
      })
      .strict(),
    gameView: z.json(),
    decisionId: z.string().nullable(),
    actions: z.array(z.json()),
    lifecycleActions: z.array(z.json()),
    history: z.array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          revealedInformation: z.boolean(),
          step: z.number().int().positive(),
          seatId: z.string().nullable(),
          roundNumber: z.number().int().positive().nullable(),
        })
        .strict(),
    ),
    botError: z.string().nullable(),
    endReason: z.string().nullable(),
  })
  .strict();
export const CommandReplySchema = z.discriminatedUnion('ok', [
  z
    .object({
      ok: z.literal(true),
      revision: z.number().int().nonnegative(),
      branch: z.number().int().nonnegative(),
      bindingCode: CredentialSchema.optional(),
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.string() }).strict(),
]);
