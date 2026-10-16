import { useState } from 'react';
import type { Action, CargoId, ManilaView } from '../rules/view';
import { actionLabel, cargoColors, cargoNames, spaceName } from './labels';
import { cargoStyle } from './pieces';

type Props = {
  game: ManilaView;
  actions: Action[];
  locked: boolean;
  draft: Action | null;
  select(action: Action | null): void;
  choose(action: Action): void;
};
type SetupAction = Extract<Action, { type: 'setup' }>;

function Finance({
  game,
  actions,
  locked,
  choose,
}: Pick<Props, 'game' | 'actions' | 'locked' | 'choose'>) {
  const finance = actions.filter(
    (action) => action.type === 'mortgage' || action.type === 'repay',
  );
  if (!finance.length) return null;
  return (
    <details
      className="mn-finance"
      open={game.phase === 'financing' ? true : undefined}
    >
      <summary>股份抵押与赎回</summary>
      <p>抵押取得 12 ₱；赎回支付 15 ₱ 并公开该股份。抵押股份终局扣除 15 ₱。</p>
      <div className="mn-inline-actions">
        {finance.map((action, index) => (
          <button
            key={index}
            data-manila-action={action.type}
            disabled={locked}
            onClick={() => choose(action)}
          >
            {actionLabel(action, game)} ·{' '}
            {action.type === 'mortgage' ? '+12 ₱' : '−15 ₱'}
            {'shareId' in action && (
              <span>
                {game.self?.shares.find((share) => share.id === action.shareId)
                  ?.revealed
                  ? '（已公开股份）'
                  : '（未公开股份）'}
              </span>
            )}
          </button>
        ))}
      </div>
    </details>
  );
}

