import type { CSSProperties } from 'react';
import { avatarFor, type GameHost } from '@tablemax/web-host';
import type { AvalonView, ProposalResult } from '../types';
import { Crown, Relic, BallotMark } from './Relic';
import { RoleCard } from './RoleCard';

type Seats = NonNullable<GameHost['view']>['seats'];
const coordinates = [
  [15, 27],
  [50, 13],
  [85, 27],
  [85, 74],
  [50, 89],
  [15, 74],
];

export function QuestTrack({ game }: { game: AvalonView }) {
  return (
    <section className="av-quest-track" aria-label="五次远征任务">
      {game.questSizes.map((size, index) => {
        const result = game.quests.find(
          (quest) => quest.questNumber === index + 1,
        );
        const current =
          game.questNumber === index + 1 && game.phase !== 'ended';
        return (
          <article
            className={`av-quest-token${current ? ' av-quest-token--current' : ''}${result ? (result.succeeded ? ' av-quest-token--success' : ' av-quest-token--fail') : ''}`}
            key={index}
            aria-label={`第${index + 1}次任务，${size}人${result ? (result.succeeded ? '，成功' : `，失败，${result.failCount}张失败牌`) : current ? '，当前任务' : '，待进行'}`}
          >
            <span className="av-quest-number">{index + 1}</span>
            <Relic
              kind={result ? (result.succeeded ? 'grail' : 'raven') : 'seal'}
            />
            <strong>
              {result ? (result.succeeded ? '成功' : '失败') : `${size} 人`}
            </strong>
            {result && (
              <span className="av-quest-card-count">
                失败牌 {result.failCount}
              </span>
            )}
          </article>
        );
      })}
    </section>
  );
}

