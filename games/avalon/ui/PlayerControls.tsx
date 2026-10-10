import type { Action, AvalonView } from '../types';
import { BallotMark, Relic } from './Relic';

export function PlayerControls({
  game,
  actions,
  selected,
  locked,
  names,
  choose,
  showIdentity,
}: {
  game: AvalonView;
  actions: Action[];
  selected: string[];
  locked: boolean;
  names: Record<string, string>;
  choose(action: Action): void;
  showIdentity(): void;
}) {
  const action = (type: Action['type']) =>
    actions.find((entry) => entry.type === type);
  const proposal = actions.find(
    (entry) =>
      entry.type === 'propose-team' &&
      entry.team.length === selected.length &&
      entry.team.every((id) => selected.includes(id)),
  );
  const assassination = actions.find(
    (entry) => entry.type === 'assassinate' && entry.target === selected[0],
  );
  const submitted = game.self?.submitted;
  if (game.phase === 'ended') return null;
  return (
    <section
      className={`av-player-controls av-player-controls--${game.phase}`}
      data-av-controls={game.phase}
    >
      {game.phase === 'reveal' ? (
        <>
          <div className="av-action-copy">
            <strong>{submitted ? '你的宣誓已完成' : '你的角色已经分配'}</strong>
            <span>
              {submitted
                ? '等待圆桌同伴查看身份'
                : '查看身份与秘密知识后，确认入席'}
            </span>
          </div>
          <button
            type="button"
            className="av-primary"
            data-av-action="identity"
            onClick={showIdentity}
          >
            查看身份
          </button>
        </>
      ) : game.phase === 'team' && action('propose-team') ? (
        <>
          <div className="av-action-copy">
            <strong>由你提名远征队伍</strong>
            <span>
              已选 {selected.length} / {game.questSizes[game.questNumber - 1]}{' '}
              人
              {selected.length
                ? ` · ${selected.map((id) => names[id]).join('、')}`
                : ''}
            </span>
          </div>
          <button
            type="button"
            className="av-primary"
            data-av-action="propose"
            disabled={locked || !proposal}
            onClick={() => proposal && choose(proposal)}
          >
            提名队伍
          </button>
        </>
      ) : game.phase === 'vote' && action('vote-team') ? (
        <>
          <strong className="av-choice-title">是否赞成这支队伍？</strong>
          <div className="av-choice-cards">
            {(['approve', 'reject'] as const).map((vote) => {
              const choice = actions.find(
                (entry) => entry.type === 'vote-team' && entry.vote === vote,
              );
              return (
                choice && (
                  <button
                    type="button"
                    className={`av-ballot-card av-ballot-card--${vote}`}
                    data-av-action={`vote-${vote}`}
                    disabled={locked}
                    key={vote}
                    onClick={() => choose(choice)}
                  >
                    <BallotMark approve={vote === 'approve'} />
                    <strong>{vote === 'approve' ? '赞成' : '反对'}</strong>
                  </button>
                )
              );
            })}
          </div>
        </>
      ) : game.phase === 'quest' && action('quest-card') ? (
        <>
          <strong className="av-choice-title">秘密提交任务牌</strong>
          <div className="av-choice-cards">
            {(['success', 'fail'] as const).map((card) => {
              const choice = actions.find(
                (entry) => entry.type === 'quest-card' && entry.card === card,
              );
              return (
                choice && (
                  <button
                    type="button"
                    className={`av-mission-card av-mission-card--${card}`}
                    data-av-action={`quest-${card}`}
                    disabled={locked}
                    key={card}
                    onClick={() => choose(choice)}
                  >
                    <Relic kind={card === 'success' ? 'grail' : 'raven'} />
                    <strong>{card === 'success' ? '成功' : '失败'}</strong>
                  </button>
                )
              );
            })}
          </div>
          {actions.filter((entry) => entry.type === 'quest-card').length ===
            1 && (
            <span className="av-required-note">忠诚阵营必须提交成功。</span>
          )}
        </>
      ) : game.phase === 'assassinate' && action('assassinate') ? (
        <>
          <div className="av-action-copy">
            <strong>选出你认为是梅林的人</strong>
            <span>
              {selected[0]
                ? `你的最后一剑将指向 ${names[selected[0]]}`
                : '邪恶势力可公开商议，最终由你指认'}
            </span>
          </div>
          <button
            type="button"
            className="av-primary av-primary--danger"
            data-av-action="assassinate"
            disabled={locked || !assassination}
            onClick={() => assassination && choose(assassination)}
          >
            刺杀{selected[0] ? ` ${names[selected[0]]}` : '目标'}
          </button>
        </>
      ) : (
        <div className="av-action-copy av-action-copy--waiting">
          <strong>
            {submitted
              ? game.phase === 'vote'
                ? '表决已提交'
                : game.phase === 'quest'
                  ? '任务牌已封存'
                  : '已提交'
              : game.phase === 'team'
                ? `等待 ${names[game.leader]} 提名`
                : game.phase === 'assassinate'
                  ? `等待 ${names[game.assassin ?? '']} 刺杀`
                  : game.phase === 'quest'
                    ? '远征队员正在秘密提交'
                    : '圆桌同伴正在表决'}
          </strong>
          {submitted && game.self?.vote && (
            <span>
              你的选择：{game.self.vote === 'approve' ? '赞成' : '反对'} ·
              等待全员一起揭示
            </span>
          )}
          {submitted && game.self?.questCard && (
            <span>
              你的选择：{game.self.questCard === 'success' ? '成功' : '失败'} ·
              不向其他人公开
            </span>
          )}
        </div>
      )}
    </section>
  );
}
