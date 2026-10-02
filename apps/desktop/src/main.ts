import {
  app,
  BrowserWindow,
  dialog,
  utilityProcess,
  screen,
  Menu,
  powerSaveBlocker,
  powerMonitor,
  shell,
  type UtilityProcess,
} from 'electron';
import { join, resolve } from 'node:path';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { ServiceReadySchema } from '@tablemax/protocol';
import { RuntimeGuard } from './runtime-guard';
import { startupError } from './startup-error';

const localData = process.env.LOCALAPPDATA;
if (!localData) throw new Error('Windows LOCALAPPDATA is unavailable');
const dataDir = resolve(
  process.env.TABLEMAX_DATA_DIR ?? join(localData, 'TableMax'),
);
let setupError: unknown;
try {
  mkdirSync(dataDir, { recursive: true });
  app.setPath('userData', join(dataDir, 'desktop'));
} catch (error) {
  setupError = error;
}

const checking = process.argv.includes('--foundation-check');
const testing = process.argv.includes('--foundation-test');
const playMode = process.argv.includes('--tablemax-play-mode')
  ? 'play'
  : testing || process.argv.includes('--tablemax-test-mode')
    ? 'test'
    : 'play';
let exitCode = 0;
let service: UtilityProcess | undefined;
let quitting = false;
let stopped = false;
const windows = new Set<BrowserWindow>();
const publicWindows = new Set<BrowserWindow>();
const runtime = new RuntimeGuard(powerSaveBlocker);
let hostWindow: BrowserWindow | null = null;
let hostUrl = '';
function showHost() {
  if (!hostUrl || quitting) return;
  if (!hostWindow || hostWindow.isDestroyed()) {
    hostWindow = openWindow(hostUrl);
    hostWindow.webContents.on('will-navigate', (event, target) => {
      const parsed = new URL(target);
      if (
        parsed.origin === new URL(hostUrl).origin &&
        ['/public', '/public/game'].includes(parsed.pathname)
      ) {
        event.preventDefault();
        openWindow(target, true);
      }
    });
  } else if (!checking && !testing) {
    if (hostWindow.isMinimized()) hostWindow.restore();
    hostWindow.show();
    hostWindow.focus();
  }
}

function openWindow(url: string, publicScreen = false) {
  const window = new BrowserWindow({
    width: publicScreen ? 1280 : 1080,
    height: 800,
    ...(publicScreen &&
    !checking &&
    !testing &&
    screen.getAllDisplays().length > 1
      ? {
          x: screen
            .getAllDisplays()
            .find((display) => display.id !== screen.getPrimaryDisplay().id)!
            .bounds.x,
          y: screen
            .getAllDisplays()
            .find((display) => display.id !== screen.getPrimaryDisplay().id)!
            .bounds.y,
          fullscreen: true,
        }
      : {}),
    show: !checking && !testing,
    frame: !testing,
    title: publicScreen ? 'TableMax · 公共屏' : 'TableMax',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      backgroundThrottling: !checking && !testing,
      offscreen: testing,
    },
  });
  windows.add(window);
  const updateDisplay = () =>
    runtime.publicScreenVisible(
      [...publicWindows].some(
        (item) =>
          !item.isDestroyed() && item.isVisible() && !item.isMinimized(),
      ),
    );
  if (publicScreen) {
    publicWindows.add(window);
    window.on('show', updateDisplay);
    window.on('hide', updateDisplay);
    window.on('minimize', updateDisplay);
    window.on('restore', updateDisplay);
    updateDisplay();
  }
  window.on('closed', () => {
    windows.delete(window);
    publicWindows.delete(window);
    updateDisplay();
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, target) => {
    if (new URL(target).origin !== new URL(url).origin) event.preventDefault();
  });
  void window.loadURL(url);
  return window;
}

