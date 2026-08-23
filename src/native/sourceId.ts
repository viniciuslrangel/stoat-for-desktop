export function parseHwndFromSourceId(sourceId: string): number | null {
  const match = /^window:(\d+):/.exec(sourceId);
  if (!match) {
    return null;
  }

  const hwnd = Number(match[1]);
  return Number.isSafeInteger(hwnd) ? hwnd : null;
}
