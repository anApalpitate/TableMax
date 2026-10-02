import type { PokemonView } from '../../rules/project';
import { categories } from '../../rules/cards';
import { Board, CardFace } from '../cards';
import { phaseLabels } from '../phases';
import { coinArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { useContext, useId, useRef } from 'react';
import { SavedMotion } from '../motion';
import type { JsonValue } from '@tablemax/game-sdk';
import type { Action } from '../../rules';
import { WinTrack } from '../WinTrack';
import { presentAction } from '../action-presentation';
export function SeatResult({
  view,
  seatId,
}: {
  view: PokemonView | null;
  seatId: string;
}) {
  const scorePanel = useRef<HTMLDialogElement>(null);
  const scoreTitle = useId();
  if (!view) return null;
  const score = view.roundResult?.scores[seatId];
  return (
    <>
      <WinTrack
        wins={view.winsBySeat[seatId]!}
        winner={
          view.matchWinners.includes(seatId)
            ? 'match'
            : view.roundResult?.winners.includes(seatId)
              ? 'round'
              : undefined
        }
      />
      <Board view={view} seatId={seatId} />
      {score && (
        <div className="score-detail">
          <button
            className="secondary score-breakdown"
            onClick={() => scorePanel.current?.showModal()}
            aria-label="计分明细"
          >
            <strong>总分 {score.total}</strong>
            <span aria-hidden="true">ⓘ</span>
          </button>
          <dialog
            ref={scorePanel}
            className="card-gallery-panel"
            aria-labelledby={scoreTitle}
            onCancel={(event) => event.stopPropagation()}
          >
            <header className="gallery-heading">
              <h2 id={scoreTitle}>计分明细 · 总分 {score.total}</h2>
              <button
                className="secondary"
                onClick={() => scorePanel.current?.close()}
              >
                关闭
              </button>
            </header>
            <p>三列贡献：{score.columns.join(' / ')}</p>
            {score.copies.length > 0 && (
              <section>
                <h3>百变怪解析</h3>
                {score.copies.map((copy) => (
                  <p key={copy.slot}>
                    百变怪 {copy.slot + 1} → {copy.value}（路径{' '}
                    {copy.path.map((slot) => slot + 1).join(' → ')}）
                  </p>
                ))}
              </section>
            )}
          </dialog>
        </div>
      )}
    </>
  );
}
export function TableStatus({
  view,
  names,
  drawActions = [],
  onDraw,
}: {
  view: PokemonView;
  names: Record<string, string>;
  drawActions?: readonly JsonValue[];
  onDraw?: ((action: JsonValue) => void) | undefined;
}) {
  const gallery = useRef<HTMLDialogElement>(null);
  const galleryTitle = useId();
  const motion = useContext(SavedMotion);
  const draws = (drawActions as readonly Action[]).filter(
    (action) => action.type === 'draw',
  );
  const pile = (source: 'deck' | 'discard') => {
    const action = draws.find(
      (action) => action.type === 'draw' && action.source === source,
    );
    const face = <CardFace card={source === 'deck' ? null : view.discardTop} />;
    return onDraw && view.phase === 'draw' ? (
      <button
        className="draw-pile"
        disabled={!action}
        aria-label={source === 'deck' ? '从牌库取牌' : '从弃牌顶取牌'}
        onClick={() => {
          if (action) onDraw(action);
        }}
      >
        {face}
        <span className="pile-action">{action ? '点此取牌' : '等待'}</span>
      </button>
    ) : (
      face
    );
  };
  return (
    <div className="pokemon-status">
      <div className={motion.includes('@phase') ? 'saved-motion' : ''}>
        <span className="eyebrow">第 {view.roundNumber} 小局 · 三胜大局</span>
        <h2>{phaseLabels[view.phase]}</h2>
        <p>
          {view.actorSeat
            ? `${names[view.actorSeat]} 选择中`
            : view.phase === 'initial-flip'
              ? `已完成 ${view.initialDone.length} / ${view.seatOrder.length}`
              : '最低分获胜；同分共同记胜。'}
          {view.passProgress &&
            ` · 传牌 ${view.passProgress.completed + 1} / ${view.passProgress.total}`}
        </p>
        {view.coin && (
          <span className="coin-result">
            <span
              className={`coin-face ${motion.includes('@coin') ? 'saved-coin' : ''}`}
            >
              <img src={coinArt[view.coin]} alt="" />
            </span>
            硬币 · {view.coin === 'meowth' ? '喵喵面' : '皮卡丘面'}
          </span>
        )}
      </div>
      <div className="card-piles">
        <div>
          <span className="pile-label">牌库 {view.deckCount}</span>
          {pile('deck')}
        </div>
        <div>
          <span className="pile-label">弃牌 {view.discardCount}</span>
          {view.discardTop ? (
            pile('discard')
          ) : (
            <span className="empty-pile">暂时为空</span>
          )}
        </div>
        {view.held && (
          <div
            className={`held-pile ${motion.includes('@held') ? 'saved-motion' : ''}`}
          >
            <span className="pile-label">公开暂持牌</span>
            <CardFace card={view.held} />
          </div>
        )}
      </div>
      {view.discard && view.discard.length > 0 && (
        <div className="discard-control">
          <button
            className="secondary"
            onClick={() => gallery.current?.showModal()}
          >
            查看弃牌（{view.discard.length}）
          </button>
          <dialog
            ref={gallery}
            className="card-gallery-panel"
            aria-labelledby={galleryTitle}
          >
            <header className="gallery-heading">
              <h2 id={galleryTitle}>弃牌 · 底 → 顶</h2>
              <button
                className="secondary"
                onClick={() => gallery.current?.close()}
              >
                关闭
              </button>
            </header>
            <div className="discard-gallery">
              {view.discard.map((card, i) => (
                <CardFace key={i} card={card} />
              ))}
            </div>
          </dialog>
        </div>
      )}
    </div>
  );
}
export function PublicLog({
  view,
  names = {},
}: {
  view: PokemonView;
  names?: Record<string, string>;
}) {
  return (
    <details className="public-log">
      <summary>公开操作记录</summary>
      <ol>
        {view.events
          .slice()
          .reverse()
          .map((event) => {
            const item = event.action
              ? presentAction(event.action, names)
              : null;
            return (
              <li key={event.id}>
                {item
                  ? `${item.actor} · ${item.title}${item.detail ? ` · ${item.detail}` : ''}`
                  : event.text}
              </li>
            );
          })}
      </ol>
    </details>
  );
}
export function GameHelp() {
  return (
    <div className="game-help">
      <p>
        采用规则 tablemax-cn-s19-v1。2–6
        人，每人两行三列六张牌。各自选翻一张后开始，暗牌不能默认偷看。顺时针取牌库顶或非空弃牌顶；新摸牌公开。
      </p>
      <p>
        牌库牌可替换己方任意一格或直接弃顶；弃牌顶必须替换。三种强制能力不能绕过。换入朝上、换出公开弃顶。牌库耗尽时整个弃牌堆重洗，不保留顶牌。
      </p>
      <p>
        当前操作或整段能力完成后，任意一人六张全明便立即揭示全员并结算，不增加其他人的最后回合。同列有效数值相等都计零，否则相加；最低分所有人各记一胜，任意人第三胜结束大局，同时达标共同获胜。下一小局从共同赢家随机一人开始，重新洗发、各翻一张。
      </p>
      {categories
        .filter((card) => card.abilityDefinition)
        .map((card) => (
          <p key={card.categoryId}>
            <strong>
              {card.displayName} ·{' '}
              {card.value.kind === 'fixed' ? card.value.number : '?'}
            </strong>
            <br />
            {card.abilityDefinition!.adoptedText}
          </p>
        ))}
      <p>
        能力只检查正常回合新摸并换入：初始翻牌、传递、移动、火箭队补牌和结算揭示不连锁。可选能力必须完成发动或放弃后才检查结束；喷火龙无暗牌自动跳过。
      </p>
      <p>
        火箭队皮卡丘面先弃行动者选牌、火箭队，再顺时针弃其余同格，每张逐次插到弃牌底；全部移出后从行动者起顺时针朝上补位。闪电鸟由每位接牌者本人选位，最后换出牌弃底。
      </p>
      <p>
        百变怪复制本行紧邻左右数字，可沿另一百变怪到真实数字锚点，不能纯循环。联合取含配对的最低总分；同分按解析值序列升序、左优先确定展示。房主普通模式不能看暗牌；回退不能撤销人已记住的信息。
      </p>
    </div>
  );
}
