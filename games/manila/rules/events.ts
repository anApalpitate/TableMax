import type { PublicEvent } from '@tablemax/game-sdk';
import { presentationChanges } from '../shared/presentation';
import { project } from './project';
import type { State } from './state';
import type { Action } from './view';

const labels: Record<string, string> = {
  auction: '港务长竞拍成交',
  setup: '三船装载完成，准备启航',
  place: '伙伴已派遣',
  sail: '骰子落定，货船航行',
  arrive: '货船成功靠港',
  repair: '货船进入修船坞',
  board: '海盗登上货船',
  pilot: '领航调整完成',
  plunder: '海盗掠夺货船',
  'insurance-income': '保险行收入10比索',
  'insurance-pay': '保险行完成本航次赔付',
  result: '本航次收益已结算',
  ended: '最终财富已结算',
  market: '靠港货物行情上涨',
  bid: '港务长报价已保存',
  trade: '股份交易已保存',
  voyage: '新航次开始',
};

export function publicEvents(
  before: State,
  after: State,
  action: Action,
): PublicEvent[] {
  const kinds = new Set(
    presentationChanges(
      project(before, { role: 'public' }),
      project(after, { role: 'public' }),
    ).map((value) => value.split(':')[1]!),
  );
  // Even an otherwise invisible loan/repayment gets a neutral public receipt.
  if (
    action.type === 'mortgage' ||
    action.type === 'repay' ||
    action.type === 'buy-share'
  )
    kinds.add('trade');
  // The wire permits eight events. Merge secondary bookkeeping into the result
  // receipt, while keeping every simultaneous board outcome distinguishable.
  if (kinds.has('result')) {
    kinds.delete('market');
    kinds.delete('trade');
    kinds.delete('insurance-pay');
  }
  const events = [...kinds].map((kind) => ({
    kind:
      kind === 'ended'
        ? 'game-ended'
        : kind === 'result'
          ? 'voyage-result'
          : kind === 'sail'
            ? 'sailing'
            : `manila-${kind}`,
    text: labels[kind] ?? '港湾行动已保存',
  }));
  return events.length
    ? events
    : [{ kind: 'manila-action', text: after.latest }];
}
