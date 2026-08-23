import { BrowserWindow, desktopCapturer, ipcMain, session } from "electron";

const PICKER_THUMBNAIL_SIZE = { width: 320, height: 180 };

function sourcePreviewDataUrl(source: Electron.DesktopCapturerSource): string | undefined {
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
  session.defaultSession.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer
        .getSources({
          types: ["screen", "window"],
          fetchWindowIcons: true,
          thumbnailSize: PICKER_THUMBNAIL_SIZE,
        })
        .then((sources) => {
          if (sources.length == 1) {
            request.audioRequested
              ? callback({
                  video: sources[0],
                  audio: "loopback",
                })
              : callback({
                  video: sources[0],
                });
            return;
          }

          ipcMain.removeAllListeners("screenPickerCallback");
          ipcMain.once(
            "screenPickerCallback",
            (_, idx: number, audio: boolean) => {
              if (idx < 0 || idx >= sources.length) {
                callback({});
              } else {
                audio
                  ? callback({
                      video: sources[idx],
                      audio: "loopback",
                    })
                  : callback({
                      video: sources[idx],
                    });
              }
            },
          );
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
        });
    },
    { useSystemPicker: process.platform === "darwin" },
  );
}
