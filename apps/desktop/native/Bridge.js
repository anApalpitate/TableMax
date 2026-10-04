(() => {
  if (window !== window.top) return;
  const windowId = __WINDOW_ID__;
  const managed = __MANAGED__;
  const testing = __TESTING__;
  if (testing)
    Object.defineProperty(window, '__tablemaxWindowId', { value: windowId });
  if (!managed || !window.chrome?.webview) return;
  const pending = new Map();
  const listeners = { display: new Set(), audio: new Set(), window: new Set() };
  let sequence = 0;
  function request(method, params) {
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error('TableMax 桌面请求超时。'));
      }, 10000);
      pending.set(id, { resolve, reject, timer });
      window.chrome.webview.postMessage({ id, method, params });
    });
  }
  function subscribe(channel, listener) {
    if (typeof listener !== 'function')
      throw new TypeError('Listener must be a function');
    listeners[channel].add(listener);
    return () => listeners[channel].delete(listener);
  }
  window.chrome.webview.addEventListener('message', ({ data }) => {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'changed' && Object.hasOwn(listeners, data.channel)) {
      for (const listener of listeners[data.channel]) listener(data.value);
      return;
    }
    const call = pending.get(data.id);
    if (!call) return;
    pending.delete(data.id);
    clearTimeout(call.timer);
    if (typeof data.error === 'string') call.reject(new Error(data.error));
    else call.resolve(data.result);
  });
  Object.defineProperty(window, 'tablemaxDisplay', {
    value: Object.freeze({
      read: (...args) => request('display.read', args),
      update: (...args) => request('display.update', args),
      subscribe: (listener) => subscribe('display', listener),
    }),
  });
  Object.defineProperty(window, 'tablemaxWindow', {
    value: Object.freeze({
      read: (...args) => request('window.read', args),
      setFullscreen: (...args) => request('window.setFullscreen', args),
      subscribe: (listener) => subscribe('window', listener),
    }),
  });
  Object.defineProperty(window, 'tablemaxAudio', {
    value: Object.freeze({
      connect: (...args) => request('audio.connect', args),
      disconnect: (...args) => request('audio.disconnect', args),
      claimEvent: (...args) => request('audio.claim', args),
      subscribe: (listener) => subscribe('audio', listener),
    }),
  });
  // WebView2's native child HWND consumes accelerators before a WinForms form
  // always receives them. Route desktop keys through the same
  // authorized top-frame message path.
  let keyPending = false;
  window.addEventListener('keydown', (event) => {
    if (!event.isTrusted || event.repeat) return;
    if (
      event.key === 'F11' ||
      (event.key === 'Escape' && !document.querySelector('dialog[open]'))
    ) {
      if (keyPending) {
        event.preventDefault();
        return;
      }
      if (event.key === 'F11') event.preventDefault();
      keyPending = true;
      void request('window.read', [])
        .then((state) =>
          request('window.setFullscreen', [
            event.key === 'F11' ? !state.fullscreen : false,
          ]),
        )
        .catch(() => {})
        .finally(() => {
          keyPending = false;
        });
    } else if (event.key === 'Alt') {
      event.preventDefault();
      void request('window.menu', []).catch(() => {});
    }
  });
})();
