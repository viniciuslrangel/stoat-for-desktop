"use strict";

/**
 * Soft-load the Windows process-loopback native addon.
 * Non-Windows platforms and missing binaries export unsupported stubs so
 * Electron main can fall back to Chromium loopback without crashing.
 */

function unsupported() {
  return {
    isSupported: () => false,
    pidFromHwnd: () => {
      throw new Error("win-process-loopback is unavailable");
    },
    queryProcessImage: () => {
      throw new Error("win-process-loopback is unavailable");
    },
    findProcessesByImageName: () => [],
    startCapture: () => {
      throw new Error("win-process-loopback is unavailable");
    },
    stopCapture: () => {},
    readPcm: () => new Float32Array(0),
  };
}

if (process.platform !== "win32") {
  module.exports = unsupported();
} else {
  const architecture = process.arch;
  const suffix = `win32-${architecture}-msvc`;
  try {
    module.exports = require(`./win-process-loopback.${suffix}.node`);
  } catch (error) {
    console.warn(
      "[win-process-loopback] native addon missing; using stubs",
      error,
    );
    module.exports = unsupported();
  }
}
