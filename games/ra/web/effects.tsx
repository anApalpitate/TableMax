import { useEffect, useRef, type CSSProperties } from 'react';
import {
  claimAudioEvent,
  useAudioOutput,
  type GameHost,
} from '@tablemax/web-host';
import type { RaView } from '../rules';
import { SunDisk } from './art';
import { liveRaFeedback } from './feedback';

const sounds = import.meta.glob<string>(
  '../../../assets/games/ra/audio/*.flac',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);

const priorities = [
  'final',
  'epoch',
  'disaster',
  'won',
  'clear',
  'hold',
  'open',
  'invoke',
  'god',
  'bid',
  'draw',
] as const;

export function RaEffects({
  session,
  game,
}: {
  session: GameHost;
  game?: RaView | null;
}) {
  const audioEnabled = useAudioOutput();
  const audio = useRef<HTMLAudioElement>(null);
  const feedback = liveRaFeedback(session);
  const cue = feedback
    ? priorities.find((value) =>
        feedback.events.some(({ kind }) => kind === 'ra-' + value),
      )
    : undefined;
  const key =
    feedback && cue
      ? `${feedback.instanceId}:${feedback.branch}:${feedback.revision}:${cue}`
      : '';
  const sound =
    cue &&
    sounds[
      `../../../assets/games/ra/audio/${cue === 'invoke' ? 'open' : cue}.flac`
    ];
  const audible = session.role === 'host' && audioEnabled;

  useEffect(() => {
    const element = audio.current;
    if (!audible || !key || !sound || !element) return;
    let cancelled = false;
    void Promise.resolve(claimAudioEvent(key))
      .then((claimed) => {
        if (cancelled || !claimed) return;
        element.src = sound;
        void element.play().catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      element.pause();
    };
  }, [audible, key, sound]);

  const stage = useRef<HTMLDivElement>(null);
  const winner = game?.lastAuction?.winner;
  const legacyFlight = !game?.scenes?.some((scene) => scene.kind === 'won');
  useEffect(() => {
    if (
      !key ||
      cue !== 'won' ||
      !winner ||
      session.role !== 'host' ||
      !legacyFlight
    )
      return;
    const layer = stage.current;
    const table = layer?.closest('.ra-table');
    const origin = table
      ?.querySelector('.ra-central-disk .ra-sun')
      ?.getBoundingClientRect();
    const destination = Array.from(
      table?.querySelectorAll<HTMLElement>('[data-ra-seat]') ?? [],
    )
      .find((card) => card.dataset.raSeat === winner)
      ?.getBoundingClientRect();
    if (!layer || !origin || !destination) return;
    layer.style.setProperty(
      '--ra-flight-x',
      `${origin.left + origin.width / 2}px`,
    );
    layer.style.setProperty(
      '--ra-flight-y',
      `${origin.top + origin.height / 2}px`,
    );
    layer.style.setProperty(
      '--ra-flight-dx',
      `${destination.left + destination.width / 2 - origin.left - origin.width / 2}px`,
    );
    layer.style.setProperty(
      '--ra-flight-dy',
      `${destination.top + 36 - origin.top - origin.height / 2}px`,
    );
    layer.dataset.flight = 'true';
  }, [cue, key, legacyFlight, session.role, winner]);

  return (
    <>
      {session.role === 'host' && <audio ref={audio} preload="none" />}
      {cue && (
        <div
          key={key}
          ref={stage}
          className="ra-effect"
          data-cue={cue === 'invoke' ? 'open' : cue}
          data-role={session.role}
          style={
            {
              '--ra-effect-time':
                cue === 'final'
                  ? '1300ms'
                  : cue === 'epoch'
                    ? '900ms'
                    : '500ms',
            } as CSSProperties
          }
          aria-hidden="true"
        >
          <span className="ra-effect-wash" />
          {cue === 'won' &&
            legacyFlight &&
            game?.lastAuction?.received != null && (
              <span className="ra-effect-flight">
                <SunDisk value={game.lastAuction.received} />
              </span>
            )}
        </div>
      )}
    </>
  );
}
