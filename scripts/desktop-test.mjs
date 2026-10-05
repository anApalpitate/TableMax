import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { traceBudgets } from './budget-trace.mjs';

export const desktopExecutable = resolve('build/desktop/TableMax.exe');
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
async function freePort() {
  const server = createServer();
  await new Promise((done, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', done);
  });
  const port = server.address().port;
  await new Promise((done) => server.close(done));
  return port;
}
async function deadline(promise, timeout, description) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(description)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
export async function launchDesktop(options = {}) {
  const timeout = options.timeout ?? 30000;
  const cdpPort = await freePort();
  const executablePath = options.executablePath ?? desktopExecutable;
  const args = (options.args ?? []).filter(
    (value) => value !== resolve('build/desktop'),
  );
  if (!args.includes('--foundation-test')) args.unshift('--foundation-test');
  const child = spawn(executablePath, args, {
    env: {
      ...process.env,
      ...options.env,
      TABLEMAX_TEST_CDP_PORT: String(cdpPort),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let sequence = 0;
  let exited = false;
  let diagnostic = '';
  const pending = new Map();
  const events = new EventEmitter();
  let readyResolve, readyReject;
  const ready = new Promise((done, reject) => {
    readyResolve = done;
    readyReject = reject;
  });
  child.stderr.on('data', (chunk) => {
    diagnostic = (diagnostic + chunk.toString()).slice(-12000);
  });
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.type === 'desktop-ready') readyResolve(message);
    else if (message.id !== undefined) {
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      clearTimeout(item.timer);
      if (message.error) item.reject(new Error(String(message.error)));
      else item.done(message.result);
    }
  });
  child.once('error', readyReject);
  const exit = new Promise((done) =>
    child.once('exit', (code) => {
      exited = true;
      const error = new Error(
        'Native desktop exited ' + code + ': ' + diagnostic,
      );
      readyReject(error);
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(error);
      }
      pending.clear();
      done(code);
    }),
  );
  const request = (method, params = {}) => {
    if (exited)
      return Promise.reject(
        new Error('Native desktop has exited: ' + diagnostic),
      );
    return new Promise((done, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('Native IPC timed out: ' + method));
      }, timeout);
      pending.set(id, { done, reject, timer });
      child.stdin.write(
        JSON.stringify({ id, method, params }) + '\n',
        (error) => {
          if (error) {
            pending.delete(id);
            clearTimeout(timer);
            reject(error);
          }
        },
      );
    });
  };
  let browser;
  try {
    const startup = await deadline(
      ready,
      timeout,
      'Native desktop readiness timed out: ' + diagnostic,
    );
    let lastError;
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      try {
        browser = await chromium.connectOverCDP('http://127.0.0.1:' + cdpPort, {
          timeout: 2500,
        });
        break;
      } catch (error) {
        lastError = error;
        await wait(100);
      }
    }
    if (!browser) throw lastError ?? new Error('WebView2 CDP unavailable');
    const contexts = () => browser.contexts();
    const pages = () =>
      contexts()
        .flatMap((context) => context.pages())
        .filter((page) => !page.isClosed());
    const emitted = new WeakSet();
    const observe = (page, emit) => {
      if (emitted.has(page)) return;
      emitted.add(page);
      page.context().setDefaultTimeout(30000);
      page.context().setDefaultNavigationTimeout(30000);
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);
      page.close = async () => {
        if (page.isClosed()) return;
        // Target.closeTarget does not dispose its owning WinForms WebView2.
        // Close the real Form and require CDP to report target destruction.
        const closed = new Promise((done) => page.once('close', done));
        const id = await page.evaluate(() => window.__tablemaxWindowId);
        if (!Number.isInteger(id))
          throw new Error(
            'Cannot close a page without its native test window ID',
          );
        await request('window', { id, operation: 'close' });
        if (!page.isClosed())
          await deadline(
            closed,
            15000,
            'Native Form closed but its WebView2 target remained alive',
          );
      };
      if (emit) events.emit('window', page);
    };
    for (const context of contexts()) {
      context.setDefaultTimeout(30000);
      context.setDefaultNavigationTimeout(30000);
      for (const page of context.pages()) observe(page, false);
      context.on('page', (page) => observe(page, true));
    }
    browser.on('disconnected', () => events.emit('disconnected'));
    const windowState = async (page) => {
      await page.waitForFunction(
        () => window.__tablemaxWindowId !== undefined,
        undefined,
        { timeout },
      );
      const id = await page.evaluate(() => window.__tablemaxWindowId);
      const states = await request('windows');
      const state = states.find((entry) => entry.id === id);
      if (!state) throw new Error('Native window disappeared: ' + id);
      return state;
    };
    const evaluateWindow = async (page, callback, arg) => {
      const state = await windowState(page);
      const queued = [];
      const operation = (name, params = {}) => {
        const task = request('window', {
          id: state.id,
          operation: name,
          ...params,
        });
        queued.push(task);
        return task;
      };
      const facade = {
        id: state.id,
        isVisible: () => state.visible,
        isFullScreen: () => state.fullscreen,
        getContentSize: () => state.content ?? [state.width, state.height],
        getBounds: () => state.bounds,
        close: () => operation('close'),
        hide: () => operation('hide'),
        setContentSize: (width, height) =>
          operation('resize', { width, height }),
        setBounds: (bounds) => operation('set-bounds', bounds),
        setFullScreen: (fullscreen) =>
          operation('fullscreen', { value: fullscreen }),
        webContents: {
          getZoomFactor: () => state.zoom,
          setZoomFactor: (zoom) => operation('zoom', { zoom }),
          reload: () => operation('reload'),
          capturePage: async () => {
            if (!state.rendered || state.visible)
              throw new Error(
                'Screenshot requires an active offscreen WebView2 window without user-visible UI',
              );
            // CDP captures the currently composited WebView2 page while the native Form stays hidden.
            const cdp = await page.context().newCDPSession(page);
            try {
              const frame = await cdp.send('Page.captureScreenshot', {
                format: 'png',
                fromSurface: true,
                captureBeyondViewport: false,
              });
              return { toPNG: () => Buffer.from(frame.data, 'base64') };
            } finally {
              await cdp.detach();
            }
          },
        },
      };
      const result = await callback(facade, arg);
      await Promise.all(queued);
      return result;
    };
    const finishBudgetTrace =
      process.env.TABLEMAX_BUDGET_TRACE && process.env.TABLEMAX_BUDGET_GAME
        ? traceBudgets({
            pages,
            runtime: () => request('runtime'),
            directory: process.env.TABLEMAX_BUDGET_TRACE,
            gameId: process.env.TABLEMAX_BUDGET_GAME,
          })
        : null;
    const desktop = {
      startup,
      request,
      process: () => child,
      windows: pages,
      async firstWindow() {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
          const page = pages()[0];
          if (page) return page;
          await wait(50);
        }
        throw new Error('Native desktop opened no WebView2 page');
      },
      waitForEvent(name, settings = {}) {
        return deadline(
          new Promise((done) => events.once(name, done)),
          settings.timeout ?? timeout,
          'Desktop event timed out: ' + name,
        );
      },
      async browserWindow(page) {
        return {
          evaluate: (callback, arg) => evaluateWindow(page, callback, arg),
        };
      },
      async evaluate(callback, arg) {
        const [runtime, states] = await Promise.all([
          request('runtime'),
          request('windows'),
        ]);
        const queued = [];
        const queue = (method, params) => {
          const task = request(method, params);
          queued.push(task);
          return task;
        };
        function BrowserWindow(config = {}) {
          let width = config.width ?? 1280;
          let height = config.height ?? 900;
          this.setContentSize = (w, h) => {
            width = w;
            height = h;
          };
          this.loadURL = (url) =>
            queue('new-window', {
              url,
              width,
              height,
              partition: config.webPreferences?.partition,
              managed: false,
            });
        }
        BrowserWindow.getAllWindows = () =>
          states.map((state) => ({
            isVisible: () => state.visible,
          }));
        const api = {
          app: {
            isPackaged: runtime.packaged,
            getVersion: () => runtime.appVersion,
            getAppMetrics: () => runtime.metrics ?? [],
          },
          BrowserWindow,
          screen: { getAllDisplays: () => runtime.displays ?? [] },
          powerSaveBlocker: {
            isStarted: (id) => id === 0 && runtime.powerBlockerActive,
          },
          Menu: {
            getApplicationMenu: () => ({
              items: [
                {
                  label: '程序',
                  submenu: {
                    items: [
                      {
                        label: '打开房主管理',
                        click: () => queue('show-host'),
                      },
                      {
                        label: '打开公共屏',
                        click: () => queue('open-public'),
                      },
                    ],
                  },
                },
              ],
            }),
          },
        };
        // Legacy verification callbacks run only in the test driver. They never enter the desktop process.
        const execute = new Function(
          'api',
          'arg',
          'process',
          'return (' + callback.toString() + ')(api, arg)',
        );
        const result = await execute(api, arg, {
          versions: runtime.versions ?? {},
        });
        await Promise.all(queued);
        return result;
      },
      async close() {
        await finishBudgetTrace?.();
        if (!exited) {
          const closing = request('quit').catch((error) => {
            if (!exited) throw error;
          });
          await deadline(
            Promise.all([closing, exit]),
            15000,
            'Native desktop/service shutdown timed out',
          );
        }
        await browser.close();
        lines.close();
      },
    };
    return desktop;
  } catch (error) {
    child.kill();
    if (browser) await browser.close().catch(() => {});
    throw error;
  }
}
