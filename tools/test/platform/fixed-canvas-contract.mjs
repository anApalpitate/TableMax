import assert from 'node:assert/strict';

// This is the selectable contract for the existing UI verifier, not a CLI.
export const fixedCanvasVersion = 'fixed-v1';
export const fixedCanvasAdapterClock = Date.UTC(2026, 9, 25, 0, 0, 0);
export const fixedCanvasAdapterInputs = {
  complete: true,
  files: [
    'tools/test/platform/verify-fixed-canvas-contract.mjs',
    'tools/test/platform/fixed-canvas-contract.mjs',
    'packages/web-host/src/index.tsx',
    'apps/web/src/styles.css',
    'apps/web/src/scrollbars.css',
  ],
  directories: ['packages/web-host/src/layout'],
};
export const fixedCanvasPlatformInputFiles = [
  'apps/web/src/components/BoxOverlayPanel.tsx',
  'apps/web/src/components/ConfirmationDialog.tsx',
  'apps/web/src/components/RulesGuide.tsx',
  'apps/web/src/components/DisplaySettings.tsx',
];
export const fixedCanvasLayouts = [
  { layout: 'host', role: 'host', width: 1280, height: 720 },
  { layout: 'player-portrait', role: 'player', width: 360, height: 800 },
  { layout: 'player-landscape', role: 'player', width: 640, height: 360 },
];
export const fixedCanvasVariants = {
  'modern-art': {
    path: 'games/modern-art',
    rules: 'rules/index.ts',
    bot: 'bot/index.ts',
  },
  'pokemon-encounters': {
    gameId: 'pokemon-encounters',
    verifier: 'tools/test/games/pokemon-encounters/fixed-canvas-pokemon.mjs',
    path: 'games/pokemon-encounters',
    rules: 'rules/index.ts',
    bot: 'bot/index.ts',
    eventVerifier:
      'tools/test/games/pokemon-encounters/fixed-canvas-pokemon-events.mjs',
    fixtureRenderer:
      'tools/test/games/pokemon-encounters/fixed-canvas-pokemon-fixture.mjs',
    guidanceVerifier:
      'tools/test/games/pokemon-encounters/fixed-canvas-pokemon-guidance.mjs',
    stateMaker: {
      file: 'tools/test/fixtures/pokemon-original-state.ts',
      export: 'preparePokemonOriginalFixedState',
    },
  },
  expansion: {
    gameId: 'pokemon-encounters',
    verifier: 'tools/test/games/pokemon-encounters/fixed-canvas-pokemon.mjs',
    path: 'games/pokemon-encounters/expansion',
    rules: 'index.ts',
    rulesExport: 'pokemonExpansion',
    eventVerifier:
      'tools/test/games/pokemon-encounters/fixed-canvas-pokemon-events.mjs',
    fixtureRenderer:
      'tools/test/games/pokemon-encounters/fixed-canvas-pokemon-fixture.mjs',
    bot: 'bot/index.ts',
    stateMaker: {
      file: 'tools/test/fixtures/pokemon-expansion-state.ts',
      export: 'preparePokemonExpansionFixedState',
    },
  },
};
const adapterKinds = [
  'minimum',
  'width-minus-one',
  'height-minus-one',
  'wide-gutter',
  'tall-gutter',
  'max-scale',
  'manual-selection',
  'continuous-resize',
  'coordinates',
];
const pokemonFixedScenes = {
  'pokemon-encounters': [
    'draw',
    'held',
    'placement-selected',
    'replace-committed',
    'ability-choice',
    'ability-resolved',
    'private-peek',
    'mew-target-selected',
    'swap-selected',
    'swap-committed',
    'dense',
  ],
  expansion: [
    'draw',
    'held',
    'placement-selected',
    'replace-committed',
    'research-vote',
    'ability-choice',
    'ability-resolved',
    'private-peek',
    'target-private-peek',
    'swap-selected',
    'swap-committed',
    'reposition-selected',
    'reposition-committed',
    'dense',
  ],
};
const pokemonCanvasCases = ['content', 'integration'].flatMap((layer) =>
  Object.entries(pokemonFixedScenes).flatMap(([variant, scenes]) => {
    const make = (layout, seats, scene) => ({
      ...layout,
      id: `${layer}-${variant}-${layout.layout}-n${seats}-${scene}`,
      layer,
      variant,
      gameId: 'pokemon-encounters',
      seats,
      scene,
      fixtureKey: `${variant}-n${seats}-${scene}`,
      playerFrame: layer === 'integration' && layout.role === 'player',
    });
    return [
      ...scenes.flatMap((scene) =>
        fixedCanvasLayouts
          .filter(
            (layout) =>
              !scene.endsWith('-selected') || layout.role === 'player',
          )
          .map((layout) => make(layout, 6, scene)),
      ),
      ...[2, 3].map((seats) => make(fixedCanvasLayouts[0], seats, 'draw')),
    ];
  }),
);

