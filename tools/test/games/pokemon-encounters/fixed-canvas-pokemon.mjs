import assert from 'node:assert/strict';

// Same Range/owner-frame and client-padding clip measurements as the existing
// settings-layout-measurement and Modern Art semantic-text checks, scoped here
// to Pokemon's real decision regions. Passed to Playwright without a new runner.
export function measurePokemonTextAndActions({ scopeSelector } = {}) {
  const root = document.querySelector('main');
  const canvas = document.querySelector('[data-fixed-canvas]');
  if (!root || !canvas) throw new Error('Expected production Pokemon canvas');
  const scope = scopeSelector ? root.querySelector(scopeSelector) : root;
  if (!scope) throw new Error('Expected the selected real text/control scope');
  const issues = [],
    leaves = [],
    controls = [],
    intentionalPeekBackLayers = [],
    fullyClippedText = [],
    numericMeasurements = [],
    externalSlotNumbers = [],
    deferredHorizontalControls = [],
    deferredHorizontalText = [],
    conservativeMeasurements = [];
  const box = (node) => {
    const r = node.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  };
  const serialize = (r) => ({
    x: r.x,
    y: r.y,
    right: r.right,
    bottom: r.bottom,
    width: r.width,
    height: r.height,
  });
  const overlaps = (a, b) =>
    Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 &&
    Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1;
  const within = (a, b, tolerance = 1) =>
    a.x >= b.x - tolerance &&
    a.y >= b.y - tolerance &&
    a.right <= b.right + tolerance &&
    a.bottom <= b.bottom + tolerance;
  const shown = (node) => {
    if (
      !node ||
      !node.getClientRects().length ||
      !node.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true })
    )
      return false;
    const closed = node.closest('details:not([open])');
    return !closed || Boolean(closed.querySelector('summary')?.contains(node));
  };
  const label = (node) => ({
    tag: node.tagName,
    className: node.getAttribute('class') ?? '',
    label: node.getAttribute('aria-label') ?? node.textContent.trim(),
  });
  const paint = (node) => {
    const clip = { ...box(canvas) },
      ancestors = [];
    for (
      let parent = node;
      parent && canvas.contains(parent);
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent),
        bounds = box(parent);
      const paddingBox = {
        x: bounds.x + parent.clientLeft,
        y: bounds.y + parent.clientTop,
        right: bounds.x + parent.clientLeft + parent.clientWidth,
        bottom: bounds.y + parent.clientTop + parent.clientHeight,
      };
      const containment = /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(
        style.contain,
      );
      const clipX = style.overflowX !== 'visible' || containment,
        clipY = style.overflowY !== 'visible' || containment;
      if (style.display !== 'contents') {
        if (clipX) {
          clip.x = Math.max(clip.x, paddingBox.x);
          clip.right = Math.min(clip.right, paddingBox.right);
        }
        if (clipY) {
          clip.y = Math.max(clip.y, paddingBox.y);
          clip.bottom = Math.min(clip.bottom, paddingBox.bottom);
        }
      }
      if (clipX || clipY)
        ancestors.push({
          ...label(parent),
          bounds,
          paddingBox,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          contain: style.contain,
          clipPath: style.clipPath,
        });
    }
    clip.width = Math.max(0, clip.right - clip.x);
    clip.height = Math.max(0, clip.bottom - clip.y);
    return { clip, ancestors };
  };
  const paintedIntersection = (r, clip) => {
    const result = {
      x: Math.max(r.x, clip.x),
      y: Math.max(r.y, clip.y),
      right: Math.min(r.right, clip.right),
      bottom: Math.min(r.bottom, clip.bottom),
    };
    result.width = Math.max(0, result.right - result.x);
    result.height = Math.max(0, result.bottom - result.y);
    return result;
  };
  const horizontalReach = (element, owner) => {
    const tabs = element.closest('.target-tabs');
    if (!tabs || !owner || !tabs.contains(owner)) return null;
    const style = getComputedStyle(tabs),
      bounds = box(owner),
      clip = paint(tabs).clip;
    if (
      !['auto', 'scroll'].includes(style.overflowX) ||
      tabs.scrollWidth <= tabs.clientWidth + 1
    )
      return null;
    if (bounds.x >= clip.x - 1 && bounds.right <= clip.right + 1) return null;
    return {
      selector: '.target-tabs',
      scrollLeft: tabs.scrollLeft,
      scrollWidth: tabs.scrollWidth,
      clientWidth: tabs.clientWidth,
      owner: label(owner),
      bounds,
      clip,
    };
  };
  const numericInk = (element, text, r) => {
    if (!/^-?\d+(?:\.\d+)?$/.test(text)) return null;
    const css = getComputedStyle(element),
      reasons = [];
    const raster = document.createElement('canvas'),
      context = raster.getContext('2d');
    if (!context)
      return {
        text,
        range: serialize(r),
        reliable: false,
        reasons: ['Canvas text metrics unavailable'],
        ink: null,
      };
    context.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
    context.textBaseline = 'alphabetic';
    context.textAlign = 'left';
    context.direction = css.direction;
    for (const key of [
      'fontKerning',
      'fontStretch',
      'fontVariantCaps',
      'letterSpacing',
      'wordSpacing',
    ])
      if (key in context)
        context[key] =
          css[key] === 'normal' &&
          ['letterSpacing', 'wordSpacing'].includes(key)
            ? '0px'
            : css[key];
    const metrics = context.measureText(text);
    const canvasMetrics = Object.fromEntries(
      [
        'width',
        'actualBoundingBoxLeft',
        'actualBoundingBoxRight',
        'actualBoundingBoxAscent',
        'actualBoundingBoxDescent',
        'fontBoundingBoxAscent',
        'fontBoundingBoxDescent',
      ].map((key) => [key, metrics[key]]),
    );
    const probe = document.createElement('span');
    Object.assign(probe.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      display: 'inline-block',
      whiteSpace: 'pre',
      padding: '0',
      margin: '0',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
      transform: 'none',
      zoom: '1',
    });
    for (const key of [
      'fontFamily',
      'fontSize',
      'fontWeight',
      'fontStyle',
      'fontStretch',
      'fontKerning',
      'fontFeatureSettings',
      'fontVariationSettings',
      'fontVariantNumeric',
      'fontVariantCaps',
      'fontVariantLigatures',
      'letterSpacing',
      'wordSpacing',
      'textRendering',
      'lineHeight',
      'direction',
      'writingMode',
    ])
      probe.style[key] = css[key];
    const textNode = document.createTextNode(text),
      baseline = document.createElement('span');
    Object.assign(baseline.style, {
      display: 'inline-block',
      verticalAlign: 'baseline',
      width: '0',
      height: '0',
      padding: '0',
      margin: '0',
      border: '0',
      fontSize: '0',
      lineHeight: '0',
    });
    probe.append(textNode, baseline);
    document.body.append(probe);
    const range = document.createRange();
    range.selectNodeContents(textNode);
    const probeRange = serialize(range.getBoundingClientRect()),
      baselineY = baseline.getBoundingClientRect().y;
    probe.remove();
    if (css.writingMode !== 'horizontal-tb' || css.direction !== 'ltr')
      reasons.push('Unsupported writing direction');
    if (css.fontVariantNumeric !== 'normal')
      reasons.push(
        'Canvas does not bind CSS font-variant-numeric glyph substitution',
      );
    if (
      css.fontFeatureSettings !== 'normal' ||
      css.fontVariationSettings !== 'normal'
    )
      reasons.push('Canvas does not bind authored font features/variations');
    if (css.fontVariantCaps !== 'normal')
      reasons.push('Unsupported font variant');
    if (parseFloat(css.webkitTextStrokeWidth) > 0)
      reasons.push('Canvas main fill does not bind an authored text outline');
    for (
      let parent = element;
      parent && canvas.contains(parent);
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent),
        matrix =
          style.transform === 'none'
            ? null
            : new DOMMatrixReadOnly(style.transform);
      if (
        matrix &&
        (!matrix.is2D ||
          matrix.a !== 1 ||
          matrix.b !== 0 ||
          matrix.c !== 0 ||
          matrix.d !== 1)
      )
        reasons.push('Transformed numeric geometry');
      if (!['1', 'normal'].includes(style.zoom))
        reasons.push('CSS zoomed numeric geometry');
    }
    if (
      Math.abs(probeRange.width - r.width) > 0.5 ||
      Math.abs(probeRange.height - r.height) > 0.5
    )
      reasons.push('DOM probe Range does not match the rendered Range');
    if (Math.abs(metrics.width - probeRange.width) > 0.5)
      reasons.push('Canvas advance does not match the same-font DOM probe');
    if (
      Math.abs(
        metrics.fontBoundingBoxAscent +
          metrics.fontBoundingBoxDescent -
          probeRange.height,
      ) > 0.5
    )
      reasons.push('Canvas font box does not match the same-font DOM Range');
    if (!Object.values(canvasMetrics).every(Number.isFinite))
      reasons.push('Font bounding metrics unavailable');
    const originY = r.y + baselineY - probeRange.y;
    const ink = {
      x: r.x - metrics.actualBoundingBoxLeft,
      y: originY - metrics.actualBoundingBoxAscent,
      right: r.x + metrics.actualBoundingBoxRight,
      bottom: originY + metrics.actualBoundingBoxDescent,
    };
    ink.width = ink.right - ink.x;
    ink.height = ink.bottom - ink.y;
    return {
      text,
      range: serialize(r),
      canvasFont: context.font,
      canvasMetrics,
      probeRange,
      probeBaselineY: baselineY,
      baselineOffset: baselineY - probeRange.y,
      ink,
      reliable: reasons.length === 0,
      reasons,
      css: {
        font: css.font,
        fontVariantNumeric: css.fontVariantNumeric,
        fontFeatureSettings: css.fontFeatureSettings,
        fontVariationSettings: css.fontVariationSettings,
      },
      boundary:
        'Main glyph fill only; text shadow/filter extents are not treated as a missing numeral stroke.',
    };
  };
  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let node,
    source = 0;
  while ((node = walker.nextNode())) {
    const element = node.parentElement,
      text = node.textContent.trim();
    if (
      !text ||
      !shown(element) ||
      element.closest(
        'svg,option,script,style,[aria-hidden="true"],.tablemax-visually-hidden',
      )
    )
      continue;
    const range = document.createRange();
    range.selectNodeContents(node);
    const measured = paint(element),
      owner = element.closest('button,a[href],select,input,summary');
    const frame = owner ?? element.closest('.pokemon-card,.card-surface');
    const rectangles = [...range.getClientRects()].filter(
      (r) => r.width && r.height,
    );
    const peek = element.closest('.private-peek,.ex-private-peek');
    const inactiveBack =
      element.closest('.card-slot .pokemon-card.back') &&
      !element.closest('button:not(:disabled),a[href]');
    const slot = element.closest('.card-slot[data-slot]'),
      marker = element.closest('.slot-index');
    const slotSuffix = slot?.getAttribute('data-slot')?.split(':').at(-1);
    const externalNumber = Boolean(marker && slot && /^\d+$/.test(text));
    const associationValid =
      externalNumber &&
      /^\d+$/.test(slotSuffix ?? '') &&
      Number(text) === Number(slotSuffix) + 1;
    for (const r of rectangles) {
      // Fully clipped scroll content is recorded separately by its ancestor
      // geometry; it is not an independently painted text overlap in this view.
      if (
        Math.min(r.right, measured.clip.right) <=
          Math.max(r.x, measured.clip.x) ||
        Math.min(r.bottom, measured.clip.bottom) <=
          Math.max(r.y, measured.clip.y)
      ) {
        fullyClippedText.push({
          text,
          ...label(element),
          rect: serialize(r),
          clip: measured.clip,
          ancestors: measured.ancestors,
        });
        continue;
      }
      const leaf = {
        source,
        text,
        ...label(element),
        rect: serialize(r),
        clip: measured.clip,
        ancestors: measured.ancestors,
        owner: owner ? { ...label(owner), rect: box(owner) } : null,
        peek: Boolean(peek),
        inactiveBack: Boolean(inactiveBack),
        paintedRect: paintedIntersection(r, measured.clip),
        numericInk:
          rectangles.length === 1 ? numericInk(element, text, r) : null,
      };
      if (leaf.numericInk) {
        leaf.numericInk.rangeOutsideClip = !within(r, measured.clip);
        leaf.numericInk.inkInsideClip = leaf.numericInk.reliable
          ? within(leaf.numericInk.ink, measured.clip)
          : null;
        numericMeasurements.push(leaf.numericInk);
        if (leaf.numericInk.reliable)
          leaf.paintedRect = paintedIntersection(
            leaf.numericInk.ink,
            measured.clip,
          );
      }
      const deferred = horizontalReach(element, owner);
      if (deferred) {
        deferredHorizontalText.push({ ...leaf, scroll: deferred });
        continue;
      }
      leaves.push(leaf);
      const visibleGlyph = leaf.numericInk?.reliable ? leaf.numericInk.ink : r;
      if (!within(visibleGlyph, measured.clip)) {
        if (leaf.numericInk && !leaf.numericInk.reliable) {
          const item = {
            kind: 'numeric-ink-inconclusive',
            ...leaf,
            rangeIssue: 'clip',
            conclusion:
              'Measurement is incomplete; Range alone does not establish a clipped numeral.',
          };
          conservativeMeasurements.push(item);
          issues.push(item);
        } else
          issues.push({
            kind: leaf.numericInk
              ? 'numeric-glyph-fill-clipped'
              : 'glyph-clipped-by-ancestor',
            ...leaf,
          });
      }
      if (externalNumber) {
        const center = { x: (r.x + r.right) / 2, y: (r.y + r.bottom) / 2 };
        const distances = [
          ...slot
            .closest('.pokemon-board')
            .querySelectorAll(':scope > .card-slot'),
        ].map((candidate) => {
          const rect = box(candidate),
            dx = Math.max(rect.x - center.x, 0, center.x - rect.right),
            dy = Math.max(rect.y - center.y, 0, center.y - rect.bottom);
          return {
            slot: candidate.getAttribute('data-slot'),
            distance: Math.hypot(dx, dy),
          };
        });
        const nearest = Math.min(
          ...distances.map((candidate) => candidate.distance),
        );
        const nearestSlots = distances
          .filter((candidate) => candidate.distance <= nearest + 0.5)
          .map((candidate) => candidate.slot);
        const samePosition = nearestSlots.includes(
          slot.getAttribute('data-slot'),
        );
        externalSlotNumbers.push({
          source,
          text,
          slot: slot.getAttribute('data-slot'),
          associationValid: associationValid && samePosition,
          nearestSlots,
          rect: serialize(r),
          paintedRect: leaf.paintedRect,
          clip: measured.clip,
          owner: leaf.owner,
          fullyVisible: within(visibleGlyph, measured.clip),
          outsideOwner: owner ? !within(r, box(owner), 0.5) : false,
        });
        if (!associationValid || !samePosition)
          issues.push({
            kind: 'external-slot-number-identity-mismatch',
            ...leaf,
            slot: slot.getAttribute('data-slot'),
          });
      }
      if (
        frame &&
        !(externalNumber && associationValid) &&
        !within(visibleGlyph, box(frame), 0.5)
      )
        issues.push({
          kind:
            leaf.numericInk && !leaf.numericInk.reliable
              ? 'numeric-ink-inconclusive'
              : 'glyph-outside-own-control-or-card',
          ...leaf,
          ...(leaf.numericInk && !leaf.numericInk.reliable
            ? {
                rangeIssue: 'owner frame',
                conclusion:
                  'Measurement is incomplete; a font Range overhang alone is not a product defect.',
              }
            : {}),
          frame: { ...label(frame), rect: box(frame) },
        });
    }
    source++;
  }
  for (let a = 0; a < leaves.length; a++)
    for (let b = a + 1; b < leaves.length; b++) {
      const first = leaves[a],
        second = leaves[b];
      if (
        first.source === second.source ||
        !overlaps(first.paintedRect, second.paintedRect)
      )
        continue;
      // Only noninteractive back artwork may sit under the intentional peek.
      // Slot indices, face-up names, instructions and every control remain strict.
      if (
        (first.peek && second.inactiveBack) ||
        (second.peek && first.inactiveBack)
      ) {
        intentionalPeekBackLayers.push({ first, second });
        continue;
      }
      const uncertain =
        (first.numericInk && !first.numericInk.reliable) ||
        (second.numericInk && !second.numericInk.reliable);
      const issue = {
        kind: uncertain
          ? 'numeric-semantic-overlap-inconclusive'
          : 'independent-semantic-text-overlap',
        first,
        second,
      };
      if (uncertain) conservativeMeasurements.push(issue);
      issues.push(issue);
    }
  const controlSelector = 'button,a[href],select,input,summary';
  const controlNodes = [
    ...(scope.matches(controlSelector) ? [scope] : []),
    ...scope.querySelectorAll(controlSelector),
  ];
  for (const element of controlNodes) {
    if (!shown(element) || element.closest('[aria-hidden="true"]')) continue;
    const bounds = box(element),
      measured = paint(element),
      disabled = element.matches(':disabled');
    const effective = {
      x: Math.max(bounds.x, measured.clip.x),
      y: Math.max(bounds.y, measured.clip.y),
      right: Math.min(bounds.right, measured.clip.right),
      bottom: Math.min(bounds.bottom, measured.clip.bottom),
    };
    effective.width = Math.max(0, effective.right - effective.x);
    effective.height = Math.max(0, effective.bottom - effective.y);
    const current = {
      ...label(element),
      dataSlot: element.getAttribute('data-slot'),
      bounds,
      effective,
      disabled,
      font: parseFloat(getComputedStyle(element).fontSize),
      hits: [],
    };
    const deferred = horizontalReach(element, element);
    if (deferred) {
      deferredHorizontalControls.push({ ...current, scroll: deferred });
      continue;
    }
    if (!disabled) {
      if (effective.width < 43.5 || effective.height < 43.5)
        issues.push({ kind: 'effective-control-under-44px', control: current });
      const center = {
        x: (effective.x + effective.right) / 2,
        y: (effective.y + effective.bottom) / 2,
      };
      for (const [dx, dy] of [
        [0, 0],
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const point = {
          x: center.x + dx * Math.min(20, effective.width / 2 - 1),
          y: center.y + dy * Math.min(20, effective.height / 2 - 1),
        };
        const hit = document.elementFromPoint(point.x, point.y),
          own = hit === element || element.contains(hit);
        current.hits.push({ point, own, hit: hit ? label(hit) : null });
      }
      if (current.hits.some((hit) => !hit.own))
        issues.push({
          kind: 'necessary-control-hit-occluded',
          control: current,
        });
    }
    const ownLeaves = leaves.filter(
      (leaf) =>
        leaf.owner &&
        leaf.owner.rect.x === bounds.x &&
        leaf.owner.rect.y === bounds.y &&
        leaf.owner.label === current.label,
    );
    if (
      element.closest('.ex-toolbar,.game-toolbar') &&
      /(?:盒子|规则|朋友)/.test(element.textContent)
    ) {
      const lines = [
        ...new Set(ownLeaves.map((leaf) => Math.round(leaf.rect.y))),
      ];
      if (lines.length > 1)
        issues.push({
          kind: 'short-navigation-label-wraps',
          control: current,
          lines,
          text: ownLeaves,
        });
    }
    controls.push(current);
  }
  for (let a = 0; a < controls.length; a++)
    for (let b = a + 1; b < controls.length; b++)
      if (overlaps(controls[a].effective, controls[b].effective))
        issues.push({
          kind: 'independent-controls-overlap',
          first: controls[a],
          second: controls[b],
        });
  for (const marker of externalSlotNumbers) {
    const control = controls.find(
      (control) => control.dataSlot === marker.slot,
    );
    marker.control = control ?? null;
    marker.hitVerified = Boolean(
      control &&
      !control.disabled &&
      control.effective.width >= 43.5 &&
      control.effective.height >= 43.5 &&
      control.hits.every((hit) => hit.own),
    );
    marker.semanticCollisions = issues.filter(
      (issue) =>
        [
          'independent-semantic-text-overlap',
          'numeric-semantic-overlap-inconclusive',
        ].includes(issue.kind) &&
        (issue.first?.source === marker.source ||
          issue.second?.source === marker.source),
    ).length;
    marker.classification =
      marker.associationValid &&
      marker.fullyVisible &&
      !marker.semanticCollisions &&
      (!marker.owner || marker.hitVerified || control?.disabled)
        ? 'intentional-external-position-label'
        : 'position-label-needs-the-recorded-visibility-hit-or-collision-fix';
  }
  const view = window.fixtureSession.view,
    expectedNames = [];
  const addName = (id, reason) => {
    const seat = view.seats.find((seat) => seat.id === id);
    if (seat && !expectedNames.some((entry) => entry.name === seat.name))
      expectedNames.push({ name: seat.name, reason });
  };
  if (scopeSelector) {
    const name = scope.getAttribute('title');
    if (name && view.seats.some((seat) => seat.name === name))
      expectedNames.push({
        name,
        reason: 'individually reached horizontal target tab',
      });
  } else if (view.self.role === 'host')
    for (const seat of view.seats) addName(seat.id, 'public board identity');
  else {
    addName(view.self.seatId, 'own player identity');
    if (view.gameView.peek?.seat)
      addName(view.gameView.peek.seat, 'private peek target identity');
    const target = document
      .querySelector('.target-board[aria-label]')
      ?.getAttribute('aria-label');
    if (target)
      expectedNames.push({ name: target, reason: 'selected target identity' });
  }
  const names = expectedNames.map((entry) => ({
    ...entry,
    painted: leaves
      .filter((leaf) => leaf.text.includes(entry.name))
      .map((leaf) => ({ text: leaf.text, rect: leaf.rect, owner: leaf.owner })),
  }));
  for (const entry of names)
    if (!entry.painted.length)
      issues.push({ kind: 'required-full-player-name-not-painted', ...entry });
  return {
    method:
      'Painted text intersections, semantic external position labels, real target-tab reachability, and baseline-calibrated main numeric glyph fill. Unsupported numeric metrics remain blocking measurement-inconclusive; no tolerance expansion.',
    leaves,
    controls,
    names,
    intentionalPeekBackLayers,
    fullyClippedText,
    numericMeasurements,
    externalSlotNumbers,
    deferredHorizontalControls,
    deferredHorizontalText,
    conservativeMeasurements,
    classification: {
      provenIssues: issues.filter(
        (issue) => !issue.kind.includes('inconclusive'),
      ).length,
      measurementInconclusive: issues.filter((issue) =>
        issue.kind.includes('inconclusive'),
      ).length,
    },
    issues,
  };
}

