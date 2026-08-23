import { BrowserWindow, desktopCapturer, ipcMain, session } from "electron";

const PICKER_THUMBNAIL_SIZE = { width: 320, height: 180 };
const PICKER_TIMEOUT_MS = 30_000;

type ActiveScreenPicker = {
  callback: (streams: Electron.Streams) => void;
  sources: Electron.DesktopCapturerSource[];
  timeout: ReturnType<typeof setTimeout>;
};

let activePicker: ActiveScreenPicker | undefined;

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
      picker.callback({});
      return;
    }

    const requestedAudio = pickerAudio(audio);
    picker.callback({
      video: picker.sources[idx],
      ...(requestedAudio ? { audio: requestedAudio } : {}),
    });
  };

  ipcMain.on("screenPickerCallback", (_, idx: number, audio: boolean) => {
    if (activePicker) {
      finishPicker(activePicker, idx, audio === true);
    }
  });

  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer
        .getSources({
          types: ["screen", "window"],
          fetchWindowIcons: true,
          thumbnailSize: PICKER_THUMBNAIL_SIZE,
        })
        .then((sources) => {
          if (sources.length <= 1) {
            if (sources.length === 0) {
              callback({});
              return;
            }
            const requestedAudio = pickerAudio(request.audioRequested);
            callback({
              video: sources[0],
              ...(requestedAudio ? { audio: requestedAudio } : {}),
            });
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
                  image: sourcePreviewDataUrl(source),
                };
              }),
            );
          } catch {
            finishPicker(picker, -1, false);
          }
        })
        .catch(() => callback({}));
    },
    // The renderer always prepares the custom picker. Using macOS's system
    // picker here would bypass the IPC event and leave that promise pending.
    { useSystemPicker: false },
  );
}
