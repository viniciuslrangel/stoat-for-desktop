import { contextBridge, ipcRenderer } from "electron";

let config: DesktopConfig;

ipcRenderer.on("config", (_, data) => (config = data));

contextBridge.exposeInMainWorld("desktopConfig", {
  get: () => config,
  set: (config: DesktopConfig) => ipcRenderer.send("config", config),
  getAutostart() {
    return ipcRenderer.invoke("getAutostart") as Promise<boolean>;
  },
  setAutostart(value: boolean) {
    return ipcRenderer.invoke("setAutostart", value) as Promise<boolean>;
  },
  getServerUrl() {
    return ipcRenderer.invoke("getServerUrl") as Promise<ServerUrlInfo>;
  },
  setServerUrl(url: string) {
    return ipcRenderer.invoke(
      "setServerUrl",
      url,
    ) as Promise<SetServerUrlResult>;
  },
});
