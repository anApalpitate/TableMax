import { createHash } from 'node:crypto';
import type {
  BotDifficulty,
  BotStrategy,
  GameRules,
  JsonValue,
  PendingDecision,
} from '../../../packages/game-sdk/src/index';
import { reactionDelayMs } from '../../../packages/platform-core/src/bot-scheduler';
import { allowsGameAction } from '../../../packages/platform-core/src/game-actions';
import type {
  BotData,
  Snapshot,
} from '../../../packages/platform-core/src/model';
import { RandomSource } from '../../../packages/platform-core/src/random';

export interface EvaluationSeat {
  id: string;
  strategy: BotStrategy;
  difficulty: BotDifficulty;
}

export interface EvaluationMatch {
  rules: GameRules;
  seats: readonly EvaluationSeat[];
  seed: number;
  setup?: JsonValue;
}

export interface EvaluationCheckpoint {
  version: 1;
  match: string;
  steps: number;
  snapshot: Snapshot;
  traceDigest: string;
}

export type EvaluationStep = {
  number: number;
  source: 'bot' | 'lifecycle' | 'automatic';
  decision: PendingDecision | null;
  action: JsonValue;
};

export interface EvaluationOptions {
  maxSteps: number;
  checkpoint?: EvaluationCheckpoint;
  signal?: AbortSignal;
  onStep?: (step: EvaluationStep) => void;
}

