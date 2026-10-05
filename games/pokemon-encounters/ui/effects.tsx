import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  type CSSProperties,
} from 'react';
import type { PokemonView } from '../rules/project';
import {
  creatureArt,
  coinArt,
} from '../../../assets/games/pokemon-encounters/catalog';
import { drawMotifs, effectScene } from './effect-scene';
import { SavedMotion } from './motion';
import type {
  PublicAction,
  RoomFeedback,
} from '../../../packages/protocol/src';
import { actionEffects } from './presentation-state';
import './effects.css';
import { AbilityEntrance } from './AbilityEntrance';
import { abilityEntrances } from '../variants/original-presentation';

const titles = {
  mew: '梦幻 念力交换',
  zapdos: '闪电鸟 接力传牌',
  snorlax: '卡比兽 两牌交换',
  charizard: '喷火龙 火焰窥探',
  rocket: '火箭队 突袭',
};
const marks = {
  mew: '✧',
  zapdos: 'ϟ',
  snorlax: '⇄',
  charizard: '♨',
  rocket: 'R',
};

type Point = { x: number; y: number };
const svgNamespace = 'http://www.w3.org/2000/svg';

/** Measure decoration from rendered, authorized targets; never reconstruct a hidden face. */
function SavedActionTrails({
  game,
  action,
  result,
}: {
  game: PokemonView;
  action: PublicAction | undefined;
  result: boolean;
}) {
  const surface = useRef<SVGSVGElement>(null);
  const clipPrefix = useId().replace(/:/g, '');
  const theme = actionEffects(action, game).theme;
  useLayoutEffect(() => {
    const svg = surface.current;
    const table = svg?.closest('.game-table');
    if (!svg || !table) return;
    svg.replaceChildren();
    if (
      table.closest<HTMLElement>('.pokemon-screen')?.dataset.playMode ===
        'test' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return;
    const bounds = svg.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const visibleRect = (element: Element | null | undefined) => {
      if (
        !element ||
        !element.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true,
        })
      )
        return null;
      const rect = element.getBoundingClientRect();
      // Omit offscreen targets; a phone must never draw through an unopened friend panel.
      if (
        !rect.width ||
        !rect.height ||
        rect.right <= bounds.left ||
        rect.left >= bounds.right ||
        rect.bottom <= bounds.top ||
        rect.top >= bounds.bottom
      )
        return null;
      return rect;
    };
    const point = (element: Element | null | undefined): Point | null => {
      const rect = visibleRect(element);
      return rect
        ? {
            x: rect.left + rect.width / 2 - bounds.left,
            y: rect.top + rect.height / 2 - bounds.top,
          }
        : null;
    };
    const node = (
      tag: string,
      attributes: Record<string, string | number>,
      parent: Element = svg,
    ) => {
      const item = document.createElementNS(svgNamespace, tag);
      for (const [name, value] of Object.entries(attributes))
        item.setAttribute(name, String(value));
      parent.append(item);
      return item;
    };
    const trail = (from: Point | null, to: Point | null, reverse = false) => {
      if (!from || !to) return;
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      if (distance < 8) return;
      const bend = Math.min(72, distance * 0.16) * (reverse ? -1 : 1);
      const control = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - bend };
      node('path', {
        class: `saved-trail ${theme === 'zapdos' ? 'electric-trail' : ''}`,
        d: `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`,
        pathLength: 1,
        fill: 'none',
      });
      for (let i = 0; i < 4; i++) {
        const t = (i + 1) / 5;
        const x =
          (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t ** 2 * to.x;
        const y =
          (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t ** 2 * to.y;
        node('path', {
          class: 'trail-glint',
          d: `M ${x - 4} ${y} H ${x + 4} M ${x} ${y - 4} V ${y + 4}`,
          style: `animation-delay:${i * 60 + 50}ms`,
        });
      }
    };
    const burst = (element: Element | null | undefined, compact = false) => {
      const rect = visibleRect(element);
      if (!rect) return;
      const x = rect.left - bounds.left,
        y = rect.top - bounds.top;
      node('rect', {
        class: 'target-impact',
        x: x - 3,
        y: y - 3,
        width: rect.width + 6,
        height: rect.height + 6,
        rx: 10,
        fill: 'none',
      });
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3;
        const px = x + rect.width / 2 + Math.cos(angle) * (rect.width / 2 + 6);
        const py =
          y + rect.height / 2 + Math.sin(angle) * (rect.height / 2 + 6);
        const dx = Math.cos(angle) * (compact ? 12 : 20);
        const dy = Math.sin(angle) * (compact ? 12 : 20);
        node('circle', {
          class: 'target-mote',
          cx: px,
          cy: py,
          r: i % 2 ? 2 : 3,
          style: `--mote-x:${dx}px;--mote-y:${dy}px;animation-delay:${i * 22}ms`,
        });
      }
    };
    if (result) {
      const defs = node('defs', {});
      const gradient = node(
        'linearGradient',
        { id: `${clipPrefix}-shine` },
        defs,
      );
      node(
        'stop',
        { offset: '0', 'stop-color': '#fff7c5', 'stop-opacity': 0 },
        gradient,
      );
      node(
        'stop',
        { offset: '.5', 'stop-color': '#fff7c5', 'stop-opacity': 0.65 },
        gradient,
      );
      node(
        'stop',
        { offset: '1', 'stop-color': '#fff7c5', 'stop-opacity': 0 },
        gradient,
      );
      for (const [index, board] of [
        ...table.querySelectorAll('.game-seat.winner .pokemon-board'),
      ].entries()) {
        const rect = visibleRect(board);
        if (!rect) continue;
        const x = rect.left - bounds.left,
          y = rect.top - bounds.top;
        const clip = node(
          'clipPath',
          { id: `${clipPrefix}-winner-${index}` },
          defs,
        );
        node(
          'rect',
          { x, y, width: rect.width, height: rect.height, rx: 12 },
          clip,
        );
        const clipped = node('g', {
          'clip-path': `url(#${clipPrefix}-winner-${index})`,
        });
        node(
          'rect',
          {
            class: 'winner-board-sweep',
            x: x - rect.width,
            y,
            width: rect.width,
            height: rect.height,
            fill: `url(#${clipPrefix}-shine)`,
            style: `--sweep-width:${rect.width * 2}px`,
          },
          clipped,
        );
        node('rect', {
          class: 'winner-board-halo',
          x: x - 4,
          y: y - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          rx: 14,
          fill: 'none',
        });
        for (const [sx, sy] of [
          [x, y],
          [x + rect.width, y + rect.height],
        ])
          node('path', {
            class: 'winner-corner-glint',
            d: `M ${sx! - 8} ${sy} H ${sx! + 8} M ${sx} ${sy! - 8} V ${sy! + 8}`,
          });
      }
      return;
    }
    if (!action) return;
    const held =
      table.querySelector('.held-pile .pokemon-card') ??
      table.querySelector('.held-zone');
    const pile = (source: 'deck' | 'discard') =>
      table.querySelector(
        `.card-piles > div:nth-child(${source === 'deck' ? 1 : 2}) .pokemon-card, .card-piles > div:nth-child(${source === 'deck' ? 1 : 2}) .empty-pile`,
      );
    const slots = new Map(
      [...table.querySelectorAll<HTMLElement>('[data-slot]')].map((slot) => [
        slot.dataset.slot,
        slot.querySelector('.card-surface'),
      ]),
    );
    const targets = action.targets
      .flatMap(({ seat, slots: positions }) =>
        positions.map((slot) => slots.get(`${seat}:${slot}`)),
      )
      .filter((target): target is Element => Boolean(target))
      .slice(0, 6);
    switch (action.verb) {
      case 'draw':
        if (action.source) trail(point(pile(action.source)), point(held));
        burst(held, true);
        if (action.cardCategory && drawMotifs[action.cardCategory]) {
          const center = point(held);
          if (center)
            for (let i = 0; i < 7; i++) {
              const angle = (i / 7) * Math.PI * 2;
              const mark = node('text', {
                class: `draw-motif motif-${drawMotifs[action.cardCategory]}`,
                x: center.x,
                y: center.y,
                'text-anchor': 'middle',
                style: `--mote-x:${Math.cos(angle) * 44}px;--mote-y:${Math.sin(angle) * 44}px;animation-delay:${i * 18}ms`,
              });
              mark.textContent =
                (
                  {
                    electric: 'ϟ',
                    song: '♪',
                    star: '✧',
                    leaf: '❧',
                    water: '●',
                    mist: '✦',
                  } as Record<string, string>
                )[drawMotifs[action.cardCategory]!] ?? '';
            }
        }
        break;
      case 'mew-target':
        trail(point(targets[0]), point(held));
        break;
      case 'replace':
      case 'zapdos-pass':
        trail(point(held), point(targets[0]));
        break;
      case 'discard':
        trail(point(held), point(pile('discard')));
        burst(pile('discard'), true);
        break;
      case 'swap':
        trail(point(targets[0]), point(targets[1]));
        trail(point(targets[1]), point(targets[0]), true);
        break;
    }
    // Shared-slot Rocket refill uses only these bounded local impacts, never six long cross-table paths.
    if (theme || ['replace', 'zapdos-pass'].includes(action.verb))
      for (const target of targets)
        burst(target, action.verb === 'rocket-refill');
  }, [action, clipPrefix, game, result, theme]);
  return (
    <svg
      ref={surface}
      className={`saved-action-trails ${result ? 'winner-trails' : `trail-theme-${theme ?? 'ordinary'}`}`}
      aria-hidden="true"
    />
  );
}

