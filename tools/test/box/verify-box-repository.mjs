import {
  assertWorkspaceRoot,
  isDirectExecution,
} from '../../shared/workspace-root.mjs';
if (isDirectExecution(import.meta.url)) assertWorkspaceRoot();

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { launchDesktop, desktopExecutable } from '../support/desktop-test.mjs';

// Exercise actual WinForms/WebView2 NewWindowRequested. The native capture
// seam records only approved OS launch targets, without opening visible tabs.
const argument = (name) =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3);
const fixture = process.argv.includes('--native-fixture');
const sourcePageUrl = argument('page-url');
const sourceBundle = argument('source-bundle')
  ? resolve(argument('source-bundle'))
  : null;
assert.ok(
  [fixture, sourcePageUrl, sourceBundle].filter(Boolean).length <= 1,
  'Choose native fixture, source page or source bundle',
);
if (sourceBundle) assert.ok(sourceBundle.startsWith(resolve('tmp') + sep));
if (sourcePageUrl) {
  const address = new URL(sourcePageUrl);
  assert.equal(address.protocol, 'http:');
  assert.equal(address.hostname, '127.0.0.1');
  assert.equal(address.pathname, '/host');
  assert.equal(
    address.username + address.password + address.search + address.hash,
    '',
  );
}
const executablePath = resolve(argument('executable') ?? desktopExecutable);
await mkdir('tmp', { recursive: true });
const work = argument('work')
  ? resolve(argument('work'))
  : await mkdtemp(resolve('tmp/box-repository-'));
