import { useEffect, useRef, useState } from 'react';
import type {
  ApplicationUpdateSnapshot,
  TablemaxUpdate,
} from '../../../desktop/src/update-types';
import { BoxOverlayPanel } from './BoxOverlayPanel';
import { feedbackText } from '../content/feedback';
import './settings-panel.css';
import './application-update.css';

export function ApplicationUpdate({ playing }: { playing: boolean }) {
  const bridge = window.tablemaxUpdate;
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ApplicationUpdateSnapshot | null>(
    null,
  );
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const panelRequest = useRef(0);
  useEffect(() => {
    if (!bridge) return;
    let active = true;
    const receive = (value: ApplicationUpdateSnapshot) => {
      if (!active) return;
      setSnapshot(value);
      const request = value.panelRequestId ?? 0;
      if (Number.isSafeInteger(request) && request > panelRequest.current) {
        panelRequest.current = request;
        setOpen(true);
      }
    };
    const unsubscribe = bridge.subscribe((value) => {
      receive(value);
    });
    void bridge.read().then(
      (value) => {
        receive(value);
      },
      () => {
        if (active) setError(feedbackText('applicationUpdate.readFailed'));
      },
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [bridge]);
  if (!bridge) return null;
  const invoke = async (method: 'check' | 'download' | 'cancel' | 'apply') => {
    setRequesting(true);
    setError('');
    try {
      setSnapshot(await (bridge[method] as TablemaxUpdate['check'])());
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : feedbackText('applicationUpdate.requestFailed'),
      );
    } finally {
      setRequesting(false);
    }
  };
  const phase = snapshot?.phase ?? 'idle';
  const busy =
    requesting || ['checking', 'downloading', 'applying'].includes(phase);
  const total = snapshot?.totalBytes ?? 0;
  const downloaded = snapshot?.downloadedBytes ?? 0;
  const percent =
    total > 0 ? Math.min(100, Math.floor((downloaded / total) * 100)) : 0;
  const status = feedbackText(`applicationUpdate.${phase}`);
  return (
    <>
      <button
        type="button"
        className="secondary icon-label-control"
        title="程序更新"
        aria-label="程序更新"
        onClick={() => setOpen(true)}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M19 7a8 8 0 1 0 1 7M19 3v5h-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>程序更新</span>
      </button>
      {open && (
        <BoxOverlayPanel
          title="程序更新"
          close={() => setOpen(false)}
          className="settings-panel settings-panel--preferences application-update"
        >
          <div className="application-update__versions">
            <p>
              当前版本 <strong>{snapshot?.currentVersion ?? '正在读取'}</strong>
            </p>
            {snapshot?.targetVersion && (
              <p>
                可用版本 <strong>{snapshot.targetVersion}</strong>
              </p>
            )}
          </div>
          <p role="status" aria-live="polite">
            {status}
          </p>
          {(error || snapshot?.error) && (
            <p className="application-update__error" role="alert">
              {error || snapshot?.error}
            </p>
          )}
          {phase === 'downloading' && (
            <div className="application-update__progress">
              <progress max={100} value={percent} aria-label="下载进度" />
              <span>
                {percent}% · {(downloaded / 1_000_000).toFixed(1)} /{' '}
                {(total / 1_000_000).toFixed(1)} MB
              </span>
            </div>
          )}
          {snapshot?.notes && (
            <section className="application-update__notes">
              <h3>更新说明</h3>
              <p>{snapshot.notes}</p>
            </section>
          )}
          {phase === 'ready' && (
            <p>
              {feedbackText(
                playing
                  ? 'applicationUpdate.finishGame'
                  : 'applicationUpdate.restartEffect',
              )}
            </p>
          )}
          <div className="application-update__actions">
            {snapshot?.supported &&
              !['ready', 'available', 'downloading', 'applying'].includes(
                phase,
              ) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void invoke('check')}
                >
                  检查更新
                </button>
              )}
            {phase === 'available' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void invoke('download')}
              >
                下载新版
              </button>
            )}
            {phase === 'downloading' && (
              <button
                type="button"
                className="secondary"
                onClick={() => void invoke('cancel')}
              >
                取消下载
              </button>
            )}
            {phase === 'ready' && (
              <button
                type="button"
                disabled={busy || playing}
                onClick={() => void invoke('apply')}
              >
                保存并重启更新
              </button>
            )}
            <a
              href="https://github.com/anApalpitate/TableMax/releases"
              target="_blank"
              rel="noopener noreferrer"
            >
              打开发布页
            </a>
          </div>
        </BoxOverlayPanel>
      )}
    </>
  );
}
