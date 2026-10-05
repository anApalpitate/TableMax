import { useId, useState, type ReactNode } from 'react';
import { COUNTDOWN_STEPS, DEFAULT_COUNTDOWN_SECONDS } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from './OverlayPanel';
import './countdown.css';

export function CountdownSettings({
  session,
  children,
}: {
  session: RoomSession;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<number>(
    COUNTDOWN_STEPS.indexOf(DEFAULT_COUNTDOWN_SECONDS),
  );
  const [attempted, setAttempted] = useState(false);
  const sliderId = useId();
  const canSetTimer = session.isHost && session.view?.game?.decisionTimer;
  if (!canSetTimer && !children) return null;
  const seconds = COUNTDOWN_STEPS[step]!;
  return (
    <>
      <button
        type="button"
        className="secondary icon-label-control countdown-settings-control"
        aria-label="游戏设置"
        title="游戏设置"
        onClick={() => {
          const current =
            session.view?.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS;
          setStep(
            Math.max(
              0,
              COUNTDOWN_STEPS.findIndex((value) => value === current),
            ),
          );
          setAttempted(false);
          setOpen(true);
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 6h16M4 12h16M4 18h16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M8 3v6M16 9v6M10 15v6"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <span>游戏设置</span>
      </button>
      {open && (
        <OverlayPanel title="游戏设置" close={() => setOpen(false)}>
          {children}
          {canSetTimer && (
            <div className="countdown-settings">
              <div className="countdown-settings__heading">
                <label htmlFor={sliderId}>思考时间提醒</label>
                <span className="countdown-settings__saved">
                  当前{' '}
                  {session.view?.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS}{' '}
                  秒
                </span>
              </div>
              <output htmlFor={sliderId}>
                <strong>{seconds}</strong>
                <span>秒</span>
              </output>
              <input
                id={sliderId}
                type="range"
                min="0"
                max={COUNTDOWN_STEPS.length - 1}
                step="1"
                value={step}
                aria-valuetext={`${seconds} 秒`}
                disabled={session.locked}
                onChange={(event) => {
                  setStep(Number(event.target.value));
                  setAttempted(false);
                }}
              />
              <div className="countdown-settings__scale" aria-hidden="true">
                <span>5 秒</span>
                <span
                  style={{
                    left: `${(COUNTDOWN_STEPS.indexOf(DEFAULT_COUNTDOWN_SECONDS) / (COUNTDOWN_STEPS.length - 1)) * 100}%`,
                  }}
                >
                  20 秒
                </span>
                <span>120 秒</span>
              </div>
              <p className="countdown-settings__note">
                到时仅提醒，仍可继续选择。
              </p>
              {attempted && (
                <p role="status">
                  {session.awaitingConfirmation
                    ? '正在等待保存确认'
                    : session.message}
                </p>
              )}
              <div className="dialog-actions">
                {session.awaitingConfirmation && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={!session.connected}
                    onClick={session.retry}
                  >
                    重试确认
                  </button>
                )}
                <button
                  type="button"
                  disabled={
                    session.locked || seconds === session.view?.countdownSeconds
                  }
                  onClick={() => {
                    setAttempted(true);
                    session.command({ type: 'set-countdown', seconds });
                  }}
                >
                  保存设置
                </button>
              </div>
            </div>
          )}
        </OverlayPanel>
      )}
    </>
  );
}