async function inspectHorizontalTargets(surface) {
  const tabs = surface.locator('.target-tabs');
  if (!(await tabs.count())) return { checks: [] };
  assert.equal(await tabs.count(), 1);
  const original = await tabs.evaluate((node) => {
    const viewport = document.querySelector('[data-canvas-viewport]');
    return {
      left: node.scrollLeft,
      top: node.scrollTop,
      viewportLeft: viewport?.scrollLeft ?? 0,
      viewportTop: viewport?.scrollTop ?? 0,
      windowX: scrollX,
      windowY: scrollY,
    };
  });
  const labels = await tabs
    .locator('button')
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute('aria-label')),
    );
  const results = [];
  try {
    for (const label of labels) {
      assert(label);
      const button = surface.getByRole('button', { name: label, exact: true });
      assert.equal(await button.count(), 1);
      await button.scrollIntoViewIfNeeded();
      await surface.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          ),
      );
      const result = await surface.evaluate(measurePokemonTextAndActions, {
        scopeSelector:
          '.target-tabs button[aria-label=' + JSON.stringify(label) + ']',
      });
      if (result.controls.length !== 1)
        result.issues.push({
          kind: 'target-tab-not-completely-reachable',
          label,
          deferred: result.deferredHorizontalControls,
        });
      results.push({
        label,
        scroll: await tabs.evaluate((node) => ({
          left: node.scrollLeft,
          top: node.scrollTop,
        })),
        ...result,
      });
    }
  } finally {
    await tabs.evaluate((node, position) => {
      node.scrollTo({
        left: position.left,
        top: position.top,
        behavior: 'instant',
      });
      const viewport = document.querySelector('[data-canvas-viewport]');
      if (viewport) {
        viewport.scrollTo({
          left: position.viewportLeft,
          top: position.viewportTop,
          behavior: 'instant',
        });
      }
      window.scrollTo({
        left: position.windowX,
        top: position.windowY,
        behavior: 'instant',
      });
    }, original);
    await surface.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
  }
  const restored = await tabs.evaluate((node) => {
    const viewport = document.querySelector('[data-canvas-viewport]');
    return {
      left: node.scrollLeft,
      top: node.scrollTop,
      viewportLeft: viewport?.scrollLeft ?? 0,
      viewportTop: viewport?.scrollTop ?? 0,
      windowX: scrollX,
      windowY: scrollY,
    };
  });
  assert.deepEqual(
    restored,
    original,
    'Target-tab inspection restores real local, outer and document scroll positions',
  );
  return { original, restored, checks: results };
}

