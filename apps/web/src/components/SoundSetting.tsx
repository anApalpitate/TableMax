import { useId } from 'react';
import { SettingHelp, useSoundPreference } from '@tablemax/web-host';
import './display-settings.css';

export function SoundSetting() {
  const [enabled, setEnabled] = useSoundPreference();
  const labelId = useId();
  return (
    <div className="display-settings-choice sound-setting">
      <SettingHelp
        id={labelId}
        label="声音"
        hint="控制当前设备的游戏、语音和互动声音。"
      />
      <button
        type="button"
        className="secondary"
        role="switch"
        aria-checked={enabled}
        aria-labelledby={labelId}
        onClick={() => setEnabled(!enabled)}
      >
        <span
          className={`settings-switch${enabled ? ' settings-switch--on' : ''}`}
          aria-hidden="true"
        />
        {enabled ? '已开启' : '已关闭'}
      </button>
    </div>
  );
}
