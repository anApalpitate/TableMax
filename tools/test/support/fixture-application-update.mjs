import {
  constants,
  createHash,
  createPublicKey,
  sign,
  verify,
} from 'node:crypto';
import {
  APPLICATION_UPDATE,
  ApplicationUpdateError,
  applicationPublicKeyXml,
  parseStrictJson,
  validateApplicationUpdateDescription,
} from '../../shared/application-update.mjs';

export const FIXTURE_APPLICATION_UPDATE_PRODUCT_ID =
  '{ABFDE9A8-48D2-48D5-BC51-2A2D03F0D4F5}';
const reject = (code) => {
  throw new ApplicationUpdateError(code);
};
const keyIdPattern = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const envelopeFields = [
  'schemaVersion',
  'algorithm',
  'keyId',
  'payload',
  'signature',
];
function fields(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).length !== envelopeFields.length ||
    envelopeFields.some((name) => !Object.hasOwn(value, name))
  )
    reject('envelope-fields');
}
function base64(value, maximum, code) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > Math.ceil(maximum / 3) * 4 ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    reject(code);
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length > maximum || bytes.toString('base64') !== value)
    reject(code);
  return bytes;
}
function fixtureDescription(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    reject('description-fields');
  if (value.productId !== FIXTURE_APPLICATION_UPDATE_PRODUCT_ID)
    reject('fixture-product-id');
  // Reuse the production schema, but never sign or authenticate normalized bytes.
  const validated = validateApplicationUpdateDescription({
    ...value,
    productId: APPLICATION_UPDATE.productId,
  });
  return Object.freeze({
    ...validated,
    productId: FIXTURE_APPLICATION_UPDATE_PRODUCT_ID,
  });
}
function fixturePublicKey(input) {
  // The production public-key exporter enforces RSA3072 and exponent 65537,
  // including strict XML/Base64 validation for the native fixture trust resource.
  const xml = applicationPublicKeyXml(input);
  const match =
    /^<RSAKeyValue><Modulus>([A-Za-z0-9+/]+=*)<\/Modulus><Exponent>([A-Za-z0-9+/]+=*)<\/Exponent><\/RSAKeyValue>$/.exec(
      xml,
    );
  if (!match) reject('invalid-public-key');
  return createPublicKey({
    format: 'jwk',
    key: {
      kty: 'RSA',
      n: Buffer.from(match[1], 'base64').toString('base64url'),
      e: Buffer.from(match[2], 'base64').toString('base64url'),
    },
  });
}

/** Test-only fixture protocol. Private KeyObjects must be generated in memory. */
export function signFixtureApplicationUpdate(
  description,
  privateKey,
  { keyId },
) {
  if (typeof keyId !== 'string' || !keyIdPattern.test(keyId))
    reject('invalid-key-id');
  const payload =
    typeof description === 'string' || Buffer.isBuffer(description)
      ? Buffer.from(description)
      : Buffer.from(JSON.stringify(description), 'utf8');
  fixtureDescription(
    parseStrictJson(payload, APPLICATION_UPDATE.maxPayloadBytes, {
      canonicalIntegers: true,
    }),
  );
  if (privateKey?.type !== 'private') reject('invalid-private-key');
  fixturePublicKey(privateKey);
  return Object.freeze({
    schemaVersion: 1,
    algorithm: APPLICATION_UPDATE.algorithm,
    keyId,
    payload: payload.toString('base64'),
    signature: sign('sha256', payload, {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING,
    }).toString('base64'),
  });
}

export function verifyFixtureApplicationUpdate(
  envelopeInput,
  { trustedKeys } = {},
) {
  const envelope =
    typeof envelopeInput === 'string' || Buffer.isBuffer(envelopeInput)
      ? parseStrictJson(envelopeInput, APPLICATION_UPDATE.maxEnvelopeBytes, {
          canonicalIntegers: true,
        })
      : envelopeInput;
  fields(envelope);
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
  const key = fixturePublicKey(trusted);
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
  const description = fixtureDescription(
    parseStrictJson(payload, APPLICATION_UPDATE.maxPayloadBytes, {
      canonicalIntegers: true,
    }),
  );
  return {
    description,
    descriptionSha256: createHash('sha256').update(payload).digest('hex'),
    payload,
    envelope: { ...envelope },
  };
}
