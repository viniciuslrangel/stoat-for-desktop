import { ipcMain } from "electron";

import { version as addonVersion } from "../../native/win-process-loopback/package.json";
import { version } from "../../package.json";

export type StartResult = {
  sampleRate: number;
  channels: number;
  format: string;
};

type NativeDiagnostics = {
  startedAt?: number;
  framesCaptured?: number;
  framesRead?: number;
  underruns?: number;
  overruns?: number;
  silentPackets?: number;
  avgFillMs?: number;
  peakFillMs?: number;
  queueMs?: number;
  lastError?: string | null;
};

type ProcessLoopbackAddon = {
  isSupported: () => boolean;
  pidFromHwnd: (hwnd: number) => number;
  queryProcessImage: (pid: number) => string;
  findProcessesByImageName: (imageName: string) => number[];
  startCapture: (
    mode: "includeTree" | "excludeTrees",
    pid: number,
    excludePids: number[],
  ) => StartResult;
  stopCapture: () => void;
  readPcm: (maxFrames: number) => Float32Array;
  getDiagnostics?: () => NativeDiagnostics;
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
  pids?: number[];
  labels?: string[];
  startedAt?: number;
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
let lastError: string | null = null;
let readCalls = 0;
let readFrames = 0;
let readLatencyTotalMs = 0;
let maxReadMs = 0;
let lastReadFrames = 0;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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

export function queryProcessImage(pid: number): string | undefined {
  if (process.platform !== "win32") {
    return undefined;
  }
  try {
    return loadAddon()?.queryProcessImage(pid);
  } catch {
    return undefined;
  }
}

export { parseHwndFromSourceId } from "./sourceId";

export function startIncludeCapture(pid: number): StartResult {
  stopProcessLoopback();
  try {
    const result = requireAddon().startCapture("includeTree", pid, []);
    lastError = null;
    resetReadMetrics();
    activeSession = true;
    return result;
  } catch (error) {
    lastError = errorMessage(error);
    throw error;
  }
}

export function startExcludeCapture(excludePids: number[]): StartResult {
  if (excludePids.length === 0) {
    throw new Error(
      "At least one process is required for exclude-tree capture",
    );
  }

  stopProcessLoopback();
  const pid = excludePids[0];
  try {
    const result = requireAddon().startCapture("excludeTrees", pid, [
      ...excludePids,
    ]);
    lastError = null;
    resetReadMetrics();
    activeSession = true;
    return result;
  } catch (error) {
    lastError = errorMessage(error);
    throw error;
  }
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
  const started = performance.now();
  try {
    const pcm = requireAddon().readPcm(maxFrames);
    const elapsed = performance.now() - started;
    const frames = Math.floor(pcm.length / 2);
    readCalls += 1;
    readFrames += frames;
    readLatencyTotalMs += elapsed;
    maxReadMs = Math.max(maxReadMs, elapsed);
    lastReadFrames = frames;
    return pcm;
  } catch (error) {
    lastError = errorMessage(error);
    throw error;
  }
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
    ...(nextStatus.pids ? { pids: [...nextStatus.pids] } : {}),
    ...(nextStatus.labels ? { labels: [...nextStatus.labels] } : {}),
  };
}

function resetReadMetrics(): void {
  readCalls = 0;
  readFrames = 0;
  readLatencyTotalMs = 0;
  maxReadMs = 0;
  lastReadFrames = 0;
}

export function getProcessLoopbackStatus(): ProcessLoopbackStatus {
  return {
    ...status,
    ...(status.excludePids ? { excludePids: [...status.excludePids] } : {}),
    ...(status.pids ? { pids: [...status.pids] } : {}),
    ...(status.labels ? { labels: [...status.labels] } : {}),
  };
}

export function getProcessLoopbackDiagnostics(): Record<string, unknown> {
  const nativeDiagnostics = loadAddon()?.getDiagnostics?.() ?? {};
  const currentStatus = getProcessLoopbackStatus();
  return {
    session: {
      mode: currentStatus.mode,
      usingNative: currentStatus.usingNative,
      fallback: currentStatus.fallback,
      sampleRate: currentStatus.sampleRate,
      channels: currentStatus.channels,
      pids:
        currentStatus.pids ??
        (currentStatus.pid === undefined ? [] : [currentStatus.pid]),
      labels: currentStatus.labels ?? [],
      startedAt: currentStatus.startedAt ?? nativeDiagnostics.startedAt ?? null,
    },
    capture: {
      startedAt: nativeDiagnostics.startedAt ?? currentStatus.startedAt ?? null,
      framesCaptured: nativeDiagnostics.framesCaptured ?? 0,
      framesRead: nativeDiagnostics.framesRead ?? readFrames,
      underruns: nativeDiagnostics.underruns ?? 0,
      overruns: nativeDiagnostics.overruns ?? 0,
      silentPackets: nativeDiagnostics.silentPackets ?? 0,
      avgFillMs: nativeDiagnostics.avgFillMs ?? 0,
      peakFillMs: nativeDiagnostics.peakFillMs ?? 0,
      lastError: nativeDiagnostics.lastError ?? lastError,
    },
    timing: {
      avgReadMs: readCalls === 0 ? 0 : readLatencyTotalMs / readCalls,
      maxReadMs,
      lastReadFrames,
      readCalls,
    },
    versions: {
      app: version,
      addon: `@stoat/win-process-loopback@${addonVersion}`,
      node: process.versions.node,
      electron: process.versions.electron,
    },
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
    readProcessLoopbackPcm(maxFrames),
  );
  ipcMain.handle("processLoopback:status", () => getProcessLoopbackStatus());
  ipcMain.handle("processLoopback:diagnostics", () =>
    getProcessLoopbackDiagnostics(),
  );
}
