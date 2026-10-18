import { useState } from 'react';
import { avatarFor, type GameHost } from '@tablemax/web-host';
import type { ManilaView } from '../rules/view';
import { CopperMark } from './Theme';

const incomeNames = {
  cargo: '货船分红',
  piracy: '海盗分红',
  port: '港口收入',
  shipyard: '修船坞收入',
  insurance: '保险入场收入',
};
const expenseNames = {
  auction: '竞拍支出',
  shares: '购股支出',
  placement: '派遣支出',
  insurance: '保险实付',
};
const signed = (amount: number) =>
  `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${Math.abs(amount)} ₱`;
const sum = (values: Record<string, number>) =>
  Object.values(values).reduce((a, b) => a + b, 0);

export function VoyageResultCard({
  game,
  seats,
}: {
  game: ManilaView;
  seats: Pick<
    NonNullable<GameHost['view']>['seats'][number],
    'id' | 'name' | 'avatarId'
  >[];
}) {
  const [open, setOpen] = useState(true);
  const result = game.result;
  if (!result) return null;
  const order = game.self
    ? [
        game.self.seatId,
        ...game.seatOrder.filter((id) => id !== game.self!.seatId),
      ]
    : game.seatOrder;
  return (
    <section
      className="mn-voyage-result"
      aria-label={`第${result.voyage}航次收支结算`}
    >
      <button
        type="button"
        className="mn-result-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <CopperMark kind="receipt" />
        <strong>第 {result.voyage} 航次收支</strong>
        <span>{open ? '收起' : '展开'}</span>
      </button>
      {open && (
        <div className="mn-result-body">
          {!result.finance && (
            <p className="mn-result-legacy">
              仅有结算变动，未记录本航次完整收支。
            </p>
          )}
          {order.map((id) => {
            const seat = seats.find((entry) => entry.id === id);
            const finance = result.finance?.players[id];
            const net = finance
              ? finance.closingCash - finance.openingCash
              : result.income[id]!;
            return (
              <details
                className="mn-result-merchant"
                key={id}
                data-seat-id={id}
              >
                <summary>
                  <span className="mn-result-person">
                    <img src={avatarFor(seat?.avatarId ?? 'avatar-1')} alt="" />
                    <strong>
                      {seat?.name ?? '商人'}
                      {game.self?.seatId === id && <small>你</small>}
                    </strong>
                    <span aria-hidden="true">⌄</span>
                  </span>
                  {finance && (
                    <>
                      <span className="mn-result-amount">
                        <span>收入</span>
                        <b>{sum(finance.income)} ₱</b>
                      </span>
                      <span className="mn-result-amount">
                        <span>支出</span>
                        <b>{sum(finance.expenses)} ₱</b>
                      </span>
                    </>
                  )}
                  <span
                    className="mn-result-amount mn-result-net"
                    data-mn-net={net}
                  >
                    <span>{finance ? '现金净变化' : '结算变动'}</span>
                    <b>{signed(net)}</b>
                  </span>
                </summary>
                {finance ? (
                  <dl className="mn-result-breakdown">
                    <div>
                      <dt>期初现金</dt>
                      <dd>{finance.openingCash} ₱</dd>
                    </div>
                    {Object.entries(incomeNames).map(([key, name]) => (
                      <div key={key}>
                        <dt>{name}</dt>
                        <dd>
                          {finance.income[key as keyof typeof incomeNames]} ₱
                        </dd>
                      </div>
                    ))}
                    {Object.entries(expenseNames).map(([key, name]) => (
                      <div key={key}>
                        <dt>{name}</dt>
                        <dd>
                          {finance.expenses[key as keyof typeof expenseNames]} ₱
                        </dd>
                      </div>
                    ))}
                    <div>
                      <dt>抵押借入</dt>
                      <dd>{finance.borrowed} ₱</dd>
                    </div>
                    <div>
                      <dt>赎回支出</dt>
                      <dd>{finance.redeemed} ₱</dd>
                    </div>
                    <div>
                      <dt>期末现金</dt>
                      <dd>{finance.closingCash} ₱</dd>
                    </div>
                  </dl>
                ) : (
                  <p>旧记录不补算收入、支出及全航次现金净变化。</p>
                )}
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
