/* eslint-disable react-refresh/only-export-components -- The lazy game entry exports the platform client. */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { JsonValue } from '@tablemax/game-sdk';
import {
  CountdownSettings,
  DecisionCountdown,
  DisplaySettings,
  OverlayPanel,
  PlayModeBadge,
  PlayModeControl,
  RoomManagement,
  RulesGuide,
  ScreenLink,
  SessionFeedback,
  avatarFor,
  useViewportSnapshot,
  type GameClient,
  type GameHost,
} from '@tablemax/web-host';
import type { Action, ManilaView } from '../rules/view';
import {
  HarborBoard,
  Market,
  MerchantRack,
  Players,
  RevealedShares,
} from '../ui/Board';
import { PlayerControls } from '../ui/PlayerControls';
import { Finance } from '../ui/Finance';
import { phaseNames } from '../ui/labels';
import { manilaRulebook } from '../ui/RulesGuide';
import { DetailButton, ManilaInteraction } from '../ui/interaction';
import { ManilaEffects } from '../ui/ManilaEffects';
import { savedChanges } from '../ui/presentation';
import {
  CopperMark,
  ReceiptDetail,
  ShareCertificates,
  VoyageDetail,
} from '../ui/Theme';
import '../ui/style.css';
import '../ui/theme.css';
import '../ui/host-layout.css';
import '../ui/harbor-layout.css';
import '../ui/stage.css';
import { useBoardAnchor } from '../ui/useBoardAnchor';
import { useActionGuidance } from '../ui/useActionGuidance';
import { useStatusSaveAnchor } from '../ui/useStatusSaveAnchor';
import { VoyageResultCard } from '../ui/VoyageResult';
import '../ui/voyage-layout.css';
import '../ui/label-layout.css';
import '../ui/player-layout.css';
import '../ui/stock-layout.css';
import '../ui/viewport-layout.css';

