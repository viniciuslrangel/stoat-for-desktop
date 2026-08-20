import { IUpdateInfo, updateElectronApp } from "update-electron-app";

import { Notification, type WebContents, app, autoUpdater } from "electron";

import { version as appVersion } from "../../package.json";
import { APP } from "../../strings";

import { describeUpdateError } from "./updateError";

export type UpdateState =
  | "unsupported"
  | "dev"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

export type UpdateStatus = {
  state: UpdateState;
  currentVersion: string;
  availableVersion: string | null;
  message: string | null;
  detail: string | null;
  releaseNotes: string | null;
  lastCheckedAt: number | null;
};

let status: UpdateStatus = {
  state: app.isPackaged ? "idle" : "dev",
  currentVersion: appVersion,
  availableVersion: null,
  message: null,
  detail: null,
  releaseNotes: null,
  lastCheckedAt: null,
};

let statusTarget: WebContents | null = null;

export function setUpdateStatusTarget(contents: WebContents | null) {
  statusTarget = contents;
  if (!contents || contents.isDestroyed()) {
    return;
  }

  // Avoid pushing status during initial navigation; renderer mounts after SPA boot.
  setTimeout(() => {
    if (statusTarget === contents && !contents.isDestroyed()) {
      broadcastStatus();
    }
  }, 500);
}

function broadcastStatus() {
  if (statusTarget && !statusTarget.isDestroyed()) {
    statusTarget.send("update-status", status);
  }
}

function setStatus(partial: Partial<UpdateStatus>) {
  status = { ...status, ...partial };
  if (status.state !== "error") {
    status.detail = null;
  }
  broadcastStatus();
}

export function getUpdateStatus(): UpdateStatus {
  return status;
}

export function checkForUpdatesNow(): void {
  if (!app.isPackaged) {
    setStatus({
      state: "dev",
      message: "Auto-update is disabled in development builds",
    });
    return;
  }

  if (process.platform !== "darwin" && process.platform !== "win32") {
    setStatus({
      state: "unsupported",
      message: "Auto-update is only supported on Windows and macOS",
    });
    return;
  }

  autoUpdater.checkForUpdates();
}

export function installDownloadedUpdate(): void {
  autoUpdater.quitAndInstall();
}

export function dismissUpdateError(): void {
  if (status.state !== "error") {
    return;
  }

  setStatus({
    state: app.isPackaged ? "idle" : "dev",
    message: null,
    detail: null,
  });
}

export function initAutoUpdate(): void {
  if (!app.isPackaged) {
    setStatus({
      state: "dev",
      message: "Auto-update is disabled in development builds",
    });
    return;
  }

  if (process.platform !== "darwin" && process.platform !== "win32") {
    setStatus({
      state: "unsupported",
      message: "Auto-update is only supported on Windows and macOS",
    });
    return;
  }

  const onNotifyUser = (info: IUpdateInfo) => {
    setStatus({
      state: "downloaded",
      availableVersion: info.releaseName || status.availableVersion,
      releaseNotes:
        typeof info.releaseNotes === "string" ? info.releaseNotes : null,
      message: "Update downloaded — restart to install",
    });

    const notification = new Notification({
      title: "Update ready",
      body: `Restart ${APP.displayName} to install the update.`,
      silent: true,
    });
    notification.show();
  };

  updateElectronApp({ notifyUser: true, onNotifyUser });

  autoUpdater.on("checking-for-update", () => {
    setStatus({
      state: "checking",
      message: "Checking for updates…",
      lastCheckedAt: Date.now(),
    });
  });

  autoUpdater.on("update-available", () => {
    setStatus({
      state: "available",
      message: "Update found — downloading…",
    });
  });

  autoUpdater.on("update-not-available", () => {
    setStatus({
      state: "up-to-date",
      availableVersion: null,
      releaseNotes: null,
      message: "You're on the latest version",
      lastCheckedAt: Date.now(),
    });
  });

  autoUpdater.on("download-progress", (_, progress) => {
    setStatus({
      state: "downloading",
      message: `Downloading update… ${Math.round(progress.percent)}%`,
    });
  });

  autoUpdater.on("update-downloaded", (_, releaseNotes, releaseName) => {
    setStatus({
      state: "downloaded",
      availableVersion: releaseName || status.availableVersion,
      releaseNotes: typeof releaseNotes === "string" ? releaseNotes : null,
      message: "Update downloaded — restart to install",
    });
  });

  autoUpdater.on("error", (error, extra) => {
    const described = describeUpdateError(error, extra);
    console.error("[stoat-desktop] auto-update failed", error, extra);
    setStatus({
      state: "error",
      message: described.userMessage,
      detail: described.detail,
      lastCheckedAt: Date.now(),
    });
  });

  broadcastStatus();
}
