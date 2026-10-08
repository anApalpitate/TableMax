/* eslint-disable react-refresh/only-export-components -- Independent expansion client adapter. */
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { GameClient, GameHost } from '@tablemax/web-host';
import {
  avatarFor,
  useAudioOutput,
  OverlayPanel,
  RulesGuide,
  ScreenLink,
  FullscreenControl,
  DisplaySettings,
  RoomManagement,
  SessionFeedback,
  PlayModeControl,
  PlayModeBadge,
  CountdownSettings,
} from '@tablemax/web-host';
import type { JsonValue } from '@tablemax/game-sdk';
import type { View, Face } from '../project';
import type { Action } from '../state';
import { task, tasksForProfile, type RulesProfile } from '../research';
import { categories, categoryPresentation } from '../cards';
import { BoardGrid } from '../../ui/BoardGrid';
import { CardSkin } from '../../ui/CardSkin';
import { WinTrack } from '../../ui/WinTrack';
import { ResearchCard, ResearchPicture } from './ResearchCard';
import { ResearchReward } from './ResearchReward';
import { portraitFor } from './card-art';
import { portraitBoundsFor } from './portrait-bounds';
import {
  cardArt,
  coinArt,
} from '../../../../assets/games/pokemon-encounters/catalog';
import { SoundControl } from '../../ui/audio';
import { expansionVoices } from './voice-resources';
import { expansionSoundRecipe, expansionThemeFor } from './presentation';
import { SavedEffects } from './SavedEffects';
import { poseSequences } from './poses/timeline';
import { GuideScene } from '../../ui/RuleDiagrams';
import { CircularBadge } from './CircularBadge';
import { presentedWins } from './playback';
import {
  researchAdjustmentText,
  researchRewardText,
  researchRiskText,
  researchScoreText,
} from './research-presentation';
import {
  ExpansionPresentation,
  useExpansionPresentation,
} from './PresentationContext';
import './style.css';
import './redesign.css';
import './refinement.css';
import './player-flow.css';
import './player-wide.css';

const poseDurations = Object.fromEntries(
  Object.entries(poseSequences).map(([id, sequence]) => [
    id,
    sequence.durationMs,
  ]),
);

const expansionThemes = import.meta.glob<string>(
  '../../../../assets/games/pokemon-encounters/expansion/audio/*.ogg',
  { eager: true, query: '?url', import: 'default' },
);

const phaseText: Record<View['phase'], string> = {
  'research-vote': '投票选择研究任务',
  'initial-flip': '翻开一张初始牌',
  draw: '选择取牌来源',
  place: '选择放入位置',
  'mew-other': '梦幻：选择对手一张牌',
  'mew-self': '梦幻：换入本人场地',
  'rocket-meowth': '火箭队：选择换入位置',
  'rocket-pikachu': '火箭队：选择全桌同一位置',
  'zapdos-direction': '闪电鸟：选择传牌方向',
  'zapdos-self': '闪电鸟：选择换入位置',
  'zapdos-receive': '闪电鸟：接力换入',
  'snorlax-choice': '卡比兽：交换本人两张',
  'charizard-choice': '喷火龙：查看一张暗牌',
  'charizard-view': '喷火龙：本人私看',
  'mewtwo-target': '超梦：查看同一对手两张',
  'mewtwo-choice': '超梦：选择交换或放弃',
  'arceus-choice': '阿尔宙斯：盖回全桌，每人随机一明',
  'greninja-choice': '忍蛙：选择两格盖回',
  'lucario-choice': '路卡利欧：额外取一张',
  'lucario-draw': '路卡利欧：额外取牌',
  'row-choice': '三神：交换对应一整行',
  'round-result': '本小局结算',
  'match-result': '大局结束',
};
const labels: Partial<Record<Action['type'], string>> = {
  'decline-ability': '放弃能力',
  'close-peek': '查看完成',
  'activate-arceus': '发动 · 每人随机一明',
  'extra-draw': '再取一张',
  'discard-held': '弃掉这张牌',
  'pass-direction': '选择传牌方向',
};
const namesOf = (session: GameHost) =>
  Object.fromEntries(session.view?.seats.map((s) => [s.id, s.name]) ?? []);
const summaryOf = (face: Face) =>
  face.abilityUsed && face.ability
    ? '能力已使用'
    : categoryPresentation(face.categoryId).abilitySummary ||
      `${face.value ?? '复制'} 分`;
const pairTypes = ['swap', 'reposition', 'mewtwo-target', 'ninja-target'];
function eventText(
  event: View['events'][number],
  names: Record<string, string>,
) {
  const action = event.action;
  if (!action || !action.actor) return event.text;
  if (action.verb === 'activate-arceus')
    return `${names[action.actor] ?? '玩家'}发动阿尔宙斯：全桌盖回，每人随机翻明一格。`;
  const verbs: Record<string, string> = {
    draw: '取出',
    replace: '换入',
    peek: '查看本人暗牌',
    'mew-target': '将梦幻换入',
    'mewtwo-target': '发动精神侦察',
    'mewtwo-exchange': '选择交换',
    swap: '交换本人两格',
    reposition: '调整本人两格',
    'ninja-target': '用忍蛙处理两格',
    'ninja-cover': '盖回两张牌',
    'ninja-swap': '盖回并交换两张牌',
    'row-target': '交换整行',
    'pass-direction': '确定接力方向',
    'activate-arceus': '发动返璞归真',
    'extra-draw': '继续额外取牌',
    'close-peek': '完成私看',
    'decline-ability': '放弃可选能力',
    'initial-flip': '翻开初始牌',
    'discard-held': '弃掉暂持牌',
    'store-buffer': '将暂持牌存入本人缓冲',
    'draw-buffer': '从本人缓冲取出',
  };
  const category =
    categories.find((c) => c.categoryId === action.cardCategory) ??
    categories.find((c) => c.ability !== null && c.ability === action.ability);
  const targets = action.targets
    .map(
      (t) =>
        `${names[t.seat] ?? '玩家'}的${t.slots.map((i) => i + 1).join('、')}号位`,
    )
    .join('；');
  return `${names[action.actor] ?? '玩家'}${verbs[action.verb] ?? '完成操作'}${category ? ` ${category.name}` : ''}${targets ? `，目标为${targets}` : ''}。`;
}

