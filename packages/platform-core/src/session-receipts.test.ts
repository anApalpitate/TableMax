import { expect, it } from 'vitest';
import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import {
  isSealedCredential,
  openCredential,
  sealCredential,
} from './session-receipts';
import { RoomCoordinator, hash, token } from './room';
import type { Save, SaveRepository } from './model';
import { rules, bot } from '../../../games/template';

const requestKey = 'a'.repeat(64);
const credential = 'b'.repeat(64);

function legacySeal(value: string, proof: string) {
  const nonce = Buffer.alloc(12, 2);
  const cipher = createCipheriv(
    'aes-256-gcm',
    createHash('sha256').update(proof).digest(),
    nonce,
  );
  const body = Buffer.concat([cipher.update(value, 'hex'), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('hex');
}
class Repository implements SaveRepository {
  value: Save | null = null;
  load() {
    return structuredClone(this.value);
  }
  save(value: Save) {
    this.value = structuredClone(value);
  }
}

it('cannot decrypt a new receipt with the persisted lookup digest as an AES key', () => {
  const sealed = sealCredential(credential, requestKey);
  const bytes = Buffer.from(
    sealed.length === 122 ? sealed.slice(2) : sealed,
    'hex',
  );
  const persistedDigest = createHash('sha256').update(requestKey).digest();
  const cipher = createDecipheriv(
    'aes-256-gcm',
    persistedDigest,
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  expect(() =>
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]),
  ).toThrow();
});

it('writes only version 02 and opens it with the original proof', () => {
  const first = sealCredential(credential, requestKey);
  const second = sealCredential(credential, requestKey);
  expect(first).toMatch(/^02[0-9a-f]{120}$/);
  expect(second).not.toBe(first);
  expect(isSealedCredential(first)).toBe(true);
  expect(openCredential(first, requestKey)).toBe(credential);
});

it('rejects an incorrect proof, tampered ciphertext and a stripped version', () => {
  const sealed = sealCredential(credential, requestKey);
  const replacement = sealed.at(-1) === '0' ? '1' : '0';
  expect(() => openCredential(sealed, 'c'.repeat(64))).toThrow();
  expect(() =>
    openCredential(sealed.slice(0, -1) + replacement, requestKey),
  ).toThrow();
  expect(() => openCredential(sealed.slice(2), requestKey)).toThrow();
});

it('reads an existing unversioned receipt even when its nonce begins with 02', () => {
  const legacy = legacySeal(credential, requestKey);
  expect(legacy).toHaveLength(120);
  expect(legacy.startsWith('02')).toBe(true);
  expect(isSealedCredential(legacy)).toBe(true);
  expect(openCredential(legacy, requestKey)).toBe(credential);
});

it('restores an old saved admission receipt without changing the existing seat', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  const joined = await room.join('兼容朋友', requestKey);
  const originalSeat = room.view(joined.token).self.seatId;
  repository.value!.sessionReceipts![hash(requestKey)]!.sealedCredential =
    legacySeal(joined.token, requestKey);
  const restored = new RoomCoordinator(rules, bot, repository);
  const recovered = await restored.join('兼容朋友', requestKey);
  expect(recovered.token === joined.token).toBe(true);
  expect(restored.view(recovered.token).self.seatId).toBe(originalSeat);
  expect(restored.view().seats).toHaveLength(1);
});

it('restores an old approved transfer receipt while preserving credential revocation', async () => {
  const repository = new Repository();
  const room = new RoomCoordinator(rules, bot, repository);
  const joined = await room.join('兼容换机', token());
  const seatId = room.view(joined.token).self.seatId!;
  const request = await room.requestTransfer(seatId, requestKey);
  const view = room.view(room.hostToken);
  const approved = await room.command(room.hostToken, {
    actionId: token(),
    instanceId: view.instanceId,
    revision: view.revision,
    branch: view.branch,
    command: { type: 'approve-transfer', requestId: request.requestId },
  });
  expect(approved.ok).toBe(true);
  const before = room.transferStatus(requestKey);
  if (before.status !== 'approved') throw new Error('transfer-not-approved');
  repository.value!.transferRequests![hash(requestKey)]!.sealedCredential =
    legacySeal(before.token, requestKey);
  const restored = new RoomCoordinator(rules, bot, repository);
  const recovered = restored.transferStatus(requestKey);
  if (recovered.status !== 'approved')
    throw new Error('transfer-not-recovered');
  expect(recovered.token === before.token).toBe(true);
  expect(restored.view(recovered.token).self.seatId).toBe(seatId);
  expect(() => restored.identity(joined.token)).toThrow('invalid-identity');
});

it.each([
  null,
  42,
  '',
  '0'.repeat(118),
  '03' + '0'.repeat(120),
  '02' + 'G'.repeat(120),
])('rejects malformed or unknown sealed format %s', (input) => {
  expect(isSealedCredential(input)).toBe(false);
  if (typeof input === 'string')
    expect(() => openCredential(input, requestKey)).toThrow(
      'invalid-sealed-credential',
    );
});
