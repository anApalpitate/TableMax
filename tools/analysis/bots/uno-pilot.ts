import { isDeepStrictEqual } from 'node:util';
import { bot, rules } from '../../../games/uno';
import { unoPilotMatch } from '../../../games/uno/config';

const { gameVersion, rulesVersion, stateVersion } = rules.manifest;

export const unoPilotEvidence = Object.freeze({
  ...unoPilotMatch,
  gameVersion,
  rulesVersion,
  stateVersion,
  strategyId: bot.id,
  strategyVersion: bot.version,
});

export function isCurrentUnoPilot(input: unknown) {
  return isDeepStrictEqual(input, unoPilotEvidence);
}
