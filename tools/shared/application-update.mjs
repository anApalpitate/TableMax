import {
  constants,
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from 'node:crypto';
import { TextDecoder } from 'node:util';
import { readFileSync } from 'node:fs';

export const APPLICATION_UPDATE = Object.freeze({
  productId: '{DB749B9D-7D43-4F50-9FBD-551C9E8EF48D}',
  repo: 'anApalpitate/TableMax',
  schemaVersion: 1,
  installProtocol: 1,
  algorithm: 'RSA3072-SHA256-PKCS1v15',
  marker: 'TABLEMAX-APPLICATION-UPDATE-V1',
  maxPayloadBytes: 8192,
  maxEnvelopeBytes: 16384,
  maxBodyBytes: 131072,
  maxAssetBytes: 120000000,
  maxRedirects: 3,
});

export class ApplicationUpdateError extends Error {
  constructor(code) {
    super('Application update rejected: ' + code);
    this.name = 'ApplicationUpdateError';
    this.code = code;
  }
}
const reject = (code) => {
  throw new ApplicationUpdateError(code);
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const shaPattern = /^[a-f0-9]{64}$/;
const keyIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;

function utf8(input, limit) {
  const bytes =
    typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  if (bytes.length > limit) reject('input-too-long');
  if (
    bytes.length >= 3 &&
    bytes.subarray(0, 3).equals(Buffer.from([239, 187, 191]))
  )
    reject('utf8-bom');
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    reject('invalid-utf8');
  }
}

/** Parse original JSON bytes without allowing duplicate (including escaped) keys. */
export function parseStrictJson(
  input,
  limit = APPLICATION_UPDATE.maxPayloadBytes,
  { canonicalIntegers = false } = {},
) {
  const text = utf8(input, limit);
  let cursor = 0;
  const whitespace = () => {
    while (/\s/.test(text[cursor] ?? '') && cursor < text.length) {
      if (!' \t\r\n'.includes(text[cursor])) reject('invalid-json');
      cursor++;
    }
  };
  const string = () => {
    if (text[cursor] !== '"') reject('invalid-json');
    const start = cursor++;
    while (cursor < text.length) {
      const char = text[cursor++];
      if (char === '"') {
        try {
          return JSON.parse(text.slice(start, cursor));
        } catch {
          reject('invalid-json');
        }
      }
      if (char === '\\') cursor++;
      else if (char.charCodeAt(0) < 32) reject('invalid-json');
    }
    reject('invalid-json');
  };
  const value = (depth) => {
    if (depth > 16) reject('json-too-deep');
    whitespace();
    if (text[cursor] === '"') return string();
    if (text[cursor] === '{') {
      cursor++;
      const result = Object.create(null);
      const keys = new Set();
      whitespace();
      if (text[cursor] === '}') {
        cursor++;
        return result;
      }
      while (cursor < text.length) {
        whitespace();
        const key = string();
        if (keys.has(key)) reject('duplicate-json-field');
        keys.add(key);
        whitespace();
        if (text[cursor++] !== ':') reject('invalid-json');
        result[key] = value(depth + 1);
        whitespace();
        const separator = text[cursor++];
        if (separator === '}') return result;
        if (separator !== ',') reject('invalid-json');
      }
    } else if (text[cursor] === '[') {
      cursor++;
      const result = [];
      whitespace();
      if (text[cursor] === ']') {
        cursor++;
        return result;
      }
      while (cursor < text.length) {
        result.push(value(depth + 1));
        whitespace();
        const separator = text[cursor++];
        if (separator === ']') return result;
        if (separator !== ',') reject('invalid-json');
      }
    } else {
      const remaining = text.slice(cursor);
      for (const [token, parsed] of [
        ['true', true],
        ['false', false],
        ['null', null],
      ])
        if (remaining.startsWith(token)) {
          cursor += token.length;
          return parsed;
        }
      const number = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
        remaining,
      );
      if (number) {
        cursor += number[0].length;
        if (canonicalIntegers && !/^(0|[1-9]\d*)$/.test(number[0]))
          reject('noncanonical-json-number');
        const parsed = Number(number[0]);
        if (!Number.isFinite(parsed)) reject('invalid-json-number');
        if (canonicalIntegers && !Number.isSafeInteger(parsed))
          reject('unsafe-json-number');
        return parsed;
      }
    }
    reject('invalid-json');
  };
  const result = value(0);
  whitespace();
  if (cursor !== text.length) reject('invalid-json');
  return result;
}

