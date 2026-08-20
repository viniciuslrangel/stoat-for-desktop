import { app } from "electron";

const isWayland =
  process.platform === "linux" &&
  (process.env.XDG_SESSION_TYPE === "wayland" || !!process.env.WAYLAND_DISPLAY);

/**
 * Apply GPU / video-decode flags before app ready.
 * When disabled, Electron falls back to software rendering and decode.
 */
export function configureGpu(hardwareAcceleration: boolean): void {
  if (!hardwareAcceleration) {
    app.disableHardwareAcceleration();
    return;
  }

  if (process.platform !== "linux") {
    return;
  }

  app.commandLine.appendSwitch("ignore-gpu-blocklist");

  const features = [
    "AcceleratedVideoDecodeLinuxGL",
    "VaapiVideoDecoder",
    "VaapiIgnoreDriverChecks",
  ];

  if (isWayland) {
    features.push("AcceleratedVideoDecodeLinuxZeroCopyGL");
  }

  app.commandLine.appendSwitch("enable-features", features.join(","));
}
