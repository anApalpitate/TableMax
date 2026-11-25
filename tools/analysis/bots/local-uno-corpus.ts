import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { bot, observe, type Memory } from '../../../games/uno/bot/index';
import { rules } from '../../../games/uno/rules';
import type { Action, UnoView } from '../../../games/uno/types';
import type { LearningEvent } from '../../../packages/platform-core/src/bot-learning';
import type { UnoRoot } from './uno-samples';

type Decision = Extract<LearningEvent, { type: 'decision' }>;
type LoggedEvent = LearningEvent & {
  version: number;
  segment: string;
  writerSession: string;
  firstForSessionMatch?: boolean;
};
interface Trajectory {
  segment: string;
  writerSession: string;
  decisions: Decision[];
  ended: boolean;
  revision: number;
  branch: number;
}

function playableRoots(
  decisions: readonly Decision[],
  seed: number,
  maximum: number,
) {
  const candidates = decisions.flatMap((row): UnoRoot[] => {
    const view = row.observation as UnoView;
    if (
      view?.gameId !== 'uno' ||
      view.rulesVersion !== rules.manifest.rulesVersion ||
      view.stage !== 'turn' ||
      view.phase !== 'playing' ||
      view.unoWindow ||
      !Array.isArray(view.self?.hand) ||
      view.self.hand.length < 2 ||
      view.turnSeat !== view.self.seatId ||
      !Array.isArray(view.seatOrder) ||
      !bot.model?.supportsMatch?.(view.seatOrder.length, view.setup) ||
      view.seatOrder[row.seat] !== view.self.seatId ||
      !Array.isArray(row.actions)
    )
      return [];
    let actions: Action[];
    let memory: Memory;
    try {
      actions = row.actions.map(
        (action) => rules.validateAction(action) as Action,
      );
      if (actions.filter(({ type }) => type === 'play').length < 2) return [];
      memory = observe(
        view,
        bot.validateMemory(row.policy?.memory ?? null),
        'juewu',
      );
    } catch {
      return [];
    }
    return [{ seed, id: row.decisionId, view, actions, memory }];
  });
  if (candidates.length <= maximum) return candidates;
  return Array.from(
    { length: maximum },
    (_, index) =>
      candidates[Math.floor((index * candidates.length) / maximum)]!,
  );
}

export function readUnoLearningCorpus(path: string, maximumRoots: number) {
  const file = lstatSync(path);
  if (!file.isFile() || file.isSymbolicLink() || file.size > 16 * 1024 * 1024)
    throw new Error('UNO learning input must be a bounded local file');
  if (!Number.isSafeInteger(maximumRoots) || maximumRoots < 1)
    throw new Error('Invalid local sample root limit');

  const bytes = readFileSync(path);
  const inputDigest = createHash('sha256').update(bytes).digest('hex');
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
      !Number.isSafeInteger(entry.branch)
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
    } else if (
      entry.type === 'decision' &&
      typeof entry.checkpointId === 'string' &&
      typeof entry.decisionId === 'string' &&
      !trajectory.ended
    ) {
      trajectory.decisions.push(entry);
      trajectory.ended =
        (entry.result as { phase?: string } | undefined)?.phase === 'ended';
    }
  }

  const entries = [...trajectories.entries()].flatMap(
    ([instance, trajectory]) => {
      if (!trajectory.ended) return [];
      const seed =
        createHash('sha256')
          .update('tablemax/uno/captured-match/v1:')
          .update(instance)
          .digest()
          .readUInt32BE() || 1;
      const roots = playableRoots(trajectory.decisions, seed, maximumRoots);
      return roots.length ? [{ seed, roots }] : [];
    },
  );
  return {
    inputDigest,
    invalidLines,
    matches: trajectories.size,
    entries: invalidLines ? [] : entries,
  };
}
