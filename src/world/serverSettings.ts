import { ipcRenderer } from "electron";

import { APP } from "../../strings";

const ROOT_ID = "stoat-desktop-server-settings";

const APP_PATH_HINT =
  "Must include /app (e.g. https://stoat.viniciusrangel.dev/app). Host-only URLs get /app appended on save. Enable Beta UI to load the /v2 client instead.";

function getServerUrl(): Promise<ServerUrlInfo> {
  return ipcRenderer.invoke("getServerUrl");
}

function setServerUrl(
  url: string,
  betaUi: boolean,
): Promise<SetServerUrlResult> {
  return ipcRenderer.invoke("setServerUrl", url, betaUi);
}

/** Show on auth/landing routes; always show if path is unknown (desktop-only overlay). */
function shouldShowServerSettings(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (
    path.includes("/channel/") ||
    path.includes("/server/") ||
    path.includes("/settings") ||
    path.startsWith("/bot/")
  ) {
    return false;
  }

  return true;
}

function hookNavigation(callback: () => void) {
  const wrap = <T extends History["pushState"]>(method: T): T =>
    ((...args: Parameters<T>) => {
      const result = method.apply(history, args);
      callback();
      return result;
    }) as T;

  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
}

function createSettingsUi(
  host: HTMLElement,
  info: ServerUrlInfo,
): { update: (info: ServerUrlInfo) => void } {
  let isEditing = false;

  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        position: fixed;
        right: 16px;
        bottom: 16px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      .fab {
        appearance: none;
        border: 0;
        background: #5865f2;
        color: white;
        width: 44px;
        height: 44px;
        border-radius: 22px;
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      }

      .fab:hover {
        background: #4752c4;
      }

      .panel {
        display: none;
        width: 320px;
        margin-bottom: 10px;
        border-radius: 12px;
        background: #1e1e1e;
        color: #f2f2f2;
        border: 1px solid #333;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
        overflow: hidden;
      }

      .panel.open {
        display: block;
      }

      .header {
        padding: 12px 14px;
        background: #191919;
        border-bottom: 1px solid #333;
        font-size: 13px;
        font-weight: 600;
      }

      .body {
        padding: 14px;
      }

      label {
        display: block;
        font-size: 12px;
        color: #bdbdbd;
        margin-bottom: 6px;
      }

      input {
        width: 100%;
        box-sizing: border-box;
        border-radius: 8px;
        border: 1px solid #444;
        background: #121212;
        color: #f2f2f2;
        padding: 10px 12px;
        font-size: 13px;
      }

      input:disabled {
        opacity: 0.65;
      }

      .toggle-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
        font-size: 13px;
        color: #f2f2f2;
        cursor: pointer;
        user-select: none;
      }

      .toggle-row input {
        width: auto;
        margin: 0;
        cursor: pointer;
      }

      .toggle-row span {
        line-height: 1.3;
      }

      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
      }

      button.save {
        appearance: none;
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        cursor: pointer;
        background: #5865f2;
        color: white;
      }

      button.save:disabled {
        opacity: 0.65;
        cursor: default;
      }

      .hint,
      .error {
        margin-top: 10px;
        font-size: 12px;
        line-height: 1.4;
      }

      .hint {
        color: #9a9a9a;
      }

      .error {
        color: #ff7b72;
      }

      .wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }
    </style>
    <div class="wrap">
      <div class="panel">
        <div class="header">${APP.displayName} — Server settings</div>
        <div class="body">
          <label for="stoat-server-url">Server URL</label>
          <input id="stoat-server-url" type="url" spellcheck="false" placeholder="https://stoat.viniciusrangel.dev/app" />
          <label class="toggle-row">
            <input id="stoat-beta-ui" type="checkbox" />
            <span>Beta UI (load client from /v2)</span>
          </label>
          <div class="actions">
            <button class="save" type="button">Save</button>
          </div>
          <div class="hint"></div>
          <div class="error"></div>
        </div>
      </div>
      <button class="fab" type="button" aria-label="Server settings" title="Server settings">⚙</button>
    </div>
  `;

  const panel = shadow.querySelector(".panel") as HTMLDivElement;
  const fab = shadow.querySelector(".fab") as HTMLButtonElement;
  const input = shadow.querySelector("#stoat-server-url") as HTMLInputElement;
  const betaUiInput = shadow.querySelector(
    "#stoat-beta-ui",
  ) as HTMLInputElement;
  const save = shadow.querySelector(".save") as HTMLButtonElement;
  const hint = shadow.querySelector(".hint") as HTMLDivElement;
  const error = shadow.querySelector(".error") as HTMLDivElement;

  fab.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  input.addEventListener("focus", () => {
    isEditing = true;
  });

  input.addEventListener("blur", () => {
    isEditing = false;
  });

  input.addEventListener("input", () => {
    isEditing = true;
  });

  function applyInfo(next: ServerUrlInfo, force = false) {
    if (!force && isEditing) {
      input.disabled = next.overridden;
      betaUiInput.disabled = next.overridden;
      save.disabled = next.overridden;
      return;
    }

    input.value = next.url;
    betaUiInput.checked = next.betaUi;
    input.disabled = next.overridden;
    betaUiInput.disabled = next.overridden;
    save.disabled = next.overridden;

    if (next.overridden) {
      hint.textContent =
        "Server URL is overridden by --force-server for this session.";
    } else if (next.storedUrl) {
      hint.textContent = `Saved between launches. ${APP_PATH_HINT}`;
    } else {
      hint.textContent = `Default: ${next.defaultUrl}. ${APP_PATH_HINT}`;
    }

    error.textContent = "";
  }

  applyInfo(info, true);

  save.addEventListener("click", async () => {
    error.textContent = "";
    save.disabled = true;
    isEditing = false;

    const result = await setServerUrl(input.value.trim(), betaUiInput.checked);

    if (!result.ok) {
      error.textContent = result.error;
      save.disabled = info.overridden;
      isEditing = true;
      return;
    }

    info = {
      ...info,
      url: result.url,
      betaUi: result.betaUi,
      storedUrl: result.url === info.defaultUrl ? null : result.url,
    };
    applyInfo(info, true);

    if (result.reloaded) {
      hint.textContent = "Reloading…";
      panel.classList.remove("open");
    }

    save.disabled = info.overridden;
  });

  return {
    update: (next: ServerUrlInfo) => applyInfo(next, false),
  };
}

let mountedHost: HTMLElement | null = null;
let ui: { update: (info: ServerUrlInfo) => void } | null = null;
let mountPolls = 0;
const MAX_MOUNT_POLLS = 15;
let syncQueued = false;

function whenDomReady(callback: () => void) {
  const run = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(callback);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run, { once: true });
    return;
  }

  run();
}

function scheduleSyncSettingsUi() {
  if (syncQueued) {
    return;
  }

  syncQueued = true;
  whenDomReady(() => {
    syncQueued = false;
    void syncSettingsUi();
  });
}

async function syncSettingsUi() {
  if (!shouldShowServerSettings()) {
    mountedHost?.remove();
    mountedHost = null;
    ui = null;
    mountPolls = 0;
    return;
  }

  try {
    const info = await getServerUrl();

    if (!mountedHost) {
      mountedHost = document.createElement("div");
      mountedHost.id = ROOT_ID;
      document.body.appendChild(mountedHost);
      ui = createSettingsUi(mountedHost, info);
      return;
    }

    ui?.update(info);
  } catch (err) {
    console.error("[stoat-desktop] server settings UI failed:", err);
  }
}

hookNavigation(() => {
  scheduleSyncSettingsUi();
});

scheduleSyncSettingsUi();

// Poll only until mounted (SPA may hydrate late); avoid overwriting user input afterward.
window.setInterval(() => {
  if (mountedHost && mountPolls >= MAX_MOUNT_POLLS) {
    return;
  }
  mountPolls += 1;
  scheduleSyncSettingsUi();
}, 1000);
