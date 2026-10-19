import { useId } from 'react';
import type { GameSetupSettingsProps } from '@tablemax/web-host';

export function UnoSetupSettings({
  value,
  disabled,
  onChange,
}: GameSetupSettingsProps) {
  const id = useId();
  const settings: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const drawPenaltyStacking = settings.drawPenaltyStacking === true;
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
      <div className="uno-setup-heading">
        <h3>UNO 开局设置</h3>
        <span>开局后保持本局设置</span>
      </div>
      <div className="uno-setup-choice">
        <div>
          <label id={`${id}-stacking`}>补牌传递</label>
          <p>受罚时可按本局规则继续出补牌，把累计张数传给下一位。</p>
        </div>
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
        <div className="uno-setup-heading">
          <label htmlFor={`${id}-delay`}>抓漏延迟</label>
          <output htmlFor={`${id}-delay`}>{catchUnoDelayMs / 1000} 秒</output>
        </div>
        <input
          id={`${id}-delay`}
          type="range"
          min="0"
          max="5000"
          step="100"
          value={catchUnoDelayMs}
          aria-valuetext={`${catchUnoDelayMs / 1000} 秒`}
          disabled={disabled}
          onChange={(event) => changeDelay(Number(event.target.value))}
        />
        <div
          className="uno-setup-presets"
          role="group"
          aria-label="抓漏延迟快捷选择"
        >
          {[0, 1000, 2000, 5000].map((delay) => (
            <button
              key={delay}
              type="button"
              className="secondary"
              aria-pressed={catchUnoDelayMs === delay}
              disabled={disabled}
              onClick={() => changeDelay(delay)}
            >
              {delay / 1000} 秒
            </button>
          ))}
        </div>
        <p>只延后其他人的抓漏按钮，本人喊 UNO 和下一位行动不受影响。</p>
      </div>
    </section>
  );
}
