import type { JsonValue, BotDifficulty } from '@tablemax/game-sdk';
import type { CommandReply } from '@tablemax/protocol';

export interface Seat {
  id: string;
  name: string;
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
  };
  instanceId: string;
  revision: number;
  branch: number;
  status: 'lobby' | 'playing' | 'ended';
  paused: boolean;
  joinOpen: boolean;
  seats: Seat[];
  hostSeat?: string | null;
  snapshot: Snapshot | null;
  history: Checkpoint[];
  receipts: Record<string, { fingerprint: string; reply: CommandReply }>;
  sessionReceipts?: Record<string, SessionReceipt>;
  bindings?: Record<string, { seatId: string; expires: number }>;
  botError: string | null;
  endReason: string | null;
}
export interface SaveRepository {
  load(): unknown | null;
  save(value: Save): void;
}
