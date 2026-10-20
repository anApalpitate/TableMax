import { useEffect, useRef, useState } from 'react';
import {
  claimAudioEvent,
  subscribeSoundPreference,
  useAudioOutput,
  useSoundPreference,
  type GameHost,
} from '@tablemax/web-host';
/** Lightweight original synthesized cue, only after an authoritative saved event. */
export function SavedFeedback({ session }: { session: GameHost }) {
  const [enabled] = useSoundPreference();
  const canPlay = useAudioOutput();
  const context = useRef<AudioContext | null>(null);
  const seen = useRef(new Set<string>());
  const first = useRef(true);
  const [pulse, setPulse] = useState('');
  const feedback = session.feedback;
  const key = feedback
    ? `${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
  useEffect(() => {
    const stop = () => {
      const ctx = context.current;
      context.current = null;
      void ctx?.close();
    };
    const unsub = subscribeSoundPreference((on) => {
      if (!on) stop();
    });
    const hidden = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', hidden);
    return () => {
      unsub();
      stop();
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (key) seen.current.add(key);
      return;
    }
    if (!key || seen.current.has(key)) return;
    seen.current.add(key);
    if (
      !feedback ||
      feedback.instanceId !== session.view?.instanceId ||
      feedback.branch !== session.view?.branch ||
      feedback.revision !== session.view?.revision
    )
      return;
    // Response receipts never reveal correctness or trigger an adjudication cue.
    if (
      !feedback.events.some(
        (e) => e.kind === 'salad' && !e.text.includes('本次选择'),
      )
    )
      return;
    const start = setTimeout(() => setPulse(key), 0);
    const timer = setTimeout(() => setPulse(''), 320);
    let cancelled = false;
    if (enabled && canPlay && !document.hidden)
      void Promise.resolve(claimAudioEvent(`salad:${key}`))
        .then((accepted) => {
          if (!accepted || cancelled || document.hidden) return;
          const ctx = new AudioContext();
          context.current = ctx;
          const osc = ctx.createOscillator(),
            gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(620, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(
            880,
            ctx.currentTime + 0.09,
          );
          gain.gain.setValueAtTime(0.06, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.13);
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.14);
          osc.onended = () => {
            void ctx.close();
            if (context.current === ctx) context.current = null;
          };
        })
        .catch(() => {});
    return () => {
      cancelled = true;
      clearTimeout(start);
      clearTimeout(timer);
    };
  }, [
    key,
    feedback,
    enabled,
    canPlay,
    session.view?.instanceId,
    session.view?.branch,
    session.view?.revision,
  ]);
  return (
    <span
      className={`salad-saved-spark ${pulse ? 'salad-saved-spark-active' : ''}`}
      aria-hidden="true"
    >
      ✦
    </span>
  );
}

export function SoundControl() {
  const [enabled, setEnabled] = useSoundPreference();
  return (
    <button
      className="salad-sound"
      type="button"
      onClick={() => setEnabled(!enabled)}
      aria-pressed={enabled}
    >
      {enabled ? '声音开启' : '声音关闭'}
    </button>
  );
}
