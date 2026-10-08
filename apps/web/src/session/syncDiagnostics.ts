type Phase =
  'request' | 'reply' | 'wire' | 'receive' | 'validate' | 'apply' | 'frame';
type Diagnostic = {
  phase: Phase;
  at: number;
  kind?: string;
  durationMs?: number;
  bytes?: number;
  viewSeq?: number | undefined;
};
const entries: Diagnostic[] = [];
export function recordRoomSyncDiagnostic(input: Omit<Diagnostic, 'at'>) {
  const entry: Diagnostic = { phase: input.phase, at: performance.now() };
  if (input.kind) entry.kind = input.kind;
  for (const key of ['durationMs', 'bytes', 'viewSeq'] as const) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0)
      entry[key] = value;
  }
  entries.push(Object.freeze(entry));
  if (entries.length > 192) entries.shift();
}
export function readRoomSyncDiagnostics() {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}
declare global {
  interface Window {
    __tablemaxReadRoomSyncDiagnostics?: typeof readRoomSyncDiagnostics;
  }
}
if (typeof window !== 'undefined' && !window.__tablemaxReadRoomSyncDiagnostics)
  Object.defineProperty(window, '__tablemaxReadRoomSyncDiagnostics', {
    value: readRoomSyncDiagnostics,
    writable: false,
  });
