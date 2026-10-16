export const SETTINGS_VIEWPORTS = [
  { width: 320, height: 568, density: 1, label: '320' },
  { width: 390, height: 844, density: 1, label: '390' },
  { width: 960, height: 540, density: 1, label: '960x540' },
  { width: 1280, height: 720, density: 1, label: '720p' },
  { width: 1920, height: 1080, density: 1, label: '1080p' },
  { width: 3840, height: 2160, density: 1, label: '4k' },
  { width: 1536, height: 864, density: 1.25, label: '125pct' },
  { width: 1280, height: 720, density: 1.5, label: '150pct' },
];

// Passed directly to Playwright evaluate; keep browser measurements self-contained.
export function measureSettingsLayout({ header = false } = {}) {
  const root = header
    ? document.querySelector('.box-screen > header')
    : [...document.querySelectorAll('dialog[open].settings-panel')].at(-1);
  if (!root) throw new Error('Expected a real rendered settings surface');
  const issues = [];
  const rectOf = (element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  };
  const shown = (element) =>
    element.getClientRects().length > 0 &&
    element.checkVisibility({ checkVisibilityCSS: true });
  const within = (inner, outer, vertical = true) =>
    inner.left >= outer.left - 2 &&
    inner.right <= outer.right + 2 &&
    (!vertical ||
      (inner.top >= outer.top - 2 && inner.bottom <= outer.bottom + 2));
  const describe = (element) =>
    (element.getAttribute('aria-label') || element.textContent)
      .trim()
      .slice(0, 100);
  const frameSelector = [
    'button',
    '.application-update__versions',
    '.application-update__notes',
    '.application-update__error',
    '.display-settings-choice',
    '.display-settings-current',
    '.display-settings-error',
    '.beginner-guidance-setting',
    '.countdown-settings',
    '.countdown-settings__saved',
    'output',
  ].join(',');
  const scope = header ? root.querySelector('.header-status') : root;
  if (!scope) throw new Error('Settings header status group is missing');
  let textFrameChecks = 0;
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const element = node.parentElement;
    if (
      !node.textContent.trim() ||
      !shown(element) ||
      element.closest('svg, option, script, style')
    )
      continue;
    if (header && !element.closest('.icon-label-control')) continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const textRects = [...range.getClientRects()].filter(
      (rect) => rect.width > 0 && rect.height > 0,
    );
    const font = parseFloat(getComputedStyle(element).fontSize);
    if (font < 15.9)
      issues.push({
        kind: 'settings-small-text',
        text: describe(element),
        font,
      });
    const frames = [];
    for (
      let ancestor = element;
      ancestor && root.contains(ancestor);
      ancestor = ancestor.parentElement
    )
      if (ancestor.matches(frameSelector) || ancestor === root)
        frames.push(ancestor);
    for (const frame of frames) {
      const box = rectOf(frame);
      // Content below the inner scrollport is intentional; its own card and
      // control still need to enclose every rendered text line vertically.
      const vertical =
        frame !== root || !element.closest('.box-overlay-panel__content');
      textFrameChecks += textRects.length;
      if (textRects.some((rect) => !within(rect, box, vertical)))
        issues.push({
          kind: 'settings-text-outside-frame',
          text: node.textContent.trim().slice(0, 100),
          frame: frame.className || frame.tagName,
          frameBounds: box,
          textBounds: textRects.map((rect) => ({
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
          })),
        });
    }
  }
  const controls = [
    ...scope.querySelectorAll(
      header ? '.icon-label-control' : 'button, select, input, a[href]',
    ),
  ]
    .filter(shown)
    .map((element) => {
      const bounds = rectOf(element);
      if (bounds.width < 43.5 || bounds.height < 43.5)
        issues.push({
          kind: 'settings-small-control',
          text: describe(element),
          ...bounds,
        });
      if (element.scrollWidth > element.clientWidth + 2)
        issues.push({
          kind: 'settings-control-overflow',
          text: describe(element),
          ...bounds,
        });
      const frame = element.parentElement.closest(frameSelector);
      if (frame && root.contains(frame) && !within(bounds, rectOf(frame)))
        issues.push({
          kind: 'settings-control-outside-frame',
          text: describe(element),
          frame: frame.className || frame.tagName,
          controlBounds: bounds,
          frameBounds: rectOf(frame),
        });
      if (element instanceof HTMLSelectElement) {
        const css = getComputedStyle(element);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        context.font = css.font;
        const text = element.selectedOptions[0]?.textContent ?? '';
        const required =
          context.measureText(text).width +
          parseFloat(css.paddingLeft) +
          parseFloat(css.paddingRight);
        // The glyphs plus authored padding are a strict lower bound. Native
        // arrow chrome is intentionally not guessed or counted as extra room.
        if (required > element.clientWidth + 2)
          issues.push({
            kind: 'settings-selected-option-too-wide',
            text,
            required,
            available: element.clientWidth,
          });
      }
      if (header) {
        const css = getComputedStyle(element);
        if (
          bounds.width <= bounds.height + 4 ||
          parseFloat(css.borderTopLeftRadius) < 8
        )
          issues.push({
            kind: 'settings-header-not-rounded-rectangle',
            text: describe(element),
            radius: css.borderTopLeftRadius,
            ...bounds,
          });
      }
      return { text: describe(element), ...bounds };
    });
  for (let first = 0; first < controls.length; first++)
    for (let second = first + 1; second < controls.length; second++) {
      const a = controls[first],
        b = controls[second];
      if (
        Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
        Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2
      )
        issues.push({
          kind: 'settings-overlapping-controls',
          first: a.text,
          second: b.text,
        });
      if (
        header &&
        Math.abs(a.top - b.top) < 2 &&
        Math.abs(a.height - b.height) > 2
      )
        issues.push({
          kind: 'settings-header-button-height',
          first: a.text,
          second: b.text,
        });
    }
  for (const card of root.querySelectorAll(
    '.interaction-video-setting, .interaction-button-setting, .beginner-guidance-setting',
  )) {
    const heading = card.querySelector('h3'),
      button = card.querySelector('button');
    if (!heading || !button) continue;
    const a = rectOf(heading),
      b = rectOf(button);
    if (
      b.left >= a.right - 2 &&
      Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) > 2
    )
      issues.push({
        kind: 'settings-toggle-alignment',
        text: describe(card),
        heading: a,
        button: b,
      });
  }
  for (const group of root.querySelectorAll(
    '.dialog-actions, .application-update__actions',
  )) {
    const buttons = [...group.querySelectorAll('button, a[href]')]
      .filter(shown)
      .map(rectOf);
    for (let first = 0; first < buttons.length; first++)
      for (let second = first + 1; second < buttons.length; second++) {
        const a = buttons[first],
          b = buttons[second];
        if (
          Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2 &&
          Math.abs((a.top + a.bottom) / 2 - (b.top + b.bottom) / 2) > 2
        )
          issues.push({
            kind: 'settings-action-row-alignment',
            first: a,
            second: b,
          });
      }
  }
  const rootBounds = rectOf(root);
  if (
    !header &&
    !within(rootBounds, {
      left: 0,
      top: 0,
      right: innerWidth,
      bottom: innerHeight,
    })
  )
    issues.push({ kind: 'settings-dialog-outside-viewport', ...rootBounds });
  if (root.scrollWidth > root.clientWidth + 2)
    issues.push({
      kind: 'settings-horizontal-scroll',
      overflow: root.scrollWidth - root.clientWidth,
    });
  const content = root.querySelector('.box-overlay-panel__content');
  if (
    !header &&
    (!content ||
      !['auto', 'scroll'].includes(getComputedStyle(content).overflowY))
  )
    issues.push({ kind: 'settings-missing-inner-scrollport' });
  if (content && content.scrollWidth > content.clientWidth + 2)
    issues.push({
      kind: 'settings-content-horizontal-scroll',
      overflow: content.scrollWidth - content.clientWidth,
    });
  return {
    width: innerWidth,
    height: innerHeight,
    density: devicePixelRatio,
    root: rootBounds,
    heading: root.querySelector('.panel-heading')
      ? rectOf(root.querySelector('.panel-heading'))
      : null,
    controls,
    textFrameChecks,
    scroll: content
      ? {
          clientHeight: content.clientHeight,
          scrollHeight: content.scrollHeight,
        }
      : null,
    issues,
  };
}

