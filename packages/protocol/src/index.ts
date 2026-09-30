import { z } from 'zod';

// Only public engineering diagnostics. No game state, identities, or data paths.
export const HealthSchema = z.object({
  status: z.literal('ready'),
  phase: z.literal('engineering-foundation'),
  protocolVersion: z.literal(1),
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
});
export type ServiceConfig = z.infer<typeof ServiceConfigSchema>;
export const ServiceReadySchema = z.object({
  type: z.literal('ready'),
  port: z.number().int().positive(),
  health: HealthSchema,
});
