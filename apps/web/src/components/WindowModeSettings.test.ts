import { createElement, type ReactNode } from 'react';
import { createRequire } from 'node:module';
import { afterEach, expect, it, vi } from 'vitest';
import { WindowModeSettings } from './WindowModeSettings';

const { renderToStaticMarkup } = createRequire(
  new URL('../../package.json', import.meta.url),
)('react-dom/server') as { renderToStaticMarkup(node: ReactNode): string };

afterEach(() => vi.unstubAllGlobals());

function render(supported: boolean) {
  const target = {
    fullscreenEnabled: supported,
    documentElement: { requestFullscreen: supported ? vi.fn() : undefined },
  };
  vi.stubGlobal('window', { top: { document: target } });
  vi.stubGlobal('navigator', { userAgent: 'Android Mobile' });
  return renderToStaticMarkup(createElement(WindowModeSettings));
}

it('offers standard fullscreen to a capable phone browser without native modes', () => {
  const markup = render(true);
  expect(markup).toContain('显示模式');
  expect(markup).toContain('<option value="fullscreen">全屏</option>');
  expect(markup).not.toContain('disabled=""');
  expect(markup).not.toContain('borderless');
});

it('retains an understandable disabled fullscreen setting on unsupported phones', () => {
  const markup = render(false);
  expect(markup).toContain('显示模式');
  expect(markup).toContain('<option value="fullscreen">全屏</option>');
  expect(markup).toContain('disabled=""');
  expect(markup).toContain('当前浏览器不支持全屏');
});
