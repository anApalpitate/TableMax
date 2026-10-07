import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

// The persisted lookup digest must not also be the credential encryption key.
// New receipts use a separate derivation domain and an explicit format byte.
const encryptionKey = (requestKey: string) =>
  createHash('sha256')
    .update('TableMax session credential v2\0')
    .update(requestKey)
    .digest();
export function isSealedCredential(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^(?:[0-9a-f]{120}|02[0-9a-f]{120})$/.test(value)
  );
}
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
  return (
    '02' + Buffer.concat([nonce, cipher.getAuthTag(), body]).toString('hex')
  );
}
export function openCredential(sealed: string, requestKey: string) {
  if (!isSealedCredential(sealed)) throw new Error('invalid-sealed-credential');
  const versioned = sealed.length === 122;
  const bytes = Buffer.from(versioned ? sealed.slice(2) : sealed, 'hex');
  // Existing unversioned receipts remain readable so a lost old reply does not
  // discard a seat. They retain their original at-rest security limitation.
  const key = versioned
    ? encryptionKey(requestKey)
    : createHash('sha256').update(requestKey).digest();
  const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  cipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([
    cipher.update(bytes.subarray(28)),
    cipher.final(),
  ]).toString('hex');
}