/** Decoration only: outcomes and targets come from saved, authorized information. */
export function SavedEffects({
  game,
  feedback = null,
}: {
  game: PokemonView;
  feedback?: RoomFeedback | null;
  names?: Record<string, string>;
}) {
  const motion = useContext(SavedMotion);
  const saved = motion.includes('@saved');
  const result = motion.includes('@result');
  const action = feedback?.events.at(-1)?.action ?? game.events.at(-1)?.action;
  const effects = actionEffects(action, game);
  const theme = motion.includes('@saved') ? effects.theme : undefined;
  const coin = motion.includes('@coin') ? effects.coin : null;
  const rocketReturn =
    motion.includes('@saved') && effects.rocketReturns.length > 0;
  const scene = saved || result ? effectScene(action, game, result) : null;
  if (!result && !saved && !coin && !theme) return null;
  const match = result && game.matchWinners.length > 0;
  return (
    <>
      {scene &&
        scene.theme !== 'result' &&
        (scene.theme === 'mew' ||
          scene.theme === 'zapdos' ||
          scene.theme === 'rocket') && (
          <AbilityEntrance
            definition={abilityEntrances[scene.theme]}
            image={creatureArt(abilityEntrances[scene.theme].resource).image}
          />
        )}
      {(saved || result) && (
        <SavedActionTrails game={game} action={action} result={result} />
      )}
      {(result || coin || scene || rocketReturn) && (
        <div
          className={`saved-effects ${result ? 'result-effects' : coin ? 'coin-effects' : `ability-effects theme-${theme}`} ${match ? 'match-fireworks' : ''}`}
          aria-hidden="true"
        >
          {result ? (
            <>
              {Array.from({ length: match ? 5 : 2 }, (_, burst) => (
                <div
                  className="firework-burst"
                  key={burst}
                  style={
                    {
                      '--burst-x': `${[18, 78, 48, 32, 88][burst]}%`,
                      '--burst-y': `${[26, 30, 15, 65, 63][burst]}%`,
                      '--burst-delay': `${burst * 110}ms`,
                    } as CSSProperties
                  }
                >
                  {Array.from({ length: 12 }, (_, spark) => (
                    <i
                      key={spark}
                      className="firework-spark"
                      style={
                        {
                          '--angle': `${spark * 30}deg`,
                          '--spark-color': ['#ffd85c', '#83e7ec', '#ff9ac7'][
                            burst % 3
                          ],
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              ))}
            </>
          ) : coin ? (
            <>
              <div className="effect-ring" />
              <span className="tossed-coin">
                <img src={coinArt[coin]} alt="" />
              </span>
              <span className="coin-effect-label">
                {coin === 'meowth' ? '喵喵面' : '皮卡丘面'}
              </span>
            </>
          ) : theme ? (
            <div className="ability-toast">
              <span className="ability-toast-mark">
                {rocketReturn ? 'R' : marks[theme]}
              </span>
              <strong>
                {rocketReturn ? '我还会再回来的！' : titles[theme]}
              </strong>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