function BufferCard({
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
function Card({
  face,
  compact = false,
  effective,
}: {
  face: Face | null;
  compact?: boolean;
  effective?: number | undefined;
}) {
  const art = face ? cardArt(face.categoryId) : null;
  const presentation = face ? categoryPresentation(face.categoryId) : null;
  return (
    <CardSkin
      face={face}
      image={face ? (portraitFor(face.categoryId) ?? art?.image) : undefined}
      frame={presentation?.frame}
      bounds={face ? portraitBoundsFor(face.categoryId) : undefined}
      className={`ex-card ${compact ? 'compact' : ''}`}
      value={
        effective ?? face?.value ?? (face?.copy === 'vertical' ? '↕' : '↔')
      }
    />
  );
}

function Board({
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
        label: `位置${i + 1}：${slot.card ? `${slot.card.name}，${slot.card.value ?? '复制'}` : '暗牌'}`,
        className: `${motion.includes(slot.slotId) ? 'ex-saved' : ''} ${zero.includes(i) ? 'ex-zero' : ''}`,
        content: (
          <Card
            face={slot.card}
            effective={game.roundResult?.scores[seat]?.values[i]}
          />
        ),
      }))}
    />
  );
}

function TurnProgress({ game }: { game: View }) {
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

function PublicSupply({
  game,
  names,
  research,
}: {
  game: View;
  names: Record<string, string>;
  research: ReactNode;
}) {
  const { motion } = useExpansionPresentation();
  const fresh = game.events.filter((event) =>
    motion.includes(`event:${event.id}`),
  );
  const moved = fresh.at(-1)?.action;
  return (
    <aside className="ex-supply">
      <header className="ex-supply-heading">
        <h2>公开牌区</h2>
        <span>弃牌共 {game.discardCount} 张</span>
      </header>
      {game.coin && (
        <div className="ex-coin-result" role="status">
          <span className="coin-face">
            <img src={coinArt[game.coin]} alt="" />
          </span>
          <strong>{game.coin === 'meowth' ? '喵喵面' : '皮卡丘面'}</strong>
        </div>
      )}
      <div className="ex-public-piles">
        <section data-pile="deck">
          <header>
            <strong>摸牌堆</strong>
            <span>{game.deckCount} 张</span>
          </header>
          <Card face={null} compact />
        </section>
        {(game.rulesProfile === 'research-buffer-v2' ? [0] : [0, 1]).map(
          (i) => (
            <section key={i} data-pile={i === 0 ? 'discard' : 'discard-second'}>
              <header>
                <strong>
                  {game.rulesProfile === 'research-buffer-v2'
                    ? '弃牌顶部'
                    : `可选弃牌${i + 1}`}
                </strong>
              </header>
              {game.discardOptions[i] ? (
                <Card face={game.discardOptions[i]} compact />
              ) : (
                <div className="ex-empty-pile">暂无</div>
              )}
            </section>
          ),
        )}
      </div>
      <section
        className={`ex-public-held ${game.held ? 'has-held' : ''} ${moved && ['draw', 'draw-buffer'].includes(moved.verb) ? 'ex-saved' : ''}`}
        data-pile="held"
        aria-label="公开暂持区"
      >
        {game.held ? (
          <>
            <Card face={game.held} />
            <div>
              <span>当前取牌</span>
              <strong>{game.held.name}</strong>
              <p>
                {game.held.abilityUsed && game.held.ability
                  ? '能力已使用，选择一格放入场地'
                  : categoryPresentation(game.held.categoryId).abilitySummary ||
                    '选一格放入场地'}
              </p>
            </div>
          </>
        ) : (
          <>
            <svg viewBox="0 0 48 56" aria-hidden="true">
              <rect x="12" y="4" width="30" height="43" rx="5" />
              <path d="M7 14H4v37h29" />
              <circle cx="27" cy="25" r="8" />
              <path d="M19 25h16" />
            </svg>
            <div>
              <span>暂持区</span>
              <strong>
                {game.phase === 'draw' ? '等待取牌' : '本次操作已完成'}
              </strong>
            </div>
          </>
        )}
      </section>
      <div className="ex-last-action" role="status">
        <span>最近行动</span>
        <p>{game.events.at(-1) && eventText(game.events.at(-1)!, names)}</p>
      </div>
      {game.buffersBySeat && (
        <section className="ex-public-buffers" aria-label="公开缓冲区">
          <h3>玩家缓冲</h3>
          <div>
            {game.seatOrder.map((seat) => (
              <BufferCard
                key={seat}
                game={game}
                seat={seat}
                label={names[seat] ?? '玩家'}
                publicCard
              />
            ))}
          </div>
        </section>
      )}
      {research}
    </aside>
  );
}

function Actions({
  session,
  game,
  showResearch,
}: {
  session: GameHost;
  game: View;
  showResearch: (id: string) => void;
}) {
  const { motion } = useExpansionPresentation();
  const actions = (session.view?.actions ?? []) as Action[];
  const [mode, setMode] = useState(''),
    [target, setTarget] = useState(''),
    [slots, setSlots] = useState<number[]>([]),
    [exchange, setExchange] = useState(false);
  const names = namesOf(session),
    self = session.self?.id ?? '',
    locked = session.locked || !session.connected;
  const choose = (action: Action) => {
    if (!locked && session.view?.decisionId)
      session.command({
        type: 'game',
        decisionId: session.view.decisionId,
        action: action as unknown as JsonValue,
      });
  };
  const selectedType =
    mode ||
    actions.find(
      (a) => pairTypes.includes(a.type) || 'slot' in a || 'seat' in a,
    )?.type;
  const working = actions.filter((a) => a.type === selectedType);
  const targets = [
    ...new Set(working.flatMap((a) => ('seat' in a ? [a.seat] : []))),
  ];
  const chosenSeat = target || targets[0] || self;
  const candidates = working.filter(
    (a) => !('seat' in a) || a.seat === chosenSeat,
  );
  const single = candidates.filter(
    (a): a is Extract<Action, { slot: number }> => 'slot' in a,
  );
  const pairs = candidates.filter(
    (a): a is Extract<Action, { a: number; b: number }> => 'a' in a,
  );
  const selectable = [
    ...new Set(
      single.map((a) => a.slot).concat(pairs.flatMap((a) => [a.a, a.b])),
    ),
  ];
  const select = (i: number) =>
    setSlots((prev) =>
      prev.includes(i)
        ? prev.filter((s) => s !== i)
        : pairs.length
          ? [...prev.slice(-1), i]
          : [i],
    );
  const chosen =
    single.find((a) => slots.length === 1 && a.slot === slots[0]) ??
    pairs.find(
      (a) =>
        slots.length === 2 &&
        a.a === Math.min(...slots) &&
        a.b === Math.max(...slots) &&
        (!('swap' in a) || a.swap === exchange),
    );
  const commandLabel =
    selectedType === 'initial-flip'
      ? '翻开这张牌'
      : selectedType === 'peek'
        ? '查看这张暗牌'
        : selectedType === 'mew-target'
          ? '换入对手此格'
          : selectedType === 'mewtwo-target'
            ? '查看这两张牌'
            : selectedType === 'ninja-target'
              ? exchange
                ? '盖回并交换这两格'
                : '盖回这两格'
              : selectedType === 'reposition'
                ? '本回合交换这两格'
                : selectedType === 'swap'
                  ? '交换这两格'
                  : '换入这个位置';
  const heldOptions =
    game.held &&
    actions.some(
      (a) => a.type === 'discard-held' || a.type === 'store-buffer',
    ) ? (
      <div className="ex-held-options" aria-label="暂持牌其他处理">
        {actions
          .filter((a) => a.type === 'discard-held' || a.type === 'store-buffer')
          .map((a) => (
            <button
              key={a.type}
              data-action={a.type}
              className={
                a.type === 'discard-held'
                  ? 'ex-discard-action'
                  : 'ex-store-action'
              }
              disabled={locked}
              onClick={() => choose(a)}
            >
              {a.type === 'discard-held' ? '弃到牌堆' : '存入本人缓冲'}
            </button>
          ))}
      </div>
    ) : null;
  if (game.phase === 'research-vote')
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
          {game.ownVote
            ? '投票已锁定，等待其他玩家'
            : '选择一项投票 · 提交后锁定'}
        </p>
      </section>
    );
  if (!actions.length)
    return (
      <section className="ex-actions ex-observing" aria-label="本人场地">
        <header className="ex-action-heading">
          <img src={avatarFor(session.self?.avatarId ?? 'builtin-1')} alt="" />
          <h2>{session.self?.name ?? '本人'}的场地</h2>
          <WinTrack wins={game.winsBySeat[self] ?? 0} />
        </header>
        <div className="ex-wait" role="status">
          {game.actorSeat
            ? `${names[game.actorSeat]}正在行动`
            : '等待其他玩家翻牌'}
        </div>
        <Board game={game} seat={self} motion={motion} />
        <BufferCard game={game} seat={self} />
      </section>
    );
  return (
    <section className="ex-actions" aria-label="本人操作">
      <header className="ex-action-heading">
        <img src={avatarFor(session.self?.avatarId ?? 'builtin-1')} alt="" />
        <h2 title={session.self?.name ?? '本人'}>
          {session.self?.name ?? '本人'}
        </h2>
        <WinTrack wins={game.winsBySeat[self] ?? 0} />
      </header>
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
          <Card face={game.held} />
          <div>
            <span className="ex-held-label">当前取牌</span>
            <strong>{game.held.name}</strong>
            {game.drawSource !== 'deck' && (
              <span className="ex-source-rule">
                <span className="ex-source-label-full">
                  {game.drawSource === 'buffer' ? '来自本人缓冲' : '来自弃牌堆'}
                  ，必须使用
                </span>
                <span className="ex-source-label-compact">
                  {game.drawSource === 'buffer' ? '本人缓冲' : '弃牌堆'} ·
                  必须换入
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
                  <span className="ex-placement-reminder">，选择位置换入</span>
                </>
              ) : (
                categoryPresentation(game.held.categoryId).abilitySummary ||
                '选择位置换入'
              )}
            </p>
            {game.held.abilityText && !game.held.abilityUsed && (
              <details>
                <summary>能力说明</summary>
                <p>{game.held.abilityText}</p>
              </details>
            )}
          </div>
        </div>
      )}
      {!game.held && (
        <span className="ex-held-anchor" data-pile="held" aria-hidden="true" />
      )}
      {game.phase !== 'place' && heldOptions}
      {(game.phase === 'draw' || game.phase === 'lucario-draw') && (
        <div className="ex-draw-options">
          <button
            className="ex-source"
            data-pile="deck"
            disabled={
              locked ||
              !actions.some((a) => a.type === 'draw' && a.source === 'deck')
            }
            onClick={() => choose({ type: 'draw', source: 'deck' })}
          >
            <strong>摸牌堆</strong>
            <div className="ex-source-face">
              <Card face={null} compact />
              <span>
                取一张牌<b>{game.deckCount} 张</b>
              </span>
            </div>
          </button>
          {(game.phase === 'draw'
            ? game.rulesProfile === 'research-buffer-v2'
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
                  choose({ type: 'draw', source: 'discard', discardIndex: i })
                }
              >
                <strong>
                  {game.rulesProfile === 'research-buffer-v2'
                    ? '弃牌顶部'
                    : `可选弃牌${i + 1}`}
                </strong>
                <div className="ex-source-face">
                  {face ? (
                    <Card face={face} compact />
                  ) : (
                    <span className="ex-empty-source">—</span>
                  )}
                  <span>
                    {face?.name ?? '暂无卡牌'}
                    <b>{face ? summaryOf(face) : '不可选择'}</b>
                  </span>
                </div>
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
              <div className="ex-source-face">
                {game.buffersBySeat[self] ? (
                  <Card face={game.buffersBySeat[self]!} compact />
                ) : (
                  <span className="ex-buffer-empty" aria-hidden="true">
                    ＋
                  </span>
                )}
                <span>
                  {game.buffersBySeat[self]?.name ?? '空位'}
                  <b>
                    {game.buffersBySeat[self] ? '取出后必须使用' : '尚未存牌'}
                  </b>
                </span>
              </div>
            </button>
          )}
          {game.phase === 'draw' && (
            <button
              className={`ex-source ex-reposition-source ${mode === 'reposition' ? 'selected' : ''}`}
              disabled={locked || !actions.some((a) => a.type === 'reposition')}
              onClick={() => {
                setMode(mode === 'reposition' ? '' : 'reposition');
                setSlots([]);
              }}
            >
              <strong>卡牌换位</strong>
              <div className="ex-source-face">
                <span className="ex-swap-mark" aria-hidden="true">
                  <svg viewBox="0 0 72 90">
                    <rect x="5" y="9" width="30" height="47" rx="5" />
                    <rect x="37" y="34" width="30" height="47" rx="5" />
                    <path d="M12 71h18l-6-6m6 6-6 6M60 18H42l6-6m-6 6 6 6" />
                  </svg>
                </span>
                <span>
                  交换两格<b>结束本回合</b>
                </span>
              </div>
            </button>
          )}
        </div>
      )}
      {targets.length > 0 && (
        <div className="ex-target-list" aria-label="目标玩家">
          {targets.map((id) => (
            <button
              key={id}
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
      {working.some((a) => a.type === 'row-target') ? (
        <div className="ex-row-choice">
          <p>
            与 {names[chosenSeat]} 交换第{' '}
            {game.rowAbility === 'groudon'
              ? 3
              : game.rowAbility === 'kyogre'
                ? 2
                : 1}{' '}
            行，朝向随牌移动。
          </p>
          <Board game={game} seat={chosenSeat} />
          <button
            disabled={locked}
            onClick={() => {
              const a = candidates.find((v) => v.type === 'row-target');
              if (a) choose(a);
            }}
          >
            确认交换这一整行
          </button>
        </div>
      ) : selectable.length > 0 &&
        (game.phase !== 'draw' || mode === 'reposition') ? (
        <div className="ex-target-board">
          <div className="ex-target-heading">
            <strong>
              {chosenSeat === self ? '本人场地' : `${names[chosenSeat]}的场地`}
            </strong>
            <span>{pairs.length ? '选择两个不同位置' : '选择一个位置'}</span>
          </div>
          <Board
            game={game}
            seat={chosenSeat}
            selected={slots}
            selectable={selectable}
            select={select}
            locked={locked}
            motion={motion}
          />
          {selectedType === 'ninja-target' && (
            <div className="ex-branch">
              <button
                className={!exchange ? 'selected' : ''}
                onClick={() => setExchange(false)}
              >
                只盖回
              </button>
              <button
                className={exchange ? 'selected' : ''}
                onClick={() => setExchange(true)}
              >
                盖回并交换
              </button>
            </div>
          )}
          <div className="ex-submit">
            <button
              disabled={locked || !chosen}
              onClick={() => {
                if (chosen) choose(chosen);
              }}
            >
              {commandLabel}
              {slots.length
                ? ` · ${slots.map((s) => s + 1).join('、')}号位`
                : ''}
            </button>
          </div>
        </div>
      ) : (
        <div className="ex-target-board ex-own-board">
          <Board game={game} seat={self} motion={motion} />
        </div>
      )}
      {game.phase === 'place' && heldOptions}
      {chosenSeat !== self && (
        <details className="ex-own-preview">
          <summary>查看本人场地</summary>
          <Board game={game} seat={self} motion={motion} />
        </details>
      )}
      {mode === 'reposition' && (
        <button
          className="secondary ex-cancel"
          onClick={() => {
            setMode('');
            setSlots([]);
          }}
        >
          取消换位
        </button>
      )}
      {game.peek && (
        <div className="ex-private-peek">
          <h3>仅本人可见</h3>
          <div>
            {game.peek.cards.map((p) => (
              <section key={p.slot}>
                <Card face={p.card} />
                <span>{p.slot + 1}号位</span>
                {actions.some(
                  (a) => a.type === 'mewtwo-exchange' && a.slot === p.slot,
                ) && (
                  <button
                    disabled={locked}
                    onClick={() =>
                      choose({ type: 'mewtwo-exchange', slot: p.slot })
                    }
                  >
                    与此牌交换
                  </button>
                )}
              </section>
            ))}
          </div>
        </div>
      )}
      <div className="ex-simple-actions">
        {actions
          .filter((a) =>
            [
              'decline-ability',
              'close-peek',
              'activate-arceus',
              'extra-draw',
              'pass-direction',
            ].includes(a.type),
          )
          .map((a) => (
            <button
              key={'direction' in a ? a.direction : a.type}
              disabled={locked}
              className={a.type === 'decline-ability' ? 'secondary' : ''}
              onClick={() => choose(a)}
            >
              {'direction' in a
                ? a.direction === 'clockwise'
                  ? '顺时针接力 ↻'
                  : '逆时针接力 ↺'
                : labels[a.type]}
            </button>
          ))}
      </div>
      {game.phase !== 'draw' && <BufferCard game={game} seat={self} />}
    </section>
  );
}
function Rulebook({ profile }: { profile: RulesProfile }) {
  const buffered = profile === 'research-buffer-v2';
  return (
    <RulesGuide
      className="expansion-rules"
      summary={
        buffered
          ? '经营九格，用三张同值连线归零。最低最终分获胜，研究会改变分数和授胜，先到三胜结束。'
          : '经营九格，用三张同值连线归零。结算最低分得一胜，先到三胜。'
      }
      source="TableMax自制扩展；数值与任务为项目方案，原版出版来源缺口保持记录。"
      chapters={[
        {
          id: 'start',
          label: '目标开局',
          title: '投研究，再翻一张',
          content: (
            <>
              <p>
                2–6人，投票三选一，全员锁定后最高票当选，平票随机。每人九张暗牌，自己翻一张；超梦、阿尔宙斯不进初始场地。
              </p>
              <p>
                选择研究即锁定投票。每项的“条件与风险”可查看完整要求、收益和示意图，不会提交投票。角色插画表达主题，不代替任务条件。
              </p>
              <GuideScene
                name="setup"
                caption="九宫格扩展：牌位与数字由下方代码表示。"
              >
                <div className="ex-rule-grid">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i}>{i === 0 ? '4' : '?'}</span>
                  ))}
                </div>
              </GuideScene>
            </>
          ),
        },
        {
          id: 'turn',
          label: '取牌换位',
          title: buffered
            ? '取牌、缓冲，或交换本人两格'
            : '顶部两弃牌，或交换本人两格',
          content: (
            <>
              <p>
                {buffered
                  ? '普通回合可取摸牌堆顶、唯一弃牌顶部，或本人缓冲。弃牌和缓冲取得必须使用。允许弃掉的摸牌可存入自己的空缓冲，替代放入或弃牌并结束回合；强制换入和接力过程中不能存牌。路卡利欧的额外摸牌，以及超梦未偷换而放弃侦察后的摸牌，仍可按原来源弃掉或存入空缓冲。'
                  : '可取牌库顶或弃牌顶部两张之一；牌库牌可弃，弃牌取得必须使用。'}
                普通换入朝上，换出公开弃顶。不取牌时可公开交换本人两格，朝向随牌移动，替代整个回合，不私看、不发动能力。
              </p>
              <p>
                通常先取牌并换入，再处理能力；梦幻、火箭队、闪电鸟及超梦按各自流程先处理指定步骤。卡牌换位替代整个回合。
                {buffered
                  ? '每人缓冲最多一张，牌公开但只有本人能取出，不能直接交换两张缓冲；缓冲不计场地分、归零或研究条件。'
                  : '两个“可选弃牌”来自同一弃牌堆。'}
                行动轮到你时才显示操作。
              </p>
              {buffered && (
                <figure className="ex-buffer-rule">
                  <div>
                    <span>摸牌堆</span>
                    <span>弃牌顶部</span>
                    <span>本人缓冲</span>
                  </div>
                  <p aria-hidden="true">↓</p>
                  <strong>当前取牌</strong>
                  <p>
                    弃牌和缓冲牌必须使用；可弃的摸牌可换入、弃掉或存入空缓冲。
                  </p>
                </figure>
              )}
            </>
          ),
        },
        {
          id: 'abilities',
          label: '特殊能力',
          title: '按功能看，完整处理后才收局',
          content: (
            <>
              <p>
                每张特殊牌的主动能力使用后移除星标。移位、盖回、换人、弃牌
                {buffered ? '或缓冲' : ''}
                都保留已使用状态，取回不会恢复。只有该牌实际洗回牌库，或开始下一小局，才恢复能力。复制牌的被动计分规则不受影响。
              </p>
              <ul>
                {categories
                  .filter((c) => c.ability || c.copy)
                  .map((c) => (
                    <li key={c.categoryId}>
                      <strong>{c.name}：</strong>
                      {c.copy
                        ? (c.copy === 'horizontal' ? '横向' : '纵向') +
                          '复制紧邻分值。'
                        : c.ability === 'charizard'
                          ? '可私看本人一张暗牌，牌留原位朝下。'
                          : c.ability === 'mewtwo'
                            ? '看同一对手两格后，可交换一张或放弃；确认后完成本人换入。'
                            : c.ability === 'arceus'
                              ? '全桌含自身盖回，每人随机一明，每小局全桌一次，不洗牌重发。'
                              : c.ability === 'greninja'
                                ? '任意一名玩家两格盖回，或盖回并公开交换。'
                                : c.ability === 'lucario'
                                  ? '仅从牌库额外摸一张，可按规则回洗补充牌库；无牌可摸时不可发动。额外牌不发动主动能力。'
                                  : c.ability === 'groudon'
                                    ? '交换对手第三行。'
                                    : c.ability === 'kyogre'
                                      ? '交换对手第二行。'
                                      : c.ability === 'rayquaza'
                                        ? '交换对手第一行。'
                                        : c.ability === 'snorlax'
                                          ? '可交换本人两格，朝向随牌移动。'
                                          : c.ability === 'zapdos'
                                            ? '选择顺／逆时针，每位其他玩家接牌换入一次，末牌弃底。'
                                            : c.ability === 'mew'
                                              ? '换入对手一格，再把所得牌换入本人。'
                                              : '抛币；喵喵面换入本人，皮卡丘面处理全员同格，弃底补位。'}
                    </li>
                  ))}
              </ul>
            </>
          ),
        },
        {
          id: 'score',
          label: '计分三胜',
          title: '三行、三列、两主对角线',
          content: (
            <>
              <p>
                三张有效值相同即归零，交叉格只一次，负值连线也归零，牌不拿走。复制路径必须到固定数字，最低基础分优先，同分选择研究处理后最有利的解。完整能力后任意玩家全明就收局，不留残局回合。
              </p>
              <div className="ex-rule-grid">
                {[7, 4, 7, 0, 7, 3, 7, 6, 7].map((v, i) => (
                  <span
                    className={[0, 2, 4, 6, 8].includes(i) ? 'ex-zero' : ''}
                    key={i}
                  >
                    {v}
                  </span>
                ))}
              </div>
              <p>
                示例：两条对角线归零，余牌合计13分。最低最终分可共同获胜。
                {buffered
                  ? '每位赢家按本人的研究条件授胜：通常一胜，奖励最多再加一胜；失败代价可能限制本局授胜或累计上限，已有胜场不撤回。累计达到三胜即可成为大局赢家。'
                  : '先到三胜。'}
                {buffered
                  ? '计分明细显示本局实际增减分与授胜；最低分但未获胜星时，仍是下一小局起手候选。'
                  : '计分明细显示基础分与研究减分。'}
              </p>
            </>
          ),
        },
        {
          id: 'research',
          label: '研究任务',
          title: '24项开局＋6项丰缘任务',
          content: (
            <>
              <p>
                三种丰缘神兽首次同时在玩家场地明置，追加专属任务；弃牌、暂持
                {buffered ? '、缓冲' : ''}
                和结算强制揭牌不计，最后合法行动仍可触发。两项只在结算判定。
                {buffered
                  ? '奖励可能改变牌分、扩大负分收益或增加授胜；归零判定保持不变。高收益任务也可能有未达成代价，逐项查看下方条件与风险。'
                  : '各减分一次。'}
                数字使用复制后、归零前值，不展示局中暗牌进度。
              </p>
              <div className="expansion-screen ex-research-reference ex-rule-tasks">
                {tasksForProfile(profile).map((t) => (
                  <ResearchCard key={t.id} task={t} profile={profile} />
                ))}
              </div>
            </>
          ),
        },
      ]}
    />
  );
}
function ScreenBody({ session, game }: { session: GameHost; game: View }) {
  const canPlay = useAudioOutput();
  const frame = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node) return;
    const measure = () => {
      node.dataset.narrowTable = String(node.clientWidth <= 1100);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const presentation = useExpansionPresentation();
  const { motion, resultReady } = presentation;
  const profile = game.rulesProfile ?? 'legacy';
  const [panel, setPanel] = useState<
      'menu' | 'rules' | 'friends' | 'research' | 'score' | null
    >(null),
    [detail, setDetail] = useState(''),
    names = namesOf(session);
  const showResearch = (id: string) => {
    setDetail(id);
    setPanel('research');
  };
  const seats = session.view?.seats ?? [],
    shown =
      session.role === 'player'
        ? seats.filter((s) => s.id === session.self?.id)
        : seats;
  const research =
    game.activeResearch.length > 0 ? (
      <aside className="ex-research-strip" aria-label="本局研究">
        {game.activeResearch.map((t) => (
          <button
            key={t.id}
            className="ex-research-summary"
            data-research-details={t.id}
            onClick={() => showResearch(t.id)}
          >
            {session.role !== 'player' && (
              <ResearchPicture id={t.id} profile={profile} />
            )}
            <span>
              <strong>{t.name}</strong>
              <span>
                <ResearchReward task={t} />
              </span>
            </span>
            <span className="ex-research-open">详情</span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </aside>
    ) : null;
  const renderSeat = (s: (typeof seats)[number]) => (
    <article
      className={`ex-player ${game.actorSeat === s.id ? 'acting' : ''} ${resultReady && game.roundResult?.winners.includes(s.id) ? 'winner' : ''}`}
      key={s.id}
      data-seat={s.id}
    >
      <header>
        {resultReady && game.matchWinners.includes(s.id) && (
          <span className="winner-crown" role="img" aria-label="大局赢家皇冠">
            ♛
          </span>
        )}
        <img src={avatarFor(s.avatarId)} alt="" />
        <CircularBadge
          className="ex-seat-number"
          value={game.seatOrder.indexOf(s.id) + 1}
        />
        <h2 title={s.name}>{s.name}</h2>
        <WinTrack
          wins={presentedWins(game, s.id, resultReady)}
          earnedNow={Boolean(
            resultReady &&
            game.roundResult?.winners.includes(s.id) &&
            (game.roundResult.awardsBySeat?.[s.id] ?? 1) > 0 &&
            motion.includes('@result'),
          )}
          winner={
            !resultReady
              ? undefined
              : game.matchWinners.includes(s.id)
                ? 'match'
                : game.roundResult?.winners.includes(s.id)
                  ? 'round'
                  : undefined
          }
        />
      </header>
      <Board game={game} seat={s.id} motion={motion} />
      {game.roundResult && resultReady && (
        <button
          className="ex-score ex-settlement-text"
          onClick={() => {
            setDetail(s.id);
            setPanel('score');
          }}
          aria-label={`查看${s.name}的计分明细`}
        >
          <strong>
            {game.roundResult.scores[s.id]!.total}
            <span>分</span>
          </strong>
          {game.roundResult.awardsBySeat ? (
            <span className="ex-score-summary">
              <span className="ex-award">
                本局获 {game.roundResult.awardsBySeat[s.id] ?? 0} 胜
              </span>
              <span>明细 ›</span>
            </span>
          ) : (
            <span>计分明细 ›</span>
          )}
        </button>
      )}
    </article>
  );
  return (
    <main
      ref={frame}
      className={`expansion-screen ${session.role} ${game.roundResult && !resultReady ? 'ex-pending-settlement' : ''}`}
      data-players={seats.length}
      data-phase={game.phase}
      data-play-mode={session.view?.playMode}
      data-rules-profile={profile}
    >
      <header className="ex-toolbar">
        <ScreenLink href={`/${session.role}`} className="secondary">
          ‹ 盒子
        </ScreenLink>
        <h1>
          宝可梦奇遇 <span>扩展版</span>
        </h1>
        {!session.connected && (
          <span className="ex-connection" role="status">
            连接中…
          </span>
        )}
        <DisplaySettings role={session.role} />
        {session.role !== 'player' && (
          <>
            <FullscreenControl />
            <PlayModeBadge mode={session.view?.playMode} />
            <SoundControl
              compact
              iconOnly
              disabled={session.view?.playMode === 'test' || !session.connected}
              paused={session.view?.paused ?? false}
              feedback={presentation.feedback}
              eventKey={presentation.eventKey}
              errorId={session.errorId}
              canPlay={canPlay}
              recipe={(event, reducedMotion) =>
                expansionSoundRecipe(
                  event.kind,
                  event.action,
                  game,
                  reducedMotion,
                  expansionVoices,
                  presentation.current?.event.effect ?? {},
                )
              }
              resolveSource={(cue, event) => {
                const theme = expansionThemeFor(
                  event.kind,
                  event.action,
                  cue,
                  presentation.current?.event.effect ?? {},
                );
                return theme
                  ? expansionThemes[
                      `../../../../assets/games/pokemon-encounters/expansion/audio/${theme}-theme-original-v1.ogg`
                    ]
                  : undefined;
              }}
            />
          </>
        )}
        <button className="secondary" onClick={() => setPanel('rules')}>
          规则
        </button>
        {session.role === 'player' && (
          <button className="secondary" onClick={() => setPanel('friends')}>
            朋友
          </button>
        )}
        <button className="secondary" onClick={() => setPanel('menu')}>
          菜单
        </button>
      </header>
      <div className="ex-round-banner">
        <span>第 {game.roundNumber} 小局</span>
        <strong>{phaseText[game.phase]}</strong>
        <span
          className="ex-current-actor"
          title={game.actorSeat ? names[game.actorSeat] : undefined}
        >
          {game.actorSeat
            ? names[game.actorSeat]
            : game.phase === 'research-vote'
              ? `投票 ${game.votedSeats.length}/${seats.length}`
              : game.phase === 'initial-flip'
                ? `翻牌 ${game.initialDone.length}/${seats.length}`
                : '三胜赛制'}
        </span>
        <TurnProgress game={game} />
      </div>
      {((session.message && session.message !== '已保存') ||
        !session.connected ||
        session.admissionPending ||
        session.awaitingConfirmation) && <SessionFeedback session={session} />}
      {session.view?.paused && (
        <div className="ex-paused" role="status">
          对局已暂停，当前牌面与研究保留。
        </div>
      )}
      {game.roundResult && resultReady && (
        <section
          className="ex-victory ex-settlement-text"
          aria-label="本局结果"
        >
          <span className="ex-winner-emblem" aria-hidden="true">
            {game.matchWinners.length ? '♛' : '✦'}
          </span>
          <div>
            <p>
              {game.matchWinners.length
                ? '三胜达成 · 大局赢家'
                : `第 ${game.roundNumber} 小局 · 最低分获胜`}
            </p>
            <h2>
              {(game.matchWinners.length
                ? game.matchWinners
                : game.roundResult.winners
              )
                .map((id) => names[id])
                .join('、')}
            </h2>
            <p>
              {game.roundResult.awardsBySeat
                ? game.roundResult.winners
                    .map(
                      (id) =>
                        `${names[id]}获 ${game.roundResult!.awardsBySeat![id] ?? 0} 胜`,
                    )
                    .join('，')
                : game.roundResult.winners.length > 1
                  ? '并列获胜，各记一胜'
                  : '这一胜，属于你'}
            </p>
          </div>
          {session.canControl && (
            <div className="ex-result-actions">
              {session.view?.status === 'ended' ? (
                <button
                  disabled={session.locked}
                  onClick={() => session.command({ type: 'replay' })}
                >
                  再玩一局
                </button>
              ) : (
                session.view?.lifecycleActions.map((action, i) => (
                  <button
                    key={i}
                    disabled={session.locked || session.view?.paused}
                    onClick={() =>
                      session.command({
                        type: 'lifecycle',
                        action: action as JsonValue,
                      })
                    }
                  >
                    开始下一小局
                  </button>
                ))
              )}
            </div>
          )}
        </section>
      )}
      {game.phase === 'research-vote' ? (
        session.role === 'player' ? (
          <Actions session={session} game={game} showResearch={showResearch} />
        ) : (
          <section className="ex-vote">
            <div className="ex-vote-options">
              {game.researchCandidates.map((t) => (
                <article className="ex-mission-option" key={t.id}>
                  <ResearchCard task={t} profile={profile} />
                </article>
              ))}
            </div>
            <div className="ex-voter-list">
              {seats.map((s) => (
                <span
                  key={s.id}
                  className={game.votedSeats.includes(s.id) ? 'complete' : ''}
                >
                  <img src={avatarFor(s.avatarId)} alt="" />
                  <strong>{s.name}</strong>
                  <span>{game.votedSeats.includes(s.id) ? '✓' : '…'}</span>
                </span>
              ))}
            </div>
          </section>
        )
      ) : (
        <div className="ex-table-layout">
          {(session.role !== 'player' || game.roundResult) && (
            <div className="ex-players">{shown.map(renderSeat)}</div>
          )}
          {session.role === 'player' &&
          !['round-result', 'match-result'].includes(game.phase) ? (
            <Actions
              key={session.view?.decisionId ?? game.phase}
              session={session}
              game={game}
              showResearch={showResearch}
            />
          ) : !game.roundResult && session.role !== 'player' ? (
            <PublicSupply game={game} names={names} research={research} />
          ) : null}
        </div>
      )}
      {session.role === 'player' && !game.roundResult && research}

      <SavedEffects
        game={game}
        session={session}
        portraitFor={(id) => portraitFor(id) ?? cardArt(id).image}
      />
      {panel && (
        <OverlayPanel
          title={
            panel === 'rules'
              ? '扩展版图文规则'
              : panel === 'friends'
                ? '朋友的牌桌'
                : panel === 'research'
                  ? '研究任务'
                  : panel === 'score'
                    ? `${names[detail] ?? '玩家'} · 计分明细`
                    : '牌桌菜单'
          }
          close={() => setPanel(null)}
        >
          {panel === 'research' ? (
            <div className="expansion-screen ex-research-detail">
              <ResearchCard task={task(detail, profile)} profile={profile} />
            </div>
          ) : panel === 'score' && game.roundResult ? (
            <div className="expansion-screen ex-score-detail">
              <h2>最终 {game.roundResult.scores[detail]!.total} 分</h2>
              <p>{researchScoreText(game.roundResult.scores[detail]!)}</p>
              {game.roundResult.awardsBySeat && (
                <p className="ex-award">
                  本局实际获 {game.roundResult.awardsBySeat[detail] ?? 0} 胜
                </p>
              )}
              {game.roundResult.scores[detail]!.research.map((r) => (
                <section className="ex-research-outcome" key={r.taskId}>
                  <h3>{task(r.taskId, profile).name}</h3>
                  <p>
                    <strong>{r.achieved ? '已达成' : '未达成'}</strong>
                    {researchAdjustmentText(r.deduction)}
                  </p>
                  {r.effects?.map((effect, i) => (
                    <p key={i}>
                      {effect.label}
                      {effect.adjustment !== 0 &&
                        `，${researchAdjustmentText(-effect.adjustment)}`}
                      {effect.slots?.length
                        ? `，${effect.slots.map((slot) => slot + 1).join('、')}号位`
                        : ''}
                    </p>
                  ))}
                  {r.title && <p>{r.title}</p>}
                </section>
              ))}
              <h3>归零与复制</h3>
              <p>
                {game.roundResult.scores[detail]!.zeroSlots.length
                  ? `归零位置：${game.roundResult.scores[detail]!.zeroSlots.map((i) => i + 1).join('、')}`
                  : '没有归零线'}
              </p>
              {game.roundResult.scores[detail]!.copies.map((c) => (
                <p key={c.slot}>
                  {c.slot + 1}号位：{c.path.map((i) => i + 1).join(' → ')}
                  ，有效值{c.value}
                </p>
              ))}
              <Board game={game} seat={detail} />
              {game.buffersBySeat && (
                <>
                  <BufferCard
                    game={game}
                    seat={detail}
                    label={`${names[detail] ?? '玩家'}的缓冲`}
                  />
                  <p>缓冲不计入九格得分或研究条件。</p>
                </>
              )}
            </div>
          ) : panel === 'rules' ? (
            <Rulebook profile={profile} />
          ) : panel === 'friends' ? (
            <div className="expansion-screen ex-friends">
              {seats.filter((s) => s.id !== session.self?.id).map(renderSeat)}
            </div>
          ) : (
            <>
              <CountdownSettings session={session} />
              {session.canControl && <RoomManagement session={session} />}
              {game.voteCounts && (
                <section className="ex-vote-results">
                  <h2>研究投票结果</h2>
                  {game.researchCandidates.map((t) => (
                    <p key={t.id}>
                      {t.name}：{game.voteCounts![t.id]}票
                      {game.activeResearch[0]?.id === t.id ? '，本局采用' : ''}
                    </p>
                  ))}
                </section>
              )}
              <section className="ex-event-log">
                <h2>已保存记录</h2>
                {game.events
                  .slice(-12)
                  .reverse()
                  .map((e) => (
                    <p key={e.id}>{eventText(e, names)}</p>
                  ))}
              </section>
            </>
          )}
        </OverlayPanel>
      )}
      <PlayModeControl session={session} />
    </main>
  );
}
function Screen({ session }: { session: GameHost }) {
  const game = session.view?.gameView as View | null;
  if (!game)
    return (
      <main className="expansion-screen">
        <p>正在连接扩展牌桌…</p>
        <SessionFeedback session={session} />
      </main>
    );
  return (
    <ExpansionPresentation session={session} game={game}>
      <ScreenBody session={session} game={game} />
    </ExpansionPresentation>
  );
}
export const client: GameClient = {
  Screen,
  savedChanges: (before, after) => {
    if (!before || !after) return [];
    const a = before as View,
      b = after as View;
    if (a.variantId !== b.variantId || a.roundNumber !== b.roundNumber)
      return [];
    const last = a.events.at(-1)?.id ?? 0;
    return [
      ...b.events.filter((e) => e.id > last).map((e) => `event:${e.id}`),
      ...b.seatOrder.flatMap((id) =>
        (b.boards[id] ?? []).flatMap((c, i) =>
          JSON.stringify(c) !== JSON.stringify(a.boards[id]?.[i])
            ? [c.slotId]
            : [],
        ),
      ),
    ];
  },
  motionDuration: Math.max(...Object.values(poseDurations)) + 650 + 2500 + 150,
};
