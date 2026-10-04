import { mkdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { RoomCoordinator } from '../../packages/platform-core/src/room';
import type {
  Save,
  SaveRepository,
} from '../../packages/platform-core/src/model';
import { validateSave } from '../../packages/platform-core/src/save-validation';
import { SqliteSaveRepository } from '../../apps/server/src/save-repository';
import { rules, bot } from '../../games/modern-art';
import type { Action, ModernArtView } from '../../games/modern-art/ui/view';
import type { Command } from '../../packages/protocol/src';
import { prepare as preparePokemon } from './prepare-pokemon';
import {
  rules as pokemonRules,
  bot as pokemonBot,
} from '../../games/pokemon-encounters';
import type { PokemonView } from '../../games/pokemon-encounters/rules/project';

class FixtureSnapshotRepository implements SaveRepository {
  private saved: Save | null = null;
  load() {
    return this.saved;
  }
  save(value: Save) {
    this.saved = structuredClone(value);
  }
  close() {}
}

export async function clonePreparedEnded(
  work: string,
  fixtures: {
    count: 4 | 5;
    sourceDir: string;
    publicOnly?: boolean;
    players: { token: string; id: string; name: string }[];
    steps: number;
  }[],
) {
  const copied = [];
  for (const fixture of fixtures.filter((entry) => !entry.publicOnly)) {
    const database = new DatabaseSync(join(fixture.sourceDir, 'room.sqlite'), {
      readOnly: true,
    });
    let bytes: string;
    try {
      bytes = String(
        database.prepare('SELECT data FROM saves WHERE id=1').get()!.data,
      );
    } finally {
      database.close();
    }
    const saved = validateSave(JSON.parse(bytes), rules, bot);
    const state = saved.snapshot!.state as { phase?: string; round?: number };
    if (
      saved.status !== 'ended' ||
      state.phase !== 'ended' ||
      state.round !== 4
    )
      throw new Error(
        'Prepared input must still be a real fourth-round ended save',
      );
    rules.validateState(
      saved.snapshot!.state,
      saved.seats.map((seat) => seat.id),
    );
    const dataDir = join(work, `${fixture.count}-ended-reused`);
    await mkdir(dataDir, { recursive: true });
    const repository = new SqliteSaveRepository(dataDir);
    try {
      repository.save(saved);
      const room = new RoomCoordinator(rules, bot, repository);
      for (const player of fixture.players)
        if (room.view(player.token).self?.seatId !== player.id)
          throw new Error(
            'Private prepared credentials do not match the saved seats',
          );
    } finally {
      repository.close();
    }
    copied.push({
      ...fixture,
      sourceDir: dataDir,
      cases: [{ id: 'ended', dataDir, phase: 'ended', steps: fixture.steps }],
      reuseProof: {
        source: fixture.sourceDir,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        revision: saved.revision,
        round: 4,
      },
    });
  }
  if (!copied.length)
    throw new Error('Prepared ended selection cannot be empty');
  return copied;
}

export async function prepareThreeDigit(work: string, count: 4 | 5) {
  const dataDir = join(work, `${count}-three-digit`);
  await mkdir(dataDir, { recursive: true });
  // A valid Fisher-Yates random source keeps the catalog order. All sixteen
  // Rafael paintings are dealt normally, letting fifteen close three rounds
  // and the remaining one produce a real fourth-round estimate of 120.
  const fixtureRules = {
    ...rules,
    initialize(context: Parameters<typeof rules.initialize>[0]) {
      return rules.initialize({
        ...context,
        random: { next: () => 0.99999999999999 },
      });
    },
  };
  const repository = new SqliteSaveRepository(dataDir);
  const room = new RoomCoordinator(fixtureRules, bot, repository);
  const players: { token: string; id: string; name: string }[] = [];
  const command = async (token: string, value: Command) => {
    const view = room.view(token);
    const reply = await room.command(token, {
      actionId: crypto.randomUUID(),
      instanceId: view.instanceId,
      branch: view.branch,
      revision: view.revision,
      command: value,
    });
    if (!reply.ok) throw new Error(reply.reason);
  };
  let steps = 0;
  try {
    for (let index = 0; index < count; index++) {
      const name =
        index === 0 ? '艺术玩家长昵称十二字测试' : `美术馆 ${index + 1}`;
      const player = await room.join(name, undefined, `avatar-${20 + index}`);
      players.push({
        ...player,
        id: room.view(player.token).self!.seatId!,
        name,
      });
      await command(player.token, { type: 'ready', ready: true });
    }
    await command(room.hostToken, { type: 'start' });
    while (steps < 450) {
      const publicView = room.view(room.hostToken).gameView as ModernArtView;
      const rafael = publicView.artists.find(
        (artist) => artist.id === 'rafael',
      )!;
      if (publicView.round === 4 && rafael.currentValue === 120) {
        if (
          JSON.stringify(rafael.history) !== '[30,30,30]' ||
          rafael.playedCount !== 1
        )
          throw new Error(
            'Expected legal 90 historical value plus 30 current estimate',
          );
        await command(room.hostToken, { type: 'pause' });
        const saved = repository.load() as Save;
        rules.validateState(
          saved.snapshot!.state,
          players.map((player) => player.id),
        );
        return {
          count,
          players,
          steps,
          cases: [
            { id: 'three-digit', dataDir, phase: publicView.phase, steps },
          ],
          sourceDir: dataDir,
          estimateProof: {
            round: 4,
            history: rafael.history,
            playedCount: rafael.playedCount,
            currentValue: rafael.currentValue,
          },
        };
      }
      if (publicView.phase === 'round-result') {
        if (rafael.history.at(-1) !== 30)
          throw new Error(
            'Fixture must reach real Rafael first place each prior round',
          );
        const action = room.view(room.hostToken).lifecycleActions[0];
        if (!action) throw new Error('Next round is not authorized');
        await command(room.hostToken, { type: 'lifecycle', action });
        steps++;
        continue;
      }
      if (publicView.phase === 'ended')
        throw new Error('Game ended before legal three-digit estimate');
      let acted = false;
      for (const player of players) {
        const view = room.view(player.token);
        if (!view.decisionId || !view.actions.length) continue;
        const own = view.gameView as ModernArtView;
        const actions = view.actions as Action[];
        const chosenCard = [...own.self!.hand].sort(
          (a, b) =>
            Number(b.artistId === 'rafael') - Number(a.artistId === 'rafael') ||
            own.artists.find((artist) => artist.id === a.artistId)!
              .playedCount -
              own.artists.find((artist) => artist.id === b.artistId)!
                .playedCount,
        )[0];
        const action =
          publicView.phase === 'offer'
            ? actions.find(
                (action) =>
                  action.type === 'offer' && action.cardId === chosenCard?.id,
              )
            : (actions.find(
                (action) =>
                  action.type === 'pass' || action.type === 'decline-double',
              ) ??
              actions.find(
                (action) => 'amount' in action && action.amount === 0,
              ));
        if (!action) throw new Error('No authorized zero-price fixture action');
        await command(player.token, {
          type: 'game',
          decisionId: view.decisionId,
          action,
        });
        steps++;
        acted = true;
        break;
      }
      if (!acted)
        throw new Error('No legal action while reaching three-digit estimate');
    }
    throw new Error('Three-digit fixture exceeded bounded legal steps');
  } finally {
    repository.close();
  }
}

export async function prepareNaturalEnded(work: string, source: string) {
  const bytes = await readFile(source);
  const provenance = JSON.parse(
    await readFile(join(dirname(source), 'provenance.json'), 'utf8'),
  ) as { exportSha256: string; sourceDatabaseSha256: string };
  const sourceSha256 = createHash('sha256').update(bytes).digest('hex');
  if (sourceSha256 !== provenance.exportSha256)
    throw new Error(
      'Natural saved JSON no longer matches its source provenance',
    );
  const saved = validateSave(JSON.parse(bytes.toString('utf8')), rules, bot);
  const state = saved.snapshot!.state as { phase?: string; round?: number };
  if (saved.status !== 'ended' || state.phase !== 'ended' || state.round !== 4)
    throw new Error('Natural source must be an actual fourth-round ended save');
  rules.validateState(
    saved.snapshot!.state,
    saved.seats.map((seat) => seat.id),
  );
  const dataDir = join(work, 'natural-five-ended');
  await mkdir(dataDir, { recursive: true });
  const repository = new SqliteSaveRepository(dataDir);
  try {
    repository.save(saved);
  } finally {
    repository.close();
  }
  return {
    count: saved.seats.length,
    publicOnly: true,
    preservePlayMode: saved.playMode,
    players: saved.seats.map(({ id, name }) => ({ id, name })),
    cases: [{ id: 'ended', dataDir, phase: 'ended', steps: 0 }],
    steps: 0,
    sourceDir: dataDir,
    sourceProof: {
      path: source,
      sha256: sourceSha256,
      sourceDatabaseSha256: provenance.sourceDatabaseSha256,
      bytes: bytes.length,
      revision: saved.revision,
      round: 4,
      status: 'ended',
      preparation:
        'Unmodified natural saved JSON imported into isolated SQLite',
    },
  };
}

export async function prepare(
  work: string,
  count: 4 | 5,
  includeEnded = false,
) {
  const sourceDir = join(work, `source-${count}`);
  await mkdir(sourceDir, { recursive: true });
  let seed = 38117 + count;
  const deterministicRules = {
    ...rules,
    initialize(context: Parameters<typeof rules.initialize>[0]) {
      return rules.initialize({
        ...context,
        random: {
          next() {
            seed ^= seed << 13;
            seed ^= seed >>> 17;
            seed ^= seed << 5;
            return (seed >>> 0) / 4294967296;
          },
        },
      });
    },
  };
  const repository = includeEnded
    ? new FixtureSnapshotRepository()
    : new SqliteSaveRepository(sourceDir);
  const room = new RoomCoordinator(deterministicRules, bot, repository);
  const players: { token: string; id: string; name: string }[] = [];
  const cases: { id: string; dataDir: string; phase: string; steps: number }[] =
    [];
  let steps = 0;
  async function command(credential: string, command: Command) {
    const view = room.view(credential);
    const result = await room.command(credential, {
      actionId: crypto.randomUUID(),
      instanceId: view.instanceId,
      branch: view.branch,
      revision: view.revision,
      command,
    });
    if (!result.ok) throw new Error(result.reason);
  }
  async function remember(id: string) {
    const wasPaused = room.view(room.hostToken).paused;
    const shouldPause =
      room.view(room.hostToken).status === 'playing' && !wasPaused;
    if (shouldPause) await command(room.hostToken, { type: 'pause' });
    const saved = repository.load() as Save;
    rules.validateState(
      saved.snapshot!.state,
      saved.seats.map((seat) => seat.id),
    );
    const dataDir = join(work, `${count}-${id}`);
    await mkdir(dataDir, { recursive: true });
    const target = new SqliteSaveRepository(dataDir);
    target.save(saved);
    target.close();
    const game = room.view(room.hostToken).gameView as ModernArtView;
    cases.push({ id, dataDir, phase: game.phase, steps });
    if (shouldPause) await command(room.hostToken, { type: 'resume' });
  }
  try {
    for (let index = 0; index < count; index++) {
      const name =
        index === 0 ? '艺术玩家长昵称十二字测试' : `美术馆 ${index + 1}`;
      const admission = await room.join(
        name,
        undefined,
        `avatar-${20 + index}`,
      );
      const identity = room.view(admission.token).self!;
      players.push({ token: admission.token, id: identity.seatId!, name });
      await command(admission.token, { type: 'ready', ready: true });
    }
    await command(room.hostToken, {
      type: 'set-owner',
      seatId: players[0]!.id,
    });
    await command(room.hostToken, { type: 'start' });
    await remember('offer');
    const wantedKinds = ['open', 'sealed'];
    while (steps < (includeEnded ? 1600 : 450)) {
      const host = room.view(room.hostToken);
      const game = host.gameView as ModernArtView;
      if (game.phase === 'round-result') {
        if (!cases.some((entry) => entry.id === 'result'))
          await remember('result');
        if (!includeEnded) break;
        const action = host.lifecycleActions[0];
        if (!action) throw new Error('Next round is not authorized');
        await command(room.hostToken, { type: 'lifecycle', action });
        steps++;
        continue;
      }
      if (game.phase === 'ended') {
        if (!includeEnded)
          throw new Error('Game ended before first round result');
        await remember('ended');
        break;
      }
      if (
        game.phase === 'auction' &&
        wantedKinds.includes(game.auction!.kind)
      ) {
        const kind = game.auction!.kind;
        await remember(`auction-${kind}`);
        wantedKinds.splice(wantedKinds.indexOf(kind), 1);
      }
      const collections = Object.values(game.players).reduce(
        (sum, player) => sum + player.collection.length,
        0,
      );
      if (
        game.phase === 'offer' &&
        collections >= 10 &&
        !cases.some((entry) => entry.id === 'collections')
      ) {
        await remember('collections');
        await remember('paused');
      }
      let acted = false;
      for (const player of players) {
        const current = room.view(player.token);
        if (!current.actions.length || !current.decisionId) continue;
        const own = current.gameView as ModernArtView;
        const actions = current.actions as Action[];
        let action: Action | undefined;
        if (own.phase === 'offer') {
          const cards = [...own.self!.hand].sort((a, b) => {
            const aPreferred = wantedKinds.includes(a.auctionKind) ? 0 : 1;
            const bPreferred = wantedKinds.includes(b.auctionKind) ? 0 : 1;
            const aCount = own.artists.find(
              (artist) => artist.id === a.artistId,
            )!.playedCount;
            const bCount = own.artists.find(
              (artist) => artist.id === b.artistId,
            )!.playedCount;
            return (
              aPreferred - bPreferred ||
              aCount - bCount ||
              Number(a.auctionKind === 'double') -
                Number(b.auctionKind === 'double')
            );
          });
          action = actions.find(
            (candidate) =>
              candidate.type === 'offer' && candidate.cardId === cards[0]?.id,
          );
        } else {
          action = actions.find(
            (candidate) =>
              candidate.type === 'pass' || candidate.type === 'decline-double',
          );
          action ??= actions.find(
            (candidate) => 'amount' in candidate && candidate.amount === 0,
          );
        }
        action ??= actions[0];
        if (!action) continue;
        await command(player.token, {
          type: 'game',
          decisionId: current.decisionId,
          action,
        });
        rules.validateState(
          (repository.load() as Save).snapshot!.state,
          players.map((player) => player.id),
        );
        steps++;
        acted = true;
        break;
      }
      if (!acted)
        throw new Error('No authorized action in fixture preparation');
    }
    for (const id of [
      'offer',
      'auction-open',
      'auction-sealed',
      'collections',
      'paused',
      'result',
      ...(includeEnded ? ['ended'] : []),
    ]) {
      if (!cases.some((entry) => entry.id === id))
        throw new Error(`${count}-player legal fixture did not reach ${id}`);
    }
    if (includeEnded) {
      const finalRepository = new SqliteSaveRepository(sourceDir);
      try {
        finalRepository.save(repository.load() as Save);
      } finally {
        finalRepository.close();
      }
    }
    return { count, players, cases, steps, sourceDir };
  } finally {
    repository.close();
  }
}

export async function preparePokemonCompatibility(
  work: string,
  includeResult = false,
) {
  const dataDir = join(work, 'pokemon-six-draw');
  await mkdir(dataDir, { recursive: true });
  const players = await preparePokemon('layout', dataDir, undefined, 6);
  const repository = new SqliteSaveRepository(dataDir);
  const room = new RoomCoordinator(pokemonRules, pokemonBot, repository);
  async function command(token: string, command: Command) {
    const view = room.view(token);
    const reply = await room.command(token, {
      actionId: crypto.randomUUID(),
      instanceId: view.instanceId,
      revision: view.revision,
      branch: view.branch,
      command,
    });
    if (!reply.ok) throw new Error(reply.reason);
  }
  try {
    await command(room.hostToken, { type: 'resume' });
    for (const player of players) {
      const view = room.view(player.token);
      const action = view.actions.find(
        (action) => action.type === 'initial-flip',
      );
      if (!view.decisionId || !action)
        throw new Error(
          'Pokemon initialization must expose a legal initial flip',
        );
      await command(player.token, {
        type: 'game',
        decisionId: view.decisionId,
        action,
      });
    }
    await command(room.hostToken, { type: 'pause' });
    const saved = repository.load() as Save;
    pokemonRules.validateState(
      saved.snapshot!.state,
      saved.seats.map((seat) => seat.id),
    );
    let resultDataDir: string | undefined;
    let resultSteps = 0;
    if (includeResult) {
      resultDataDir = join(work, 'pokemon-six-result');
      await mkdir(resultDataDir, { recursive: true });
      const target = new SqliteSaveRepository(resultDataDir);
      target.save(saved);
      const resultRoom = new RoomCoordinator(pokemonRules, pokemonBot, target);
      const act = async (token: string, value: Command) => {
        const view = resultRoom.view(token);
        const reply = await resultRoom.command(token, {
          actionId: crypto.randomUUID(),
          instanceId: view.instanceId,
          revision: view.revision,
          branch: view.branch,
          command: value,
        });
        if (!reply.ok) throw new Error(reply.reason);
      };
      try {
        await act(resultRoom.hostToken, { type: 'resume' });
        while (
          resultSteps < 400 &&
          (resultRoom.view(resultRoom.hostToken).gameView as PokemonView)
            .phase !== 'round-result'
        ) {
          let acted = false;
          for (const player of players) {
            const view = resultRoom.view(player.token);
            if (!view.decisionId || !view.actions.length) continue;
            const own = view.gameView as PokemonView;
            const hidden = own.boards[view.self!.seatId!]!.findIndex(
              (slot) => slot.card === null,
            );
            const action =
              view.actions.find(
                (action) => action.type === 'replace' && action.slot === hidden,
              ) ??
              view.actions.find(
                (action) => action.type === 'decline-ability',
              ) ??
              view.actions[0]!;
            await act(player.token, {
              type: 'game',
              decisionId: view.decisionId,
              action,
            });
            resultSteps++;
            acted = true;
            break;
          }
          if (!acted)
            throw new Error(
              'No authorized Pokemon decision while preparing six-player result',
            );
        }
        if (
          (resultRoom.view(resultRoom.hostToken).gameView as PokemonView)
            .phase !== 'round-result'
        )
          throw new Error(
            'Legal Pokemon fixture failed to reach result within bound',
          );
        await act(resultRoom.hostToken, { type: 'pause' });
        const final = target.load() as Save;
        pokemonRules.validateState(
          final.snapshot!.state,
          final.seats.map((seat) => seat.id),
        );
      } finally {
        target.close();
      }
    }
    return { dataDir, players, resultDataDir, resultSteps };
  } finally {
    repository.close();
  }
}
