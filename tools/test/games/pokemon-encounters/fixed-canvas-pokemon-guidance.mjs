import assert from 'node:assert/strict';
import { measurePokemonTextAndActions } from './fixed-canvas-pokemon.mjs';

const preferenceKey = 'tablemax-guidance:pokemon-encounters';
const frames = (surface) =>
  surface.evaluate(
    () =>
      new Promise((done) =>
        requestAnimationFrame(() => requestAnimationFrame(done)),
      ),
  );
const dialogName = '本次操作说明';

async function setGuidance(surface, enabled) {
  await surface.getByRole('button', { name: '菜单', exact: true }).click();
  const menu = surface.getByRole('dialog', { name: '牌桌菜单', exact: true });
  await menu.getByRole('button', { name: '游戏设置', exact: true }).click();
  const settings = surface.getByRole('dialog', {
    name: '游戏设置',
    exact: true,
  });
  const toggle = settings.getByRole('switch', {
    name: '本机新手引导',
    exact: true,
  });
  const previous = (await toggle.getAttribute('aria-checked')) === 'true';
  if (previous !== enabled) await toggle.click();
  assert.equal(await toggle.getAttribute('aria-checked'), String(enabled));
  const stored = await surface.evaluate(
    (key) => localStorage.getItem(key),
    preferenceKey,
  );
  if (previous !== enabled || stored !== null)
    assert.equal(stored, String(enabled));
  await toggle.press('Escape');
  await settings.waitFor({ state: 'detached' });
  assert(
    await menu
      .getByRole('button', { name: '游戏设置', exact: true })
      .evaluate((node) => document.activeElement === node),
  );
  await menu.press('Escape');
  await menu.waitFor({ state: 'detached' });
  assert(
    await surface
      .getByRole('button', { name: '菜单', exact: true })
      .evaluate((node) => document.activeElement === node),
  );
  return previous;
}

async function draft(surface) {
  return surface.evaluate(() => ({
    selected: [
      ...document.querySelectorAll('.pokemon-player .card-slot.selected'),
    ].map((node) => node.dataset.slot),
    confirm: document
      .querySelector('.pokemon-player .confirm-action')
      ?.getAttribute('aria-label'),
    view: JSON.stringify(window.fixtureSession.view),
    commands: window.fixtureCommands.length,
    mounts: window.contractMounts,
    unmounts: window.contractUnmounts,
  }));
}

async function chooseLegalSlot(surface, lastDark) {
  const selected = await surface.evaluate((endBoundary) => {
    const view = window.fixtureSession.view;
    const action = view.actions.find(
      (candidate) =>
        candidate.type === 'replace' &&
        candidate.slot === (endBoundary ? 1 : 0),
    );
    if (!action) throw new Error('Missing actual authorized replace selection');
    return {
      action,
      decisionId: view.decisionId,
      slotId: view.gameView.boards[view.self.seatId][action.slot].slotId,
    };
  }, lastDark);
  const slot = surface.locator(
    `.pokemon-player .card-slot[data-slot=${JSON.stringify(selected.slotId)}]`,
  );
  assert.equal(await slot.count(), 1);
  await slot.click();
  assert(await slot.evaluate((node) => node.classList.contains('selected')));
  const expected = await surface.evaluate(
    (action) => window.fixtureReadGuidance(action),
    selected.action,
  );
  assert(expected.ability, 'A real held ability has complete guidance');
  if (lastDark) {
    assert(expected.condition?.includes('即结算'));
    assert(expected.notice?.includes('立即结算'));
  } else
    assert(
      expected.target,
      'The actual face-up authorized target has a distinct ability summary',
    );
  return { ...selected, expected };
}

async function guidanceContents(dialog, expected) {
  const outerPosition = () =>
    dialog.evaluate(() => {
      const outer = document.querySelector('[data-canvas-viewport]');
      return {
        x: outer.scrollLeft,
        y: outer.scrollTop,
        windowX: scrollX,
        windowY: scrollY,
      };
    });
  const outerBefore = await outerPosition();
  const fields = [
    ['.guidance-full-instruction', expected.instruction],
    ...['ability', 'target'].flatMap((kind) =>
      expected[kind]
        ? [
            [
              `.guidance-full-summary[data-summary-kind=${kind}] h3`,
              expected[kind].name,
            ],
            [
              `.guidance-full-summary[data-summary-kind=${kind}] .guidance-full-ability`,
              expected[kind].summary,
            ],
            [
              `.guidance-full-summary[data-summary-kind=${kind}] .guidance-full-trigger`,
              expected[kind].trigger,
            ],
          ]
        : [],
    ),
    ...(expected.notice ? [['.guidance-full-notice', expected.notice]] : []),
  ];
  const results = [];
  for (const [selector, text] of fields) {
    const field = dialog.locator(selector);
    assert.equal(await field.count(), 1, selector);
    assert.equal((await field.innerText()).trim(), text);
    await field.scrollIntoViewIfNeeded();
    const value = await field.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect(),
        box = node.getBoundingClientRect();
      return {
        text: node.textContent,
        range: { x: r.x, y: r.y, width: r.width, height: r.height },
        box: { x: box.x, y: box.y, width: box.width, height: box.height },
        fontSize: getComputedStyle(node).fontSize,
      };
    });
    assert(Number.parseFloat(value.fontSize) >= 16);
    assert(
      value.range.x >= value.box.x - 0.5 &&
        value.range.y >= value.box.y - 0.5 &&
        value.range.x + value.range.width <=
          value.box.x + value.box.width + 0.5 &&
        value.range.y + value.range.height <=
          value.box.y + value.box.height + 0.5,
      'Complete guidance uses a complete main glyph line box: ' +
        JSON.stringify(value),
    );
    results.push({ selector, text, ...value });
  }
  assert.deepEqual(
    await outerPosition(),
    outerBefore,
    'Reaching complete modal guidance fields scrolls only its own content',
  );
  return results;
}

