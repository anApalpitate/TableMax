import { useId, useState } from 'react';
import { COUNTDOWN_STEPS, DEFAULT_COUNTDOWN_SECONDS } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from './OverlayPanel';
import './countdown.css';

export function CountdownSettings({ session }: { session: RoomSession }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<number>(
    COUNTDOWN_STEPS.indexOf(DEFAULT_COUNTDOWN_SECONDS),
  );
  const [attempted, setAttempted] = useState(false);
  const sliderId = useId();
  if (!session.isHost) return null;
  const seconds = COUNTDOWN_STEPS[step]!;
  return (
    <>
      <button
        type="button"
        className="secondary countdown-settings-control"
        aria-label="倒计时设置"
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
          <circle
            cx="12"
            cy="13"
            r="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M9 2h6M12 5V2m0 11V8m0 5 3 2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span>倒计时</span>
      </button>
      {open && (
        <OverlayPanel title="倒计时设置" close={() => setOpen(false)}>
          <div className="countdown-settings">
            <label htmlFor={sliderId}>每次思考时间</label>
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
            <p>所有游戏共用。到时只提醒，仍可继续选择。</p>
            <p className="countdown-settings__saved">
              当前已保存：
              {session.view?.countdownSeconds ?? DEFAULT_COUNTDOWN_SECONDS} 秒
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
        </OverlayPanel>
      )}
    </>
  );
}
