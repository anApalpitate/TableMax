export interface ModuleManifest {
  schemaVersion: 1;
  id: string;
  order: number;
  internal: boolean;
  catalog: {
    id: string;
    name: string;
    min: number;
    max: number;
    decisionTimer?: boolean;
  };
  compatibility: {
    sdk: number;
    protocol: number;
    webHost: number;
    rulesVersion: string;
    stateVersion: number;
    gameVersion: string;
    strategyVersion: string;
  };
  entries: { rules: string; bot: string; web: string };
  cover: string | null;
  guidance?: boolean;
  versions?: { name: string; selected: boolean; description: string }[];
  defaultVariantId?: string;
  variants?: {
    id: string;
    name: string;
    description: string;
    compatibility: ModuleManifest['compatibility'];
    introduction?: ModuleManifest['introduction'];
  }[];
  introduction?: {
    tagline: string;
    lead: string;
    steps: {
      icon: 'cards' | 'swap' | 'pair' | 'auction' | 'painting' | 'coins';
      title: string;
      text: string;
    }[];
    goal: string;
  };
  botIntroduction?: Record<
    'default' | 'doubao' | 'juewu',
    { lead: string; details: string[] }
  >;
  budgets: {
    payloadBytes: number;
    serviceHeapBytes: number;
    desktopHeapBytes: number;
    phoneHeapBytes: number;
    privateIncrementBytes: number;
    workerOldGenerationMiB: number;
    basis: string;
  };
  styles?: string[];
}
