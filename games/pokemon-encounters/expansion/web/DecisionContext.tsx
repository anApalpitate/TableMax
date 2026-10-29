import { coinArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { categoryPresentation } from '../cards';
import { Board, BufferCard, Card } from './Cards';
import {
  landscapeDecisionContent,
  portraitDecisionContent,
} from './DecisionContent';
import type { PlayerDecisionProps } from './player-decision-contract';
import { bufferedProfile, summaryOf } from './view-model';
export function DecisionContext(props: PlayerDecisionProps) {
  const { game, motion, landscape, decision } = props;
  const content = landscape
    ? landscapeDecisionContent
    : portraitDecisionContent;
  const {
    actions,
    mode,
    setMode,
    setTarget,
    setSlots,
    names,
    self,
    locked,
    choose,
    targets,
    chosenSeat,
  } = decision;
  return (
    <>
      {content.heading(props)}
      <div className="ex-decision-context">
        {game.coin && (
          <div className="ex-coin-result" role="status">
            <span className="coin-face">
              <img src={coinArt[game.coin]} alt="" />
            </span>
            <strong>{game.coin === 'meowth' ? '喵喵面' : '皮卡丘面'}</strong>
          </div>
        )}
        {game.held && (
          <div className="ex-held" data-pile="held">
            <Card profile={game.rulesProfile} face={game.held} />
            <div>
              <span className="ex-held-label">当前取牌</span>
              <strong>{game.held.name}</strong>
              {game.drawSource !== 'deck' && (
                <span className="ex-source-rule">
                  <span className="ex-source-label-full">
                    {game.drawSource === 'buffer'
                      ? '来自本人缓冲'
                      : '来自弃牌堆'}
                    ，必须使用
                  </span>
                  <span className="ex-source-label-compact">
                    <span>
                      {game.drawSource === 'buffer' ? '本人缓冲' : '弃牌堆'}
                    </span>
                    <span>必须换入</span>
                  </span>
                </span>
              )}
              <p
                className={
                  game.held.abilityUsed && game.held.ability
                    ? 'ex-held-ability-used'
                    : 'ex-held-summary'
                }
              >
                {game.held.abilityUsed && game.held.ability ? (
                  <>
                    能力已使用
                    <span className="ex-placement-reminder">
                      ，选择位置换入
                    </span>
                  </>
                ) : (
                  categoryPresentation(game.held.categoryId, game.rulesProfile)
                    .abilitySummary || '选择位置换入'
                )}
              </p>
              {game.held.abilityText && !game.held.abilityUsed && (
                <details>
                  <summary>能力说明</summary>
                  <p>{game.held.abilityText}</p>
                </details>
              )}
              <BufferCard game={game} seat={self} />
            </div>
          </div>
        )}
        {!game.held && (
          <span
            className="ex-held-anchor"
            data-pile="held"
            aria-hidden="true"
          />
        )}
        {(game.phase === 'draw' || game.phase === 'lucario-draw') && (
          <div className="ex-draw-options">
            <button
              className="ex-source"
              data-pile="deck"
              data-action="draw"
              data-source="deck"
              disabled={
                locked ||
                !actions.some((a) => a.type === 'draw' && a.source === 'deck')
              }
              onClick={() => choose({ type: 'draw', source: 'deck' })}
            >
              <strong>摸牌堆</strong>
              {content.sourceFace(
                <>
                  <Card profile={game.rulesProfile} face={null} compact />
                </>,
                <>
                  <span>
                    取一张牌<b>{game.deckCount} 张</b>
                  </span>
                </>,
              )}
            </button>
            {(game.phase === 'draw'
              ? bufferedProfile(game.rulesProfile)
                ? [0]
                : [0, 1]
              : []
            ).map((index) => {
              const i = index as 0 | 1;
              const face = game.discardOptions[i] ?? null;
              return (
                <button
                  key={i}
                  className="ex-source"
                  data-pile={i === 0 ? 'discard' : 'discard-second'}
                  data-action="draw"
                  data-source="discard"
                  data-discard-index={i}
                  disabled={
                    locked ||
                    !actions.some(
                      (a) =>
                        a.type === 'draw' &&
                        a.source === 'discard' &&
                        a.discardIndex === i,
                    )
                  }
                  onClick={() =>
                    choose({
                      type: 'draw',
                      source: 'discard',
                      discardIndex: i,
                    })
                  }
                >
                  <strong>
                    {bufferedProfile(game.rulesProfile)
                      ? '弃牌顶部'
                      : `可选弃牌${i + 1}`}
                  </strong>
                  {content.sourceFace(
                    <>
                      {face ? (
                        <Card profile={game.rulesProfile} face={face} compact />
                      ) : (
                        <span className="ex-empty-source">—</span>
                      )}
                    </>,
                    <>
                      <span>
                        {face?.name ?? '暂无卡牌'}
                        <b>
                          {face
                            ? summaryOf(face, game.rulesProfile)
                            : '不可选择'}
                        </b>
                      </span>
                    </>,
                  )}
                </button>
              );
            })}
            {game.buffersBySeat && game.phase === 'draw' && (
              <button
                className="ex-source ex-buffer-source"
                data-pile="buffer"
                data-seat={self}
                data-action="draw-buffer"
                disabled={
                  locked || !actions.some((a) => a.type === 'draw-buffer')
                }
                onClick={() => choose({ type: 'draw-buffer' })}
              >
                <strong>本人缓冲</strong>
                {content.sourceFace(
                  <>
                    {game.buffersBySeat[self] ? (
                      <Card
                        profile={game.rulesProfile}
                        face={game.buffersBySeat[self]!}
                        compact
                      />
                    ) : (
                      <span className="ex-buffer-empty" aria-hidden="true">
                        ＋
                      </span>
                    )}
                  </>,
                  <>
                    <span>
                      {game.buffersBySeat[self]?.name ?? '空位'}
                      <b>
                        {game.buffersBySeat[self]
                          ? '取出后必须使用'
                          : '尚未存牌'}
                      </b>
                    </span>
                  </>,
                )}
              </button>
            )}
            {game.phase === 'draw' && (
              <button
                className={`ex-source ex-reposition-source ${mode === 'reposition' ? 'selected' : ''}`}
                disabled={
                  locked || !actions.some((a) => a.type === 'reposition')
                }
                onClick={() => {
                  setMode(mode === 'reposition' ? '' : 'reposition');
                  setSlots([]);
                }}
              >
                <strong>卡牌换位</strong>
                {content.sourceFace(
                  <>
                    <span className="ex-swap-mark" aria-hidden="true">
                      <svg viewBox="0 0 72 90">
                        <rect x="5" y="9" width="30" height="47" rx="5" />
                        <rect x="37" y="34" width="30" height="47" rx="5" />
                        <path d="M12 71h18l-6-6m6 6-6 6M60 18H42l6-6m-6 6 6 6" />
                      </svg>
                    </span>
                  </>,
                  <>
                    <span>
                      交换两格<b>结束本回合</b>
                    </span>
                  </>,
                )}
              </button>
            )}
          </div>
        )}
        {(targets.length > 0 || chosenSeat !== self) && (
          <div className="ex-target-controls">
            {targets.length > 0 && (
              <div className="ex-target-list" aria-label="目标玩家">
                {targets.map((id) => (
                  <button
                    key={id}
                    data-target-seat={id}
                    className={chosenSeat === id ? 'selected' : ''}
                    disabled={locked}
                    onClick={() => {
                      setTarget(id);
                      setSlots([]);
                    }}
                  >
                    {names[id] ?? id}
                  </button>
                ))}
              </div>
            )}
            {chosenSeat !== self && (
              <details className="ex-own-preview">
                <summary>查看本人场地</summary>
                <Board game={game} seat={self} motion={motion} />
              </details>
            )}
          </div>
        )}
      </div>
    </>
  );
}
