import assert from 'node:assert/strict';

// This is the selectable contract for the existing UI verifier, not a CLI.
export const fixedCanvasVersion = 'fixed-v1';
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
  ...['content', 'integration'].flatMap((layer) =>
    Object.keys(fixedCanvasVariants).flatMap((variant) =>
      fixedCanvasLayouts.map((layout) => ({
        ...layout,
        id: `${layer}-${variant}-${layout.layout}`,
        layer,
        variant,
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
  return {
    version: fixedCanvasVersion,
    layer,
    expectedCaseIds: cases.map((item) => item.id),
    selectedCaseIds: selected.map((item) => item.id),
    cases: selected,
    variants,
    scopes: ['shared', ...variants.map((id) => `game:${id}`)],
  };
}
