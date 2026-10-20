import { useState } from 'react';
import type { Action, ManilaView } from '../rules/view';
import { actionLabel, cargoNames, seatColors } from './labels';
import { CargoArt, Worker } from './pieces';
import { DragSource, useManilaInteraction } from './interaction';
import { Finance } from './Finance';

type Props = {
  boundary?: string;
  game: ManilaView;
  actions: Action[];
  locked: boolean;
  draft: Action | null;
  select(action: Action | null): void;
  choose(action: Action): void;
};
function Money({ amount }: { amount: number }) {
  return <span className="mn-money">{amount} ₱</span>;
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
  if (!actions.length)
    return (
      <section
        id="mn-action-area"
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
              : game.phase === 'auction' && actions.length
                ? bids.length
                  ? '竞拍港务长'
                  : '本轮无法加价，可退出竞拍'
                : game.phase === 'financing' && actions.length
                  ? '选择股份抵押付款'
                  : game.phase === 'round-result'
                    ? '本航次已完成'
                    : '等待其他商人';
  return (
    <section
      id="mn-action-area"
      className="mn-panel mn-controls"
      aria-label="本人行动"
      data-stage={game.phase}
    >
      <div className="mn-controls-heading">
        <h2 tabIndex={-1}>{title}</h2>
        {bids.length > 0 && (
          <span className="mn-bid-range">
            出价范围{' '}
            <span className="mn-money">
              {bids[0]!.amount}–{bids.at(-1)!.amount} ₱
            </span>
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
                <span>
                  待支付 <Money amount={game.payment.amount} />
                </span>
                <span>
                  还差{' '}
                  <Money
                    amount={Math.max(
                      0,
                      game.payment.amount - (game.self?.cash ?? 0),
                    )}
                  />
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
                <span>
                  现金 <Money amount={game.self?.cash ?? 0} />
                </span>
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
              data-mn-primary-control
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
              data-mn-primary-control
              disabled={locked}
              aria-pressed={
                draft?.type === 'buy-share' && draft.cargo === action.cargo
              }
              onClick={() => select(action)}
            >
              <CargoArt cargo={action.cargo} />
              <strong>{cargoNames[action.cargo]}</strong>
              <Money amount={Math.max(5, game.market[action.cargo])} />
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
                data-mn-primary-control
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
                  data-mn-primary-control
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
                data-mn-primary-control
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
                data-mn-primary-control
                data-manila-action={action.type}
                title={actionLabel(action, game)}
                aria-label={actionLabel(action, game)}
                disabled={locked}
                onClick={() => choose(action)}
              >
                {directLabel(action)}
              </button>
            ))}
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
              data-mn-primary-control
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
              data-mn-primary-control
              data-manila-action={action.type}
              title={actionLabel(action, game)}
              aria-label={actionLabel(action, game)}
              disabled={locked}
              onClick={() => choose(action)}
            >
              <span className="mn-action-label">{directLabel(action)}</span>
            </button>
          ))}
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
                data-mn-primary-control
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
                data-mn-primary-control
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
