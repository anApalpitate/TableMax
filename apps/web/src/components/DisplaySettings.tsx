import { useEffect, useState } from 'react';
import type {
  DisplayPreferences,
  DisplaySnapshot,
} from '../../../desktop/src/display-types';
import { OverlayPanel } from './OverlayPanel';
import './display-settings.css';

const resolutions = [
  ['auto', '自动适配（推荐）'],
  ['1280x720', '1280 × 720 · 720p'],
  ['1920x1080', '1920 × 1080 · 1080p'],
  ['2560x1440', '2560 × 1440 · 1440p'],
  ['3840x2160', '3840 × 2160 · 4K'],
] as const;

export function DisplaySettings() {
  const bridge = window.tablemaxDisplay;
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
        if (active) setError('暂时无法读取显示设置，请重新打开面板重试。');
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);
  if (!bridge) return null;
  const update = async (preferences: DisplayPreferences) => {
    setBusy(true);
    setError('');
    try {
      setSnapshot(await bridge.update(preferences));
    } catch {
      setError('显示设置未保存，请重试。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        type="button"
        className="secondary display-settings-control"
        aria-label="显示设置"
        title="显示设置"
        onClick={() => {
          setOpen(true);
          if (!snapshot)
            void bridge.read().then(
              (value) => {
                setSnapshot(value);
                setError('');
              },
              () => setError('暂时无法读取显示设置，请稍后重试。'),
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
        <span>显示设置</span>
      </button>
      {open && (
        <OverlayPanel title="显示设置" close={() => setOpen(false)}>
          <p className="display-settings-description">
            为当前电脑画面选择合适的文字与卡牌大小，切换后立即生效。房主管理与公共屏分别保存。
          </p>
          {error && <p role="alert">{error}</p>}
          {snapshot ? (
            <div className="display-settings-fields">
              <div className="display-settings-current">
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
                <span>
                  Windows 缩放 {Math.round(snapshot.screen.scaleFactor * 100)}%
                  {' · '}界面缩放 {Math.round(snapshot.zoomFactor * 100)}%
                </span>
              </div>
              <label htmlFor="display-resolution">显示分辨率</label>
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
                自动适配会随窗口、全屏和显示器变化调整。预设按所选分辨率优化界面大小。
              </p>
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
              {snapshot.limited && (
                <p className="display-settings-hint" role="status">
                  当前窗口空间有限，已限制放大比例。放大窗口后可显示更大的界面。
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
                {busy ? '正在保存显示设置…' : '设置仅用于当前电脑画面。'}
              </p>
            </div>
          ) : (
            !error && <p role="status">正在读取显示设置…</p>
          )}
        </OverlayPanel>
      )}
    </>
  );
}
