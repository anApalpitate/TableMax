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
  if (!expanded && !guidance.ability && !pending) return null;
  const summaries = expanded
    ? [guidance.ability, guidance.target]
    : [guidance.ability];
  return (
    <section
      className={`decision-guidance${expanded ? '' : ' guidance-compact'}`}
      aria-label="当前操作说明"
    >
      {(expanded || pending) && (
        <p className="guidance-instruction" role="status">
          {pending ? '正在提交，等保存确认后继续。' : guidance.instruction}
        </p>
      )}
      {summaries
        .filter((item) => item !== null)
        .map((item, index) => (
          <div className="ability-summary" key={`${index}:${item.name}`}>
            <p className="ability-copy">
              <span className="ability-phrase">
                <strong>{item.name}：</strong>
                {item.summary}
              </span>
              {expanded && (
                <span className="ability-trigger">{item.trigger}</span>
              )}
            </p>
            {showRules && (
              <button
                type="button"
                className="secondary ability-detail"
                onClick={() => showRules(item.chapter)}
                aria-label={`查看${item.name}详细规则`}
              >
                规则
              </button>
            )}
          </div>
        ))}
      {expanded && guidance.notice && (
        <p className="guidance-notice">{guidance.notice}</p>
      )}
    </section>
  );
}
