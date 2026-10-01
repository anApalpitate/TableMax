// Synthetic UI state only: no game state, checkpoints, identities or secrets.
export type Role = 'host' | 'public' | 'player';
export type Screen =
  'setup' | 'lobby' | 'session' | 'result' | 'recovery' | 'error';
export type Connection = 'online' | 'offline' | 'syncing';
export type Submission =
  'idle' | 'pending' | 'saved' | 'rejected' | 'uncertain';
export type Issue = 'network' | 'port' | 'incompatible' | 'corrupt';
export interface Seat {
  id: string;
  nickname: string;
  ready: boolean;
  control?: 'human' | 'bot';
}
export interface PrototypeState {
  role: Role;
  screen: Screen;
  connection: Connection;
  submission: Submission;
  paused: boolean;
  joiningOpen: boolean;
  seats: Seat[];
  joinedSeat: string | null;
  selected: string | null;
  revision: number;
  branch: number;
  request: { id: number; branch: number } | null;
  nextRequest: number;
  bindingGeneration: number;
  notice: string;
  issue: Issue;
}
export const initialState: PrototypeState = {
  role: 'host',
  screen: 'setup',
  connection: 'online',
  submission: 'idle',
  paused: false,
  joiningOpen: true,
  seats: [
    { id: 'S1', nickname: '小林', ready: true },
    { id: 'S2', nickname: '阿晨', ready: false },
  ],
  joinedSeat: null,
  selected: null,
  revision: 7,
  branch: 1,
  request: null,
  nextRequest: 1,
  bindingGeneration: 1,
  notice: '',
  issue: 'network',
};
export type Event =
  | { type: 'reset' }
  | { type: 'role'; role: Role }
  | { type: 'screen'; screen: Screen }
  | { type: 'join'; nickname: string }
  | { type: 'ready' }
  | { type: 'toggle-joining' }
  | { type: 'all-ready' }
  | { type: 'add-bot' }
  | { type: 'remove-bot' }
  | { type: 'move-seat'; id: string }
  | { type: 'pause' }
  | { type: 'select'; value: string }
  | { type: 'submit' }
  | { type: 'reply'; outcome: 'saved' | 'rejected' | 'uncertain' }
  | { type: 'connection'; connection: Connection }
  | { type: 'synchronize' }
  | { type: 'rollback'; label: string }
  | { type: 'late-reply' }
  | { type: 'rebind'; id: string }
  | { type: 'restore' }
  | { type: 'issue'; issue: Issue };

