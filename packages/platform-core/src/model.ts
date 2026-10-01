import type { JsonValue } from '@tablemax/game-sdk';
import type { CommandReply } from '@tablemax/protocol';

export interface Seat {
  id: string;
  name: string;
  controller: 'human' | 'bot';
  ready: boolean;
  tokenHash: string | null;
}
export interface BotData {
  id: string;
  version: string;
  memory: JsonValue;
  random: number;
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
  snapshot: Snapshot | null;
  history: Checkpoint[];
  receipts: Record<string, { fingerprint: string; reply: CommandReply }>;
  botError: string | null;
  endReason: string | null;
}
export interface SaveRepository {
  load(): unknown | null;
  save(value: Save): void;
}
