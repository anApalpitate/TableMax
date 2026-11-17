import type { GameHost } from '@tablemax/web-host';

const sounds = import.meta.glob<string>(
  '../../../assets/games/ra/audio/*.flac',
  {
    eager: true,
    query: '?url',
    import: 'default',
  },
);

export function raSound(cue: string) {
  return sounds[`../../../assets/games/ra/audio/${cue}.flac`];
}

export function liveRaFeedback(session: GameHost) {
  const feedback = session.feedback;
  const view = session.view;
  if (
    view &&
    feedback &&
    session.connected &&
    !view.paused &&
    view.playMode === 'play' &&
    view.instanceId === feedback.instanceId &&
    view.branch === feedback.branch &&
    view.revision === feedback.revision
  )
    return feedback;
}
