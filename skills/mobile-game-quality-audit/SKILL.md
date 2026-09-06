---
name: mobile-game-quality-audit
description: Audit iOS and Android game quality across native bridges, lifecycle, audio or speech, permissions, notifications, persistence, networking, packaged assets, CI, and release configuration. Use for cross-platform bug hunts, platform-specific regressions, pre-release QA, or turning a mobile-game incident into reusable tests. Do not use for ordinary feature work that does not request an audit or regression analysis.
---

# Mobile Game Quality Audit

Produce an evidence-backed audit that separates confirmed defects, plausible risks, and items that still require a simulator or real device. Never call a static review “complete” when native runtime behavior remains untested.

## Start with the failure boundary

1. Read repository instructions, handoff notes, dirty-worktree state, framework configuration, release versions, and existing tests.
2. Reconstruct the reported path from the user action through shared code, the native bridge, OS callbacks, and UI state. Check deliberate stop paths such as tutorials, overlays, rewards, and navigation before assuming an OS bug.
3. Record the exact build identity: source revision, app version/build number, OS version, device, install source, permissions, locale, network, audio route, and whether app data was fresh or migrated.
4. Preserve user data and unrelated changes. Diagnose before editing unless the request includes fixing.

Run `node scripts/mobile_game_audit.mjs [repository]` from this skill for a fast first pass. Treat its findings as routing signals, not proof.

## Divide a deep audit into independent lanes

When delegation is available and the user authorizes a broad or multi-agent audit, assign independent lanes for:

- iOS native code, entitlements, privacy strings, AVAudioSession/Speech, notifications, lifecycle, and Xcode/release settings.
- Android native code, manifest, foreground services, permissions, SpeechRecognizer, notifications, lifecycle, Gradle, and Play requirements.
- Shared game logic, persistence/migrations, timers, async races, online reconnect/idempotency, mobile layout, and accessibility.
- Test and release coverage, including whether CI actually executes native tests and packages the audited assets.

The primary agent must reconcile overlaps, verify every high-priority claim in source, and notice any failed or incomplete lane.

## Apply the mobile failure matrix

Read [references/mobile-test-matrix.md](references/mobile-test-matrix.md) for a full audit or release gate. At minimum cross the feature with:

- first install, upgrade with existing data, reinstall, permission denied, permission later granted, and permission revoked while active;
- foreground, app switch, screen lock, resume, interruption, low-memory/process recreation, offline/online transition, and clock/time-zone change;
- built-in audio, wired audio, Bluetooth, phone call/assistant interruption, silent mode, and volume changes;
- smallest and largest supported screens, text scaling, reduced motion, portrait/landscape declarations, and accessibility labels;
- debug/local builds, CI artifacts, internal testing tracks, and store-distributed builds.

For continuous speech or audio, distinguish a normal utterance/session boundary from the user's intent to keep the microphone enabled. Classify OS error codes, use bounded backoff for transient failures, invalidate stale callbacks with a session/generation token, and test repeated identical phrases.

For notifications, verify notification permission separately from exact-alarm capability. A one-minute event window and an inexact alarm are incompatible unless the product clearly accepts missed or late reminders.

For persistence, test malformed data, interrupted writes, migrations across every supported prior schema, backup/restore, reset boundaries, authentication-token handling, and server deletion failure.

For mobile UI, derive the tested orientation set from both platforms' declarations. Exercise low-height landscape as well as narrow portrait, verify every primary control stays inside the visual viewport, retain OS pinch zoom, and use targeted `touch-action: manipulation` on controls instead of document-wide multi-touch cancellation. An overlay needs an accessible name, state, close control, focus entry/return, and a hardware-back or Escape decision.

## Decide without silently changing product behavior

Classify every item before editing:

- **Change now** only when the current behavior contradicts an existing rule or user intent, data is preserved, and the regression can be tested.
- **Keep** when evidence supports the current boundary and changing it would add risk without fixing a confirmed defect.
- **Decide first** when the choice changes retention, privacy, permissions, background operation, account identity, orientation support, monetization, or another product promise. Record alternatives and a recommendation; do not merge those specifications into an unrelated fix.
- **External gate** when only a real device, signed artifact, store service, or production-like backend can provide the evidence.

Low-risk changes may improve recovery UI, session isolation, bounded retries, accessibility metadata, deterministic CI, and tests. They must not silently erase saves, auto-resend a server mutation, request a new sensitive permission, or narrow supported devices/orientations.

## Verification ladder

Use the strongest available layers and report which were actually run:

1. Deterministic static scan and source tracing.
2. Shared unit/regression tests with failure-path assertions.
3. Native lint, compile, and unit tests for both platforms.
4. Simulator/emulator tests for permissions, lifecycle, time, network, and screen classes.
5. Real-device tests for microphones, speakers, Bluetooth, interruptions, background behavior, thermal pressure, and OEM restrictions.
6. Store-track smoke tests using the exact artifact users receive.

Add a regression test for every confirmed defect. Prefer behavioral assertions over tests that only search for a line of source text. For viewport bugs, run at least one DOM geometry assertion per declared orientation and keep the dimensions in the evidence. If native tooling is unavailable, add the best safe guard available but label native compilation and runtime as unverified.

## Report format

Lead with release-blocking findings. For each finding include severity, affected platforms, evidence path/line, reproduction, impact, proposed fix, and verification status. End with:

- tests passed and failed;
- device/OS combinations exercised;
- unverified risks and the exact next test;
- whether the build is safe for internal test, store submission, or neither.

Do not claim a bug-free or perfect result. “No defect found” means only that the exercised matrix passed.

## Optional Codex hook

For repositories that should automatically recall this audit workflow, install a project-local `UserPromptSubmit` hook that adds context only when the prompt mentions mobile bugs, QA, testing, or release readiness. Keep the hook advisory and fast; do not run full builds on every prompt or create Stop-hook loops. Hook installation changes repository configuration and requires the user's authorization.
