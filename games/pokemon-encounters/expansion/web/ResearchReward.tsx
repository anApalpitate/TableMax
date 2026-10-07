import { researchRewardText, rewardTextParts } from './research-presentation';

export function ResearchReward({
  task,
}: {
  task: Parameters<typeof researchRewardText>[0];
}) {
  return (
    <span className="ex-reward-summary">
      {rewardTextParts(researchRewardText(task)).map((part, i) => (
        <span
          key={i}
          className={part.keepTogether ? 'ex-reward-phrase' : undefined}
        >
          {part.text}
        </span>
      ))}
    </span>
  );
}
