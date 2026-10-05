import type { ComponentType } from 'react';
import type { RoomView, RoomFeedback, Command } from '@tablemax/protocol';

export const WEB_HOST_VERSION = 1;
export type GameCommand = Extract<
  Command['command'],
  { type: 'game' | 'lifecycle' | 'resume' | 'replay' }
>;
/** Only authorized presentation data; transport and credentials stay in the host. */
export interface GameHost {
  role: 'host' | 'public' | 'player';
  view: RoomView | null;
  self: RoomView['seats'][number] | undefined;
  connected: boolean;
  locked: boolean;
  canControl: boolean;
  message: string;
  admissionPending: boolean;
  awaitingConfirmation: boolean;
  feedback: RoomFeedback | null;
  errorId: string;
  motion: string[];
  command(value: GameCommand): void;
}
export interface GameClient {
  Screen: ComponentType<{ session: GameHost }>;
  savedChanges(before: unknown, after: unknown): string[];
  motionDuration: number | ((view: unknown) => number);
}
