import type { decisionGuidance } from './decision-guidance';
import './guidance.css';

export function DecisionHint({
  guidance,
  pending,
  showRules,
}: {
  guidance: ReturnType<typeof decisionGuidance>;
  pending: boolean;
  showRules?: ((chapter: string) => void) | undefined;
}) {
  return (
    <section className="decision-guidance" aria-label="当前操作说明">
      <p className="guidance-instruction" role="status">
        {pending ? '正在提交，等保存确认后继续。' : guidance.instruction}
      </p>
      {[guidance.ability, guidance.target]
        .filter((item) => item !== null)
        .map((item, index) => (
          <div className="ability-summary" key={`${index}:${item.name}`}>
            <p>
              <strong>{item.name}</strong>
              <span className="ability-trigger">{item.trigger}</span>
            </p>
            <p>{item.summary}</p>
            {showRules && (
              <button
                type="button"
                className="secondary ability-detail"
                onClick={() => showRules(item.chapter)}
                aria-label={`查看${item.name}详细规则`}
              >
                详细规则
              </button>
            )}
          </div>
        ))}
      {guidance.notice && <p className="guidance-notice">{guidance.notice}</p>}
    </section>
  );
}
