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
  { layout: 'player-portrait', role: 'player', width: 360, height: 640 },
  { layout: 'player-landscape', role: 'player', width: 640, height: 360 },
];
export const fixedCanvasVariants = {
  'modern-art': {
    path: 'games/modern-art',
    rules: 'rules/index.ts',
    bot: 'bot/index.ts',
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
export const fixedCanvasCases = [
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
  },
  ...['content', 'integration'].flatMap((layer) =>
    Object.keys(fixedCanvasVariants).flatMap((variant) =>
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
  const browserZoom = selected.some((item) => item.boundary === 'browser-zoom');
  return {
    version: fixedCanvasVersion,
    layer,
    expectedCaseIds: cases.map((item) => item.id),
    selectedCaseIds: selected.map((item) => item.id),
    cases: selected,
    variants,
    platform,
    playerFrame,
    browserZoom,
    scopes: [
      ...(platform ? ['box'] : []),
      'shared',
      ...variants.map((id) => `game:${id}`),
    ],
    ...(layer === 'adapter'
      ? {
          inputs: {
            ...fixedCanvasAdapterInputs,
            complete: !browserZoom && fixedCanvasAdapterInputs.complete,
            files: [
              ...fixedCanvasAdapterInputs.files,
              ...(platform ? fixedCanvasPlatformInputFiles : []),
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
              'tools/test/fixtures/prepare-public-screen-retirement.ts',
              ...variants.flatMap((id) => [
                `${fixedCanvasVariants[id].path}/web/index.tsx`,
                `${fixedCanvasVariants[id].path}/${fixedCanvasVariants[id].rules}`,
                `${fixedCanvasVariants[id].path}/${fixedCanvasVariants[id].bot}`,
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
