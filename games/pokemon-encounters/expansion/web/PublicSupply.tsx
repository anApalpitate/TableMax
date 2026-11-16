import { type ReactNode } from 'react';
import type { View } from '../project';
import { coinArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { useExpansionPresentation } from './PresentationContext';
import { bufferedProfile, phaseText, savedActionSummary } from './view-model';
import { Card, TurnProgress } from './Cards';

export function PublicSupply({
  game,
  names,
  portraits,
  research,
  showHistory,
}: {
  game: View;
  names: Record<string, string>;
  portraits: Record<string, string>;
  research: ReactNode;
  showHistory(): void;
}) {
  const { motion } = useExpansionPresentation();
  const fresh = game.events.filter((event) =>
    motion.includes(`event:${event.id}`),
  );
  const moved = fresh.at(-1)?.action;
  const latest = game.events.at(-1);
  const summary = latest && savedActionSummary(latest, names);
  const actor = game.actorSeat;
  const initial = game.phase === 'initial-flip';
  const operation =
    game.phase === 'mewtwo-target' && game.rulesProfile === 'events-research-v3'
      ? '超梦：私看对手一张'
      : phaseText[game.phase];
  return (
    <aside className="ex-supply" aria-label="当前局面与最近行动">
      <section className="ex-side-status">
        <div className="ex-side-meta">
          <span>第 {game.roundNumber} 小局</span>
          <span>三胜大局</span>
          {initial && (
            <span>
              已翻牌 {game.initialDone.length} / {game.seatOrder.length}
            </span>
          )}
        </div>
        <div className="ex-status-current" role="status">
          {!initial && actor && (
            <h2 className="ex-status-actor">
              {portraits[actor] && <img src={portraits[actor]} alt="" />}
              <span>{names[actor] ?? '当前玩家'}</span>
            </h2>
          )}
          <strong>{operation}</strong>
        </div>
        {initial ? (
          <ol className="ex-seat-progress" aria-label="各座初始翻牌进度">
            {game.seatOrder.map((id, index) => {
              const done = game.initialDone.includes(id);
              const status = `${names[id] ?? `座${index + 1}`} · ${done ? '已翻牌' : '待翻牌'}`;
              return (
                <li
                  className={done ? 'complete' : 'current'}
                  aria-label={status}
                  title={status}
                  key={id}
                >
                  {portraits[id] && <img src={portraits[id]} alt="" />}
                  <span>{index + 1}</span>
                  {done && <span aria-hidden="true">✓</span>}
                </li>
              );
            })}
          </ol>
        ) : (
          <TurnProgress game={game} />
        )}
        {game.coin && (
          <div className="ex-coin-result" role="status">
            <span className="coin-face">
              <img src={coinArt[game.coin]} alt="" />
            </span>
            <strong>{game.coin === 'meowth' ? '喵喵面' : '皮卡丘面'}</strong>
          </div>
        )}
      </section>
      <section
        className={`ex-public-held ${game.held ? 'has-held' : ''} ${moved && ['draw', 'draw-buffer'].includes(moved.verb) ? 'ex-saved' : ''}`}
        data-pile="held"
        aria-label="公开暂持区"
      >
        {game.held ? (
          <Card profile={game.rulesProfile} face={game.held} />
        ) : (
          <svg viewBox="0 0 48 56" aria-hidden="true">
            <rect x="12" y="4" width="30" height="43" rx="5" />
            <path d="M7 14H4v37h29" />
            <circle cx="27" cy="25" r="8" />
            <path d="M19 25h16" />
          </svg>
        )}
        <div>
          <span>暂持区</span>
          <strong>
            {game.held
              ? game.held.abilityUsed && game.held.ability
                ? '能力已使用'
                : game.phase === 'mew-self' || game.phase === 'zapdos-receive'
                  ? '等待换入'
                  : '等待处理'
              : game.phase === 'draw'
                ? '待取牌'
                : '暂未持牌'}
          </strong>
        </div>
      </section>
      <div className="ex-public-piles">
        <section data-pile="deck">
          <header>
            <strong>摸牌堆</strong>
            <span>{game.deckCount}</span>
          </header>
          <Card profile={game.rulesProfile} face={null} compact />
        </section>
        {(bufferedProfile(game.rulesProfile) ? [0] : [0, 1]).map((i) => (
          <section key={i} data-pile={i === 0 ? 'discard' : 'discard-second'}>
            <header>
              <strong>
                {bufferedProfile(game.rulesProfile)
                  ? '弃牌堆'
                  : `弃牌 ${i + 1}`}
              </strong>
              {i === 0 && (
                <span aria-label={`共 ${game.discardCount} 张`}>
                  {game.discardCount}
                </span>
              )}
            </header>
            {game.discardOptions[i] ? (
              <Card
                profile={game.rulesProfile}
                face={game.discardOptions[i]}
                compact
              />
            ) : (
              <div className="ex-empty-pile">暂无</div>
            )}
          </section>
        ))}
      </div>
      {research}
      <section className="ex-last-action" aria-label="最新已保存操作">
        <div className="ex-action-summary" role="status" aria-atomic="true">
          {summary && <span>{summary.actor}</span>}
          <strong>
            {summary ? (
              <>
                <span>{summary.operation}</span>{' '}
                {summary.subject && <span>{summary.subject}</span>}
              </>
            ) : initial && latest?.kind === 'research' ? (
              '研究任务已选定'
            ) : (
              latest?.text.replaceAll(' · ', ' ') || '暂无保存行动'
            )}
          </strong>
        </div>
        <button
          className="secondary"
          aria-label="查看最近操作"
          onClick={showHistory}
        >
          记录
        </button>
      </section>
    </aside>
  );
}
