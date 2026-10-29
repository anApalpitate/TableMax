import { DecisionContext } from './DecisionContext';
import { DecisionField } from './DecisionField';
import { DecisionFooter } from './DecisionFooter';
import { ResearchVote } from './ResearchVote';
import { useDecisionController } from './useDecisionController';

import type { GameHost } from '@tablemax/web-host';
import { avatarFor } from '@tablemax/web-host';
import {
  LandscapeDecisionLayout,
  PortraitDecisionLayout,
} from '../../ui/PlayerDecisionLayout';
import { WinTrack } from '../../ui/WinTrack';
import type { View } from '../project';
import { Board, BufferCard } from './Cards';
import { useExpansionPresentation } from './PresentationContext';

export function Actions({
  landscape = false,
  session,
  game,
  showResearch,
}: {
  landscape?: boolean;
  session: GameHost;
  game: View;
  showResearch: (id: string) => void;
}) {
  const Layout = landscape ? LandscapeDecisionLayout : PortraitDecisionLayout;
  const { motion } = useExpansionPresentation();
  const decision = useDecisionController(session, game);
  const { actions, names, self, locked, choose, actorAvatar } = decision;
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
              {a.type === 'discard-held' ? '弃到牌堆' : '存入缓冲'}
            </button>
          ))}
      </div>
    ) : null;
  const props = {
    game,
    session,
    decision,
    motion,
    landscape,
    showResearch,
    heldOptions,
  };
  if (game.phase === 'research-vote') return <ResearchVote {...props} />;
  if (!actions.length)
    return (
      <section className="ex-actions ex-observing" aria-label="本人场地">
        <header className="ex-action-heading">
          <img src={avatarFor(session.self?.avatarId ?? 'builtin-1')} alt="" />
          <h2>{session.self?.name ?? '本人'}的场地</h2>
          <WinTrack wins={game.winsBySeat[self] ?? 0} />
        </header>
        <Layout
          context={
            <>
              <div className="ex-wait" role="status">
                {landscape && (
                  <img
                    className="desktop-actor-avatar"
                    src={actorAvatar}
                    alt=""
                  />
                )}
                {game.actorSeat
                  ? `等待 ${names[game.actorSeat]} 行动`
                  : '等待其他玩家翻牌'}
              </div>
              {landscape && <BufferCard game={game} seat={self} />}
            </>
          }
          field={<Board game={game} seat={self} motion={motion} />}
          actions={!landscape ? <BufferCard game={game} seat={self} /> : null}
        />
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
      <Layout
        context={<DecisionContext {...props} />}
        field={<DecisionField {...props} />}
        actions={<DecisionFooter {...props} />}
      />
    </section>
  );
}
