import { useState } from 'react';
import { OverlayPanel } from '@tablemax/web-host';
import type { decisionGuidance } from './decision-guidance';
import './guidance.css';

export function DecisionHint({
  guidance,
  pending,
  showRules,
  expanded = false,
}: {
  guidance: ReturnType<typeof decisionGuidance>;
  pending: boolean;
  showRules?: ((chapter: string) => void) | undefined;
  expanded?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!expanded && !guidance.ability && !pending) return null;
  const summaries = [guidance.ability, guidance.target].filter(
    (item) => item !== null,
  );
  return (
    <section
      className="decision-guidance guidance-compact"
      aria-label="当前操作说明"
    >
      {pending ? (
        <p className="guidance-instruction" role="status">
          正在提交，等保存确认后继续。
        </p>
      ) : guidance.ability ? (
        <p className="ability-copy">
          <strong>{guidance.ability.name}：</strong>
          {guidance.ability.summary}
        </p>
      ) : (
        <p className="ability-copy">当前步骤说明</p>
      )}
      {expanded ? (
        <button
          type="button"
          className="secondary ability-detail"
          aria-label="查看当前完整操作说明"
          onClick={() => setOpen(true)}
        >
          说明
        </button>
      ) : guidance.ability && showRules ? (
        <button
          type="button"
          className="secondary ability-detail"
          aria-label={`查看${guidance.ability.name}详细规则`}
          onClick={() => showRules(guidance.ability!.chapter)}
        >
          规则
        </button>
      ) : null}
      {open && expanded && (
        <OverlayPanel
          title="当前操作说明"
          className="pokemon-guidance-panel"
          close={() => setOpen(false)}
        >
          <div className="pokemon-guidance-content">
            <p role="status">
              {pending ? '正在提交，等保存确认后继续。' : guidance.instruction}
            </p>
            {summaries.map((item, index) => (
              <section key={`${index}:${item.name}`}>
                <h3>{item.name}</h3>
                <p>{item.summary}</p>
                <p>{item.trigger}</p>
                {showRules && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setOpen(false);
                      showRules(item.chapter);
                    }}
                  >
                    查看{item.name}详细规则
                  </button>
                )}
              </section>
            ))}
            {guidance.notice && (
              <p className="guidance-notice">{guidance.notice}</p>
            )}
          </div>
        </OverlayPanel>
      )}
    </section>
  );
}
