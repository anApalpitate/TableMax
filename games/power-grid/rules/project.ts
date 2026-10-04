import type { Viewer } from '../../../packages/game-sdk/src';
import { getPlant, RESOURCES } from '../data/catalog';
import { price, replenishment, settingsFor } from '../data/economy';
import type { PowerGridView } from '../types';
import { buildOptions } from './engine';
import type { State } from './model';

export function project(s: State, viewer: Viewer): PowerGridView {
  const self =
    viewer.role === 'player' && s.seatOrder.includes(viewer.seatId)
      ? viewer.seatId
      : null;
  const settings = settingsFor(s.seatOrder.length);
  return structuredClone({
    gameId: 'power-grid',
    round: s.round,
    step: s.step,
    phase: s.phase,
    actor: s.actor,
    seatOrder: s.seatOrder,
    playerOrder: s.playerOrder,
    regions: s.regions,
    regionCount: settings.regions,
    plantLimit: settings.plantLimit,
    step2Threshold: settings.step2,
    endThreshold: settings.end,
    market: s.market.filter((id) => id !== 0),
    actualMarket: (s.step === 3 ? s.market : s.market.slice(0, 4)).filter(
      (id) => id !== 0,
    ),
    futureMarket:
      s.step === 3 ? [] : s.market.slice(4).filter((id) => id !== 0),
    deckCount: s.deck.length,
    step3Pending: s.step3Pending !== null,
    resources: s.resources,
    resourcePrices: Object.fromEntries(
      RESOURCES.map((resource) => [
        resource,
        price(resource, s.resources[resource]),
      ]),
    ) as PowerGridView['resourcePrices'],
    supply: s.supply,
    replenishment: replenishment(s.seatOrder.length, s.step),
    auction: s.auction,
    replacement: s.replacement,
    bought: s.bought,
    passed: s.passed,
    players: Object.fromEntries(
      s.seatOrder.map((seat) => {
        const player = s.players[seat]!;
        return [
          seat,
          {
            plants: player.plants,
            cities: player.cities,
            cash: seat === self || s.phase === 'ended' ? player.cash : null,
            capacity: player.plants.reduce(
              (sum, p) => sum + getPlant(p.id).output,
              0,
            ),
            powered:
              s.phase === 'powering' && s.actor === seat
                ? Math.min(player.cities.length, player.produced)
                : player.powered,
            ran: player.ran,
          },
        ];
      }),
    ),
    self: self ? { seatId: self, cash: s.players[self]!.cash } : null,
    buildOptions: self
      ? buildOptions(s, self)
      : s.actor
        ? buildOptions(s, s.actor)
        : [],
    winners: s.winners,
    finalResults: s.finalResults,
    latest: s.history.at(-1) ?? null,
    history: s.history,
  });
}