const pokemonDynamicCases = [
  {
    ...fixedCanvasLayouts[0],
    id: 'integration-expansion-host-n6-saved-board',
    layer: 'integration',
    variant: 'expansion',
    gameId: 'pokemon-encounters',
    seats: 6,
    scene: 'saved-board',
    fixtureKey: 'expansion-n6-saved-sequence',
    fixtureState: 'saved-sequence',
    fixtureInitialProjection: 'savedTransactions[2].before.host',
    playerFrame: false,
    eventProof: true,
    eventRole: 'host-board',
  },
  ...['pokemon-encounters', 'expansion'].map((variant) => ({
    ...fixedCanvasLayouts[2],
    id: 'integration-' + variant + '-player-landscape-n6-saved-sequence',
    layer: 'integration',
    variant,
    gameId: 'pokemon-encounters',
    seats: 6,
    scene: 'saved-sequence',
    fixtureKey: variant + '-n6-saved-sequence',
    playerFrame: true,
    eventProof: true,
  })),
  ...['guidance-settings', 'guidance-last-dark'].map((scene) => ({
    ...fixedCanvasLayouts[2],
    id: 'integration-pokemon-encounters-player-landscape-n6-' + scene,
    layer: 'integration',
    variant: 'pokemon-encounters',
    gameId: 'pokemon-encounters',
    seats: 6,
    scene,
    fixtureKey: 'pokemon-encounters-n6-' + scene,
    playerFrame: true,
    guidanceProof: true,
  })),
];
export const fixedCanvasCases = [
  ...pokemonDynamicCases,
  ...pokemonCanvasCases,
  ...fixedCanvasLayouts.flatMap((layout) =>
    adapterKinds.map((boundary) => ({
      ...layout,
      id: `adapter-${layout.layout}-${boundary}`,
      layer: 'adapter',
      boundary,
    })),
  ),
  ...fixedCanvasLayouts
    .filter((layout) => layout.role === 'player')
    .flatMap((layout) =>
      ['safe-insets', 'focused-height-change', 'unfocused-dynamic-height'].map(
        (boundary) => ({
          ...layout,
          id: `adapter-${layout.layout}-${boundary}`,
          layer: 'adapter',
          boundary,
        }),
      ),
    ),
  {
    ...fixedCanvasLayouts[1],
    id: 'adapter-player-portrait-overlay-focus',
    layer: 'adapter',
    boundary: 'overlay-focus',
  },
  {
    ...fixedCanvasLayouts[0],
    id: 'adapter-host-platform-overlays',
    layer: 'adapter',
    boundary: 'platform-overlays',
    platform: true,
  },
  {
    ...fixedCanvasLayouts[1],
    id: 'adapter-player-portrait-platform-video',
    layer: 'adapter',
    boundary: 'platform-video',
    platform: true,
  },
  {
    ...fixedCanvasLayouts[1],
    id: 'adapter-player-portrait-browser-zoom',
    layer: 'adapter',
    boundary: 'browser-zoom',
    inputsClosed: false,
  },
  {
    ...fixedCanvasLayouts[1],
    id: 'adapter-player-portrait-visual-viewport',
    layer: 'adapter',
    boundary: 'visual-viewport',
    playerFrame: true,
    inputsClosed: false,
  },
  ...['content', 'integration'].flatMap((layer) =>
    Object.keys(fixedCanvasVariants)
      .filter((variant) => !fixedCanvasVariants[variant].gameId)
      .flatMap((variant) =>
        fixedCanvasLayouts.map((layout) => ({
          ...layout,
          id: `${layer}-${variant}-${layout.layout}`,
          layer,
          variant,
          playerFrame: layer === 'integration' && layout.role === 'player',
        })),
      ),
  ),
];