async function run() {
  await app.whenReady();
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: '屏幕',
        submenu: [
          {
            label: '切换全屏',
            accelerator: 'F11',
            click: () => {
              const window = BrowserWindow.getFocusedWindow();
              if (window) window.setFullScreen(!window.isFullScreen());
            },
          },
          ...screen.getAllDisplays().map((display, index) => ({
            label: `移到显示器 ${index + 1}（${display.bounds.width}×${display.bounds.height}）`,
            click: () => {
              const window = BrowserWindow.getFocusedWindow();
              if (window) {
                window.setFullScreen(false);
                window.setBounds({
                  x: display.bounds.x,
                  y: display.bounds.y,
                  width: Math.min(1280, display.workArea.width),
                  height: Math.min(800, display.workArea.height),
                });
              }
            },
          })),
        ],
      },
      {
        label: '程序',
        submenu: [
          { label: '打开房主管理', click: showHost },
          {
            label: '打开日志目录',
            click: () => {
              void shell.openPath(join(dataDir, 'logs'));
            },
          },
          { role: 'quit' },
        ],
      },
    ]),
  );
  const port = Number(process.env.TABLEMAX_PORT ?? 38473);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error('Invalid TABLEMAX_PORT');
  service = utilityProcess.fork(join(__dirname, 'server.cjs'), [], {
    stdio: 'pipe',
    serviceName: 'TableMax local service',
  });
  const child = service;
  child.stdout?.on('data', (chunk: Buffer) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  const ready = await new Promise<ReturnType<typeof ServiceReadySchema.parse>>(
    (fulfill, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Local service startup timed out')),
        20_000,
      );
      child.once('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Local service exited: ${code}`));
      });
      child.on('message', (input: unknown) => {
        const parsed = ServiceReadySchema.safeParse(input);
        if (parsed.success) {
          clearTimeout(timeout);
          fulfill(parsed.data);
        } else if (
          typeof input === 'object' &&
          input !== null &&
          'type' in input &&
          input.type === 'error'
        ) {
          clearTimeout(timeout);
          const message =
            'message' in input && typeof input.message === 'string'
              ? input.message
              : 'Local service startup failed';
          reject(
            Object.assign(new Error(message), {
              code: 'code' in input ? input.code : null,
            }),
          );
        }
      });
      child.postMessage({
        host: process.env.TABLEMAX_HOST ?? '0.0.0.0',
        port,
        dataDir,
        webDir: join(__dirname, 'web'),
        playMode,
      });
    },
  );
  const origin = `http://127.0.0.1:${ready.port}`;
  const webOrigin = process.env.TABLEMAX_WEB_DEV_URL ?? origin;
  runtime.start();
  powerMonitor.on('resume', () => {
    for (const window of windows)
      if (!window.isDestroyed())
        void window.webContents
          .executeJavaScript("window.dispatchEvent(new Event('online'))")
          .catch(() => undefined);
  });

  if (checking) {
    const response = await fetch(`${origin}/api/foundation/health`);
    if (!response.ok) throw new Error('Service health request failed');
    const health = await response.json();
    const window = openWindow(`${webOrigin}/host#host=${ready.hostToken}`);
    await new Promise<void>((fulfill, reject) => {
      window.webContents.once('did-finish-load', () => fulfill());
      window.webContents.once('did-fail-load', (_event, code, description) =>
        reject(new Error(`${code}: ${description}`)),
      );
    });
    writeFileSync(
      join(dataDir, 'desktop-check.json'),
      JSON.stringify(
        {
          health,
          servicePid: child.pid,
          desktopPid: process.pid,
          packaged: app.isPackaged,
        },
        null,
        2,
      ),
    );
    app.quit();
    return;
  }

  hostUrl = `${webOrigin}/host#host=${ready.hostToken}`;
  showHost();
  child.on('exit', (code) => {
    if (!quitting) {
      if (!testing)
        dialog.showErrorBox(
          'TableMax 服务已停止',
          `本地服务异常退出（${code}）。请重新启动程序。`,
        );
      app.quit();
    }
  });
}

app.on('window-all-closed', () => app.quit());
app.on('before-quit', (event) => {
  if (stopped || !service) return;
  event.preventDefault();
  if (quitting) return;
  quitting = true;
  runtime.stop();
  const child = service;
  const timeout = setTimeout(() => {
    child.kill();
    stopped = true;
    app.exit(exitCode);
  }, 5_000);
  child.once('exit', () => {
    clearTimeout(timeout);
    stopped = true;
    app.exit(exitCode);
  });
  child.postMessage({ type: 'stop' });
});

function reportStartupFailure(error: unknown) {
  console.error(error);
  const detail = startupError(
    error,
    Number(process.env.TABLEMAX_PORT ?? 38473),
    dataDir,
  );
  try {
    mkdirSync(join(dataDir, 'logs'), { recursive: true });
    appendFileSync(
      join(dataDir, 'logs', 'desktop.log'),
      `${new Date().toISOString()} ${detail}\n`,
    );
  } catch {
    /* Preserve the original error even if its directory is unwritable. */
  }
  if (!checking && !testing) dialog.showErrorBox('TableMax 启动失败', detail);
  exitCode = 1;
  if (service) app.quit();
  else app.exit(exitCode);
}
if (setupError) reportStartupFailure(setupError);
else {
  const singleInstance = app.requestSingleInstanceLock();
  app.on('second-instance', showHost);
  app.on('will-quit', () => runtime.stop());
  if (!singleInstance) app.exit(0);
  else void run().catch(reportStartupFailure);
}
