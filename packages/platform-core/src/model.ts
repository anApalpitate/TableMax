import type { JsonValue, BotDifficulty } from '@tablemax/game-sdk';
import type { AvatarId, CommandReply, PlayMode } from '@tablemax/protocol';

export interface Seat {
  id: string;
  name: string;
  // Legacy format-1 saves omit this; validation fills and persists it once.
  avatarId?: AvatarId;
  controller: 'human' | 'bot';
  ready: boolean;
  tokenHash: string | null;
  botDifficulty?: BotDifficulty;
}
export interface BotData {
  id: string;
  version: string;
  memory: JsonValue;
  random: number;
  difficulty?: BotDifficulty;
}
export interface Snapshot {
  state: JsonValue;
  random: number;
  bots: Record<string, BotData>;
}
export interface Checkpoint {
  id: string;
  label: string;
  revealedInformation: boolean;
  before: Snapshot;
  seatId?: string | null;
  roundNumber?: number;
}
export interface SessionReceipt {
  fingerprint: string;
  seatId: string;
  sealedCredential: string;
  duplicateName: boolean;
  expires: number;
}
export interface Save {
  formatVersion: 1;
  manifest: {
    id: string;
    gameVersion: string;
    rulesVersion: string;
    stateVersion: number;
  } | null;
  instanceId: string;
  revision: number;
  branch: number;
  status: 'lobby' | 'playing' | 'ended';
  paused: boolean;
  joinOpen: boolean;
  playMode?: PlayMode;
  // Platform metadata, deliberately outside game checkpoints.
  countdownSeconds?: number;
  decisionClocks?: DecisionClockState[];
  seats: Seat[];
  hostSeat?: string | null;
  ownerSeatId?: string | null;
  gameWindow?: { group: string; floor: number } | null;
  readyWindow?: { floor: number; seats: Record<string, number> };
  snapshot: Snapshot | null;
  history: Checkpoint[];
  receipts: Record<string, { fingerprint: string; reply: CommandReply }>;
  sessionReceipts?: Record<string, SessionReceipt>;
  bindings?: Record<string, { seatId: string; expires: number }>;
  botError: string | null;
  endReason: string | null;
}
export interface DecisionClockState {
  key: string;
  id: string;
  remainingMs: number;
  startedAt: number | null;
}
export interface SaveRepository {
  load(): unknown | null;
  save(value: Save, extras?: SaveExtras): void;
  getAvatar?(id: string): Uint8Array | null;
}
export interface SaveExtras {
  journal?: Save[];
  avatars?: { id: string; png: Uint8Array }[];
}