export function selectFixedCanvasCases(args) {
  const values = new Map();
  for (const arg of args) {
    const match = /^--(layout-contract|layer|only)=(.+)$/.exec(arg);
    assert(match, `Unsupported fixed-canvas argument: ${arg}`);
    assert(!values.has(match[1]), `Duplicate --${match[1]} option`);
    values.set(match[1], match[2]);
  }
  assert.equal(values.get('layout-contract'), fixedCanvasVersion);
  const layer = values.get('layer');
  assert(
    ['adapter', 'content', 'integration'].includes(layer),
    'Choose --layer=adapter|content|integration',
  );
  const cases = fixedCanvasCases.filter((item) => item.layer === layer);
  const ids = values.has('only') ? values.get('only').split(',') : [];
  assert.equal(new Set(ids).size, ids.length, 'Duplicate fixed-canvas case ID');
  assert(
    ids.every((id) => cases.some((item) => item.id === id)),
    `Unknown or wrong-layer fixed-canvas case ID: ${ids.join(',')}`,
  );
  const selected = ids.length
    ? cases.filter((item) => ids.includes(item.id))
    : cases;
  const variants = [...new Set(selected.flatMap((item) => item.variant ?? []))];
  const platform = selected.some((item) => item.platform);
  const playerFrame = selected.some((item) => item.playerFrame);
  const eventProof = selected.some((item) => item.eventProof);
  const guidanceProof = selected.some((item) => item.guidanceProof);
  const browserZoom = selected.some((item) => item.boundary === 'browser-zoom');
  const controlledVisual = selected.some(
    (item) => item.boundary === 'visual-viewport',
  );
  return {
    fixtureRequests: [
      ...new Map(
        selected
          .filter((item) => item.fixtureKey)
          .map((item) => [
            item.fixtureKey,
            {
              key: item.fixtureKey,
              variant: item.variant,
              seats: item.seats,
              state: item.fixtureState ?? item.scene,
            },
          ]),
      ).values(),
    ],
    version: fixedCanvasVersion,
    layer,
    expectedCaseIds: cases.map((item) => item.id),
    selectedCaseIds: selected.map((item) => item.id),
    cases: selected,
    variants,
    platform,
    playerFrame,
    browserZoom,
    eventProof,
    guidanceProof,
    controlledVisual,
    scopes: [
      ...(platform ? ['box'] : []),
      'shared',
      ...new Set(
        variants.map((id) => `game:${fixedCanvasVariants[id].gameId ?? id}`),
      ),
    ],
    ...(layer === 'adapter'
      ? {
          inputs: {
            ...fixedCanvasAdapterInputs,
            complete:
              selected.every((item) => item.inputsClosed !== false) &&
              fixedCanvasAdapterInputs.complete,
            files: [
              ...fixedCanvasAdapterInputs.files,
              ...(platform ? fixedCanvasPlatformInputFiles : []),
              ...(playerFrame
                ? ['apps/web/src/components/PlayerFrame.tsx']
                : []),
              ...(browserZoom
                ? ['tools/test/platform/fixed-canvas-browser-zoom.mjs']
                : []),
            ],
            directories: [...fixedCanvasAdapterInputs.directories],
          },
        }
      : {
          inputs: {
            complete: false,
            files: [
              ...fixedCanvasAdapterInputs.files,
              'apps/web/src/session/gameHostAdapter.tsx',
              'packages/platform-core/src/room.ts',
              'packages/platform-core/src/game-actions.ts',
              ...(variants.includes('modern-art')
                ? ['tools/test/fixtures/prepare-public-screen-retirement.ts']
                : []),
              ...(variants.some(
                (id) => fixedCanvasVariants[id].gameId === 'pokemon-encounters',
              )
                ? [
                    'tools/test/fixtures/prepare-pokemon-fixed.ts',
                    'tools/test/games/pokemon-encounters/fixed-canvas-pokemon.mjs',
                  ]
                : []),
              ...new Set(
                variants.flatMap((id) => [
                  ...(eventProof && fixedCanvasVariants[id].eventVerifier
                    ? [fixedCanvasVariants[id].eventVerifier]
                    : []),
                  ...((eventProof || guidanceProof) &&
                  fixedCanvasVariants[id].fixtureRenderer
                    ? [fixedCanvasVariants[id].fixtureRenderer]
                    : []),
                  ...(guidanceProof && fixedCanvasVariants[id].guidanceVerifier
                    ? [
                        fixedCanvasVariants[id].guidanceVerifier,
                        'games/pokemon-encounters/ui/decision-guidance.ts',
                      ]
                    : []),
                ]),
              ),
              ...variants.flatMap((id) => [
                `${fixedCanvasVariants[id].path}/web/index.tsx`,
                `${fixedCanvasVariants[id].path}/${fixedCanvasVariants[id].rules}`,
                `${fixedCanvasVariants[id].path}/${fixedCanvasVariants[id].bot}`,
                ...(fixedCanvasVariants[id].stateMaker
                  ? [fixedCanvasVariants[id].stateMaker.file]
                  : []),
              ]),
              ...(playerFrame
                ? ['apps/web/src/components/PlayerFrame.tsx']
                : []),
            ],
            directories: [...fixedCanvasAdapterInputs.directories],
          },
        }),
  };
}
