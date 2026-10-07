// getRandomValues is available on HTTP LAN and forwarded origins as well as HTTPS.
// Identity request keys must never fall back to Math.random.
export function randomId(
  bytes = 16,
  source: Pick<Crypto, 'getRandomValues'> = globalThis.crypto,
) {
  return Array.from(source.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
