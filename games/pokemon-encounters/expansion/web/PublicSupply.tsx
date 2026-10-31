import { type ReactNode } from 'react';
import type { View } from '../project';
import { categoryPresentation } from '../cards';
import { coinArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { useExpansionPresentation } from './PresentationContext';
import { bufferedProfile, eventDescription } from './view-model';
import { Card } from './Cards';

export function PublicSupply({
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
          <Card profile={game.rulesProfile} face={null} compact />
        </section>
        {(bufferedProfile(game.rulesProfile) ? [0] : [0, 1]).map((i) => (
          <section key={i} data-pile={i === 0 ? 'discard' : 'discard-second'}>
            <header>
              <strong>
                {bufferedProfile(game.rulesProfile)
                  ? '弃牌顶部'
                  : `可选弃牌${i + 1}`}
              </strong>
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
      <section
        className={`ex-public-held ${game.held ? 'has-held' : ''} ${moved && ['draw', 'draw-buffer'].includes(moved.verb) ? 'ex-saved' : ''}`}
        data-pile="held"
        aria-label="公开暂持区"
      >
        {game.held ? (
          <>
            <Card profile={game.rulesProfile} face={game.held} />
            <div>
              <span>当前取牌</span>
              <strong>{game.held.name}</strong>
              <p>
                {game.held.abilityUsed && game.held.ability
                  ? '能力已使用，选择一格放入场地'
                  : categoryPresentation(
                      game.held.categoryId,
                      game.rulesProfile,
                    ).abilitySummary || '选一格放入场地'}
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
              {game.phase !== 'draw' && <strong>本次操作已完成</strong>}
            </div>
          </>
        )}
      </section>
      <div className="ex-last-action" role="status">
        <span>最近行动</span>
        <p>
          {game.events.at(-1) && eventDescription(game.events.at(-1)!, names)}
        </p>
      </div>
      {research}
    </aside>
  );
}
