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
