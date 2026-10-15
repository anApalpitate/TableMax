import assert from 'node:assert/strict';
import { constants, generateKeyPairSync, sign, verify } from 'node:crypto';
import test from 'node:test';
import {
  APPLICATION_UPDATE,
  applicationPublicKeyXml,
  signApplicationUpdate,
  verifyApplicationUpdate,
} from '../../shared/application-update.mjs';
import {
  FIXTURE_APPLICATION_UPDATE_PRODUCT_ID,
  signFixtureApplicationUpdate,
  verifyFixtureApplicationUpdate,
} from '../support/fixture-application-update.mjs';

test('fixture RSA authenticates original ABF bytes, rejects production GUID and strict faults', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicExponent: 65537,
  });
  const keyId = 'fixture-only-test';
  const trustedKeys = { [keyId]: applicationPublicKeyXml(publicKey) };
  const description = {
    schemaVersion: 1,
    productId: FIXTURE_APPLICATION_UPDATE_PRODUCT_ID,
    channel: 'stable',
    os: 'windows',
    arch: 'x64',
    installProtocol: 1,
    releaseVersion: '1.0.6',
    buildVersion: '1.0.6.60001',
    releaseTag: 'v1.0.6',
    repo: APPLICATION_UPDATE.repo,
    assetName: 'TableMax-1.0.6-installer-win-x64.exe',
    assetUrl: `https://github.com/${APPLICATION_UPDATE.repo}/releases/download/v1.0.6/TableMax-1.0.6-installer-win-x64.exe`,
    bytes: 100,
    sha256: 'a'.repeat(64),
    payloadManifestSha256: 'b'.repeat(64),
    currentMappingSha256: 'c'.repeat(64),
  };
  const raw = Buffer.from(JSON.stringify(description, null, 2) + '\n');
  const envelope = signFixtureApplicationUpdate(raw, privateKey, { keyId });
  assert.ok(
    verify(
      'sha256',
      raw,
      { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
      Buffer.from(envelope.signature, 'base64'),
    ),
  );
  const actual = verifyFixtureApplicationUpdate(JSON.stringify(envelope), {
    trustedKeys,
  });
  assert.deepEqual(actual.description, description);
  assert.ok(actual.payload.equals(raw));
  const rejects = (callback, code) =>
    assert.throws(callback, (error) => error.code === code);
  rejects(
    () => verifyApplicationUpdate(envelope, { trustedKeys }),
    'unsupported-description',
  );
  const production = {
    ...description,
    productId: APPLICATION_UPDATE.productId,
  };
  rejects(
    () => signFixtureApplicationUpdate(production, privateKey, { keyId }),
    'fixture-product-id',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        signApplicationUpdate(production, privateKey, { keyId }),
        { trustedKeys },
      ),
    'fixture-product-id',
  );
  const tampered = {
    ...envelope,
    payload: Buffer.from(
      raw.toString('utf8').replace('"bytes": 100', '"bytes": 101'),
    ).toString('base64'),
  };
  rejects(
    () => verifyFixtureApplicationUpdate(tampered, { trustedKeys }),
    'invalid-signature',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        { ...envelope, algorithm: 'RSA3072-SHA256-PSS' },
        { trustedKeys },
      ),
    'unsupported-envelope',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        { ...envelope, extra: true },
        { trustedKeys },
      ),
    'envelope-fields',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        { ...envelope, payload: envelope.payload + '=' },
        { trustedKeys },
      ),
    'invalid-payload-base64',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        {
          ...envelope,
          payload: Buffer.alloc(
            APPLICATION_UPDATE.maxPayloadBytes + 1,
          ).toString('base64'),
        },
        { trustedKeys },
      ),
    'invalid-payload-base64',
  );
  const authenticated = (text) => ({
    ...envelope,
    payload: Buffer.from(text).toString('base64'),
    signature: sign('sha256', Buffer.from(text), {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING,
    }).toString('base64'),
  });
  const compact = JSON.stringify(description);
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        authenticated(
          compact.replace('"schemaVersion":1', '"schemaVersion":1e0'),
        ),
        { trustedKeys },
      ),
    'noncanonical-json-number',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        authenticated(
          compact.replace(
            '"schemaVersion":1',
            '"schemaVersion":1,"schemaVersion":1',
          ),
        ),
        { trustedKeys },
      ),
    'duplicate-json-field',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        authenticated(JSON.stringify({ ...description, extra: true })),
        { trustedKeys },
      ),
    'description-fields',
  );
  rejects(
    () =>
      verifyFixtureApplicationUpdate(
        JSON.stringify(envelope).replace(
          '"schemaVersion":1',
          '"schemaVersion":1,"schemaVersion":1',
        ),
        { trustedKeys },
      ),
    'duplicate-json-field',
  );
});