export function RejectionTrack({ count }: { count: number }) {
  return (
    <div
      className="av-rejections"
      aria-label={`连续否决 ${count} 次，五次否决邪恶获胜`}
    >
      <span>连续否决</span>
      <div className="av-rejection-seals">
        {Array.from({ length: 5 }, (_, index) => (
          <span key={index} className={index < count ? 'av-rejected-seal' : ''}>
            {index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Council({
  game,
  seats,
  selected,
  selectable,
  toggle,
  compact = false,
}: {
  game: AvalonView;
  seats: Seats;
  selected: string[];
  selectable: string[];
  toggle(id: string): void;
  compact?: boolean;
}) {
  const proposal = game.history.at(-1);
  const showBallots = proposal?.proposalNumber === game.proposalNumber;
  return (
    <section
      className={`av-council${compact ? ' av-council--compact' : ''}`}
      aria-label="圆桌议会"
    >
      <div className="av-table-wood" />
      <div className="av-table-engraving" />
      <div className="av-council-center">
        <Relic
          kind={
            game.phase === 'assassinate'
              ? 'sword'
              : game.phase === 'quest'
                ? 'grail'
                : 'seal'
          }
        />
        <strong>
          {game.phase === 'reveal'
            ? '宣誓入席'
            : game.phase === 'assassinate'
              ? '最后的刺杀'
              : `第 ${game.questNumber} 次远征`}
        </strong>
        <span>
          {game.phase === 'quest'
            ? '任务牌秘密提交'
            : game.phase === 'vote'
              ? '赞成须超过半数'
              : game.phase === 'assassinate'
                ? '邪恶势力公开商议'
                : game.phase === 'reveal'
                  ? '各自查看身份'
                  : `队伍需要 ${game.questSizes[game.questNumber - 1]} 人`}
        </span>
      </div>
      <div className="av-council-seats">
        {game.seatOrder.map((id, index) => {
          const seat = seats.find((entry) => entry.id === id);
          const choice = selectable.includes(id);
          const member = selected.includes(id);
          const leader = game.leader === id;
          const submitted = game.submittedSeats.includes(id);
          const ballot = showBallots ? proposal?.votes[id] : null;
          const coordinate =
            game.seatOrder.length === 5
              ? [
                  [15, 26],
                  [50, 13],
                  [85, 26],
                  [76, 78],
                  [24, 78],
                ][index]!
              : coordinates[index]!;
          return (
            <button
              type="button"
              key={id}
              className={`av-seat${leader ? ' av-seat--leader' : ''}${member ? ' av-seat--selected' : ''}${submitted ? ' av-seat--submitted' : ''}`}
              data-seat-id={id}
              data-av-seat={id}
              data-selected={member}
              data-submitted={submitted}
              data-feedback-target={
                game.latest?.targets.includes(id) || game.latest?.actor === id
              }
              style={
                {
                  '--seat-x': `${coordinate[0]}%`,
                  '--seat-y': `${coordinate[1]}%`,
                } as CSSProperties
              }
              disabled={!choice}
              aria-pressed={choice ? member : undefined}
              aria-label={`${seat?.name ?? `座位 ${index + 1}`}${leader ? '，队长' : ''}${member ? '，已选入队伍' : ''}${submitted ? '，已提交' : ''}${ballot ? (ballot === 'approve' ? '，赞成' : '，反对') : ''}`}
              onClick={() => toggle(id)}
            >
              <span className="av-seat-portrait">
                <img src={avatarFor(seat?.avatarId ?? 'avatar-1')} alt="" />
                {leader && (
                  <span className="av-leader-crown">
                    <Crown />
                  </span>
                )}
                {member && (
                  <span className="av-team-seal" aria-hidden="true">
                    ✓
                  </span>
                )}
                {ballot && (
                  <span
                    className={`av-ballot-badge av-ballot-badge--${ballot}`}
                  >
                    <BallotMark approve={ballot === 'approve'} />
                  </span>
                )}
              </span>
              <strong>{seat?.name ?? `座位 ${index + 1}`}</strong>
              <span className="av-seat-status">
                {game.phase === 'assassinate' && game.assassin === id
                  ? '刺客'
                  : submitted
                    ? '已提交'
                    : ballot
                      ? ballot === 'approve'
                        ? '赞成'
                        : '反对'
                      : leader
                        ? '队长'
                        : member
                          ? '远征队员'
                          : '圆桌成员'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function BallotResult({
  proposal,
  names,
}: {
  proposal: ProposalResult;
  names: Record<string, string>;
}) {
  return (
    <article
      className={`av-ballot-result av-ballot-result--${proposal.approved ? 'approved' : 'rejected'}`}
    >
      <h3>
        第 {proposal.questNumber} 次任务 · 提案 {proposal.proposalNumber}
      </h3>
      <p>
        <strong>{names[proposal.leader]}</strong>提名{' '}
        {proposal.team.map((id) => names[id]).join('、')}
      </p>
      <div className="av-public-ballots">
        {Object.entries(proposal.votes).map(([id, vote]) => (
          <span
            className={`av-public-ballot av-public-ballot--${vote}`}
            key={id}
          >
            <BallotMark approve={vote === 'approve'} />
            <strong>{names[id]}</strong>
            <span>{vote === 'approve' ? '赞成' : '反对'}</span>
          </span>
        ))}
      </div>
      <strong className="av-ballot-verdict">
        {proposal.approved ? '队伍通过' : '队伍否决'}
      </strong>
    </article>
  );
}

export function FinalResult({
  game,
  names,
}: {
  game: AvalonView;
  names: Record<string, string>;
}) {
  const reasons = {
    'three-failures': '三次任务失败',
    'five-rejections': '连续五支队伍遭到否决',
    'merlin-assassinated': '梅林被刺客识破',
    'merlin-survived': '梅林躲过了最后一剑',
  };
  return (
    <section className={`av-final av-final--${game.winner}`}>
      <div className="av-final-heading">
        <Relic kind={game.winner === 'good' ? 'grail' : 'raven'} />
        <div>
          <span>圆桌传奇落幕</span>
          <h1>{game.winner === 'good' ? '忠诚阵营获胜' : '邪恶阵营获胜'}</h1>
          <p>{game.winReason && reasons[game.winReason]}</p>
        </div>
      </div>
      {game.assassinationTarget && (
        <p className="av-assassination-result">
          {names[game.assassin ?? '']}的最后一剑指向了
          <strong>{names[game.assassinationTarget]}</strong>
        </p>
      )}
      <div className="av-revealed-roles">
        {game.seatOrder.map((id) => {
          const role = game.revealedRoles?.[id];
          return (
            role && (
              <article
                key={id}
                className={game.winners.includes(id) ? 'av-winner' : ''}
              >
                <RoleCard role={role} compact />
                <strong>{names[id]}</strong>
                {game.winners.includes(id) && <span>获胜</span>}
              </article>
            )
          );
        })}
      </div>
    </section>
  );
}
