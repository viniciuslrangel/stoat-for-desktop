import { BrowserWindow, desktopCapturer, ipcMain, session } from "electron";

const PICKER_THUMBNAIL_SIZE = { width: 320, height: 180 };
const PICKER_TIMEOUT_MS = 30_000;

type ActiveScreenPicker = {
  callback: (streams: Electron.Streams) => void;
  sources: Electron.DesktopCapturerSource[];
  timeout: ReturnType<typeof setTimeout>;
};

let activePicker: ActiveScreenPicker | undefined;

function errorProperty(error: unknown, property: string): unknown {
  if (
    error !== null &&
    (typeof error === "object" || typeof error === "function")
  ) {
    try {
      return Reflect.get(error, property);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function logScreenShareError(
  stage: string,
  error: unknown,
  context: Record<string, unknown> = {},
) {
  console.error(`[${stage}]`, {
    ...context,
    error,
    errorName:
      error instanceof Error ? error.name : errorProperty(error, "name"),
    errorMessage:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : errorProperty(error, "message"),
    constraint: errorProperty(error, "constraint"),
    cause: errorProperty(error, "cause"),
  });
}

function logScreenShareInfo(
  stage: string,
  message: string,
  context: Record<string, unknown> = {},
) {
  console.info(`[${stage}] ${message}`, context);
}

function pickerAudio(requested: boolean): "loopback" | undefined {
  return requested && process.platform === "win32" ? "loopback" : undefined;
}

function sourcePreviewDataUrl(
  source: Electron.DesktopCapturerSource,
): string | undefined {
  const thumbnail = source.thumbnail;
  if (thumbnail && !thumbnail.isEmpty()) {
    return thumbnail.toDataURL();
  }

  const icon = source.appIcon;
  if (!icon || icon.isEmpty()) {
    return undefined;
  }

  if (icon.getAspectRatio() > 1) {
    return icon.resize({ width: 256 }).toDataURL();
  }

  return icon.resize({ height: 256 }).toDataURL();
}

function safeSourcePreviewDataUrl(
  source: Electron.DesktopCapturerSource,
): string | undefined {
  try {
    return sourcePreviewDataUrl(source);
  } catch (error) {
    logScreenShareError("screenshare:picker", error, {
      action: "create source preview",
      source: source.name,
    });
    return undefined;
  }
}

export function initScreenShareHandler(mainWindow: BrowserWindow) {
  const finishPicker = (
    picker: ActiveScreenPicker,
    idx: number,
    audio: boolean,
  ) => {
    if (activePicker !== picker) {
      return;
    }

    activePicker = undefined;
    clearTimeout(picker.timeout);
    if (!Number.isInteger(idx) || idx < 0 || idx >= picker.sources.length) {
      const cancelled = Number.isInteger(idx) && idx < 0;
      if (cancelled) {
        logScreenShareInfo(
          "screenshare:cancelled",
          "screen share capture cancelled",
        );
      } else {
        logScreenShareError(
          "screenshare:picker",
          new Error("Invalid screen picker source selection"),
          { sourceIndex: idx },
        );
      }
      try {
        picker.callback({});
      } catch (error) {
        logScreenShareError("screenshare:displayMedia", error, {
          action: cancelled
            ? "cancel capture request"
            : "reject invalid capture source",
        });
      }
      return;
    }

    const requestedAudio = pickerAudio(audio);
    try {
      picker.callback({
        video: picker.sources[idx],
        ...(requestedAudio ? { audio: requestedAudio } : {}),
      });
      logScreenShareInfo("screenshare:picker", "source selected", {
        source: picker.sources[idx].name,
        sourceIndex: idx,
        audioRequested: audio,
        audioProvided: requestedAudio ?? false,
      });
    } catch (error) {
      logScreenShareError("screenshare:displayMedia", error, {
        action: "provide selected capture source",
        sourceIndex: idx,
        audioRequested: audio,
      });
    }
  };

  ipcMain.on("screenPickerCallback", (_, idx: number, audio: boolean) => {
    if (activePicker) {
      finishPicker(activePicker, idx, audio === true);
    } else {
      logScreenShareError(
        "screenshare:picker",
        new Error("Screen picker callback received without an active request"),
        { sourceIndex: idx, audio },
      );
    }
  });

  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      logScreenShareInfo(
        "screenshare:displayMedia",
        "capture request received",
        {
          audioRequested: request.audioRequested,
          platform: process.platform,
        },
      );
      desktopCapturer
        .getSources({
          types: ["screen", "window"],
          fetchWindowIcons: true,
          thumbnailSize: PICKER_THUMBNAIL_SIZE,
        })
        .then((sources) => {
          logScreenShareInfo("screenshare:picker", "capture sources received", {
            count: sources.length,
          });
          if (sources.length <= 1) {
            if (sources.length === 0) {
              try {
                callback({});
              } catch (error) {
                logScreenShareError("screenshare:displayMedia", error, {
                  action: "cancel capture with no sources",
                });
              }
              return;
            }
            const requestedAudio = pickerAudio(request.audioRequested);
            try {
              callback({
                video: sources[0],
                ...(requestedAudio ? { audio: requestedAudio } : {}),
              });
              logScreenShareInfo(
                "screenshare:picker",
                "single source selected",
                {
                  source: sources[0].name,
                  audioRequested: request.audioRequested,
                  audioProvided: requestedAudio ?? false,
                },
              );
            } catch (error) {
              logScreenShareError("screenshare:displayMedia", error, {
                action: "provide single capture source",
              });
            }
            return;
          }

          if (activePicker) {
            finishPicker(activePicker, -1, false);
          }
          const picker: ActiveScreenPicker = {
            callback,
            sources,
            timeout: setTimeout(
              () => finishPicker(picker, -1, false),
              PICKER_TIMEOUT_MS,
            ),
          };
          activePicker = picker;
          try {
            mainWindow.webContents.send(
              "screenPicker",
              sources.map((source, idx) => {
                return {
                  idx: idx,
                  name: source.name,
                  isFullScreen: source.id.startsWith("screen"),
                  image: safeSourcePreviewDataUrl(source),
                };
              }),
            );
          } catch (error) {
            logScreenShareError("screenshare:picker", error, {
              action: "send sources to renderer",
            });
            finishPicker(picker, -1, false);
          }
        })
        .catch((error) => {
          logScreenShareError("screenshare:picker", error, {
            action: "getSources",
            audioRequested: request.audioRequested,
          });
          try {
            callback({});
          } catch (callbackError) {
            logScreenShareError("screenshare:displayMedia", callbackError, {
              action: "cancel capture after source enumeration failure",
            });
          }
        });
    },
    // The renderer always prepares the custom picker. Using macOS's system
    // picker here would bypass the IPC event and leave that promise pending.
    { useSystemPicker: false },
  );
}
