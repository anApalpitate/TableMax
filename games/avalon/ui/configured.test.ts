import { createElement } from 'react';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
import { client, clientsByVariant } from '../web';
import { avalonRulebookFor } from './RulesGuide';
import { fixture } from '../rules/test-fixtures';
import { project } from '../rules/project';
const { renderToStaticMarkup } = createRequire(
  new URL('../../../apps/web/package.json', import.meta.url),
)('react-dom/server');
it('exports the configured web entry and renders all six public configurations with the current row', () => {
  expect(clientsByVariant.configured).toBe(client);
  const view = project(fixture('configured', 10), { role: 'public' });
  const before = structuredClone(view);
  const chapter = avalonRulebookFor(view).chapters.find(
    (chapter) => chapter.id === 'av-roles',
  )!;
  const markup = renderToStaticMarkup(
    createElement('div', null, chapter.content),
  );
  expect(markup.match(/data-current=/g)).toHaveLength(6);
  expect(markup).toContain('10 人');
  expect(markup).toContain('本局');
  expect(markup).toContain('莫德雷德');
  expect(markup).toContain('奥伯伦');
  expect(view).toEqual(before);
  expect(view.self).toBeNull();
});
it('restored old matches show their own configuration instead of the new table', () => {
  for (const variant of ['classic', 'court'] as const) {
    const view = project(fixture(variant), { role: 'public' });
    const chapter = avalonRulebookFor(view).chapters.find(
      (chapter) => chapter.id === 'av-roles',
    )!;
    const markup = renderToStaticMarkup(
      createElement('div', null, chapter.content),
    );
    expect(markup).toContain('本局恢复自旧配置');
    expect(markup).not.toContain('av-rule-configurations');
    expect(markup.includes('宫廷迷局')).toBe(variant === 'court');
  }
});
