import type { JsonValue } from '../../../packages/game-sdk/src/index';
import {
  encodeOriginalDraw,
  encodeExpansionDraw,
} from '../../../games/pokemon-encounters/bot/learning';
import { encodeAuctionBid } from '../../../games/modern-art/bot/learning';
import {
  auctionDiskEncoder,
  encodeAuctionDisk,
} from '../../../games/ra/bot/learning';
import { encodePlacement } from '../../../games/manila/bot/learning';
import { encodeTeamVote } from '../../../games/avalon/bot/learning';
import { encodeMidgameBuild } from '../../../games/power-grid/bot/learning';
import { encodeTurn } from '../../../games/rummikub/bot/learning';

function pilot<View, Action>(
  game: string,
  variant: string | undefined,
  players: number,
  node: string,
  encode: (view: View, action: Action, seat: string) => number[] | null,
  result: 'winners' | 'matchWinners' | 'winner' = 'winners',
) {
  return {
    game,
    variant,
    players,
    encoder: node,
    result,
    features: (view: JsonValue, action: JsonValue, seat: string) =>
      encode(view as View, action as Action, seat),
  };
}

/** Each identity fixes a game-owned observation, decision node and terminal objective. */
export const decisionLearningPilots = {
  'pokemon-original': pilot(
    'pokemon-encounters',
    'original',
    4,
    'original-draw-v1',
    encodeOriginalDraw,
    'matchWinners',
  ),
  'pokemon-expansion': pilot(
    'pokemon-encounters',
    'expansion',
    4,
    'expansion-draw-v1',
    encodeExpansionDraw,
    'matchWinners',
  ),
  'modern-art': pilot(
    'modern-art',
    undefined,
    4,
    'once-auction-v1',
    encodeAuctionBid,
  ),
  ra: pilot(
    'ra',
    undefined,
    4,
    auctionDiskEncoder.id,
    encodeAuctionDisk,
    'winner',
  ),
  manila: pilot('manila', undefined, 4, 'placement-v1', encodePlacement),
  avalon: pilot('avalon', 'configured', 7, 'team-vote-v1', encodeTeamVote),
  'power-grid': pilot(
    'power-grid',
    undefined,
    4,
    'midgame-build-v1',
    encodeMidgameBuild,
  ),
  rummikub: pilot('rummikub', undefined, 4, 'opened-turn-v1', encodeTurn),
};

export type DecisionLearningPilot =
  (typeof decisionLearningPilots)[keyof typeof decisionLearningPilots];
