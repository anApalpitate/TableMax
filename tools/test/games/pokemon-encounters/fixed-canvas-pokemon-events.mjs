import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';

// Internal verifier module. The renderer supplies real RoomCoordinator receipts;
// this module never constructs feedback, motion, a view, or a presentation queue.
function installProbe() {
  if (window.pokemonSavedEventProbe)
    throw new Error('Pokemon saved-event observation already installed');
  const ids = new WeakMap();
  let next = 1;
  const id = (object) => {
    if (!ids.has(object)) ids.set(object, next++);
    return ids.get(object);
  };
  const added = [];
  const selector =
    '.anime-entrance,.saved-trail,.ex-board-trail,.saved-action-trails,.ex-board-effects';
  const describe = (node) => ({
    id: id(node),
    tag: node.tagName,
    className: node.getAttribute('class') ?? '',
    scene: node.getAttribute('data-scene'),
  });
  const observer = new MutationObserver((records) => {
    for (const record of records)
      for (const node of record.addedNodes) {
        if (!(node instanceof Element)) continue;
        const nodes = [
          ...(node.matches(selector) ? [node] : []),
          ...node.querySelectorAll(selector),
        ];
        for (const item of nodes)
          added.push({
            ...describe(item),
            time: performance.now(),
            revision: window.fixtureSession.view.revision,
            eventId: window.fixtureSession.view.gameView.events.at(-1)?.id,
          });
      }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
  const geometry = () => {
    const context = window.contractContext;
    const canvas = document.querySelector('[data-fixed-canvas]');
    const outer = document.querySelector('[data-canvas-viewport]');
    if (!context || !canvas || !outer)
      return { aligned: false, reason: 'Missing real canvas/context' };
    const bounds = (node) => {
      const r = node.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    const canvasRect = bounds(canvas),
      outerRect = bounds(outer),
      style = getComputedStyle(outer);
    const padding = Object.fromEntries(
      ['Left', 'Right', 'Top', 'Bottom'].map((side) => [
        side,
        Number.parseFloat(style['padding' + side]) || 0,
      ]),
    );
    const expectedAvailable = {
      x: outerRect.x + outer.clientLeft + padding.Left,
      y: outerRect.y + outer.clientTop + padding.Top,
      width: Math.max(0, outer.clientWidth - padding.Left - padding.Right),
      height: Math.max(0, outer.clientHeight - padding.Top - padding.Bottom),
    };
    const availableError = Object.fromEntries(
      ['x', 'y', 'width', 'height'].map((key) => [
        key,
        Math.abs(context.availableRect[key] - expectedAvailable[key]),
      ]),
    );
    const offsetError = {
      x: Math.abs(context.offset.x - canvasRect.x),
      y: Math.abs(context.offset.y - canvasRect.y),
    };
    const sizeError = {
      width: Math.abs(context.logicalSize.width - canvasRect.width),
      height: Math.abs(context.logicalSize.height - canvasRect.height),
    };
    const frame = window.frameElement;
    const frameViewport = frame
      ? {
          width: frame.clientWidth,
          height: frame.clientHeight,
          childWidth: innerWidth,
          childHeight: innerHeight,
        }
      : null;
    const frameAligned =
      !frameViewport ||
      (Math.abs(frameViewport.width - innerWidth) <= 1 &&
        Math.abs(frameViewport.height - innerHeight) <= 1);
    return {
      aligned:
        frameAligned &&
        [
          ...Object.values(availableError),
          ...Object.values(offsetError),
          ...Object.values(sizeError),
        ].every((error) => error <= 1),
      layout: context.layout,
      logicalSize: context.logicalSize,
      availableRect: context.availableRect,
      expectedAvailable,
      offset: context.offset,
      canvas: canvasRect,
      outer: outerRect,
      scroll: { x: outer.scrollLeft, y: outer.scrollTop },
      revision: context.revision,
      availableError,
      offsetError,
      sizeError,
      frameViewport,
    };
  };
  window.pokemonSavedEventProbe = { id, added, observer, describe, geometry };
}

// Poll only actual geometry using natural rAF and a bounded native deadline.
// No fixed sleep, clock pause/seek, style change or coordinate conversion.
function awaitEventGeometry() {
  return new Promise((resolve) => {
    const start = performance.now(),
      maxMs = 250,
      maxFrames = 64,
      samples = [];
    let raf = 0,
      complete = false,
      stable = 0,
      previous = '';
    const finish = (aligned, reason) => {
      if (complete) return;
      complete = true;
      cancelAnimationFrame(raf);
      clearTimeout(deadline);
      resolve({
        aligned,
        reason,
        elapsedMs: performance.now() - start,
        maxMs,
        maxFrames,
        samples,
      });
    };
    const deadline = setTimeout(
      () =>
        finish(
          false,
          'Actual context/DOM geometry did not align before the native deadline',
        ),
      maxMs,
    );
    const poll = () => {
      const value = window.pokemonSavedEventProbe.geometry();
      samples.push({ at: performance.now(), ...value });
      const key = JSON.stringify({
        layout: value.layout,
        logicalSize: value.logicalSize,
        availableRect: value.availableRect,
        offset: value.offset,
        canvas: value.canvas,
        outer: value.outer,
        scroll: value.scroll,
        frameViewport: value.frameViewport,
      });
      stable =
        value.aligned && key === previous ? stable + 1 : value.aligned ? 1 : 0;
      previous = key;
      if (stable >= 2)
        finish(true, 'Two natural samples agree with current DOM geometry');
      else if (
        samples.length >= maxFrames ||
        performance.now() - start >= maxMs
      )
        finish(
          false,
          'Actual context/DOM geometry did not stabilize within the bounded frame budget',
        );
      else raf = requestAnimationFrame(poll);
    };
    poll();
  });
}

// Executes in the actual rendering document, also when surface is a real iframe.
// DOMRect and SVG matrixTransform results are both CSS window coordinates.
function observeEventStage(stage) {
  const probe = window.pokemonSavedEventProbe;
  const context = window.contractContext;
  const canvas = document.querySelector('[data-fixed-canvas]');
  const outer = document.querySelector('[data-canvas-viewport]');
  const main = document.querySelector('main');
  const rect = (node) => {
    if (!node) return null;
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
  const intersection = (a, b) => ({
    x: Math.max(a.x, b.x),
    y: Math.max(a.y, b.y),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom),
  });
  const canvasRect = rect(canvas);
  const available = context?.availableRect;
  const visibleCanvas = intersection(
    intersection(canvasRect, {
      x: 0,
      y: 0,
      right: innerWidth,
      bottom: innerHeight,
    }),
    available
      ? {
          x: available.x,
          y: available.y,
          right: available.x + available.width,
          bottom: available.y + available.height,
        }
      : canvasRect,
  );
  const visible = (node, ancestorsOnly = false) => {
    if (!node) return { shown: false, fullyVisible: false, rect: null };
    const bounds = rect(node);
    let clip = { ...visibleCanvas };
    const ancestors = [];
    for (
      let parent = ancestorsOnly ? node.parentElement : node;
      parent;
      parent = parent.parentElement
    ) {
      const style = getComputedStyle(parent);
      if (style.display === 'contents') continue;
      const r = rect(parent);
      const paddingBox = {
        x: r.x + parent.clientLeft,
        y: r.y + parent.clientTop,
        right: r.x + parent.clientLeft + parent.clientWidth,
        bottom: r.y + parent.clientTop + parent.clientHeight,
      };
      const contain = /(?:^|\s)(?:paint|strict|content)(?:\s|$)/.test(
        style.contain,
      );
      const clipX = style.overflowX !== 'visible' || contain;
      const clipY = style.overflowY !== 'visible' || contain;
      if (clipX) {
        clip.x = Math.max(clip.x, paddingBox.x);
        clip.right = Math.min(clip.right, paddingBox.right);
      }
      if (clipY) {
        clip.y = Math.max(clip.y, paddingBox.y);
        clip.bottom = Math.min(clip.bottom, paddingBox.bottom);
      }
      if (clipX || clipY)
        ancestors.push({
          className: parent.getAttribute('class') ?? '',
          paddingBox,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          contain: style.contain,
        });
    }
    const cssVisible = node.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    });
    const clipped = intersection(bounds, clip);
    return {
      rect: bounds,
      clip,
      ancestors,
      shown:
        cssVisible && clipped.right > clipped.x && clipped.bottom > clipped.y,
      fullyVisible:
        cssVisible &&
        bounds.width > 0 &&
        bounds.height > 0 &&
        bounds.x >= clip.x - 1 &&
        bounds.y >= clip.y - 1 &&
        bounds.right <= clip.right + 1 &&
        bounds.bottom <= clip.bottom + 1,
    };
  };
  const animation = (value) => ({
    id: probe.id(value),
    name: value.animationName ?? null,
    currentTime:
      typeof value.currentTime === 'number' ? value.currentTime : null,
    startTime: typeof value.startTime === 'number' ? value.startTime : null,
    playState: value.playState,
    pending: value.pending,
  });
  const nodes = [
    ...document.querySelectorAll(
      '.anime-entrance,.entrance-energy-field,.saved-action-trails,.saved-trail,.ex-board-effects,.ex-board-trail',
    ),
  ].map((node) => ({
    ...probe.describe(node),
    ...visible(node),
    animations: node.getAnimations().map(animation),
  }));
  const scenes = [...document.querySelectorAll('.anime-entrance')].map(
    (scene) => {
      const screen =
        scene.closest('.expansion-screen') ?? scene.closest('.pokemon-screen');
      const toolbar = rect(screen?.querySelector('.game-toolbar,.ex-toolbar'));
      const dashboard = rect(
        screen?.querySelector('.pokemon-status,.ex-round-banner'),
      );
      const actions = rect(
        screen?.querySelector('.player-action-bar,.ex-confirm-bar,.ex-submit'),
      );
      const top =
        Math.max(
          toolbar ? toolbar.bottom - canvasRect.y : 0,
          dashboard ? dashboard.bottom - canvasRect.y : 0,
        ) + 8;
      const heightLimit = context.logicalSize.height;
      const bottom =
        actions &&
        actions.bottom - canvasRect.y > top &&
        actions.y - canvasRect.y < heightLimit
          ? Math.max(top, actions.y - canvasRect.y - 8)
          : heightLimit - 12;
      return {
        ...probe.describe(scene),
        ...visible(scene),
        energy: visible(scene.querySelector('.entrance-energy-field')),
        expectedEnergy: {
          x: canvasRect.x,
          y: canvasRect.y + top,
          width: context.logicalSize.width,
          height: Math.max(0, bottom - top),
        },
        css: {
          position: getComputedStyle(scene).position,
          entranceTop:
            getComputedStyle(scene).getPropertyValue('--entrance-top'),
          entranceHeight:
            getComputedStyle(scene).getPropertyValue('--entrance-height'),
        },
        toolbar,
        dashboard,
        actions,
      };
    },
  );
  const original = !main.classList.contains('expansion-screen');
  const game = window.fixtureSession.view.gameView;
  const latest = game.events.at(-1);
  const originalAnchor = (id) => {
    if (id === '@held')
      return (
        main.querySelector('.held-pile .pokemon-card') ??
        main.querySelector('.held-zone')
      );
    if (id === '@deck' || id === '@discard')
      return main.querySelector(
        `.card-piles > div:nth-child(${id === '@deck' ? 1 : 2}) .pokemon-card,.card-piles > div:nth-child(${id === '@deck' ? 1 : 2}) .empty-pile`,
      );
    return main
      .querySelector(`[data-slot=${JSON.stringify(id)}]`)
      ?.querySelector('.card-surface');
  };
  const expansionAnchor = (id) => {
    if (id.startsWith('@')) {
      const [pile, seat] = id.slice(1).split(':');
      return main.querySelector(
        `[data-pile=${JSON.stringify(pile)}]${seat ? `[data-seat=${JSON.stringify(seat)}]` : ''}`,
      );
    }
    return main.querySelector(`[data-slot=${JSON.stringify(id)}]`);
  };
  const anchor = (id) => {
    const node = original ? originalAnchor(id) : expansionAnchor(id);
    const observation = visible(node, true);
    const center = observation.rect
      ? {
          x: observation.rect.x + observation.rect.width / 2,
          y: observation.rect.y + observation.rect.height / 2,
        }
      : null;
    const inClip =
      center &&
      center.x >= observation.clip.x &&
      center.x < observation.clip.right &&
      center.y >= observation.clip.y &&
      center.y < observation.clip.bottom;
    const hit = inClip ? document.elementFromPoint(center.x, center.y) : null;
    const hitOwned = Boolean(
      node && hit && (hit === node || node.contains(hit)),
    );
    return {
      key: id,
      id: node ? probe.id(node) : null,
      ...observation,
      center,
      centerVisible: Boolean(observation.shown && inClip && hitOwned),
      centerInAncestorClip: Boolean(inClip),
      centerHitOwned: hitOwned,
      centerHit: hit
        ? { tag: hit.tagName, className: hit.getAttribute('class') ?? '' }
        : null,
      centerHitStack: inClip
        ? document
            .elementsFromPoint(center.x, center.y)
            .slice(0, 12)
            .map((element) => ({
              tag: element.tagName,
              className: element.getAttribute('class') ?? '',
              owns: element === node || node.contains(element),
            }))
        : [],
    };
  };
  const paths = [
    ...document.querySelectorAll('.saved-trail,.ex-board-trail'),
  ].map((path) => {
    const group = path.closest('[data-from][data-to]');
    const from =
      group?.getAttribute('data-from') ??
      (latest?.action?.verb === 'draw' && latest.action.source
        ? '@' + latest.action.source
        : null);
    const to =
      group?.getAttribute('data-to') ??
      (latest?.action?.verb === 'draw' ? '@held' : null);
    const matrix = path.getScreenCTM();
    const total = path.getTotalLength();
    const transformed = (distance) => {
      if (!matrix) return null;
      const point = path.getPointAtLength(distance).matrixTransform(matrix);
      return { x: point.x, y: point.y };
    };
    const bounds = path.getBBox();
    const corners = matrix
      ? [
          [bounds.x, bounds.y],
          [bounds.x + bounds.width, bounds.y],
          [bounds.x, bounds.y + bounds.height],
          [bounds.x + bounds.width, bounds.y + bounds.height],
        ].map(([x, y]) => {
          const point = new DOMPoint(x, y).matrixTransform(matrix);
          return { x: point.x, y: point.y };
        })
      : [];
    return {
      ...probe.describe(path),
      ...visible(path),
      d: path.getAttribute('d'),
      length: total,
      matrix: matrix
        ? {
            a: matrix.a,
            b: matrix.b,
            c: matrix.c,
            d: matrix.d,
            e: matrix.e,
            f: matrix.f,
          }
        : null,
      from: from ? anchor(from) : null,
      to: to ? anchor(to) : null,
      start: transformed(0),
      end: transformed(total),
      geometryBounds: corners.length
        ? {
            x: Math.min(...corners.map((p) => p.x)),
            y: Math.min(...corners.map((p) => p.y)),
            right: Math.max(...corners.map((p) => p.x)),
            bottom: Math.max(...corners.map((p) => p.y)),
          }
        : null,
    };
  });
  return {
    stage,
    actualGeometry: probe.geometry(),
    time: performance.now(),
    layout: context.layout,
    logicalSize: context.logicalSize,
    availableRect: context.availableRect,
    offset: context.offset,
    revision: context.revision,
    viewport: {
      width: innerWidth,
      height: innerHeight,
      x: scrollX,
      y: scrollY,
    },
    canvas: canvasRect,
    outer: {
      rect: rect(outer),
      left: outer.scrollLeft,
      top: outer.scrollTop,
      clientWidth: outer.clientWidth,
      clientHeight: outer.clientHeight,
      scrollWidth: outer.scrollWidth,
      scrollHeight: outer.scrollHeight,
      overflowX: getComputedStyle(outer).overflowX,
      overflowY: getComputedStyle(outer).overflowY,
    },
    nodes,
    scenes,
    paths,
    supplyAnchors: ['@deck', '@held'].map(anchor),
    additions: [...probe.added],
    fixture: {
      revision: window.fixtureSession.view.revision,
      instanceId: window.fixtureSession.view.instanceId,
      phase: game.phase,
      eventId: latest?.id,
      action: latest?.action ?? null,
      peek: Boolean(game.peek),
      commands: structuredClone(window.fixtureCommands),
      status: structuredClone(window.pokemonEventControl.status),
    },
  };
}

export async function runPokemonSavedEventProof({
  page,
  surface,
  item,
  measure,
  assertLogical,
  settle,
  captureStage,
  frameIdentity,
  assertFrameIdentity,
  fixedCanvasLayouts,
}) {
  const evidence = {
    method:
      'Real authorized saved transactions, native UI, production event consumers and real browser animation objects.',
    stages: [],
    checks: [],
    screenshots: [],
    unsupported: [],
    boundaries: [
      'RoomCoordinator subscribe receipts and canonical GameHost delivery are source evidence, not socket or disk-persistence acceptance.',
      'No fake motion, replay consumer, CSS animation pause/seek, or test event clock is used.',
      'DOMRect and SVG screen matrices use actual CSS window coordinates once; no zoom or DPR divisor.',
      'Real parent resize creates overflow in the production canvas viewport; no spacer or artificial scroll document is inserted.',
    ],
  };
  const check = (pass, name, details) => {
    evidence.checks.push({ name, pass: Boolean(pass), details });
  };
  const unsupported = (name, details) => {
    evidence.unsupported.push({ name, details });
    check(false, name, details);
  };
  const frames = () =>
    surface.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
  const sameRect = (a, b) =>
    a &&
    b &&
    ['x', 'y', 'width', 'height'].every(
      (key) => Math.abs(a[key] - b[key]) <= 1,
    );
  const inside = (a, b) =>
    a &&
    b &&
    a.x >= b.x - 1 &&
    a.y >= b.y - 1 &&
    a.right <= b.right + 1 &&
    a.bottom <= b.bottom + 1;
  const take = async (stage, geometry = true) => {
    const alignment = await surface.evaluate(awaitEventGeometry);
    const observation = await surface.evaluate(observeEventStage, stage);
    observation.geometryAlignment = alignment;
    evidence.stages.push(observation);
    check(
      alignment.aligned && observation.actualGeometry.aligned,
      stage +
        ': context available rectangle and offset agree with current canvas/scrollport within the bounded natural measurement cycle',
      { alignment, actual: observation.actualGeometry },
    );
    if (geometry) {
      const measured = await measure(surface);
      observation.measured = measured;
      const expected = fixedCanvasLayouts.find(
        (value) =>
          (value.layout === 'host' ? 'host-landscape' : value.layout) ===
          observation.layout,
      );
      check(
        expected &&
          measured.logicalSize.width === expected.width &&
          measured.logicalSize.height === expected.height &&
          measured.canvas.width === expected.width &&
          measured.canvas.height === expected.height &&
          ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(measured.transform) &&
          measured.brokenImages.length === 0,
        stage + ': unchanged logical pixels and decoded images',
        { expected, actual: measured },
      );
    }
    return observation;
  };
  const inspectScene = (observation, required = true, allowPartial = false) => {
    if (
      !observation.geometryAlignment.aligned ||
      !observation.actualGeometry.aligned
    )
      return;
    const scenes = observation.scenes.filter((scene) => scene.scene === 'mew');
    if (required && !scenes.length) {
      unsupported(
        observation.stage +
          ': method inconclusive because the live entrance expired or never mounted',
        { fixture: observation.fixture, nodes: observation.nodes },
      );
      return;
    }
    check(
      !required || scenes.length === 1,
      observation.stage + ': one Mew entrance',
      { scenes: scenes.length },
    );
    for (const scene of scenes) {
      const liveNode = observation.nodes.find((node) => node.id === scene.id);
      if (
        !scene.shown &&
        liveNode?.animations.some((value) => value.playState === 'finished')
      ) {
        unsupported(
          observation.stage +
            ': method inconclusive at natural entrance expiry',
          liveNode,
        );
        continue;
      }
      check(
        sameRect(scene.rect, observation.canvas),
        observation.stage + ': entrance owns exactly the logical canvas',
        scene,
      );
      check(
        sameRect(scene.energy.rect, scene.expectedEnergy) &&
          (allowPartial ? scene.energy.shown : scene.energy.fullyVisible) &&
          scene.expectedEnergy.height > 0,
        observation.stage +
          ': energy offset applied once and visible in its actual clip',
        scene,
      );
    }
  };
  const inspectPaths = (observation, required = true) => {
    if (
      !observation.geometryAlignment.aligned ||
      !observation.actualGeometry.aligned
    )
      return;
    for (const root of observation.nodes.filter((node) =>
      /saved-action-trails|ex-board-effects/.test(node.className),
    ))
      check(
        sameRect(root.rect, observation.canvas),
        observation.stage + ': trail root owns exactly the logical canvas',
        root,
      );
    check(
      !required || observation.paths.length > 0,
      observation.stage + ': actual saved trail exists',
      { paths: observation.paths.length },
    );
    for (const path of observation.paths) {
      for (const [endpoint, target] of [
        ['start', 'from'],
        ['end', 'to'],
      ]) {
        const a = path[endpoint],
          b = path[target];
        check(
          a &&
            b?.centerVisible &&
            b.center &&
            Math.hypot(a.x - b.center.x, a.y - b.center.y) <= 1,
          observation.stage +
            ': SVG ' +
            endpoint +
            ' matches visible actual anchor within 1px',
          { pathId: path.id, endpoint: a, anchor: b },
        );
      }
      check(
        inside(path.geometryBounds, observation.canvas),
        observation.stage + ': path geometry stays inside logical canvas',
        path,
      );
    }
  };
  const continuous = (before, after, selector) => {
    const applicable = (node) => selector.test(node.className);
    const previous = before.nodes.filter(applicable);
    const next = after.nodes.filter(applicable);
    if (!previous.length || !next.length) {
      unsupported(
        after.stage +
          ': method inconclusive because live presentation expired or never mounted',
        { before: previous, after: next },
      );
      return;
    }
    check(
      previous.every((node) => next.some((other) => other.id === node.id)),
      after.stage + ': same live effect DOM nodes',
      { before: previous, after: next },
    );
    for (const node of previous) {
      const replacement = next.find((other) => other.id === node.id);
      for (const animation of node.animations) {
        const current = replacement?.animations.find(
          (value) => value.id === animation.id,
        );
        check(
          current &&
            (animation.startTime === null ||
              current.startTime === animation.startTime) &&
            (animation.currentTime === null ||
              (current.currentTime !== null &&
                current.currentTime >= animation.currentTime - 1)),
          after.stage +
            ': same Animation object, startTime and non-rewound currentTime',
          { nodeId: node.id, before: animation, after: current ?? null },
        );
      }
    }
    check(
      previous.some((node) => node.animations.length),
      after.stage + ': real animation identity was observable',
      previous,
    );
  };
  const inspectScroll = (before, after) => {
    const dx = after.outer.left - before.outer.left;
    const dy = after.outer.top - before.outer.top;
    check(
      dy > 1 &&
        after.outer.scrollHeight > after.outer.clientHeight &&
        after.outer.top <= after.outer.scrollHeight - after.outer.clientHeight,
      after.stage + ': production canvas viewport actually scrolled',
      { before: before.outer, after: after.outer },
    );
    if (
      !before.actualGeometry.aligned ||
      !after.actualGeometry.aligned ||
      !before.geometryAlignment.aligned ||
      !after.geometryAlignment.aligned
    )
      return;
    check(
      sameRect(before.availableRect, after.availableRect) &&
        after.revision > before.revision &&
        Math.abs(after.offset.x - after.canvas.x) <= 1 &&
        Math.abs(after.offset.y - after.canvas.y) <= 1 &&
        Math.abs(after.offset.x - before.offset.x + dx) <= 1 &&
        Math.abs(after.offset.y - before.offset.y + dy) <= 1,
      after.stage +
        ': fixed available rectangle and revised canvas offset follow real scroll once',
      {
        before: {
          availableRect: before.availableRect,
          offset: before.offset,
          revision: before.revision,
        },
        after: {
          availableRect: after.availableRect,
          offset: after.offset,
          revision: after.revision,
          canvas: after.canvas,
        },
        actualScrollDelta: { x: dx, y: dy },
      },
    );
  };
  let outerState;
  let initialViewport;
  let failure;
  async function hostBoard() {
    assert.equal(item.role, 'host');
    assert.equal(item.playerFrame, false);
    initialViewport = page.viewportSize();
    await page.setViewportSize({ width: 1500, height: 1000 });
    await settle(surface);
    const initial = await measure(surface);
    assertLogical(initial, item);
    evidence.initial = initial;
    const authority = await surface.evaluate(() => {
      const tx = window.pokemonEventControl.transactions[2];
      const current = window.fixtureSession.view;
      return {
        current,
        before: tx.before.host,
        beforeAnonymous: tx.before.anonymous,
        after: tx.after.host,
        afterAnonymous: tx.after.anonymous,
        feedback: tx.feedback,
        status: window.pokemonEventControl.status,
      };
    });
    assert.deepEqual(
      authority.current,
      authority.before,
      'First production host mount is exactly tx2.before.host',
    );
    for (const [view, anonymous] of [
      [authority.before, authority.beforeAnonymous],
      [authority.after, authority.afterAnonymous],
    ]) {
      assert.equal(view.self.seatId, null);
      assert.equal(view.actions.length, 0);
      assert.equal(view.gameView.peek ?? null, null);
      assert.deepEqual(view.gameView, anonymous.gameView);
    }
    assert.equal(authority.status.next, 2);
    evidence.hostAuthority = authority;
    evidence.boardCoverage = {
      applicable: true,
      source:
        'Actual subscribed tx2 draw-Mew before/after.host with the same RoomFeedback; initial mount is the real before projection. No player supply UI is invented.',
    };
    await surface.evaluate(installProbe);
    const before = await take('host-board-initial');
    check(
      before.supplyAnchors.every((anchor) => anchor.centerVisible),
      'Both actual public host supply anchors are visible before the saved draw',
      before.supplyAnchors,
    );
    check(
      !before.nodes.length,
      'Initial host snapshot does not replay old saved events',
      before.nodes,
    );
    await surface.evaluate(() => window.pokemonEventControl.observer(2));
    const remaining = await surface.evaluate(() =>
      Math.max(
        1,
        Math.ceil(
          window.pokemonEventControl.status.deadline - performance.now(),
        ),
      ),
    );
    await surface.waitForFunction(
      () => document.querySelector('.ex-board-trail'),
      null,
      { timeout: remaining },
    );
    const offset = await take('host-board-offset', false);
    inspectPaths(offset);
    check(
      Math.abs(offset.canvas.x) > 1 && Math.abs(offset.canvas.y) > 1,
      'Host board has a real offset on both axes',
      offset.canvas,
    );
    await page.setViewportSize({ width: 1279, height: 719 });
    const short = await take('host-board-short', false);
    // Some centers can be clipped before scrolling to the actual end. This
    // checkpoint establishes coherent geometry/identity, not visible anchors.
    continuous(offset, short, /ex-board-trail/);
    await surface.evaluate(() => {
      const outer = document.querySelector('[data-canvas-viewport]');
      outer.scrollTo({
        left: outer.scrollWidth,
        top: outer.scrollHeight,
        behavior: 'instant',
      });
    });
    const scrolled = await take('host-board-scrolled', false);
    inspectPaths(scrolled);
    inspectScroll(short, scrolled);
    check(
      scrolled.outer.left - short.outer.left > 1,
      'Host viewport actually scrolls horizontally as well',
      { before: short.outer, after: scrolled.outer },
    );
    continuous(short, scrolled, /ex-board-trail/);
    if (captureStage) {
      const beforeCapture = await take('host-before-live-capture', false);
      const reference = await captureStage('pokemon-host-saved-board-live');
      const afterCapture = await take('host-after-live-capture', false);
      const live =
        beforeCapture.paths.length > 0 && afterCapture.paths.length > 0;
      evidence.screenshots.push({
        stage: 'host-board-live',
        animationPolicy: 'allow',
        live,
        beforeCapture,
        afterCapture,
        reference,
        classification: live
          ? 'Real board paths exist before and after this actual PNG'
          : 'Non-live: natural board phase expired during capture; method inconclusive',
      });
      check(
        reference?.animations === 'allow',
        'Host live PNG does not fast-forward native animations',
        reference,
      );
      check(
        live,
        'Host live capture is inconclusive if its native 540ms phase naturally expired',
        { before: beforeCapture.paths, after: afterCapture.paths },
      );
    }
    const completionBudget = await surface.evaluate(() =>
      Math.max(
        1,
        Math.ceil(
          window.pokemonEventControl.status.deadline - performance.now(),
        ),
      ),
    );
    await surface.waitForFunction(
      () => !document.querySelector('.ex-board-effects'),
      null,
      { timeout: completionBudget },
    );
    const final = await surface.evaluate(() => ({
      commands: window.fixtureCommands,
      status: window.pokemonEventControl.status,
      view: window.fixtureSession.view,
      mounts: window.contractMounts,
      unmounts: window.contractUnmounts,
    }));
    evidence.hostFinal = final;
    check(
      isDeepStrictEqual(final.commands, []) &&
        isDeepStrictEqual(final.status.accepted, []) &&
        isDeepStrictEqual(final.status.observerDeliveries, [2]) &&
        final.status.next === 3 &&
        final.status.errors.length === 0,
      'Host delivers only the actual observer transaction and never submits a player command',
      final.status,
    );
    check(
      final.view.instanceId === authority.before.instanceId &&
        final.view.branch === authority.before.branch &&
        final.view.revision === authority.after.revision &&
        final.mounts === initial.mounts &&
        final.unmounts === initial.unmounts,
      'Host authority advances exactly once with the same mounted production instance',
      final,
    );
    const failures = evidence.checks.filter((value) => !value.pass);
    assert.equal(
      failures.length,
      0,
      JSON.stringify(failures.map(({ name }) => name).slice(0, 8)),
    );
  }
  async function playerSequence() {
    assert.equal(
      item.role,
      'player',
      'Saved-event proof uses the actual authorized player',
    );
    const prepared = await surface.evaluate(() => {
      const control = window.pokemonEventControl;
      if (!control || control.transactions.length < 4)
        throw new Error('Missing four real saved transactions');
      return control.transactions.map((transaction) => ({
        intent: transaction.intent,
        before: {
          revision: transaction.before.player.revision,
          peek: Boolean(transaction.before.player.gameView.peek),
        },
        after: {
          revision: transaction.after.player.revision,
          hostPeek: Boolean(transaction.after.host.gameView.peek),
          anonymousPeek: Boolean(transaction.after.anonymous.gameView.peek),
          playerPeek: Boolean(transaction.after.player.gameView.peek),
          phase: transaction.after.player.gameView.phase,
          event: transaction.after.player.gameView.events.at(-1),
        },
        feedback: transaction.feedback,
        reply: transaction.reply,
      }));
    });
    evidence.transactions = prepared;
    assert.equal(prepared[0].intent.action.type, 'peek');
    assert.equal(prepared[1].intent.action.type, 'close-peek');
    assert(
      prepared.every((tx) => tx.feedback),
      'Every transaction has its real subscribe feedback',
    );
    check(
      prepared[0].after.playerPeek &&
        !prepared[0].after.hostPeek &&
        !prepared[0].after.anonymousPeek,
      'Private peek is present only in the authorized player projection',
      prepared[0].after,
    );
    initialViewport = page.viewportSize();
    await page.setViewportSize({ width: 1280, height: 1000 });
    const control = surface.getByRole('combobox', {
      name: '显示布局',
      exact: true,
    });
    await control.selectOption('wide');
    await settle(surface);
    const wide = fixedCanvasLayouts.find(
      (value) => value.layout === 'player-landscape',
    );
    const initial = await measure(surface);
    assertLogical(initial, { ...item, ...wide });
    evidence.initial = initial;
    const controlNode = await control.elementHandle();
    assert(controlNode, 'Actual layout select exists');
    evidence.frame = item.playerFrame ? await frameIdentity(page, true) : null;
    await surface.evaluate(installProbe);
    const baseline = await take('initial-snapshot');
    check(
      baseline.nodes.length === 0,
      'Initial saved snapshot does not play an entrance or trail',
      baseline.nodes,
    );
    const slot = await surface.evaluate(() => {
      const transaction = window.pokemonEventControl.transactions[0];
      const view = window.fixtureSession.view;
      const action = transaction.intent.action;
      return view.gameView.boards[view.self.seatId][action.slot].slotId;
    });
    const card = surface.locator(
      `main button.card-slot[data-slot=${JSON.stringify(slot)}]:visible`,
    );
    assert.equal(
      await card.count(),
      1,
      'Exactly one actual selectable peek card',
    );
    await card.click();
    const confirm = surface.locator(
      'main .confirm-action:visible,main .ex-submit button[data-action="peek"]:visible',
    );
    assert.equal(
      await confirm.count(),
      1,
      'Exactly one actual peek confirmation',
    );
    await confirm.click();
    const delivered = (index) =>
      surface.waitForFunction(
        (value) =>
          window.fixtureSession.view.revision ===
          window.pokemonEventControl.transactions[value].after.player.revision,
        index,
        { timeout: 3000 },
      );
    await delivered(0);
    await frames();
    const peek = await take('real-peek-committed');
    check(
      peek.fixture.peek,
      'Actual selected peek exposes the authorized private result',
      peek.fixture,
    );
    await surface.evaluate(() => window.pokemonEventControl.expire());
    const close = surface.locator(
      'main .close-peek-action:visible,main button[data-action="close-peek"]:visible',
    );
    assert.equal(
      await close.count(),
      1,
      'Exactly one actual close-peek control',
    );
    await close.click();
    await delivered(1);
    await surface.evaluate(() => window.pokemonEventControl.expire());
    const closed = await take('real-close-peek-committed');
    check(
      !closed.fixture.peek,
      'Actual close-peek removes the private result',
      closed.fixture,
    );
    outerState = await surface.evaluate(() => {
      const outer = document.querySelector('[data-canvas-viewport]');
      const previous = { x: outer.scrollLeft, y: outer.scrollTop };
      outer.scrollTo({ left: 0, top: 0, behavior: 'instant' });
      return previous;
    });
    await settle(surface);
    await surface.evaluate(() => window.pokemonEventControl.observer(2));
    await delivered(2);
    await surface.waitForFunction(
      () => document.querySelector('.anime-entrance[data-scene="mew"]'),
      null,
      { timeout: 2500 },
    );
    await frames();
    const live = await take('mew-live-offset');
    inspectScene(live);
    const expansion = item.variant === 'expansion';
    evidence.disabledContract = expansion
      ? {
          delivery:
            'Real subscribed feedback and real savedChanges motion arrive while disconnected; restore repeats those same actual values.',
          claim:
            'Production ExpansionPresentation seen/cancel prevents backfill.',
        }
      : {
          delivery:
            'The original host sync boundary supplies the authoritative view without feedback or motion while disabled.',
          claim:
            'Host-boundary sync does not backfill; this is not an invented original-client receipt filter or an original late-feedback dedupe proof.',
        };
    if (!expansion) inspectPaths(live);
    check(
      Math.abs(live.canvas.x) > 1 && Math.abs(live.canvas.y) > 1,
      'Live entrance is tested at a real nonzero canvas offset',
      live.canvas,
    );
    await page.setViewportSize({ width: 700, height: 300 });
    await surface.evaluate(() =>
      document.querySelector('[data-canvas-viewport]').scrollTo({
        left: 0,
        top: 0,
        behavior: 'instant',
      }),
    );
    await frames();
    const short = await take('mew-live-short-before-scroll');
    inspectScene(short, true, true);
    if (!expansion) inspectPaths(short);
    continuous(live, short, /anime-entrance|entrance-energy-field|saved-trail/);
    await surface.evaluate(() =>
      document.querySelector('[data-canvas-viewport]').scrollTo({
        left: 0,
        top: 32,
        behavior: 'instant',
      }),
    );
    await frames();
    const scrolled = await take('mew-live-outer-scroll');
    inspectScroll(short, scrolled);
    inspectScene(scrolled, true, true);
    if (!expansion) inspectPaths(scrolled);
    continuous(
      short,
      scrolled,
      /anime-entrance|entrance-energy-field|saved-trail/,
    );
    await page.setViewportSize({ width: 1280, height: 1000 });
    await frames();
    const fitsAgain = await take('mew-live-restored-large-viewport');
    inspectScene(fitsAgain);
    if (!expansion) inspectPaths(fitsAgain);
    continuous(
      scrolled,
      fitsAgain,
      /anime-entrance|entrance-energy-field|saved-trail/,
    );
    let previous = fitsAgain;
    for (const preference of ['portrait', 'wide']) {
      await control.focus();
      await control.selectOption(preference);
      await surface.waitForFunction(
        (value) => window.contractContext.layout === value,
        preference === 'portrait' ? 'player-portrait' : 'player-landscape',
        { timeout: 1500 },
      );
      await frames();
      const switched = await take('mew-live-' + preference);
      inspectScene(switched);
      if (!expansion) inspectPaths(switched);
      continuous(
        previous,
        switched,
        /anime-entrance|entrance-energy-field|saved-trail/,
      );
      check(
        await controlNode.evaluate(
          (node) => node.isConnected && document.activeElement === node,
        ),
        switched.stage + ': same native select and focus',
      );
      if (item.playerFrame) {
        switched.frame = await frameIdentity(page);
        try {
          assertFrameIdentity(switched.frame, evidence.frame);
          check(true, switched.stage + ': actual iframe identity survives');
        } catch (error) {
          check(false, switched.stage + ': actual iframe identity survives', {
            error: error.message,
            before: evidence.frame,
            after: switched.frame,
          });
        }
      }
      previous = switched;
    }
    await surface.evaluate(() => window.pokemonEventControl.repeat());
    await frames();
    const repeat = await take('mew-live-repeat');
    continuous(
      previous,
      repeat,
      /anime-entrance|entrance-energy-field|saved-trail/,
    );
    check(
      repeat.additions.length === previous.additions.length,
      'Repeated same saved frame does not append a fresh live effect',
      { before: previous.additions, after: repeat.additions },
    );
    if (expansion) {
      const observerBoundary = await surface.evaluate(() => ({
        actions: window.fixtureSession.view.actions.length,
        observing: Boolean(document.querySelector('.ex-actions.ex-observing')),
        deck: document.querySelectorAll('.expansion-screen [data-pile="deck"]')
          .length,
        held: document.querySelectorAll('.expansion-screen [data-pile="held"]')
          .length,
      }));
      evidence.boardCoverage = {
        applicable: false,
        reason:
          'The authorized observer UI contains its own board/buffer, with no visible public deck/held pair. The real saved draw still mounts its board phase, but this projection cannot support a path-endpoint assertion.',
        actual: observerBoundary,
        delegatedCaseId: 'integration-expansion-host-n6-saved-board',
        priorTimeout:
          '4510be93 is retained as a failed method; no past report is upgraded.',
      };
      check(
        observerBoundary.actions === 0 &&
          observerBoundary.observing &&
          !observerBoundary.deck &&
          !observerBoundary.held,
        'This player case explicitly delegates the unavailable board-anchor coverage to the separate real host transaction',
        evidence.boardCoverage,
      );
    }
    if (captureStage) {
      const beforeCapture = await take('before-live-capture-metadata', false);
      const reference = await captureStage('pokemon-saved-event-live');
      const afterCapture = await take('after-live-capture-metadata', false);
      const live =
        beforeCapture.nodes.length > 0 && afterCapture.nodes.length > 0;
      evidence.screenshots.push({
        stage: 'after-live-observations',
        animationPolicy: 'allow; no screenshot animation fast-forward',
        live,
        classification: live
          ? 'Live DOM/Animation metadata exists on both sides of the actual PNG'
          : 'Non-live image; natural presentation expired before or during capture, method inconclusive',
        beforeCapture,
        afterCapture,
        reference,
      });
      check(
        reference?.animations === 'allow',
        'Actual event PNG allows native animation without screenshot fast-forward',
        reference,
      );
      check(
        live,
        'Live screenshot: method inconclusive if the natural effect expired before or during capture',
        { before: beforeCapture.nodes, after: afterCapture.nodes },
      );
    }
    await surface.evaluate(() => window.pokemonEventControl.expire());
    await frames();
    const expired = await take('mew-expired');
    check(
      !expired.nodes.length,
      'Real presentation expiry removes the entrance and trails',
      expired.nodes,
    );
    await surface.evaluate(() => window.pokemonEventControl.repeat());
    await frames();
    const repeatedExpired = await take('expired-frame-repeat');
    check(
      !repeatedExpired.nodes.length &&
        repeatedExpired.additions.length === expired.additions.length,
      'Expired duplicate saved frame does not replay',
      repeatedExpired,
    );
    await surface.evaluate(() => window.pokemonEventControl.disabled(3));
    await delivered(3);
    await frames();
    const disabled = await take('disabled-saved-arrival');
    check(
      !disabled.nodes.length &&
        disabled.additions.length === repeatedExpired.additions.length,
      'Disabled actual saved arrival does not play',
      disabled,
    );
    await surface.evaluate(() => window.pokemonEventControl.restore());
    await frames();
    const restored = await take('disabled-restored');
    await surface.evaluate(() => window.pokemonEventControl.expire());
    const afterDisabled = await take('disabled-expired');
    check(
      !restored.nodes.length &&
        !afterDisabled.nodes.length &&
        afterDisabled.additions.length === disabled.additions.length,
      expansion
        ? 'Production expansion seen/cancel prevents backfill after re-enabling'
        : 'Original authoritative sync without presentation remains quiet after re-enabling',
      { restored, afterDisabled },
    );
    const commands = afterDisabled.fixture.commands;
    check(
      commands.length === 2,
      'Only actual peek and close-peek UI commands were sent',
      commands,
    );
    for (let index = 0; index < 2; index++)
      check(
        isDeepStrictEqual(
          commands[index]?.action,
          prepared[index].intent.action,
        ) &&
          commands[index]?.decisionId === prepared[index].intent.decisionId &&
          commands[index]?.type === 'game',
        'Real UI command matches authoritative intent ' + index,
        { actual: commands[index], expected: prepared[index].intent },
      );
    const status = afterDisabled.fixture.status;
    check(
      isDeepStrictEqual(
        status.accepted.map((entry) => entry.index),
        [0, 1],
      ) &&
        isDeepStrictEqual(status.observerDeliveries, [2]) &&
        isDeepStrictEqual(status.disabled, [3]) &&
        status.next === 4 &&
        status.errors.length === 0,
      'Canonical fixture delivered the exact four authoritative transactions in order',
      status,
    );
    const failures = evidence.checks.filter((value) => !value.pass);
    assert.equal(
      failures.length,
      0,
      JSON.stringify(failures.map(({ name }) => name).slice(0, 8)),
    );
  }
  try {
    if (item.eventRole === 'host-board') await hostBoard();
    else await playerSequence();
  } catch (error) {
    failure = error;
    try {
      evidence.failureObservation = await surface.evaluate(
        observeEventStage,
        'failure-final-observation',
      );
    } catch (observationError) {
      evidence.failureObservationError = String(observationError.message);
    }
  } finally {
    try {
      if (outerState)
        await surface.evaluate((previous) => {
          document.querySelector('[data-canvas-viewport]')?.scrollTo({
            left: previous.x,
            top: previous.y,
            behavior: 'instant',
          });
        }, outerState);
      if (initialViewport) await page.setViewportSize(initialViewport);
    } catch (error) {
      evidence.cleanupError = error.message;
      failure ??= error;
    }
  }
  if (failure) {
    failure.pokemonEventEvidence = evidence;
    throw failure;
  }
  return evidence;
}
