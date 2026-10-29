import type { ReactNode } from 'react';
import type { GameHost } from '@tablemax/web-host';
import type { View } from '../project';
import type { useDecisionController } from './useDecisionController';
/** Authorized view and one shared controller; renderers cannot acquire private session state. */
export interface PlayerDecisionProps {
  game: View;
  session: GameHost;
  decision: ReturnType<typeof useDecisionController>;
  motion: readonly string[];
  landscape: boolean;
  showResearch: (id: string) => void;
  heldOptions: ReactNode;
}
