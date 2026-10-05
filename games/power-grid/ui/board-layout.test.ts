import { expect, it } from 'vitest';
import {
  boardStage,
  defaultBoardPanels,
  toggleBoardPanel,
} from './board-layout';
it('groups an entire plant auction and opens only the phase-relevant panel', () => {
  expect((['offer', 'auction', 'replace'] as const).map(boardStage)).toEqual([
    'auction',
    'auction',
    'auction',
  ]);
  expect(defaultBoardPanels('building')).toMatchObject({
    left: false,
    right: false,
  });
  expect(defaultBoardPanels('resources')).toMatchObject({
    left: true,
    right: false,
    market: 'resources',
  });
  expect(defaultBoardPanels('powering')).toMatchObject({
    left: false,
    right: true,
  });
});
it('keeps at most one auxiliary panel open on narrow desktops', () => {
  const panels = defaultBoardPanels('offer');
  expect(toggleBoardPanel(panels, 'right', true)).toMatchObject({
    left: false,
    right: true,
  });
  expect(toggleBoardPanel(panels, 'right', false)).toMatchObject({
    left: true,
    right: true,
  });
});
