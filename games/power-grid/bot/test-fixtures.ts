import type { RuleContext } from '@tablemax/game-sdk';
import { emptyStock, PLANT_IDS } from '../data/catalog';
import { settingsFor } from '../data/economy';
import { CITIES } from '../data/germany';
import { initialize, regionChoices, rules, type State } from '../rules';

export function pressureAuction(context: RuleContext, opening: number): State {
  const [own, rival, other] = context.seats as readonly [
    string,
    string,
    string,
  ];
  let state = initialize(context);
  const settings = settingsFor(context.seats.length);
  state.regions = regionChoices(settings.regions)[0]!;
  state.round = 2;
  state.phase = 'offer';
  state.playerOrder = [rival, own, other];
  state.actor = rival;
  const assets = [3, 13, 5];
  context.seats.forEach((seat, index) => {
    state.players[seat]!.cash = 100;
    state.players[seat]!.plants = [
      { id: assets[index]!, resources: emptyStock() },
    ];
  });
  const cities = CITIES.filter(({ region }) => state.regions.includes(region));
  state.players[own]!.cities = [cities[2]!.id];
  state.players[rival]!.cities = [cities[0]!.id, cities[1]!.id];
  state.incomeIssued = 150;
  state.spent = 0;
  state.hiddenRemoved = PLANT_IDS.filter(
    (id) => id > 10 && !assets.includes(id),
  ).slice(0, settings.removed);
  const available = PLANT_IDS.filter(
    (id) => !assets.includes(id) && !state.hiddenRemoved.includes(id),
  );
  state.market = available.slice(0, 8);
  state.deck = [...available.slice(8), 0];
  state = rules.apply(
    state,
    { type: 'offer', plantId: 4, amount: opening },
    rival,
    context,
  ).state as State;
  return rules.apply(state, { type: 'pass' }, other, context).state as State;
}
