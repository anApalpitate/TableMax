import { z } from 'zod';
export * from './interactions';
import {
  AvatarIdSchema,
  PresetAvatarIdSchema,
  AvatarImageSchema,
  type AvatarId,
} from './avatars';
import {
  CountdownSecondsSchema,
  DecisionClockSchema,
  type DecisionClock,
} from './countdown';
export {
  AVATAR_PRESETS,
  AvatarIdSchema,
  PresetAvatarIdSchema,
  CustomAvatarIdSchema,
  AvatarImageSchema,
  type AvatarId,
} from './avatars';
export {
  COUNTDOWN_STEPS,
  DEFAULT_COUNTDOWN_SECONDS,
  CountdownSecondsSchema,
  DecisionClockSchema,
  type DecisionClock,
} from './countdown';

// Only public engineering diagnostics. No game state, identities, or data paths.
export const HealthSchema = z.object({
  status: z.literal('ready'),
  phase: z.literal('platform-foundation'),
  protocolVersion: z.literal(8),
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
        .object({
          type: z.literal('set-countdown'),
          seconds: CountdownSecondsSchema,
        })
        .strict(),
      z
        .object({ type: z.literal('set-play-mode'), mode: PlayModeSchema })
        .strict(),
      z.object({ type: z.literal('join-open'), open: z.boolean() }).strict(),
      z.object({ type: z.literal('ready'), ready: z.boolean() }).strict(),
      z
        .object({ type: z.literal('set-avatar'), avatarId: AvatarIdSchema })
        .strict(),
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
          type: z.literal('approve-transfer'),
          requestId: z.string().uuid(),
        })
        .strict(),
      z
        .object({
          type: z.literal('reject-transfer'),
          requestId: z.string().uuid(),
        })
        .strict(),
      z
        .object({
          type: z.literal('set-bot-name'),
          seatId: z.string(),
          name: z.string().trim().min(1).max(24),
        })
        .strict(),
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
      z
        .object({ type: z.literal('set-owner'), seatId: z.string().nullable() })
        .strict(),
      z
        .object({
          type: z.literal('select-game'),
          gameId: z.string().min(1),
          endCurrent: z.literal(true).optional(),
        })
        .strict(),
      z
        .object({
          type: z.literal('select-variant'),
          variantId: z.string().min(1).max(48),
        })
        .strict(),
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
    avatarId: PresetAvatarIdSchema.optional(),
    avatarImage: AvatarImageSchema.optional(),
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
export const AvatarUploadSchema = z
  .object({
    token: CredentialSchema,
    envelope: CommandSchema.omit({ command: true }),
    avatarImage: AvatarImageSchema,
  })
  .strict();
export const NetworkSchema = z.object({
  externalJoinUrl: z.string().nullable().default(null),
  networkMessage: z.string().optional(),
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
export const TransferRequestSchema = z
  .object({
    seatId: z.string().uuid(),
    requestKey: z.string().regex(/^[0-9a-f]{64}$/),
  })
  .strict();
export const TransferProofSchema = TransferRequestSchema.omit({ seatId: true });
const transferMetadata = {
  requestId: z.string().uuid(),
  seatId: z.string(),
  verificationCode: z.string().regex(/^[0-9]{6}$/),
  expiresAt: z.number().int().positive(),
};
export const TransferStateSchema = z.discriminatedUnion('status', [
  z
    .object({
      ...transferMetadata,
      status: z.literal('approved'),
      token: CredentialSchema,
    })
    .strict(),
  z
    .object({
      ...transferMetadata,
      status: z.enum([
        'pending',
        'rejected',
        'cancelled',
        'expired',
        'revoked',
      ]),
    })
    .strict(),
]);
export type TransferState = z.infer<typeof TransferStateSchema>;
export const TransferReplySchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), transfer: TransferStateSchema }).strict(),
  z.object({ ok: z.literal(false), reason: z.string() }).strict(),
]);
export const NetworkUpdateSchema = z
  .object({
    token: CredentialSchema,
    externalJoinUrl: z.string().max(2048).nullable(),
  })
  .strict();
export const SessionSchema = z
  .object({ token: CredentialSchema.optional() })
  .strict();
