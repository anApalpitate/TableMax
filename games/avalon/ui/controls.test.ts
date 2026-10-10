import { createElement, type ReactNode } from 'react';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { initialize } from '../rules/engine';
import { project } from '../rules/project';
import { PlayerControls } from './PlayerControls';
import { Council } from './Board';
import type { GameHost } from '@tablemax/web-host';

const { renderToStaticMarkup } = createRequire(
  new URL('../../../apps/web/package.json', import.meta.url),
)('react-dom/server') as { renderToStaticMarkup(node: ReactNode): string };

const ids = ['a', 'b', 'c', 'd', 'e'];
const names = Object.fromEntries(ids.map((id) => [id, `同伴${id}`]));
const state = () => initialize({ seats: ids, random: { next: () => 0.25 } });
const seats: NonNullable<GameHost['view']>['seats'] = ids.map((id) => ({
  id,
  name: names[id]!,
  avatarId: 'avatar-1',
  controller: 'human',
  ready: true,
  online: true,
  botDifficulty: null,
}));

describe('Avalon authorized controls and secret protection', () => {
  it('shows only the authorized success card for a loyal player, without role or knowledge', () => {
    const view = project(state(), { role: 'player', seatId: 'a' });
    view.phase = 'quest';
    const markup = renderToStaticMarkup(
      createElement(PlayerControls, {
        game: view,
        actions: [{ type: 'quest-card', card: 'success' }],
        selected: [],
        locked: false,
        names,
        choose() {},
        showIdentity() {},
      }),
    );
    expect(markup).toContain('data-av-action="quest-success"');
    expect(markup).not.toContain('data-av-action="quest-fail"');
    expect(markup).not.toContain('data-role=');
    expect(markup).not.toContain('梅林');
  });
  it('requires an exact legal team before nomination, regardless of selection order', () => {
    const view = project(state(), { role: 'player', seatId: 'a' });
    view.phase = 'team';
    const render = (selected: string[]) =>
      renderToStaticMarkup(
        createElement(PlayerControls, {
          game: view,
          actions: [{ type: 'propose-team', team: ['a', 'b'] }],
          selected,
          locked: false,
          names,
          choose() {},
          showIdentity() {},
        }),
      );
    expect(render(['b', 'a'])).not.toMatch(
      /data-av-action="propose"[^>]*disabled/,
    );
    expect(render(['a'])).toMatch(/data-av-action="propose"[^>]*disabled/);
    expect(render(['a', 'c'])).toMatch(/data-av-action="propose"[^>]*disabled/);
  });
  it('keeps the public council read-only and never renders private identities', () => {
    const view = project(state(), { role: 'player', seatId: 'a' });
    const markup = renderToStaticMarkup(
      createElement(Council, {
        game: view,
        seats,
        selected: [],
        selectable: [],
        toggle() {},
      }),
    );
    expect(markup.match(/disabled=""/g)).toHaveLength(5);
    expect(markup).not.toContain('data-role=');
    expect(markup).not.toContain('梅林');
    expect(markup).not.toContain('刺客');
  });
});
