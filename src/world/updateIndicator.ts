import { ipcRenderer } from "electron";

const ROOT_ID = "stoat-desktop-update-indicator";

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
        position: fixed;
        left: 16px;
        bottom: 16px;
        z-index: 2147483646;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }

      .wrap {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
      }

      .pill {
        appearance: none;
        border: 0;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        color: white;
        cursor: pointer;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
      }

      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        flex-shrink: 0;
      }

      .panel {
        display: none;
        width: 300px;
        margin-bottom: 10px;
        border-radius: 12px;
        background: #1e1e1e;
        color: #f2f2f2;
        border: 1px solid #333;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
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
      <div class="panel">
        <div class="header">App updates</div>
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
      <button class="pill" type="button" aria-label="App update status">
        <span class="dot"></span>
        <span class="label"></span>
      </button>
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

  pill.addEventListener("click", () => {
    panel.classList.toggle("open");
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

async function mountIndicator(initial?: UpdateStatus) {
  const info = initial ?? (await getUpdateStatus());

  if (!mountedHost) {
    mountedHost = document.createElement("div");
    mountedHost.id = ROOT_ID;
    document.body.appendChild(mountedHost);
    ui = createIndicatorUi(mountedHost, info);
    return;
  }

  ui?.update(info);
}

ipcRenderer.on("update-status", (_event, next: UpdateStatus) => {
  void mountIndicator(next);
});

void mountIndicator();
