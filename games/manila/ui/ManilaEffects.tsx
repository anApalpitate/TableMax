import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  claimAudioEvent,
  useAudioOutput,
  type GameHost,
} from '@tablemax/web-host';
import type { ManilaView } from '../rules/view';
import {
  cueFor,
  feedbackKey,
  SavedFeedback,
  type ManilaCue,
} from './presentation';
import wood from '../../../assets/games/manila/audio/wood-v1.flac';
import coin from '../../../assets/games/manila/audio/coin-v1.flac';
import dice from '../../../assets/games/manila/audio/dice-v1.flac';
import water from '../../../assets/games/manila/audio/water-v1.flac';
import bell from '../../../assets/games/manila/audio/bell-v1.flac';
import dock from '../../../assets/games/manila/audio/dock-v1.flac';
import boarding from '../../../assets/games/manila/audio/boarding-v1.flac';
import repair from '../../../assets/games/manila/audio/repair-v1.flac';
import pirate from '../../../assets/games/manila/audio/pirate-v1.flac';
import celebration from '../../../assets/games/manila/audio/celebration-v1.flac';
import boatImage from '../../../assets/games/manila/boat-v1.webp';
import { seatColors } from './labels';
import './effects.css';

const sources: Record<ManilaCue, string> = {
  wood,
  coin,
  dice,
  water,
  bell,
  dock,
  boarding,
  repair,
  pirate,
  celebration,
};
const preferenceEvent = 'manila-sound-preference';
function preference(key: string, player: boolean) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? !player : value !== 'true';
  } catch {
    return !player;
  }
}