export function reduce(state: PrototypeState, event: Event): PrototypeState {
  switch (event.type) {
    case 'reset':
      return initialState;
    case 'role':
      return { ...state, role: event.role, selected: null, notice: '' };
    case 'screen':
      return {
        ...state,
        screen: event.screen,
        selected: null,
        submission: 'idle',
        request: null,
        notice: '',
      };
    case 'join': {
      const nickname = event.nickname.trim();
      if (!nickname || !state.joiningOpen || state.joinedSeat) return state;
      if (state.seats.length >= 5)
        return { ...state, notice: '房间已满；真人加电脑最多五位（模拟）。' };
      const duplicate = state.seats.some((seat) => seat.nickname === nickname);
      const id = `S${Math.max(...state.seats.map((seat) => Number(seat.id.slice(1)))) + 1}`;
      return {
        ...state,
        joinedSeat: id,
        seats: [...state.seats, { id, nickname, ready: false }],
        notice: duplicate
          ? `已有同名玩家，请用座位 ${id} 区分。`
          : `已取得座位 ${id}（模拟）。`,
      };
    }
    case 'ready':
      return {
        ...state,
        seats: state.seats.map((seat) =>
          seat.id === state.joinedSeat ? { ...seat, ready: !seat.ready } : seat,
        ),
      };
    case 'toggle-joining':
      return { ...state, joiningOpen: !state.joiningOpen };
    case 'add-bot': {
      if (state.screen !== 'lobby' || state.seats.length >= 5)
        return {
          ...state,
          notice: '电脑仅可在开局前添加，真人加电脑最多五位。',
        };
      const id = `S${Math.max(...state.seats.map((seat) => Number(seat.id.slice(1)))) + 1}`;
      return {
        ...state,
        seats: [
          ...state.seats,
          { id, nickname: `电脑 ${id}`, ready: true, control: 'bot' },
        ],
        notice: '电脑已准备；初始翻牌仍由策略合法完成（模拟）。',
      };
    }
    case 'remove-bot': {
      if (state.screen !== 'lobby') return state;
      const last = [...state.seats]
        .reverse()
        .find((seat) => seat.control === 'bot');
      return last
        ? {
            ...state,
            seats: state.seats.filter((seat) => seat.id !== last.id),
            notice: '电脑座位已移除（模拟）。',
          }
        : state;
    }
    case 'move-seat': {
      const index = state.seats.findIndex((seat) => seat.id === event.id);
      if (state.screen !== 'lobby' || index <= 0) return state;
      const seats = [...state.seats];
      [seats[index - 1], seats[index]] = [seats[index]!, seats[index - 1]!];
      return {
        ...state,
        seats,
        notice: '开局前顺序已调整；座位身份保持不变（模拟）。',
      };
    }
    case 'all-ready':
      return state.screen === 'lobby'
        ? {
            ...state,
            seats: state.seats.map((seat) => ({ ...seat, ready: true })),
            notice: '模拟其他玩家已在各自手机完成准备。',
          }
        : state;
    case 'pause':
      return {
        ...state,
        paused: !state.paused,
        selected: null,
        notice: state.paused ? '房主已恢复（模拟）。' : '房主已暂停（模拟）。',
      };
    case 'select':
      return state.connection === 'online' &&
        !state.paused &&
        !['pending', 'uncertain'].includes(state.submission)
        ? {
            ...state,
            selected: event.value,
            submission: 'idle',
            request: null,
            notice: '',
          }
        : state;
    case 'submit':
      if (
        !state.selected ||
        state.connection !== 'online' ||
        state.paused ||
        ['pending', 'uncertain'].includes(state.submission)
      )
        return state;
      return {
        ...state,
        submission: 'pending',
        request: { id: state.nextRequest, branch: state.branch },
        nextRequest: state.nextRequest + 1,
        notice: '正在提交，等待保存确认。',
      };
    case 'reply':
      if (
        state.submission !== 'pending' ||
        !state.request ||
        state.request.branch !== state.branch
      )
        return state;
      return {
        ...state,
        submission: event.outcome,
        selected: event.outcome === 'saved' ? null : state.selected,
        revision: state.revision + (event.outcome === 'saved' ? 1 : 0),
        notice:
          event.outcome === 'saved'
            ? '已保存并确认（模拟）。'
            : event.outcome === 'rejected'
              ? '操作被拒绝，请根据最新状态重新选择。'
              : '确认未收到，操作结果未知；同步前请勿发起新操作。',
      };
    case 'connection':
      return {
        ...state,
        connection: event.connection,
        selected: null,
        submission:
          state.submission === 'pending' ? 'uncertain' : state.submission,
        notice:
          event.connection === 'offline'
            ? '连接中断，座位保留；不会自动代操作。'
            : '正在同步最新授权视图。',
      };
    case 'synchronize':
      return {
        ...state,
        connection: 'online',
        submission: 'idle',
        selected: null,
        request: null,
        notice:
          '已同步最新状态；旧选择已清空（模拟，不判断未确认动作实际结果）。',
      };
    case 'rollback':
      return {
        ...state,
        screen: 'session',
        selected: null,
        submission: 'idle',
        request: null,
        revision: state.revision + 1,
        branch: state.branch + 1,
        notice: `已恢复到${event.label}；旧选择与提交状态已清空（模拟）。`,
      };
    case 'late-reply':
      return {
        ...state,
        notice: '旧分支动作已失效，请使用当前状态重新选择（模拟）。',
      };
    case 'rebind':
      return {
        ...state,
        bindingGeneration: state.bindingGeneration + 1,
        notice: `座位 ${event.id} 已重新绑定，原凭证失效（模拟，未创建真实凭证）。`,
      };
    case 'restore':
      return {
        ...state,
        screen: 'session',
        connection: 'syncing',
        selected: null,
        request: null,
        submission: 'idle',
        notice: '存档已读取，等待玩家重连；请同步最新状态（模拟）。',
      };
    case 'issue':
      return { ...state, screen: 'error', issue: event.issue, selected: null };
  }
}