/** Real controls, text Range geometry, and a reversible inner-scroll probe. */
export async function inspectSettingsPanel(doc) {
  const result = await doc.evaluate(measureSettingsLayout);
  const bottom = await doc.evaluate(async () => {
    const panel = [
      ...document.querySelectorAll('dialog[open].settings-panel'),
    ].at(-1);
    const content = panel?.querySelector('.box-overlay-panel__content');
    if (!content) return null;
    content.scrollTop = content.scrollHeight;
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    return {
      top: panel.querySelector('.panel-heading').getBoundingClientRect().top,
      scrollTop: content.scrollTop,
      maxScroll: content.scrollHeight - content.clientHeight,
    };
  });
  if (bottom) {
    result.scroll = { ...result.scroll, ...bottom };
    if (Math.abs(bottom.top - result.heading.top) > 2)
      result.issues.push({
        kind: 'settings-heading-moved-on-scroll',
        before: result.heading.top,
        after: bottom.top,
      });
    if (Math.abs(bottom.maxScroll - bottom.scrollTop) > 2)
      result.issues.push({
        kind: 'settings-inner-bottom-unreachable',
        ...bottom,
      });
  }
  const panel = doc.locator('dialog[open].settings-panel').last();
  try {
    for (const control of await panel
      .locator(
        'button:not(:disabled), select:not(:disabled), input:not(:disabled), a[href]',
      )
      .all()) {
      if (!(await control.isVisible())) continue;
      try {
        await control.click({ trial: true, timeout: 2000 });
      } catch (error) {
        result.issues.push({
          kind: 'settings-control-unreachable',
          text: (await control.textContent()).trim().slice(0, 100),
          reason: error.message.slice(0, 300),
        });
      }
    }
  } finally {
    await doc.evaluate(async () => {
      const content = document.querySelector(
        'dialog[open].settings-panel .box-overlay-panel__content',
      );
      if (content) content.scrollTop = 0;
      await new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      );
    });
  }
  return result;
}

