import { expect, it } from 'vitest';
import { randomId } from './randomId';

it('creates action and admission identifiers without secure-context-only randomUUID', () => {
  const insecureCrypto = {
    getRandomValues: crypto.getRandomValues.bind(crypto),
  };
  const action = randomId(16, insecureCrypto);
  const admission = randomId(32, insecureCrypto);
  expect(action).toMatch(/^[0-9a-f]{32}$/);
  expect(admission).toMatch(/^[0-9a-f]{64}$/);
  expect(randomId(16, insecureCrypto)).not.toBe(action);
});
