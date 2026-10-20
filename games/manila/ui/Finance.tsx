import type { Action, ManilaView } from '../rules/view';
import { actionLabel, cargoNames } from './labels';
import { CargoArt } from './pieces';

type FinanceProps = {
  game: ManilaView;
  actions: Action[];
  locked: boolean;
  choose(action: Action): void;
};
export function Finance({ game, actions, locked, choose }: FinanceProps) {
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
            data-mn-primary-control={action ? '' : undefined}
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
            <span className="mn-money">
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
