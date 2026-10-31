import { useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import { OverlayPanel } from './OverlayPanel';
import { ConfirmationDialog } from './ConfirmationDialog';
import { feedbackText } from '../content/feedback';
import { SettingHelp } from '@tablemax/web-host';

export function RollbackHistory({ session }: { session: RoomSession }) {
  const { view, command, locked } = session;
  const [round, setRound] = useState('all');
  const [player, setPlayer] = useState('all');
  const [limit, setLimit] = useState(20);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
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
    `${h.roundNumber ? `第 ${h.roundNumber} 小局，` : ''}第 ${h.step} 步，${h.seatId ? (view.seats.find((s) => s.id === h.seatId)?.name ?? '玩家') : '管理／历史步骤'}，${h.label}`;
  const selectedStep = view.history.find((entry) => entry.id === selected);
  return (
    <>
      <div className="room-management-row">
        <SettingHelp label="决策点回退" hint={feedbackText('history.hint')} />
        <button
          type="button"
          className="secondary"
          aria-label={`决策点回退（${view.history.length}）`}
          onClick={() => setOpen(true)}
        >
          查看（{view.history.length}）
        </button>
      </div>
      {open && (
        <OverlayPanel
          embedded
          title="决策点回退"
          close={() => {
            setOpen(false);
            setSelected(null);
          }}
        >
          <section className="rollback-history">
            <p>{feedbackText('history.hint')}</p>
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
            <p role="status">
              {feedbackText('history.results', { count: history.length })}
            </p>
            {history.slice(0, limit).map((h) => (
              <button
                className="secondary"
                key={h.id}
                disabled={locked}
                onClick={() => setSelected(h.id)}
              >
                <span className="rollback-step">
                  {h.roundNumber ? `第 ${h.roundNumber} 小局` : '对局'} 第{' '}
                  {h.step} 步
                </span>
                <strong>
                  {h.seatId
                    ? (view.seats.find((seat) => seat.id === h.seatId)?.name ??
                      '玩家')
                    : '管理操作'}
                </strong>
                <span>{h.label}</span>
                {h.revealedInformation && <span>含信息揭示</span>}
              </button>
            ))}
            {history.length > limit && (
              <button
                className="secondary"
                onClick={() => setLimit(limit + 20)}
              >
                显示更早步骤
              </button>
            )}
          </section>
          {selectedStep && (
            <ConfirmationDialog
              title="确认回退"
              confirmLabel="确认回退"
              cancel={() => setSelected(null)}
              disabled={locked}
              confirm={() => {
                command({ type: 'rollback', checkpointId: selectedStep.id });
                setSelected(null);
                setOpen(false);
              }}
            >
              <p>
                {feedbackText('history.confirmRollback', {
                  step: describe(selectedStep),
                  count: view.history.length - selectedStep.step + 1,
                })}
              </p>
              <p>
                {selectedStep.revealedInformation
                  ? feedbackText('history.revealedInformation')
                  : ''}
                {feedbackText('history.rollbackEffect')}
              </p>
            </ConfirmationDialog>
          )}
        </OverlayPanel>
      )}
    </>
  );
}
