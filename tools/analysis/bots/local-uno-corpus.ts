import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { bot, observe } from '../../../games/uno/bot/index';
import { rules } from '../../../games/uno/rules';
import type { Action, UnoView } from '../../../games/uno/types';
import {
  durableLearningProvenance,
  type LearningEvent,
} from '../../../packages/platform-core/src/bot-learning';
import { readUnoHumanReview, unoReviewKey } from './uno-human-review';
import type { UnoRoot } from './uno-samples';

type Decision = Extract<LearningEvent, { type: 'decision' }>;
type LoggedEvent = LearningEvent & {
  version: number;
  segment: string;
  writerSession: string;
  firstForSessionMatch?: boolean;
  provenance?: unknown;
};
interface Trajectory {
  segment: string;
  writerSession: string;
  decisions: Array<Decision & { provenance?: unknown }>;
  ended: boolean;
  revision: number;
  branch: number;
}

export type UnoLearningQuality = 'high' | 'standard' | 'exploratory';
export type UnoLocalRoot = UnoRoot & { qualityTier: UnoLearningQuality };
export const unoLearningQualityWeights = {
  high: 1.5,
  standard: 1,
  exploratory: 0.5,
} as const;
const qualityOrder = ['high', 'standard', 'exploratory'] as const;

function tierCounts() {
  return { high: 0, standard: 0, exploratory: 0 };
}

function validDecision(row: Decision & { provenance?: unknown }) {
  if (row.source !== 'bot' && row.source !== 'player-command') return false;
  return (
    typeof row.checkpointId === 'string' &&
    row.checkpointId.length > 0 &&
    typeof row.decisionId === 'string' &&
    row.decisionId.length > 0 &&
    Number.isSafeInteger(row.beforeRevision) &&
    row.beforeRevision >= 0 &&
    row.beforeRevision + 1 === row.revision &&
    Number.isSafeInteger(row.seat) &&
    row.seat >= 0 &&
    (row.source === 'bot'
      ? typeof row.policy?.id === 'string' &&
        typeof row.policy.version === 'string' &&
        (row.policy.difficulty === undefined ||
          (bot.difficulties ?? ['default']).includes(row.policy.difficulty))
      : row.policy === undefined) &&
    (row.provenance === undefined ||
      isDeepStrictEqual(
        row.provenance,
        durableLearningProvenance(row.source, row.policy?.difficulty),
      ))
  );
}

function playableRoot(row: Decision, seed: number) {
  const view = row.observation as UnoView;
  if (
    view?.gameId !== 'uno' ||
    view.rulesVersion !== rules.manifest.rulesVersion ||
    !Array.isArray(view.seatOrder) ||
    !view.self ||
    !Array.isArray(view.self.hand) ||
    view.seatOrder[row.seat] !== view.self.seatId ||
    !Array.isArray(row.actions) ||
    Object.hasOwn(view, 'deck') ||
    Object.hasOwn(view, 'hands')
  )
    return { type: 'invalid' as const };
  if (
    view.stage !== 'turn' ||
    view.phase !== 'playing' ||
    view.unoWindow ||
    view.self.hand.length < 2 ||
    !bot.model?.supportsMatch?.(view.seatOrder.length, view.setup)
  )
    return { type: 'out-of-scope' as const };
  try {
    const actions = row.actions.map(
      (action) => rules.validateAction(action) as Action,
    );
    const chosen = rules.validateAction(row.action) as Action;
    const normalized =
      chosen.type === 'play' && chosen.uno === false
        ? {
            type: chosen.type,
            cardId: chosen.cardId,
            ...(chosen.color ? { color: chosen.color } : {}),
          }
        : chosen;
    if (
      view.turnSeat !== view.self.seatId ||
      new Set(actions.map((action) => JSON.stringify(action))).size !==
        actions.length ||
      !actions.some((action) => isDeepStrictEqual(action, normalized)) ||
      actions.some(
        (action) =>
          action.type === 'play' &&
          !view.self!.hand.some((card) => card.id === action.cardId),
      )
    ) {
      return { type: 'invalid' as const };
    }
    if (actions.filter(({ type }) => type === 'play').length < 2)
      return { type: 'out-of-scope' as const };
    const memory = observe(
      view,
      bot.validateMemory(row.policy?.memory ?? null),
      'juewu',
    );
    const root: UnoRoot = { seed, id: row.decisionId, view, actions, memory };
    return { type: 'root' as const, root };
  } catch {
    return { type: 'invalid' as const };
  }
}

function selectRoots(
  candidates: Record<UnoLearningQuality, UnoLocalRoot[]>,
  maximum: number,
) {
  const roots: UnoLocalRoot[] = [];
  for (const quality of qualityOrder) {
    const group = candidates[quality];
    const count = Math.min(maximum - roots.length, group.length);
    for (let index = 0; index < count; index++)
      roots.push(group[Math.floor((index * group.length) / count)]!);
  }
  return roots;
}

