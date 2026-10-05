import { useId } from 'react';
import { useGuidancePreference } from '../session/useGuidancePreference';
import './guidance-setting.css';

export function BeginnerGuidanceSetting({ gameId }: { gameId: string }) {
  const [enabled, setEnabled] = useGuidancePreference(gameId);
  const labelId = useId();
  return (
    <section className="beginner-guidance-setting">
      <h3 id={labelId}>新手引导</h3>
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
      <p>关闭时只显示简短提示。设置仅对本设备生效。</p>
    </section>
  );
}
