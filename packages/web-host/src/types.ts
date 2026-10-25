import type { ComponentType, AnchorHTMLAttributes, ReactNode } from 'react';
import type { RoomView, RoomFeedback, Command } from '@tablemax/protocol';
import type { JsonValue } from '@tablemax/game-sdk';

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
  messageKind?:
    'none' | 'saved' | 'progress' | 'connection' | 'success' | 'error';
  admissionPending: boolean;
  awaitingConfirmation: boolean;
  feedback: RoomFeedback | null;
  errorId: string;
  motion: string[];
  resourceUrl?(id: string): string;
  command(value: GameCommand): void;
}
export interface GameHostSlots {
  management(props: { lifecycleLabel?: string }): ReactNode;
  feedback(props?: { mode?: 'all' | 'saved' | 'messages' }): ReactNode;
  playMode(): ReactNode;
  countdown(props: { children?: ReactNode }): ReactNode;
}
/** Presentation capabilities only; installed by the private platform adapter. */
export interface HostPresentationServices {
  ScreenLink: ComponentType<
    AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }
  >;
  FullscreenControl: ComponentType;
  DisplaySettings: ComponentType<{ role?: GameHost['role'] }>;
  useAudioOutput(): boolean;
  claimAudioEvent(key: string): boolean | Promise<boolean>;
  avatarFor(id: string): string;
  avatarChoices: readonly { id: string; name: string; src: string }[];
}
export interface GameSetupSettingsProps {
  value: JsonValue;
  disabled: boolean;
  onChange(value: JsonValue): void;
}
export interface GameClient {
  /** Optional presentation capability; webHost 1 and legacy clients stay valid. */
  layout?: { contract: 'fixed-v1' };
  SetupSettings?: ComponentType<GameSetupSettingsProps>;
  Screen: ComponentType<{ session: GameHost }>;
  savedChanges(before: unknown, after: unknown): string[];
  motionDuration: number | ((view: unknown) => number);
}
