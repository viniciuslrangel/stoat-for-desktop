const ROOT_ID = "stoat-desktop-server-settings";

function isLoginPage(): boolean {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/login" || path.endsWith("/login");
}

function hookHistory(callback: () => void) {
  const wrap = <T extends History["pushState"]>(method: T): T =>
    ((...args: Parameters<T>) => {
      const result = method(...args);
      callback();
      return result;
    }) as T;

  history.pushState = wrap(history.pushState);
  history.replaceState = wrap(history.replaceState);
  window.addEventListener("popstate", callback);
}

function createSettingsUi(
  host: HTMLElement,
  info: ServerUrlInfo,
): { update: (info: ServerUrlInfo) => void } {
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

      .panel {
        width: 320px;
        border-radius: 12px;
        background: #1e1e1e;
        color: #f2f2f2;
        border: 1px solid #333;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
        overflow: hidden;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px;
        background: #191919;
        border-bottom: 1px solid #333;
      }

      .title {
        font-size: 13px;
        font-weight: 600;
      }

      .toggle {
        appearance: none;
        border: 0;
        background: #2a2a2a;
        color: inherit;
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
      }

      .toggle:hover {
        background: #333;
      }

      .body {
        display: none;
        padding: 14px;
      }

      .body.open {
        display: block;
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

      .actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 13px;
        cursor: pointer;
      }

      .save {
        background: #5865f2;
        color: white;
      }

      .save:disabled {
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
    </style>
    <div class="panel">
      <div class="header">
        <span class="title">Server settings</span>
        <button class="toggle" type="button" aria-label="Toggle server settings">⚙</button>
      </div>
      <div class="body">
        <label for="stoat-server-url">Server URL</label>
        <input id="stoat-server-url" type="url" spellcheck="false" />
        <div class="actions">
          <button class="save" type="button">Save</button>
        </div>
        <div class="hint"></div>
        <div class="error"></div>
      </div>
    </div>
  `;

  const toggle = shadow.querySelector(".toggle") as HTMLButtonElement;
  const body = shadow.querySelector(".body") as HTMLDivElement;
  const input = shadow.querySelector("#stoat-server-url") as HTMLInputElement;
  const save = shadow.querySelector(".save") as HTMLButtonElement;
  const hint = shadow.querySelector(".hint") as HTMLDivElement;
  const error = shadow.querySelector(".error") as HTMLDivElement;

  toggle.addEventListener("click", () => {
    body.classList.toggle("open");
  });

  function applyInfo(next: ServerUrlInfo) {
    input.value = next.url;
    input.disabled = next.overridden;
    save.disabled = next.overridden;

    if (next.overridden) {
      hint.textContent =
        "Server URL is overridden by --force-server for this session.";
    } else if (next.storedUrl) {
      hint.textContent = "Changes are saved and kept between launches.";
    } else {
      hint.textContent = `Using default server (${next.defaultUrl}).`;
    }

    error.textContent = "";
  }

  applyInfo(info);

  save.addEventListener("click", async () => {
    error.textContent = "";
    save.disabled = true;

    const result = await window.desktopConfig.setServerUrl(input.value.trim());

    if (!result.ok) {
      error.textContent = result.error;
      save.disabled = info.overridden;
      return;
    }

    applyInfo({
      ...info,
      url: result.url,
      storedUrl: result.url === info.defaultUrl ? null : result.url,
    });
    save.disabled = info.overridden;
  });

  return {
    update: applyInfo,
  };
}

let mountedHost: HTMLElement | null = null;
let ui: { update: (info: ServerUrlInfo) => void } | null = null;

async function syncSettingsUi() {
  if (!isLoginPage()) {
    mountedHost?.remove();
    mountedHost = null;
    ui = null;
    return;
  }

  const info = await window.desktopConfig.getServerUrl();

  if (!mountedHost) {
    mountedHost = document.createElement("div");
    mountedHost.id = ROOT_ID;
    document.documentElement.appendChild(mountedHost);
    ui = createSettingsUi(mountedHost, info);
    return;
  }

  ui?.update(info);
}

hookHistory(() => {
  void syncSettingsUi();
});

window.addEventListener("DOMContentLoaded", () => {
  void syncSettingsUi();
});

if (document.readyState !== "loading") {
  void syncSettingsUi();
}