function fields(object, expected, code) {
  if (!object || typeof object !== 'object' || Array.isArray(object))
    reject(code);
  const actual = Object.keys(object);
  if (
    actual.length !== expected.length ||
    expected.some((key) => !Object.hasOwn(object, key))
  )
    reject(code);
}
const descriptionFields = [
  'schemaVersion',
  'productId',
  'channel',
  'os',
  'arch',
  'installProtocol',
  'releaseVersion',
  'buildVersion',
  'releaseTag',
  'repo',
  'assetName',
  'assetUrl',
  'bytes',
  'sha256',
  'payloadManifestSha256',
  'currentMappingSha256',
];

export function parseApplicationVersion(version, segments = 4) {
  if (
    typeof version !== 'string' ||
    !new RegExp(`^1(?:\\.(?:0|[1-9]\\d*)){${segments - 1}}$`).test(version)
  )
    reject('invalid-version');
  const numbers = version.split('.').map(Number);
  if (numbers.some((number) => !Number.isInteger(number) || number > 65534))
    reject('invalid-version');
  return numbers;
}

export function compareApplicationVersions(left, right) {
  const a = parseApplicationVersion(left);
  const b = parseApplicationVersion(right);
  for (let index = 0; index < 4; index++)
    if (a[index] !== b[index]) return Math.sign(a[index] - b[index]);
  return 0;
}

export function validateApplicationUpdateDescription(description) {
  fields(description, descriptionFields, 'description-fields');
  if (
    description.schemaVersion !== 1 ||
    description.productId !== APPLICATION_UPDATE.productId ||
    description.channel !== 'stable' ||
    description.os !== 'windows' ||
    description.arch !== 'x64' ||
    description.installProtocol !== 1
  )
    reject('unsupported-description');
  parseApplicationVersion(description.releaseVersion, 3);
  parseApplicationVersion(description.buildVersion);
  if (
    description.buildVersion.split('.').slice(0, 3).join('.') !==
      description.releaseVersion ||
    description.releaseTag !== 'v' + description.releaseVersion ||
    description.repo !== APPLICATION_UPDATE.repo ||
    description.assetName !==
      `TableMax-${description.releaseVersion}-installer-win-x64.exe` ||
    description.assetUrl !==
      `https://github.com/${APPLICATION_UPDATE.repo}/releases/download/${description.releaseTag}/${description.assetName}`
  )
    reject('asset-identity');
  if (
    !Number.isSafeInteger(description.bytes) ||
    description.bytes <= 0 ||
    description.bytes >= APPLICATION_UPDATE.maxAssetBytes ||
    !['sha256', 'payloadManifestSha256', 'currentMappingSha256'].every(
      (field) =>
        typeof description[field] === 'string' &&
        shaPattern.test(description[field]),
    )
  )
    reject('asset-integrity-fields');
  return Object.freeze({ ...description });
}

function base64(value, maxBytes, code) {
  if (
    typeof value !== 'string' ||
    value.length > Math.ceil(maxBytes / 3) * 4 ||
    value.length === 0 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    reject(code);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > maxBytes || bytes.toString('base64') !== value)
    reject(code);
  return bytes;
}

export function applicationPublicKeyXml(key) {
  const publicKey = publicRsaKey(key);
  const jwk = publicKey.export({ format: 'jwk' });
  return `<RSAKeyValue><Modulus>${Buffer.from(jwk.n, 'base64url').toString('base64')}</Modulus><Exponent>${Buffer.from(jwk.e, 'base64url').toString('base64')}</Exponent></RSAKeyValue>`;
}