async function independentScroll(dialog) {
  return dialog.evaluate(async (root) => {
    const nodes = [root, ...root.querySelectorAll('*')].filter(
      (node) =>
        ['auto', 'scroll'].includes(getComputedStyle(node).overflowY) &&
        node.scrollHeight > node.clientHeight + 1,
    );
    if (!nodes.length) return { applicable: false };
    const node = nodes.at(-1),
      outer = document.querySelector('[data-canvas-viewport]');
    const outerBefore = {
      x: outer.scrollLeft,
      y: outer.scrollTop,
      windowX: scrollX,
      windowY: scrollY,
    };
    node.scrollTop = 0;
    node.scrollTo({ top: node.scrollHeight, behavior: 'instant' });
    await new Promise((done) =>
      requestAnimationFrame(() => requestAnimationFrame(done)),
    );
    return {
      applicable: true,
      actual: node.scrollTop,
      extent: node.scrollHeight - node.clientHeight,
      outerBefore,
      outerAfter: {
        x: outer.scrollLeft,
        y: outer.scrollTop,
        windowX: scrollX,
        windowY: scrollY,
      },
    };
  });
}

/** Internal selected case. Actual setting/overlay; controlled GameHost error UI. */
export async function runPokemonGuidanceProof({
  page,
  surface,
  item,
  measure,
  assertLogical,
  settle,
  captureStage,
  frameIdentity,
  assertFrameIdentity,
}) {
  const evidence = {
    boundary:
      'Real production PlayerFrame/PlatformGame/setting/OverlayPanel and authorized guidance. Last-dark is a complete validated initialized-state boundary. Pending/error/retry are explicit controlled presentation flags, not network/idempotency proof.',
    stages: [],
  };
  let initialToggle;
  const originalViewport = page.viewportSize();
  try {
    const before = await measure(surface);
    assertLogical(before, item);
    const iframeBefore = await frameIdentity(page, true);
    initialToggle = await setGuidance(surface, false);
    await setGuidance(surface, true);
    const selected = await chooseLegalSlot(
      surface,
      item.scene === 'guidance-last-dark',
    );
    evidence.selection = selected;
    const baseline = await draft(surface);
    const text = await surface.evaluate(measurePokemonTextAndActions);
    evidence.mainText = text;
    assert.equal(
      text.issues.length,
      0,
      JSON.stringify(text.issues.slice(0, 20)),
    );
    if (item.scene === 'guidance-last-dark') {
      assert(
        (await surface.locator('.guidance-primary').innerText()).includes(
          '即结算',
        ),
        'The real end-of-round condition remains in the main operation area',
      );
      assert(
        (
          await surface
            .locator('.pokemon-player .submit-choice > p')
            .innerText()
        ).includes('位置 2'),
        'The actual selected last-dark position stays in the main decision area',
      );
    }
    const launcher = surface.getByRole('button', {
      name: '本次操作详细说明',
      exact: true,
    });
    const launcherNode = await launcher.elementHandle();
    assert(launcherNode);
    const launcherSize = await launcher.boundingBox();
    assert(
      launcherSize && launcherSize.width >= 43.5 && launcherSize.height >= 43.5,
    );
    await launcher.click();
    const dialog = surface.getByRole('dialog', {
      name: dialogName,
      exact: true,
    });
    const dialogNode = await dialog.elementHandle();
    assert(dialogNode);
    for (const size of [
      { width: 640, height: 360 },
      { width: 360, height: 800 },
      { width: 360, height: 240 },
    ]) {
      await page.setViewportSize(size);
      await frames(surface);
      assert(
        await dialogNode.evaluate((node) => node.isConnected && node.open),
      );
      assert(
        await dialog.evaluate(
          (node, original) => node === original,
          dialogNode,
        ),
      );
      assert.deepEqual(
        await draft(surface),
        baseline,
        'Actual selected draft, authority and mount counts survive the real modal resize',
      );
      assertFrameIdentity(await frameIdentity(page), iframeBefore);
      const contents = await guidanceContents(dialog, selected.expected);
      const scroll = await independentScroll(dialog);
      evidence.stages.push({
        size,
        layout: (await measure(surface)).layout,
        contents,
        scroll,
        ...(captureStage
          ? {
              screenshot: await captureStage(
                `guidance-${size.width}x${size.height}`,
              ),
            }
          : {}),
      });
    }
    assert(
      evidence.stages.some((stage) => stage.layout === 'player-portrait') &&
        evidence.stages.some((stage) => stage.layout === 'player-landscape'),
      'Real viewport fallback switches layout while the native modal prevents external select interaction',
    );
    const scrolling = evidence.stages.find((stage) => stage.scroll.applicable);
    assert(
      scrolling && scrolling.scroll.actual > 0,
      'Actual complete dynamic guidance independently scrolls in the controlled short viewport, without filler',
    );
    assert.deepEqual(scrolling.scroll.outerAfter, scrolling.scroll.outerBefore);
    await page.setViewportSize(originalViewport);
    await frames(surface);
    await dialog.press('Escape');
    await dialog.waitFor({ state: 'detached' });
    assert(
      await launcherNode.evaluate(
        (node) => node.isConnected && document.activeElement === node,
      ),
    );
    assert.deepEqual(await draft(surface), baseline);
    assertFrameIdentity(await frameIdentity(page), iframeBefore);

    // Explicit separate load boundary: persistence is not an iframe identity
    // claim across a page reload. No localStorage seed replaces the switch.
    await page.reload();
    await page.evaluate((value) => window.renderFixedCase(value), item);
    await page.waitForFunction(
      () =>
        document.querySelector('iframe[data-player-frame]')?.contentWindow
          ?.fixtureSession,
    );
    surface = page
      .frames()
      .find((frame) => frame.parentFrame() === page.mainFrame());
    assert(surface);
    await settle(surface);
    assert.equal(
      await surface.evaluate((key) => localStorage.getItem(key), preferenceKey),
      'true',
    );
    assert.equal(await setGuidance(surface, true), true);
    const reselected = await chooseLegalSlot(
      surface,
      item.scene === 'guidance-last-dark',
    );
    await surface
      .getByRole('button', { name: '本次操作详细说明', exact: true })
      .click();
    await guidanceContents(
      surface.getByRole('dialog', { name: dialogName, exact: true }),
      reselected.expected,
    );
    await surface
      .getByRole('dialog', { name: dialogName, exact: true })
      .press('Escape');
    evidence.persistence = {
      separateReload: true,
      actualSwitchRead: true,
      seededStorage: false,
    };

    const confirm = surface.locator('.pokemon-player .confirm-action');
    assert.equal(await confirm.count(), 1);
    await confirm.click();
    const commands = await surface.evaluate(() => window.fixtureCommands);
    assert.deepEqual(commands, [
      {
        type: 'game',
        decisionId: reselected.decisionId,
        action: reselected.action,
      },
    ]);
    await surface.evaluate(() =>
      window.pokemonGuidanceControl.publish({
        locked: true,
        busy: true,
        awaitingConfirmation: true,
        message: '正在等待保存确认',
        messageKind: 'progress',
      }),
    );
    assert(
      (await surface.locator('.guidance-primary').innerText()).includes(
        '正在提交',
      ),
    );
    await surface.evaluate(() =>
      window.pokemonGuidanceControl.publish({
        locked: true,
        busy: false,
        awaitingConfirmation: true,
        message: '无法确认是否已保存，请重试确认',
        messageKind: 'error',
      }),
    );
    assert(
      (await surface.locator('.session-feedback').innerText()).includes(
        '无法确认是否已保存',
      ),
    );
    const retry = surface.getByRole('button', {
      name: '重试确认',
      exact: true,
    });
    await retry.click();
    assert.equal(await surface.evaluate(() => window.fixtureRetryCalls), 1);
    assert.equal(
      (await surface.evaluate(() => window.fixtureCommands)).length,
      1,
    );
    await surface.evaluate(() =>
      window.pokemonGuidanceControl.publish({
        locked: false,
        busy: false,
        awaitingConfirmation: false,
        message: '',
        messageKind: 'none',
      }),
    );
    await setGuidance(surface, false);
    assert.equal(
      await surface
        .getByRole('button', { name: '本次操作详细说明', exact: true })
        .count(),
      0,
    );
    await setGuidance(surface, true);
    await setGuidance(surface, initialToggle);
    evidence.presentation = {
      actualLegalCanonicalIntents: commands,
      controlledRetryCallbacks: 1,
      unsolicitedGameCommands: 0,
    };
    return evidence;
  } catch (error) {
    error.pokemonGuidanceEvidence = evidence;
    throw error;
  } finally {
    if (originalViewport) await page.setViewportSize(originalViewport);
  }
}