async function witness(surface) {
  return surface.evaluate(() => {
    const view = window.fixtureSession.view;
    const selected = [
      ...document.querySelectorAll(
        '.pokemon-player .card-slot.selected,.ex-actions .card-slot.selected',
      ),
    ].map((node) => node.getAttribute('data-slot'));
    const target =
      document
        .querySelector('.target-tabs [aria-pressed="true"]')
        ?.getAttribute('aria-label') ??
      document
        .querySelector('.ex-target-list .selected')
        ?.getAttribute('data-target-seat') ??
      null;
    const confirm = document.querySelector(
      '.confirm-action,.ex-submit>button[data-action]',
    );
    return {
      instanceId: view.instanceId,
      revision: view.revision,
      decisionId: view.decisionId,
      selectionToken: view.selectionToken,
      gameView: JSON.stringify(view.gameView),
      actions: JSON.stringify(view.actions),
      commands: window.fixtureCommands.length,
      selected,
      target,
      confirm: confirm
        ? {
            text: confirm.textContent.trim(),
            label: confirm.getAttribute('aria-label'),
            action: confirm.getAttribute('data-action'),
            disabled: confirm.disabled,
          }
        : null,
      reposition:
        document
          .querySelector('.ex-reposition-source')
          ?.classList.contains('selected') ?? false,
    };
  });
}

