import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { createRequire } from 'node:module';
import type { ReactNode } from 'react';
const { renderToStaticMarkup } = createRequire(
  new URL('../../../packages/web-host/package.json', import.meta.url),
)('react-dom/server') as { renderToStaticMarkup(element: ReactNode): string };
import { rules } from '../rules';
import type { State } from '../rules/state';
import type { PokerView } from './view';
import type { Action } from '../rules';
import { PlayerControls } from './player';
import { Table } from './public';
import { PokerRules } from './RulesGuide';
import { SavedFeedback } from './Effects';
import type { GameHost } from '@tablemax/web-host';
const context = { seats: ['a', 'b', 'c'], random: { next: () => 0.4 } };
const names = { a: '玩家甲', b: '玩家乙', c: '玩家丙' };
const cast = (v: unknown) => v as PokerView;
describe('cockroach poker authorized UI', () => {
  it('offers explicit target, animal and combined confirmation with accessible selected-state controls', () => {
    const s = rules.initialize(context) as State;
    const html = renderToStaticMarkup(
      createElement(PlayerControls, {
        game: cast(rules.project(s, { role: 'player', seatId: 'a' })),
        actions: rules.legalActions(s, 'a') as Action[],
        names,
        disabled: false,
        choose: () => {},
      }),
    );
    expect(html).toContain('交给谁');
    expect(html).toContain('声明是什么');
    expect(html).toContain('玩家乙');
    expect(html).toContain('玩家丙');
    expect(html).toContain('选好牌、接收者与声明');
    expect(html).toContain('aria-pressed="false"');
  });
  it('peeked view renders the known card and pass-only controls without believe/challenge buttons', () => {
    let s = rules.initialize(context) as State;
    s = rules.apply(
      s,
      { type: 'offer', card: s.hands.a![0]!, target: 'b', claim: 'rat' },
      'a',
      context,
    ).state as State;
    s = rules.apply(s, { type: 'peek' }, 'b', context).state as State;
    const html = renderToStaticMarkup(
      createElement(PlayerControls, {
        game: cast(rules.project(s, { role: 'player', seatId: 'b' })),
        actions: rules.legalActions(s, 'b') as Action[],
        names,
        disabled: false,
        choose: () => {},
      }),
    );
    expect(html).toContain('你已看过此牌');
    expect(html).toContain('交给谁');
    expect(html).toContain('玩家丙');
    expect(html).not.toContain('相信 ·');
    expect(html).not.toContain('质疑 ·');
  });
  it('public board uses public projection only and rules explain all end conditions', () => {
    const s = rules.initialize(context) as State;
    const html = renderToStaticMarkup(
      createElement(Table, {
        game: cast(rules.project(s, { role: 'public' })),
        names,
      }),
    );
    expect(html).toContain('公开收牌区');
    expect(html).not.toContain('你的手牌');
    const guide = renderToStaticMarkup(createElement(PokerRules));
    expect(guide).toContain('双人是五张');
    expect(guide).toContain('不能看后改为判断');
    expect(guide).toContain('10张');
    expect(guide).toContain('<img');
  });
  it('places the player hand and primary controls before other seats collections', () => {
    const s = rules.initialize(context) as State;
    const game = cast(rules.project(s, { role: 'player', seatId: 'a' }));
    const html = renderToStaticMarkup(
      createElement(
        Table,
        { game, names },
        createElement(PlayerControls, {
          game,
          actions: rules.legalActions(s, 'a') as Action[],
          names,
          disabled: false,
          choose: () => {},
        }),
      ),
    );
    expect(html.indexOf('aria-label="本人操作"')).toBeLessThan(
      html.indexOf('aria-label="公开收牌区"'),
    );
    expect(html).not.toContain('尚未收牌');
  });
  it('saved feedback deduplicates same revision, suppresses initial sync and distinguishes branch', () => {
    const f = {
      instanceId: 'i',
      branch: 1,
      revision: 2,
    } as GameHost['feedback'];
    const seen = new SavedFeedback(f);
    expect(seen.accept(f)).toBe(false);
    expect(seen.accept(null)).toBe(false);
    const next = { ...f!, revision: 3 } as GameHost['feedback'];
    expect(seen.accept(next)).toBe(true);
    expect(seen.accept(next)).toBe(false);
    expect(seen.accept({ ...next!, branch: 2 } as GameHost['feedback'])).toBe(
      true,
    );
  });
});
