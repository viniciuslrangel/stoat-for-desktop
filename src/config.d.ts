declare type DesktopConfig = {
  firstLaunch: boolean;
  customFrame: boolean;
  minimiseToTray: boolean;
  startMinimisedToTray: boolean;
  spellchecker: boolean;
  hardwareAcceleration: boolean;
  discordRpc: boolean;
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
};

declare type SetServerUrlResult =
  | { ok: true; url: string }
  | { ok: false; error: string };