function publicRsaKey(input) {
  let key;
  try {
    if (typeof input === 'string' && input.startsWith('<RSAKeyValue>')) {
      const match =
        /^<RSAKeyValue>\s*<Modulus>([A-Za-z0-9+/]+=*)<\/Modulus>\s*<Exponent>([A-Za-z0-9+/]+=*)<\/Exponent>\s*<\/RSAKeyValue>$/.exec(
          input,
        );
      if (!match) reject('invalid-public-key');
      const modulus = base64(match[1], 384, 'invalid-public-key');
      const exponent = base64(match[2], 8, 'invalid-public-key');
      key = createPublicKey({
        format: 'jwk',
        key: {
          kty: 'RSA',
          n: modulus.toString('base64url'),
          e: exponent.toString('base64url'),
        },
      });
    } else {
      key = input?.type === 'public' ? input : createPublicKey(input);
    }
  } catch {
    reject('invalid-public-key');
  }
  if (
    key.asymmetricKeyType !== 'rsa' ||
    key.asymmetricKeyDetails?.modulusLength !== 3072 ||
    key.asymmetricKeyDetails?.publicExponent !== 65537n
  )
    reject('invalid-public-key');
  return key;
}

export function signApplicationUpdate(description, privateKey, { keyId }) {
  if (typeof keyId !== 'string' || !keyIdPattern.test(keyId))
    reject('invalid-key-id');
  const payload =
    typeof description === 'string' || Buffer.isBuffer(description)
      ? Buffer.from(description)
      : Buffer.from(JSON.stringify(description), 'utf8');
  validateApplicationUpdateDescription(
    parseStrictJson(payload, APPLICATION_UPDATE.maxPayloadBytes, {
      canonicalIntegers: true,
    }),
  );
  let key;
  try {
    key =
      privateKey?.type === 'private'
        ? privateKey
        : createPrivateKey(privateKey);
  } catch {
    reject('invalid-private-key');
  }
  publicRsaKey(key);
  return Object.freeze({
    schemaVersion: 1,
    algorithm: APPLICATION_UPDATE.algorithm,
    keyId,
    payload: payload.toString('base64'),
    signature: sign('sha256', payload, {
      key,
      padding: constants.RSA_PKCS1_PADDING,
    }).toString('base64'),
  });
}

export function verifyApplicationUpdate(
  envelopeInput,
  { trustedKeys = APPLICATION_UPDATE_TRUST } = {},
) {
  const envelope =
    typeof envelopeInput === 'string' || Buffer.isBuffer(envelopeInput)
      ? parseStrictJson(envelopeInput, APPLICATION_UPDATE.maxEnvelopeBytes, {
          canonicalIntegers: true,
        })
      : envelopeInput;
  fields(
    envelope,
    ['schemaVersion', 'algorithm', 'keyId', 'payload', 'signature'],
    'envelope-fields',
  );
  if (
    envelope.schemaVersion !== 1 ||
    envelope.algorithm !== APPLICATION_UPDATE.algorithm ||
    typeof envelope.keyId !== 'string' ||
    !keyIdPattern.test(envelope.keyId)
  )
    reject('unsupported-envelope');
  const trusted =
    trustedKeys instanceof Map
      ? trustedKeys.get(envelope.keyId)
      : Object.hasOwn(trustedKeys ?? {}, envelope.keyId)
        ? trustedKeys[envelope.keyId]
        : undefined;
  if (!trusted) reject('untrusted-key');
  const key = publicRsaKey(trusted);
  const payload = base64(
    envelope.payload,
    APPLICATION_UPDATE.maxPayloadBytes,
    'invalid-payload-base64',
  );
  const signature = base64(envelope.signature, 384, 'invalid-signature-base64');
  if (
    signature.length !== 384 ||
    !verify(
      'sha256',
      payload,
      { key, padding: constants.RSA_PKCS1_PADDING },
      signature,
    )
  )
    reject('invalid-signature');
  // Parse only authenticated original bytes; never serialize before VerifyData.
  const description = validateApplicationUpdateDescription(
    parseStrictJson(payload, APPLICATION_UPDATE.maxPayloadBytes, {
      canonicalIntegers: true,
    }),
  );
  return {
    description,
    descriptionSha256: digest(payload),
    payload,
    envelope: { ...envelope },
  };
}

