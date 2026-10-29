import type { View, Face } from '../project';
import { type RulesProfile } from '../research';
import { categoryPresentation } from '../cards';
import { BoardGrid } from '../../ui/BoardGrid';
import { CardSkin } from '../../ui/CardSkin';
import { portraitFor } from './card-art';
import { portraitBoundsFor } from './portrait-bounds';
import { cardArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { CircularBadge } from './CircularBadge';
import { faceEffectText, eventLabels } from './event-presentation';

export function BufferCard({
  game,
  seat,
  label = '本人缓冲',
  publicCard = false,
}: {
  game: View;
  seat: string;
  label?: string;
  publicCard?: boolean;
}) {
  if (!game.buffersBySeat) return null;
  const face = game.buffersBySeat[seat] ?? null;
  return (
    <div
      className={`ex-buffer-card ${face ? 'occupied' : 'empty'}`}
      data-pile="buffer"
      data-seat={seat}
      aria-label="缓冲区"
    >
      {face ? (
        <span className="ex-buffer-portrait">
          <img
            src={portraitFor(face.categoryId) ?? cardArt(face.categoryId).image}
            alt=""
          />
          <b>{face.value ?? (face.copy === 'vertical' ? '↕' : '↔')}</b>
        </span>
      ) : (
        <span className="ex-buffer-empty" aria-hidden="true">
          ＋
        </span>
      )}
      <div>
        <span
          className="ex-buffer-label"
          title={publicCard ? label : undefined}
        >
          {label}
        </span>
        <strong>{face?.name ?? '未存牌'}</strong>
        <span className="ex-buffer-state">
          {face
            ? publicCard
              ? face.ability
                ? face.abilityUsed
                  ? '能力已用'
                  : '能力未用'
                : face.copy
                  ? '被动复制'
                  : '普通牌'
              : face.abilityUsed && face.ability
                ? '能力已使用'
                : '取出后必须使用'
            : '最多一张，所有人可见'}
        </span>
      </div>
    </div>
  );
}

export function Card({
  face,
  compact = false,
  effective,
  profile,
}: {
  face: Face | null;
  compact?: boolean;
  effective?: number | undefined;
  profile?: RulesProfile | undefined;
}) {
  const art = face ? cardArt(face.categoryId) : null;
  const presentation = face
    ? categoryPresentation(face.categoryId, profile)
    : null;
  const source = face ? faceEffectText(face) : null;
  const value =
    effective ??
    face?.effectiveValue ??
    face?.value ??
    (face?.copy === 'vertical' ? '↕' : '↔');
  return (
    <CardSkin
      face={face}
      image={face ? (portraitFor(face.categoryId) ?? art?.image) : undefined}
      frame={presentation?.frame}
      bounds={face ? portraitBoundsFor(face.categoryId) : undefined}
      className={`ex-card ${compact ? 'compact' : ''} ${face?.scoreEffect ? `weather-${face.scoreEffect.kind}` : ''}`}
      value={
        source && face ? (
          <span
            className="ex-value-stack"
            data-score-effect={face.scoreEffect?.kind ?? 'trick-room'}
            data-effective-value={value}
            title={source}
            aria-label={`${value}分，${source}`}
          >
            <span>{value}</span>
            <span className="ex-score-source" aria-hidden="true">
              {face.scoreEffect ? (
                <>
                  {face.scoreEffect.inherited ? '↳' : ''}
                  {eventLabels[face.scoreEffect.kind].replace('天', '')}
                  {face.scoreEffect.delta >= 0 ? '+' : '−'}
                  {Math.abs(face.scoreEffect.delta)}
                </>
              ) : (
                '戏法互换'
              )}
            </span>
          </span>
        ) : (
          value
        )
      }
    />
  );
}

export function Board({
  game,
  seat,
  selected = [],
  selectable = [],
  select,
  locked = false,
  motion = [],
}: {
  game: View;
  seat: string;
  selected?: number[];
  selectable?: number[];
  select?: (slot: number) => void;
  locked?: boolean;
  motion?: readonly string[];
}) {
  const board = game.boards[seat] ?? [];
  if (board.length !== 9)
    return <div className="ex-board-placeholder">研究确定后发放九张牌</div>;
  const zero = game.roundResult?.scores[seat]?.zeroSlots ?? [];
  return (
    <BoardGrid
      layout={{ rows: 3, columns: 3 }}
      selected={selected}
      selectable={selectable}
      locked={locked}
      select={select}
      renderIndex={(index) => <CircularBadge value={index + 1} />}
      slots={board.map((slot, i) => ({
        id: slot.slotId,
        label: `位置${i + 1}：${slot.card ? `${slot.card.name}，${slot.card.effectiveValue ?? slot.card.value ?? '复制'}${faceEffectText(slot.card) ? `，${faceEffectText(slot.card)}` : ''}` : '暗牌'}`,
        className: `${motion.includes(slot.slotId) ? 'ex-saved' : ''} ${zero.includes(i) ? 'ex-zero' : ''}`,
        content: (
          <Card
            face={slot.card}
            profile={game.rulesProfile}
            effective={game.roundResult?.scores[seat]?.values[i]}
          />
        ),
      }))}
    />
  );
}

export function TurnProgress({ game }: { game: View }) {
  if (
    ['research-vote', 'initial-flip', 'round-result', 'match-result'].includes(
      game.phase,
    )
  )
    return null;
  let stages = ['取牌', '放入', '能力'];
  let current = game.phase === 'draw' ? 0 : game.phase === 'place' ? 1 : 2;
  if (game.phase === 'mew-other' || game.phase === 'mew-self') {
    stages = ['取牌', '偷取', '换入'];
    current = game.phase === 'mew-other' ? 1 : 2;
  } else if (game.phase.startsWith('rocket-')) {
    stages = ['取牌', '掷币', '换入'];
  } else if (game.phase.startsWith('zapdos-')) {
    stages = ['取牌', '接力', '换入'];
    current = game.phase === 'zapdos-direction' ? 1 : 2;
  } else if (game.phase.startsWith('mewtwo-')) {
    stages = ['取牌', '私看', '交换'];
    current = game.phase === 'mewtwo-target' ? 1 : 2;
  }
  return (
    <ol className="ex-turn-progress" aria-label="回合阶段">
      {stages.map((label, i) => (
        <li
          key={label}
          className={i === current ? 'current' : i < current ? 'complete' : ''}
          aria-current={i === current ? 'step' : undefined}
        >
          <CircularBadge
            value={i < current ? '✓' : i + 1}
            className="ex-progress-number"
          />
          {label}
        </li>
      ))}
    </ol>
  );
}
