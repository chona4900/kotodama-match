# Mobile game test matrix

Use this reference for a full audit or release-readiness decision. Select applicable rows and keep N/A decisions explicit.

## Build identity and packaging

- Confirm repository revision, dirty state, version name, build number/code, bundle/application ID, minimum/target OS, signing mode, and distribution track.
- Compare the shared source assets with the assets embedded in each native project after the platform sync/build step.
- Ensure local defaults and CI overrides cannot silently produce an older-looking or ambiguously identified build.
- Run dependency lockfile validation, release preflight, native lint, native unit tests, and a release-mode build.

## Install and persistence states

- Fresh install with no permissions.
- Upgrade from every supported stored-data schema and at least the oldest version still installed by testers.
- Corrupt/truncated storage, storage quota failure, interrupted save, backup restoration, device migration, logout/reset, and server deletion failure.
- Reinstall after cloud backup and reinstall without cloud backup.
- Verify that reset operations preserve and erase exactly the documented categories.

## Lifecycle and interruptions

- Cold launch, warm launch, background/foreground, screen lock/unlock, app switch, task removal, process death, low-memory recreation, and OS upgrade.
- Incoming/outgoing call, voice assistant, another recorder, alarm, media playback, route change, Bluetooth disconnect/reconnect, wired headset, silent mode, and volume zero/recovery.
- Permission denied, “don't ask again,” later grant, later revoke, and restricted parental/enterprise device.

## Speech and audio

- First phrase, repeated identical phrase, ten consecutive phrases, long phrase, silence timeout, partial/final result changes, no match, offline model, network loss, and recognition service crash.
- Confirm normal utterance completion does not clear the user's MIC-on intent.
- Confirm retries distinguish transient failures from permission or unsupported-language failures and stop after a bounded limit.
- Confirm stale callbacks from a canceled session cannot stop or mutate a newer session.
- Validate built-in mic/speaker, Bluetooth input/output, and platform-specific audio-session restoration.

## Notifications and time

- Notification permission states, exact-alarm setting, Doze/Low Power Mode, Focus/Do Not Disturb, private space, device reboot, app update, time-zone change, DST boundary, manual clock change, and missed notification recovery.
- Verify the delivery guarantee matches the feature window. If the event lasts one minute, explicitly test notification arrival before that minute expires.
- Tap notifications from foreground, background, terminated, and already-open destination states.

## Networking and multiplayer

- Offline launch, slow response, timeout, duplicate tap/request, reconnect before and after auth, websocket close/error ordering, server restart, expired room/session, resumed process, and clock skew.
- Assert server mutations are authenticated, authorized, idempotent where necessary, bounded by rate limits, and recoverable without double rewards or losses.
- Treat names, chat/stamps, room codes, and server messages as untrusted input.

## UI and accessibility

- Smallest/large screens, notches and safe areas, tablets, supported orientations, 200% text scaling, screen reader, reduced motion, high contrast, keyboard, and touch target size.
- For every declared orientation, assert primary-control rectangles remain inside the visual viewport at a low-height and a representative device size; do not rely on page scrolling when the root is fixed or overflow-hidden.
- Keep OS pinch zoom available. Prevent accidental double-tap activation on the relevant controls without globally canceling multi-touch gestures.
- Test every modal/overlay close path, rapid repeated taps, navigation during async work, and state restoration after interruption.
- Confirm status text and button state represent the same underlying state during retries and recovery.

## Release-track smoke test

- Install the exact signed artifact from TestFlight or the Play test track, not a local substitute.
- Record device, OS, app version/build, account, permission state, locale, route, network, and whether data was migrated.
- Exercise launch, save/relaunch, core loop, audio/speech, notification tap, background/resume, online flow, reset, and update from the previous store build.
- Capture logs and a screen recording for every failure before reinstalling or clearing data.
