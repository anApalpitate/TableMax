import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { AvalonView } from '../types';
import {
  AvalonSavedFeedback,
  avalonCue,
  avalonFeedbackKey,
  type AvalonCue,
  type Feedback,
} from './presentation';
import { Relic, type RelicKind } from './Relic';

const themes: Partial<
  Record<AvalonCue, { title: string; line: string; relic: RelicKind }>
> = {
  team: { title: '圆桌召集', line: '远征名单已提出', relic: 'seal' },
  approved: {
    title: '议会通过',
    line: '远征者，请秘密提交任务牌',
    relic: 'seal',
  },
  rejected: { title: '提案否决', line: '王冠交给下一位队长', relic: 'seal' },
  'quest-success': { title: '圣杯辉光', line: '这次任务成功', relic: 'grail' },
  'quest-fail': { title: '暗影侵袭', line: '这次任务失败', relic: 'raven' },
  assassination: { title: '终末之剑', line: '刺杀已落定', relic: 'sword' },
  'good-win': { title: '阿瓦隆的黎明', line: '忠诚阵营获胜', relic: 'grail' },
  'evil-win': { title: '莫德雷德的阴影', line: '邪恶阵营获胜', relic: 'raven' },
};

/** Three layers: physical seal, etched texture sweep, narrative relic landing. */
export function AvalonEffects({
  feedback,
  game,
  disabled,
}: {
  feedback: Feedback | null;
  game: AvalonView | null;
  disabled: boolean;
}) {
  const seen = useRef(new AvalonSavedFeedback(feedback));
  const [effect, setEffect] = useState<{ key: string; cue: AvalonCue } | null>(
    null,
  );
  useEffect(() => {
    const fresh = seen.current.accept(feedback);
    if (disabled || !feedback || document.hidden) {
      const frame = requestAnimationFrame(() => setEffect(null));
      return () => cancelAnimationFrame(frame);
    }
    if (!fresh) return;
    const cue = avalonCue(feedback, game);
    if (!cue || !themes[cue]) return;
    const frame = requestAnimationFrame(() =>
      setEffect({ key: avalonFeedbackKey(feedback), cue }),
    );
    return () => cancelAnimationFrame(frame);
  }, [feedback, game, disabled]);
  useEffect(() => {
    if (!effect) return;
    const timer = window.setTimeout(
      () => setEffect(null),
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 550
        : effect.cue === 'assassination'
          ? 2600
          : 1900,
    );
    const hide = () => {
      if (document.hidden) setEffect(null);
    };
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [effect]);
  const theme = effect && themes[effect.cue];
  if (!effect || !theme || disabled) return null;
  return (
    <div
      className={`av-performance av-performance--${effect.cue}`}
      key={effect.key}
      data-avalon-effect={effect.cue}
      data-reduced={
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      }
      aria-hidden="true"
    >
      <div className="av-performance-vignette" />
      <div className="av-performance-rays" />
      <div className="av-performance-etching" />
      <div className="av-performance-ring" />
      <div className="av-performance-relic">
        <Relic kind={theme.relic} />
      </div>
      {effect.cue === 'assassination' && (
        <div className="av-performance-finale">
          <Relic kind={game?.winner === 'good' ? 'grail' : 'raven'} />
        </div>
      )}
      <div className="av-performance-banner">
        <span>
          {effect.cue === 'assassination'
            ? game?.winner === 'evil'
              ? '梅林被识破 · 邪恶阵营获胜'
              : '梅林幸存 · 忠诚阵营获胜'
            : theme.line}
        </span>
        <strong>
          {effect.cue === 'assassination'
            ? game?.winner === 'evil'
              ? '最后一剑 · 暗影降临'
              : '最后一剑 · 黎明到来'
            : theme.title}
        </strong>
      </div>
      <div className="av-performance-sweep" />
      <div className="av-performance-motes">
        {Array.from({ length: 22 }, (_, index) => (
          <i key={index} style={{ '--mote': index } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}