/** Decorative feedback reads saved public motion and public component IDs only. */
function localPresentation(
  root: Element,
  motion: string[],
  game: ManilaView | null,
  reduced: boolean,
) {
  const marked = new Map<HTMLElement, string | null>();
  const particles: HTMLElement[] = [];
  const animations: Animation[] = [];
  const visible = (element: Element | null) => {
    const box = element?.getBoundingClientRect();
    return box &&
      box.width &&
      box.height &&
      box.bottom > 0 &&
      box.top < innerHeight &&
      box.right > 0 &&
      box.left < innerWidth
      ? box
      : null;
  };
  const mark = (element: HTMLElement | null, kind: string) => {
    if (!element || !visible(element)) return;
    if (!marked.has(element))
      marked.set(element, element.getAttribute('data-mn-local-effect'));
    const previous = element.getAttribute('data-mn-local-effect') ?? '';
    element.setAttribute(
      'data-mn-local-effect',
      `${previous} ${kind}${reduced ? ' still' : ''}`.trim(),
    );
  };
  const fly = (
    from: Element | null,
    to: HTMLElement | null,
    element: HTMLElement,
    kind: string,
    delay = 0,
  ) => {
    const end = visible(to);
    if (reduced || !end) return;
    const start = visible(from);
    const x = start ? start.left + start.width / 2 : end.left + end.width / 2;
    const y = start ? start.top + start.height / 2 : end.top - 24;
    element.className = `mn-local-particle mn-local-particle--${kind}`;
    element.setAttribute('aria-hidden', 'true');
    element.style.left = `${x}px`;
    element.style.top = `${y}px`;
    document.body.appendChild(element);
    particles.push(element);
    if (element.animate)
      animations.push(
        element.animate(
          [
            { transform: 'translate(-50%, -50%) scale(.55)', opacity: 0 },
            { offset: 0.15, opacity: 1 },
            {
              offset: 0.72,
              transform: `translate(calc(${end.left + end.width / 2 - x}px - 50%), calc(${end.top + end.height / 2 - y}px - 50%)) scale(1)`,
              opacity: 1,
            },
            {
              transform: `translate(calc(${end.left + end.width / 2 - x}px - 50%), calc(${end.top + end.height / 2 - y}px - 50%)) scale(.8)`,
              opacity: 0,
            },
          ],
          {
            duration: 900,
            delay,
            easing: 'cubic-bezier(.2,.7,.3,1)',
            fill: 'both',
          },
        ),
      );
  };
  const boatFor = (cargo: string) =>
    root.querySelector<HTMLElement>(
      `.mn-boat[data-mn-cargo="${CSS.escape(cargo)}"]`,
    );
  for (const event of motion) {
    const [, kind, target] = event.split(':');
    if (kind === 'setup' || kind === 'sail') {
      root
        .querySelectorAll<HTMLElement>('.mn-lane[data-mn-cargo]')
        .forEach((lane, index) => {
          const cargo = lane.dataset.mnCargo!;
          const boat = boatFor(cargo);
          if (kind === 'setup') {
            mark(boat, 'load');
            const art = lane.querySelector<HTMLImageElement>('.mn-cargo-art');
            if (art)
              fly(
                art,
                boat,
                art.cloneNode(true) as HTMLImageElement,
                'cargo',
                index * 100,
              );
          } else {
            mark(lane.querySelector<HTMLElement>('.mn-die'), 'dice');
            if (
              game?.boats.some(
                (entry) => entry.cargo === cargo && entry.destination === 'sea',
              ) ||
              motion.includes(`manila:arrive:${cargo}`) ||
              motion.includes(`manila:repair:${cargo}`)
            )
              mark(boat, 'wake');
          }
        });
    } else if (kind === 'place' && target) {
      const space = game?.spaces.find((entry) => entry.id === target);
      const destination =
        root.querySelector<HTMLElement>(
          `[data-mn-space="${CSS.escape(target)}"]`,
        ) ?? (space?.cargo ? boatFor(space.cargo) : null);
      mark(destination, 'place');
      if (space?.occupant) {
        const number = game!.seatOrder.indexOf(space.occupant);
        const worker = document.createElement('span');
        worker.textContent = String(number + 1);
        worker.style.setProperty(
          '--mn-worker-color',
          seatColors[number] ?? '#315a7f',
        );
        const source =
          space.cargo && motion.includes(`manila:board:${space.cargo}`)
            ? root.querySelector('.mn-specialist-group--pirate')
            : root.querySelector(
                `[data-mn-player="${CSS.escape(space.occupant)}"]`,
              );
        fly(source, destination, worker, 'worker');
      }
    } else if (
      target &&
      ['arrive', 'repair', 'board', 'pilot', 'plunder'].includes(kind ?? '')
    ) {
      mark(boatFor(target), kind!);
      if (kind === 'pilot') mark(boatFor(target), 'wake');
      if (kind === 'repair')
        mark(
          root.querySelector<HTMLElement>(
            '.mn-dock-group:nth-child(2) .mn-site-art',
          ),
          'repair',
        );
      if (kind === 'arrive')
        mark(
          root.querySelector<HTMLElement>(
            '.mn-dock-group:first-child .mn-site-art',
          ),
          'arrive',
        );
      if (kind === 'board')
        mark(
          root.querySelector<HTMLElement>(
            '.mn-specialist-group--pirate .mn-site-art',
          ),
          'board',
        );
    } else if (kind === 'market' && target) {
      mark(
        root.querySelector<HTMLElement>(
          `.mn-market-row[data-mn-cargo="${CSS.escape(target)}"] .mn-current-price`,
        ),
        'market',
      );
    } else if (kind?.startsWith('insurance')) {
      mark(root.querySelector<HTMLElement>('[data-mn-insurance]'), kind);
    }
  }
  const dispose = () => {
    animations.forEach((animation) => animation.cancel());
    particles.forEach((particle) => particle.remove());
    marked.forEach((previous, element) => {
      if (previous === null) element.removeAttribute('data-mn-local-effect');
      else element.setAttribute('data-mn-local-effect', previous);
    });
  };
  const hide = () => {
    if (document.hidden) dispose();
  };
  document.addEventListener('visibilitychange', hide);
  return () => {
    document.removeEventListener('visibilitychange', hide);
    dispose();
  };
}