function ManilaScreen({ session }: { session: GameHost }) {
  const { view, role, command, connected, locked, canControl } = session;
  const net = useViewportSnapshot('.mn-screen[data-mn-layout]', '--mn-inset-');
  useEffect(() => {
    if (role !== 'player') return;
    // The game theme arrives after the host interaction layer mounts. Let its
    // existing viewport listener measure the now-mounted toolbar/theme once.
    const frame = requestAnimationFrame(() =>
      window.dispatchEvent(new Event('resize')),
    );
    return () => cancelAnimationFrame(frame);
  }, [role]);
  const wide = net.available.width >= 900 && net.available.height >= 601;
  const game = view?.gameView as ManilaView | null;
  const [panel, setPanel] = useState<'menu' | 'rules' | 'ledger' | null>(null);
  const [financeBoundary, setFinanceBoundary] = useState<string | null>(null);
  const [selection, setSelection] = useState<{
    boundary: string;
    action: Action | null;
  } | null>(null);
  const boundary = `${view?.instanceId}:${view?.branch}:${view?.decisionId ?? 'waiting'}`;
  const actions = role === 'player' ? ((view?.actions ?? []) as Action[]) : [];
  const draft =
    selection?.boundary === boundary &&
    selection.action &&
    actions.some(
      (action) => JSON.stringify(action) === JSON.stringify(selection.action),
    )
      ? selection.action
      : null;
  const select = (action: Action | null) => setSelection({ boundary, action });
  const live = useRef(session);
  useLayoutEffect(() => {
    live.current = session;
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLElement>(null);
  useStatusSaveAnchor(
    statusRef,
    `${boundary}|${view?.revision}|${session.messageKind}|${session.message}|${role}`,
  );
  useBoardAnchor(
    scrollRef,
    [boundary, view?.revision, JSON.stringify(draft), locked].join('|'),
  );
  const choose = (action: Action) => {
    const current = live.current;
    const latest = current.view;
    const latestBoundary = `${latest?.instanceId}:${latest?.branch}:${latest?.decisionId ?? 'waiting'}`;
    if (
      boundary !== latestBoundary ||
      current.role !== 'player' ||
      !latest?.decisionId ||
      current.locked ||
      !current.connected ||
      latest.paused ||
      latest.botError ||
      latest.status !== 'playing' ||
      !latest.actions.some(
        (candidate) => JSON.stringify(candidate) === JSON.stringify(action),
      )
    )
      return;
    current.command({
      type: 'game',
      decisionId: latest.decisionId,
      action: action as unknown as JsonValue,
    });
  };
  const names = Object.fromEntries(
    view?.seats.map((seat) => [seat.id, seat.name]) ?? [],
  );
  const nameText = (text: string) =>
    Object.entries(names).reduce(
      (result, [id, name]) => result.replaceAll(id, name),
      text,
    );
  const active =
    connected && view?.status === 'playing' && !view.paused && !view.botError;
  const guidance = useActionGuidance({
    boundary,
    enabled: Boolean(
      role === 'player' &&
      active &&
      !locked &&
      view?.decisionId &&
      ((game?.phase === 'financing' &&
        game.payment?.seatId === game.self?.seatId) ||
        actions.some(
          (action) =>
            !['mortgage', 'repay', 'next-voyage'].includes(action.type),
        )),
    ),
    revision: view?.revision,
    scrollRef,
  });
  const { goToAction } = guidance;
  const saved =
    session.motion.length > 0 && view?.playMode !== 'test' && active;
  const notice = !connected
    ? '正在重新连接'
    : (view?.botError ??
      (view?.paused
        ? view.restored
          ? '存档已恢复，等待房主继续'
          : '游戏已暂停'
        : view?.status === 'ended' && game?.phase !== 'ended'
          ? (view.endReason ?? '对局已结束')
          : ''));
  const nextVoyage = view?.lifecycleActions.find(
    (action) => (action as Action).type === 'next-voyage',
  ) as Action | undefined;
  const playerNextVoyage = actions.find(
    (action) => action.type === 'next-voyage',
  );
  const actor =
    game && !['round-result', 'ended'].includes(game.phase)
      ? view?.seats.find((seat) => seat.id === game.turnSeat)
      : undefined;
  const actionJump = game &&
    role === 'player' &&
    game.phase !== 'financing' &&
    game.phase !== 'round-result' &&
    game.phase !== 'ended' &&
    actions.length > 0 && (
      <button
        className="mn-action-link"
        onClick={goToAction}
        disabled={!guidance.highlighted}
        data-mn-guidance={
          guidance.highlighted
            ? guidance.pulsing
              ? 'pulse'
              : 'active'
            : undefined
        }
        aria-label="定位到本人操作区"
      >
        <CopperMark
          kind={
            game.phase === 'place'
              ? 'worker'
              : game.phase === 'share'
                ? 'shares'
                : 'list'
          }
        />
        <span>
          {game.phase === 'setup'
            ? '装船'
            : game.phase.startsWith('pilot')
              ? '领航'
              : game.phase === 'share'
                ? '购股'
                : game.phase === 'place'
                  ? '派遣'
                  : game.phase === 'auction'
                    ? '竞拍'
                    : game.phase === 'board'
                      ? '登船'
                      : game.phase === 'plunder'
                        ? '掠夺'
                        : '本人操作'}{' '}
          ↓
        </span>
      </button>
    );
  const status =
    game && view ? (
      <section
        ref={statusRef}
        className="mn-status"
        aria-label="当前阶段"
        data-mn-phase={game.phase}
      >
        <div className="mn-current-turn">
          {actor && (
            <img
              className="mn-actor-avatar"
              src={avatarFor(actor.avatarId ?? 'avatar-1')}
              alt={`${actor.name}正在行动`}
            />
          )}
          <div className="mn-current-turn-copy">
            {role === 'player' && game.phase === 'round-result' ? (
              <span className="mn-result-heading">
                <span className="mn-mobile-voyage">第 {game.voyage} 航次</span>
                <strong className="mn-phase-name">
                  {phaseNames[game.phase]}
                </strong>
              </span>
            ) : (
              <>
                <span className="mn-mobile-voyage">第 {game.voyage} 航次</span>
                <strong className="mn-phase-name">
                  {phaseNames[game.phase]}
                </strong>
              </>
            )}
            <span className="mn-status-detail">
              {game.phase === 'round-result' ? (
                canControl || playerNextVoyage ? (
                  '收支已结算，可启程'
                ) : (
                  '收支已结算，等待启程'
                )
              ) : game.turnSeat ? (
                <>
                  <span className="mn-actor-name">
                    {names[game.turnSeat] ?? '商人'}
                  </span>
                  <span className="mn-turn-hint">
                    {game.turnSeat === game.self?.seatId ? '轮到你' : '行动'}
                  </span>
                </>
              ) : game.phase === 'ended' ? (
                '一项货物达到 30，比较最终财富'
              ) : (
                '等待保存结果'
              )}
              {actionJump}
            </span>
            {game.phase === 'auction' && (
              <span className="mn-auction-standing">
                {game.auction.highBidder ? (
                  <>
                    <span className="mn-leading-bid">
                      最高 {game.auction.bid} ₱
                    </span>{' '}
                    <span className="mn-leading-player">
                      领先：{names[game.auction.highBidder] ?? '商人'}
                    </span>
                  </>
                ) : (
                  '尚无人出价'
                )}
              </span>
            )}
            <span className="mn-status-save">
              <SessionFeedback session={session} mode="saved" />
            </span>
          </div>
        </div>
        <DecisionCountdown
          view={view}
          connected={connected}
          compact={role === 'player'}
        />
        <div className="mn-stage-action">
          {role === 'player' &&
            game.phase === 'financing' &&
            game.payment?.seatId === game.self?.seatId && (
              <button
                className="mn-payment-link"
                onClick={goToAction}
                disabled={!guidance.highlighted}
                data-mn-guidance={
                  guidance.highlighted
                    ? guidance.pulsing
                      ? 'pulse'
                      : 'active'
                    : undefined
                }
              >
                <span>需要付款</span>
                <strong>去处理 ↓</strong>
              </button>
            )}
          {game.phase === 'round-result' &&
            ((canControl && nextVoyage) || playerNextVoyage) && (
              <button
                className="mn-primary mn-next-voyage"
                disabled={locked || !active}
                onClick={() =>
                  canControl && nextVoyage
                    ? command({
                        type: 'lifecycle',
                        action: nextVoyage as unknown as JsonValue,
                      })
                    : playerNextVoyage && choose(playerNextVoyage)
                }
              >
                <CopperMark kind="voyage" />
                <span>下一航次</span>
              </button>
            )}
          {canControl && game.phase === 'ended' && (
            <button
              className="mn-primary"
              disabled={locked}
              onClick={() => command({ type: 'replay' })}
            >
              再玩一局
            </button>
          )}
        </div>
      </section>
    ) : null;
  return (
    <main
      className={`manila-screen mn-screen mn-screen--${role}${role === 'player' && wide ? ' mn-wide' : ''}`}
      data-mn-layout={role !== 'player' ? 'H' : wide ? 'L' : 'P'}
      style={
        {
          '--mn-viewport-width': `${net.viewport.width}px`,
          '--mn-viewport-height': `${net.viewport.height}px`,
          '--mn-safe-top': `${net.safeInsets.top}px`,
          '--mn-safe-bottom': `${net.safeInsets.bottom}px`,
          '--mn-safe-left': `${net.safeInsets.left}px`,
          '--mn-safe-right': `${net.safeInsets.right}px`,
        } as CSSProperties
      }
      data-phase={game?.phase}
      data-financing-self={
        game?.phase === 'financing' &&
        game.payment?.seatId === game.self?.seatId
          ? 'true'
          : 'false'
      }
      data-play-mode={view?.playMode ?? 'play'}
      data-saved-motion={saved ? 'true' : 'false'}
      data-mn-guidance-arrived={guidance.arrived || undefined}
      data-motion={
        saved && session.motion.includes('manila:sail') ? 'sail' : ''
      }
    >
      <header className="mn-toolbar">
        <ScreenLink className="button" href={`/${role}`} aria-label="返回盒子">
          ‹ <span className="mn-box-label">盒子</span>
        </ScreenLink>
        <div className="mn-brand">
          <strong>MANILA</strong>
          <span>马尼拉经典版</span>
        </div>
        {role !== 'player' && status}
        <div className="mn-toolbar-tools">
          <ManilaEffects session={session} />
          <PlayModeBadge mode={view?.playMode} />
          <button
            className="game-rulebook-entry mn-copper-button mn-toolbar-icon"
            aria-label="规则"
            title="规则"
            onClick={() => setPanel('rules')}
          >
            <CopperMark kind="rules" />
          </button>
          <button
            className="mn-copper-button mn-toolbar-icon"
            aria-label="账本"
            title="账本"
            onClick={() => setPanel('ledger')}
          >
            <CopperMark kind="ledger" />
          </button>
          <button
            className="mn-copper-button mn-toolbar-icon"
            aria-label="菜单"
            title="菜单"
            onClick={() => setPanel('menu')}
          >
            <CopperMark kind="menu" />
          </button>
        </div>
      </header>
      {role === 'player' && status}
      <div className="mn-screen-feedback">
        <SessionFeedback session={session} mode="messages" />
        {notice && (
          <div className="mn-notice" role="status">
            <span>{notice}</span>
            {canControl && connected && view?.paused && (
              <button
                disabled={locked}
                onClick={() => command({ type: 'resume' })}
              >
                继续航行
              </button>
            )}
          </div>
        )}
      </div>
      <div
        ref={scrollRef}
        className={
          role === 'player' ? 'mn-player-scroll' : 'mn-display-content'
        }
      >
        {!game || !view ? (
          <section className="mn-empty">
            <h1>等待商人齐聚港湾</h1>
            <p>{connected ? '回到盒子入座并准备。' : '正在恢复港湾沙盘。'}</p>
            <ScreenLink className="button" href={`/${role}`}>
              回到盒子
            </ScreenLink>
          </section>
        ) : (
          <>
            {role === 'player' && game.self && (
              <section
                className="mn-private"
                data-mn-wallet={game.self.seatId}
                aria-label="本人财富与秘密股份"
              >
                <div className="mn-wallet-summary">
                  <div className="mn-cash">
                    <CopperMark kind="coin" />
                    <span>
                      现金<strong>{game.self.cash} ₱</strong>
                    </span>
                  </div>
                  <button
                    className="mn-credit"
                    type="button"
                    aria-label="股份抵押与赎回"
                    aria-haspopup="dialog"
                    aria-expanded={financeBoundary === boundary}
                    disabled={
                      !active ||
                      locked ||
                      !actions.some(
                        (action) =>
                          action.type === 'mortgage' || action.type === 'repay',
                      )
                    }
                    onClick={() => setFinanceBoundary(boundary)}
                  >
                    <CopperMark kind="credit" />
                    <span>
                      抵押可借<strong>{game.self.availableCredit} ₱</strong>
                    </span>
                  </button>
                </div>
                <DetailButton
                  title="查看股票"
                  className="mn-secret-entry"
                  detail={
                    <ShareCertificates
                      shares={game.self.shares}
                      publicView={game.phase === 'ended'}
                      compact
                    />
                  }
                >
                  <span className="mn-sealed-contract" aria-hidden="true">
                    <CopperMark kind="shares" />
                    <i />
                  </span>
                  <span>查看股票</span>
                </DetailButton>
                {game.latest && (
                  <DetailButton
                    title="最新已保存结果"
                    className="mn-receipt-button"
                    detail={
                      <ReceiptDetail
                        voyage={game.voyage}
                        text={nameText(game.latest)}
                      />
                    }
                  >
                    <CopperMark kind="receipt" />
                    回执
                  </DetailButton>
                )}
              </section>
            )}
            <ManilaInteraction
              boundary={boundary}
              game={game}
              actions={actions}
              draft={draft}
              select={select}
              locked={locked || !active}
            >
              <div
                className={`mn-layout${game.result ? ' mn-layout--result' : ''}`}
              >
                {game.result && (
                  <VoyageResultCard
                    key={`${view.instanceId}:${view.branch}:${game.result.voyage}`}
                    game={game}
                    seats={view.seats}
                  />
                )}
                <div className="mn-main">
                  <HarborBoard
                    compactHeading={role !== 'player'}
                    game={game}
                    names={names}
                    actions={actions}
                    draft={draft}
                    select={select}
                    locked={locked || !active}
                    market={<Market game={game} />}
                  >
                    {role === 'player' &&
                      game.self &&
                      game.phase !== 'ended' && (
                        <PlayerControls
                          boundary={boundary}
                          game={game}
                          actions={actions}
                          locked={locked || !active}
                          draft={draft}
                          select={select}
                          choose={choose}
                        />
                      )}
                  </HarborBoard>
                </div>
                <MerchantRack game={game} seats={view.seats} />
              </div>
            </ManilaInteraction>
          </>
        )}
      </div>
      {panel && (
        <OverlayPanel
          className={`mn-overlay mn-theme mn-overlay--${panel}`}
          title={
            panel === 'rules'
              ? '马尼拉图文规则'
              : panel === 'ledger'
                ? '商人账本'
                : '港湾菜单'
          }
          close={() => setPanel(null)}
        >
          {panel === 'rules' ? (
            <RulesGuide {...manilaRulebook} />
          ) : panel === 'ledger' && game ? (
            <div className="mn-ledger">
              <header className="mn-ledger-heading">
                <CopperMark kind="ledger" />
                <strong>商人公账</strong>
                <span>第 {game.voyage} 航次</span>
              </header>
              <Players game={game} seats={view?.seats ?? []} />
              <Market game={game} />
              <DetailButton
                title="航次与岗位说明"
                detail={<VoyageDetail game={game} />}
              >
                航行 {Math.min(game.movement, 3)}/3 ⓘ
              </DetailButton>
              {game.latest && (
                <ReceiptDetail
                  voyage={game.voyage}
                  text={nameText(game.latest)}
                />
              )}
              {game.result && (
                <VoyageResultCard game={game} seats={view?.seats ?? []} />
              )}
              {game.phase === 'ended' && (
                <section className="mn-ledger-final">
                  <h2>终局股份与财富</h2>
                  <p>现金 ＋ 股份市值 − 每张抵押股份 15 ₱；财富相同并列。</p>
                  <ul className="mn-log">
                    {game.seatOrder.map((id) => (
                      <li key={id}>
                        <div className="mn-ledger-total">
                          <strong>{names[id]}</strong>
                          <b>{game.scores?.[id]} ₱</b>
                        </div>
                        <RevealedShares
                          shares={game.players[id]!.revealedShares}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          ) : (
            <>
              <div className="dialog-actions game-menu-settings">
                <CountdownSettings session={session} />
                <DisplaySettings role={role} />
              </div>
              {canControl && (
                <RoomManagement
                  session={session}
                  lifecycleLabel="开始下一航次"
                />
              )}
            </>
          )}
        </OverlayPanel>
      )}
      {financeBoundary === boundary &&
        role === 'player' &&
        game &&
        connected &&
        !view?.paused && (
          <OverlayPanel
            title="股份抵押与赎回"
            close={() => setFinanceBoundary(null)}
          >
            <div className="mn-stock-finance">
              <Finance
                game={game}
                actions={actions}
                locked={locked}
                choose={choose}
              />
            </div>
          </OverlayPanel>
        )}
      <PlayModeControl session={session} />
    </main>
  );
}

export const client: GameClient = {
  Screen: ManilaScreen,
  savedChanges,
  motionDuration: 1400,
};
