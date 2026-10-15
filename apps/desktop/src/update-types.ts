export type ApplicationUpdatePhase =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'ahead'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'applying'
  | 'unsupported'
  | 'error';

export interface ApplicationUpdateSnapshot {
  supported: boolean;
  phase: ApplicationUpdatePhase;
  panelRequestId?: number;
  currentVersion: string;
  targetVersion?: string;
  notes?: string;
  downloadedBytes?: number;
  totalBytes?: number;
  error?: string;
  manualUrl: string;
}

export interface TablemaxUpdate {
  read(): Promise<ApplicationUpdateSnapshot>;
  check(): Promise<ApplicationUpdateSnapshot>;
  download(): Promise<ApplicationUpdateSnapshot>;
  cancel(): Promise<ApplicationUpdateSnapshot>;
  apply(): Promise<ApplicationUpdateSnapshot>;
  subscribe(
    listener: (snapshot: ApplicationUpdateSnapshot) => void,
  ): () => void;
}

declare global {
  interface Window {
    tablemaxUpdate?: TablemaxUpdate;
  }
}