function digest(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function validRandom(value: number) {
  return Number.isInteger(value) && value > 0 && value <= 0xffffffff;
}

function matchContext(match: EvaluationMatch) {
  const { rules, seed } = match;
  const seats = match.seats.map(({ id }) => id);
  if (
    !validRandom(seed) ||
    new Set(seats).size !== seats.length ||
    seats.some((seat) => typeof seat !== 'string' || seat.length === 0) ||
    seats.length < rules.manifest.players.min ||
    seats.length > rules.manifest.players.max
  )
    throw new Error('Invalid evaluation seed or seats');
  if (!rules.setup && match.setup !== undefined)
    throw new Error('This game does not accept evaluation setup options');
  for (const { strategy, difficulty } of match.seats)
    if (
      strategy.gameId !== rules.manifest.id ||
      strategy.rulesVersion !== rules.manifest.rulesVersion ||
      !(strategy.difficulties ?? ['default']).includes(difficulty)
    )
      throw new Error(
        'Evaluation strategy is incompatible with the game or seat',
      );
  const setup = rules.setup?.validate(match.setup ?? rules.setup.defaults);
  const identity = digest({
    game: rules.manifest,
    setup,
    seed,
    seats: match.seats.map(({ id, strategy, difficulty }) => [
      id,
      strategy.id,
      strategy.version,
      difficulty,
    ]),
  });
  return { seats, setup, identity };
}

/** Deterministic rule evaluation. Checkpoints and step events are private to the evaluator. */
export async function evaluateBotMatch(
  match: EvaluationMatch,
  options: EvaluationOptions,
): Promise<{
  outcome: 'ended' | 'step-limit' | 'cancelled';
  checkpoint: EvaluationCheckpoint;
  publicResult: JsonValue;
}> {
  const { rules } = match;
  const { seats, setup, identity } = matchContext(match);
  if (!Number.isSafeInteger(options.maxSteps) || options.maxSteps < 1)
    throw new Error('Evaluation requires a positive step limit');

  const strategies = new Map(match.seats.map((seat) => [seat.id, seat]));
  const previous = options.checkpoint;
  let steps = previous?.steps ?? 0;
  let traceDigest = previous?.traceDigest ?? identity;
  let snapshot: Snapshot;
  if (previous) {
    if (
      previous.version !== 1 ||
      previous.match !== identity ||
      !Number.isSafeInteger(steps) ||
      steps < 0 ||
      steps > options.maxSteps ||
      !/^[a-f0-9]{64}$/.test(traceDigest) ||
      !validRandom(previous.snapshot.random) ||
      Object.keys(previous.snapshot.bots).length !== seats.length
    )
      throw new Error('Evaluation checkpoint does not match the frozen inputs');
    snapshot = structuredClone(previous.snapshot);
    snapshot.state = rules.validateState(snapshot.state, seats);
    for (const { id, strategy, difficulty } of match.seats) {
      const saved = snapshot.bots[id];
      if (
        !saved ||
        saved.id !== strategy.id ||
        saved.version !== strategy.version ||
        saved.difficulty !== difficulty ||
        !validRandom(saved.random)
      )
        throw new Error(
          'Evaluation checkpoint contains incompatible strategy data',
        );
      saved.memory = strategy.validateMemory(saved.memory);
    }
  } else {
    const random = new RandomSource(match.seed);
    const state = rules.validateState(
      rules.initialize({
        seats,
        random,
        ...(setup === undefined ? {} : { setup }),
      }),
      seats,
    );
    snapshot = {
      state,
      random: random.state,
      bots: Object.fromEntries(
        match.seats.map(({ id, strategy, difficulty }) => [
          id,
          {
            id: strategy.id,
            version: strategy.version,
            difficulty,
            memory: strategy.validateMemory(null),
            random:
              Number.parseInt(digest([match.seed, id]).slice(0, 8), 16) || 1,
          },
        ]),
      ),
    };
  }

  const signal = options.signal ?? new AbortController().signal;
  while (
    !rules.ended(snapshot.state) &&
    steps < options.maxSteps &&
    !signal.aborted
  ) {
    const before = snapshot;
    const decisions = rules.decisions(before.state);
    const automatic = rules.automaticAction?.(before.state);
    if (automatic && decisions.length)
      throw new Error(
        'Overlapping automatic deadlines require a game evaluation adapter',
      );

    // Model declared reaction races without wall-clock waits. Other choices
    // commit in declared order. Live concurrent saves are tested separately.
    let decision = decisions[0] ?? null;
    if (decision) {
      let earliest = Infinity;
      for (const candidate of decisions) {
        const data = before.bots[candidate.seatId];
        if (!data)
          throw new Error('Evaluation decision belongs to an unknown seat');
        const timing = rules.botTiming?.(
          before.state,
          candidate.seatId,
          data.difficulty ?? 'default',
        );
        if (!timing) continue;
        const due = reactionDelayMs({
          instanceId: String(match.seed),
          branch: 0,
          decision: candidate,
          data,
          timing,
        });
        if (due < earliest) {
          earliest = due;
          decision = candidate;
        }
      }
    }

    const random = new RandomSource(before.random);
    const context = { seats, random };
    const state = structuredClone(before.state);
    const bots = { ...before.bots };
    let action: JsonValue;
    let source: EvaluationStep['source'];
    let nextState: JsonValue;
    if (decision) {
      source = 'bot';
      const { seatId } = decision;
      const configured = strategies.get(seatId)!;
      const entry = before.bots[seatId]!;
      const choices = rules.legalActions(before.state, seatId);
      if (!choices.length)
        throw new Error('Evaluation decision has no legal actions');
      const strategyRandom = new RandomSource(entry.random);
      const result = await configured.strategy
        .decide({
          view: structuredClone(
            rules.project(before.state, { role: 'player', seatId }),
          ),
          actions: structuredClone(choices),
          decision: structuredClone(decision),
          memory: structuredClone(entry.memory),
          difficulty: configured.difficulty,
          random: strategyRandom,
          signal,
        })
        .catch((error: unknown) => {
          if (!signal.aborted) throw error;
          return null;
        });
      if (result === null || signal.aborted) break;
      try {
        action = rules.validateAction(result.action);
      } catch (cause) {
        throw new Error(`Illegal evaluation action at ${decision.id}`, {
          cause,
        });
      }
      if (!allowsGameAction(rules, before.state, action, seatId))
        throw new Error(`Illegal evaluation action at ${decision.id}`);
      nextState = rules.apply(state, action, seatId, context).state;
      bots[seatId] = {
        ...entry,
        random: strategyRandom.state,
        memory: configured.strategy.validateMemory(result.memory),
      };
    } else if (automatic && rules.applyAutomatic) {
      source = 'automatic';
      action = automatic.action;
      nextState = rules.applyAutomatic(state, action, context).state;
      if (rules.automaticAction?.(nextState)?.key === automatic.key)
        throw new Error(
          'Evaluation automatic action did not advance its deadline',
        );
    } else {
      source = 'lifecycle';
      const lifecycle = rules.lifecycleActions(before.state);
      if (automatic || lifecycle.length !== 1)
        throw new Error('Evaluation requires an unambiguous lifecycle action');
      action = lifecycle[0]!;
      nextState = rules.applyLifecycle(state, action, context).state;
    }

    nextState = rules.validateState(nextState, seats);
    if (source !== 'automatic') {
      for (const { id, strategy, difficulty } of match.seats) {
        const observed = strategy.observe?.({
          view: structuredClone(
            rules.project(nextState, { role: 'player', seatId: id }),
          ),
          memory: structuredClone(bots[id]!.memory),
          seatId: id,
          difficulty,
        });
        if (observed !== undefined)
          bots[id] = {
            ...bots[id]!,
            memory: strategy.validateMemory(observed),
          } satisfies BotData;
      }
    }

    snapshot = { state: nextState, random: random.state, bots };
    const event = { number: ++steps, source, decision, action };
    traceDigest = digest([traceDigest, event]);
    options.onStep?.(structuredClone(event));
  }

  return {
    outcome: rules.ended(snapshot.state)
      ? 'ended'
      : signal.aborted
        ? 'cancelled'
        : 'step-limit',
    checkpoint: { version: 1, match: identity, steps, snapshot, traceDigest },
    publicResult: rules.project(snapshot.state, { role: 'public' }),
  };
}
