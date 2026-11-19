/* eslint-disable react-refresh/only-export-components -- Lazy adapter exports a GameClient. */
import { useId, useState } from 'react';
import { RulebookIcon } from '@tablemax/web-host';
import {
  Settings,
  OverlayPanel,
  RoomManagement,
  RulesGuide,
  ScreenLink,
  SessionFeedback,
  SettingHelp,
  useAudioOutput,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { Action, RaView } from '../rules';
import { tileNames } from '../rules/data';
import { holdingsBreakdown, scoreDelta } from '../rules/scoring';
import { SunDisk, TableArt, TileFace } from './art';
import { RaPresentation, RaSetupSettings } from './presentation';
import type { SettlementTable } from './settlement';
import { RaEffects } from './effects';
import { liveRaFeedback } from './feedback';
import { PlayerBoard, PlayerSummary, AuctionBadge } from './player-board';
import { AuctionRecap, AuctionRecordPanel } from './auction-recap';
import { DecisionControls, type Exchange } from './decision-controls';
import { raRulebook } from './rules-guide';
import './ra.css';
import './table-details.css';
import './player-wide.css';

const causes = {
  drawRa: '抽到拉',
  invokeFull: '满行呼唤拉',
  invokeOpen: '呼唤拉',
};
const pushBoatPreference = 'tablemax:ra:auction-push-boat';

function RaScreen({ session }: { session: GameHost }) {
  const audioEnabled = useAudioOutput();
  const boatSettingId = useId();
  const [pushBoat, setPushBoat] = useState(() => {
    try {
      return localStorage.getItem(pushBoatPreference) === '1';
    } catch {
      return false;
    }
  });
  const [ignoredPush, setIgnoredPush] = useState('');
  const feedback = liveRaFeedback(session);
  const pushKey = feedback?.events.some((event) => event.kind === 'ra-invoke')
    ? `${feedback.instanceId}:${feedback.branch}:${feedback.revision}`
    : '';
  const [topPanel, setTopPanel] = useState<'rules'>();
  const [detailPanel, setDetailPanel] = useState<'record' | 'opponents'>();
  const [showScores, setShowScores] = useState<string>();
  const [exchange, setExchange] = useState<{
    key: string;
    target?: Exchange;
  }>();
  const game = session.view?.gameView as RaView | null;
  const name = (id: string) =>
    session.view?.seats.find((seat) => seat.id === id)?.name ?? id;
  const ownBoard =
    session.role === 'player'
      ? game?.players.find((player) => player.seat === session.self?.id)
      : undefined;
  const projectedParts =
    ownBoard?.private && game && !game.pending && game.phase !== 'ended'
      ? holdingsBreakdown(
          ownBoard.held.map((tile) => tile.id),
          game.players.map((player) => player.held.map((tile) => tile.id)),
          game.epoch,
        )
      : null;
  const projection =
    projectedParts && ownBoard?.private
      ? {
          parts: projectedParts,
          delta: scoreDelta(ownBoard.private.score, projectedParts),
        }
      : null;
  const decisionKey = session.view?.decisionId
    ? `${session.view.instanceId}:${session.view.branch}:${session.view.decisionId}`
    : '';
  const exchangeOptions = ((session.view?.actions ?? []) as Action[]).filter(
    (action): action is Exchange => action.type === 'spendGod',
  );
  const currentExchange = exchange?.key === decisionKey ? exchange : undefined;
  const exchangeTarget = exchangeOptions.find(
    (option) =>
      option.slot === currentExchange?.target?.slot &&
      option.tileId === currentExchange.target.tileId &&
      option.godId === currentExchange.target.godId,
  );
  const godMode =
    exchangeOptions.length > 0 &&
    (game?.phase === 'godChain' || Boolean(currentExchange));
  const auction = game?.auction;
  const highestBid = auction?.bids.filter((bid) => bid.disk !== null).at(-1);
  const auctionStatus = (seat: string) =>
    auction
      ? {
          caller: seat === auction.caller ? causes[auction.cause] : undefined,
          bid: auction.bids.find((bid) => bid.seat === seat)?.disk,
          highest: highestBid?.seat === seat,
        }
      : undefined;
  const ranks = game?.phase === 'ended' ? finalRanks(game) : [];
  const scoreDetails = ranks.find((result) => result.seat === showScores);
  const lastAuction = game?.lastAuction;
  const seatCards = (settlementTable?: SettlementTable) => (
    <section
      className="ra-seats ra-public-seats"
      aria-label={ranks.length ? '终局排名' : '玩家摘要'}
    >
      {game?.players.map((player) => (
        <PlayerSummary
          key={player.seat}
          player={player}
          name={name(player.seat)}
          active={player.seat === game.actor}
          auction={auctionStatus(player.seat)}
          table
          score={
            game.publicScoring
              ? game.publicScores?.find((entry) => entry.seat === player.seat)
                  ?.total
              : undefined
          }
          result={ranks.find((result) => result.seat === player.seat)}
          showScores={() => setShowScores(player.seat)}
          settlementTable={settlementTable}
        />
      ))}
    </section>
  );
  return (
    <main
      className="ra-table shell"
      data-role={session.role}
      data-players={game?.players.length}
    >
      <header className="ra-header">
        <ScreenLink
          className="button secondary ra-home"
          href={`/${session.role}`}
          aria-label="返回盒子"
          title="返回盒子"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 12H4m6 6-6-6 6-6" />
          </svg>
          <span>返回盒子</span>
        </ScreenLink>
        <div className="ra-heading">
          <h1>
            <span className="ra-brand-mark" aria-hidden="true">
              <SunDisk />
            </span>
            太阳神
          </h1>
        </div>
        <div className="ra-toolbar-controls">
          <button
            type="button"
            className="secondary ra-rule-control"
            aria-label="规则"
            aria-haspopup="dialog"
            title="规则"
            onClick={() => setTopPanel('rules')}
          >
            <RulebookIcon />
          </button>
          {session.role !== 'public' && (
            <Settings
              session={session}
              iconOnly
              localGamePreferences={
                <div className="display-settings-choice ra-push-setting">
                  <SettingHelp
                    id={boatSettingId}
                    label="玩家拍卖推船"
                    hint="主动开拍时，太阳船短暂前探后归位。此项仅适用于当前设备。"
                  />
                  <button
                    type="button"
                    className="secondary"
                    role="switch"
                    aria-checked={pushBoat}
                    aria-labelledby={boatSettingId}
                    onClick={() => {
                      setIgnoredPush(pushKey);
                      setPushBoat(!pushBoat);
                      try {
                        localStorage.setItem(
                          pushBoatPreference,
                          pushBoat ? '0' : '1',
                        );
                      } catch {
                        // The setting still works for this page without storage.
                      }
                    }}
                  >
                    <span
                      className={`settings-switch${pushBoat ? ' settings-switch--on' : ''}`}
                      aria-hidden="true"
                    />
                    {pushBoat ? '已开启' : '已关闭'}
                  </button>
                </div>
              }
            />
          )}
          <RoomManagement session={session} />
        </div>
        <SessionFeedback session={session} mode="toolbar-save" />
      </header>
      {topPanel === 'rules' && (
        <OverlayPanel
          title="太阳神规则"
          className="ra-rules-panel"
          close={() => setTopPanel(undefined)}
        >
          <RulesGuide {...raRulebook} />
        </OverlayPanel>
      )}
      <div className="ra-feedback-slot">
        <SessionFeedback session={session} mode="messages" />
      </div>
      <RaEffects session={session} game={game} audioEnabled={audioEnabled} />
      {game && (
        <>
          <div className="ra-player-layout">
            <div className="ra-player-table">
              <section className="ra-board" aria-label="公共牌桌">
                <div className="ra-status">
                  <h2>
                    {game.epoch < 3 && (
                      <TableArt
                        piece={
                          game.epoch === 1 ? 'epoch-first' : 'epoch-second'
                        }
                        className="ra-epoch-art"
                      />
                    )}
                    第 {game.epoch} 时代
                  </h2>
                  <strong>
                    {game.winner
                      ? `${name(game.winner)}获胜`
                      : game.actor
                        ? `${name(game.actor)}行动`
                        : '对局结束'}
                  </strong>
                  <span className="ra-central-disk">
                    <span className="ra-center-label">中央盘</span>{' '}
                    <SunDisk value={game.center} />
                  </span>
                </div>
                <RaTrack
                  key={game.epoch}
                  drawn={game.raDrawn}
                  limit={game.limit}
                  pushKey={pushBoat && pushKey !== ignoredPush ? pushKey : ''}
                />
                <ol className="ra-lot" aria-label="拍卖行">
                  {game.lot.map((tile, index) => {
                    const target = godMode
                      ? exchangeOptions.find((action) => action.slot === index)
                      : undefined;
                    return (
                      <li
                        key={index}
                        data-occupied={tile !== null}
                        data-god-blocked={
                          Boolean(godMode && tile && !target) || undefined
                        }
                        aria-label={`第 ${index + 1} 格 ${tile ? tileNames[tile.face] : '空'}`}
                      >
                        {tile &&
                          (target ? (
                            <button
                              type="button"
                              className="ra-lot-target"
                              aria-label={`换取第 ${index + 1} 格 ${tileNames[tile.face]}`}
                              aria-pressed={exchangeTarget?.tileId === tile.id}
                              disabled={session.locked}
                              onClick={() =>
                                setExchange(
                                  exchangeTarget?.tileId === tile.id
                                    ? { key: decisionKey }
                                    : { key: decisionKey, target },
                                )
                              }
                            >
                              <TileFace tile={tile} decorative />
                            </button>
                          ) : (
                            <TileFace tile={tile} decorative />
                          ))}
                      </li>
                    );
                  })}
                </ol>
                <TableArt piece="auction-board" className="ra-board-ornament" />
                <div className="ra-board-note" role="status">
                  {game.pending ? (
                    <strong className="ra-pending">
                      <TileFace tile={game.pending.tile} />
                      {name(game.pending.owner)}处理灾难
                    </strong>
                  ) : game.phase === 'ended' ? (
                    game.lot.some(Boolean) ? (
                      '剩余拍品不计分'
                    ) : (
                      '第三时代已结算'
                    )
                  ) : game.epoch > 1 ? (
                    `第 ${game.epoch - 1} 时代已结算`
                  ) : null}
                </div>
              </section>
              {ownBoard && (
                <section
                  className="ra-compact-auction"
                  data-auction={Boolean(auction)}
                  aria-label={auction ? '各席竞拍状态' : '同桌玩家'}
                  style={{
                    gridTemplateColumns: `repeat(${game.players.length}, minmax(0, 1fr))`,
                  }}
                >
                  <h2 className="ra-wide-seats-title">
                    {auction ? '竞价席位' : '同桌玩家'}
                  </h2>
                  {game.players.map((player) => {
                    const status = auctionStatus(player.seat);
                    const label =
                      status?.bid === null
                        ? '跳过'
                        : status?.highest
                          ? '最高'
                          : status?.bid !== undefined
                            ? '出价'
                            : status?.caller
                              ? '发起'
                              : undefined;
                    return (
                      <article
                        key={player.seat}
                        data-active={player.seat === game.actor}
                      >
                        <span
                          className="ra-auction-seat-name"
                          title={name(player.seat)}
                        >
                          {name(player.seat)}
                        </span>
                        <div className="ra-player-seat-status">
                          <AuctionBadge status={status} />
                          {label && (
                            <span
                              className="ra-wide-seat-label"
                              aria-hidden="true"
                            >
                              {label}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </section>
              )}
              {ownBoard && lastAuction && (
                <div className="ra-wide-recap">
                  <AuctionRecap
                    record={lastAuction}
                    name={name}
                    open={() => setDetailPanel('record')}
                  />
                </div>
              )}
              {ownBoard && ranks.length > 0 && (
                <section className="ra-phone-ranking" aria-label="终局排名">
                  <ol>
                    {ranks.map(({ seat, rank, total }) => (
                      <li key={seat}>
                        <span>
                          第 {rank} 名 {name(seat)}
                        </span>
                        <b>{total} 分</b>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </div>
            <div className="ra-player-self">
              {ownBoard && (
                <DecisionControls
                  decisionKey={decisionKey}
                  session={session}
                  game={game}
                  player={ownBoard}
                  exchange={exchangeTarget}
                  godMode={godMode}
                  enterGod={() => setExchange({ key: decisionKey })}
                  exitGod={() => setExchange(undefined)}
                  clearTarget={() => setExchange({ key: decisionKey })}
                  savedFeedback={Boolean(feedback)}
                />
              )}
              {ownBoard && (
                <PlayerBoard
                  player={ownBoard}
                  name={name(ownBoard.seat)}
                  active={ownBoard.seat === game.actor}
                  ended={game.phase === 'ended'}
                  epoch={game.epoch}
                  projection={projection}
                  primary
                  footer={
                    <nav className="ra-player-board-nav" aria-label="牌桌明细">
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => setDetailPanel('opponents')}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <circle cx="9" cy="8" r="3" />
                          <path d="M3 19v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 5a3 3 0 0 1 0 6m2 2a4 4 0 0 1 3 4v2" />
                        </svg>
                        其他玩家
                      </button>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        onClick={() => setDetailPanel('record')}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 4h12v16H6zM9 8h6m-6 4h6m-6 4h4" />
                        </svg>
                        拍卖记录
                      </button>
                    </nav>
                  }
                />
              )}
            </div>
          </div>
          {!ownBoard &&
            (session.role === 'host' ? (
              <RaPresentation
                key={[
                  session.view?.instanceId,
                  session.view?.branch,
                  session.view?.paused,
                  session.view?.playMode,
                  session.connected,
                ].join(':')}
                session={session}
                game={game}
                audioEnabled={audioEnabled}
              >
                {seatCards}
              </RaPresentation>
            ) : (
              seatCards()
            ))}
          {!ownBoard && lastAuction && (
            <AuctionRecap
              record={lastAuction}
              name={name}
              open={() => setDetailPanel('record')}
            />
          )}
          {ownBoard && detailPanel === 'opponents' && (
            <OverlayPanel
              title="其他玩家"
              className="ra-detail-panel ra-detail-panel--player"
              close={() => setDetailPanel(undefined)}
            >
              <div className="ra-opponent-list">
                {game.players
                  .filter((player) => player.seat !== ownBoard.seat)
                  .map((player) => (
                    <PlayerSummary
                      key={player.seat}
                      player={player}
                      name={name(player.seat)}
                      active={player.seat === game.actor}
                      auction={auctionStatus(player.seat)}
                    />
                  ))}
              </div>
            </OverlayPanel>
          )}
          {detailPanel === 'record' && (
            <AuctionRecordPanel
              record={lastAuction ?? null}
              name={name}
              player={Boolean(ownBoard)}
              close={() => setDetailPanel(undefined)}
            />
          )}
          {scoreDetails && (
            <OverlayPanel
              title={`${name(scoreDetails.seat)}的时代计分`}
              close={() => setShowScores(undefined)}
            >
              <ol className="ra-record-list">
                {scoreDetails.scores.map((score) => (
                  <li key={score.epoch}>
                    第 {score.epoch} 时代{' '}
                    <b>
                      {score.delta > 0 ? '+' : ''}
                      {score.delta} 分 · 累计 {score.total}
                    </b>
                  </li>
                ))}
              </ol>
            </OverlayPanel>
          )}
        </>
      )}
    </main>
  );
}

function RaTrack({
  drawn,
  limit,
  pushKey,
}: {
  drawn: number;
  limit: number;
  pushKey: string;
}) {
  const position = drawn ? ((drawn - 0.5) / limit) * 100 : 0;
  return (
    <div className="ra-track">
      <span>
        拉轨{' '}
        <b>
          {drawn}／{limit}
        </b>
      </span>
      <div
        className="ra-track-slots"
        role="progressbar"
        aria-label="拉轨"
        aria-valuenow={drawn}
        aria-valuemin={0}
        aria-valuemax={limit}
      >
        {Array.from({ length: limit }, (_, index) => (
          <span
            key={index}
            className="ra-track-step"
            data-filled={index < drawn}
            data-current={index + 1 === drawn}
            data-terminal={index + 1 === limit}
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
            </svg>
          </span>
        ))}
        <span
          className="ra-track-token"
          data-active={drawn > 0}
          style={{ left: `${position}%` }}
          aria-hidden="true"
        >
          <TableArt
            key={pushKey}
            piece="sun-boat"
            className={
              pushKey ? 'ra-track-boat ra-track-nudge' : 'ra-track-boat'
            }
          />
        </span>
      </div>
    </div>
  );
}

function finalRanks(game: RaView) {
  const ranked = game.players
    .flatMap((player) =>
      player.private
        ? [
            {
              seat: player.seat,
              total: player.private.score,
              scores: player.private.scores,
              highest: Math.max(...player.disks, ...player.private.spentDisks),
            },
          ]
        : [],
    )
    .sort((a, b) => b.total - a.total || b.highest - a.highest);
  return ranked.map((result, index) => ({
    ...result,
    rank: index + 1,
    tied:
      ranked[index - 1]?.total === result.total ||
      ranked[index + 1]?.total === result.total,
  }));
}

export const client: GameClient = {
  Screen: RaScreen,
  SetupSettings: RaSetupSettings,
  savedChanges: () => [],
  motionDuration: 0,
};
