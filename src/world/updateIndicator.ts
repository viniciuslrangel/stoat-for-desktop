import { ipcRenderer } from "electron";

const ROOT_ID = "stoat-desktop-update-indicator";
const PANEL_ROOT_ID = "stoat-desktop-update-panel";
const SLOT_ID = "stoat-desktop-update-slot";
const PANEL_Z_INDEX = 2147483646;

function getUpdateStatus(): Promise<UpdateStatus> {
  return ipcRenderer.invoke("getUpdateStatus");
}

function checkForUpdatesNow(): Promise<UpdateStatus> {
  return ipcRenderer.invoke("checkForUpdatesNow");
}

function installDownloadedUpdate(): Promise<void> {
  return ipcRenderer.invoke("installDownloadedUpdate");
}

function dismissUpdateError(): Promise<UpdateStatus> {
  return ipcRenderer.invoke("dismissUpdateError");
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

const PANEL_STYLES = `
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: ${PANEL_Z_INDEX};
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .panel {
    display: none;
    position: fixed;
    width: 300px;
    border-radius: 12px;
    background: #1e1e1e;
    color: #f2f2f2;
    border: 1px solid #333;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    pointer-events: auto;
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

  .detail {
    margin: 0 0 10px;
    color: #9a9a9a;
  }

  .detail summary {
    cursor: pointer;
    color: #bdbdbd;
    font-size: 11px;
  }

  .detail pre {
    margin: 8px 0 0;
    max-height: 96px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
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
`;

function createIndicatorUi(
  host: HTMLElement,
  initial: UpdateStatus,
): { update: (next: UpdateStatus) => void; destroy: () => void } {
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
        z-index: ${PANEL_Z_INDEX};
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
    </style>
    <button class="pill" type="button" aria-label="App update status">
      <span class="dot"></span>
      <span class="label"></span>
    </button>
  `;

  const panelHost = document.createElement("div");
  panelHost.id = PANEL_ROOT_ID;
  document.body.appendChild(panelHost);

  const panelShadow = panelHost.attachShadow({ mode: "open" });
  panelShadow.innerHTML = `
    <style>${PANEL_STYLES}</style>
    <div class="panel">
      <div class="header">
        <span>App updates</span>
        <button class="close" type="button" aria-label="Close update panel">×</button>
      </div>
      <div class="body">
        <div class="meta"></div>
        <div class="message"></div>
        <details class="detail" hidden>
          <summary>Technical details</summary>
          <pre></pre>
        </details>
        <div class="notes"></div>
        <div class="actions">
          <button class="check" type="button">Check now</button>
          <button class="dismiss secondary" type="button" hidden>Dismiss</button>
          <button class="install success" type="button" hidden>Restart to install</button>
        </div>
      </div>
    </div>
  `;

  const pill = shadow.querySelector(".pill") as HTMLButtonElement;
  const dot = shadow.querySelector(".dot") as HTMLSpanElement;
  const label = shadow.querySelector(".label") as HTMLSpanElement;
  const panel = panelShadow.querySelector(".panel") as HTMLDivElement;
  const meta = panelShadow.querySelector(".meta") as HTMLDivElement;
  const message = panelShadow.querySelector(".message") as HTMLDivElement;
  const detail = panelShadow.querySelector(".detail") as HTMLDetailsElement;
  const detailPre = panelShadow.querySelector(".detail pre") as HTMLPreElement;
  const notes = panelShadow.querySelector(".notes") as HTMLDivElement;
  const checkBtn = panelShadow.querySelector(".check") as HTMLButtonElement;
  const dismissBtn = panelShadow.querySelector(".dismiss") as HTMLButtonElement;
  const installBtn = panelShadow.querySelector(".install") as HTMLButtonElement;
  const closeBtn = panelShadow.querySelector(".close") as HTMLButtonElement;

  let panelOpen = false;
  let lastLoggedDetail: string | null = null;

  function positionPanel() {
    const rect = pill.getBoundingClientRect();
    panel.style.top = `${rect.bottom + 8}px`;
    panel.style.right = `${window.innerWidth - rect.right}px`;
    panel.style.left = "auto";
  }

  function applyStatus(next: UpdateStatus) {
    const color = stateColor(next.state);
    pill.style.background = color;
    label.textContent = stateLabel(next.state);
    dot.style.display = shouldShowBadge(next.state) ? "inline-block" : "none";

    meta.textContent = `Installed: v${next.currentVersion}${
      next.availableVersion ? ` · Available: v${next.availableVersion}` : ""
    }`;
    message.textContent = next.message ?? "";
    const showDetail = next.state === "error" && Boolean(next.detail);
    detail.hidden = !showDetail;
    if (!showDetail) {
      detail.open = false;
    }
    detailPre.textContent = next.detail ?? "";
    notes.textContent = next.releaseNotes ?? "";
    notes.hidden = !next.releaseNotes;

    installBtn.hidden = next.state !== "downloaded";
    dismissBtn.hidden = next.state !== "error";
    checkBtn.disabled =
      next.state === "checking" || next.state === "downloading";

    if (
      next.state === "error" &&
      next.detail &&
      next.detail !== lastLoggedDetail
    ) {
      lastLoggedDetail = next.detail;
      console.warn("[stoat-desktop] update error:", next.message, next.detail);
    } else if (next.state !== "error") {
      lastLoggedDetail = null;
    }
  }

  applyStatus(initial);

  function closePanel() {
    if (!panelOpen) {
      return;
    }

    panelOpen = false;
    panel.classList.remove("open");
    window.removeEventListener("pointerdown", handlePointerDown, true);
    window.removeEventListener("resize", positionPanel);
    window.removeEventListener("scroll", positionPanel, true);
  }

  function openPanel() {
    positionPanel();
    panelOpen = true;
    panel.classList.add("open");
    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", positionPanel);
    window.addEventListener("scroll", positionPanel, true);
  }

  function handlePointerDown(event: PointerEvent) {
    const path = event.composedPath();
    if (path.includes(pill) || path.includes(panelHost)) {
      return;
    }

    closePanel();
  }

  pill.addEventListener("click", () => {
    if (panelOpen) {
      closePanel();
      return;
    }

    openPanel();
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

  dismissBtn.addEventListener("click", async () => {
    const next = await dismissUpdateError();
    applyStatus(next);
    closePanel();
  });

  installBtn.addEventListener("click", () => {
    void installDownloadedUpdate();
  });

  return {
    update: applyStatus,
    destroy: () => {
      closePanel();
      panelHost.remove();
    },
  };
}

let mountedHost: HTMLElement | null = null;
let ui: { update: (next: UpdateStatus) => void; destroy: () => void } | null =
  null;
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
