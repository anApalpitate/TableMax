import type {
  Action,
  CargoId,
  ManilaView,
  Phase,
  SpaceView,
} from '../rules/view';

export const cargoNames: Record<CargoId, string> = {
  nutmeg: '肉豆蔻',
  silk: '丝绸',
  ginseng: '人参',
  jade: '翡翠',
};
export const cargoColors: Record<CargoId, string> = {
  nutmeg: '#9c552e',
  silk: '#85579c',
  ginseng: '#ab7721',
  jade: '#277d61',
};
export const seatColors = [
  '#276b89',
  '#a64138',
  '#687b32',
  '#815a9e',
  '#a97522',
];
export const phaseNames: Record<Phase, string> = {
  auction: '竞拍港务长',
  share: '购买股份',
  setup: '装货与起航',
  place: '派遣伙伴',
  board: '海盗登船',
  'pilot-small': '小领航员',
  'pilot-large': '大领航员',
  plunder: '海盗掠夺',
  financing: '选择抵押股份',
  'round-result': '航次结算',
  ended: '最终财富',
};
export function spaceName(space: SpaceView): string {
  const number = space.index + 1;
  if (space.kind === 'cargo')
    return `${cargoNames[space.cargo!]}船${number}号位`;
  if (space.kind === 'port') return `港口 ${'ABC'[space.index] ?? number}`;
  if (space.kind === 'shipyard')
    return `修船坞 ${'ABC'[space.index] ?? number}`;
  if (space.kind === 'pirate')
    return space.index === 0 ? '海盗船长' : '海盗船员';
  if (space.kind === 'pilot')
    return space.index === 0 ? '小领航员' : '大领航员';
  return '保险行';
}
export function actionLabel(action: Action, game: ManilaView): string {
  switch (action.type) {
    case 'bid':
      return `出价 ${action.amount} 比索`;
    case 'pass':
      return game.phase === 'auction' ? '退出本次竞拍' : '放弃本航次余下派遣';
    case 'buy-share':
      return `购买${cargoNames[action.cargo]}股份`;
    case 'skip-share':
      return '不购买股份';
    case 'setup':
      return '确认装货与起点';
    case 'place': {
      const space = game.spaces.find((entry) => entry.id === action.space);
      return space ? `派遣到${spaceName(space)}` : '派遣伙伴';
    }
    case 'board':
      return action.cargo ? `登上${cargoNames[action.cargo]}船` : '留在海盗船';
    case 'pilot':
      return action.moves.length
        ? action.moves
            .map(
              (move) =>
                `${cargoNames[move.cargo]}${move.delta > 0 ? '前进' : '后退'}${Math.abs(move.delta)}格`,
            )
            .join('，')
        : '不移动货船';
    case 'plunder':
      return `掠夺${cargoNames[action.cargo]}，送往${action.destination === 'port' ? '港口' : '修船坞'}`;
    case 'mortgage':
      return `抵押${cargoNames[game.self?.shares.find((share) => share.id === action.shareId)?.cargo ?? 'jade']}股份`;
    case 'repay':
      return `赎回${cargoNames[game.self?.shares.find((share) => share.id === action.shareId)?.cargo ?? 'jade']}股份`;
    case 'next-voyage':
      return '开始下一航次';
  }
}
