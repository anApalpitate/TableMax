/* eslint-disable react-refresh/only-export-components -- Independent expansion client adapter. */
import { useState } from 'react';
import type { GameHost } from '@tablemax/web-host';
import {
  avatarFor,
  useAudioOutput,
  OverlayPanel,
  ScreenLink,
  DisplaySettings,
  CountdownSettings,
  RoomManagement,
  SessionFeedback,
  PlayModeControl,
  PlayModeBadge,
} from '@tablemax/web-host';
import type { JsonValue } from '@tablemax/game-sdk';
import type { View } from '../project';
import { task } from '../research';
import { WinTrack } from '../../ui/WinTrack';
import { usePokemonViewport } from '../../ui/usePokemonViewport';
import { ResearchCard, ResearchPicture } from './ResearchCard';
import { ResearchReward } from './ResearchReward';
import { portraitFor } from './card-art';
import { cardArt } from '../../../../assets/games/pokemon-encounters/catalog';
import { SoundControl } from '../../ui/audio';
import { expansionVoices } from './voice-resources';
import { expansionSoundRecipe, expansionThemeFor } from './presentation';
import { SavedEffects } from './SavedEffects';
import { CircularBadge } from './CircularBadge';
import { EventEnvironment, EventStatus } from './EventEnvironment';
import { presentedWins } from './playback';
import {
  researchAdjustmentText,
  researchScoreText,
} from './research-presentation';
import { useExpansionPresentation } from './PresentationContext';
import { ArenaAtmosphere } from './ArenaAtmosphere';
import { phaseText, namesOf, eventDescription } from './view-model';
import { BufferCard, Board, TurnProgress } from './Cards';
import { PublicSupply } from './PublicSupply';
import { Actions } from './PlayerActions';
import { Rulebook } from './Rulebook';

export const expansionThemes = import.meta.glob<string>(
  '../../../../assets/games/pokemon-encounters/expansion/audio/*.ogg',
  { eager: true, query: '?url', import: 'default' },
);

