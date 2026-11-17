import { useId } from 'react';
import {
  SettingHelp,
  SoundIcon,
  useSoundPreference,
  useSoundVolume,
} from '@tablemax/web-host';
import './display-settings.css';

export function SoundSetting({
  showSpeaker = false,
}: {
  showSpeaker?: boolean;
}) {
  const [enabled, setEnabled] = useSoundPreference();
  const [volume, setVolume] = useSoundVolume();
  const labelId = useId();
  const volumeId = useId();
  return (
    <>
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
          {showSpeaker ? (
            <SoundIcon enabled={enabled} />
          ) : (
            <span
              className={`settings-switch${enabled ? ' settings-switch--on' : ''}`}
              aria-hidden="true"
            />
          )}
          {enabled ? '已开启' : '已关闭'}
        </button>
      </div>
      <div className="display-settings-choice settings-volume-row">
        <SettingHelp
          id={`${volumeId}-label`}
          label="音量"
          hint="调整当前设备的游戏和互动声音音量。"
        />
        <input
          id={volumeId}
          aria-labelledby={`${volumeId}-label`}
          aria-valuetext={`${Math.round(volume * 100)}%`}
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(volume * 100)}
          onChange={(event) => setVolume(Number(event.target.value) / 100)}
        />
        <output htmlFor={volumeId}>{Math.round(volume * 100)}%</output>
      </div>
    </>
  );
}
