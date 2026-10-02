import { contextBridge, ipcRenderer } from 'electron';
import {
  displayChannels,
  type DisplaySnapshot,
  type TablemaxDisplay,
} from './display-types';

if (process.isMainFrame) {
  const display: TablemaxDisplay = {
    read: () => ipcRenderer.invoke(displayChannels.read),
    update: (preferences) =>
      ipcRenderer.invoke(displayChannels.update, preferences),
    subscribe(listener) {
      if (typeof listener !== 'function')
        throw new TypeError('Display listener must be a function');
      const receive = (_event: unknown, snapshot: DisplaySnapshot) =>
        listener(snapshot);
      ipcRenderer.on(displayChannels.changed, receive);
      return () => ipcRenderer.removeListener(displayChannels.changed, receive);
    },
  };
  contextBridge.exposeInMainWorld('tablemaxDisplay', display);
}