export function ScreenBody({
  session,
  game,
}: {
  session: GameHost;
  game: View;
}) {
  const canPlay = useAudioOutput();
  const viewport = usePokemonViewport(session.role === 'player');
  const presentation = useExpansionPresentation();
  const { motion, resultReady } = presentation;
  const profile = game.rulesProfile ?? 'legacy';
  const [panel, setPanel] = useState<
      | 'menu'
      | 'rules'
      | 'friends'
      | 'research'
      | 'score'
      | 'history'
      | 'votes'
      | null
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
  const pendingSeats =
    game.phase === 'research-vote'
      ? game.seatOrder.filter((id) => !game.votedSeats.includes(id))
      : game.phase === 'initial-flip'
        ? game.seatOrder.filter((id) => !game.initialDone.includes(id))
        : game.actorSeat
          ? [game.actorSeat]
          : [];
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
  const roundContext =
    !game.roundResult &&
    (research || game.currentEvent || game.bondPlaceholders?.length) ? (
      <div className="ex-round-context">
        <EventStatus game={game} />
        {research}
      </div>
    ) : null;
  const renderSeat = (s: (typeof seats)[number]) => (
    <article
      className={`ex-player ${game.actorSeat === s.id ? 'acting' : ''} ${resultReady && game.roundResult?.winners.includes(s.id) ? 'winner' : ''}`}
      key={s.id}
      data-seat={s.id}
    >
      <header>
        {game.matchWinners.includes(s.id) && (
          <span
            className="winner-crown"
            role="img"
            aria-label="大局赢家皇冠"
            style={{ visibility: resultReady ? 'visible' : 'hidden' }}
          >
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
      {game.roundResult && (
        <button
          className="ex-score ex-settlement-text"
          style={{ visibility: resultReady ? 'visible' : 'hidden' }}
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
      data-pokemon-viewport={viewport.id}
      className={`expansion-screen ${session.role}`}
      data-layout={viewport.layout}
      data-below-minimum={viewport.belowMinimum || undefined}
      data-net-width={viewport.width}
      data-net-height={viewport.height}
      data-narrow-table={viewport.layout === 'P' || viewport.width <= 1100}
      style={viewport.style}
      data-players={seats.length}
      data-phase={game.phase}
      data-play-mode={session.view?.playMode}
      data-rules-profile={profile}
    >
      <ArenaAtmosphere />
      <EventEnvironment game={game} />
      <div className="ex-heading-region">
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
              <PlayModeBadge mode={session.view?.playMode} />
              <SoundControl
                compact
                iconOnly
                disabled={
                  session.view?.playMode === 'test' || !session.connected
                }
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
          <button
            className="secondary ex-menu-entry"
            aria-label="菜单"
            title="菜单"
            onClick={() => setPanel('menu')}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path transform="translate(0.5 0)" d="M8 6h13M8 12h13M8 18h13" />
              <path
                d="M3 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0 6a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                transform="translate(0.5 0)"
              />
            </svg>
          </button>
        </header>
        <div className="ex-round-banner">
          <span>第 {game.roundNumber} 小局</span>
          <strong>
            {game.phase === 'mewtwo-target' && profile === 'events-research-v3'
              ? '超梦：私看对手一张'
              : phaseText[game.phase]}
          </strong>
          <span
            className="ex-current-actor"
            data-simultaneous={pendingSeats.length > 1}
          >
            {game.phase === 'research-vote' && (
              <span className="ex-actor-progress">
                投票 {game.votedSeats.length}/{game.seatOrder.length}
              </span>
            )}
            {game.phase === 'initial-flip' && (
              <span className="ex-actor-progress">
                翻牌 {game.initialDone.length}/{game.seatOrder.length}
              </span>
            )}
            {pendingSeats.length
              ? pendingSeats.map((id) => {
                  const seat = seats.find((entry) => entry.id === id);
                  return (
                    <span
                      className="ex-actor-identity"
                      title={names[id] ?? '玩家'}
                      aria-label={names[id] ?? '玩家'}
                      data-actor-seat={id}
                      key={id}
                    >
                      <img
                        src={avatarFor(seat?.avatarId ?? 'builtin-1')}
                        alt=""
                      />
                      <span>{names[id] ?? '玩家'}</span>
                    </span>
                  );
                })
              : '三胜赛制'}
          </span>
          <TurnProgress game={game} />
        </div>
      </div>
      {viewport.belowMinimum && (
        <div className="pokemon-layout-warning" role="status">
          当前可用区域较小，可滚动查看全部牌位与操作。
        </div>
      )}
      {session.role === 'player' && roundContext}
      <SessionFeedback session={session} mode="messages" />
      {session.view?.paused && (
        <div className="ex-paused" role="status">
          对局已暂停，当前牌面与研究保留。
        </div>
      )}
      {game.roundResult && (
        <section
          className="ex-victory ex-settlement-text"
          style={{ visibility: resultReady ? 'visible' : 'hidden' }}
          aria-label="本局结果"
        >
          <span className="ex-winner-emblem" aria-hidden="true">
            {game.matchWinners.length ? '♛' : '✦'}
          </span>
          <div>
            <p className="ex-semantic-groups">
              <span>
                {game.matchWinners.length
                  ? '三胜达成'
                  : `第 ${game.roundNumber} 小局`}
              </span>
              <span>
                {game.matchWinners.length ? '大局赢家' : '最低分获胜'}
              </span>
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
          <Actions
            landscape={viewport.layout === 'L'}
            session={session}
            game={game}
            showResearch={showResearch}
          />
        ) : (
          <section className="ex-vote">
            <div className="ex-vote-options">
              {game.researchCandidates.map((t) => (
                <article className="ex-mission-option" key={t.id}>
                  <ResearchCard task={t} profile={profile} />
                  <button
                    className="secondary"
                    onClick={() => showResearch(t.id)}
                  >
                    条件与图解
                  </button>
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
              landscape={viewport.layout === 'L'}
              key={session.view?.decisionId ?? game.phase}
              session={session}
              game={game}
              showResearch={showResearch}
            />
          ) : !game.roundResult && session.role !== 'player' ? (
            <PublicSupply game={game} names={names} research={roundContext} />
          ) : null}
        </div>
      )}
      <SavedEffects
        game={game}
        session={session}
        portraitFor={(id) => portraitFor(id) ?? cardArt(id).image}
      />
      {panel && (
        <OverlayPanel
          navigation={panel === 'menu'}
          {...(panel === 'history' || panel === 'votes'
            ? { back: () => setPanel('menu') }
            : {})}
          {...(panel === 'friends'
            ? { className: 'pokemon-expansion-friends-panel' }
            : {})}
          title={
            panel === 'rules' ? (
              '扩展版图文规则'
            ) : panel === 'friends' ? (
              '朋友的牌桌'
            ) : panel === 'research' ? (
              '研究任务'
            ) : panel === 'score' ? (
              <span className="ex-score-panel-title">
                <span>{names[detail] ?? '玩家'}</span>
                <span>计分明细</span>
              </span>
            ) : panel === 'history' ? (
              '对局记录'
            ) : panel === 'votes' ? (
              '研究投票结果'
            ) : (
              '牌桌菜单'
            )
          }
          close={() => setPanel(null)}
        >
          {panel === 'history' || panel === 'votes' ? (
            <>
              {panel === 'votes' ? (
                <>
                  {' '}
                  {game.voteCounts && (
                    <section className="ex-vote-results">
                      <h2>研究投票结果</h2>
                      {game.researchCandidates.map((t) => (
                        <p key={t.id}>
                          {t.name}：{game.voteCounts![t.id]}票
                          {game.activeResearch[0]?.id === t.id
                            ? '，本局采用'
                            : ''}
                        </p>
                      ))}
                    </section>
                  )}
                </>
              ) : (
                <>
                  <section className="ex-event-log">
                    <h2>已保存记录</h2>
                    {game.events
                      .slice(-12)
                      .reverse()
                      .map((e) => (
                        <p key={e.id}>{eventDescription(e, names)}</p>
                      ))}
                  </section>
                </>
              )}
            </>
          ) : panel === 'research' ? (
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
            <Rulebook
              profile={profile}
              activeResearchIds={game.activeResearch.map((task) => task.id)}
            />
          ) : panel === 'friends' ? (
            <div className="expansion-screen ex-friends">
              {seats.filter((s) => s.id !== session.self?.id).map(renderSeat)}
            </div>
          ) : (
            <>
              <div className="dialog-actions game-menu-settings">
                <CountdownSettings session={session} />
                <DisplaySettings role={session.role} />
              </div>
              {session.canControl && <RoomManagement session={session} />}
              {game.voteCounts && (
                <button
                  type="button"
                  className="game-menu-entry"
                  onClick={() => setPanel('votes')}
                >
                  研究投票结果
                </button>
              )}
              <button
                type="button"
                className="game-menu-entry"
                onClick={() => setPanel('history')}
              >
                对局记录
              </button>
            </>
          )}
        </OverlayPanel>
      )}
      <PlayModeControl session={session} />
    </main>
  );
}
