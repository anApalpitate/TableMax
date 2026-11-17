import { useId, useState, type ReactNode } from 'react';
import { COUNTDOWN_STEPS, DEFAULT_COUNTDOWN_SECONDS } from '@tablemax/protocol';
import type { RoomSession } from '../session/useRoomSession';
import { BoxOverlayPanel } from './BoxOverlayPanel';
import { feedbackText } from '../content/feedback';
import { SoundSetting } from './SoundSetting';
import {
  ShootingFloatingWindowSetting,
  VideoSettingsFields,
} from './DisplaySettings';
import { GameSetupSettings } from './GameSetupSettings';
import { MenuIcon, SettingHelp, type GameClient } from '@tablemax/web-host';
import './countdown.css';
import './settings-panel.css';

const tabs = [
  ['basic', '基本设置'],
  ['game', '游戏设置'],
  ['video', '视频设置'],
] as const;

export function Settings({
  session,
  children,
  iconOnly = false,
  gameClient,
}: {
  session: RoomSession;
  children?: ReactNode;
  iconOnly?: boolean;
  gameClient?: GameClient;
}) {
  const [tab, setTab] = useState<(typeof tabs)[number][0] | null>(null);
  const { view, role } = session;
  const ended = view?.status === 'ended';
  const playing = view?.status === 'playing';
  const hasTimer = view?.game?.decisionTimer === true;
  const hasGameSetup = view?.game?.setup !== undefined;
  return (
    <>
      <button
        type="button"
        className="secondary icon-label-control countdown-settings-control"
        aria-label="设置"
        aria-haspopup="dialog"
        title="设置"
        onClick={() => setTab('basic')}
      >
        <MenuIcon />
        {!iconOnly && <span>设置</span>}
      </button>
      {tab && (
        <BoxOverlayPanel
          title="设置"
          className="settings-panel settings-panel--preferences"
          close={() => setTab(null)}
        >
          <nav className="settings-tabs" aria-label="设置分类">
            {tabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={value === tab}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </nav>
          <section
            className="settings-section"
            aria-label="基本设置"
            hidden={tab !== 'basic'}
          >
            <SoundSetting showSpeaker />
            {role === 'player' && <ShootingFloatingWindowSetting />}
            {children}
          </section>
          <section
            className="settings-section"
            aria-label="游戏设置"
            hidden={tab !== 'game'}
          >
            <h3>
              {playing ? '本局设置 · 只读' : ended ? '下一局设置' : '开局设置'}
            </h3>
            {ended && view?.game?.restoreOnly && (
              <p role="status">
                旧版配置仅供查看；开始当前版本的新局后可调整。
              </p>
            )}
            {hasGameSetup && gameClient?.SetupSettings && (
              <GameSetupSettings
                session={session}
                settings={gameClient.SetupSettings}
              />
            )}
            {hasGameSetup && !gameClient && (
              <GameSetupSettings session={session} />
            )}
            {hasTimer && <CountdownPreference session={session} />}
            {!hasGameSetup && !hasTimer && (
              <p>当前玩法没有可配置的游戏选项。</p>
            )}
          </section>
          <section
            className="settings-section"
            aria-label="视频设置"
            hidden={tab !== 'video'}
          >
            <VideoSettingsFields role={role} />
          </section>
        </BoxOverlayPanel>
      )}
    </>
  );
}

function CountdownPreference({ session }: { session: RoomSession }) {
  const { view } = session;
  const ended = view?.status === 'ended';
  const saved =
    (ended ? view?.nextCountdownSeconds : undefined) ??
    view?.countdownSeconds ??
    DEFAULT_COUNTDOWN_SECONDS;
  const source = `${view?.instanceId}:${view?.status}:${saved}`;
  const [draft, setDraft] = useState<{ source: string; seconds: number }>();
  const [attempted, setAttempted] = useState(false);
  const sliderId = useId();
  const seconds = draft?.source === source ? draft.seconds : saved;
  const editable =
    session.isHost &&
    (view?.status === 'lobby' || (ended && !view.game?.restoreOnly));
  return (
    <div className="countdown-settings">
      <div className="countdown-settings__row">
        <SettingHelp
          id={`${sliderId}-label`}
          label="思考时间提醒"
          hint={feedbackText('countdown.hint')}
        />
        {editable && (
          <input
            id={sliderId}
            aria-labelledby={`${sliderId}-label`}
            type="range"
            min="0"
            max={COUNTDOWN_STEPS.length - 1}
            step="1"
            value={COUNTDOWN_STEPS.findIndex((value) => value === seconds)}
            aria-valuetext={`${seconds} 秒`}
            disabled={session.locked || session.awaitingConfirmation}
            onChange={(event) => {
              setDraft({
                source,
                seconds: COUNTDOWN_STEPS[Number(event.target.value)]!,
              });
              setAttempted(false);
            }}
          />
        )}
        <output htmlFor={editable ? sliderId : undefined}>{seconds} 秒</output>
      </div>
      {attempted && (
        <p role="status">
          {session.awaitingConfirmation
            ? feedbackText('common.waitingForSave')
            : session.message}
        </p>
      )}
      {editable && (
        <div className="dialog-actions">
          {attempted && session.awaitingConfirmation && (
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
              session.locked ||
              session.awaitingConfirmation ||
              seconds === saved
            }
            onClick={() => {
              setAttempted(true);
              session.command({ type: 'set-countdown', seconds });
            }}
          >
            {ended ? '保存下一局思考时间' : '保存思考时间'}
          </button>
        </div>
      )}
    </div>
  );
}
