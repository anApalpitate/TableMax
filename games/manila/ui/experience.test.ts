import { createRequire } from 'node:module';
import {
  createElement,
  type AnchorHTMLAttributes,
  type ReactNode,
} from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { GameHost } from '@tablemax/web-host';
import { rules } from '../rules';
import { finalScores, resolveWinners } from '../rules/scoring';
import { turnSeat, validateState, type State } from '../rules/state';
import type { Action, ManilaView } from '../rules/view';
import { client } from '../web';
import { ShareCertificates } from './Theme';

// Reuse the host's pinned renderer; the game runtime depends only on React.
const { renderToStaticMarkup } = createRequire(
  new URL('../../../packages/web-host/package.json', import.meta.url),
)('react-dom/server') as { renderToStaticMarkup(element: ReactNode): string };

// Transport controls and platform portraits are outside this rendering test.
// Every game component receives the real rules' authorized projection.
vi.mock('@tablemax/web-host', async (original) => ({
  ...(await original<typeof import('@tablemax/web-host')>()),
  avatarFor: () => '/avatar.webp',
  ScreenLink: (props: AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement('a', props),
  SessionFeedback: () => null,
  PlayModeControl: () => null,
  useAudioOutput: () => false,
}));

const ids = ['A', 'B', 'C'];
const names = ['甲', '乙', '丙'];
const context = { seats: ids, random: { next: () => 0.99 } };
const fresh = () => rules.initialize(context) as State;
function apply(state: State, action: Action): State {
  return validateState(
    rules.apply(state, action, turnSeat(state)!, context).state,
    ids,
  );
}
function render(state: State, role: GameHost['role'], seat = 'A') {
  const projected = rules.project(
    state,
    role === 'player' ? { role: 'player', seatId: seat } : { role: 'public' },
  ) as ManilaView;
  const session: GameHost = {
    role,
    self: undefined,
    connected: true,
    locked: false,
    canControl: false,
    message: '',
    admissionPending: false,
    awaitingConfirmation: false,
    feedback: null,
    errorId: '',
    motion: [],
    command: vi.fn(),
    view: {
      instanceId: 'ui-review',
      branch: 0,
      revision: state.serial,
      status: state.phase === 'ended' ? 'ended' : 'playing',
      paused: false,
      playMode: 'play',
      gameView: projected,
      decisionId:
        rules.decisions(state).find((decision) => decision.seatId === seat)
          ?.id ?? null,
      actions: role === 'player' ? rules.legalActions(state, seat) : [],
      lifecycleActions: [],
      seats: ids.map((id, index) => ({
        id,
        name: names[index],
        avatarId: 'avatar-1',
      })),
    } as unknown as NonNullable<GameHost['view']>,
  };
  const Screen = client.Screen;
  const html = renderToStaticMarkup(createElement(Screen, { session }));
  return { html, text: html.replace(/<[^>]*>/g, '') };
}

describe('Manila experience uses authorized public and player views', () => {
  it('keeps the leading bid and merchant visible for hosts, public screens and waiting players', () => {
    const state = apply(fresh(), { type: 'bid', amount: 7 });
    for (const role of ['host', 'public', 'player'] as const) {
      const { html, text } = render(state, role, 'C');
      expect(text).toMatch(/最高\s*7\s*₱\s*甲/);
      expect(html).toContain('class="mn-actor-avatar"');
      expect(html).toContain('alt="乙正在行动"');
      if (role !== 'player') {
        expect(html).not.toContain('class="mn-private"');
        expect(html).not.toContain('data-manila-action=');
      }
    }
  });

  it('separates spendable cash from collateral and labels final public contracts correctly', () => {
    const state = fresh();
    const own = rules.project(state, {
      role: 'player',
      seatId: 'A',
    }) as ManilaView;
    const player = render(state, 'player', 'A');
    expect(player.text).toContain(`现金${own.self!.cash} ₱`);
    expect(player.text).toContain(`抵押可借${own.self!.availableCredit} ₱`);
    const privateCards = renderToStaticMarkup(
      createElement(ShareCertificates, { shares: own.self!.shares }),
    );
    expect(privateCards).toContain('仅你可见');
    const publicCards = renderToStaticMarkup(
      createElement(ShareCertificates, {
        shares: own.self!.shares,
        publicView: true,
      }),
    );
    expect(publicCards).toContain('已公开');
    expect(publicCards).not.toContain('仅你可见');
  });

  it('asks only the actual debtor to choose collateral and uses that player’s cash shortfall', () => {
    let state = apply(fresh(), { type: 'bid', amount: 40 });
    state = apply(state, { type: 'pass' });
    state = apply(state, { type: 'pass' });
    expect(state.phase).toBe('financing');
    const debtor = render(state, 'player', 'A');
    expect(debtor.text).toMatch(/待支付\s*40\s*₱/);
    expect(debtor.text).toMatch(/待支付\s*40\s*₱\s*还差\s*10\s*₱/);
    expect(debtor.text).toMatch(/港务长竞拍款\s*现金\s*30\s*₱/);
    expect(debtor.html).toContain('data-manila-action="mortgage"');
    expect(debtor.html.match(/data-manila-action="mortgage"/g)).toHaveLength(
      rules
        .legalActions(state, 'A')
        .filter((action) => (action as Action).type === 'mortgage').length,
    );
    expect(debtor.text).toContain('每张抵押 +12 ₱');
    expect(debtor.text).toContain('赎回支付 15 ₱ 并公开');
    expect(debtor.text).toContain('未赎回的股份终局每张扣 15 ₱');
    for (const seat of ['B', 'C']) {
      const waiting = render(state, 'player', seat);
      expect(waiting.html).not.toContain('class="mn-financing-notice"');
      expect(waiting.html).not.toContain('data-manila-action="mortgage"');
      expect(waiting.text).not.toContain('请选择一张未抵押股份');
    }
  });

  it('shows equal ranks for a controlled, validated joint-win end state', () => {
    let state = fresh();
    for (let step = 0; state.phase !== 'ended' && step < 120; step++) {
      const actions = rules.legalActions(state, turnSeat(state)!) as Action[];
      const action =
        actions.find(
          (entry) =>
            entry.type === 'pass' ||
            entry.type === 'skip-share' ||
            entry.type === 'next-voyage',
        ) ??
        actions.find(
          (entry) =>
            entry.type === 'setup' &&
            entry.positions.every((position) => position === 3),
        );
      expect(action).toBeDefined();
      state = apply(state, action!);
    }
    expect(state.phase).toBe('ended');
    // This deliberately controlled tie is not evidence of a natural tied match.
    const original = finalScores(state);
    ids.forEach((id, index) => {
      state.players[id]!.cash += (index < 2 ? 200 : 199) - original[id]!;
    });
    state.scores = finalScores(state);
    state.winners = resolveWinners(state.scores, ids);
    state = validateState(state, ids);
    const { html, text } = render(state, 'public');
    expect(html).toContain('aria-label="甲，赢家，财富 200 比索"');
    expect(html).toContain('aria-label="乙，赢家，财富 200 比索"');
    expect(text).toContain('最终财富');
    expect(text.match(/第1名/g)).toHaveLength(2);
    expect(text).toContain('第3名');
    expect(text).not.toContain('第2名');
    expect(html).not.toContain('class="mn-actor-avatar"');
  });
});
