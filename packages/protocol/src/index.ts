import { z } from 'zod';

// Only public engineering diagnostics. No game state, identities, or data paths.
export const HealthSchema = z.object({
  status: z.literal('ready'),
  phase: z.literal('platform-foundation'),
  protocolVersion: z.literal(2),
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

export const ServiceConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(0).max(65535),
  dataDir: z.string().min(1),
  webDir: z.string().min(1),
  botWorkerPath: z.string().min(1).optional(),
});
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export const ServiceReadySchema = z.object({
  type: z.literal('ready'),
  port: z.number().int().positive(),
  health: HealthSchema,
  hostToken: z.string().min(32),
});

export const CredentialSchema = z.string().min(32).max(128);
export const CommandSchema = z
  .object({
    actionId: z.string().min(1).max(128),
    instanceId: z.string().uuid(),
    revision: z.number().int().nonnegative(),
    branch: z.number().int().nonnegative(),
    command: z.discriminatedUnion('type', [
      z.object({ type: z.literal('join-open'), open: z.boolean() }).strict(),
      z.object({ type: z.literal('ready'), ready: z.boolean() }).strict(),
      z
        .object({
          type: z.literal('add-bot'),
          name: z.string().trim().min(1).max(24),
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
    hostToken: CredentialSchema.optional(),
  })
  .strict();
export const SessionSchema = z
  .object({ token: CredentialSchema.optional() })
  .strict();
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
  game: { id: string; name: string; min: number; max: number };
  seats: {
    id: string;
    name: string;
    controller: 'human' | 'bot';
    ready: boolean;
    online: boolean;
  }[];
  self: { role: 'public' | 'host' | 'player'; seatId: string | null };
  gameView: unknown;
  decisionId: string | null;
  actions: unknown[];
  lifecycleActions: unknown[];
  history: { id: string; label: string; revealedInformation: boolean }[];
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
