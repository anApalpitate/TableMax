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
  const ability = guidance.ability;
  if (!expanded && !ability && !pending && !guidance.condition && !open)
    return null;
  const explanation = expanded || !ability;
  const summaries = [
    { kind: 'ability', value: ability },
    { kind: 'target', value: guidance.target },
  ];
  return (
    <section
      className="decision-guidance guidance-compact"
      aria-label="当前操作说明"
      data-guidance-enabled={expanded}
      data-pending={pending}
    >
      <p className="guidance-primary" role="status" aria-live="polite">
        {pending
          ? '正在提交，等保存确认'
          : (guidance.condition ??
            (ability ? `${ability.name}：${ability.summary}` : ''))}
      </p>
      {(expanded || showRules) && (
        <button
          type="button"
          className="secondary ability-detail"
          aria-label={
            explanation ? '本次操作详细说明' : `查看${ability?.name}详细规则`
          }
          onClick={() => {
            if (explanation) setOpen(true);
            else if (ability) showRules?.(ability.chapter);
          }}
        >
          {explanation ? '说明' : '规则'}
        </button>
      )}
      {open && (
        <OverlayPanel
          title="本次操作说明"
          className="pokemon-guidance-dialog"
          close={() => setOpen(false)}
        >
          <p className="guidance-full-instruction">{guidance.instruction}</p>
          {summaries.map(({ kind, value }) =>
            value ? (
              <section
                className="guidance-full-summary"
                data-summary-kind={kind}
                key={kind}
              >
                <h3>{value.name}</h3>
                <p className="guidance-full-ability">{value.summary}</p>
                <p className="guidance-full-trigger">{value.trigger}</p>
                {showRules && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => {
                      setOpen(false);
                      showRules(value.chapter);
                    }}
                  >
                    查看{value.name}完整规则
                  </button>
                )}
              </section>
            ) : null,
          )}
          {guidance.notice && (
            <p className="guidance-full-notice">{guidance.notice}</p>
          )}
        </OverlayPanel>
      )}
    </section>
  );
}
