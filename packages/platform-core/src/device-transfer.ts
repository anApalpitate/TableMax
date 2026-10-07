import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { TransferState } from '@tablemax/protocol';
import type { DeviceTransfer, Save } from './model';
import { requireThat } from './errors';
import { openCredential, sealCredential } from './session-receipts';

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
const pendingLifetime = 5 * 60_000;
const receiptLifetime = 24 * 60 * 60_000;
export function transferForKey(save: Save, requestKey: string) {
  requireThat(/^[0-9a-f]{64}$/.test(requestKey), 'invalid-message');
  const request = save.transferRequests?.[digest(requestKey)];
  requireThat(request, 'transfer-request-expired');
  return request;
}
export function transferState(
  save: Save,
  request: DeviceTransfer,
  requestKey: string,
): TransferState {
  const base = {
    requestId: request.id,
    seatId: request.seatId,
    verificationCode: request.verificationCode,
    expiresAt: request.expires,
  };
  const seat = save.seats.find(
    (value) => value.id === request.seatId && value.controller === 'human',
  );
  if (
    !seat ||
    seat.tokenHash !==
      (request.status === 'approved'
        ? request.candidateTokenHash
        : request.previousTokenHash)
  )
    return { ...base, status: 'revoked' };
  if (request.expires <= Date.now()) return { ...base, status: 'expired' };
  if (request.status === 'approved')
    return {
      ...base,
      status: 'approved',
      token: openCredential(request.sealedCredential, requestKey),
    };
  return { ...base, status: request.status };
}
export function createTransfer(save: Save, seatId: string, requestKey: string) {
  requireThat(/^[0-9a-f]{64}$/.test(requestKey), 'invalid-message');
  const seat = save.seats.find(
    (value) => value.id === seatId && value.controller === 'human',
  );
  requireThat(seat?.tokenHash, 'invalid-seat');
  save.transferRequests = Object.fromEntries(
    Object.entries(save.transferRequests ?? {}).filter(
      ([, value]) =>
        value.expires > Date.now() &&
        save.seats.some((current) => current.id === value.seatId),
    ),
  );
  const records = Object.values(save.transferRequests);
  requireThat(
    records.length < 128 &&
      records.filter((value) => value.status === 'pending').length < 32,
    'transfer-request-limit',
  );
  const credential = randomBytes(32).toString('hex');
  const request: DeviceTransfer = {
    id: randomUUID(),
    seatId,
    previousTokenHash: seat.tokenHash,
    candidateTokenHash: digest(credential),
    sealedCredential: sealCredential(credential, requestKey),
    verificationCode: (randomBytes(4).readUInt32LE() % 1_000_000)
      .toString()
      .padStart(6, '0'),
    expires: Date.now() + pendingLifetime,
    status: 'pending',
  };
  save.transferRequests[digest(requestKey)] = request;
  return request;
}
export function decideTransfer(
  save: Save,
  requestId: string,
  approve: boolean,
) {
  const request = Object.values(save.transferRequests ?? {}).find(
    (value) => value.id === requestId,
  );
  requireThat(
    request && request.status === 'pending' && request.expires > Date.now(),
    'transfer-request-expired',
  );
  const seat = save.seats.find(
    (value) => value.id === request.seatId && value.controller === 'human',
  );
  requireThat(
    seat && seat.tokenHash === request.previousTokenHash,
    'transfer-request-revoked',
  );
  if (approve) {
    seat.tokenHash = request.candidateTokenHash;
    request.status = 'approved';
    request.expires = Date.now() + receiptLifetime;
  } else request.status = 'rejected';
}
export function pendingTransfers(save: Save) {
  return Object.values(save.transferRequests ?? {})
    .filter(
      (request) =>
        request.status === 'pending' &&
        request.expires > Date.now() &&
        save.seats.some(
          (seat) =>
            seat.id === request.seatId &&
            seat.controller === 'human' &&
            seat.tokenHash === request.previousTokenHash,
        ),
    )
    .map((request) => ({
      requestId: request.id,
      seatId: request.seatId,
      verificationCode: request.verificationCode,
      expiresAt: request.expires,
    }));
}
