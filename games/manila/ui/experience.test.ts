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
import { VoyageResultCard } from './VoyageResult';

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
function settledVoyage(): State {
  let state = fresh();
  for (let step = 0; state.phase !== 'round-result' && step < 160; step++) {
    const actions = rules.legalActions(state, turnSeat(state)!) as Action[];
    const action =
      actions.find(
        (entry) => entry.type === 'pass' || entry.type === 'skip-share',
      ) ??
      actions.find(
        (entry) =>
          entry.type === 'setup' &&
          entry.positions.every((position) => position === 3),
      ) ??
      actions[0];
    if (!action)
      throw new Error('No legal action reaches the settlement fixture');
    state = apply(state, action);
  }
  expect(state.phase).toBe('round-result');
  return state;
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
  it('opens one in-page voyage result with a merchant details row on all three roles', () => {
    const state = settledVoyage();
    expect(state.result?.finance).toBeDefined();
    for (const role of ['host', 'public', 'player'] as const) {
      const { html, text } = render(state, role, 'C');
      expect(html.match(/class="mn-voyage-result"/g)).toHaveLength(1);
      expect(html).toContain('class="mn-result-toggle" aria-expanded="true"');
      expect(html).toContain('class="mn-result-body"');
      expect(html.match(/class="mn-result-merchant"/g)).toHaveLength(
        ids.length,
      );
      expect(html).not.toContain('class="mn-result-legacy"');
      for (const id of ids) expect(html).toContain(`data-seat-id="${id}"`);
      expect(text).toContain('现金净变化');
      expect(text).toContain('抵押借入');
      expect(text).toContain('赎回支出');
      if (role === 'player')
        expect(html.indexOf('data-seat-id="C"')).toBeLessThan(
          html.indexOf('data-seat-id="A"'),
        );
      else expect(html).not.toContain('class="mn-private"');
    }
    expect(render(fresh(), 'public').html).not.toContain(
      'class="mn-voyage-result"',
    );
  });

  it('keeps operating income and expenses separate from borrowing, redemption and net cash change', () => {
    const game = rules.project(settledVoyage(), {
      role: 'public',
    }) as ManilaView;
    // This is a controlled presentation fixture, not a claim of a natural financed match.
    game.result!.finance!.players.A = {
      openingCash: 30,
      closingCash: 50,
      income: { cargo: 18, piracy: 6, port: 8, shipyard: 0, insurance: 10 },
      expenses: { auction: 5, shares: 4, placement: 7, insurance: 3 },
      borrowed: 12,
      redeemed: 15,
    };
    const html = renderToStaticMarkup(
      createElement(VoyageResultCard, {
        game,
        seats: ids.map((id, index) => ({
          id,
          name: names[index]!,
          avatarId: 'avatar-1' as const,
        })),
      }),
    );
    const merchant = html.match(
      /<details class="mn-result-merchant" data-seat-id="A">([\s\S]*?)<\/details>/,
    )![1]!;
    const summary = merchant.match(/<summary>([\s\S]*?)<\/summary>/)![1]!;
    expect(summary).toContain('<span>收入</span><b>42 ₱</b>');
    expect(summary).toContain('<span>支出</span><b>19 ₱</b>');
    expect(summary).toContain('data-mn-net="20"');
    expect(summary).toContain('<b>+20 ₱</b>');
    expect(merchant).toContain('<dt>抵押借入</dt><dd>12 ₱</dd>');
    expect(merchant).toContain('<dt>赎回支出</dt><dd>15 ₱</dd>');
    expect(merchant).toContain('<dt>期初现金</dt><dd>30 ₱</dd>');
    expect(merchant).toContain('<dt>期末现金</dt><dd>50 ₱</dd>');
  });

  it('renders older results honestly without inventing a full-voyage ledger', () => {
    const state = settledVoyage();
    delete state.result!.finance;
    delete state.voyageFinance;
    const { html, text } = render(validateState(state, ids), 'public');
    expect(html).toContain('class="mn-result-legacy"');
    expect(text).toContain('未记录本航次完整收支');
    expect(html).not.toContain('class="mn-result-breakdown"');
    expect(html).not.toContain('<span>现金净变化</span>');
    expect(text).toContain('旧记录不补算收入、支出及全航次现金净变化');
    for (const id of ids)
      expect(html).toContain(`data-mn-net="${state.result!.income[id]}"`);
  });

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
      const offset = (index < 2 ? 200 : 199) - original[id]!;
      state.players[id]!.cash += offset;
      // Shift both boundaries of the controlled cash fixture equally so its
      // recorded transfers and closing-balance invariants remain intact.
      for (const finance of new Set([
        state.voyageFinance,
        state.result?.finance,
      ])) {
        if (!finance) continue;
        finance.players[id]!.openingCash += offset;
        finance.players[id]!.closingCash += offset;
      }
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
    // This controlled tie never trades a share, so the racks stay without
    // revealed certificates; the player's own vault entry must still mount.
    const player = render(state, 'player', 'A');
    expect(player.html).toContain('aria-label="本人财富与秘密股份"');
    expect(player.text).not.toContain('（抵押）');
  });

  it('uses the manifest for an empty player lane instead of the retired text block', () => {
    const { text } = render(fresh(), 'player', 'A');
    expect(text).toContain('待装货');
    expect(text).not.toContain('等待装船');
    expect(text).not.toMatch(/船员\s+\d+/);
  });

  it('keeps a host lane meta block and a merchant rack for three merchants', () => {
    const { html } = render(fresh(), 'host');
    expect(html).toContain('class="mn-lane-meta"');
    expect(html).toContain('class="mn-merchant-rack"');
    expect(
      html.match(/class="mn-detail-button mn-merchant-card/g),
    ).toHaveLength(3);
    expect(html).toContain('class="mn-merchant-name"');
    expect(html).toContain('class="mn-merchant-assets"');
  });
});
