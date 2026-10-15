import { constants, generateKeyPairSync, sign } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  APPLICATION_UPDATE,
  applicationPublicKeyXml,
  applicationUpdateMachineBlock,
  signApplicationUpdate,
} from '../../shared/application-update.mjs';
import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';

/** Test-only signing pair stays in memory; returned fixtures contain no private key. */
export function createApplicationUpdateTestVectors({
  numbersOnly = false,
} = {}) {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 3072,
    publicExponent: 65537,
  });
  const keyId = numbersOnly ? 'test-number-interop-v1' : 'test-interop-v1';
  const description = {
    schemaVersion: 1,
    productId: APPLICATION_UPDATE.productId,
    channel: 'stable',
    os: 'windows',
    arch: 'x64',
    installProtocol: 1,
    releaseVersion: '1.0.6',
    buildVersion: '1.0.6.12',
    releaseTag: 'v1.0.6',
    repo: APPLICATION_UPDATE.repo,
    assetName: 'TableMax-1.0.6-installer-win-x64.exe',
    assetUrl: `https://github.com/${APPLICATION_UPDATE.repo}/releases/download/v1.0.6/TableMax-1.0.6-installer-win-x64.exe`,
    bytes: 17,
    sha256: 'a'.repeat(64),
    payloadManifestSha256: 'b'.repeat(64),
    currentMappingSha256: 'c'.repeat(64),
  };
  const raw = JSON.stringify(description);
  const envelope = signApplicationUpdate(raw, privateKey, { keyId });
  const arbitrary = (payload) => ({
    ...envelope,
    payload: Buffer.from(payload).toString('base64'),
    signature: sign('sha256', Buffer.from(payload), {
      key: privateKey,
      padding: constants.RSA_PKCS1_PADDING,
    }).toString('base64'),
  });
  const cases = [
    ['valid', envelope, null],
    [
      'tampered-signature',
      { ...envelope, signature: Buffer.alloc(384).toString('base64') },
      'invalid-signature',
    ],
    [
      'algorithm-downgrade',
      { ...envelope, algorithm: 'RSA-SHA1' },
      'unsupported-envelope',
    ],
    [
      'protocol-downgrade',
      arbitrary(raw.replace('"installProtocol":1', '"installProtocol":0')),
      'unsupported-description',
    ],
    [
      'duplicate-payload-field',
      arbitrary(raw.replace('{', '{"schemaVersion":1,')),
      'duplicate-json-field',
    ],
    [
      'escaped-duplicate-payload-field',
      arbitrary(raw.replace('{', '{"\\u0073chemaVersion":1,')),
      'duplicate-json-field',
    ],
    [
      'unknown-payload-field',
      arbitrary(raw.replace('{', '{"unknown":true,')),
      'description-fields',
    ],
    [
      'invalid-utf8',
      arbitrary(Buffer.concat([Buffer.from(raw), Buffer.from([255])])),
      'invalid-utf8',
    ],
    [
      'release-build-mismatch',
      arbitrary(raw.replace('1.0.6.12', '1.0.7.12')),
      'asset-identity',
    ],
    [
      'foreign-product',
      arbitrary(
        raw.replace(
          APPLICATION_UPDATE.productId,
          '{AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA}',
        ),
      ),
      'unsupported-description',
    ],
  ];
  const numericCases = [
    [
      'rounded-schema-below-one',
      arbitrary(
        raw.replace('"schemaVersion":1', '"schemaVersion":0.99999999999999999'),
      ),
      'noncanonical-json-number',
    ],
    [
      'exponent-schema-one',
      arbitrary(raw.replace('"schemaVersion":1', '"schemaVersion":1e0')),
      'noncanonical-json-number',
    ],
    [
      'negative-zero-schema',
      arbitrary(raw.replace('"schemaVersion":1', '"schemaVersion":-0')),
      'noncanonical-json-number',
    ],
    [
      'unsafe-asset-bytes',
      arbitrary(raw.replace('"bytes":17', '"bytes":9007199254740993')),
      'unsafe-json-number',
    ],
    [
      'rounded-asset-bytes',
      arbitrary(raw.replace('"bytes":17', '"bytes":17.000000000000000001')),
      'noncanonical-json-number',
    ],
    [
      'decimal-install-protocol',
      arbitrary(raw.replace('"installProtocol":1', '"installProtocol":1.0')),
      'noncanonical-json-number',
    ],
  ];
  const selected = numbersOnly ? [cases[0], ...numericCases] : cases;
  const vectors = selected.map(([id, candidate, rejection]) => ({
    id,
    envelopeJson: JSON.stringify(candidate),
    body:
      '公开互操作测试向量，仅用于测试，不是受信发布密钥。\n\n' +
      applicationUpdateMachineBlock(candidate),
    expected: rejection ?? 'valid',
  }));
  vectors.push({
    id: 'duplicate-envelope-field',
    envelopeJson: JSON.stringify(envelope).replace('{', '{"schemaVersion":1,'),
    expected: 'duplicate-json-field',
  });
  if (numbersOnly) {
    for (const [id, token, expected] of [
      ['exponent-envelope', '1e0', 'noncanonical-json-number'],
      ['unsafe-envelope', '9007199254740993', 'unsafe-json-number'],
    ]) {
      const envelopeJson = JSON.stringify(envelope).replace(
        '"schemaVersion":1',
        '"schemaVersion":' + token,
      );
      vectors.push({
        id,
        envelopeJson,
        body: `<!-- ${APPLICATION_UPDATE.marker}:${Buffer.from(envelopeJson).toString('base64')} -->`,
        expected,
      });
    }
    vectors.push({
      id: 'one-valid-plus-unknown-machine-block',
      body:
        applicationUpdateMachineBlock(envelope) +
        '\n<!-- TABLEMAX-APPLICATION-UPDATE-V2:AQ== -->',
      expected: 'multiple-update-blocks',
    });
  }
  vectors.push({
    id: 'multiple-machine-blocks',
    body:
      applicationUpdateMachineBlock(envelope) +
      '\n' +
      applicationUpdateMachineBlock(envelope),
    expected: 'multiple-update-blocks',
  });
  return {
    format: 1,
    keyId,
    publicKeyXml: applicationPublicKeyXml(publicKey),
    description,
    vectors,
  };
}

if (isDirectExecution(import.meta.url)) {
  assertWorkspaceRoot();
  const output = process.argv
    .find((value) => value.startsWith('--out='))
    ?.slice(6);
  const numbersOnly = process.argv.includes('--numbers-only');
  if (!output || process.argv.length !== (numbersOnly ? 4 : 3))
    throw new Error('Expected one --out=<new-public-test-fixture.json>');
  await writeFile(
    resolve(output),
    JSON.stringify(
      createApplicationUpdateTestVectors({ numbersOnly }),
      null,
      2,
    ) + '\n',
    { flag: 'wx' },
  );
  console.log(
    'Public test vectors written; ephemeral private key was not exported.',
  );
}
