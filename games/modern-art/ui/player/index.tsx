import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { Action, ModernArtView } from '../view';
import { ArtCard } from '../ArtCard';
import { money } from '../public/labels';
import {
  PaintingSortControl,
  ArtistMark,
  AuctionMark,
} from '../painting-display';
import { artistPresentation } from '../artist-presentation';
import { auctionNames } from '../public/labels';
import type { CSSProperties, ReactNode, RefObject } from 'react';
import { sortPaintings, type PaintingSort } from '../sorting';

type MoneyAction = Extract<Action, { amount: number }>;

type HandBrowsePosition = {
  left: number;
  top: number;
  anchor: string | undefined;
  offsetX: number;
  offsetY: number;
};

function useHandBrowsePosition(
  handRef: RefObject<HTMLDivElement | null>,
  selectionKey: string,
  layoutKey: string,
  sort: PaintingSort,
  expanded: boolean,
) {
  const memory = useRef({
    selectionKey,
    positions: new Map<string, HandBrowsePosition>(),
  });
  const restoring = useRef(false);
  const positionKey = `${layoutKey}:${sort}`;
  const remember = useCallback(() => {
    const hand = handRef.current;
    if (
      !expanded ||
      restoring.current ||
      memory.current.selectionKey !== selectionKey ||
      !hand ||
      !hand.clientWidth ||
      !hand.clientHeight
    )
      return;
    const bounds = hand.getBoundingClientRect();
    const anchor = [
      ...hand.querySelectorAll<HTMLElement>('.ma-hand__card'),
    ].find((card) => {
      const rect = card.getBoundingClientRect();
      return (
        rect.right > bounds.left + 1 &&
        rect.left < bounds.right - 1 &&
        rect.bottom > bounds.top + 1 &&
        rect.top < bounds.bottom - 1
      );
    });
    const rect = anchor?.getBoundingClientRect();
    memory.current.positions.set(positionKey, {
      left: hand.scrollLeft,
      top: hand.scrollTop,
      anchor: anchor?.dataset.cardId,
      offsetX: rect ? rect.left - bounds.left : 0,
      offsetY: rect ? rect.top - bounds.top : 0,
    });
  }, [expanded, handRef, positionKey, selectionKey]);
  useLayoutEffect(() => {
    if (memory.current.selectionKey !== selectionKey) {
      memory.current = { selectionKey, positions: new Map() };
    }
    const hand = handRef.current;
    if (!expanded || !hand) return;
    const saved = memory.current.positions.get(positionKey);
    restoring.current = true;
    const restore = () => {
      let left = saved?.left ?? 0;
      let top = saved?.top ?? 0;
      const anchor =
        saved?.anchor &&
        [...hand.querySelectorAll<HTMLElement>('.ma-hand__card')].find(
          (card) => card.dataset.cardId === saved.anchor,
        );
      if (anchor && saved) {
        const bounds = hand.getBoundingClientRect();
        const rect = anchor.getBoundingClientRect();
        left = hand.scrollLeft + rect.left - bounds.left - saved.offsetX;
        top = hand.scrollTop + rect.top - bounds.top - saved.offsetY;
      }
      hand.scrollTo({ left, top, behavior: 'instant' });
    };
    restore();
    let frame = requestAnimationFrame(() => {
      restore();
      frame = requestAnimationFrame(() => {
        restoring.current = false;
        remember();
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      restoring.current = false;
    };
  }, [expanded, handRef, positionKey, remember, selectionKey]);
  return remember;
}

function AmountControls({
  actions,
  locked,
  choose,
  pass,
  passLabel,
  compact = false,
}: {
  actions: readonly MoneyAction[];
  locked: boolean;
  choose(action: Action): void;
  pass: Action | undefined;
  passLabel: string;
  compact?: boolean;
}) {
  const minimum = actions.reduce(
    (value, action) => Math.min(value, action.amount),
    Infinity,
  );
  const maximum = actions.reduce(
    (value, action) => Math.max(value, action.amount),
    0,
  );
  const [amount, setAmount] = useState(String(minimum));
  const value = Number(amount);
  const chosen =
    amount.trim() && Number.isInteger(value)
      ? actions.find((action) => action.amount === value)
      : undefined;
  const type = actions[0]?.type;
  const label =
    type === 'sealed-bid'
      ? '提交暗标'
      : type === 'set-price'
        ? '确认一口价'
        : '出价';
  return (
    <form
      className="ma-bid"
      onSubmit={(event) => {
        event.preventDefault();
        if (chosen && !locked) choose(chosen);
      }}
    >
      <label htmlFor="ma-bid-amount">
        <span>
          {type === 'set-price'
            ? '出售价格'
            : type === 'sealed-bid'
              ? '你的秘密出价'
              : compact
                ? '出价'
                : '你的出价'}
        </span>
        <small className="ma-bid__range">
          {minimum}–{maximum}
          {!compact && ' 千元'}
        </small>
      </label>
      <div className="ma-bid__field">
        <button
          type="button"
          className="ma-bid__step"
          aria-label="减少出价"
          disabled={locked || !Number.isFinite(value) || value <= minimum}
          onClick={() =>
            setAmount(
              String(
                Math.max(minimum, Math.min(maximum, Math.ceil(value) - 1)),
              ),
            )
          }
        >
          −
        </button>
        <input
          id="ma-bid-amount"
          aria-label={compact ? '你的出价金额（千元）' : undefined}
          type="number"
          inputMode="numeric"
          autoComplete="off"
          min={minimum}
          max={maximum}
          step="1"
          value={amount}
          disabled={locked}
          onChange={(event) => setAmount(event.target.value)}
        />
        <span>千元</span>
        <button
          type="button"
          className="ma-bid__step"
          aria-label="增加出价"
          disabled={locked || !Number.isFinite(value) || value >= maximum}
          onClick={() =>
            setAmount(
              String(
                Math.max(minimum, Math.min(maximum, Math.floor(value) + 1)),
              ),
            )
          }
        >
          +
        </button>
      </div>
      <div className={`ma-bid__submit ${pass ? 'ma-bid__submit--pair' : ''}`}>
        <button
          type="submit"
          data-ma-action={type}
          disabled={locked || !chosen}
        >
          {label}
          {chosen ? ` ${money(chosen.amount)}` : ''}
        </button>
        {pass && (
          <button
            type="button"
            data-ma-action="pass"
            className="secondary"
            disabled={locked}
            onClick={() => choose(pass)}
          >
            {passLabel}
          </button>
        )}
      </div>
      {!chosen && (
        <p className="ma-bid__invalid" role="status">
          {Number.isInteger(value) && value < minimum
            ? compact
              ? `至少${minimum}千元；输入已保留。`
              : `当前报价已提高，请改为至少 ${minimum} 千元。你的输入已保留。`
            : compact
              ? '仅限范围内整数；输入已保留。'
              : '请输入当前允许范围内的整数金额。'}
        </p>
      )}
    </form>
  );
}

export function PlayerControls({
  stage,
  leader,
  compactBidHeader = false,
  layoutKey = 'legacy',
  view,
  actions,
  locked,
  selectionKey,
  names,
  activityMessage,
  choose,
}: {
  stage: ReactNode;
  leader?: ReactNode;
  compactBidHeader?: boolean;
  layoutKey?: string;
  view: ModernArtView;
  actions: readonly Action[];
  locked: boolean;
  selectionKey: string;
  names: Record<string, string>;
  activityMessage?: string | undefined;
  choose(action: Action): void;
}) {
  const self = view.self;
  const [sort, setSort] = useState<PaintingSort>('artist');
  const [handRequested, setHandRequested] = useState<{
    key: string;
    expanded: boolean;
  } | null>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const moneyActions = actions.filter(
    (action): action is MoneyAction => 'amount' in action,
  );
  const compactBid = compactBidHeader && moneyActions.length > 0;
  const offered = new Map(
    actions.flatMap((action) =>
      'cardId' in action ? [[action.cardId, action] as const] : [],
    ),
  );
  const handAction =
    (view.phase === 'offer' || view.phase === 'double') && offered.size > 0;
  const handExpanded =
    handRequested?.key === selectionKey ? handRequested.expanded : handAction;
  const rememberHandPosition = useHandBrowsePosition(
    handRef,
    `${selectionKey}:${self?.seatId ?? 'none'}`,
    layoutKey,
    sort,
    handExpanded,
  );
  if (!self) return null;
  const browseHand = (direction: -1 | 1) => {
    const hand = handRef.current;
    const first = hand?.querySelector<HTMLElement>('.ma-hand__card');
    if (!hand || !first) return;
    const style = getComputedStyle(hand);
    const gap = Number.parseFloat(style.columnGap) || 0;
    const stride = first.offsetWidth + gap;
    const available =
      hand.clientWidth -
      (Number.parseFloat(style.paddingLeft) || 0) -
      (Number.parseFloat(style.paddingRight) || 0);
    const count = Math.max(1, Math.floor((available + gap) / stride));
    hand.scrollBy({ left: direction * count * stride, behavior: 'auto' });
  };
  const pass = actions.find((action) => action.type === 'pass');
  const passLabel =
    view.auction?.kind === 'open'
      ? '本次不加价'
      : view.auction?.kind === 'once'
        ? '本次不出价'
        : '不买入';
  const decline = actions.find((action) => action.type === 'decline-double');
  const buy = actions.find((action) => action.type === 'buy');
  const collection = sortPaintings(
    view.players[self.seatId]?.collection ?? [],
    sort,
  );
  const collectionGroups = [
    ...new Set(
      collection.map((card) => `${card.artistId}:${card.auctionKind}`),
    ),
  ].map((key) => {
    const cards = collection.filter(
      (card) => `${card.artistId}:${card.auctionKind}` === key,
    );
    return { card: cards[0]!, count: cards.length };
  });
  const actingSeats =
    view.auction?.actingSeats ?? (view.turnSeat ? [view.turnSeat] : []);
  const acting = actingSeats[0]
    ? (names[actingSeats[0]] ?? '玩家')
    : '其他玩家';
  const waitingLabel =
    self.sealedBid !== null
      ? '等待其他玩家提交'
      : actingSeats.length > 1
        ? `等待 ${actingSeats.length} 位玩家行动`
        : `${acting} 正在行动`;
  return (
    <section className="ma-player" aria-label="你的玩家区域">
      <div className="ma-player__workspace">
        {stage}
        <div
          className="ma-player__operations"
          data-compact-bid={compactBid || undefined}
        >
          <div className="ma-wallet">
            <div>
              <span className="ma-wallet__icon" aria-hidden="true">
                ▥
              </span>
              <span>{compactBid ? '资金' : '你的博物馆'}</span>
            </div>
            <strong>
              <span aria-hidden="true" className="ma-coin">
                $
              </span>
              {money(self.cash)}
            </strong>
          </div>
          <div className="ma-controls" aria-label="拍卖操作">
            {moneyActions.length > 0 && (
              <AmountControls
                key={`${selectionKey}:${moneyActions[0]!.type}`}
                actions={moneyActions}
                locked={locked}
                choose={choose}
                pass={pass}
                passLabel={passLabel}
                compact={compactBid}
              />
            )}
            <div className="ma-controls__simple">
              {buy && (
                <button
                  data-ma-action="buy"
                  disabled={locked}
                  onClick={() => choose(buy)}
                >
                  买入 {money(view.auction?.fixedPrice ?? 0)}
                </button>
              )}
              {pass && !moneyActions.length && (
                <button
                  className="secondary"
                  data-ma-action="pass"
                  disabled={locked}
                  onClick={() => choose(pass)}
                >
                  {passLabel}
                </button>
              )}
              {decline && (
                <button
                  className="secondary"
                  data-ma-action="decline-double"
                  disabled={locked}
                  onClick={() => choose(decline)}
                >
                  不追加画作
                </button>
              )}
            </div>
            {self.sealedBid !== null && (
              <p className="ma-private-bid">
                <span>你的暗标</span> <strong>{money(self.sealedBid)}</strong>{' '}
                <span>已提交</span>
              </p>
            )}
            {!activityMessage &&
              !actions.length &&
              view.phase !== 'offer' &&
              view.phase !== 'ended' &&
              view.phase !== 'round-result' && (
                <p className="ma-waiting" role="status" title={waitingLabel}>
                  {waitingLabel}
                </p>
              )}
          </div>
          {leader}
        </div>
      </div>
      <div
        className="ma-player__cards"
        data-hand-expanded={handExpanded}
        data-hand-action={handAction || undefined}
      >
        <div className="ma-section-heading ma-hand-heading">
          <h2>
            {!activityMessage && view.phase === 'double' && offered.size > 0
              ? '追加同画家画作'
              : view.phase === 'offer' && offered.size
                ? '选画上拍'
                : '你的手牌'}
          </h2>
          <span className="ma-hand-count">{self.hand.length} 张</span>
          <button
            className="secondary ma-hand-toggle"
            type="button"
            aria-expanded={handExpanded}
            aria-controls="ma-private-hand"
            onClick={() =>
              setHandRequested({ key: selectionKey, expanded: !handExpanded })
            }
          >
            <span className="ma-hand-toggle__portrait">
              {handExpanded ? '收起' : '查看手牌'}
            </span>
            <span className="ma-hand-toggle__landscape">
              {handExpanded ? '返回拍卖' : `手牌 ${self.hand.length} 张`}
            </span>
            <span className="ma-hand-toggle__icon" aria-hidden="true">
              {handExpanded ? '⌃' : '⌄'}
            </span>
          </button>
        </div>
        <div id="ma-private-hand" hidden={!handExpanded}>
          <div className="ma-hand-tools">
            <span>仅你可见</span>
            <PaintingSortControl
              value={sort}
              change={setSort}
              label="你的手牌和收藏排序"
            />
            <div className="ma-hand-navigation" aria-label="横向浏览手牌">
              <button
                type="button"
                className="secondary"
                aria-label="上一页手牌"
                aria-controls="ma-hand-gallery"
                onClick={() => browseHand(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="secondary"
                aria-label="下一页手牌"
                aria-controls="ma-hand-gallery"
                onClick={() => browseHand(1)}
              >
                ›
              </button>
            </div>
          </div>
          <div
            id="ma-hand-gallery"
            className="ma-hand"
            ref={handRef}
            onScroll={rememberHandPosition}
            role="region"
            aria-label="你的完整手牌，横屏可左右浏览"
            tabIndex={0}
          >
            {sortPaintings(self.hand, sort).map((card) => {
              const action = offered.get(card.id);
              const artist = view.artists.find(
                (entry) => entry.id === card.artistId,
              );
              return (
                <button
                  key={card.id}
                  type="button"
                  data-card-id={card.id}
                  data-ma-action={action?.type}
                  className={`ma-hand__card ${action ? 'ma-hand__card--available' : ''} ${action?.type === 'add-double' && !locked && !activityMessage ? 'ma-hand__card--double' : ''}`}
                  aria-label={`${action?.type === 'add-double' ? '追加' : action ? '上拍' : '手牌'} ${artist?.name ?? card.artistId} ${card.title}`}
                  disabled={locked || !action}
                  onClick={() => {
                    if (action) choose(action);
                  }}
                >
                  <ArtCard card={card} artist={artist} />
                </button>
              );
            })}
            {!self.hand.length && (
              <p className="ma-empty-hand">手牌已全部上拍</p>
            )}
          </div>
          <section className="ma-self-collection" aria-label="你的公开收藏">
            <div className="ma-section-heading">
              <h2>你的收藏</h2>
              <span>
                {view.players[self.seatId]?.collection.length ?? 0} 幅
              </span>
            </div>
            <div className="ma-collection-summary">
              {collectionGroups.map(({ card, count }) => (
                <div
                  key={`${card.artistId}:${card.auctionKind}`}
                  style={
                    {
                      '--ma-artist': artistPresentation[card.artistId].color,
                    } as CSSProperties
                  }
                >
                  <span className="ma-collection-summary__artist">
                    <ArtistMark artistId={card.artistId} />
                    <strong>
                      {artistPresentation[card.artistId].shortName}
                    </strong>
                  </span>
                  <span className="ma-collection-summary__kind">
                    <AuctionMark kind={card.auctionKind} />
                    {auctionNames[card.auctionKind]}
                  </span>
                  <b>×{count}</b>
                </div>
              ))}
              {!view.players[self.seatId]?.collection.length && (
                <p className="ma-museum__empty">尚未收藏画作</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
