import { useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';

export function RollbackHistory({ session }: { session: RoomSession }) {
  const { view, command, locked } = session;
  const [round, setRound] = useState('all');
  const [player, setPlayer] = useState('all');
  const [limit, setLimit] = useState(20);
  if (!view) return null;
  const rounds = [
    ...new Set(
      view.history.flatMap((h) =>
        h.roundNumber === null ? [] : [h.roundNumber],
      ),
    ),
  ].sort((a, b) => b - a);
  const history = view.history
    .filter(
      (h) =>
        (round === 'all' || String(h.roundNumber) === round) &&
        (player === 'all' || (h.seatId ?? 'host') === player),
    )
    .slice()
    .reverse();
  const describe = (h: (typeof view.history)[number]) =>
    `${h.roundNumber ? `第 ${h.roundNumber} 小局 · ` : ''}第 ${h.step} 步 · ${h.seatId ? (view.seats.find((s) => s.id === h.seatId)?.name ?? '玩家') : '管理／历史步骤'} · ${h.label}`;
  return (
    <details className="rollback-history">
      <summary>决策点回退（{view.history.length}）</summary>
      <p>恢复到该选择之前。已看见的信息无法撤销；回退后保持暂停。</p>
      <label>
        小局
        <select
          aria-label="筛选回退小局"
          value={round}
          onChange={(event) => {
            setRound(event.target.value);
            setLimit(20);
          }}
        >
          <option value="all">全部小局</option>
          {rounds.map((number) => (
            <option key={number} value={number}>
              第 {number} 小局
            </option>
          ))}
        </select>
      </label>
      <label>
        玩家
        <select
          aria-label="筛选回退玩家"
          value={player}
          onChange={(event) => {
            setPlayer(event.target.value);
            setLimit(20);
          }}
        >
          <option value="all">全部玩家和管理</option>
          <option value="host">管理／历史步骤</option>
          {view.seats.map((seat) => (
            <option key={seat.id} value={seat.id}>
              {seat.name}
            </option>
          ))}
        </select>
      </label>
      <p role="status">找到 {history.length} 个步骤，最近的在前。</p>
      {history.slice(0, limit).map((h) => (
        <button
          className="secondary"
          key={h.id}
          disabled={locked}
          onClick={() => {
            if (
              confirm(
                `恢复到“${describe(h)}”之前？将撤销当前有效历史中的后续 ${view.history.length - h.step + 1} 个步骤。${h.revealedInformation ? '该步骤涉及揭示信息，' : ''}已经看见的信息无法从记忆消除；所有端将同步并暂停。`,
              )
            )
              command({ type: 'rollback', checkpointId: h.id });
          }}
        >
          {describe(h)}
          {h.revealedInformation ? ' · 含揭示' : ''}
        </button>
      ))}
      {history.length > limit && (
        <button className="secondary" onClick={() => setLimit(limit + 20)}>
          显示更早步骤
        </button>
      )}
    </details>
  );
}
