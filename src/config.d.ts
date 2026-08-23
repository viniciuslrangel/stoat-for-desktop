declare type DesktopConfig = {
  firstLaunch: boolean;
  customFrame: boolean;
  minimiseToTray: boolean;
  startMinimisedToTray: boolean;
  spellchecker: boolean;
  hardwareAcceleration: boolean;
  discordRpc: boolean;
  excludeDiscordFromScreenShareAudio: boolean;
  betaUi: boolean;
  serverUrl: string | null;
  windowState: {
    x: number;
    y: number;
    width: number;
    height: number;
    isMaximised: boolean;
  };
};

declare type ServerUrlInfo = {
  url: string;
  storedUrl: string | null;
  defaultUrl: string;
  overridden: boolean;
  betaUi: boolean;
};

declare type SetServerUrlResult =
  | { ok: true; url: string; betaUi: boolean; reloaded: boolean }
  | { ok: false; error: string };

declare type UpdateState =
  | "unsupported"
  | "dev"
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error";

declare type UpdateStatus = {
  state: UpdateState;
  currentVersion: string;
  availableVersion: string | null;
  message: string | null;
  detail: string | null;
  releaseNotes: string | null;
  lastCheckedAt: number | null;
};
