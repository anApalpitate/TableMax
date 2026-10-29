import { CircularBadge } from './CircularBadge';
import {
  landscapeDecisionContent,
  portraitDecisionContent,
} from './DecisionContent';
import type { PlayerDecisionProps } from './player-decision-contract';
import { researchRewardText, researchRiskText } from './research-presentation';
import { ResearchReward } from './ResearchReward';
export function ResearchVote({
  game,
  landscape,
  showResearch,
  decision,
}: PlayerDecisionProps) {
  const { actions, locked, choose } = decision;
  const content = landscape
    ? landscapeDecisionContent
    : portraitDecisionContent;
  return (
    <section className="ex-vote">
      <div className="ex-vote-options">
        {game.researchCandidates.map((t, i) => (
          <article
            key={t.id}
            data-research-option={t.id}
            className={`ex-mission-option ${game.ownVote === t.id ? 'selected' : ''}`}
          >
            <button
              className="ex-vote-choice"
              data-action="vote-research"
              data-research={t.id}
              aria-label={`${t.name}，${researchRewardText(t)}${researchRiskText(t) ? `，${researchRiskText(t)}` : ''}${game.ownVote === t.id ? '，本人投票已锁定' : ''}`}
              disabled={
                locked ||
                !actions.some(
                  (a) => a.type === 'vote-research' && a.taskId === t.id,
                )
              }
              onClick={() => choose({ type: 'vote-research', taskId: t.id })}
            >
              {content.researchPicture(
                t.id,
                game.rulesProfile ?? 'research-buffer-v2',
              )}
              <CircularBadge
                className="ex-vote-mark"
                value={game.ownVote === t.id ? '✓' : i + 1}
              />
              <span className="ex-vote-copy">
                <strong>{t.name}</strong>
                <b>
                  <ResearchReward task={t} />
                </b>
                {researchRiskText(t) && (
                  <span className="ex-research-risk">
                    {researchRiskText(t)}
                  </span>
                )}
              </span>
            </button>
            <button
              className="secondary ex-research-details"
              data-research-details={t.id}
              aria-label={`查看${t.name}的条件与风险`}
              onClick={() => showResearch(t.id)}
            >
              条件与风险 <span aria-hidden="true">›</span>
            </button>
          </article>
        ))}
      </div>
      <p className="ex-vote-status">
        {game.ownVote ? '投票已锁定，等待其他玩家' : '选择一项投票，提交后锁定'}
      </p>
    </section>
  );
}
