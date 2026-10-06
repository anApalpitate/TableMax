import type { Phase } from '../types';
export type BoardPanels = {
  left: boolean;
  right: boolean;
  market: 'plants' | 'resources';
  width: 'narrow' | 'wide';
  last: 'left' | 'right';
};
export function boardStage(phase: Phase) {
  return ['offer', 'auction', 'replace'].includes(phase) ? 'auction' : phase;
}
export function defaultBoardPanels(phase: Phase): BoardPanels {
  return {
    left: ['offer', 'auction', 'replace', 'resources'].includes(phase),
    right: phase === 'powering',
    market: phase === 'resources' ? 'resources' : 'plants',
    width: 'narrow',
    last: phase === 'powering' ? 'right' : 'left',
  };
}
export function toggleBoardPanel(
  panels: BoardPanels,
  side: 'left' | 'right',
  narrow: boolean,
): BoardPanels {
  const open = !panels[side];
  return {
    ...panels,
    [side]: open,
    ...(open && narrow ? { [side === 'left' ? 'right' : 'left']: false } : {}),
    last: side,
  };
}
