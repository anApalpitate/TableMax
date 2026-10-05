/** Public teaching example; never reads a live player's board. */
export const scoringExample = {
  instances: [
    'ordinary-4#01',
    'ordinary-9#01',
    'ordinary--2#01',
    'ordinary-3#01',
    'special-ditto#01',
    'ordinary-9#02',
  ],
  values: [4, 9, -2, 3, 9, 9],
  columns: [7, 0, 7],
  total: 14,
} as const;