export function readUnoLearningCorpus(
  path: string,
  maximumRoots: number,
  reviewPath?: string,
) {
  const file = lstatSync(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size > 16 * 1024 * 1024)
    throw new Error('UNO learning input must be a bounded local file');
  if (!Number.isSafeInteger(maximumRoots) || maximumRoots < 1)
    throw new Error('Invalid local sample root limit');

  const bytes = readFileSync(path);
  if (bytes.length > 16 * 1024 * 1024)
    throw new Error('UNO learning input grew during read');
  const inputDigest = createHash('sha256').update(bytes).digest('hex');
  const review = reviewPath
    ? readUnoHumanReview(reviewPath, inputDigest)
    : null;
  const reviewed = new Set<string>();
  const eligible = tierCounts();
  const selected = tierCounts();
  const selectedMatches = tierCounts();
  const isolated = { invalidDecision: 0, invalidObservationOrAction: 0 };
  const trajectories = new Map<string, Trajectory>();
  let invalidLines = 0;
  for (const line of bytes.toString('utf8').split(/\r?\n/)) {
    if (!line.trim()) continue;
    let entry: LoggedEvent;
    try {
      entry = JSON.parse(line) as LoggedEvent;
    } catch {
      invalidLines++;
      continue;
    }
    if (
      entry?.version !== 1 ||
      entry.gameId !== 'uno' ||
      entry.rulesVersion !== rules.manifest.rulesVersion ||
      typeof entry.instanceId !== 'string' ||
      !entry.instanceId ||
      typeof entry.segment !== 'string' ||
      typeof entry.writerSession !== 'string' ||
      !Number.isSafeInteger(entry.revision) ||
      !Number.isSafeInteger(entry.branch) ||
      (entry.type !== 'decision' &&
        entry.type !== 'rollback' &&
        entry.type !== 'abandoned') ||
      (entry.type === 'rollback' &&
        (!Number.isSafeInteger(entry.previousBranch) ||
          typeof entry.checkpointId !== 'string'))
    ) {
      invalidLines++;
      continue;
    }

    // Gaps while capture was off and changes of process do not create continuity.
    let trajectory = trajectories.get(entry.instanceId);
    if (
      !trajectory ||
      trajectory.segment !== entry.segment ||
      trajectory.writerSession !== entry.writerSession
    ) {
      if (!entry.firstForSessionMatch) {
        invalidLines++;
        continue;
      }
      trajectory = {
        segment: entry.segment,
        writerSession: entry.writerSession,
        decisions: [],
        ended: false,
        revision: -1,
        branch: entry.type === 'rollback' ? entry.previousBranch : entry.branch,
      };
      trajectories.set(entry.instanceId, trajectory);
    }
    if (
      entry.revision <= trajectory.revision ||
      (entry.type === 'rollback'
        ? entry.previousBranch !== trajectory.branch ||
          entry.branch <= trajectory.branch
        : entry.branch !== trajectory.branch)
    ) {
      invalidLines++;
      continue;
    }
    trajectory.revision = entry.revision;
    trajectory.branch = entry.branch;
    if (entry.type === 'rollback') {
      const anchor = trajectory.decisions.findIndex(
        ({ checkpointId }) => checkpointId === entry.checkpointId,
      );
      trajectory.decisions =
        anchor < 0 ? [] : trajectory.decisions.slice(0, anchor);
      trajectory.ended = false;
    } else if (entry.type === 'abandoned') {
      trajectory.decisions = [];
      trajectory.ended = false;
    } else if (entry.type === 'decision' && !trajectory.ended) {
      if (!validDecision(entry)) {
        isolated.invalidDecision++;
        continue;
      }
      trajectory.decisions.push(entry);
      if (entry.result !== undefined) {
        const result = entry.result as UnoView;
        trajectory.ended =
          result?.gameId === 'uno' &&
          result.rulesVersion === entry.rulesVersion &&
          result.phase === 'ended' &&
          Array.isArray(result.winners) &&
          result.winners.length > 0 &&
          Array.isArray(result.seatOrder) &&
          result.winners.every((seat) => result.seatOrder.includes(seat));
        if (!trajectory.ended) {
          trajectory.decisions.pop();
          isolated.invalidDecision++;
        }
      }
    }
  }

  const entries = invalidLines
    ? []
    : [...trajectories.entries()].flatMap(([instance, trajectory]) => {
        if (!trajectory.ended) return [];
        const seed =
          createHash('sha256')
            .update('tablemax/uno/captured-match/v1:')
            .update(instance)
            .digest()
            .readUInt32BE() || 1;
        const candidates: Record<UnoLearningQuality, UnoLocalRoot[]> = {
          high: [],
          standard: [],
          exploratory: [],
        };
        for (const row of trajectory.decisions) {
          const outcome = playableRoot(row, seed);
          if (outcome.type === 'invalid') isolated.invalidObservationOrAction++;
          if (outcome.type !== 'root') continue;
          const key = unoReviewKey(row);
          const human =
            row.source === 'player-command' &&
            (review?.reviewed.has(key) ?? false);
          if (human) reviewed.add(key);
          const qualityTier = human
            ? 'high'
            : durableLearningProvenance(row.source, row.policy?.difficulty)
                .qualityTier;
          eligible[qualityTier]++;
          candidates[qualityTier].push({ ...outcome.root, qualityTier });
        }
        const roots = selectRoots(candidates, maximumRoots);
        for (const root of roots) selected[root.qualityTier]++;
        for (const quality of new Set(roots.map((root) => root.qualityTier)))
          selectedMatches[quality]++;
        return roots.length ? [{ seed, roots }] : [];
      });
  if (review && reviewed.size !== review.reviewed.size)
    throw new Error(
      'UNO human review contains a bot, discarded or invalid decision',
    );
  return {
    inputDigest,
    invalidLines,
    matches: trajectories.size,
    entries,
    reviewDigest: review?.digest ?? null,
    eligible,
    selected,
    selectedMatches,
    isolated,
  };
}
