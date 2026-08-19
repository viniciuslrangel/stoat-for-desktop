import { ipcRenderer } from "electron";

const ROOT_ID = "stoat-desktop-update-indicator";
const SLOT_ID = "stoat-desktop-update-slot";

function getUpdateStatus(): Promise<UpdateStatus> {
  return ipcRenderer.invoke("getUpdateStatus");
}

function checkForUpdatesNow(): Promise<UpdateStatus> {
  return ipcRenderer.invoke("checkForUpdatesNow");
}

function installDownloadedUpdate(): Promise<void> {
  return ipcRenderer.invoke("installDownloadedUpdate");
}

function stateLabel(state: UpdateStatus["state"]): string {
  switch (state) {
    case "checking":
      return "Checking…";
    case "available":
      return "Update found";
    case "downloading":
      return "Downloading…";
    case "downloaded":
      return "Restart to update";
    case "up-to-date":
      return "Up to date";
    case "error":
      return "Update error";
    case "unsupported":
      return "Updates N/A";
    case "dev":
      return "Dev build";
    default:
      return "Updates";
  }
}

function stateColor(state: UpdateStatus["state"]): string {
  switch (state) {
    case "downloaded":
      return "#3ba55d";
    case "available":
    case "downloading":
      return "#faa81a";
    case "error":
      return "#ed4245";
    case "up-to-date":
      return "#72767d";
    default:
      return "#5865f2";
  }
}

function shouldShowBadge(state: UpdateStatus["state"]): boolean {
  return state !== "idle" && state !== "up-to-date";
}