export function ManilaEffects({ session }: { session: GameHost }) {
  const { view, feedback, motion, connected, role } = session;
  const game = view?.gameView as ManilaView | null;
  const player = role === 'player';
  const muteKey = player
    ? 'tablemax-manila-player-sound-muted'
    : 'tablemax-sound-muted';
  const [enabled, setEnabled] = useState(() => preference(muteKey, player));
  const [unlocked, setUnlocked] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const canPlay = useAudioOutput();
  const disabled =
    !connected ||
    !view ||
    view.paused ||
    !!view.botError ||
    view.playMode === 'test';
  const fresh =
    !!feedback &&
    feedback.instanceId === view?.instanceId &&
    feedback.branch === view.branch &&
    feedback.revision === view.revision;
  const active = !disabled && fresh && motion.length > 0;
  const media = useRef<HTMLAudioElement | null>(null);
  const control = useRef<HTMLButtonElement | null>(null);
  const seen = useRef(new SavedFeedback(feedback));
  const generation = useRef(0);
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'none';
    media.current = audio;
    const hide = () => {
      if (document.hidden) {
        generation.current++;
        audio.pause();
      }
    };
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReduced(query.matches);
    query.addEventListener('change', change);
    document.addEventListener('visibilitychange', hide);
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- Invalidate asynchronous sound claims on unmount.
      generation.current++;
      document.removeEventListener('visibilitychange', hide);
      query.removeEventListener('change', change);
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      media.current = null;
    };
  }, []);
  useEffect(() => {
    const change = () => setEnabled(preference(muteKey, player));
    window.addEventListener('storage', change);
    window.addEventListener(preferenceEvent, change);
    return () => {
      window.removeEventListener('storage', change);
      window.removeEventListener(preferenceEvent, change);
    };
  }, [muteKey, player]);
  useEffect(() => {
    generation.current++;
    media.current?.pause();
  }, [
    feedback?.instanceId,
    feedback?.branch,
    feedback?.revision,
    view?.revision,
    disabled,
    canPlay,
  ]);
  useEffect(() => {
    if (!enabled) {
      generation.current++;
      media.current?.pause();
    }
  }, [enabled]);
  useEffect(() => {
    if (!seen.current.accept(feedback)) return;
    if (
      !active ||
      !enabled ||
      !canPlay ||
      document.hidden ||
      (player && !unlocked)
    )
      return;
    const cue = cueFor(motion);
    if (!cue || !feedback) return;
    const permit = ++generation.current;
    void Promise.resolve(player ? true : claimAudioEvent(feedbackKey(feedback)))
      .then((accepted) => {
        const audio = media.current;
        if (
          !accepted ||
          permit !== generation.current ||
          !audio ||
          document.hidden
        )
          return;
        audio.pause();
        audio.src = sources[cue];
        audio.volume = 0.55;
        audio.muted = false;
        void audio.play().then(
          () => {
            if (permit === generation.current) setBlocked(false);
          },
          () => {
            if (permit === generation.current) setBlocked(true);
          },
        );
      })
      .catch(() => undefined);
  }, [feedback, active, enabled, canPlay, player, unlocked, motion]);
  useEffect(() => {
    if (!active || document.hidden) return;
    const root = control.current?.closest('.mn-screen');
    if (!root) return;
    const release = localPresentation(root, motion, game, reduced);
    if (reduced) return release;
    const animations: Animation[] = [];
    const coins: HTMLElement[] = [];
    if (
      motion.includes('manila:result') ||
      motion.includes('manila:insurance-income') ||
      motion.includes('manila:insurance-pay')
    ) {
      const insuranceIncome = motion.includes('manila:insurance-income');
      const insurancePay = motion.includes('manila:insurance-pay');
      const seat =
        insuranceIncome || insurancePay
          ? game?.spaces.find((space) => space.kind === 'insurance')?.occupant
          : game?.seatOrder.find((id) => (game.result?.income[id] ?? 0) > 0);
      const owner = seat
        ? (root.querySelector(`[data-mn-wallet="${CSS.escape(seat)}"]`) ??
          root.querySelector(`[data-mn-player="${CSS.escape(seat)}"]`))
        : null;
      const from = insurancePay
        ? owner
        : root.querySelector(
            insuranceIncome ? '[data-mn-insurance]' : '.mn-harbor',
          );
      const to = insurancePay
        ? root.querySelector('.mn-dock-group:nth-child(2)')
        : owner;
      if (from && to) {
        const start = from.getBoundingClientRect(),
          end = to.getBoundingClientRect();
        for (let i = 0; i < 5; i++) {
          const coin = document.createElement('i');
          coin.className = 'mn-fx-coin';
          coin.style.left = `${start.left + start.width / 2}px`;
          coin.style.top = `${Math.max(0, Math.min(innerHeight, start.top + start.height / 2))}px`;
          document.body.appendChild(coin);
          coins.push(coin);
          if (coin.animate)
            animations.push(
              coin.animate(
                [
                  { transform: 'translate(-50%, -50%) scale(.5)', opacity: 0 },
                  { offset: 0.2, opacity: 1 },
                  {
                    transform: `translate(${end.left + end.width / 2 - start.left - start.width / 2}px, ${end.top + end.height / 2 - Math.max(0, Math.min(innerHeight, start.top + start.height / 2))}px) scale(.8)`,
                    opacity: 0,
                  },
                ],
                {
                  duration: 680,
                  delay: i * 65,
                  easing: 'cubic-bezier(.2,.65,.45,1)',
                  fill: 'both',
                },
              ),
            );
        }
      }
    }
    return () => {
      release();
      animations.forEach((animation) => animation.cancel());
      coins.forEach((coin) => coin.remove());
    };
  }, [active, motion, reduced, view?.revision, game]);
  const has = (kind: string) =>
    motion.some(
      (value) =>
        value === `manila:${kind}` || value.startsWith(`manila:${kind}:`),
    );
  const scene = !active
    ? null
    : has('ended')
      ? 'ended'
      : has('plunder')
        ? 'pirate'
        : has('setup') || has('voyage')
          ? 'voyage'
          : has('auction')
            ? 'auction'
            : has('result')
              ? 'result'
              : null;
  const title =
    scene === 'ended'
      ? '最终财富揭晓'
      : scene === 'pirate'
        ? '海盗登临'
        : scene === 'auction'
          ? '港务长就任'
          : scene === 'result'
            ? '航次结算'
            : '扬帆启航';
  const audible = enabled && !disabled && !blocked && (!player || unlocked);
  const label = disabled
    ? '测试或暂停中，提示音关闭'
    : blocked || (player && enabled && !unlocked)
      ? '点击启用提示音'
      : enabled
        ? '提示音已开启，点击静音'
        : '提示音已静音，点击开启';
  const unlock = () => {
    const audio = media.current;
    if (!audio) return;
    const permit = ++generation.current;
    // Silent media unlock consumes no old game event and emits no test sound.
    audio.pause();
    audio.src = wood;
    audio.muted = true;
    void audio.play().then(
      () => {
        if (permit !== generation.current || media.current !== audio) return;
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        setUnlocked(true);
        setBlocked(false);
      },
      () => {
        if (permit === generation.current) {
          audio.muted = false;
          setBlocked(true);
        }
      },
    );
  };
  return (
    <>
      <button
        ref={control}
        type="button"
        className="mn-audio-control"
        data-manila-sound
        aria-label={label}
        title={label}
        aria-pressed={audible}
        disabled={disabled}
        onClick={() => {
          if (enabled && (blocked || (player && !unlocked))) {
            unlock();
            return;
          }
          const next = !enabled;
          setEnabled(next);
          try {
            localStorage.setItem(muteKey, String(!next));
            window.dispatchEvent(new Event(preferenceEvent));
          } catch {
            /* Local window preference still works. */
          }
          if (next) unlock();
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 9v6h4l5 4V5L8 9Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          {audible ? (
            <path
              d="M16 8q4 4 0 8m3-11q7 7 0 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          ) : (
            <path
              d="m17 9 5 6m0-6-5 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          )}
        </svg>
      </button>
      {scene &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className={`mn-fx mn-fx--${scene}${reduced ? ' mn-fx--reduced' : ''}`}
            data-manila-scene={scene}
            aria-hidden="true"
            key={`${feedbackKey(feedback)}:${scene}`}
          >
            <div className="mn-fx__rays" />
            <div className="mn-fx__fleet">
              {[0, 1, 2].map((index) => (
                <img
                  key={index}
                  src={boatImage}
                  alt=""
                  style={{ '--fleet-index': index } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="mn-fx__seal">
              <span>
                {scene === 'pirate' ? '⚑' : scene === 'ended' ? '✦' : '⚓'}
              </span>
              <strong>{title}</strong>
              <p>
                {scene === 'ended' && game ? (
                  game.winners
                    .map(
                      (seat) =>
                        view?.seats.find((entry) => entry.id === seat)?.name ??
                        '商人',
                    )
                    .join('、')
                ) : scene === 'result' && game?.result ? (
                  <>
                    <span className="mn-scene-fact">
                      {game.result.port.length} 船靠港
                    </span>{' '}
                    <span className="mn-scene-fact">
                      {game.result.shipyard.length} 船入坞
                    </span>
                  </>
                ) : (
                  '已保存的港湾结果'
                )}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
