import { useEffect, useState } from 'react';
import type {
  DisplayPreferences,
  DisplaySnapshot,
} from '../../../desktop/src/display-types';
import { OverlayPanel } from './OverlayPanel';
import type { ScreenRole } from '../navigation';
import { useInteractionPreference } from '../interactions/useInteractionPreference';
import { feedbackText } from '../content/feedback';
import './display-settings.css';

const resolutions = [
  ['auto', '自动适配（推荐）'],
  ['1280x720', '1280 × 720 · 720p'],
  ['1920x1080', '1920 × 1080 · 1080p'],
  ['2560x1440', '2560 × 1440 · 1440p'],
  ['3840x2160', '3840 × 2160 · 4K'],
] as const;

export function DisplaySettings({
  role = location.pathname.startsWith('/host')
    ? 'host'
    : location.pathname.startsWith('/public')
      ? 'public'
      : 'player',
}: {
  role?: ScreenRole;
}) {
  const bridge = window.tablemaxDisplay;
  const [blocked, setBlocked] = useInteractionPreference(role);
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<DisplaySnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const unsubscribe = bridge.subscribe((value) => {
      if (active) setSnapshot(value);
    });
    void bridge.read().then(
      (value) => {
        if (active) setSnapshot(value);
      },
      () => {
        if (active) setError(feedbackText('display.initialReadFailed'));
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);
  const update = async (preferences: DisplayPreferences) => {
    setBusy(true);
    setError('');
    try {
      setSnapshot(await bridge!.update(preferences));
    } catch {
      setError(feedbackText('display.saveFailed'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="secondary icon-label-control display-settings-control"
        aria-label="视频设置"
        title="视频设置"
        onClick={() => {
          setOpen(true);
          if (bridge && !snapshot)
            void bridge.read().then(
              (value) => {
                setSnapshot(value);
                setError('');
              },
              () => setError(feedbackText('display.readFailed')),
            );
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x="3"
            y="4"
            width="18"
            height="13"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 17v4M8 21h8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <span>视频设置</span>
      </button>
      {open && (
        <OverlayPanel title="视频设置" close={() => setOpen(false)}>
          <div className="display-settings-choice interaction-video-setting">
            <button
              type="button"
              className="secondary"
              aria-pressed={blocked}
              onClick={() => setBlocked(!blocked)}
            >
              {blocked ? '恢复互动特效' : '禁用互动特效'}
            </button>
            <p className="display-settings-hint">
              {blocked
                ? feedbackText('display.interactionDisabled')
                : feedbackText('display.interactionEnabled')}
            </p>
          </div>
          {error && (
            <p className="display-settings-error" role="alert">
              {error}
            </p>
          )}
          {snapshot ? (
            <div className="display-settings-fields">
              <div className="display-settings-current">
                <div className="display-settings-screen">
                  <span>当前显示器</span>
                  <strong>
                    {Math.round(
                      snapshot.screen.width * snapshot.screen.scaleFactor,
                    )}
                    {' × '}
                    {Math.round(
                      snapshot.screen.height * snapshot.screen.scaleFactor,
                    )}
                  </strong>
                </div>
                <dl className="display-settings-metrics">
                  <div>
                    <dt>Windows 缩放</dt>
                    <dd>{Math.round(snapshot.screen.scaleFactor * 100)}%</dd>
                  </div>
                  <div>
                    <dt>界面缩放</dt>
                    <dd>{Math.round(snapshot.zoomFactor * 100)}%</dd>
                  </div>
                </dl>
              </div>
              <div className="display-settings-choice">
                <label htmlFor="display-resolution">适配方式</label>
                <select
                  id="display-resolution"
                  value={snapshot.preferences.resolution}
                  disabled={busy}
                  onChange={(event) =>
                    void update({
                      ...snapshot.preferences,
                      resolution: event.target
                        .value as DisplayPreferences['resolution'],
                    })
                  }
                >
                  {resolutions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <p className="display-settings-hint">
                  {feedbackText('display.autoHint')}
                </p>
              </div>
              <div className="display-settings-choice">
                <label htmlFor="display-interface-scale">界面大小</label>
                <select
                  id="display-interface-scale"
                  value={snapshot.preferences.interfaceScale}
                  disabled={busy}
                  onChange={(event) =>
                    void update({
                      ...snapshot.preferences,
                      interfaceScale: Number(
                        event.target.value,
                      ) as DisplayPreferences['interfaceScale'],
                    })
                  }
                >
                  <option value="100">标准（100%）</option>
                  <option value="125">放大（125%）</option>
                  <option value="150">更大（150%）</option>
                </select>
              </div>
              {snapshot.limited && (
                <p className="display-settings-hint" role="status">
                  {feedbackText('display.limited')}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void update({ resolution: 'auto', interfaceScale: 100 })
                  }
                >
                  恢复自动适配
                </button>
              </div>
              <p className="display-settings-hint" role="status">
                {busy
                  ? feedbackText('common.saving')
                  : feedbackText('display.saved')}
              </p>
            </div>
          ) : (
            bridge &&
            !error && <p role="status">{feedbackText('display.reading')}</p>
          )}
        </OverlayPanel>
      )}
    </>
  );
}
