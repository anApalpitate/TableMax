import type { RuleContext } from '../../../packages/game-sdk/src';
import { RESOURCES } from '../data/catalog';
import { replenishment, TOTAL_RESOURCES } from '../data/economy';
import type { State } from './model';

export function shuffle<T>(
  values: readonly T[],
  random: RuleContext['random'],
): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random.next() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
const rank = (id: number) => (id === 0 ? Infinity : id);
export class MarketFlow {
  constructor(
    private readonly state: State,
    private readonly context: RuleContext,
  ) {}
  private sort() {
    this.state.market.sort((a, b) => rank(a) - rank(b));
  }
  private removeLowest() {
    const removed = this.state.market.shift();
    if (removed !== undefined) this.state.removed.push(removed);
  }
  draw(phase: 'auction' | 'building' | 'bureaucracy') {
    const s = this.state,
      id = s.deck.shift();
    if (id === undefined) return;
    if (id === 0) {
      s.deck = shuffle(s.deck, this.context.random);
      s.step3Pending = phase;
      if (phase === 'auction') {
        s.market.push(0);
        this.sort();
      } else {
        this.removeLowest();
        s.removed.push(0);
      }
    } else {
      s.market.push(id);
      this.sort();
    }
  }
  removeAndDraw(phase: 'auction' | 'building' | 'bureaucracy') {
    this.removeLowest();
    this.draw(phase);
    this.removeObsolete(phase);
  }
  removeObsolete(phase: 'auction' | 'building' | 'bureaucracy') {
    const threshold = Math.max(
      ...Object.values(this.state.players).map((p) => p.cities.length),
    );
    while (
      this.state.market.length &&
      this.state.market[0] !== 0 &&
      this.state.market[0]! <= threshold
    ) {
      this.removeLowest();
      this.draw(phase);
    }
  }
  activateStep3() {
    const s = this.state;
    if (!s.step3Pending) return;
    if (s.step3Pending === 'auction') {
      s.market = s.market.filter((id) => id !== 0);
      s.removed.push(0);
      this.removeLowest();
    }
    s.step = 3;
    s.step3Pending = null;
    this.removeObsolete('bureaucracy');
  }
  startStep2(): boolean {
    this.state.step = 2;
    this.removeAndDraw('building');
    const step3 = this.state.step3Pending === 'building';
    if (step3) this.activateStep3();
    return step3;
  }
  replenish(step: State['step'] = this.state.step) {
    const s = this.state,
      refill = replenishment(s.seatOrder.length, step);
    for (const resource of RESOURCES) {
      const count = Math.min(
        refill[resource],
        s.supply[resource],
        TOTAL_RESOURCES[resource] - s.resources[resource],
      );
      s.resources[resource] += count;
      s.supply[resource] -= count;
    }
  }
  bureaucracy() {
    const s = this.state;
    if (s.step === 3) this.removeAndDraw('bureaucracy');
    else {
      const largest = s.market.pop();
      if (largest !== undefined) s.deck.push(largest);
      this.draw('bureaucracy');
      this.removeObsolete('bureaucracy');
    }
  }
}
