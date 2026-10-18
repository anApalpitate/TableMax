import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Action, ManilaView } from '../rules/view';
import {
  actionLabel,
  cargoColors,
  cargoNames,
  seatColors,
  spaceName,
} from './labels';
import { CargoArt, SiteArt, Worker, cargoStyle } from './pieces';
import { DragSource, useManilaInteraction } from './interaction';
import { CloseMark, CopperMark } from './Theme';

type Props = {
  boundary?: string;
  game: ManilaView;
  actions: Action[];
  locked: boolean;
  draft: Action | null;
  select(action: Action | null): void;
  choose(action: Action): void;
};
function CloseAlternatives({ title }: { title: string }) {
  return (
    <div className="mn-alternative-heading">
      <h3>{title}</h3>
      <button
        className="mn-close"
        type="button"
        aria-label="收起操作列表"
        onClick={(event) => {
          const details = event.currentTarget.closest('details');
          if (details) {
            details.open = false;
            details
              .querySelector<HTMLElement>(':scope > summary')
              ?.focus({ preventScroll: true });
          }
        }}
      >
        <CloseMark />
      </button>
    </div>
  );
}
function Finance({
  game,
  actions,
  locked,
  choose,
}: Pick<Props, 'game' | 'actions' | 'locked' | 'choose'>) {
  const finance = actions.filter(
    (action): action is Extract<Action, { type: 'mortgage' | 'repay' }> =>
      action.type === 'mortgage' || action.type === 'repay',
  );
  const shares = game.self?.shares ?? [];
  if (!shares.length) return null;
  const choices = (
    <div className="mn-finance-choices">
      {shares.map((share) => {
        const action = finance.find((entry) => entry.shareId === share.id);
        return (
          <button
            key={share.id}
            data-mn-finance-share={share.id}
            data-manila-action={action?.type}
            className="mn-finance-choice"
            disabled={locked || !action}
            onClick={() => {
              if (action) choose(action);
            }}
          >
            <CargoArt cargo={share.cargo} />
            <strong>
              {action
                ? actionLabel(action, game)
                : `${cargoNames[share.cargo]}${share.mortgaged ? '已抵押' : '暂不可抵押'}`}
            </strong>
            <span>
              {action?.type === 'mortgage'
                ? '+12 ₱'
                : action?.type === 'repay'
                  ? '−15 ₱'
                  : share.mortgaged
                    ? '已借 12 ₱'
                    : '本次不可操作'}
            </span>
            <span>{share.revealed ? '已公开股份' : '未公开股份'}</span>
          </button>
        );
      })}
    </div>
  );
  return game.phase === 'financing' &&
    game.payment?.seatId === game.self?.seatId ? (
    <section
      className="mn-finance mn-finance--payment"
      aria-label="选择抵押股份"
    >
      <h3>选择一张股份</h3>
      {choices}
      <p>
        每张抵押 +12 ₱；赎回支付 15 ₱ 并公开。未赎回的股份终局每张扣 15
        ₱，资金足够后继续付款。
      </p>
    </section>
  ) : (
    <section className="mn-finance" aria-label="股份抵押与赎回">
      {choices}
      <p className="mn-detail-note">
        抵押取得 12 ₱；赎回支付 15 ₱ 并公开该股份。抵押股份终局扣除 15 ₱。
      </p>
    </section>
  );
}
export function PlayerControls({
  boundary,
  game,
  actions,
  locked,
  draft,
  select,
  choose,
}: Props) {
  const work = useManilaInteraction();
  const bids = actions.filter(
    (action): action is Extract<Action, { type: 'bid' }> =>
      action.type === 'bid',
  );
  const minimumBid = bids[0]?.amount ?? game.auction.bid + 1;
  const [bidInput, setBidInput] = useState({ boundary, amount: minimumBid });
  const bid = bidInput.boundary === boundary ? bidInput.amount : minimumBid;
  const setup = actions.some((action) => action.type === 'setup');
  const pilot = actions.some((action) => action.type === 'pilot');
  const controls = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    controls.current
      ?.querySelectorAll<HTMLDetailsElement>('details.mn-alternatives[open]')
      .forEach((details) => {
        if (details.contains(document.activeElement))
          details
            .querySelector<HTMLElement>(':scope > summary')
            ?.focus({ preventScroll: true });
        details.open = false;
      });
  }, [boundary]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const opened = controls.current?.querySelector<HTMLDetailsElement>(
        'details.mn-alternatives[open]',
      );
      if (!opened) return;
      opened.open = false;
      opened
        .querySelector<HTMLElement>(':scope > summary')
        ?.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('keydown', close);
    };
  }, []);
  if (!actions.length)
    return (
      <section
        id="mn-action-area"
        ref={controls}
        className="mn-controls mn-controls--waiting"
        aria-label="本人行动"
        data-stage={game.phase}
      >
        <span className="mn-controls-status" role="status">
          {game.phase === 'round-result'
            ? '本航次已完成'
            : game.phase === 'financing'
              ? '等待商人完成付款'
              : '等待其他商人行动'}
        </span>
      </section>
    );
  const places = actions.filter(
    (action): action is Extract<Action, { type: 'place' }> =>
      action.type === 'place',
  );
  const boards = actions.filter(
    (action): action is Extract<Action, { type: 'board' }> =>
      action.type === 'board',
  );
  const plunders = actions.filter(
    (action): action is Extract<Action, { type: 'plunder' }> =>
      action.type === 'plunder',
  );
  const buys = actions.filter(
    (action): action is Extract<Action, { type: 'buy-share' }> =>
      action.type === 'buy-share',
  );
  const direct = actions.filter((action) =>
    ['pass', 'skip-share'].includes(action.type),
  );
  const directLabel = (action: Action) =>
    action.type === 'pass' && game.phase !== 'auction'
      ? '结束派遣'
      : actionLabel(action, game);
  const payment = (cost: number) => {
    const funds = (game.self?.cash ?? 0) + (game.self?.availableCredit ?? 0);
    return cost === 0
      ? '免费派遣'
      : cost > funds
        ? `付尽 ${funds} ₱ 盲乘`
        : `支付 ${cost} ₱${cost > (game.self?.cash ?? 0) ? '，需选择股份抵押' : ''}`;
  };
  const chosenSpace =
    draft?.type === 'place'
      ? game.spaces.find((entry) => entry.id === draft.space)
      : undefined;
  const chosen = setup ? work.setupAction : pilot ? work.pilotAction : draft;
  const used = Object.values(work.deltas).reduce(
    (sum, value) => sum + Math.abs(value),
    0,
  );
  const total = work.positions.reduce((sum, value) => sum + value, 0);
  const budget = game.phase === 'pilot-small' ? 1 : 2;
  const title = setup
    ? work.setupStep === 1
      ? '1 选择三船货物'
      : '2 分配起航位置'
    : pilot
      ? game.phase === 'pilot-small'
        ? '小领航员调整一格'
        : '大领航员调整最多两格'
      : places.length
        ? '把伙伴派到哪里？'
        : boards.length
          ? '海盗登船'
          : plunders.length
            ? '海盗掠夺'
            : game.phase === 'share'
              ? '购买一张股份'
              : bids.length
                ? '竞拍港务长'
                : game.phase === 'financing' && actions.length
                  ? '选择股份抵押付款'
                  : game.phase === 'round-result'
                    ? '本航次已完成'
                    : '等待其他商人';
  const alternatives = (
    <>
      {setup && (
        <div className="mn-draft-grid">
          {work.cargos.map((cargo, index) => (
            <div
              className="mn-draft-card"
              key={index}
              style={cargoStyle(cargoColors[cargo])}
            >
              <strong>第 {index + 1} 航道</strong>
              <CargoArt cargo={cargo} />
              {work.setupStep === 1 ? (
                <label>
                  货物
                  <select
                    value={cargo}
                    disabled={locked}
                    onChange={(event) =>
                      work.setCargo(index, event.target.value as typeof cargo)
                    }
                  >
                    {game.cargos.map((entry) => (
                      <option value={entry.id} key={entry.id}>
                        {cargoNames[entry.id]}（分红 {entry.payout}）
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label>
                  {cargoNames[cargo]}起点
                  <select
                    value={work.positions[index]}
                    disabled={locked}
                    onChange={(event) =>
                      work.setPosition(index, Number(event.target.value))
                    }
                  >
                    {[0, 1, 2, 3, 4, 5].map((value) => (
                      <option value={value} key={value}>
                        {value} 格
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ))}
        </div>
      )}
      {pilot && (
        <div className="mn-draft-grid">
          {game.boats
            .filter((boat) => boat.destination === 'sea')
            .map((boat) => (
              <label className="mn-draft-card" key={boat.cargo}>
                <CargoArt cargo={boat.cargo} />
                <strong
                  className="mn-cargo"
                  style={cargoStyle(cargoColors[boat.cargo])}
                >
                  <span>{cargoNames[boat.cargo]}</span>
                  <span>{boat.position}格</span>
                </strong>
                <select
                  aria-label={`${cargoNames[boat.cargo]}移动`}
                  disabled={locked}
                  value={work.deltas[boat.cargo] ?? 0}
                  onChange={(event) =>
                    work.setDelta(boat.cargo, Number(event.target.value))
                  }
                >
                  {(budget === 1 ? [-1, 0, 1] : [-2, -1, 0, 1, 2])
                    .filter((delta) => boat.position + delta >= 0)
                    .map((delta) => (
                      <option value={delta} key={delta}>
                        {delta === 0
                          ? '不移动'
                          : `${delta > 0 ? '前进' : '后退'} ${Math.abs(delta)} 格`}
                      </option>
                    ))}
                </select>
                <span className="mn-pilot-preview">
                  草稿：
                  {boat.position + (work.deltas[boat.cargo] ?? 0) > 13
                    ? '靠港'
                    : `${boat.position + (work.deltas[boat.cargo] ?? 0)} 格`}
                </span>
              </label>
            ))}
        </div>
      )}
      {places.length > 0 && (
        <div className="mn-action-grid">
          {places.map((action) => {
            const space = game.spaces.find(
              (entry) => entry.id === action.space,
            )!;
            return (
              <button
                key={action.space}
                disabled={locked}
                aria-pressed={
                  draft?.type === 'place' && draft.space === action.space
                }
                onClick={() => select(action)}
              >
                {space.kind === 'cargo' ? (
                  <CargoArt cargo={space.cargo!} />
                ) : (
                  <SiteArt kind={space.kind} />
                )}
                <strong>{spaceName(space)}</strong>
                <span className="mn-action-facts">
                  <span>{payment(space.cost)}</span>
                  {space.payout !== null && (
                    <span>
                      {space.kind === 'cargo'
                        ? `分红池 ${space.payout} ₱ 均分`
                        : space.kind === 'insurance'
                          ? '立即领 10 ₱，承担修船赔付'
                          : `成功获 ${space.payout} ₱`}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {[...boards, ...plunders].length > 0 && (
        <div className="mn-inline-actions">
          {[...boards, ...plunders].map((action, index) => (
            <button
              key={index}
              disabled={locked}
              onClick={() => select(action)}
              aria-pressed={JSON.stringify(draft) === JSON.stringify(action)}
            >
              {'cargo' in action && action.cargo ? (
                <CargoArt cargo={action.cargo} />
              ) : (
                <SiteArt kind="pirate" />
              )}
              <span>{actionLabel(action, game)}</span>
            </button>
          ))}
        </div>
      )}
      <Finance game={game} actions={actions} locked={locked} choose={choose} />
    </>
  );
  const more = (setup ||
    pilot ||
    places.length ||
    boards.length ||
    plunders.length) && (
    <details className="mn-alternatives">
      <summary aria-label="展开替代操作">
        <CopperMark kind="list" />
        <span>操作列表</span>
      </summary>
      <div className="mn-alternative-content">
        <CloseAlternatives title={title} />
        {alternatives}
      </div>
    </details>
  );
  return (
    <section
      id="mn-action-area"
      ref={controls}
      className="mn-panel mn-controls"
      aria-label="本人行动"
      data-stage={game.phase}
    >
      <div className="mn-controls-heading">
        <h2>{title}</h2>
        {bids.length > 0 && (
          <span className="mn-bid-range">
            出价范围 {bids[0]!.amount}–{bids.at(-1)!.amount} ₱
          </span>
        )}
        {work.carry && (
          <button onClick={() => work.setCarry(null)} disabled={locked}>
            放下
          </button>
        )}
      </div>
      {game.phase === 'financing' &&
        game.payment &&
        game.payment?.seatId === game.self?.seatId && (
          <>
            <div className="mn-financing-notice">
              <strong className="mn-payment-summary">
                <span>待支付 {game.payment.amount} ₱</span>
                <span>
                  还差{' '}
                  {Math.max(0, game.payment.amount - (game.self?.cash ?? 0))} ₱
                </span>
              </strong>
              <p className="mn-payment-context">
                <span>
                  {game.payment.reason === 'insurance'
                    ? '保险行赔付'
                    : game.payment.reason === 'auction'
                      ? '港务长竞拍款'
                      : game.payment.reason === 'share'
                        ? '购买股份'
                        : '伙伴派遣费用'}
                </span>
                <span>现金 {game.self?.cash ?? 0} ₱</span>
              </p>
            </div>
            <Finance
              game={game}
              actions={actions}
              locked={locked}
              choose={choose}
            />
          </>
        )}
      {bids.length > 0 && (
        <>
          <div className="mn-inline-actions mn-bid-controls">
            <label htmlFor="mn-bid-amount">出价金额</label>
            <input
              id="mn-bid-amount"
              type="number"
              inputMode="numeric"
              min={bids[0]!.amount}
              max={bids.at(-1)!.amount}
              step="1"
              value={bid}
              disabled={locked}
              onChange={(event) =>
                setBidInput({ boundary, amount: Number(event.target.value) })
              }
            />
            <span>比索</span>
          </div>
          {bid > (game.self?.cash ?? 0) && (
            <p className="mn-bid-credit">若竞拍获胜，需选择股份抵押付款。</p>
          )}
        </>
      )}
      {buys.length > 0 && (
        <div className="mn-share-choices">
          {buys.map((action) => (
            <button
              key={action.cargo}
              disabled={locked}
              aria-pressed={
                draft?.type === 'buy-share' && draft.cargo === action.cargo
              }
              onClick={() => select(action)}
            >
              <CargoArt cargo={action.cargo} />
              <strong>{cargoNames[action.cargo]}</strong>
              <span>{Math.max(5, game.market[action.cargo])} ₱</span>
            </button>
          ))}
        </div>
      )}
      {(places.length > 0 ||
        setup ||
        pilot ||
        boards.length > 0 ||
        plunders.length > 0) && (
        <div className="mn-action-tray">
          {places.length > 0 && (
            <>
              <DragSource
                token={{ kind: 'worker' }}
                label="拿起伙伴，拖到岗位或点击岗位"
                className="mn-worker-source"
              >
                <Worker
                  number={game.seatOrder.indexOf(game.self!.seatId) + 1}
                  color={seatColors[game.seatOrder.indexOf(game.self!.seatId)]!}
                  label="你的伙伴"
                />
                <span>伙伴</span>
              </DragSource>
              <span className="mn-tray-instruction">拖或点</span>
            </>
          )}
          {setup && work.setupStep === 1 && (
            <div className="mn-cargo-tray">
              {game.cargos.map((cargo) => (
                <DragSource
                  token={{ kind: 'cargo', cargo: cargo.id }}
                  label={`拿起${cargoNames[cargo.id]}货物`}
                  key={cargo.id}
                  className="mn-cargo-source"
                >
                  <CargoArt cargo={cargo.id} />
                  <span>{cargoNames[cargo.id]}</span>
                </DragSource>
              ))}
            </div>
          )}
          {setup && work.setupStep === 2 && (
            <p>
              <span className="mn-pointer-instruction">拖动起点</span>
              <span className="mn-touch-instruction">点箭头调位</span>
              <br />
              每船0–5，合计9格
            </p>
          )}
          {pilot && (
            <p>
              <span className="mn-pointer-instruction">拖动木船调位</span>
              <span className="mn-touch-instruction">点箭头调位</span>
              <br />
              已用 {used}/{budget} 格
            </p>
          )}
          {boards.length > 0 && (
            <>
              <DragSource
                token={{ kind: 'pirate' }}
                label="拿起海盗，拖到可登船的货船"
                className="mn-pirate-source"
              >
                <span aria-hidden="true">⚑</span>
                <span>海盗</span>
              </DragSource>
              <span className="mn-tray-instruction">拖或点</span>
              <button
                disabled={locked}
                onClick={() =>
                  select(boards.find((action) => action.cargo === null)!)
                }
              >
                留在海盗船
              </button>
            </>
          )}
          {plunders.length > 0 && <p>点港口或船坞</p>}
          {direct
            .filter(
              () =>
                !setup &&
                !pilot &&
                boards.length === 0 &&
                plunders.length === 0,
            )
            .map((action) => (
              <button
                key={action.type}
                data-manila-action={action.type}
                title={actionLabel(action, game)}
                aria-label={actionLabel(action, game)}
                disabled={locked}
                onClick={() => choose(action)}
              >
                {directLabel(action)}
              </button>
            ))}
          {more}
        </div>
      )}
      {!(
        places.length ||
        setup ||
        pilot ||
        boards.length ||
        plunders.length
      ) && (
        <div
          className={`mn-inline-actions mn-action-row${bids.length ? ' mn-auction-actions' : ''}`}
        >
          {bids.length > 0 && (
            <button
              className="mn-primary"
              data-manila-action="bid"
              disabled={locked || !bids.some((action) => action.amount === bid)}
              onClick={() => {
                const action = bids.find((entry) => entry.amount === bid);
                if (action) choose(action);
              }}
            >
              <span className="mn-action-label">出价</span>
            </button>
          )}
          {direct.map((action) => (
            <button
              key={action.type}
              data-manila-action={action.type}
              title={actionLabel(action, game)}
              aria-label={actionLabel(action, game)}
              disabled={locked}
              onClick={() => choose(action)}
            >
              <span className="mn-action-label">{directLabel(action)}</span>
            </button>
          ))}
          {game.phase !== 'financing' && Boolean(game.self?.shares.length) && (
            <details className="mn-alternatives">
              <summary>
                <CopperMark kind="shares" />
                <span className="mn-action-label">股份操作</span>
              </summary>
              <div className="mn-alternative-content">
                <CloseAlternatives title="股份抵押与赎回" />
                <Finance
                  game={game}
                  actions={actions}
                  locked={locked}
                  choose={choose}
                />
              </div>
            </details>
          )}
        </div>
      )}
      {(draft || setup || pilot) && (
        <div className="mn-confirm" aria-label="确认当前草稿">
          <div className="mn-confirm-description">
            <strong>
              {setup
                ? work.setupStep === 1
                  ? `不装载${cargoNames[game.cargos.find((cargo) => !work.cargos.includes(cargo.id))!.id]}`
                  : `起点合计 ${total} / 9`
                : pilot
                  ? chosen
                    ? actionLabel(chosen, game)
                    : '超出本次领航额度'
                  : actionLabel(draft!, game)}
            </strong>
            {chosenSpace && (
              <p>
                {payment(chosenSpace.cost)}
                {chosenSpace.kind === 'insurance'
                  ? '；领10 ₱，最多赔29 ₱（本人修船岗位免赔）'
                  : chosenSpace.kind === 'cargo'
                    ? `；抵港平分 ${chosenSpace.payout} ₱，失航或遭掠夺无分红`
                    : chosenSpace.kind === 'port' ||
                        chosenSpace.kind === 'shipyard'
                      ? `；至少${chosenSpace.index + 1}船${chosenSpace.kind === 'port' ? '抵港' : '入坞'}才领 ${chosenSpace.payout} ₱`
                      : chosenSpace.kind === 'pirate'
                        ? '；船停13格才有机会，未触发不退费用'
                        : '；只得移动权，无直接分红，费用不退'}
              </p>
            )}
            {draft?.type === 'buy-share' && (
              <p>
                支付 {Math.max(5, game.market[draft.cargo])}{' '}
                ₱；股份种类仅你可见。
              </p>
            )}
            {pilot && (
              <p>
                已用 {used} / {budget} 格，确认后才移动货船。
              </p>
            )}
          </div>
          <div className="mn-confirm-actions">
            {setup ? (
              <button
                disabled={locked || work.setupStep === 1}
                onClick={() => work.setSetupStep(1)}
              >
                返回选货
              </button>
            ) : pilot ? (
              <button disabled={locked || used === 0} onClick={work.clearPilot}>
                清空调整
              </button>
            ) : (
              <button
                disabled={locked}
                onClick={() => {
                  select(null);
                  work.setCarry(null);
                }}
              >
                取消
              </button>
            )}
            {setup && work.setupStep === 1 ? (
              <button
                className="mn-primary"
                disabled={locked}
                onClick={() => {
                  work.setSetupStep(2);
                  work.setCarry(null);
                }}
              >
                下一步：设起点
              </button>
            ) : (
              <button
                className="mn-primary"
                data-manila-action={
                  setup ? 'setup' : pilot ? 'pilot' : draft?.type
                }
                disabled={locked || !chosen}
                onClick={() => {
                  if (chosen) choose(chosen);
                }}
              >
                {setup
                  ? '确认起航'
                  : pilot
                    ? '确认领航'
                    : draft?.type === 'place'
                      ? '确认派遣'
                      : draft?.type === 'buy-share'
                        ? '确认购买'
                        : '确认行动'}
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
