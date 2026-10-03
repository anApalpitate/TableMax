export const audioChannels = {
  connect: 'tablemax:audio:connect',
  disconnect: 'tablemax:audio:disconnect',
  changed: 'tablemax:audio:changed',
  claim: 'tablemax:audio:claim',
} as const;
export interface TablemaxAudio {
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  claimEvent(key: string): Promise<boolean>;
  subscribe(listener: (canPlay: boolean) => void): () => void;
}
declare global {
  interface Window {
    tablemaxAudio?: TablemaxAudio;
  }
}
