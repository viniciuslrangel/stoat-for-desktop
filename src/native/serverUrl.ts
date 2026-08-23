import { URL } from "node:url";

import { BrowserWindow, WebContents, app, ipcMain, session } from "electron";

import { DEFAULT_SERVER_URL } from "../constants";

import { config } from "./config";

export function getClientPath(): string {
  return config.betaUi ? "/v2" : "/app";
}

export function getResolvedServerUrl(): string {
  if (app.commandLine.hasSwitch("force-server")) {
    return app.commandLine.getSwitchValue("force-server");
  }

  return config.serverUrl ?? DEFAULT_SERVER_URL;
}

export function isServerUrlOverridden(): boolean {
  return app.commandLine.hasSwitch("force-server");
}

export function getBuildOrigin(): string {
  return new URL(getResolvedServerUrl()).origin;
}

function applyClientPath(url: URL): void {
  url.pathname = getClientPath();
}

export function getStartupUrl(): string {
  const url = new URL(getResolvedServerUrl());
  applyClientPath(url);
  url.searchParams.set("v", app.getVersion());
  return url.toString();
}

export function validateServerUrl(input: string): string {
  let url: URL;

  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Invalid URL");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("URL must use http or https");
  }

  const isLocalhost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";

  if (url.protocol === "http:" && !isLocalhost) {
    throw new Error("HTTP is only allowed for localhost");
  }

  if (url.protocol !== "https:" && !isLocalhost) {
    throw new Error("Server URL must use HTTPS");
  }

  const path = url.pathname.replace(/\/+$/, "") || "";

  if (path !== "" && path !== "/" && path !== "/app" && path !== "/v2") {
    throw new Error(
      "Server URL must include /app (e.g. https://your-server.com/app)",
    );
  }

  url.pathname = "/app";

  url.hash = "";
  url.search = "";

  return url.toString();
}

function getNormalizedResolvedServerUrl(): string {
  return validateServerUrl(getResolvedServerUrl());
}

/** Navigate the window to the configured server URL (clears session/cache). */
export async function navigateToConfiguredServer(
  webContents?: WebContents,
): Promise<void> {
  const window =
    (webContents && BrowserWindow.fromWebContents(webContents)) ||
    BrowserWindow.getAllWindows()[0];

  if (!window) {
    throw new Error("No browser window available");
  }

  await session.defaultSession.clearStorageData();
  await session.defaultSession.clearCache();
  await window.loadURL(getStartupUrl());
}

let serverUrlIpcInitialized = false;

export function initServerUrlIpc(): void {
  if (serverUrlIpcInitialized) {
    return;
  }

  serverUrlIpcInitialized = true;
  ipcMain.handle("getServerUrl", () => ({
    url: getNormalizedResolvedServerUrl(),
    storedUrl: config.serverUrl,
    defaultUrl: DEFAULT_SERVER_URL,
    overridden: isServerUrlOverridden(),
    betaUi: config.betaUi,
  }));

  ipcMain.handle(
    "setServerUrl",
    async (_event, input: string, betaUi: boolean) => {
      if (isServerUrlOverridden()) {
        return {
          ok: false,
          error: "Server URL is overridden by --force-server for this session",
        };
      }

      let normalized: string;

      try {
        normalized = validateServerUrl(input);
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : "Invalid URL",
        };
      }

      const previousStartupUrl = getStartupUrl();

      config.serverUrl = normalized === DEFAULT_SERVER_URL ? null : normalized;
      config.betaUi = betaUi;

      const reloaded = getStartupUrl() !== previousStartupUrl;

      if (reloaded) {
        await navigateToConfiguredServer(_event.sender);
      }

      return {
        ok: true,
        url: getNormalizedResolvedServerUrl(),
        betaUi: config.betaUi,
        reloaded,
      };
    },
  );
}
