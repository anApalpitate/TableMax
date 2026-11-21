import { trackPlaybackVolume } from '@tablemax/web-host';
import { useEffect, useRef, type CSSProperties } from 'react';
import { claimAudioEvent, type GameHost } from '@tablemax/web-host';
import type { RaView } from '../rules';
import { SunDisk } from './art';
import { liveRaFeedback, raSound } from './feedback';

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
  audioEnabled,
}: {
  session: GameHost;
  game?: RaView | null;
  audioEnabled: boolean;
}) {
  const audio = useRef<HTMLAudioElement>(null);
  const feedback = liveRaFeedback(session);
  const structuredHost = session.role === 'host' && !!game?.scenes?.length;
  const cue =
    feedback && !structuredHost
      ? priorities.find((value) =>
          feedback.events.some(({ kind }) => kind === 'ra-' + value),
        )
      : undefined;
  const key =
    feedback && cue
      ? `${feedback.instanceId}:${feedback.branch}:${feedback.revision}:${cue}`
      : '';
  const sound = cue && raSound(cue === 'invoke' ? 'open' : cue);
  const audible = session.role === 'host' && audioEnabled;

  useEffect(() => {
    const element = audio.current;
    if (!audible || !key || !sound || !element) return;
    const untrackVolume = trackPlaybackVolume(element);
    let cancelled = false;
    void Promise.resolve(claimAudioEvent(key))
      .then((claimed) => {
        if (cancelled || !claimed) return;
        element.src = sound;
        void element.play().catch(() => {});
      })
      .catch(() => {});
    return () => {
      untrackVolume();
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
                  ? '1083ms'
                  : cue === 'epoch'
                    ? '750ms'
                    : '417ms',
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