assert.match(relative(resolve('tmp'), work), /^box-repository-[A-Za-z0-9]{6}$/);
const run = argument('run') ?? `run-${Date.now()}`;
assert.match(run, /^[A-Za-z0-9_-]+$/);
const output = join(work, run);
await mkdir(output, { recursive: true });
const repositoryUrl = 'https://github.com/anApalpitate/TableMax';
const repositorySelector = 'a[data-tablemax-repository-link]';
const report = {
  status: 'running',
  mode: fixture
    ? 'native-security-fixture'
    : sourcePageUrl || sourceBundle
      ? 'source-box-fixture'
      : 'actual-box',
  scope:
    'Hidden muted actual WinForms/WebView2 launch authorization and join compatibility. Explicit native capture avoids OS browser tabs. A native fixture proves native security checks only; it does not certify the production box. Does not certify default OS browser association or physical devices.',
  sourceBundle,
  work,
  output,
  executablePath,
  executableSha256: createHash('sha256')
    .update(await readFile(executablePath))
    .digest('hex'),
  startedAt: new Date().toISOString(),
  checks: [],
};
await mkdir(join(output, 'box'), { recursive: true });
const save = () =>
  writeFile(
    join(output, 'repository-results.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
const wait = (milliseconds) =>
  new Promise((done) => setTimeout(done, milliseconds));
async function until(predicate, message) {
  for (const end = Date.now() + 10000; Date.now() < end;) {
    if (await predicate()) return;
    await wait(50);
  }
  throw new Error(message);
}
async function checked(message) {
  report.checks.push(message);
  console.log(message);
  await save();
}
let desktop, server, origin;
async function snapshot(page) {
  const id = await page.evaluate(() => window.__tablemaxWindowId);
  return (await desktop.request('windows')).find((entry) => entry.id === id);
}
async function captured(page) {
  const state = await snapshot(page);
  return {
    repository: state.externalRepository.count,
    join: state.externalJoin.count,
  };
}
async function rejected(page, action, message) {
  const before = await captured(page);
  await action();
  await wait(250);
  assert.deepEqual(await captured(page), before, message);
  await checked(message);
}
async function approved(page, selector, captureKey, keyboard = false) {
  const before = await snapshot(page);
  const url = page.url();
  const link = page.locator(selector);
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener noreferrer');
  const destination = await link.evaluate((element) => element.href);
  if (keyboard) {
    await link.focus();
    await page.keyboard.press('Enter');
  } else await link.click();
  await until(async () => {
    const state = await snapshot(page);
    return (
      state[captureKey].count === before[captureKey].count + 1 &&
      state[captureKey].url === destination
    );
  }, 'Native did not approve trusted current link: ' + captureKey);
  assert.equal(page.url(), url, 'External launch must retain local page');
  assert.equal(
    await link.evaluate((element) => element.dataset.tablemaxJoinRequest),
    undefined,
    'Native consumes the single trusted click request',
  );
}
try {
  if (sourceBundle) {
    report.scope =
      'Compiled source BoxScreen with a session fixture in hidden muted actual WinForms/WebView2. Native repository launch targets are captured after actual authorization. Does not certify production service integration, default OS browser association or physical devices.';
    server = createServer(async (request, response) => {
      try {
        const requested = decodeURIComponent(
          new URL(request.url, 'http://127.0.0.1').pathname,
        );
        const file = resolve(
          sourceBundle,
          '.' + (requested === '/host' ? '/index.html' : requested),
        );
        if (!file.startsWith(sourceBundle + sep)) {
          response.writeHead(403).end();
          return;
        }
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml',
          '.woff2': 'font/woff2',
        };
        const data = await readFile(file);
        response
          .writeHead(200, {
            'Content-Type': types[extname(file)] ?? 'application/octet-stream',
          })
          .end(data);
      } catch {
        response.writeHead(404).end();
      }
    });
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', done);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
  } else if (fixture) {
    server = createServer((request, response) => {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><meta charset="utf-8"><title>Native link security fixture</title>
        <main class="box-screen">
          <a href="${repositoryUrl}" target="_blank" rel="noopener noreferrer" data-tablemax-repository-link>GitHub</a>
          <a href="http://${request.headers.host}/" target="_blank" rel="noopener noreferrer" data-tablemax-join-link>打开网址</a>
          <button id="other-focus">Other focus</button>
        </main><script>
          for (const link of document.querySelectorAll('a')) link.addEventListener('click', (event) => {
            if (event.isTrusted && window === window.top) link.dataset.tablemaxJoinRequest = String(Date.now());
          });
        </script>`);
    });
    await new Promise((done, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', done);
    });
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  desktop = await launchDesktop({
    executablePath,
    args: ['--tablemax-test-mode'],
    env: {
      TABLEMAX_DATA_DIR: join(output, 'data'),
      TABLEMAX_BOX_DIRECTORY: join(output, 'box'),
      TABLEMAX_HOST: '127.0.0.1',
      TABLEMAX_PORT: '0',
      TABLEMAX_TEST_CAPTURE_EXTERNAL: '1',
      ...(fixture || sourcePageUrl || sourceBundle
        ? { TABLEMAX_PROTOTYPE_URL: sourcePageUrl ?? origin + '/host' }
        : {}),
    },
  });
  const host = await desktop.firstWindow();
  origin ??= new URL(host.url()).origin;
  await host.locator(repositorySelector).waitFor();
  const hostState = await snapshot(host);
  assert.equal(hostState.visible, false);
  assert.equal(hostState.rendered, true);
  assert.equal(hostState.audioMuted, true);
  assert.equal(
    await host.locator(repositorySelector).getAttribute('href'),
    repositoryUrl,
  );
  await approved(host, repositorySelector, 'externalRepository');
  if (!sourceBundle) {
    await approved(host, 'a[data-tablemax-join-link]', 'externalJoin');
    await checked(
      'Managed host trusted mouse repository click and existing join link approved exact current URLs',
    );
  } else {
    await approved(host, repositorySelector, 'externalRepository', true);
    await checked(
      'Real compiled source BoxScreen repository icon approved trusted mouse and keyboard activation in actual WebView2',
    );
    await host.screenshot({ path: join(output, 'repository-host.png') });
    await desktop.close();
    desktop = undefined;
    report.status = 'passed';
    report.finishedAt = new Date().toISOString();
    await save();
  }

  if (!sourceBundle) {
    const publicEvent = desktop.waitForEvent('window');
    await desktop.request('open-public');
    const publicPage = await publicEvent;
    await publicPage.locator(repositorySelector).waitFor();
    await approved(publicPage, repositorySelector, 'externalRepository', true);
    await approved(
      publicPage,
      'a[data-tablemax-join-link]',
      'externalJoin',
      true,
    );
    await checked(
      'Managed public trusted keyboard repository click and existing join link approved exact current URLs',
    );

    await rejected(
      host,
      () => host.locator(repositorySelector).evaluate((link) => link.click()),
      'Synthetic repository click rejected',
    );
    await rejected(
      host,
      () => host.evaluate((url) => window.open(url, '_blank'), repositoryUrl),
      'Script popup rejected',
    );
    for (const destination of [
      repositoryUrl + '?query=1',
      repositoryUrl + '#fragment',
      repositoryUrl + '/issues',
      repositoryUrl + '/',
      'http://github.com/anApalpitate/TableMax',
      'https://github.com:444/anApalpitate/TableMax',
      'https://github.com.example/anApalpitate/TableMax',
      'https://account@github.com/anApalpitate/TableMax',
      origin + '/',
    ]) {
      await host.locator(repositorySelector).evaluate((link, url) => {
        link.href = url;
      }, destination);
      await rejected(
        host,
        () => host.locator(repositorySelector).click(),
        'Repository URL variation rejected: ' + destination,
      );
    }
    await host.locator(repositorySelector).evaluate((link, url) => {
      link.href = url;
    }, repositoryUrl);

    for (const [name, age] of [
      ['missing', null],
      ['expired', 3000],
      ['future', -60000],
    ]) {
      await host.locator(repositorySelector).evaluate((link, value) => {
        const replacement = link.cloneNode(true);
        delete replacement.dataset.tablemaxJoinRequest;
        if (value !== null)
          replacement.dataset.tablemaxJoinRequest = String(Date.now() - value);
        link.replaceWith(replacement);
      }, age);
      await rejected(
        host,
        () => host.locator(repositorySelector).click(),
        'Missing or invalid trusted request rejected: ' + name,
      );
    }
    await host.locator(repositorySelector).evaluate((link) => {
      const other = document.createElement('button');
      other.id = 'repository-other-focus';
      other.textContent = 'Other focus';
      document.body.append(other);
      link.addEventListener('click', () => {
        link.dataset.tablemaxJoinRequest = String(Date.now());
        other.focus();
      });
    });
    await rejected(
      host,
      () => host.locator(repositorySelector).click(),
      'Trusted request with wrong active element rejected',
    );
    await host.goto(origin + '/host');
    await host.locator(repositorySelector).waitFor();

    await host.evaluate((url) => {
      const frame = document.createElement('iframe');
      frame.id = 'repository-player-frame';
      frame.src = url + '/?embed=1';
      frame.style.cssText =
        'position:fixed;inset:0;width:390px;height:600px;z-index:99999;background:white';
      document.body.append(frame);
    }, origin);
    const frameLink = host
      .frameLocator('#repository-player-frame')
      .locator(repositorySelector);
    await frameLink.waitFor();
    await frameLink.evaluate((link) => {
      link.addEventListener('click', () => {
        // Deliberately simulate a forged request inside the player child frame.
        link.dataset.tablemaxJoinRequest = String(Date.now());
      });
    });
    await rejected(
      host,
      () => frameLink.click(),
      'Trusted player child-frame repository click with forged request rejected',
    );
    await host
      .locator('#repository-player-frame')
      .evaluate((frame) => frame.remove());

    if (fixture || sourcePageUrl) {
      await host.evaluate((url) => {
        const frame = document.createElement('iframe');
        frame.id = 'repository-same-url-frame';
        frame.src = url;
        frame.style.cssText =
          'position:fixed;inset:0;width:390px;height:600px;z-index:99999;background:white';
        document.body.append(frame);
      }, host.url());
      const sameUrlFrameLink = host
        .frameLocator('#repository-same-url-frame')
        .locator(repositorySelector);
      await sameUrlFrameLink.waitFor();
      await sameUrlFrameLink.evaluate((link) => {
        link.addEventListener('click', () => {
          const topLink = window.parent.document.querySelector(
            'a[data-tablemax-repository-link]',
          );
          topLink.dataset.tablemaxJoinRequest = String(Date.now());
          topLink.focus();
        });
      });
      await rejected(
        host,
        () => sameUrlFrameLink.click(),
        'Same-URL child frame with forged top request and top focus rejected',
      );
      await host
        .locator('#repository-same-url-frame')
        .evaluate((frame) => frame.remove());
    } else {
      const response = await fetch(host.url());
      assert.ok(
        response.headers
          .get('content-security-policy')
          ?.includes("frame-ancestors 'none'"),
      );
      await checked(
        'Actual host route forbids embedding via CSP; same-URL frame attack belongs to the native fixture',
      );
    }

    await host.goto(origin + '/player');
    const playerRepository =
      fixture || sourcePageUrl
        ? host.locator(repositorySelector)
        : host.frameLocator('iframe').locator(repositorySelector);
    await playerRepository.waitFor();
    await rejected(
      host,
      () => playerRepository.click(),
      'Managed host on player route cannot launch repository',
    );
    await host.goto(origin + '/host');
    await host.locator(repositorySelector).waitFor();
    await approved(host, repositorySelector, 'externalRepository');
    await approved(host, 'a[data-tablemax-join-link]', 'externalJoin');
    await checked(
      'Approved repository and join activation still work after rejected cases and route restoration',
    );

    await host.screenshot({ path: join(output, 'repository-host.png') });
    await publicPage.screenshot({
      path: join(output, 'repository-public.png'),
    });
    await desktop.close();
    desktop = undefined;
    report.status = 'passed';
    report.finishedAt = new Date().toISOString();
  }
} catch (error) {
  report.status = 'failed';
  report.error = error.message;
  throw error;
} finally {
  await desktop?.close();
  await new Promise((done) => (server ? server.close(done) : done()));
  await save();
  console.log('Evidence: ' + relative(resolve(), output).split(sep).join('/'));
}
