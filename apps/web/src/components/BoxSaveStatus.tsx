import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { feedbackText, type FeedbackKind } from '../content/feedback';
import { NotificationCenter } from './notifications/notification-center';

export function BoxSaveStatus({
  messageKind,
  compactProgress,
  connected,
  busy,
  admissionPending,
  awaitingConfirmation,
}: {
  messageKind: FeedbackKind;
  compactProgress: boolean;
  connected: boolean;
  busy: boolean;
  admissionPending: boolean;
  awaitingConfirmation: boolean;
}) {
  const [center] = useState(() => new NotificationCenter(1));
  const notices = useSyncExternalStore(
    center.subscribe,
    center.snapshot,
    center.snapshot,
  );
  const previousKind = useRef(messageKind);
  const blocked = !connected || admissionPending || awaitingConfirmation;

  useEffect(() => {
    const previous = previousKind.current;
    previousKind.current = messageKind;
    if (blocked || busy || messageKind !== 'saved') {
      center.clear();
      return;
    }
    // A restored acknowledgement is not a new confirmation on this screen.
    if (previous !== 'saved')
      center.show(feedbackText('session.saved'), 'success');
  }, [blocked, busy, center, messageKind]);

  useEffect(() => {
    const updateVisibility = () => center.setHidden(document.hidden);
    updateVisibility();
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      document.removeEventListener('visibilitychange', updateVisibility);
      center.clear();
    };
  }, [center]);

  const progress = !blocked && compactProgress;
  const notice = !blocked && !busy && messageKind === 'saved' && notices[0];
  if (!progress && !notice) return null;

  return (
    <span
      className="box-save-feedback"
      data-phase={
        progress ? 'progress' : notice && notice.leaving ? 'leaving' : 'saved'
      }
      data-visible="true"
      role="status"
    >
      {progress
        ? feedbackText('session.submitting')
        : `✓ ${feedbackText('session.saved')}`}
    </span>
  );
}
