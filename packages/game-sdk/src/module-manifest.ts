export interface ModuleManifest {
  schemaVersion: 1;
  id: string;
  order: number;
  internal: boolean;
  development?: boolean;
  library?: {
    displayName?: string;
    tags: string[];
    searchTerms?: string[];
  };
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
  /** Package-relative detail document. Older modules may embed the same fields. */
  details?: string;
  guidance?: boolean;
  /** Legacy reader compatibility only; variants are the source of new summaries. */
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

/** Browsing a game never requires its rules, client or installed detail document. */
export interface GameCatalogEntry {
  id: string;
  order: number;
  internal: boolean;
  development?: boolean;
  library?: ModuleManifest['library'];
  catalog: Pick<ModuleManifest['catalog'], 'id' | 'name' | 'min' | 'max'>;
  cover: string | null;
  defaultVariantId?: string;
  variants?: { id: string; name: string; description: string }[];
}

/** Text and guidance capabilities delivered only with an installed game. */
export interface GameDetails {
  schemaVersion: 1;
  id: string;
  introduction?: ModuleManifest['introduction'];
  botIntroduction?: ModuleManifest['botIntroduction'];
  guidance?: boolean;
  variants?: { id: string; introduction: ModuleManifest['introduction'] }[];
}

/** Service/Worker descriptors retain compatibility and budgets, not detail copy. */
export type RuntimeModuleManifest = Omit<
  ModuleManifest,
  'introduction' | 'botIntroduction' | 'guidance' | 'versions' | 'variants'
> & {
  variants?: Omit<
    NonNullable<ModuleManifest['variants']>[number],
    'introduction'
  >[];
};

/** The installed browser loader only needs its public entry and host contract. */
export interface GameWebManifest {
  id: string;
  compatibility: Pick<ModuleManifest['compatibility'], 'webHost'>;
  entries: Pick<ModuleManifest['entries'], 'web'>;
  styles: string[];
}