function Setup({
  game,
  actions,
  locked,
  choose,
}: Pick<Props, 'game' | 'actions' | 'locked' | 'choose'>) {
  const setups = actions.filter(
    (action): action is SetupAction => action.type === 'setup',
  );
  const [cargos, setCargos] = useState<CargoId[]>(
    setups[0]?.cargos ?? game.cargos.slice(0, 3).map((cargo) => cargo.id),
  );
  const [positions, setPositions] = useState<number[]>([3, 3, 3]);
  const [step, setStep] = useState(1);
  const selected = setups.find(
    (action) =>
      action.cargos.every((cargo, index) => cargo === cargos[index]) &&
      action.positions.every(
        (position, index) => position === positions[index],
      ),
  );
  const total = positions.reduce((sum, value) => sum + value, 0);
  return (
    <section className="mn-panel mn-controls">
      <div className="mn-controls-heading">
        <h2>{step === 1 ? '1 · 选择三船货物' : '2 · 分配起航位置'}</h2>
        <span>港务长装船</span>
      </div>
      <div className="mn-draft-grid">
        {cargos.map((cargo, index) => (
          <div
            className="mn-draft-card"
            key={index}
            style={cargoStyle(cargoColors[cargo])}
          >
            <strong className="mn-cargo">第 {index + 1} 航道</strong>
            {step === 1 ? (
              <label>
                货物
                <select
                  value={cargo}
                  disabled={locked}
                  onChange={(event) => {
                    const next = event.target.value as CargoId;
                    setCargos((previous) =>
                      previous.map((entry, at) =>
                        at === index ? next : entry === next ? cargo : entry,
                      ),
                    );
                  }}
                >
                  {game.cargos.map((entry) => (
                    <option value={entry.id} key={entry.id}>
                      {cargoNames[entry.id]} · 分红 {entry.payout}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <strong>{cargoNames[cargo]}</strong>
                <label>
                  起点
                  <select
                    value={positions[index]}
                    disabled={locked}
                    onChange={(event) =>
                      setPositions((previous) =>
                        previous.map((entry, at) =>
                          at === index ? Number(event.target.value) : entry,
                        ),
                      )
                    }
                  >
                    {[0, 1, 2, 3, 4, 5].map((value) => (
                      <option value={value} key={value}>
                        {value} 格
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>
        ))}
      </div>
      <div className="mn-confirm">
        <div>
          <strong>
            {step === 1
              ? `不装载${cargoNames[game.cargos.find((cargo) => !cargos.includes(cargo.id))!.id]}`
              : `起点合计 ${total} / 9`}
          </strong>
          <p>
            {step === 1
              ? '每种货物只能装一船。'
              : '每船 0–5 格，三船合计必须为 9。'}
          </p>
        </div>
        <div className="mn-confirm-actions">
          {step === 2 && (
            <button disabled={locked} onClick={() => setStep(1)}>
              返回选货
            </button>
          )}
          {step === 1 ? (
            <button
              className="mn-primary"
              disabled={locked}
              onClick={() => setStep(2)}
            >
              下一步 · 设起点
            </button>
          ) : (
            <button
              className="mn-primary"
              data-manila-action="setup"
              disabled={locked || !selected}
              onClick={() => selected && choose(selected)}
            >
              确认起航
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Pilot({
  game,
  actions,
  locked,
  choose,
}: Pick<Props, 'game' | 'actions' | 'locked' | 'choose'>) {
  const [deltas, setDeltas] = useState<Record<string, number>>({});
  const pilots = actions.filter(
    (action): action is Extract<Action, { type: 'pilot' }> =>
      action.type === 'pilot',
  );
  const allowed = game.phase === 'pilot-small' ? [-1, 0, 1] : [-2, -1, 0, 1, 2];
  const selected = pilots.find((action) =>
    game.boats.every(
      (boat) =>
        (action.moves.find((move) => move.cargo === boat.cargo)?.delta ?? 0) ===
        (deltas[boat.cargo] ?? 0),
    ),
  );
  return (
    <section className="mn-panel mn-controls">
      <h2>
        {game.phase === 'pilot-small'
          ? '小领航员 · 调整一格'
          : '大领航员 · 调整最多两格'}
      </h2>
      <div className="mn-draft-grid">
        {game.boats
          .filter((boat) => boat.destination === 'sea')
          .map((boat) => (
            <label className="mn-draft-card" key={boat.cargo}>
              <strong
                className="mn-cargo"
                style={cargoStyle(cargoColors[boat.cargo])}
              >
                {cargoNames[boat.cargo]} · {boat.position}格
              </strong>
              <select
                aria-label={`${cargoNames[boat.cargo]}移动`}
                disabled={locked}
                value={deltas[boat.cargo] ?? 0}
                onChange={(event) =>
                  setDeltas((previous) => ({
                    ...previous,
                    [boat.cargo]: Number(event.target.value),
                  }))
                }
              >
                {allowed
                  .filter((delta) => boat.position + delta >= 0)
                  .map((delta) => (
                    <option key={delta} value={delta}>
                      {delta === 0
                        ? '不移动'
                        : `${delta > 0 ? '前进' : '后退'} ${Math.abs(delta)} 格`}
                    </option>
                  ))}
              </select>
            </label>
          ))}
      </div>
      <div className="mn-confirm">
        <div>
          <strong>
            {selected ? actionLabel(selected, game) : '超出本次领航额度'}
          </strong>
          <p>调整是草稿，确认后才移动货船。</p>
        </div>
        <button
          className="mn-primary"
          data-manila-action="pilot"
          disabled={locked || !selected}
          onClick={() => selected && choose(selected)}
        >
          确认领航
        </button>
      </div>
    </section>
  );
}

export function PlayerControls({
  game,
  actions,
  locked,
  draft,
  select,
  choose,
}: Props) {
  const bids = actions.filter(
    (action): action is Extract<Action, { type: 'bid' }> =>
      action.type === 'bid',
  );
  const [bid, setBid] = useState(bids[0]?.amount ?? game.auction.bid + 1);
  if (actions.some((action) => action.type === 'setup'))
    return (
      <div className="mn-controls">
        <Setup game={game} actions={actions} locked={locked} choose={choose} />
        <Finance
          game={game}
          actions={actions}
          locked={locked}
          choose={choose}
        />
      </div>
    );
  if (actions.some((action) => action.type === 'pilot'))
    return (
      <div className="mn-controls">
        <Pilot game={game} actions={actions} locked={locked} choose={choose} />
        <Finance
          game={game}
          actions={actions}
          locked={locked}
          choose={choose}
        />
      </div>
    );
  const ordinary = actions.filter(
    (action) =>
      action.type !== 'mortgage' &&
      action.type !== 'repay' &&
      action.type !== 'bid',
  );
  const place = ordinary.filter(
    (action): action is Extract<Action, { type: 'place' }> =>
      action.type === 'place',
  );
  const other = ordinary.filter((action) => action.type !== 'place');
  const chosenSpace =
    draft?.type === 'place'
      ? game.spaces.find((entry) => entry.id === draft.space)
      : undefined;
  const payment = (cost: number) => {
    const funds = (game.self?.cash ?? 0) + (game.self?.availableCredit ?? 0);
    if (cost === 0) return '免费派遣';
    if (cost > funds) return `盲乘 · 付尽 ${funds} ₱`;
    return `支付 ${cost} ₱${cost > (game.self?.cash ?? 0) ? ' · 随后选择抵押股份' : ''}`;
  };
  return (
    <section className="mn-panel mn-controls" aria-label="本人行动">
      <div className="mn-controls-heading">
        <h2>
          {actions.length
            ? game.phase === 'financing'
              ? '选择股份抵押付款'
              : game.phase === 'auction'
                ? '竞拍港务长'
                : game.phase === 'place'
                  ? '把伙伴派到哪里？'
                  : game.phase === 'share'
                    ? '购买一张股份'
                    : '选择本次行动'
            : '等待其他商人'}
        </h2>
        {game.self && <span>可用 {game.self.cash} ₱</span>}
      </div>
      {game.phase === 'financing' && game.payment && (
        <div className="mn-financing-notice">
          <strong>待支付 {game.payment.amount} ₱</strong>
          <p>
            {game.payment.reason === 'insurance'
              ? '保险行赔付'
              : game.payment.reason === 'auction'
                ? '港务长竞拍款'
                : game.payment.reason === 'share'
                  ? '购买股份'
                  : '伙伴派遣费用'}
            ：现金 {game.self?.cash ?? 0} ₱，还差{' '}
            {Math.max(0, game.payment.amount - (game.self?.cash ?? 0))}{' '}
            ₱。请选择一张未抵押股份，每张取得 12 ₱；资金足够后自动继续。
          </p>
        </div>
      )}
      {bids.length > 0 && (
        <>
          <p>
            最高出价 <strong>{game.auction.bid} ₱</strong>
            。获胜者支付出价，主持本次航行。
          </p>
          <div className="mn-inline-actions">
            <label htmlFor="mn-bid-amount">出价</label>
            <input
              id="mn-bid-amount"
              type="number"
              inputMode="numeric"
              min={bids[0]!.amount}
              max={bids.at(-1)!.amount}
              step="1"
              value={bid}
              disabled={locked}
              onChange={(event) => setBid(Number(event.target.value))}
            />
            <button
              className="mn-primary"
              data-manila-action="bid"
              disabled={locked || !bids.some((action) => action.amount === bid)}
              onClick={() => {
                const action = bids.find((entry) => entry.amount === bid);
                if (action) choose(action);
              }}
            >
              出价 {bid} ₱
            </button>
          </div>
        </>
      )}
      {place.length > 0 && (
        <>
          <p>选择岗位，确认派遣。</p>
          <div className="mn-action-grid">
            {place.map((action) => {
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
                  <strong>{spaceName(space)}</strong>
                  <span>
                    {payment(space.cost)}
                    {space.payout !== null
                      ? space.kind === 'cargo'
                        ? ` · 分红池 ${space.payout} ₱ 均分`
                        : space.kind === 'insurance'
                          ? ' · 立即领 10 ₱，承担修船赔付'
                          : ` · 成功获 ${space.payout} ₱`
                      : ''}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
      <div className="mn-inline-actions">
        {other.map((action, index) => {
          const direct = ['pass', 'skip-share', 'next-voyage'].includes(
            action.type,
          );
          return (
            <button
              key={index}
              className={action.type === 'next-voyage' ? 'mn-primary' : ''}
              data-manila-action={direct ? action.type : undefined}
              aria-pressed={
                direct
                  ? undefined
                  : JSON.stringify(draft) === JSON.stringify(action)
              }
              disabled={locked}
              onClick={() => (direct ? choose(action) : select(action))}
            >
              {actionLabel(action, game)}
              {action.type === 'buy-share'
                ? ` · ${Math.max(5, game.market[action.cargo])} ₱`
                : ''}
            </button>
          );
        })}
      </div>
      <Finance game={game} actions={actions} locked={locked} choose={choose} />
      {draft && (
        <div className="mn-confirm">
          <div>
            <strong>{actionLabel(draft, game)}</strong>
            {chosenSpace && <p>{payment(chosenSpace.cost)}，派遣一名伙伴。</p>}
            {draft.type === 'buy-share' && (
              <p>
                支付 {Math.max(5, game.market[draft.cargo])}{' '}
                ₱；股份种类仅你可见。
              </p>
            )}
          </div>
          <div className="mn-confirm-actions">
            <button disabled={locked} onClick={() => select(null)}>
              取消
            </button>
            <button
              className="mn-primary"
              data-manila-action={draft.type}
              disabled={locked}
              onClick={() => choose(draft)}
            >
              确认
              {draft.type === 'place'
                ? '派遣'
                : draft.type === 'buy-share'
                  ? '购买'
                  : '行动'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
