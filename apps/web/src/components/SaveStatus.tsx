import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { feedbackText, type FeedbackKind } from '../content/feedback';
import { NotificationCenter } from './notifications/notification-center';
import { useToolbarSavePosition } from './useToolbarSavePosition';
import './save-status.css';

export function SaveStatus({
  messageKind,
  saveConfirmation,
  compactProgress = false,
  connected,
  busy,
  admissionPending,
  awaitingConfirmation,
  toolbar = false,
}: {
  messageKind: FeedbackKind;
  saveConfirmation?: number;
  compactProgress?: boolean;
  connected: boolean;
  busy: boolean;
  admissionPending: boolean;
  awaitingConfirmation: boolean;
  toolbar?: boolean;
}) {
  const [center] = useState(() => new NotificationCenter(1));
  const notices = useSyncExternalStore(
    center.subscribe,
    center.snapshot,
    center.snapshot,
  );
  const previous = useRef({
    kind: messageKind,
    confirmation: saveConfirmation,
  });
  const blocked = !connected || admissionPending || awaitingConfirmation;

  useEffect(() => {
    const last = previous.current;
    previous.current = { kind: messageKind, confirmation: saveConfirmation };
    if (blocked || busy || messageKind !== 'saved') {
      center.clear();
      return;
    }
    // A restored acknowledgement is not a new confirmation on this screen.
    if (
      saveConfirmation === undefined
        ? last.kind !== 'saved'
        : last.confirmation !== saveConfirmation
    )
      center.show(feedbackText('session.saved'), 'success');
  }, [blocked, busy, center, messageKind, saveConfirmation]);

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
  const ref = useToolbarSavePosition(Boolean(notice) && !progress);
  if (!toolbar && !progress && !notice) return null;

  return (
    <span
      ref={ref}
      className={
        toolbar
          ? 'toolbar-save-feedback'
          : notice
            ? 'box-save-feedback toolbar-save-feedback'
            : 'box-save-feedback'
      }
      data-phase={
        progress ? 'progress' : notice && notice.leaving ? 'leaving' : 'saved'
      }
      data-visible={progress || notice ? 'true' : undefined}
      role="status"
    >
      {progress
        ? feedbackText('session.submitting')
        : notice
          ? `✓ ${feedbackText('session.saved')}`
          : null}
    </span>
  );
}