function createIndicatorUi(
  host: HTMLElement,
  initial: UpdateStatus,
): { update: (next: UpdateStatus) => void } {
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = `
    <style>
      :host {
        all: initial;
        display: inline-flex;
        position: relative;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      :host([data-fallback]) {
        position: fixed;
        top: 40px;
        right: 16px;
        z-index: 2147483646;
      }

      .wrap {
        position: relative;
        display: inline-flex;
        align-items: center;
      }

      .pill {
        appearance: none;
        border: 0;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 600;
        color: white;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
        white-space: nowrap;
      }

      .dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        flex-shrink: 0;
      }

      .panel {
        display: none;
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        width: 300px;
        border-radius: 12px;
        background: #1e1e1e;
        color: #f2f2f2;
        border: 1px solid #333;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
        overflow: hidden;
        z-index: 1;
      }

      .panel.open {
        display: block;
      }

      .header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        padding: 10px 12px;
        background: #191919;
        border-bottom: 1px solid #333;
        font-size: 13px;
        font-weight: 600;
      }

      .close {
        appearance: none;
        border: 0;
        border-radius: 6px;
        padding: 2px 6px;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        background: transparent;
        color: #bdbdbd;
      }

      .close:hover {
        background: #2a2a2a;
        color: #f2f2f2;
      }

      .body {
        padding: 14px;
        font-size: 12px;
        line-height: 1.45;
      }

      .meta {
        color: #bdbdbd;
        margin-bottom: 8px;
      }

      .message {
        margin-bottom: 10px;
      }

      .notes {
        max-height: 120px;
        overflow: auto;
        color: #9a9a9a;
        white-space: pre-wrap;
        margin-bottom: 10px;
      }

      .actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      button {
        appearance: none;
        border: 0;
        border-radius: 8px;
        padding: 8px 12px;
        font-size: 12px;
        cursor: pointer;
        background: #5865f2;
        color: white;
      }

      button.secondary {
        background: #2a2a2a;
        color: #f2f2f2;
      }

      button.success {
        background: #3ba55d;
      }
    </style>
    <div class="wrap">
      <button class="pill" type="button" aria-label="App update status">
        <span class="dot"></span>
        <span class="label"></span>
      </button>
      <div class="panel">
        <div class="header">
          <span>App updates</span>
          <button class="close" type="button" aria-label="Close update panel">×</button>
        </div>
        <div class="body">
          <div class="meta"></div>
          <div class="message"></div>
          <div class="notes"></div>
          <div class="actions">
            <button class="check" type="button">Check now</button>
            <button class="install success" type="button" hidden>Restart to install</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const panel = shadow.querySelector(".panel") as HTMLDivElement;
  const pill = shadow.querySelector(".pill") as HTMLButtonElement;
  const dot = shadow.querySelector(".dot") as HTMLSpanElement;
  const label = shadow.querySelector(".label") as HTMLSpanElement;
  const meta = shadow.querySelector(".meta") as HTMLDivElement;
  const message = shadow.querySelector(".message") as HTMLDivElement;
  const notes = shadow.querySelector(".notes") as HTMLDivElement;
  const checkBtn = shadow.querySelector(".check") as HTMLButtonElement;
  const installBtn = shadow.querySelector(".install") as HTMLButtonElement;
  const closeBtn = shadow.querySelector(".close") as HTMLButtonElement;

  function applyStatus(next: UpdateStatus) {
    const color = stateColor(next.state);
    pill.style.background = color;
    label.textContent = stateLabel(next.state);
    dot.style.display = shouldShowBadge(next.state) ? "inline-block" : "none";

    meta.textContent = `Installed: v${next.currentVersion}${
      next.availableVersion ? ` · Available: v${next.availableVersion}` : ""
    }`;
    message.textContent = next.message ?? "";
    notes.textContent = next.releaseNotes ?? "";
    notes.hidden = !next.releaseNotes;

    installBtn.hidden = next.state !== "downloaded";
    checkBtn.disabled =
      next.state === "checking" || next.state === "downloading";
  }

  applyStatus(initial);

  function closePanel() {
    panel.classList.remove("open");
  }

  pill.addEventListener("click", () => {
    panel.classList.toggle("open");
  });

  closeBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    closePanel();
  });

  checkBtn.addEventListener("click", async () => {
    checkBtn.disabled = true;
    const next = await checkForUpdatesNow();
    applyStatus(next);
  });

  installBtn.addEventListener("click", () => {
    void installDownloadedUpdate();
  });

  return { update: applyStatus };
}

let mountedHost: HTMLElement | null = null;
let ui: { update: (next: UpdateStatus) => void } | null = null;
let pendingStatus: UpdateStatus | null = null;
let mountQueued = false;
let slotObserver: MutationObserver | null = null;

function findSlot(): HTMLElement | null {
  return document.getElementById(SLOT_ID);
}

function attachHost(host: HTMLElement) {
  const slot = findSlot();

  if (slot) {
    host.removeAttribute("data-fallback");
    if (host.parentElement !== slot) {
      slot.replaceChildren(host);
    }
    return;
  }

  host.setAttribute("data-fallback", "");
  if (host.parentElement !== document.body) {
    document.body.appendChild(host);
  }
}

function ensureSlotObserver() {
  if (slotObserver || !document.body) {
    return;
  }

  slotObserver = new MutationObserver(() => {
    if (mountedHost) {
      attachHost(mountedHost);
    }
  });

  slotObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

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

async function mountIndicator(initial?: UpdateStatus) {
  if (initial) {
    pendingStatus = initial;
  }

  if (!document.body) {
    scheduleMount();
    return;
  }

  const info = pendingStatus ?? (await getUpdateStatus());
  pendingStatus = null;

  if (!mountedHost) {
    mountedHost = document.createElement("div");
    mountedHost.id = ROOT_ID;
    ui = createIndicatorUi(mountedHost, info);
    ensureSlotObserver();
  } else {
    ui?.update(info);
  }

  attachHost(mountedHost);
}

function scheduleMount(status?: UpdateStatus) {
  if (status) {
    pendingStatus = status;
  }

  if (mountQueued) {
    return;
  }

  mountQueued = true;
  whenDomReady(() => {
    mountQueued = false;
    void mountIndicator();
  });
}

ipcRenderer.on("update-status", (_event, next: UpdateStatus) => {
  scheduleMount(next);
});

scheduleMount();