async function chooseSlot(surface, selector, index) {
  const slots = surface.locator(selector);
  const ids = await slots.evaluateAll((nodes) =>
    nodes.map((node) => ({
      id: node.getAttribute('data-slot'),
      disabled: node.disabled,
    })),
  );
  assert(
    ids[index]?.id && !ids[index].disabled,
    `No selectable real slot ${index}`,
  );
  const slot = surface.locator(
    `${selector}[data-slot=${JSON.stringify(ids[index].id)}]`,
  );
  assert.equal(await slot.count(), 1);
  await slot.click();
  return slot;
}

/** Internal methods for the existing fixed-canvas verifier; no CLI or runner. */
export async function beginPokemonFixedProof(surface, item) {
  const evidence = {
    scene: item.scene,
    seats: item.seats,
    variant: item.variant,
  };
  try {
    return await beginProof(surface, item, evidence);
  } catch (error) {
    error.pokemonEvidence = evidence;
    throw error;
  }
}

async function beginProof(surface, item, evidence) {
  const expansion = item.variant === 'expansion';
  const initial = await witness(surface);
  evidence.initial = initial;
  assert.equal(initial.commands, 0);
  let selectedNode;
  if (item.role === 'player') {
    if (item.scene === 'reposition-selected') {
      const source = surface.locator('.ex-reposition-source');
      assert.equal(await source.count(), 1);
      assert.match(await source.innerText(), /卡牌换位/);
      await source.click();
    }
    if (item.scene === 'mew-target-selected') {
      const tabs = surface.locator(
        '.pokemon-player[data-phase="mew-other"] .target-tabs button',
      );
      assert.equal(
        await tabs.count(),
        item.seats - 1,
        'All real target tabs remain available',
      );
      const names = await tabs.evaluateAll((nodes) =>
        nodes.map((node) => node.getAttribute('aria-label')),
      );
      assert.equal(names.length, item.seats - 1);
      assert(names[1]);
      const tab = surface.getByRole('button', { name: names[1], exact: true });
      await tab.click();
      selectedNode = await chooseSlot(
        surface,
        '.pokemon-player .target-board .card-slot',
        1,
      );
    } else if (
      ['placement-selected', 'swap-selected', 'reposition-selected'].includes(
        item.scene,
      )
    ) {
      const selector = expansion
        ? '.ex-actions .card-slot'
        : ':is(.pokemon-player > .pokemon-board,.pokemon-player > .player-board-region > .pokemon-board) .card-slot';
      selectedNode = await chooseSlot(surface, selector, 1);
      if (item.scene !== 'placement-selected')
        selectedNode = await chooseSlot(surface, selector, 2);
    }
  }
  const baseline = await witness(surface);
  evidence.baseline = baseline;
  assert.equal(
    baseline.commands,
    0,
    'Local choice never submits a game command',
  );
  assert.equal(
    baseline.gameView,
    initial.gameView,
    'Local choice does not patch authoritative state',
  );
  if (item.role === 'player' && item.scene.endsWith('-selected')) {
    assert.equal(
      baseline.selected.length,
      ['swap-selected', 'reposition-selected'].includes(item.scene) ? 2 : 1,
    );
    assert(
      baseline.confirm && !baseline.confirm.disabled,
      'A real confirmation exposes the selected draft',
    );
  }
  const focusedNode = selectedNode ? await selectedNode.elementHandle() : null;
  if (selectedNode) await selectedNode.focus();
  const geometry = await surface.evaluate(() => {
    const canvas = document.querySelector('[data-fixed-canvas]');
    const canvasRect = canvas.getBoundingClientRect();
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const boards = [...document.querySelectorAll('main .pokemon-board')].map(
      (node) => ({
        rect: rect(node),
        cards: [...node.querySelectorAll('.pokemon-card')].map(rect),
      }),
    );
    const regions = [
      ...document.querySelectorAll(
        '.pokemon-player,.ex-actions,.ex-held,.private-peek,.ex-private-peek,.target-tabs,.ex-vote',
      ),
    ]
      .map((node) => ({ className: node.className, rect: rect(node) }))
      .filter((node) => node.rect.width && node.rect.height);
    const view = window.fixtureSession.view;
    return {
      canvas: {
        x: canvasRect.x,
        y: canvasRect.y,
        width: canvasRect.width,
        height: canvasRect.height,
      },
      cards: document.querySelectorAll('main .pokemon-card').length,
      boards,
      regions,
      phase: view.gameView.phase,
      phaseOwnedHeldHints: [
        ...document.querySelectorAll(
          '.ex-held > div > p,.ex-public-held > div > p',
        ),
      ]
        .filter(
          (node) =>
            node.getBoundingClientRect().width > 0 &&
            node.getBoundingClientRect().height > 0,
        )
        .map((node) => ({
          owner: node.parentElement.parentElement.className,
          text: node.textContent.trim(),
        })),
      researchCandidates: view.gameView.researchCandidates?.length ?? 0,
      voteOptions: document.querySelectorAll('.ex-vote-choice').length,
      held: view.gameView.held,
      privatePeek: view.gameView.peek ?? null,
      self: view.self,
      nativeInputs: document.querySelectorAll(
        'main input,main textarea,[contenteditable="true"]',
      ).length,
    };
  });
  evidence.geometry = geometry;
  if (item.scene === 'research-vote') {
    assert.equal(geometry.phase, 'research-vote');
    assert.equal(geometry.researchCandidates, 3);
    if (item.role === 'player') assert.equal(geometry.voteOptions, 3);
  } else
    assert(
      geometry.cards > 0 &&
        geometry.boards.every((board) => board.cards.length),
      'Actual nonempty production cards render',
    );
  assert.equal(
    geometry.nativeInputs,
    0,
    'Update the input-retention method if a real Pokemon text input is added',
  );
  if (item.role === 'host') {
    assert.equal(geometry.self.seatId, null);
    assert.equal(
      geometry.privatePeek,
      null,
      'Management has no own private peek',
    );
    if (item.scene !== 'research-vote')
      assert.equal(geometry.boards.length, item.seats);
    if ([2, 3].includes(item.seats))
      for (const board of geometry.boards)
        for (const card of board.cards) {
          assert(card.width > 0 && card.height > 0);
          assert(
            Math.abs(card.width / card.height - 5 / 7) <= 0.01,
            `Actual host card ratio ${card.width}/${card.height}`,
          );
        }
  }
  for (const region of geometry.regions) {
    const a = region.rect,
      b = geometry.canvas;
    assert(
      a.x >= b.x - 1 &&
        a.y >= b.y - 1 &&
        a.x + a.width <= b.x + b.width + 1 &&
        a.y + a.height <= b.y + b.height + 1,
      `Critical region leaves the logical canvas: ${JSON.stringify(region)}`,
    );
  }
  if (['held', 'placement-selected'].includes(item.scene))
    assert(geometry.held, 'Held state contains the actually drawn card');
  if (
    item.variant === 'expansion' &&
    geometry.phase === 'mewtwo-choice' &&
    geometry.held
  ) {
    assert(
      geometry.phaseOwnedHeldHints.length,
      'The actual held decision owns its current-step instruction',
    );
    for (const hint of geometry.phaseOwnedHeldHints) {
      assert(
        /已私看/.test(hint.text) &&
          /交换/.test(hint.text) &&
          /放弃/.test(hint.text),
        'The phase-owned held instruction describes the actual private exchange decision: ' +
          JSON.stringify(hint),
      );
      assert(
        !/选择.{0,4}(位置|一格).{0,4}(换入|放入)/.test(hint.text),
        'A global headline cannot mask a stale held next-step instruction',
      );
    }
  }
  if (item.scene === 'replace-committed')
    assert.equal(
      geometry.held,
      null,
      'Committed replacement is separate from held state',
    );
  if (
    item.role === 'player' &&
    ['private-peek', 'target-private-peek'].includes(item.scene)
  )
    assert(
      geometry.privatePeek,
      'Only the authorized player receives the actual private peek',
    );
  evidence.textAndActions = await surface.evaluate(
    measurePokemonTextAndActions,
  );
  evidence.horizontalTargetReachability =
    await inspectHorizontalTargets(surface);
  for (const tab of evidence.horizontalTargetReachability.checks)
    evidence.textAndActions.issues.push(
      ...tab.issues.map((issue) => ({ ...issue, reachedTarget: tab.label })),
    );
  evidence.textAndActions.classification = {
    layoutOrControlDiagnostics: evidence.textAndActions.issues.filter(
      (issue) => !issue.kind.includes('inconclusive'),
    ).length,
    measurementInconclusive: evidence.textAndActions.issues.filter((issue) =>
      issue.kind.includes('inconclusive'),
    ).length,
  };
  const restored = await witness(surface);
  assert.deepEqual(
    restored,
    baseline,
    'Real target-tab scrolling preserves the selected draft, card order and zero commands',
  );
  if (focusedNode)
    assert(
      await focusedNode.evaluate(
        (node) => node.isConnected && document.activeElement === node,
      ),
      'Real target-tab scrolling preserves the selected card node and focus',
    );
  assert.equal(
    evidence.textAndActions.issues.length,
    0,
    JSON.stringify(
      evidence.textAndActions.issues.slice(0, 8).map((issue) => ({
        kind: issue.kind,
        text: issue.text ?? issue.control?.label ?? issue.name,
        rect: issue.rect ?? issue.control?.bounds,
        first: issue.first
          ? {
              text: issue.first.text ?? issue.first.label,
              rect: issue.first.rect ?? issue.first.bounds,
            }
          : undefined,
        second: issue.second
          ? {
              text: issue.second.text ?? issue.second.label,
              rect: issue.second.rect ?? issue.second.bounds,
            }
          : undefined,
      })),
    ),
  );
  evidence.input = {
    applicable: false,
    reason:
      'This Pokemon UI has no native text input; actual card buttons and layout selector supply the focus proof.',
  };
  evidence.eventConsumption = {
    applicable: false,
    reason:
      'This static authorized projection delivers no new saved-motion batch; preserving projected event identities is checked, not a one-time delivery claim.',
  };
  return {
    evidence,
    async assertStable(stage, requireFocus = false) {
      const next = await witness(surface);
      evidence.lastObservation = { stage, next };
      try {
        assert.deepEqual(
          next,
          baseline,
          `Pokemon draft, card order, decision, events and commands survive ${stage}`,
        );
        if (focusedNode)
          assert(
            await focusedNode.evaluate(
              (node, focus) =>
                node.isConnected && (!focus || document.activeElement === node),
              requireFocus,
            ),
            `The actual card button survives ${stage}`,
          );
      } catch (error) {
        error.pokemonEvidence = evidence;
        throw error;
      }
      return next;
    },
    async restoreFocus() {
      if (selectedNode) await selectedNode.focus();
    },
  };
}
