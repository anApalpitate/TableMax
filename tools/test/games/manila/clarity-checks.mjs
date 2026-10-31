import assert from 'node:assert/strict';

const cargoNames = {
  nutmeg: '肉豆蔻',
  silk: '丝绸',
  ginseng: '人参',
  jade: '翡翠',
};
const incomeNames = {
  cargo: '货船分红',
  piracy: '海盗分红',
  port: '港口收入',
  shipyard: '修船坞收入',
  insurance: '保险入场收入',
};
const expenseNames = {
  auction: '竞拍支出',
  shares: '购股支出',
  placement: '派遣支出',
  insurance: '保险实付',
};

export async function registerClarityChecks({
  page,
  load,
  tap,
  settle,
  shot,
  width,
  height,
  report,
  run,
  context,
}) {
  const roles = process.argv
    .find((argument) => argument.startsWith('--roles='))
    ?.slice('--roles='.length)
    .split(',') ?? ['player', 'host'];
  const commands = () => page.evaluate(() => window.commands);
  const update = async (patch) => {
    const value = await page.evaluate(
      (value) => window.harbor.update(value),
      patch,
    );
    await settle();
    return value;
  };
  const noCommands = async (label) =>
    assert.deepEqual(await commands(), [], label);
  const guidanceEntry = () =>
    page.locator('.mn-action-link,.mn-payment-link').first();
  const guidanceState = () =>
    page.evaluate(() => {
      const area = document.querySelector('#mn-action-area');
      const owner = document.querySelector('.mn-player-scroll');
      const heading =
        area?.querySelector('h2:not(.mn-sr-only)') ??
        area?.querySelector('[data-mn-primary-control]');
      const control =
        area?.querySelector('[data-mn-primary-control]:not(:disabled)') ??
        area?.querySelector(
          'input:not(:disabled),select:not(:disabled),button:not(:disabled)',
        );
      const entry = document.querySelector('.mn-action-link,.mn-payment-link');
      const visible = (node) => {
        if (!node || !owner) return false;
        const root = owner.getBoundingClientRect();
        const box = node.getBoundingClientRect();
        return (
          box.width > 0 &&
          box.height > 0 &&
          Math.min(box.bottom, root.bottom, innerHeight) -
            Math.max(box.top, root.top, 0) >=
            Math.min(box.height / 2, 22) &&
          Math.min(box.right, root.right) > Math.max(box.left, root.left)
        );
      };
      return {
        state: entry?.getAttribute('data-mn-guidance') ?? null,
        disabled: entry?.matches(':disabled') ?? true,
        animation: entry ? getComputedStyle(entry).animationName : null,
        duration: entry ? getComputedStyle(entry).animationDuration : null,
        headingVisible: visible(heading),
        controlVisible: visible(control),
        focused: !!heading && document.activeElement === heading,
        primary: control?.outerHTML.slice(0, 200) ?? null,
      };
    });
  const waitActive = () =>
    page.waitForFunction(() =>
      ['.mn-action-link', '.mn-payment-link'].some(
        (selector) =>
          document.querySelector(selector)?.getAttribute('data-mn-guidance') ===
          'active',
      ),
    );
  const naturalArrival = async () => {
    await page.locator('.mn-player-scroll').evaluate((owner) => {
      const area = owner.querySelector('#mn-action-area');
      const heading =
        area?.querySelector('h2:not(.mn-sr-only)') ??
        area?.querySelector('[data-mn-primary-control]');
      if (!heading) throw new Error('Missing action heading');
      owner.scrollTo({
        top:
          owner.scrollTop +
          heading.getBoundingClientRect().top -
          owner.getBoundingClientRect().top -
          8,
        behavior: 'instant',
      });
    });
    await settle();
    await waitActive();
    const state = await guidanceState();
    assert(state.headingVisible && state.controlVisible, JSON.stringify(state));
    assert.equal(
      state.focused,
      false,
      'Natural scrolling does not steal focus',
    );
  };
  const layout = () =>
    page.evaluate(() =>
      Object.fromEntries(
        [
          '.mn-brand',
          '.mn-toolbar',
          '.mn-status',
          '#mn-action-area',
          '.mn-private',
        ].map((selector) => {
          const node = document.querySelector(selector);
          const box = node?.getBoundingClientRect();
          return [
            selector,
            box && {
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
            },
          ];
        }),
      ),
    );
  const sameLayout = (before, after, label) => {
    for (const [selector, box] of Object.entries(before)) {
      assert.equal(
        Boolean(after[selector]),
        Boolean(box),
        `${label}: ${selector}`,
      );
      if (!box) continue;
      for (const field of ['x', 'y', 'width', 'height'])
        assert(
          Math.abs(box[field] - after[selector][field]) <= 0.5,
          `${label}: ${selector}.${field} moved ${box[field]} -> ${after[selector][field]}`,
        );
    }
  };

  await run('clarity-layout', async () => {
    assert(
      roles.length && roles.every((role) => ['player', 'host'].includes(role)),
    );
    await page.setViewportSize({ width, height });
    for (const role of roles) {
      for (const phase of [
        'auction',
        'setup',
        'place',
        'board',
        'plunder',
        'pilot-small',
        'pilot-large',
        'financing',
        'round-result',
      ]) {
        const fixture = await load({ phase, role, longNames: true });
        assert.equal(
          await page.getByText('操作列表', { exact: true }).count(),
          0,
        );
        assert.equal(
          await page.getByText('股份操作', { exact: true }).count(),
          0,
        );
        const geometry = await page.evaluate(() => {
          const rect = (box) => ({
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          });
          const union = (boxes) => {
            if (!boxes.length) return null;
            const x = Math.min(...boxes.map((box) => box.x));
            const y = Math.min(...boxes.map((box) => box.y));
            const right = Math.max(...boxes.map((box) => box.right));
            const bottom = Math.max(...boxes.map((box) => box.bottom));
            return {
              x,
              y,
              right,
              bottom,
              width: right - x,
              height: bottom - y,
            };
          };
          const glyphs = (root) => {
            const boxes = [];
            const walker = document.createTreeWalker(
              root,
              NodeFilter.SHOW_TEXT,
            );
            for (let text = walker.nextNode(); text; text = walker.nextNode()) {
              if (
                !text.textContent.trim() ||
                text.parentElement.closest('.mn-sr-only')
              )
                continue;
              const range = document.createRange();
              range.selectNodeContents(text);
              boxes.push(
                ...[...range.getClientRects()]
                  .filter((box) => box.width > 0 && box.height > 0)
                  .map(rect),
              );
            }
            return boxes;
          };
          return [
            ...document.querySelectorAll('.mn-shore [data-mn-space]'),
          ].map((wrap) => {
            const slot = wrap.querySelector('.mn-space');
            const heading = slot.querySelector('.mn-space-heading') ?? slot;
            const body = [
              ...heading.querySelectorAll('.mn-worker,.mn-worker-head'),
            ].map((node) => rect(node.getBoundingClientRect()));
            return {
              id: wrap.getAttribute('data-mn-space'),
              lines: wrap.getAttribute('data-mn-space-lines'),
              slot: rect(slot.getBoundingClientRect()),
              heading: union([...glyphs(heading), ...body]),
              earn: slot.querySelector('.mn-space-earn')
                ? union(glyphs(slot.querySelector('.mn-space-earn')))
                : null,
              price: slot.querySelector('.mn-space-price')?.textContent ?? null,
              earnSvg: slot.querySelectorAll('.mn-space-earn svg').length,
            };
          });
        });
        assert(geometry.length > 0, `${role}/${phase}: shore slots exist`);
        for (const item of geometry) {
          const label = `${role}/${phase}/${item.id}`;
          assert(
            item.slot.width >= 43.99 && item.slot.height >= 43.99,
            `${label}: slot is at least 44px`,
          );
          assert(
            !/[-−]/.test(item.price ?? ''),
            `${label}: shore prices have no minus sign`,
          );
          assert.equal(
            item.earnSvg,
            0,
            `${label}: income has no redundant SVG`,
          );
          const center = item.slot.x + item.slot.width / 2;
          assert(item.heading, `${label}: real text/worker bounds exist`);
          assert(
            Math.abs(item.heading.x + item.heading.width / 2 - center) <= 3,
            `${label}: heading glyphs and worker are horizontally centered`,
          );
          if (item.earn)
            assert(
              Math.abs(item.earn.x + item.earn.width / 2 - center) <= 3,
              `${label}: income glyphs are horizontally centered`,
            );
          if (item.lines === '1')
            assert(
              Math.abs(
                item.heading.y +
                  item.heading.height / 2 -
                  (item.slot.y + item.slot.height / 2),
              ) <= 3,
              `${label}: single line text/worker is vertically centered`,
            );
        }
        const before = await layout();
        await update({ message: '已保存在服务端', messageKind: 'saved' });
        sameLayout(before, await layout(), `${role}/${phase}/saved`);
        assert.equal(
          await page.locator('.session-save-anchor').count(),
          1,
          `${role}: one acknowledgement anchor`,
        );
        const collision = await page.evaluate(() => {
          const saved = document.querySelector('.session-save-overlay');
          const read = (box) => ({
            x: box.x,
            y: box.y,
            right: box.right,
            bottom: box.bottom,
            width: box.width,
            height: box.height,
          });
          const clip = (box, parent) => {
            let left = Math.max(0, box.x),
              top = Math.max(0, box.y),
              right = Math.min(innerWidth, box.right),
              bottom = Math.min(innerHeight, box.bottom);
            for (
              let node = parent;
              node && node !== document.body;
              node = node.parentElement
            ) {
              const style = getComputedStyle(node),
                bounds = node.getBoundingClientRect();
              if (
                ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowX)
              ) {
                left = Math.max(left, bounds.left);
                right = Math.min(right, bounds.right);
              }
              if (
                ['auto', 'scroll', 'hidden', 'clip'].includes(style.overflowY)
              ) {
                top = Math.max(top, bounds.top);
                bottom = Math.min(bottom, bounds.bottom);
              }
            }
            return right > left && bottom > top
              ? { x: left, y: top, right, bottom }
              : null;
          };
          const range = document.createRange();
          range.selectNodeContents(saved);
          const savedBoxes = [...range.getClientRects()]
            .filter((box) => box.width > 0 && box.height > 0)
            .map(read);
          const overlaps = (a, b) =>
            Math.min(a.right, b.right) - Math.max(a.x, b.x) > 0.5 &&
            Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 0.5;
          const obstacles = [];
          const walker = document.createTreeWalker(
            document.querySelector('.mn-screen'),
            NodeFilter.SHOW_TEXT,
          );
          for (let text = walker.nextNode(); text; text = walker.nextNode()) {
            const parent = text.parentElement;
            if (
              !text.textContent.trim() ||
              saved.contains(parent) ||
              parent.closest('.mn-sr-only') ||
              !parent.checkVisibility({
                checkOpacity: true,
                checkVisibilityCSS: true,
              })
            )
              continue;
            const range = document.createRange();
            range.selectNodeContents(text);
            for (const box of range.getClientRects()) {
              const visible = clip(box, parent);
              if (visible)
                obstacles.push({
                  kind: 'text',
                  text: text.textContent.trim().slice(0, 70),
                  box: visible,
                });
            }
          }
          for (const node of document.querySelectorAll(
            '.mn-screen button,.mn-screen a[href],.mn-screen input,.mn-screen select,.mn-screen svg,.mn-screen img',
          )) {
            if (
              saved.contains(node) ||
              !node.checkVisibility({
                checkOpacity: true,
                checkVisibilityCSS: true,
              })
            )
              continue;
            const box = clip(node.getBoundingClientRect(), node.parentElement);
            if (box)
              obstacles.push({
                kind: node.tagName,
                text:
                  node.getAttribute('aria-label') ??
                  node.className.baseVal ??
                  node.className,
                box,
              });
          }
          return {
            text: saved.textContent,
            boxes: savedBoxes,
            viewport: { width: innerWidth, height: innerHeight },
            overlaps: obstacles.filter((item) =>
              savedBoxes.some((box) => overlaps(box, item.box)),
            ),
          };
        });
        assert.equal(collision.text, '已保存在服务端');
        assert(
          collision.boxes.length > 0,
          `${role}/${phase}: saved glyphs render`,
        );
        for (const box of collision.boxes)
          assert(
            box.x >= -0.5 &&
              box.y >= -0.5 &&
              box.right <= width + 0.5 &&
              box.bottom <= height + 0.5,
            `${role}/${phase}: acknowledgement glyphs stay in the viewport`,
          );
        assert.deepEqual(
          collision.overlaps,
          [],
          `${role}/${phase}: saved glyphs overlap actual text or interactive/graphic content`,
        );
        if (['auction', 'round-result'].includes(phase))
          await shot(`clarity-saved-${role}-${phase}`);
        await update({ message: '', messageKind: 'none' });
        sameLayout(before, await layout(), `${role}/${phase}/saved-cleared`);
        report.metrics.push({
          kind: 'clarity-layout',
          role,
          phase,
          width,
          height,
          geometry,
          acknowledgement: collision,
        });
        if (phase === 'round-result') {
          assert(
            fixture.result?.finance,
            'The legal result contains a complete voyage ledger',
          );
          for (const [seatId, finance] of Object.entries(
            fixture.result.finance.players,
          )) {
            const merchant = page.locator(
              `.mn-result-merchant[data-seat-id="${seatId}"]`,
            );
            await tap(merchant.locator('summary'));
            const expected = [
              '期初现金',
              ...Object.entries(incomeNames)
                .filter(([key]) => finance.income[key] !== 0)
                .map(([, label]) => label),
              ...Object.entries(expenseNames)
                .filter(([key]) => finance.expenses[key] !== 0)
                .map(([, label]) => label),
              ...(finance.borrowed === 0 ? [] : ['抵押借入']),
              ...(finance.redeemed === 0 ? [] : ['赎回支出']),
              '期末现金',
            ];
            assert.deepEqual(
              await merchant
                .locator('.mn-result-breakdown dt')
                .allTextContents(),
              expected,
              `${role}/${seatId}: zero ledger details are omitted`,
            );
            assert.equal(
              await merchant.locator('summary .mn-result-amount').count(),
              3,
              `${role}/${seatId}: income, expense and net summaries remain`,
            );
          }
          await shot(`clarity-layout-${role}`);
        }
        await noCommands(
          `${role}/${phase}: inspection does not submit a game action`,
        );
      }
    }
  });

  await run('action-guidance', async () => {
    assert(context.pages().includes(page));
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    try {
      for (const phase of [
        'auction',
        'setup',
        'share-funded',
        'place',
        'board',
        'plunder',
        'pilot-small',
        'pilot-large',
        'financing',
      ]) {
        await load({ phase });
        const initial = await guidanceState();
        assert.equal(
          initial.disabled,
          false,
          `${phase}: the active action entry is enabled`,
        );
        assert.equal(
          initial.state,
          initial.headingVisible && initial.controlVisible ? 'active' : 'pulse',
          `${phase}: guidance reflects actual action-area visibility`,
        );
        if (initial.state === 'pulse') {
          assert.match(initial.animation, /mn-action-guidance/);
          assert.equal(initial.duration, '1.8s');
        }
        await tap(guidanceEntry());
        await waitActive();
        assert.equal(
          (await guidanceState()).focused,
          true,
          `${phase}: explicit navigation focuses the action heading`,
        );
        await noCommands(`${phase}: navigation never submits an action`);
        await page.evaluate(() => window.harbor.repaint());
        await settle();
        assert.equal(
          (await guidanceState()).state,
          'active',
          `${phase}: repaint does not restart breathing`,
        );
        await update({ message: '已保存在服务端', messageKind: 'saved' });
        assert.equal(
          (await guidanceState()).state,
          'active',
          `${phase}: a receipt does not restart breathing`,
        );
        await page.setViewportSize({
          width: Math.max(320, height),
          height: Math.max(240, width),
        });
        await settle();
        assert.equal(
          (await guidanceState()).state,
          'active',
          `${phase}: rotation does not restart breathing`,
        );
        await page.setViewportSize({ width, height });
        await settle();
        await page
          .locator('.mn-player-scroll')
          .evaluate((node) => node.scrollTo({ top: 0, behavior: 'instant' }));
        await page.evaluate(() => window.harbor.boundary());
        await settle();
        const branch = await guidanceState();
        assert.equal(
          branch.state,
          branch.headingVisible && branch.controlVisible ? 'active' : 'pulse',
          `${phase}: a new branch receives fresh visibility guidance`,
        );
        for (const [label, patch, reset] of [
          ['paused', { view: { paused: true } }, { view: { paused: false } }],
          ['locked', { locked: true }, { locked: false }],
          ['disconnected', { connected: false }, { connected: true }],
        ]) {
          await update(patch);
          assert.equal(
            await page.locator('[data-mn-guidance="pulse"]').count(),
            0,
            `${phase}/${label}: no breathing while action is unavailable`,
          );
          assert(
            await guidanceEntry().isDisabled(),
            `${phase}/${label}: navigation is disabled`,
          );
          await update(reset);
        }
        await noCommands(
          `${phase}: transport and display changes submit nothing`,
        );
        await load({ phase, waiting: true });
        assert.equal(
          await page.locator('[data-mn-guidance="pulse"]').count(),
          0,
          `${phase}: another merchant has no action guidance`,
        );
        report.metrics.push({
          kind: 'action-guidance',
          phase,
          width,
          height,
          initial,
          branch,
        });
      }
      await load({ phase: 'auction' });
      await naturalArrival();
      await noCommands('Natural scrolling only acknowledges guidance');
      await load({ phase: 'plunder' });
      assert.equal(await page.locator('.mn-confirm').count(), 0);
      await tap(page.locator('[data-manila-drop^="destination:"]').first());
      assert.equal(
        await page.locator('.mn-confirm').count(),
        1,
        'A real plunder choice adds the confirmation controls',
      );
      await naturalArrival();
      await noCommands('A plunder draft and natural arrival submit nothing');
      await load({ phase: 'setup' });
      await tap(
        page.getByRole('button', { name: '下一步：设起点', exact: true }),
      );
      assert.equal(await page.locator('.mn-lane-cargo-select').count(), 0);
      assert.equal(await page.locator('.mn-position-controls').count(), 3);
      await page.locator('#mn-action-area h2').evaluate((node) => node.blur());
      await naturalArrival();
      await noCommands(
        'Changing local setup controls does not submit the setup',
      );
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await load({ phase: 'place' });
      assert.equal(
        (await guidanceState()).animation,
        'none',
        'Reduced motion has no breathing animation',
      );
      await tap(guidanceEntry());
      assert.equal((await guidanceState()).state, 'active');
      const scroll = await page.evaluate(() =>
        window.scrollCalls
          .filter(
            (call) =>
              call.method === 'scrollTo' &&
              String(call.className).includes('mn-player-scroll'),
          )
          .at(-1),
      );
      assert.equal(
        scroll?.options?.behavior,
        'instant',
        'Reduced motion uses immediate scroll navigation',
      );
      await noCommands('Reduced-motion navigation submits nothing');
      await shot('action-guidance');
    } finally {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setViewportSize({ width, height });
    }
  });

  await run('stocks-finance', async () => {
    await page.setViewportSize({ width, height });
    const readStocks = async (fixture) => {
      const entry = page.getByRole('button', { name: '查看股票', exact: true });
      assert.equal(
        await entry.count(),
        1,
        'There is exactly one read-only stock entry',
      );
      await tap(entry);
      const cards = page.locator('.mn-certificates--compact');
      assert.equal(await cards.count(), 1);
      assert.equal(
        (await cards.textContent()).trim(),
        '',
        'Stock content is entirely graphical',
      );
      assert.equal(
        await cards.locator('.mn-certificate').count(),
        fixture.shares.length,
        'Each owned share has one card',
      );
      assert.equal(
        await cards.locator('button,input,select,[data-manila-action]').count(),
        0,
        'Stock cards are read-only',
      );
      const labels = await cards
        .locator('.mn-certificate')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            aria: node.getAttribute('aria-label'),
            title: node.getAttribute('title'),
            art: node.querySelectorAll('.mn-cargo-art').length,
            marks: node.querySelectorAll('.mn-stock-mark').length,
          })),
        );
      const expected = fixture.shares.map(
        (share) =>
          `${cargoNames[share.cargo]}股份，${share.mortgaged ? '已抵押' : '未抵押'}，${share.revealed || fixture.phase === 'ended' ? '已公开' : '仅你可见'}`,
      );
      assert.deepEqual(
        labels.map((label) => label.aria),
        expected,
      );
      assert.deepEqual(
        labels.map((label) => label.title),
        expected,
      );
      assert(labels.every((label) => label.art === 1 && label.marks === 2));
      await noCommands('Inspecting stock never submits a command');
      await tap(page.locator('.mn-detail-card .mn-close'));
      assert(
        await entry.evaluate((node) => document.activeElement === node),
        'Closing stock restores focus to its entry',
      );
      assert.equal(await page.locator('.mn-certificates--compact').count(), 0);
      return labels;
    };
    const openFinance = async () => {
      const entry = page.locator('.mn-credit');
      assert(
        await entry.isEnabled(),
        'Any latest legal mortgage or repayment keeps finance reachable',
      );
      await tap(entry);
      const modal = page.getByRole('dialog', {
        name: '股份抵押与赎回',
        exact: true,
      });
      assert(await modal.isVisible());
      const actual = await modal
        .locator('.mn-finance-choice:enabled')
        .evaluateAll((nodes) =>
          nodes.map((node) => ({
            type: node.getAttribute('data-manila-action'),
            shareId: node.getAttribute('data-mn-finance-share'),
          })),
        );
      const latest = await page.evaluate(() =>
        window.harbor
          .info()
          .legal.filter((action) =>
            ['mortgage', 'repay'].includes(action.type),
          ),
      );
      assert.deepEqual(
        actual,
        latest,
        'Finance buttons match the latest legal action list exactly',
      );
      return modal;
    };
    const commit = async (type, button) => {
      await tap(button);
      assert.equal(
        (await commands()).length,
        1,
        `${type}: exactly one command`,
      );
      const command = await page.evaluate(() => window.harbor.validate());
      assert.equal(command.action.type, type);
      const result = await page.evaluate(() => window.harbor.commit());
      await settle();
      assert.deepEqual(await commands(), []);
      return { command, result };
    };
    let fixture = await load({ phase: 'auction' });
    const labels = await readStocks(fixture);
    let modal = await openFinance();
    let saved = await commit(
      'mortgage',
      modal.locator('[data-manila-action="mortgage"]:enabled').first(),
    );
    const shareId = saved.command.action.shareId;
    assert(
      saved.result.shares.find((share) => share.id === shareId)?.mortgaged,
    );
    assert.equal(
      await page
        .getByRole('dialog', { name: '股份抵押与赎回', exact: true })
        .count(),
      0,
      'A saved finance decision closes the old-boundary modal',
    );
    modal = await openFinance();
    saved = await commit(
      'repay',
      modal.locator(
        `[data-manila-action="repay"][data-mn-finance-share="${shareId}"]:enabled`,
      ),
    );
    const redeemed = saved.result.shares.find((share) => share.id === shareId);
    assert(
      redeemed && !redeemed.mortgaged && redeemed.revealed,
      'A legal repayment redeems and publicly reveals its actual share',
    );
    fixture = await load({ phase: 'repay-only' });
    assert.equal(
      fixture.availableCredit,
      0,
      'Repay-only fixture has no remaining collateral',
    );
    assert(fixture.legal.some((action) => action.type === 'repay'));
    assert(!fixture.legal.some((action) => action.type === 'mortgage'));
    modal = await openFinance();
    await commit(
      'repay',
      modal.locator('[data-manila-action="repay"]:enabled').first(),
    );
    fixture = await load({ phase: 'financing' });
    const maximum = fixture.shares.length;
    for (
      let count = 0;
      fixture.phase === 'financing' && count < maximum;
      count++
    ) {
      assert.equal(
        await page
          .getByRole('dialog', { name: '股份抵押与赎回', exact: true })
          .count(),
        0,
      );
      const button = page
        .locator(
          '#mn-action-area .mn-finance-choice[data-manila-action="mortgage"]:enabled',
        )
        .first();
      assert(
        await button.count(),
        'Required collateral remains in the original action area',
      );
      fixture = (await commit('mortgage', button)).result;
    }
    assert.notEqual(
      fixture.phase,
      'financing',
      'Legal collateral selections complete required payment',
    );
    const other = await load({ phase: 'auction', waiting: true });
    await readStocks(other);
    assert(
      await page.locator('.mn-credit').isDisabled(),
      'Another merchant cannot execute the current actor’s finance actions',
    );
    for (const role of ['host']) {
      await load({ phase: 'auction', role });
      assert.equal(
        await page
          .locator('.mn-private,.mn-secret-entry,.mn-certificates--compact')
          .count(),
        0,
        `${role}: private stock layer is absent`,
      );
      await noCommands(`${role}: inspecting the public board submits nothing`);
    }
    await load({ phase: 'repay-only' });
    await tap(page.getByRole('button', { name: '查看股票', exact: true }));
    await shot('stocks-finance');
    report.metrics.push({
      kind: 'stocks-finance',
      width,
      height,
      initialStockLabels: labels,
      otherSeatId: other.seatId,
    });
  });
}
