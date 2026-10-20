import { useId } from 'react';
import { SettingHelp, type GameSetupSettingsProps } from '@tablemax/web-host';
import { unoSetupDefaults } from '../config';

export function UnoSetupSettings({
  value,
  disabled,
  onChange,
}: GameSetupSettingsProps) {
  const id = useId();
  const settings: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const drawPenaltyStacking =
    typeof settings.drawPenaltyStacking === 'boolean'
      ? settings.drawPenaltyStacking
      : unoSetupDefaults.drawPenaltyStacking;
  const catchUnoDelayMs =
    typeof settings.catchUnoDelayMs === 'number' &&
    Number.isFinite(settings.catchUnoDelayMs)
      ? Math.max(
          0,
          Math.min(5000, Math.round(settings.catchUnoDelayMs / 100) * 100),
        )
      : 500;
  const changeDelay = (delay: number) =>
    onChange({ drawPenaltyStacking, catchUnoDelayMs: delay });
  return (
    <section className="uno-setup-settings" aria-label="UNO 开局设置">
      <div className="uno-setup-choice">
        <SettingHelp
          id={`${id}-stacking`}
          label="补牌传递"
          hint="面对 +2 可接 +2 或 +4，面对 +4 可接 +4，把累计张数传给下一位。开局后保持本局设置。"
        />
        <button
          type="button"
          className="secondary"
          role="switch"
          aria-checked={drawPenaltyStacking}
          aria-labelledby={`${id}-stacking`}
          disabled={disabled}
          onClick={() =>
            onChange({
              drawPenaltyStacking: !drawPenaltyStacking,
              catchUnoDelayMs,
            })
          }
        >
          {drawPenaltyStacking ? '已开启' : '已关闭'}
        </button>
      </div>
      <div className="uno-setup-delay">
        <SettingHelp
          id={`${id}-delay-label`}
          label="抓漏延迟"
          hint="只延后其他人的抓漏按钮，本人喊 UNO 和下一位行动不受影响。范围 0–5 秒，每次调整 0.1 秒，支持 0.5 秒。"
        />
        <input
          id={`${id}-delay`}
          type="range"
          min="0"
          max="5000"
          step="100"
          list={`${id}-delay-values`}
          value={catchUnoDelayMs}
          aria-labelledby={`${id}-delay-label`}
          aria-valuetext={`${catchUnoDelayMs / 1000} 秒`}
          disabled={disabled}
          onChange={(event) => changeDelay(Number(event.target.value))}
        />
        <output htmlFor={`${id}-delay`}>{catchUnoDelayMs / 1000} 秒</output>
        <datalist id={`${id}-delay-values`}>
          {[0, 500, 1000, 2000, 5000].map((delay) => (
            <option key={delay} value={delay} label={`${delay / 1000} 秒`} />
          ))}
        </datalist>
      </div>
    </section>
  );
}
