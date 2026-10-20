import test from 'node:test';
import assert from 'node:assert/strict';
import { compatibleModule } from './compatibility.mjs';
test('capability contract refuses old hosts, unknown capabilities and invalid declarations', () => {
  const old = { sdk: 1, protocol: 7, webHost: 1 };
  const current = {
    ...old,
    protocol: 8,
    requiredCapabilities: ['concurrent-secret-actions'],
  };
  assert.equal(compatibleModule(old), true);
  assert.equal(compatibleModule(current), true);
  assert.equal(compatibleModule(current, []), false);
  assert.equal(compatibleModule({ ...current, protocol: 7 }), false);
  assert.equal(
    compatibleModule({ ...current, requiredCapabilities: ['unavailable'] }),
    false,
  );
  assert.equal(
    compatibleModule({
      ...current,
      requiredCapabilities: ['web-details', 'web-details'],
    }),
    false,
  );
});

test('deadline games cannot load into a host without saved automatic timing', () => {
  const game = {
    sdk: 1,
    protocol: 8,
    webHost: 1,
    requiredCapabilities: ['saved-game-deadlines'],
  };
  assert.equal(compatibleModule(game), true);
  assert.equal(
    compatibleModule(game, [
      'concurrent-secret-actions',
      'saved-release-restore',
      'retired-variants',
      'web-details',
    ]),
    false,
  );
});
