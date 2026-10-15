import { failureLimit } from '../test/runner/failure-policy.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { constants, createHash, generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import {
  APPLICATION_UPDATE,
  APPLICATION_UPDATE_TRUST,
  ApplicationUpdateError,
  applicationPublicKeyXml,
  applicationUpdateDecision,
  applicationUpdateMachineBlock,
  compareApplicationVersions,
  downloadApplicationUpdate,
  extractApplicationUpdate,
  parseApplicationVersion,
  parseStrictJson,
  signApplicationUpdate,
  validateApplicationDownloadUrl,
  validateApplicationUpdateDescription,
  verifyApplicationUpdate,
  verifyGitHubRelease,
} from './application-update.mjs';
import { signApplicationUpdateFiles } from '../release/sign-application-update.mjs';

const vectors = JSON.parse(
  await readFile(
    new URL(
      '../test/installation/application-update-vectors.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const trustedKeys = { [vectors.keyId]: vectors.publicKeyXml };
const numberVectors = JSON.parse(
  await readFile(
    new URL(
      '../test/installation/application-update-number-vectors.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const original = vectors.description;
const limit = failureLimit();
let failures = 0;
function check(name, callback) {
  test(name, { concurrency: false }, async (context) => {
    if (failures >= limit) {
      context.skip(`Round stopped after ${limit} failures; no automatic retry`);
      return;
    }
    try {
      await callback(context);
    } catch (error) {
      failures++;
      throw error;
    }
  });
}
const rejects = (operation, code) =>
  assert.throws(
    operation,
    (error) => error instanceof ApplicationUpdateError && error.code === code,
  );
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

check(
  'only the exact public installer asset name and matching URL are accepted',
  () => {
    assert.equal(
      validateApplicationUpdateDescription(original).assetName,
      `TableMax-${original.releaseVersion}-installer-win-x64.exe`,
    );
    for (const assetName of [
      `TableMax-${original.releaseVersion}-win-x64.exe`,
      `TableMax-${original.releaseVersion}-win-x64-box.exe`,
      `TableMax-${original.buildVersion}-installer-win-x64.exe`,
      `TableMax-${original.releaseVersion}-installer-win-x64-copy.exe`,
      `../TableMax-${original.releaseVersion}-installer-win-x64.exe`,
    ]) {
      rejects(
        () =>
          validateApplicationUpdateDescription({
            ...original,
            assetName,
            assetUrl: `https://github.com/${original.repo}/releases/download/${original.releaseTag}/${assetName}`,
          }),
        'asset-identity',
      );
    }
  },
);

check(
  'fixed public RSA3072 vectors accept authenticated original bytes and reject signed malformed payloads',
  () => {
    for (const vector of vectors.vectors) {
      const operation = () => {
        const envelope = vector.body
          ? extractApplicationUpdate(vector.body).envelope
          : vector.envelopeJson;
        return verifyApplicationUpdate(envelope, { trustedKeys });
      };
      if (vector.expected === 'valid')
        assert.deepEqual(operation().description, original);
      else rejects(operation, vector.expected);
    }
  },
);

check(
  'signed numeric tokens reject rounding, exponent, negative zero and unsafe integers without restricting generic JSON',
  () => {
    const numericTrust = { [numberVectors.keyId]: numberVectors.publicKeyXml };
    for (const vector of numberVectors.vectors) {
      const paths = [];
      if (vector.envelopeJson)
        paths.push(() =>
          verifyApplicationUpdate(vector.envelopeJson, {
            trustedKeys: numericTrust,
          }),
        );
      if (vector.body)
        paths.push(() =>
          verifyApplicationUpdate(
            extractApplicationUpdate(vector.body).envelope,
            { trustedKeys: numericTrust },
          ),
        );
      for (const operation of paths) {
        if (vector.expected === 'valid')
          assert.deepEqual(operation().description, numberVectors.description);
        else rejects(operation, vector.expected);
      }
    }
    const general = parseStrictJson(
      '{"unrelated":0.5,"exponent":1e0,"negativeZero":-0}',
    );
    assert.equal(general.unrelated, 0.5);
    assert.equal(general.exponent, 1);
    assert.equal(Object.is(general.negativeZero, -0), true);
    for (const token of ['0.99999999999999999', '1e0', '-0', '1.0']) {
      rejects(
        () =>
          parseStrictJson('{"schemaVersion":' + token + '}', 8192, {
            canonicalIntegers: true,
          }),
        'noncanonical-json-number',
      );
      rejects(
        () =>
          signApplicationUpdate(
            JSON.stringify(original).replace(
              '"schemaVersion":1',
              '"schemaVersion":' + token,
            ),
            null,
            { keyId: 'number-test' },
          ),
        'noncanonical-json-number',
      );
    }
    rejects(
      () =>
        parseStrictJson('{"bytes":9007199254740993}', 8192, {
          canonicalIntegers: true,
        }),
      'unsafe-json-number',
    );
  },
);

check(
  'raw UTF8 payload, trust root separation, fixed algorithm and padding are enforced',
  () => {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 3072,
    });
    const keyId = 'ephemeral-test';
    const raw = JSON.stringify(original, null, 2) + '\r\n';
    const envelope = signApplicationUpdate(raw, privateKey, { keyId });
    rejects(
      () => signApplicationUpdate(raw, privateKey, { keyId: 123 }),
      'invalid-key-id',
    );
    rejects(
      () =>
        verifyApplicationUpdate(
          { ...envelope, keyId: [keyId] },
          { trustedKeys: { [keyId]: publicKey } },
        ),
      'unsupported-envelope',
    );
    assert.deepEqual(Object.keys(APPLICATION_UPDATE_TRUST), [
      'tablemax-rsa-2026-01',
    ]);
    rejects(() => verifyApplicationUpdate(envelope), 'untrusted-key');
    const result = verifyApplicationUpdate(envelope, {
      trustedKeys: { [keyId]: applicationPublicKeyXml(publicKey) },
    });
    assert.equal(result.payload.toString('utf8'), raw);
    assert.equal(result.descriptionSha256, hash(Buffer.from(raw)));
    rejects(
      () => verifyApplicationUpdate(envelope, { trustedKeys }),
      'untrusted-key',
    );
    rejects(
      () =>
        verifyApplicationUpdate(
          { ...envelope, algorithm: 'RSA3072-SHA256-PSS' },
          { trustedKeys: { [keyId]: publicKey } },
        ),
      'unsupported-envelope',
    );
    rejects(
      () =>
        verifyApplicationUpdate(
          { ...envelope, payload: Buffer.from(raw.trim()).toString('base64') },
          { trustedKeys: { [keyId]: publicKey } },
        ),
      'invalid-signature',
    );
    const pss = sign('sha256', Buffer.from(raw), {
      key: privateKey,
      padding: constants.RSA_PKCS1_PSS_PADDING,
    });
    rejects(
      () =>
        verifyApplicationUpdate(
          { ...envelope, signature: pss.toString('base64') },
          { trustedKeys: { [keyId]: publicKey } },
        ),
      'invalid-signature',
    );
    const weak = generateKeyPairSync('rsa', { modulusLength: 2048 });
    rejects(
      () => signApplicationUpdate(original, weak.privateKey, { keyId }),
      'invalid-public-key',
    );
    const otherAlgorithm = generateKeyPairSync('ed25519');
    rejects(
      () =>
        signApplicationUpdate(original, otherAlgorithm.privateKey, { keyId }),
      'invalid-public-key',
    );
  },
);

check(
  'strict JSON, Base64, input lengths and a single machine block reject parser ambiguity',
  () => {
    for (const text of ['{"a":1,"a":2}', '{"a":1,"\\u0061":2}'])
      rejects(() => parseStrictJson(text), 'duplicate-json-field');
    for (const text of [
      '{} {}',
      '{"a":1,}',
      '[1,]',
      '{"a":01}',
      '{"a":NaN}',
      '{"a":"\\x00"}',
      '\u00a0{}',
    ])
      rejects(() => parseStrictJson(text), 'invalid-json');
    rejects(
      () => parseStrictJson('['.repeat(18) + '0' + ']'.repeat(18)),
      'json-too-deep',
    );
    rejects(() => parseStrictJson(Buffer.from([255])), 'invalid-utf8');
    rejects(() => parseStrictJson('\ufeff{}'), 'utf8-bom');
    rejects(() => parseStrictJson(' '.repeat(8193)), 'input-too-long');
    const envelope = JSON.parse(vectors.vectors[0].envelopeJson);
    for (const payload of [
      envelope.payload.slice(0, -1),
      envelope.payload + '\n',
    ])
      rejects(
        () =>
          verifyApplicationUpdate({ ...envelope, payload }, { trustedKeys }),
        'invalid-payload-base64',
      );
    rejects(
      () =>
        verifyApplicationUpdate(
          { ...envelope, signature: Buffer.alloc(385).toString('base64') },
          { trustedKeys },
        ),
      'invalid-signature-base64',
    );
    rejects(
      () =>
        verifyApplicationUpdate({ ...envelope, extra: true }, { trustedKeys }),
      'envelope-fields',
    );
    rejects(
      () => extractApplicationUpdate('Human release notes'),
      'missing-update-description',
    );
    rejects(
      () =>
        extractApplicationUpdate(
          'x'.repeat(APPLICATION_UPDATE.maxBodyBytes + 1),
        ),
      'input-too-long',
    );
    rejects(
      () =>
        extractApplicationUpdate(
          applicationUpdateMachineBlock(envelope).replace('-V1:', '-V2:'),
        ),
      'invalid-update-block',
    );
    const extracted = extractApplicationUpdate(
      '更新说明\n\n' + applicationUpdateMachineBlock(envelope) + '\n',
    );
    assert.equal(extracted.notes, '更新说明');
  },
);

check(
  'numeric four-part versions and both installed/high-water identities reject downgrade and substituted bytes',
  () => {
    assert.equal(compareApplicationVersions('1.0.6.12', '1.0.6.9'), 1);
    assert.equal(compareApplicationVersions('1.0.10.1', '1.0.9.65534'), 1);
    for (const version of [
      '1.0.6',
      '1.0.6.01',
      '1.0.6.65535',
      '2.0.0.1',
      '1.0.-1.0',
      '1.0.6.1.0',
    ])
      rejects(() => parseApplicationVersion(version), 'invalid-version');
    assert.equal(
      applicationUpdateDecision(original, {
        current: { buildVersion: '1.0.6.9', sha256: 'd'.repeat(64) },
      }),
      'upgrade',
    );
    assert.equal(
      applicationUpdateDecision(original, { current: original }),
      'current',
    );
    rejects(
      () =>
        applicationUpdateDecision(original, {
          current: { ...original, buildVersion: '1.0.6.13' },
        }),
      'version-downgrade',
    );
    rejects(
      () =>
        applicationUpdateDecision(original, {
          current: { ...original, buildVersion: '1.0.6.9' },
          highestAccepted: { ...original, buildVersion: '1.0.6.13' },
        }),
      'version-downgrade',
    );
    for (const field of [
      'sha256',
      'payloadManifestSha256',
      'currentMappingSha256',
    ])
      rejects(
        () =>
          applicationUpdateDecision(original, {
            highestAccepted: { ...original, [field]: 'd'.repeat(64) },
          }),
        'same-version-different-bytes',
      );
    for (const [field, value] of [
      ['schemaVersion', 0],
      ['installProtocol', 0],
      ['installProtocol', 2],
      ['channel', 'preview'],
      ['os', 'linux'],
      ['arch', 'arm64'],
      ['productId', 'TableMax'],
    ])
      rejects(
        () =>
          validateApplicationUpdateDescription({ ...original, [field]: value }),
        'unsupported-description',
      );
    rejects(
      () =>
        validateApplicationUpdateDescription({ ...original, bytes: 120000000 }),
      'asset-integrity-fields',
    );
    rejects(
      () =>
        validateApplicationUpdateDescription({
          ...original,
          buildVersion: '1.0.7.12',
        }),
      'asset-identity',
    );
  },
);

const releaseFixture = () => ({
  id: 41,
  draft: false,
  prerelease: false,
  tag_name: original.releaseTag,
  html_url: `https://github.com/${APPLICATION_UPDATE.repo}/releases/tag/${original.releaseTag}`,
  assets: [
    {
      id: 42,
      name: original.assetName,
      size: original.bytes,
      state: 'uploaded',
      browser_download_url: original.assetUrl,
      digest: 'sha256:' + original.sha256,
    },
    {
      id: 43,
      name: `TableMax-${original.releaseVersion}-source.zip`,
      size: 37,
      state: 'uploaded',
      browser_download_url: `https://github.com/${APPLICATION_UPDATE.repo}/releases/download/${original.releaseTag}/TableMax-${original.releaseVersion}-source.zip`,
    },
  ],
});
check(
  'GitHub stable tag and exactly EXE/sourceZIP assets remain bound through check/download selection',
  () => {
    assert.equal(verifyGitHubRelease(releaseFixture(), original).assetId, 42);
    for (const mutate of [
      (release) => {
        release.draft = true;
      },
      (release) => {
        release.prerelease = true;
      },
      (release) => {
        release.tag_name = 'v1.0.5';
      },
      (release) => {
        release.assets.push({ ...release.assets[0], id: 44 });
      },
    ]) {
      const release = releaseFixture();
      mutate(release);
      rejects(
        () => verifyGitHubRelease(release, original),
        'github-release-identity',
      );
    }
    for (const mutate of [
      (release) => {
        release.assets[1] = { ...release.assets[0], id: 44 };
      },
      (release) => {
        release.assets[1].id = 42;
      },
      (release) => {
        release.assets[0].state = 'new';
      },
    ]) {
      const release = releaseFixture();
      mutate(release);
      rejects(() => verifyGitHubRelease(release, original), 'github-assets');
    }
    for (const [field, value] of [
      ['size', original.bytes + 1],
      ['digest', 'sha256:' + 'd'.repeat(64)],
      [
        'browser_download_url',
        'https://github.com/other/repository/releases/download/v1.0.6/installer.exe',
      ],
    ]) {
      const release = releaseFixture();
      release.assets[0][field] = value;
      rejects(
        () => verifyGitHubRelease(release, original),
        'github-asset-mismatch',
      );
    }
  },
);

check(
  'official HTTPS redirect allowlist is bounded and rejects URL/parser tricks',
  () => {
    assert.equal(
      validateApplicationDownloadUrl(original.assetUrl, original),
      original.assetUrl,
    );
    const final =
      'https://release-assets.githubusercontent.com/github-production-release-asset/123/abc-def?sv=1&sig=test';
    assert.equal(validateApplicationDownloadUrl(final, original, 1), final);
    for (const url of [
      'http://github.com/x',
      'https://github.com.evil.test/x',
      'https://github.com@evil.test/x',
      'https://release-assets.githubusercontent.com.evil.test/github-production-release-asset/123/a',
      'https://release-assets.githubusercontent.com:444/github-production-release-asset/123/a',
      'https://release-assets.githubusercontent.com/github-production-release-asset/123/a#fragment',
      'https://objects.githubusercontent.com/github-production-release-asset/123/a',
      'https://release-assets.githubusercontent.com/other/123/a',
    ])
      rejects(
        () => validateApplicationDownloadUrl(url, original, 1),
        'download-url',
      );
    rejects(
      () => validateApplicationDownloadUrl(final, original, 0),
      'download-url',
    );
    rejects(
      () => validateApplicationDownloadUrl(final, original, 4),
      'download-url',
    );
  },
);

check(
  'streaming candidate faults reject partial/excess/tampered bodies, redirect cycles, HTTP failure and cancellation',
  async () => {
    const bytes = Buffer.from('installer-fixture');
    const description = {
      ...original,
      bytes: bytes.length,
      sha256: hash(bytes),
    };
    const final =
      'https://release-assets.githubusercontent.com/github-production-release-asset/123/abc-def?sig=test';
    const progress = [];
    const result = await downloadApplicationUpdate(description, {
      fetchImpl: async (url, options) => {
        assert.equal(options.redirect, 'manual');
        return url === description.assetUrl
          ? new Response(null, { status: 302, headers: { location: final } })
          : new Response(bytes, {
              headers: { 'content-length': String(bytes.length) },
            });
      },
      onProgress: (entry) => progress.push(entry),
    });
    assert.deepEqual(result.bytes, bytes);
    assert.equal(result.sha256, description.sha256);
    assert.equal(progress.at(-1).received, bytes.length);
    const expected = (code) => (error) =>
      error instanceof ApplicationUpdateError && error.code === code;
    for (const [body, code] of [
      [bytes.subarray(1), 'download-too-short'],
      [Buffer.concat([bytes, Buffer.from('x')]), 'download-too-long'],
      [Buffer.alloc(bytes.length), 'download-sha256'],
    ])
      await assert.rejects(
        downloadApplicationUpdate(description, {
          fetchImpl: async () => new Response(body),
        }),
        expected(code),
      );
    await assert.rejects(
      downloadApplicationUpdate(description, {
        fetchImpl: async () =>
          new Response(bytes, { headers: { 'content-length': '999' } }),
      }),
      expected('download-length'),
    );
    await assert.rejects(
      downloadApplicationUpdate(description, {
        fetchImpl: async () => new Response(null, { status: 503 }),
      }),
      expected('download-status'),
    );
    await assert.rejects(
      downloadApplicationUpdate(description, {
        fetchImpl: async () =>
          new Response(null, {
            status: 302,
            headers: { location: description.assetUrl },
          }),
      }),
      expected('redirect-cycle'),
    );
    let redirects = 0;
    await assert.rejects(
      downloadApplicationUpdate(description, {
        fetchImpl: async () =>
          new Response(null, {
            status: 302,
            headers: { location: final + '&n=' + ++redirects },
          }),
      }),
      expected('too-many-redirects'),
    );
    await assert.rejects(
      downloadApplicationUpdate(description, {
        fetchImpl: async () =>
          new Response(null, {
            status: 302,
            headers: { location: 'http://evil.test/installer.exe' },
          }),
      }),
      expected('download-url'),
    );
    const cancel = new AbortController();
    let cancelled = false;
    await assert.rejects(
      downloadApplicationUpdate(description, {
        signal: cancel.signal,
        fetchImpl: async () =>
          new Response(
            new ReadableStream({
              start() {
                setTimeout(() => cancel.abort(new Error('test-cancel')), 5);
              },
              cancel() {
                cancelled = true;
              },
            }),
          ),
      }),
      /test-cancel/,
    );
    assert.equal(cancelled, true);
  },
);

check(
  'signing files use private environment and create reviewed machine body without overwrite or secret output',
  async () => {
    const work = await mkdtemp(resolve('tmp/application-update-signing-'));
    const { privateKey, publicKey } = generateKeyPairSync('rsa', {
      modulusLength: 3072,
    });
    const description = join(work, 'description.json');
    const notes = join(work, 'notes.md');
    const output = join(work, 'signed-notes.md');
    await writeFile(description, JSON.stringify(original));
    await writeFile(notes, '人工说明\n');
    const environment = {
      TABLEMAX_APPLICATION_UPDATE_KEY_ID: 'ephemeral-files',
      TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY: privateKey.export({
        type: 'pkcs8',
        format: 'pem',
      }),
    };
    const args = [
      `--description=${description}`,
      `--notes=${notes}`,
      `--out=${output}`,
    ];
    const verification = { trustedKeys: { 'ephemeral-files': publicKey } };
    const result = await signApplicationUpdateFiles(
      args,
      environment,
      verification,
    );
    const body = await readFile(output, 'utf8');
    assert.equal(body.includes('PRIVATE KEY'), false);
    assert.equal(
      Object.keys(result).some((key) => /private|secret/i.test(key)),
      false,
    );
    assert.deepEqual(
      verifyApplicationUpdate(extractApplicationUpdate(body).envelope, {
        trustedKeys: { 'ephemeral-files': publicKey },
      }).description,
      original,
    );
    await assert.rejects(
      signApplicationUpdateFiles(args, environment, verification),
      (error) => error.code === 'EEXIST',
    );
    rejects(
      () => parseStrictJson('{"__proto__":{},"__proto__":{}}'),
      'duplicate-json-field',
    );
    await assert.rejects(
      signApplicationUpdateFiles(args, {}),
      (error) => error.code === 'private-key-source',
    );
    const privateFile = join(work, 'ephemeral-private.pem');
    const fileOutput = join(work, 'file-key-notes.md');
    await writeFile(
      privateFile,
      privateKey.export({ type: 'pkcs8', format: 'pem' }),
      { flag: 'wx', mode: 0o600 },
    );
    try {
      await signApplicationUpdateFiles(
        [
          `--description=${description}`,
          `--notes=${notes}`,
          `--out=${fileOutput}`,
        ],
        {
          TABLEMAX_APPLICATION_UPDATE_KEY_ID: 'ephemeral-files',
          TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY_FILE: privateFile,
        },
        verification,
      );
      const fileBody = await readFile(fileOutput, 'utf8');
      assert.deepEqual(
        verifyApplicationUpdate(
          extractApplicationUpdate(fileBody).envelope,
          verification,
        ).description,
        original,
      );
      await assert.rejects(
        signApplicationUpdateFiles(
          args,
          {
            ...environment,
            TABLEMAX_APPLICATION_UPDATE_PRIVATE_KEY_FILE: privateFile,
          },
          verification,
        ),
        (error) => error.code === 'private-key-source',
      );
    } finally {
      await unlink(privateFile);
    }
    await assert.rejects(
      signApplicationUpdateFiles(
        [...args, '--private-key=forbidden'],
        environment,
      ),
      (error) => error.code === 'signing-arguments',
    );
  },
);
