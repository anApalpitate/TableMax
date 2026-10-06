/* eslint-disable react-refresh/only-export-components -- Independent expansion client adapter. */
import { useState, type CSSProperties, type ReactNode } from 'react';
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
import { tasks } from '../research';
import { categories, categoryPresentation } from '../cards';
import { BoardGrid } from '../../ui/BoardGrid';
import { CardSkin } from '../../ui/CardSkin';
import { WinTrack } from '../../ui/WinTrack';
import { ResearchCard, ResearchPicture } from './ResearchCard';
import { portraitFor } from './card-art';
import { portraitBoundsFor } from './portrait-bounds';
import { cardArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { SoundControl } from '../../ui/audio';
import { expansionVoices } from './voice-resources';
import {
  expansionSoundRecipe,
  expansionThemeFor,
  presentationTiming,
} from './presentation';
import { SavedEffects } from './SavedEffects';
import { poseSequences } from './poses/timeline';
import { GuideScene } from '../../ui/RuleDiagrams';
import './style.css';
import './redesign.css';
import './refinement.css';

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
  motion?: string[];
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
          <span>{i < current ? '✓' : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}

function PublicSupply({
  game,
  session,
  names,
  research,
}: {
  game: View;
  session: GameHost;
  names: Record<string, string>;
  research: ReactNode;
}) {
  const fresh = game.events.filter((event) =>
    session.motion.includes(`event:${event.id}`),
  );
  const moved = fresh.at(-1)?.action;
  return (
    <aside className="ex-supply">
      <header className="ex-supply-heading">
        <h2>公开牌区</h2>
        <span>弃牌共 {game.discardCount} 张</span>
      </header>
      <div className="ex-public-piles">
        <section data-pile="deck">
          <header>
            <strong>摸牌堆</strong>
            <span>{game.deckCount} 张</span>
          </header>
          <Card face={null} compact />
        </section>
        {([0, 1] as const).map((i) => (
          <section key={i} data-pile={i === 0 ? 'discard' : 'discard-second'}>
            <header>
              <strong>可选弃牌{i + 1}</strong>
            </header>
            {game.discardOptions[i] ? (
              <Card face={game.discardOptions[i]} compact />
            ) : (
              <div className="ex-empty-pile">暂无</div>
            )}
          </section>
        ))}
      </div>
      <section
        className={`ex-public-held ${game.held ? 'has-held' : ''} ${moved?.verb === 'draw' ? 'ex-saved' : ''}`}
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
                {categoryPresentation(game.held.categoryId).abilitySummary ||
                  '选择一格放入场地'}
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
      {research}
    </aside>
  );
}

function Actions({ session, game }: { session: GameHost; game: View }) {
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
  if (game.phase === 'research-vote')
    return (
      <section className="ex-vote">
        <div className="ex-vote-options">
          {game.researchCandidates.map((t, i) => (
            <button
              key={t.id}
              disabled={
                locked ||
                !actions.some(
                  (a) => a.type === 'vote-research' && a.taskId === t.id,
                )
              }
              onClick={() => choose({ type: 'vote-research', taskId: t.id })}
              className={`ex-mission-option ${game.ownVote === t.id ? 'selected' : ''}`}
            >
              <span className="ex-vote-mark" aria-hidden="true">
                {game.ownVote === t.id ? '✓' : String.fromCharCode(65 + i)}
              </span>
              <strong>{t.name}</strong>
              <b>−{t.reward}分</b>
            </button>
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
        <Board game={game} seat={self} motion={session.motion} />
      </section>
    );
  return (
    <section className="ex-actions" aria-label="本人操作">
      <header className="ex-action-heading">
        <img src={avatarFor(session.self?.avatarId ?? 'builtin-1')} alt="" />
        <h2>{session.self?.name ?? '本人'}的行动</h2>
        <WinTrack wins={game.winsBySeat[self] ?? 0} />
      </header>
      {game.held && (
        <div className="ex-held" data-pile="held">
          <Card face={game.held} />
          <div>
            <span className="ex-held-label">当前取牌</span>
            <p>
              {categoryPresentation(game.held.categoryId).abilitySummary ||
                '选择位置换入'}
            </p>
            {game.held.abilityText && (
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
          {([0, 1] as const).map((i) => {
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
                <strong>可选弃牌{i + 1}</strong>
                <div className="ex-source-face">
                  {face ? (
                    <Card face={face} compact />
                  ) : (
                    <span className="ex-empty-source">—</span>
                  )}
                  <span>
                    {face?.name ?? '暂无卡牌'}
                    <b>
                      {face
                        ? categoryPresentation(face.categoryId)
                            .abilitySummary || `${face.value ?? '复制'} 分`
                        : '不可选择'}
                    </b>
                  </span>
                </div>
              </button>
            );
          })}
          <button
            className={`ex-source ${mode === 'reposition' ? 'selected' : ''}`}
            disabled={locked || !actions.some((a) => a.type === 'reposition')}
            onClick={() => {
              setMode(mode === 'reposition' ? '' : 'reposition');
              setSlots([]);
            }}
          >
            <strong>调位</strong>
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
          <p>
            {chosenSeat === self ? '本人场地' : `${names[chosenSeat]}的场地`} ·{' '}
            {pairs.length ? '选择两个不同位置' : '选择一个位置'}
          </p>
          <Board
            game={game}
            seat={chosenSeat}
            selected={slots}
            selectable={selectable}
            select={select}
            locked={locked}
            motion={session.motion}
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
          <Board game={game} seat={self} motion={session.motion} />
        </div>
      )}
      {chosenSeat !== self && (
        <details className="ex-own-preview">
          <summary>查看本人场地</summary>
          <Board game={game} seat={self} motion={session.motion} />
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
          取消调位
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
              'discard-held',
              'pass-direction',
            ].includes(a.type),
          )
          .map((a) => (
            <button
              key={'direction' in a ? a.direction : a.type}
              disabled={locked}
              className={
                a.type === 'discard-held'
                  ? 'ex-discard-action'
                  : a.type === 'decline-ability'
                    ? 'secondary'
                    : ''
              }
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
      {!actions.length && (
        <p className="ex-wait">
          {game.actorSeat ? `${names[game.actorSeat]}正在行动` : '等待全员完成'}
          。公开画面仅显示已保存结果。
        </p>
      )}
    </section>
  );
}
function Rulebook() {
  return (
    <RulesGuide
      className="expansion-rules"
      summary="经营九格，用三张同值连线归零。结算最低分得一胜，先到三胜。"
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
                手机只展示三项名称与奖励，点选即锁定。完整条件和示意图见电脑投票区及规则。角色配图与趣味名称不增加指定宝可梦的达成要求。
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
          label: '取牌调位',
          title: '顶部两弃牌，或交换本人两格',
          content: (
            <>
              <p>
                可取牌库顶或弃牌顶部两张之一；牌库牌可弃，弃牌取得必须使用。普通换入朝上，换出公开弃顶。不取牌时可公开交换本人两格，朝向随牌移动，替代整个回合，不私看、不发动能力。
              </p>
              <p>
                通常先取牌并换入，再处理能力；梦幻、火箭队、闪电鸟及超梦按各自流程先处理指定步骤。调位替代整个回合。两个“可选弃牌”来自同一弃牌堆；行动轮到你时才显示操作。
              </p>
            </>
          ),
        },
        {
          id: 'abilities',
          label: '特殊能力',
          title: '按功能看，完整处理后才收局',
          content: (
            <>
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
                                  ? '可额外取一张，不发动主动能力。'
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
                三张有效值相同即归零，交叉格只一次，负值连线也归零，牌不拿走。复制路径必须到固定数字，联合最低基础分优先，同分选两任务奖励最多的解。完整能力后任意玩家全明就收局，不留残局回合。
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
                示例：两条对角线归零，余牌合计13分。最低最终分可共同获胜，先到三胜。
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
                三种丰缘神兽首次同时在玩家场地明置，追加专属任务；弃牌／暂持和结算强制揭牌不计，最后合法行动仍可触发。两项只在结算判定，各减分一次。数字使用复制后、归零前值，无局中暗牌进度。
              </p>
              <div className="expansion-screen ex-research-reference ex-rule-tasks">
                {tasks.map((t) => (
                  <ResearchCard key={t.id} task={t} />
                ))}
              </div>
            </>
          ),
        },
      ]}
    />
  );
}
function Screen({ session }: { session: GameHost }) {
  const canPlay = useAudioOutput();
  const game = session.view?.gameView as View | null,
    [panel, setPanel] = useState<
      'menu' | 'rules' | 'friends' | 'research' | 'score' | null
    >(null),
    [detail, setDetail] = useState(''),
    names = namesOf(session);
  if (!game)
    return (
      <main className="expansion-screen">
        <p>正在连接扩展牌桌…</p>
        <SessionFeedback session={session} />
      </main>
    );
  const seats = session.view?.seats ?? [],
    shown =
      session.role === 'player'
        ? seats.filter((s) => s.id === session.self?.id)
        : seats;
  const timing = presentationTiming(
    game.events.filter((event) => session.motion.includes(`event:${event.id}`)),
    poseDurations,
  );
  const feedbackTiming = presentationTiming(
    session.feedback?.events ?? [],
    poseDurations,
  );
  const research =
    game.activeResearch.length > 0 ? (
      <aside className="ex-research-strip" aria-label="本局研究">
        {game.activeResearch.map((t) => (
          <button
            key={t.id}
            className="ex-research-summary"
            onClick={() => {
              setDetail(t.id);
              setPanel('research');
            }}
          >
            {session.role !== 'player' && <ResearchPicture id={t.id} />}
            <span>
              <strong>{t.name}</strong>
              <span>{t.description}</span>
            </span>
            <b>−{t.reward}分</b>
            <span aria-hidden="true">›</span>
          </button>
        ))}
      </aside>
    ) : null;
  const renderSeat = (s: (typeof seats)[number]) => (
    <article
      className={`ex-player ${game.actorSeat === s.id ? 'acting' : ''} ${game.roundResult?.winners.includes(s.id) ? 'winner' : ''}`}
      key={s.id}
    >
      <header>
        <img src={avatarFor(s.avatarId)} alt="" />
        <span className="ex-seat-number">
          {game.seatOrder.indexOf(s.id) + 1}
        </span>
        <h2>{s.name}</h2>
        <WinTrack
          wins={game.winsBySeat[s.id] ?? 0}
          winner={
            game.matchWinners.includes(s.id)
              ? 'match'
              : game.roundResult?.winners.includes(s.id)
                ? 'round'
                : undefined
          }
        />
      </header>
      <Board game={game} seat={s.id} motion={session.motion} />
      {game.roundResult && (
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
          <span>计分明细 ›</span>
        </button>
      )}
    </article>
  );
  return (
    <main
      className={`expansion-screen ${session.role} ${timing.resultDelayMs && !session.view?.paused && session.connected ? 'ex-delayed-settlement' : ''}`}
      style={
        { '--ex-result-delay': `${timing.resultDelayMs}ms` } as CSSProperties
      }
      data-players={seats.length}
      data-phase={game.phase}
      data-play-mode={session.view?.playMode}
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
        {session.role !== 'player' && (
          <>
            <FullscreenControl />
            <DisplaySettings />
            <PlayModeBadge mode={session.view?.playMode} />
            <SoundControl
              compact
              iconOnly
              disabled={session.view?.playMode === 'test' || !session.connected}
              paused={session.view?.paused ?? false}
              feedback={session.feedback}
              errorId={session.errorId}
              canPlay={canPlay}
              recipe={(event, reducedMotion) =>
                expansionSoundRecipe(
                  event.kind,
                  event.action,
                  game,
                  reducedMotion,
                  expansionVoices,
                ).map((cue) => ({
                  ...cue,
                  delayMs:
                    cue.delayMs +
                    (reducedMotion
                      ? 0
                      : event.kind === 'round-result'
                        ? feedbackTiming.resultDelayMs
                        : event.kind === 'research'
                          ? feedbackTiming.researchDelayMs
                          : 0),
                }))
              }
              resolveSource={(cue, event) => {
                const theme = expansionThemeFor(event.kind, event.action, cue);
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
        <span>
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
      {game.roundResult && (
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
              {game.roundResult.winners.length > 1
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
          <Actions session={session} game={game} />
        ) : (
          <section className="ex-vote">
            <div className="ex-vote-options">
              {game.researchCandidates.map((t) => (
                <article className="ex-mission-option" key={t.id}>
                  <ResearchCard task={t} />
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
            />
          ) : !game.roundResult && session.role !== 'player' ? (
            <PublicSupply
              game={game}
              session={session}
              names={names}
              research={research}
            />
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
              <ResearchCard task={tasks.find((t) => t.id === detail)!} />
            </div>
          ) : panel === 'score' && game.roundResult ? (
            <div className="expansion-screen ex-score-detail">
              <h2>最终 {game.roundResult.scores[detail]!.total} 分</h2>
              <p>
                基础分 {game.roundResult.scores[detail]!.base} − 研究奖励{' '}
                {game.roundResult.scores[detail]!.deduction}
              </p>
              {game.roundResult.scores[detail]!.research.map((r) => (
                <p key={r.taskId}>
                  {tasks.find((t) => t.id === r.taskId)?.name} ·{' '}
                  {r.achieved ? `达成，减${r.deduction}分` : '未达成'}
                </p>
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
            </div>
          ) : panel === 'rules' ? (
            <Rulebook />
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
