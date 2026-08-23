# Stoat Windows process loopback

This crate exposes a small napi-rs API for capturing Windows audio:

```js
const audio = require("@stoat/win-process-loopback");

if (audio.isSupported()) {
  const { sampleRate, channels, format } =
    audio.startCapture("includeTree", pid, []);
  // readPcm() returns interleaved stereo Float32 samples.
  const samples = audio.readPcm(4800);
  audio.stopCapture();
}
```

## Build

The native module is built on Windows (or with a Windows Rust target and SDK):

```bash
cd native/win-process-loopback
npm install
napi build --platform --release
```

## Modes

- `includeTree`: captures `pid` and its process tree. `excludePids` must be
  empty.
- `excludeTrees`: uses the roots in `excludePids`. The `pid` argument is
  validated for API symmetry. One root uses Windows' native
  `PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE` mode, while multiple
  roots use a subtractive graph.

The public output is always 48 kHz, stereo, interleaved `Float32Array`.
`readPcm(maxFrames)` is non-blocking and returns at most `maxFrames` frames.
`stopCapture()` is safe to call more than once. Only one capture session may
run at a time.

`pidFromHwnd`, `queryProcessImage`, and `findProcessesByImageName` use native
Win32 process APIs. On non-Windows platforms, `isSupported()` is false and
capture/process operations return an unsupported-platform error.
