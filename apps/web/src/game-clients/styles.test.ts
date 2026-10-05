import { afterEach, expect, it, vi } from 'vitest';
import { loadGameStyle } from './styles';
afterEach(() => vi.unstubAllGlobals());
it('both variants wait for shared CSS and both reject its failure; retry creates a new request', async () => {
  const links: {
    onload: () => void;
    onerror: () => void;
    remove: () => void;
    dataset: Record<string, string>;
  }[] = [];
  vi.stubGlobal('document', {
    createElement: () => ({ dataset: {}, remove: vi.fn() }),
    head: { append: (link: (typeof links)[number]) => links.push(link) },
  });
  const url = new URL(
    'https://tablemax.test/games/sample/web/style-shared.css',
  );
  const original = loadGameStyle(url),
    expansion = loadGameStyle(url);
  expect(original).toBe(expansion);
  expect(links).toHaveLength(1);
  const failures = Promise.allSettled([original, expansion]);
  links[0]!.onerror();
  expect((await failures).map((result) => result.status)).toEqual([
    'rejected',
    'rejected',
  ]);
  expect(links[0]!.remove).toHaveBeenCalledOnce();
  const retry = loadGameStyle(url);
  expect(links).toHaveLength(2);
  links[1]!.onload();
  await expect(retry).resolves.toBeUndefined();
  await expect(loadGameStyle(url)).resolves.toBeUndefined();
  expect(links).toHaveLength(2);
});
