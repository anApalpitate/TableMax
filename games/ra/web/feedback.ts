import type { GameHost } from '@tablemax/web-host';

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