const publicTrust = parseStrictJson(
  readFileSync(new URL('./application-update-trust.json', import.meta.url)),
);
fields(
  publicTrust,
  ['keyId', 'publicKey', 'publicKeyXml'],
  'public-trust-fields',
);
if (
  typeof publicTrust.keyId !== 'string' ||
  !keyIdPattern.test(publicTrust.keyId) ||
  applicationPublicKeyXml(publicTrust.publicKey) !== publicTrust.publicKeyXml
)
  reject('public-trust-identity');
export const APPLICATION_UPDATE_TRUST = Object.freeze({
  [publicTrust.keyId]: publicTrust.publicKeyXml,
});

export function applicationUpdateMachineBlock(envelope) {
  fields(
    envelope,
    ['schemaVersion', 'algorithm', 'keyId', 'payload', 'signature'],
    'envelope-fields',
  );
  const bytes = Buffer.from(JSON.stringify(envelope), 'utf8');
  if (bytes.length > APPLICATION_UPDATE.maxEnvelopeBytes)
    reject('input-too-long');
  return `<!-- ${APPLICATION_UPDATE.marker}:${bytes.toString('base64')} -->`;
}

export function extractApplicationUpdate(body) {
  const text = utf8(body, APPLICATION_UPDATE.maxBodyBytes);
  const mentions = text.match(/TABLEMAX-APPLICATION-UPDATE/g) ?? [];
  if (mentions.length === 0) reject('missing-update-description');
  if (mentions.length !== 1) reject('multiple-update-blocks');
  const match =
    /<!-- TABLEMAX-APPLICATION-UPDATE-V1:([A-Za-z0-9+/]+={0,2}) -->/.exec(text);
  if (!match) reject('invalid-update-block');
  const bytes = base64(
    match[1],
    APPLICATION_UPDATE.maxEnvelopeBytes,
    'invalid-envelope-base64',
  );
  return {
    envelope: parseStrictJson(bytes, APPLICATION_UPDATE.maxEnvelopeBytes, {
      canonicalIntegers: true,
    }),
    notes: (
      text.slice(0, match.index) + text.slice(match.index + match[0].length)
    ).trim(),
  };
}

/** Compare against both installed identity and the highest authenticated candidate. */
export function applicationUpdateDecision(
  candidate,
  { current, highestAccepted } = {},
) {
  const description = validateApplicationUpdateDescription(candidate);
  let equalCurrent = false;
  for (const [label, identity] of [
    ['current', current],
    ['highest', highestAccepted],
  ]) {
    if (!identity) continue;
    if (!shaPattern.test(identity.sha256 ?? ''))
      reject('invalid-version-identity');
    const comparison = compareApplicationVersions(
      description.buildVersion,
      identity.buildVersion,
    );
    if (comparison < 0) reject('version-downgrade');
    if (comparison === 0) {
      if (
        description.sha256 !== identity.sha256 ||
        (identity.bytes !== undefined &&
          description.bytes !== identity.bytes) ||
        (identity.payloadManifestSha256 !== undefined &&
          description.payloadManifestSha256 !==
            identity.payloadManifestSha256) ||
        (identity.currentMappingSha256 !== undefined &&
          description.currentMappingSha256 !== identity.currentMappingSha256)
      )
        reject('same-version-different-bytes');
      if (label === 'current') equalCurrent = true;
    }
  }
  return equalCurrent ? 'current' : 'upgrade';
}

export function verifyGitHubRelease(release, description) {
  validateApplicationUpdateDescription(description);
  if (
    !release ||
    !Number.isSafeInteger(release.id) ||
    release.id <= 0 ||
    release.draft !== false ||
    release.prerelease !== false ||
    release.tag_name !== description.releaseTag ||
    release.html_url !==
      `https://github.com/${APPLICATION_UPDATE.repo}/releases/tag/${description.releaseTag}` ||
    !Array.isArray(release.assets) ||
    release.assets.length !== 2
  )
    reject('github-release-identity');
  const sourceName = `TableMax-${description.releaseVersion}-source.zip`;
  const asset = release.assets.find(
    (value) => value.name === description.assetName,
  );
  const source = release.assets.find((value) => value.name === sourceName);
  if (!asset || !source || asset === source || asset.id === source.id)
    reject('github-assets');
  for (const entry of [asset, source])
    if (
      !Number.isSafeInteger(entry.id) ||
      entry.id <= 0 ||
      entry.state !== 'uploaded' ||
      !Number.isSafeInteger(entry.size) ||
      entry.size <= 0
    )
      reject('github-assets');
  if (
    asset.size !== description.bytes ||
    asset.browser_download_url !== description.assetUrl ||
    source.browser_download_url !==
      `https://github.com/${APPLICATION_UPDATE.repo}/releases/download/${description.releaseTag}/${sourceName}` ||
    (asset.digest !== null &&
      asset.digest !== undefined &&
      asset.digest !== 'sha256:' + description.sha256)
  )
    reject('github-asset-mismatch');
  return Object.freeze({
    releaseId: release.id,
    assetId: asset.id,
    sourceAssetId: source.id,
    assetUrl: description.assetUrl,
  });
}

