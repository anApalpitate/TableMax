import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

// The client keeps a random request key until the response is received. Only
// encrypted credentials and the key's digest are persisted by the server.
const encryptionKey = (requestKey: string) =>
  createHash('sha256').update(requestKey).digest();
export function sealCredential(credential: string, requestKey: string) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    encryptionKey(requestKey),
    nonce,
  );
  const body = Buffer.concat([
    cipher.update(credential, 'hex'),
    cipher.final(),
  ]);
  return Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('hex');
}
export function openCredential(sealed: string, requestKey: string) {
  const bytes = Buffer.from(sealed, 'hex');
  const cipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(requestKey),
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString('hex');
}
