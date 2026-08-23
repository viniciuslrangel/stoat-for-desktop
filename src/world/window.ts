import { contextBridge, ipcRenderer } from "electron";

import { version } from "../../package.json";
import { APP } from "../../strings";

contextBridge.exposeInMainWorld("native", {
  appName: () => APP.displayName,
  versions: {
    node: () => process.versions.node,
    chrome: () => process.versions.chrome,
    electron: () => process.versions.electron,
    desktop: () => version,
  },

  minimise: () => ipcRenderer.send("minimise"),
  maximise: () => ipcRenderer.send("maximise"),
  close: () => ipcRenderer.send("close"),

  setBadgeCount: (count: number) => ipcRenderer.send("setBadgeCount", count),

  onceScreenPicker: (
    onScreenPick: (
      sources: {
        idx: number;
        name: string;
        isFullScreen: boolean;
        image?: string;
      }[],
    ) => void,
  ) => {
    const eventName = "screenPicker";
    ipcRenderer.removeAllListeners(eventName);
    ipcRenderer.once(eventName, (_, sources) => onScreenPick(sources));
  },
  screenPickerCallback: (idx: number, audio: boolean, audioMode?: string) =>
    ipcRenderer.send("screenPickerCallback", idx, audio, audioMode),

  processLoopback: {
    isSupported: () => ipcRenderer.invoke("processLoopback:isSupported"),
    stop: () => ipcRenderer.invoke("processLoopback:stop"),
    readPcm: (maxFrames: number) =>
      ipcRenderer.invoke("processLoopback:readPcm", maxFrames),
    status: () => ipcRenderer.invoke("processLoopback:status"),
  },

  isWayland: () => ipcRenderer.invoke("getIsWayland"),
});