export function validateApplicationDownloadUrl(value, description, hop = 0) {
  validateApplicationUpdateDescription(description);
  if (
    typeof value !== 'string' ||
    value.length > 8192 ||
    value !== value.trim() ||
    !Number.isInteger(hop) ||
    hop < 0 ||
    hop > APPLICATION_UPDATE.maxRedirects
  )
    reject('download-url');
  let url;
  try {
    url = new URL(value);
  } catch {
    reject('download-url');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    url.port
  )
    reject('download-url');
  if (hop === 0 || url.hostname === 'github.com') {
    if (value !== description.assetUrl) reject('download-url');
  } else if (
    url.hostname !== 'release-assets.githubusercontent.com' ||
    !/^\/github-production-release-asset\/[A-Za-z0-9/_-]+$/.test(url.pathname)
  ) {
    reject('download-url');
  }
  return url.href;
}

/** Bounded transport; injected fetch is for fault tests, never an HTTP bypass. */
export async function downloadApplicationUpdate(
  description,
  { fetchImpl = globalThis.fetch, signal, onProgress, timeoutMs = 30000 } = {},
) {
  validateApplicationUpdateDescription(description);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000)
    reject('download-timeout');
  const timeout = AbortSignal.timeout(timeoutMs);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let url = description.assetUrl;
  const visited = new Set();
  const redirects = [];
  let response;
  for (let hop = 0; ; hop++) {
    validateApplicationDownloadUrl(url, description, hop);
    if (visited.has(url)) reject('redirect-cycle');
    visited.add(url);
    response = await fetchImpl(url, {
      redirect: 'manual',
      signal: requestSignal,
      headers: { 'Accept-Encoding': 'identity' },
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    await response.body?.cancel();
    if (hop >= APPLICATION_UPDATE.maxRedirects) reject('too-many-redirects');
    const location = response.headers.get('location');
    if (!location) reject('missing-redirect-location');
    let next;
    try {
      next = new URL(location, url).href;
    } catch {
      reject('download-url');
    }
    redirects.push(next);
    url = next;
  }
  if (response.status !== 200 || !response.body) {
    await response.body?.cancel();
    reject('download-status');
  }
  const length = response.headers.get('content-length');
  const encoding = response.headers.get('content-encoding');
  if (
    (length !== null &&
      (!/^(0|[1-9]\d*)$/.test(length) ||
        Number(length) !== description.bytes)) ||
    (encoding && encoding !== 'identity')
  ) {
    await response.body.cancel();
    reject('download-length');
  }
  const reader = response.body.getReader();
  const cancel = () => {
    reader.cancel(requestSignal.reason).catch(() => {});
  };
  requestSignal.addEventListener('abort', cancel, { once: true });
  const hash = createHash('sha256');
  const chunks = [];
  let received = 0;
  try {
    while (true) {
      if (requestSignal.aborted) throw requestSignal.reason;
      const { done, value } = await reader.read();
      if (requestSignal.aborted) throw requestSignal.reason;
      if (done) break;
      received += value.byteLength;
      if (received > description.bytes) reject('download-too-long');
      hash.update(value);
      chunks.push(Buffer.from(value));
      onProgress?.({ received, total: description.bytes });
    }
    if (received !== description.bytes) reject('download-too-short');
    const sha256 = hash.digest('hex');
    if (sha256 !== description.sha256) reject('download-sha256');
    return { bytes: Buffer.concat(chunks), sha256, url, redirects };
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    requestSignal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
