import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptanceExecutablePath,
  materializeAcceptanceExecutable,
  validateWindowsAcceptanceContext,
} from './windows-acceptance-profile.mjs';

function fixture() {
  const ownerSid = 'S-1-5-21-111-222-333-1001';
  const token = (pid) => ({
    pid,
    ownerSid,
    elevated: false,
    integritySid: 'S-1-16-8192',
  });
  const root =
    'C:\\Users\\TMVerify_1234abcd\\AppData\\Local\\TableMaxAcceptance\\0123456789abcdef0123456789abcdef';
  return {
    root,
    configuredParent: root + '\\work',
    expectedSid: ownerSid,
    isolated: '1',
    nodePid: 1234,
    inspectorPid: 2345,
    identity: {
      ownerSid,
      accountName: 'MACHINE\\TMVerify_1234abcd',
      machineName: 'MACHINE',
      elevated: false,
      profile: 'C:\\Users\\TMVerify_1234abcd',
      localAppData: 'C:\\Users\\TMVerify_1234abcd\\AppData\\Local',
      node: token(1234),
      inspector: token(2345),
    },
  };
}

test('pure acceptance context binds actual identity, local folder, work and Medium process tokens', () => {
  const input = fixture(),
    profile = validateWindowsAcceptanceContext(input);
  assert.equal(profile.root, input.root);
  assert.equal(profile.workParent, input.configuredParent);
  assert.equal(profile.ownerSid, input.expectedSid);
  assert.equal(profile.integritySid, 'S-1-16-8192');
  assert.ok(Object.isFrozen(profile));
});

test('pure acceptance context rejects personal, elevated, mismatched and nonlocal identities', () => {
  const cases = [
    (x) => {
      x.isolated = '0';
    },
    (x) => {
      x.expectedSid = undefined;
    },
    (x) => {
      x.expectedSid = 'S-1-5-21-111-222-333-500';
    },
    (x) => {
      x.identity.ownerSid = 'S-1-5-21-111-222-333-1002';
    },
    (x) => {
      x.identity.elevated = true;
    },
    (x) => {
      x.identity.accountName = 'MACHINE\\Personal';
    },
    (x) => {
      x.identity.accountName = 'OTHER\\TMVerify_1234abcd';
    },
    (x) => {
      x.identity.profile = 'C:\\Users\\Personal';
    },
    (x) => {
      x.identity.localAppData = 'C:\\Users\\Personal\\AppData\\Local';
    },
  ];
  for (const change of cases) {
    const input = fixture();
    change(input);
    assert.throws(() => validateWindowsAcceptanceContext(input));
  }
});

test('pure acceptance paths reject root escape, aliases and wrong configured parents', () => {
  for (const root of [
    '\\\\server\\share',
    '\\\\?\\C:\\Users\\test',
    'C:\\Users\\x\\..\\y',
    fixture().root + ':stream',
    fixture().root + ' ',
    fixture().root + '0',
  ]) {
    assert.throws(() =>
      validateWindowsAcceptanceContext({ ...fixture(), root }),
    );
  }
  for (const suffix of ['\\other', '\\work\\child', '\\work\\..\\work']) {
    const input = fixture();
    input.configuredParent = input.root + suffix;
    assert.throws(() => validateWindowsAcceptanceContext(input));
  }
});

test('pure acceptance tokens reject Low, High, MediumPlus, wrong PID/SID or administrator tokens', () => {
  for (const role of ['node', 'inspector']) {
    for (const integritySid of ['S-1-16-4096', 'S-1-16-12288', 'S-1-16-8448']) {
      const input = fixture();
      input.identity[role].integritySid = integritySid;
      assert.throws(() => validateWindowsAcceptanceContext(input));
    }
    for (const change of [
      (token) => {
        token.pid++;
      },
      (token) => {
        token.ownerSid += '0';
      },
      (token) => {
        token.elevated = true;
      },
    ]) {
      const input = fixture();
      change(input.identity[role]);
      assert.throws(() => validateWindowsAcceptanceContext(input));
    }
  }
});

test('pure executable paths allow owned descendants and reject sibling prefixes, devices and nonbasenames', () => {
  const profile = validateWindowsAcceptanceContext(fixture());
  assert.equal(
    acceptanceExecutablePath(
      profile,
      profile.workParent + '\\case\\inputs',
      'TableMax-new-fixture.exe',
    ),
    profile.workParent + '\\case\\inputs\\TableMax-new-fixture.exe',
  );
  assert.throws(() =>
    acceptanceExecutablePath(profile, profile.root + '-other', 'TableMax.exe'),
  );
  for (const name of [
    '..\\TableMax.exe',
    'C:\\TableMax.exe',
    'TableMax.exe:stream',
    'CON.exe',
    'LPT1.exe',
    'TableMax.cmd',
    'TableMax.exe ',
  ]) {
    assert.throws(() =>
      acceptanceExecutablePath(profile, profile.workParent, name),
    );
  }
});

test('a pure validated object cannot authorize materialization or any source read', async () => {
  const profile = validateWindowsAcceptanceContext(fixture());
  await assert.rejects(
    materializeAcceptanceExecutable({
      source: 'C:\\does-not-exist\\source.exe',
      expected: { bytes: 1, sha256: '0'.repeat(64) },
      profile,
      directory: profile.workParent,
      name: 'copy.exe',
    }),
    /actual resolved/,
  );
});