export const PublicActionSchema = z
  .object({
    actor: z.string().nullable(),
    verb: z.string().min(1).max(64),
    cardCategory: z.string().nullable(),
    ability: z.string().nullable(),
    source: z.enum(['deck', 'discard']).optional(),
    targets: z
      .array(
        z
          .object({
            seat: z.string(),
            slots: z.array(z.number().int().min(0).max(1023)).max(128),
          })
          .strict(),
      )
      .max(32),
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
            kind: z.string().min(1).max(64),
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
  countdownSeconds: number;
  decisionClock: DecisionClock | null;
  game: {
    id: string;
    name: string;
    min: number;
    max: number;
    decisionTimer?: boolean | undefined;
    variantId?: string | undefined;
  } | null;
  catalog: {
    id: string;
    name: string;
    min: number;
    max: number;
    decisionTimer?: boolean | undefined;
    defaultVariantId?: string | undefined;
    variants?: { id: string; name: string; description: string }[] | undefined;
  }[];
  ownerSeatId: string | null;
  capabilities: {
    manage: boolean;
    control: boolean;
    manageSeats?: boolean | undefined;
  };
  seats: {
    id: string;
    name: string;
    avatarId: AvatarId;
    controller: 'human' | 'bot';
    ready: boolean;
    online: boolean;
    botDifficulty: BotDifficulty | null;
  }[];
  self: { role: 'public' | 'host' | 'player'; seatId: string | null };
  gameView: unknown;
  decisionId: string | null;
  selectionToken: string | null;
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
  transferRequests?:
    | {
        requestId: string;
        seatId: string;
        verificationCode: string;
        expiresAt: number;
      }[]
    | undefined;
}
export type CommandReply =
  | { ok: true; revision: number; branch: number }
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
    countdownSeconds: CountdownSecondsSchema,
    decisionClock: DecisionClockSchema.nullable(),
    game: z
      .object({
        id: z.string(),
        name: z.string(),
        min: z.number().int().positive(),
        max: z.number().int().positive(),
        decisionTimer: z.boolean().optional(),
        variantId: z.string().optional(),
      })
      .strict()
      .nullable(),
    catalog: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          min: z.number().int().positive(),
          max: z.number().int().positive(),
          decisionTimer: z.boolean().optional(),
          defaultVariantId: z.string().optional(),
          variants: z
            .array(
              z
                .object({
                  id: z.string(),
                  name: z.string(),
                  description: z.string(),
                })
                .strict(),
            )
            .optional(),
        })
        .strict(),
    ),
    ownerSeatId: z.string().nullable(),
    transferRequests: z
      .array(z.object(transferMetadata).strict())
      .max(32)
      .optional(),
    capabilities: z
      .object({
        manage: z.boolean(),
        control: z.boolean(),
        manageSeats: z.boolean().optional(),
      })
      .strict(),
    seats: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          avatarId: AvatarIdSchema,
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
    selectionToken: z.string().nullable(),
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
    })
    .strict(),
  z.object({ ok: z.literal(false), reason: z.string() }).strict(),
]);

// Transport metadata is deliberately outside the room's saved domain view.
const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const RoomStampSchema = z
  .object({
    serverSessionId: z.string().uuid(),
    instanceId: z.string().uuid(),
    branch: sequence,
    viewSeq: sequence,
  })
  .strict();
export type RoomStamp = z.infer<typeof RoomStampSchema>;
export const SyncHintSchema = z.enum(['active', 'idle']);
export type SyncHint = z.infer<typeof SyncHintSchema>;
const projectionFields = {
  stamp: RoomStampSchema,
  syncHint: SyncHintSchema,
  interactionWatermark: sequence,
  view: RoomViewSchema,
};
function matchingProjection(
  projection: {
    stamp: RoomStamp;
    view: { instanceId: string; branch: number };
  },
  context: z.RefinementCtx,
) {
  if (
    projection.stamp.instanceId !== projection.view.instanceId ||
    projection.stamp.branch !== projection.view.branch
  )
    context.addIssue({
      code: 'custom',
      message: 'Projection stamp does not match its room context',
      path: ['stamp'],
    });
}
export const RoomProjectionSchema = z
  .object(projectionFields)
  .strict()
  .superRefine(matchingProjection);
export type RoomProjection = {
  stamp: RoomStamp;
  syncHint: SyncHint;
  interactionWatermark: number;
  view: RoomView;
};
export type RoomSyncMetadata = Omit<RoomProjection, 'view'>;
const syncFailure = z
  .object({ ok: z.literal(false), reason: z.string() })
  .strict();
export const RoomSyncReplySchema = z.union([
  z
    .object({ ok: z.literal(true), ...projectionFields })
    .strict()
    .superRefine(matchingProjection),
  syncFailure,
]);
export type RoomSyncReply =
  ({ ok: true } & RoomProjection) | { ok: false; reason: string };
export const RoomProbeRequestSchema = z
  .object({ stamp: RoomStampSchema })
  .strict();
export type RoomProbeRequest = z.infer<typeof RoomProbeRequestSchema>;
export const RoomProbeReplySchema = z.union([
  z
    .object({
      ok: z.literal(true),
      unchanged: z.literal(true),
      stamp: RoomStampSchema,
      syncHint: SyncHintSchema,
      interactionWatermark: sequence,
    })
    .strict(),
  z
    .object({
      ok: z.literal(true),
      unchanged: z.literal(false),
      ...projectionFields,
    })
    .strict()
    .superRefine(matchingProjection),
  syncFailure,
]);
export type RoomProbeReply =
  | ({ ok: true; unchanged: true } & RoomSyncMetadata)
  | ({ ok: true; unchanged: false } & RoomProjection)
  | { ok: false; reason: string };
export const CommandStatusSchema = z.discriminatedUnion('status', [
  z
    .object({ status: z.literal('completed'), reply: CommandReplySchema })
    .strict(),
  z.object({ status: z.literal('processing') }).strict(),
  z.object({ status: z.literal('unknown') }).strict(),
  z.object({ status: z.literal('unqueryable'), reason: z.string() }).strict(),
]);
export type CommandStatus = z.infer<typeof CommandStatusSchema>;
export const RoomCommandStatusReplySchema = z.union([
  z
    .object({
      ok: z.literal(true),
      ...projectionFields,
      outcome: CommandStatusSchema,
    })
    .strict()
    .superRefine(matchingProjection),
  syncFailure,
]);
export type RoomCommandStatusReply =
  | ({ ok: true; outcome: CommandStatus } & RoomProjection)
  | { ok: false; reason: string };
