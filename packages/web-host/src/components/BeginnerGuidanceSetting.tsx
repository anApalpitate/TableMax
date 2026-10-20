import { useId } from 'react';
import { useGuidancePreference } from '../preferences/useGuidancePreference';
import { SettingHelp } from './SettingHelp';
import './guidance-setting.css';

export function BeginnerGuidanceSetting({ gameId }: { gameId: string }) {
  const [enabled, setEnabled] = useGuidancePreference(gameId);
  const labelId = useId();
  return (
    <section className="beginner-guidance-setting">
      <SettingHelp
        id={labelId}
        label="本机新手引导"
        hint="关闭时只显示简短提示。设置仅对本设备生效。"
      />
      <button
        type="button"
        className="guidance-toggle"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={labelId}
        onClick={() => setEnabled(!enabled)}
      >
        <span className="guidance-toggle__mark" aria-hidden="true" />
        {enabled ? '开启' : '关闭'}
      </button>
    </section>
  );
}
