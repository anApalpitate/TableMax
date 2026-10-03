import { contextBridge, ipcRenderer } from 'electron';
import { audioChannels, type TablemaxAudio } from './audio-types';
import {
  displayChannels,
  type DisplaySnapshot,
  type TablemaxDisplay,
} from './display-types';

if (process.isMainFrame) {
  const audio: TablemaxAudio = {
    connect: () => ipcRenderer.invoke(audioChannels.connect),
    disconnect: () => ipcRenderer.invoke(audioChannels.disconnect),
    claimEvent: (key) => ipcRenderer.invoke(audioChannels.claim, key),
    subscribe(listener) {
      if (typeof listener !== 'function')
        throw new TypeError('Audio listener must be a function');
      const receive = (_event: unknown, active: boolean) => listener(active);
      ipcRenderer.on(audioChannels.changed, receive);
      return () => ipcRenderer.removeListener(audioChannels.changed, receive);
    },
  };
  contextBridge.exposeInMainWorld('tablemaxAudio', audio);
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
