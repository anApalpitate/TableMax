export type InteractionAudioChannel = 'shot' | 'speech';
export interface InteractionDiagnostic {
  phase:
    | 'receive'
    | 'fetch'
    | 'decode'
    | 'prepare'
    | 'resume'
    | 'claim'
    | 'start'
    | 'drop'
    | 'stop';
  eventId?: string | undefined;
  channel?: InteractionAudioChannel | undefined;
  receivedAt?: number | undefined;
  durationMs?: number | undefined;
  cache?: 'hit' | 'miss' | undefined;
  outcome?:
    | 'ready'
    | 'unavailable'
    | 'deadline'
    | 'cancelled'
    | 'error'
    | 'ended'
    | undefined;
}
export interface InteractionDiagnosticEntry extends InteractionDiagnostic {
  at: number;
}
const entries: Readonly<InteractionDiagnosticEntry>[] = [];
const phases = new Set([
  'receive',
  'fetch',
  'decode',
  'prepare',
  'resume',
  'claim',
  'start',
  'drop',
  'stop',
]);
const outcomes = new Set([
  'ready',
  'unavailable',
  'deadline',
  'cancelled',
  'error',
  'ended',
]);
function finite(value: number | undefined) {
  return value !== undefined && Number.isFinite(value)
    ? Math.max(0, value)
    : undefined;
}
/** Explicit whitelist: never keep URLs, payloads, names, points or credentials. */
export function recordInteractionDiagnostic(input: InteractionDiagnostic) {
  if (!phases.has(input.phase)) return;
  const entry = Object.freeze({
    phase: input.phase,
    eventId:
      input.eventId &&
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        input.eventId,
      )
        ? input.eventId
        : undefined,
    channel:
      input.channel === 'shot' || input.channel === 'speech'
        ? input.channel
        : undefined,
    receivedAt: finite(input.receivedAt),
    durationMs: finite(input.durationMs),
    cache:
      input.cache === 'hit' || input.cache === 'miss' ? input.cache : undefined,
    outcome:
      input.outcome && outcomes.has(input.outcome) ? input.outcome : undefined,
    at: performance.now(),
  });
  entries.push(entry);
  if (entries.length > 192) entries.shift();
}
export function readInteractionDiagnostics() {
  return Object.freeze([...entries]);
}
declare global {
  interface Window {
    readonly __tablemaxReadInteractionDiagnostics?: typeof readInteractionDiagnostics;
  }
}
if (
  typeof window !== 'undefined' &&
  !window.__tablemaxReadInteractionDiagnostics
)
  Object.defineProperty(window, '__tablemaxReadInteractionDiagnostics', {
    value: readInteractionDiagnostics,
    writable: false,
    configurable: false,
  });
