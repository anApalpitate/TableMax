import type { RuleContext } from '@tablemax/game-sdk';
import type { Action, Alignment, Variant } from '../types';
import { alignment, nextSeat, roleDeck, type State } from './state';
export function initialize(
  context: RuleContext,
  variant: Variant = 'classic',
): State {
  const seats = [...context.seats];
  if (
    seats.length < 5 ||
    seats.length > 6 ||
    new Set(seats).size !== seats.length
  )
    throw new Error('阿瓦隆需要 5–6 位玩家。');
  const deck = roleDeck(seats.length, variant);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(context.random.next() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const leader = seats[Math.floor(context.random.next() * seats.length)]!;
  return {
    variant,
    phase: 'reveal',
    seats,
    initialLeader: leader,
    leader,
    roles: Object.fromEntries(seats.map((seat, i) => [seat, deck[i]!])),
    acknowledged: [],
    questNumber: 1,
    proposalNumber: 1,
    rejectedTeams: 0,
    team: [],
    votes: {},
    questCards: {},
    history: [],
    quests: [],
    assassinationTarget: null,
    winner: null,
    winReason: null,
    actionSerial: 0,
    latest: null,
  };
}
export function applyAction(
  before: State,
  action: Action,
  seat: string,
): State {
  const s = structuredClone(before);
  s.actionSerial++;
  const number = (id: string) => `座位 ${s.seats.indexOf(id) + 1}`;
  const event = (verb: string, text: string, targets: string[] = []) => {
    s.latest = { serial: s.actionSerial, actor: seat, verb, text, targets };
  };
  const end = (winner: Alignment, reason: State['winReason']) => {
    s.phase = 'ended';
    s.winner = winner;
    s.winReason = reason;
  };
  if (action.type === 'acknowledge') {
    s.acknowledged = s.seats.filter(
      (id) => id === seat || s.acknowledged.includes(id),
    );
    if (s.acknowledged.length === s.seats.length) s.phase = 'team';
    event(
      'acknowledge',
      `${number(seat)}已确认身份；${s.phase === 'team' ? '圆桌议事开始。' : '等待其余玩家确认。'}`,
    );
  } else if (action.type === 'propose-team') {
    s.team = s.seats.filter((id) => action.team.includes(id));
    s.phase = 'vote';
    event(
      'propose-team',
      `${number(seat)}提名第 ${s.questNumber} 次任务队伍：${s.team.map(number).join('、')}。`,
      s.team,
    );
  } else if (action.type === 'vote-team') {
    s.votes[seat] = action.vote;
    if (Object.keys(s.votes).length < s.seats.length)
      event('vote-submitted', `${number(seat)}已密封队伍投票。`);
    else {
      const votes = Object.fromEntries(s.seats.map((id) => [id, s.votes[id]!]));
      const approvalCount = Object.values(votes).filter(
        (vote) => vote === 'approve',
      ).length;
      const approved = approvalCount > s.seats.length / 2;
      s.history.push({
        questNumber: s.questNumber,
        proposalNumber: s.proposalNumber,
        leader: s.leader,
        team: [...s.team],
        votes,
        approved,
      });
      s.votes = {};
      if (approved) {
        s.phase = 'quest';
        event(
          'team-approved',
          `第 ${s.questNumber} 次任务队伍通过：${approvalCount} 票赞成、${s.seats.length - approvalCount} 票反对。`,
          s.team,
        );
      } else {
        s.rejectedTeams++;
        if (s.rejectedTeams === 5) {
          end('evil', 'five-rejections');
          event('game-ended', '连续五次组队被否决，莫德雷德阵营获胜。', s.team);
        } else {
          s.leader = nextSeat(s, s.leader);
          s.proposalNumber++;
          s.team = [];
          s.phase = 'team';
          event(
            'team-rejected',
            `队伍未通过：${approvalCount} 票赞成、${s.seats.length - approvalCount} 票反对；${number(s.leader)}接任队长。`,
          );
        }
      }
    }
  } else if (action.type === 'quest-card') {
    s.questCards[seat] = action.card;
    if (Object.keys(s.questCards).length < s.team.length)
      event('quest-submitted', `${number(seat)}已密封任务牌。`);
    else {
      const failCount = Object.values(s.questCards).filter(
        (card) => card === 'fail',
      ).length;
      const succeeded = failCount === 0;
      s.quests.push({
        questNumber: s.questNumber,
        proposalNumber: s.proposalNumber,
        leader: s.leader,
        team: [...s.team],
        failCount,
        succeeded,
      });
      s.questCards = {};
      s.rejectedTeams = 0;
      const successes = s.quests.filter((q) => q.succeeded).length,
        failures = s.quests.length - successes;
      if (failures === 3) end('evil', 'three-failures');
      else if (successes === 3) s.phase = 'assassinate';
      else {
        s.questNumber++;
        s.proposalNumber++;
        s.leader = nextSeat(s, s.leader);
        s.rejectedTeams = 0;
        s.team = [];
        s.phase = 'team';
      }
      event(
        succeeded ? 'quest-success' : 'quest-fail',
        `第 ${before.questNumber} 次任务${succeeded ? '成功' : '失败'}：${failCount} 张失败牌。${failures === 3 ? '莫德雷德阵营获胜。' : successes === 3 ? '刺客获得最后一次寻找梅林的机会。' : ''}`,
        before.team,
      );
    }
  } else if (action.type === 'assassinate') {
    s.assassinationTarget = action.target;
    const hit = s.roles[action.target] === 'merlin';
    end(hit ? 'evil' : 'good', hit ? 'merlin-assassinated' : 'merlin-survived');
    event(
      'assassination',
      `${number(seat)}将匕首指向${number(action.target)}。${hit ? '梅林被刺杀，莫德雷德阵营获胜。' : '梅林幸存，亚瑟阵营获胜。'}`,
      [action.target],
    );
  }
  return s;
}
export const assassinSeat = (s: State) =>
  s.seats.find((seat) => s.roles[seat] === 'assassin')!;
export const goodSeats = (s: State) =>
  s.seats.filter((seat) => alignment(s.roles[seat]!) === 'good');
