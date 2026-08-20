# Changelog

## [1.110.0](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.109.0...v1.110.0) (2026-08-20)


### Features

* rebrand desktop app display name to Stoat VR ([c97ce41](https://github.com/viniciuslrangel/stoat-for-desktop/commit/c97ce4110d527908c9f7e3f24b30e8819cf52113))
* rebrand desktop app display name to Stoat VR ([e675da5](https://github.com/viniciuslrangel/stoat-for-desktop/commit/e675da5b234ad80b874cb18cd039f03ba1d59582))

## [1.109.0](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.108.4...v1.109.0) (2026-08-20)


### Features

* enable Linux VA-API video decode when hardware acceleration is on ([2b8a15d](https://github.com/viniciuslrangel/stoat-for-desktop/commit/2b8a15d0eefa1a135d68f53800c8c01b7138d748))
* Linux VA-API video decode for hardware acceleration ([19067be](https://github.com/viniciuslrangel/stoat-for-desktop/commit/19067be796d8cfee287f9c995ae49a98bec79fe3))

## [1.108.4](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.108.3...v1.108.4) (2026-08-19)


### Bug Fixes

* sync desktopConfig before renderer scripts run ([7e4a04b](https://github.com/viniciuslrangel/stoat-for-desktop/commit/7e4a04b4aa2c0fe5e6d93b6b3229d924c68dc285))
* sync desktopConfig before renderer scripts run ([c21abe4](https://github.com/viniciuslrangel/stoat-for-desktop/commit/c21abe44739e769c4bc7d02d18ef0cb5a815b82a))

## [1.108.3](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.108.2...v1.108.3) (2026-08-19)


### Bug Fixes

* reload webview when server URL changes on save ([87b6e44](https://github.com/viniciuslrangel/stoat-for-desktop/commit/87b6e4424d39b12ec97dd9f36d2e2da392a87bf6))

## [1.108.2](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.108.1...v1.108.2) (2026-08-19)


### Bug Fixes

* portal update panel to body for z-index ([19a90d5](https://github.com/viniciuslrangel/stoat-for-desktop/commit/19a90d5f1d2d597c7acabe20cbd183951a277b6e))
* portal update panel to body for z-index ([a8f7948](https://github.com/viniciuslrangel/stoat-for-desktop/commit/a8f7948ea42957c2562d368d2a4e9db7988f02d4))

## [1.108.1](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.108.0...v1.108.1) (2026-08-19)


### Features

* move auto-update indicator into channel header slot ([02197d2](https://github.com/viniciuslrangel/stoat-for-desktop/commit/02197d2f4ae3203a4872088a3a51c710d0ecc5f2))

## [1.108.0](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.107.6...v1.108.0) (2026-08-19)


### Features

* extract screen share handler with Windows capture optimizations ([751e2ec](https://github.com/viniciuslrangel/stoat-for-desktop/commit/751e2ec4bba75d92510993e90811e405b5911dc6))

## [1.107.6](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.107.5...v1.107.6) (2026-08-19)


### Bug Fixes

* defer overlay DOM injection until after SPA mount to prevent blank screen on reopen

## [1.107.5](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.107.4...v1.107.5) (2026-08-19)


### Features

* add bottom-left update status indicator with check, download progress, and restart actions

## [1.107.4](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.107.3...v1.107.4) (2026-08-19)


### Features

* toggle developer tools with F12, Ctrl+Shift+I, or context menu

## [1.107.3](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.107.2...v1.107.3) (2026-08-19)


### Bug Fixes

* stop background sync from clearing server URL input while typing or pasting
* require /app path on server URL (auto-append when host-only)

## [1.107.2](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.107.1...v1.107.2) (2026-08-19)


### Bug Fixes

* server settings UI use ipcRenderer in preload (desktopConfig is renderer-only)

## [1.107.1](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.6.0...v1.107.1) (2026-08-19)


### Bug Fixes

* show server settings on all login routes and /app entry ([dbd9b8b](https://github.com/viniciuslrangel/stoat-for-desktop/commit/dbd9b8b9d42586de34760fa1880fbba65c457e7e))

## [1.6.0](https://github.com/viniciuslrangel/stoat-for-desktop/compare/v1.5.2...v1.6.0) (2026-08-19)


### Features

* add persistent server URL settings on login screen ([4fb84f5](https://github.com/viniciuslrangel/stoat-for-desktop/commit/4fb84f57c5be907710399d46255efecf0d61203d))


### Bug Fixes

* **ci:** enable Release Please on fork with GITHUB_TOKEN ([58599d8](https://github.com/viniciuslrangel/stoat-for-desktop/commit/58599d8d07cab6e05ca4eda6075f3dfe05ea2e2a))
* **ci:** skip Release Please on personal fork ([3f657b6](https://github.com/viniciuslrangel/stoat-for-desktop/commit/3f657b6ba570cbe2bb5c233c55f6a427d0daee9d))
* **ci:** skip Release Please on personal fork ([88fe877](https://github.com/viniciuslrangel/stoat-for-desktop/commit/88fe877653dd64c7f6196d78e732d0b1bbb4bce3))
* enable release-please workflow on fork ([4963cb8](https://github.com/viniciuslrangel/stoat-for-desktop/commit/4963cb86e58cc9ef003c54da49d584d403596700))
* point autoupdate and releases at fork repo ([e36bd1c](https://github.com/viniciuslrangel/stoat-for-desktop/commit/e36bd1c86cecdb33dbb63c1729ae925ff45aa54b))
* remove startup reload that races with session restore ([e4e6b42](https://github.com/viniciuslrangel/stoat-for-desktop/commit/e4e6b4204d337af3a3dca14bb73c190bd42300ca))


### Reverts

* Add Mic and Webcam Entitlements ([#259](https://github.com/viniciuslrangel/stoat-for-desktop/issues/259)) ([#283](https://github.com/viniciuslrangel/stoat-for-desktop/issues/283)) ([644f076](https://github.com/viniciuslrangel/stoat-for-desktop/commit/644f0765b4d2f83656ea0868f4898091ca9f6442))

## [1.5.2](https://github.com/stoatchat/for-desktop/compare/v1.5.1...v1.5.2) (2026-08-17)


### Bug Fixes

* Remove node-pipewire submodule and actually package native dep ([#280](https://github.com/stoatchat/for-desktop/issues/280)) ([09f1bc0](https://github.com/stoatchat/for-desktop/commit/09f1bc06b602fd64ee560a1dd42db8f5dafd3f96))

## [1.5.1](https://github.com/stoatchat/for-desktop/compare/v1.5.0...v1.5.1) (2026-08-16)


### Bug Fixes

* Release please failed to add a remote ([#275](https://github.com/stoatchat/for-desktop/issues/275)) ([dc3762c](https://github.com/stoatchat/for-desktop/commit/dc3762c1344a41658fc298dbe328ba641859130e))
* Release please failed to add a remote and used wrong matrix ([dc3762c](https://github.com/stoatchat/for-desktop/commit/dc3762c1344a41658fc298dbe328ba641859130e))
* upload appimage zsyncs too ([#279](https://github.com/stoatchat/for-desktop/issues/279)) ([63794c7](https://github.com/stoatchat/for-desktop/commit/63794c722bec9e0fba93afadd85ec989d625693b))

## [1.5.0](https://github.com/stoatchat/for-desktop/compare/v1.4.2...v1.5.0) (2026-08-16)


### Features

* Add a virtual microphone for audio streaming on linux ([#266](https://github.com/stoatchat/for-desktop/issues/266)) ([e5dc6ee](https://github.com/stoatchat/for-desktop/commit/e5dc6ee4fc65286581c65873a42147f8a017cf81))
* Add AppImage build flow to release ([#271](https://github.com/stoatchat/for-desktop/issues/271)) ([1fbd6f7](https://github.com/stoatchat/for-desktop/commit/1fbd6f7dfb48363effc64948a133461cffd97b3b))
* Add flatpak build to release-please and update flatpak ([#228](https://github.com/stoatchat/for-desktop/issues/228)) ([c557333](https://github.com/stoatchat/for-desktop/commit/c5573330a93927b60aa404561069c20d06dd48b4))
* Add Mic and Webcam Entitlements for MacOS ([85cbaaf](https://github.com/stoatchat/for-desktop/commit/85cbaaffa5a602cffa0fdedf50a00ec8b03911eb))


### Bug Fixes

* Add Mic and Webcam Entitlements ([#259](https://github.com/stoatchat/for-desktop/issues/259)) ([85cbaaf](https://github.com/stoatchat/for-desktop/commit/85cbaaffa5a602cffa0fdedf50a00ec8b03911eb))
* Add this missing ' ([#274](https://github.com/stoatchat/for-desktop/issues/274)) ([f7223bc](https://github.com/stoatchat/for-desktop/commit/f7223bcddbbbcb9a7b84edbfbacf3a920759083d))
* skip maximise if starting to tray ([#183](https://github.com/stoatchat/for-desktop/issues/183)) ([8192855](https://github.com/stoatchat/for-desktop/commit/8192855a04dae4f61b571fdbc2953073d4a1db4e))
* Update electron to remove stream echo on windows and mac ([e5dc6ee](https://github.com/stoatchat/for-desktop/commit/e5dc6ee4fc65286581c65873a42147f8a017cf81))
* Use liquid glass icon on MacOS ([#258](https://github.com/stoatchat/for-desktop/issues/258)) ([9e1df87](https://github.com/stoatchat/for-desktop/commit/9e1df87a4ee1604b0bfd143ce4507ea2f0e37e63))
* What if we just reloaded every startup, would that kill cache? ([#269](https://github.com/stoatchat/for-desktop/issues/269)) ([f79b113](https://github.com/stoatchat/for-desktop/commit/f79b113da1b6581332c4ef9dfb58018f668a6366))

## [1.4.2](https://github.com/stoatchat/for-desktop/compare/v1.4.1...v1.4.2) (2026-07-17)


### Bug Fixes

* Don't send audio as undefined and instead omit it ([#241](https://github.com/stoatchat/for-desktop/issues/241)) ([dc20b6e](https://github.com/stoatchat/for-desktop/commit/dc20b6e232e184ce1053cfdc7b83550e69ea285a))

## [1.4.1](https://github.com/stoatchat/for-desktop/compare/v1.4.0...v1.4.1) (2026-07-16)


### Bug Fixes

* Do not enable autostart on first launch ([#237](https://github.com/stoatchat/for-desktop/issues/237)) ([e00f3a8](https://github.com/stoatchat/for-desktop/commit/e00f3a860c566ea1e8287573144c2e081d243664))
* make electron use loopback instead of loopbackwithmute ([#236](https://github.com/stoatchat/for-desktop/issues/236)) ([1940938](https://github.com/stoatchat/for-desktop/commit/1940938850d9bf7d4821554dc2dbde96a9f94b8c))

## [1.4.0](https://github.com/stoatchat/for-desktop/compare/v1.3.0...v1.4.0) (2026-06-16)


### Features

* enable screen sharing and integrate screen picker ([#207](https://github.com/stoatchat/for-desktop/issues/207)) ([c9d59ee](https://github.com/stoatchat/for-desktop/commit/c9d59ee044724cec86bc6a286ef1e34accf8c560))


### Bug Fixes

* **flatpak:** change screenshot path into an url in the metainfo file ([#195](https://github.com/stoatchat/for-desktop/issues/195)) ([74c941e](https://github.com/stoatchat/for-desktop/commit/74c941e5b83cd14ddecb74150d5a1d08c143278b))

## [1.3.0](https://github.com/stoatchat/for-desktop/compare/v1.2.0...v1.3.0) (2026-02-18)


### Features

* minimise-to-tray-on-startup ([#126](https://github.com/stoatchat/for-desktop/issues/126)) ([8284117](https://github.com/stoatchat/for-desktop/commit/8284117e76c0fcff4091de3ef623014e4594a593))
* Reload/Refresh shortcut ([#119](https://github.com/stoatchat/for-desktop/issues/119)) ([2e99b19](https://github.com/stoatchat/for-desktop/commit/2e99b19353fbd45d9fdf1d148bae3a8a19c788ed))


### Bug Fixes

* Add common zoom-reset shortcut. ([#112](https://github.com/stoatchat/for-desktop/issues/112)) ([def29f9](https://github.com/stoatchat/for-desktop/commit/def29f9b3c1205944aab58beb8000815d41633b5))
* allow CTRL+"+" to also zoom in. ([#108](https://github.com/stoatchat/for-desktop/issues/108)) ([2b962c5](https://github.com/stoatchat/for-desktop/commit/2b962c5d066787601223368ee7dcc1e46a345b8a))
* App-maximized-2nd-monitor ([897d706](https://github.com/stoatchat/for-desktop/commit/897d706983a347938a2fb42ba8e58e40794bba13))
* don't re-enable abutostart ([63b9ea8](https://github.com/stoatchat/for-desktop/commit/63b9ea818a9f32ca8535948e18752726c0f50a12))
* firstLaunch = false after initial setup ([#131](https://github.com/stoatchat/for-desktop/issues/131)) ([63b9ea8](https://github.com/stoatchat/for-desktop/commit/63b9ea818a9f32ca8535948e18752726c0f50a12))
* flatpak icons not building correctly and wayland support ([#132](https://github.com/stoatchat/for-desktop/issues/132)) ([ffe17ec](https://github.com/stoatchat/for-desktop/commit/ffe17ec2c54fca6967435b8a4ada7fa8d4da7b33))
* replace default dialog with notification ([#98](https://github.com/stoatchat/for-desktop/issues/98)) ([7d2f296](https://github.com/stoatchat/for-desktop/commit/7d2f296ca72bbd7ad694c66a917d47067f883fc5))
* toggle window visibility on tray click instead of always showing ([#103](https://github.com/stoatchat/for-desktop/issues/103)) ([742a95f](https://github.com/stoatchat/for-desktop/commit/742a95f3cb820c5b5398c815b7b45017b6b06053))
* try to restore maximised windows to correct display ([#92](https://github.com/stoatchat/for-desktop/issues/92)) ([897d706](https://github.com/stoatchat/for-desktop/commit/897d706983a347938a2fb42ba8e58e40794bba13))
* use template icon for macOS tray, use higher res icons for other platforms ([#130](https://github.com/stoatchat/for-desktop/issues/130)) ([58ccb63](https://github.com/stoatchat/for-desktop/commit/58ccb63d23541a03e05a48a37a98f883a2ba0d3f))

## [1.2.0](https://github.com/stoatchat/for-desktop/compare/v1.1.12...v1.2.0) (2026-02-14)


### Features

* new branding ([#87](https://github.com/stoatchat/for-desktop/issues/87)) ([8910dcb](https://github.com/stoatchat/for-desktop/commit/8910dcba923b55df789c0541b59a6a6321a28768))
* persist and restore window size and position ([#74](https://github.com/stoatchat/for-desktop/issues/74)) ([3bf697d](https://github.com/stoatchat/for-desktop/commit/3bf697d1a9aba739b6954c8469223f51093497cc))


### Bug Fixes

* App Autostart ([#68](https://github.com/stoatchat/for-desktop/issues/68)) ([127d143](https://github.com/stoatchat/for-desktop/commit/127d1430a9c630e0429c9cc50d57ee316a63ebe5))

## [1.1.12](https://github.com/stoatchat/for-desktop/compare/v1.1.11...v1.1.12) (2025-12-29)


### Bug Fixes

* add NixOS compatibility for electron startup ([#23](https://github.com/stoatchat/for-desktop/issues/23)) ([3eb9b8e](https://github.com/stoatchat/for-desktop/commit/3eb9b8e84bf05debf9843b80c468911fd095f4a0))
* correctly load badge count; expose to renderer ([#25](https://github.com/stoatchat/for-desktop/issues/25)) ([6817b55](https://github.com/stoatchat/for-desktop/commit/6817b554e57c5a65b7b4aca7d1cc4e05cd6f01b7))
* event listener accumulation from rpc client ([#26](https://github.com/stoatchat/for-desktop/issues/26)) ([96fa8cc](https://github.com/stoatchat/for-desktop/commit/96fa8cc647029cb53e5d619b94debc6cdfdf32f6))
* **macos:** tray icon size ([5eecab5](https://github.com/stoatchat/for-desktop/commit/5eecab59431cb4966eaa1fc907a8e5c16c813230))
* rpc should define largeImageText ([#21](https://github.com/stoatchat/for-desktop/issues/21)) ([cb373b6](https://github.com/stoatchat/for-desktop/commit/cb373b6dc62630147151039c3711aef74c8c2d88))
* use the correct argument for auto start ([#22](https://github.com/stoatchat/for-desktop/issues/22)) ([532af4a](https://github.com/stoatchat/for-desktop/commit/532af4a680069f72734148b0ccdacec6c435e640)), closes [#20](https://github.com/stoatchat/for-desktop/issues/20)