/** Text-only layout stress; never replaces native bridges, snapshots, or commands. */
export async function installSettingsTextStress(doc) {
  return doc.evaluate(async () => {
    if (window.__tablemaxSettingsLayoutStress)
      throw new Error('Text stress already installed');
    const root = [
      ...document.querySelectorAll('dialog[open].settings-panel'),
    ].at(-1);
    if (!root)
      throw new Error('Open the production settings panel before text stress');
    const changes = [];
    const text =
      '布局压力文字：请保留这条完整说明，并确认文字始终位于所属卡片或按钮内部。'.repeat(
        4,
      ) +
      ' example.invalid/' +
      'LongUnbrokenStatus'.repeat(6);
    for (const element of root.querySelectorAll(
      'p, .countdown-settings__saved, .dialog-actions > button, .application-update__actions > button',
    )) {
      if (!element.checkVisibility({ checkVisibilityCSS: true })) continue;
      const node = [...element.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim(),
      );
      if (!node) continue;
      changes.push({ node, text: node.textContent });
      node.textContent = element.matches('button')
        ? '保存设置并等待当前更改完成确认，这是按钮自然增高的布局压力文字'
        : text;
    }
    window.__tablemaxSettingsLayoutStress = changes;
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    return {
      changedTextNodes: changes.length,
      fixture:
        'rendered-text-only; no production state or native capability substituted',
    };
  });
}

export async function restoreSettingsTextStress(doc) {
  await doc.evaluate(async () => {
    for (const { node, text } of window.__tablemaxSettingsLayoutStress ?? [])
      if (node.isConnected) node.textContent = text;
    delete window.__tablemaxSettingsLayoutStress;
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
  });
}
