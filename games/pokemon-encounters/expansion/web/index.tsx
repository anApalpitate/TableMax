/* eslint-disable react-refresh/only-export-components -- Independent expansion client adapter. */
import { useState, type CSSProperties } from 'react';
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
import { categories, abilityText } from '../cards';
import { BoardGrid } from '../../ui/BoardGrid';
import { cardArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { SoundControl } from '../../ui/audio';
import { startedAbility, expansionSoundRecipe } from './presentation';
import { GuideScene } from '../../ui/RuleDiagrams';
import './style.css';

const expansionPortraits = import.meta.glob<string>(
  '../../../../assets/games/pokemon-encounters/expansion/portraits/*.webp',
  { eager: true, query: '?url', import: 'default' },
);
function portraitFor(categoryId: string) {
  const creature = categoryId.replace(/^(ordinary|special)-/, '');
  return expansionPortraits[
    `../../../../assets/games/pokemon-encounters/expansion/portraits/${creature}-official-v1.webp`
  ];
}

const phaseText: Record<View['phase'], string> = {
  'research-vote': '投票选择研究',
  'initial-flip': '选一张初始牌翻开',
  draw: '取牌，或调整位置',
  place: '选择换入位置',
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
    'row-target': '交换整行',
    'pass-direction': '确定接力方向',
    'activate-arceus': '发动返璞归真',
    'extra-draw': '继续额外取牌',
    'close-peek': '完成私看',
    'decline-ability': '放弃可选能力',
    'initial-flip': '翻开初始牌',
    'discard-held': '弃掉暂持牌',
  };
  const category = categories.find((c) => c.categoryId === action.cardCategory);
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
  const portrait = face ? (portraitFor(face.categoryId) ?? art?.image) : null;
  return (
    <span
      className={`ex-card ${face ? 'face' : 'back'} ${compact ? 'compact' : ''}`}
      style={art ? ({ '--card-color': art.frame } as CSSProperties) : undefined}
      data-category={face?.categoryId}
    >
      {face ? (
        <>
          <strong className="ex-card-value">
            {effective ?? face.value ?? (face.copy === 'vertical' ? '↕' : '↔')}
          </strong>
          {portrait ? (
            <img src={portrait} alt="" draggable={false} />
          ) : (
            <span className="ex-creature-symbol" aria-hidden="true">
              {face.copy ? '◈' : face.ability ? '✦' : '✧'}
            </span>
          )}
          <span className="ex-card-name">{face.name}</span>
          {face.ability && (
            <span className="ex-ability-dot" aria-label="能力牌">
              ✦
            </span>
          )}
        </>
      ) : (
        <>
          <span className="ex-ball" aria-hidden="true" />
        </>
      )}
    </span>
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
        <h2>为本局选择研究方向</h2>
        <p>每人一票，提交后锁定。全员完成后公布票数。</p>
        <div className="ex-vote-options">
          {game.researchCandidates.map((t) => (
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
              <span className="ex-task-icon">{t.id.slice(1)}</span>
              <strong>{t.name}</strong>
              <span>{t.description}</span>
              <b>结算减 {t.reward} 分</b>
              {game.ownVote === t.id && <em>已投此项</em>}
            </button>
          ))}
        </div>
        <p className="ex-vote-status">
          已投票 {game.votedSeats.length}／{game.seatOrder.length} ·{' '}
          {game.ownVote ? '等待其他玩家' : '选择一项提交'}
        </p>
      </section>
    );
  return (
    <section className="ex-actions" aria-label="本人操作">
      <h2>{actions.length ? phaseText[game.phase] : '等待其他玩家'}</h2>
      {game.held && (
        <div className="ex-held">
          <Card face={game.held} />
          <p>{game.held.abilityText ?? '选择位置换入这张牌。'}</p>
        </div>
      )}
      {(game.phase === 'draw' || game.phase === 'lucario-draw') && (
        <div className="ex-draw-options">
          <button
            disabled={
              locked ||
              !actions.some((a) => a.type === 'draw' && a.source === 'deck')
            }
            onClick={() => choose({ type: 'draw', source: 'deck' })}
          >
            <span className="ex-ball small" />
            牌库取牌 <b>{game.deckCount}</b>
          </button>
          {game.discardOptions.map((face, i) => (
            <button
              key={i}
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
                  discardIndex: i as 0 | 1,
                })
              }
            >
              <Card face={face} compact />
              <span>{i ? '第二张弃牌' : '顶部弃牌'}</span>
            </button>
          ))}
          {actions.some((a) => a.type === 'reposition') && (
            <button
              className={mode === 'reposition' ? 'selected' : ''}
              onClick={() => {
                setMode(mode === 'reposition' ? '' : 'reposition');
                setSlots([]);
              }}
            >
              ⇄ 本回合调位
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
      ) : null}
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
      {!actions.length && (
        <p className="ex-wait">
          {game.actorSeat ? `${names[game.actorSeat]}正在行动` : '等待全员完成'}
          。公开画面仅显示已保存结果。
        </p>
      )}
    </section>
  );
}
const timings: Record<string, number> = {
  mewtwo: 1650,
  arceus: 1750,
  groudon: 1600,
  kyogre: 1700,
  rayquaza: 1650,
  greninja: 1600,
  mew: 1650,
  'team-rocket': 1700,
  zapdos: 1650,
};
function Effects({ game, session }: { game: View; session: GameHost }) {
  if (
    session.view?.playMode === 'test' ||
    session.view?.paused ||
    !session.connected
  )
    return null;
  const fresh = game.events.filter((e) =>
      session.motion.includes(`event:${e.id}`),
    ),
    research = fresh.find((e) => e.kind === 'research'),
    action = [...fresh].reverse().find((e) => startedAbility(e.action));
  const ability = startedAbility(action?.action);
  const hero =
    ability && timings[ability]
      ? categories.find((c) => c.ability === ability)
      : null;
  return (
    <>
      {hero && (
        <div
          className={`ex-cinematic ex-theme-${ability}`}
          key={`hero-${action!.id}`}
          style={{ '--ex-duration': `${timings[ability!]}ms` } as CSSProperties}
          aria-hidden="true"
        >
          <div className="ex-cinematic-rings" />
          <div className="ex-cinematic-streaks" />
          <div className="ex-cinematic-creature">
            <Card
              face={{
                categoryId: hero.categoryId,
                assetId: hero.categoryId,
                name: hero.name,
                value: hero.value,
                ability: hero.ability,
                abilityText: null,
                copy: hero.copy,
              }}
            />
          </div>
          <strong>{hero.name}</strong>
          <span>{hero.ability ? abilityText[hero.ability] : '能力生效'}</span>
        </div>
      )}
      {hero && (
        <aside className="ex-static-hero" role="status">
          <img
            src={portraitFor(hero.categoryId) ?? cardArt(hero.categoryId).image}
            alt=""
          />
          <div>
            <strong>{hero.name}</strong>
            <p>{hero.ability ? abilityText[hero.ability] : '能力生效'}</p>
          </div>
        </aside>
      )}
      {ability && !hero && action && (
        <div
          className={`ex-local-ability ex-theme-${ability}`}
          key={`local-${action.id}`}
          aria-hidden="true"
        >
          <span>✦</span>
          <strong>
            {categories.find((c) => c.ability === ability)?.name ?? '能力生效'}
          </strong>
          <div className="ex-local-ripple" />
        </div>
      )}
      {research && game.activeResearch.length > 0 && (
        <div
          key={`research-${research.id}`}
          className="ex-research-reveal"
          style={
            {
              '--ex-delay': hero ? `${timings[ability!]}ms` : '0ms',
            } as CSSProperties
          }
        >
          <span>特殊研究发布</span>
          <strong>{game.activeResearch.at(-1)!.name}</strong>
          <p>{game.activeResearch.at(-1)!.description}</p>
          <b>结算减 {game.activeResearch.at(-1)!.reward} 分</b>
          {game.voteCounts && game.activeResearch.length === 1 && (
            <div className="ex-reveal-votes">
              {game.researchCandidates.map((t) => (
                <span key={t.id}>
                  {t.name} {game.voteCounts![t.id]}票
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
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
            <p>
              可取牌库顶或弃牌顶部两张之一；牌库牌可弃，弃牌取得必须使用。普通换入朝上，换出公开弃顶。不取牌时可公开交换本人两格，朝向随牌移动，替代整个回合，不私看、不发动能力。
            </p>
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
              <div className="ex-rule-tasks">
                {tasks.map((t) => (
                  <article key={t.id}>
                    <strong>
                      {t.id} {t.name} · −{t.reward}
                    </strong>
                    <p>{t.description}</p>
                  </article>
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
    [panel, setPanel] = useState<'menu' | 'rules' | 'friends' | null>(null),
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
        <span
          className="ex-wins"
          aria-label={`${game.winsBySeat[s.id] ?? 0}胜`}
        >
          {'★'.repeat(game.winsBySeat[s.id] ?? 0)}
          {'☆'.repeat(Math.max(0, 3 - (game.winsBySeat[s.id] ?? 0)))}
        </span>
      </header>
      <Board game={game} seat={s.id} motion={session.motion} />
      {game.roundResult && (
        <div className="ex-score">
          <strong>{game.roundResult.scores[s.id]!.total} 分</strong>
          <span>
            基础 {game.roundResult.scores[s.id]!.base} 研究 −
            {game.roundResult.scores[s.id]!.deduction}
          </span>
          {game.roundResult.scores[s.id]!.research.map((r) => (
            <span key={r.taskId}>
              {tasks.find((t) => t.id === r.taskId)?.name}：
              {r.achieved ? `减${r.deduction}分` : '未达成'}
            </span>
          ))}
        </div>
      )}
    </article>
  );
  return (
    <main
      className={`expansion-screen ${session.role}`}
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
        <span
          className={`ex-connection ${session.connected ? 'online' : ''}`}
          aria-label={session.connected ? '已连接' : '连接中'}
        >
          ●
        </span>
        {session.role !== 'player' && (
          <>
            <FullscreenControl />
            <DisplaySettings />
            <PlayModeBadge mode={session.view?.playMode} />
            <SoundControl
              compact
              disabled={session.view?.playMode === 'test'}
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
                )
              }
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
      </div>
      {(session.message ||
        !session.connected ||
        session.admissionPending ||
        session.awaitingConfirmation) && <SessionFeedback session={session} />}
      {session.view?.paused && (
        <div className="ex-paused" role="status">
          对局已暂停，当前牌面与研究保留。
        </div>
      )}
      {game.activeResearch.length > 0 && (
        <aside className="ex-research-strip" aria-label="本局研究">
          {game.activeResearch.map((t) => (
            <section key={t.id}>
              <span className="ex-task-icon">
                {t.pool === 'hoenn' ? '✦' : '◈'}
              </span>
              <div>
                <h2>{t.name}</h2>
                <p>{t.description}</p>
              </div>
              <b>−{t.reward}分</b>
            </section>
          ))}
        </aside>
      )}
      {game.phase === 'research-vote' ? (
        session.role === 'player' ? (
          <Actions session={session} game={game} />
        ) : (
          <section className="ex-vote">
            <h2>研究投票进行中</h2>
            <div className="ex-vote-options">
              {game.researchCandidates.map((t) => (
                <article className="ex-mission-option" key={t.id}>
                  <strong>{t.name}</strong>
                  <p>{t.description}</p>
                  <b>结算减 {t.reward} 分</b>
                </article>
              ))}
            </div>
            <div className="ex-voter-list">
              {seats.map((s) => (
                <span key={s.id}>
                  {s.name}{' '}
                  {game.votedSeats.includes(s.id) ? '✓ 已完成' : '等待投票'}
                </span>
              ))}
            </div>
          </section>
        )
      ) : (
        <div className="ex-table-layout">
          <div className="ex-players">{shown.map(renderSeat)}</div>
          {session.role === 'player' &&
          !['round-result', 'match-result'].includes(game.phase) ? (
            <Actions
              key={session.view?.decisionId ?? game.phase}
              session={session}
              game={game}
            />
          ) : (
            <aside className="ex-supply">
              <h2>公开牌区</h2>
              <div className="ex-public-discard">
                {game.discardOptions.map((c, i) => (
                  <section key={i}>
                    <Card face={c} />
                    <span>{i ? '第二张' : '顶部弃牌'}</span>
                  </section>
                ))}
              </div>
              <p>
                牌库 {game.deckCount} 张 弃牌 {game.discardCount} 张
              </p>
              {game.held && (
                <>
                  <h3>当前暂持牌</h3>
                  <Card face={game.held} />
                </>
              )}
              <div className="ex-last-action" role="status">
                {game.events.at(-1) && eventText(game.events.at(-1)!, names)}
              </div>
            </aside>
          )}
        </div>
      )}
      {game.roundResult && (
        <section className="ex-victory">
          <span>✦</span>
          <h2>{game.phase === 'match-result' ? '三胜达成！' : '本小局赢家'}</h2>
          <p>
            {(game.phase === 'match-result'
              ? game.matchWinners
              : game.roundResult.winners
            )
              .map((id) => names[id])
              .join('、')}
          </p>
          {session.canControl && (
            <RoomManagement session={session} lifecycleLabel="开始下一小局" />
          )}
        </section>
      )}
      <Effects game={game} session={session} />
      {panel && (
        <OverlayPanel
          title={
            panel === 'rules'
              ? '扩展版图文规则'
              : panel === 'friends'
                ? '朋友的牌桌'
                : '牌桌菜单'
          }
          close={() => setPanel(null)}
        >
          {panel === 'rules' ? (
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
  motionDuration: 4500,
};
