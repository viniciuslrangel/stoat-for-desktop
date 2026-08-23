export type StartResult = {
  sampleRate: number;
  channels: number;
  format: string;
};

export function isSupported(): boolean;
export function pidFromHwnd(hwnd: number): number;
export function queryProcessImage(pid: number): string;
export function findProcessesByImageName(imageName: string): number[];
export function startCapture(
  mode: string,
  pid: number,
  excludePids: number[],
): StartResult;
export function stopCapture(): void;
export function readPcm(maxFrames: number): Float32Array;
