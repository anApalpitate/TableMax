import { useId, useState } from 'react';
import type { RoomSession } from '../session/useRoomSession';
import type { DeviceTransferSession } from '../session/useDeviceTransfer';
import { ConfirmationDialog } from './ConfirmationDialog';
import { feedbackText } from '../content/feedback';
import './device-transfer.css';

export function DeviceTransfer({
  session,
  transfer,
}: {
  session: RoomSession;
  transfer: DeviceTransferSession;
}) {
  const seats =
    session.view?.seats.filter((seat) => seat.controller === 'human') ?? [];
  const [selectedId, setSelectedId] = useState('');
  const seatInputId = useId();
  const selected = transfer.seatId ?? selectedId;
  return (
    <section className="device-transfer" aria-label="换手机进入">
      <p className="device-transfer__hint">{feedbackText('transfer.hint')}</p>
      <div className="device-transfer__field">
        <label htmlFor={seatInputId}>原座位</label>
        <select
          id={seatInputId}
          name="transfer-seat"
          value={selected}
          disabled={
            !seats.length ||
            transfer.pending ||
            transfer.busy ||
            session.admissionPending
          }
          onChange={(event) => setSelectedId(event.target.value)}
        >
          <option value="">请选择你的座位</option>
          {seats.map((seat) => (
            <option key={seat.id} value={seat.id}>
              {session.view!.seats.findIndex((value) => value.id === seat.id) +
                1}
              号 {seat.name}
            </option>
          ))}
        </select>
        {!seats.length && (
          <p className="device-transfer__status" role="status">
            {feedbackText('transfer.noSeats')}
          </p>
        )}
      </div>
      {transfer.state?.status === 'pending' && (
        <div className="device-transfer__code">
          <span>{feedbackText('transfer.verificationHint')}</span>
          <strong>{transfer.state.verificationCode}</strong>
        </div>
      )}
      {transfer.message && (
        <p className="device-transfer__status" role="status">
          {transfer.message}
        </p>
      )}
      <div className="device-transfer__actions">
        {transfer.pending ? (
          <>
            <button
              type="button"
              className="secondary"
              disabled={transfer.busy || !session.connected}
              onClick={transfer.retry}
            >
              重试确认
            </button>
            <button
              type="button"
              className="secondary"
              disabled={transfer.busy}
              onClick={transfer.cancel}
            >
              取消申请
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={
              !seats.some((seat) => seat.id === selected) ||
              transfer.busy ||
              !session.connected ||
              session.admissionPending
            }
            onClick={() => transfer.start(selected)}
          >
            申请接续座位
          </button>
        )}
      </div>
    </section>
  );
}

export function DeviceTransferRequests({ session }: { session: RoomSession }) {
  const [confirmation, setConfirmation] = useState<string | null>(null);
  if (!session.isHost) return null;
  const requests = session.view?.transferRequests ?? [];
  const selected = requests.find(
    (request) => request.requestId === confirmation,
  );
  const verificationCopy = feedbackText('transfer.confirmVerifyCode').split(
    '{code}',
  );
  return (
    <section className="device-transfer-requests" aria-label="换机申请">
      <div className="device-transfer-requests__heading">
        <h3>换机申请</h3>
        {requests.length > 0 && (
          <span
            aria-label={feedbackText('transfer.pendingRequests', {
              count: requests.length,
            })}
          >
            {requests.length}
          </span>
        )}
      </div>
      {!requests.length && (
        <p className="device-transfer-requests__empty">
          {feedbackText('transfer.noRequests')}
        </p>
      )}
      {requests.map((request) => {
        const seat = session.view!.seats.find(
          (value) => value.id === request.seatId,
        );
        return (
          <div className="device-transfer-request" key={request.requestId}>
            <div className="device-transfer-request__identity">
              <strong>{seat?.name ?? '已移除的座位'}</strong>
              <div className="device-transfer-request__verification">
                <span>核对码</span>
                <strong>{request.verificationCode}</strong>
              </div>
            </div>
            <div className="device-transfer__actions">
              <button
                type="button"
                disabled={session.locked}
                onClick={() => setConfirmation(request.requestId)}
              >
                批准换机
              </button>
              <button
                type="button"
                className="secondary"
                disabled={session.locked}
                onClick={() =>
                  session.command({
                    type: 'reject-transfer',
                    requestId: request.requestId,
                  })
                }
              >
                拒绝
              </button>
            </div>
          </div>
        );
      })}
      {selected && (
        <ConfirmationDialog
          title="批准换机"
          confirmLabel="批准并退出旧设备"
          cancel={() => setConfirmation(null)}
          disabled={session.locked}
          confirm={() => {
            session.command({
              type: 'approve-transfer',
              requestId: selected.requestId,
            });
            setConfirmation(null);
          }}
        >
          <p>
            {verificationCopy[0]}
            <strong className="device-transfer-confirm-code">
              {selected.verificationCode}
            </strong>
            {verificationCopy[1]}
          </p>
          <p>{feedbackText('transfer.approvalEffect')}</p>
        </ConfirmationDialog>
      )}
    </section>
  );
}
