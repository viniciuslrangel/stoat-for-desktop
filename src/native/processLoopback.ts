import { ipcMain } from "electron";

export type StartResult = {
  sampleRate: number;
  channels: number;
  format: string;
};

type ProcessLoopbackAddon = {
  isSupported: () => boolean;
  pidFromHwnd: (hwnd: number) => number;
  findProcessesByImageName: (imageName: string) => number[];
  startCapture: (
    mode: "includeTree" | "excludeTrees",
    pid: number,
    excludePids: number[],
  ) => StartResult;
  stopCapture: () => void;
  readPcm: (maxFrames: number) => Float32Array;
};

export type ProcessLoopbackMode = "off" | "application" | "systemExcludeSelf";

export type ProcessLoopbackStatus = {
  mode: ProcessLoopbackMode;
  usingNative: boolean;
  fallback: boolean;
  sampleRate: number | null;
  channels: number | null;
  pid?: number;
  excludePids?: number[];
};

let addon: ProcessLoopbackAddon | null | undefined;
let activeSession = false;
let status: ProcessLoopbackStatus = {
  mode: "off",
  usingNative: false,
  fallback: false,
  sampleRate: null,
  channels: null,
};
let ipcRegistered = false;

function loadAddon(): ProcessLoopbackAddon | undefined {
  if (addon !== undefined) {
    return addon ?? undefined;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    addon = require("@stoat/win-process-loopback") as ProcessLoopbackAddon;
  } catch (error) {
    addon = null;
    console.warn(
      "[screenshare:audio] process-loopback addon unavailable",
      error,
    );
  }

  return addon ?? undefined;
}

function requireAddon(): ProcessLoopbackAddon {
  const nativeAddon = loadAddon();
  if (!nativeAddon || !nativeAddon.isSupported()) {
    throw new Error("Windows process loopback is unavailable");
  }
  return nativeAddon;
}

export function isProcessLoopbackSupported(): boolean {
  if (process.platform !== "win32") {
    return false;
  }

  try {
    return loadAddon()?.isSupported() ?? false;
  } catch (error) {
    console.warn(
      "[screenshare:audio] process-loopback support check failed",
      error,
    );
    return false;
  }
}

export function pidFromHwnd(hwnd: number): number {
  return requireAddon().pidFromHwnd(hwnd);
}

export { parseHwndFromSourceId } from "./sourceId";

export function startIncludeCapture(pid: number): StartResult {
  stopProcessLoopback();
  const result = requireAddon().startCapture("includeTree", pid, []);
  activeSession = true;
  return result;
}

export function startExcludeCapture(excludePids: number[]): StartResult {
  if (excludePids.length === 0) {
    throw new Error(
      "At least one process is required for exclude-tree capture",
    );
  }

  stopProcessLoopback();
  const pid = excludePids[0];
  const result = requireAddon().startCapture("excludeTrees", pid, [
    ...excludePids,
  ]);
  activeSession = true;
  return result;
}

export function stopProcessLoopback(): void {
  activeSession = false;
  if (process.platform !== "win32") {
    return;
  }

  const nativeAddon = loadAddon();
  nativeAddon?.stopCapture();
}

export function readProcessLoopbackPcm(maxFrames: number): Float32Array {
  if (!activeSession) {
    return new Float32Array(0);
  }
  return requireAddon().readPcm(maxFrames);
}

export function findProcessesByImageName(imageName: string): number[] {
  if (process.platform !== "win32") {
    return [];
  }
  return loadAddon()?.findProcessesByImageName(imageName) ?? [];
}

export function setProcessLoopbackStatus(
  nextStatus: ProcessLoopbackStatus,
): void {
  status = {
    ...nextStatus,
    ...(nextStatus.excludePids
      ? { excludePids: [...nextStatus.excludePids] }
      : {}),
  };
}

export function getProcessLoopbackStatus(): ProcessLoopbackStatus {
  return {
    ...status,
    ...(status.excludePids ? { excludePids: [...status.excludePids] } : {}),
  };
}

export function registerProcessLoopbackIpc(): void {
  if (ipcRegistered) {
    return;
  }

  ipcRegistered = true;
  ipcMain.handle("processLoopback:isSupported", () =>
    isProcessLoopbackSupported(),
  );
  ipcMain.handle("processLoopback:stop", () => {
    stopProcessLoopback();
  });
  ipcMain.handle("processLoopback:readPcm", (_, maxFrames: number) =>
    Array.from(readProcessLoopbackPcm(maxFrames)),
  );
  ipcMain.handle("processLoopback:status", () => getProcessLoopbackStatus());
}
