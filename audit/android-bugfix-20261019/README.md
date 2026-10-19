# Android 1.0.12 bug-fix audit — 2026-10-19

Scope: the released game only. AI companion chat is paused and excluded. The
dedicated branch starts at `3ffad5f`, incorporating the existing CPU battle
Yatagarasu fix from PR #3 on top of released revision `07024a3` (Android 21,
1.0.11). No changes to pricing, purchase access, character artwork or chat.

## Confirmed defects and corrections

1. Evolution could save a new stage with the old form while speech continued
   during its animation. Stage and form now commit together. Known saves whose
   stage is exactly one ahead of their known form are repaired without losing
   counts, collection or a pending successful ultimate outcome.
2. Reset during evolution left old callbacks and pending outcomes alive. A
   progression generation and cancellable effect prevent an old result from
   modifying a reset/new character. An already-awarded ultimate form remains in the collection even if reset or expiry interrupts its reveal, including old pending saves.
3. Silent rebirth or reset during the three-second rebirth animation could let
   an old timer reset the new egg's counts a second time. Cancellation and
   generation checks prevent that second reset.
4. The pinned Android local-notifications 8.0.0 receiver discarded the saved
   `allowWhileIdle` policy for repeated notifications. A source-verified,
   idempotent postinstall patch reads the saved policy, including old pending
   intents. The receiver retains the wakeup and exact/inexact idle API choices.
   Notification permission wording in support/privacy now describes Android 13+
   denial accurately. No microphone behavior or permission policy changed.
5. Online replay timers could update a different battle after an expired room
   closed the old scene. All replay callbacks now verify scene identity.
6. A delayed WebSocket authentication hash could overwrite a completed match
   with stale room data. Authentication reloads current room state and verifies
   its identity, expiry and token before mutation.

## Reproduction and verification

- Progression: the same 18 behavior tests on released source produced 16
  failures; the fixed source passed all 18. See `gameplay-verification.json`
  and the before/after TAP logs here.
- Online: three replay regressions (two failures before), and three server auth
  regressions (all failed before). Backend 25 and client 20 tests passed.
- Actual local Worker/WebSocket integration passed: create/join, authenticate,
  disconnect/reconnect, select actions, consistent results and replay after
  both connections close. No production test profiles were created.
- Wrangler 4.116.0 could not run the configured compatibility date. Development
  tooling is pinned to tested 4.151.1; the compatibility date and service bindings
  are unchanged. Dry-run packaging passed.
- Combined web regression: 148 passed, 0 failed, 1 explicitly skipped locally
  because no JDK is installed. The skipped test compiles the actual upstream and
  patched Java receiver against Android API recording doubles: upstream must
  fail and the patched receiver must pass 48 recurring API dispatch cases.
  Android CI requires this test and cannot skip it.
- Web build: 107 root assets; no AI companion directory or entry point.

## Remaining verification boundaries

- Android signed build, native unit tests, lint and packaged assets: passed in
  run 39236299776 (#23), commit 31f8e82be587809aebc73e13fbd4f4c91aee80ae.
  CI web tests: 149 passed, 0 skipped; backend: 25 passed. The actual Java
  receiver test passed all 48 recurring dispatch cases. Both signed artifacts
  were downloaded and their hashes, package, version and six packaged assets
  independently verified (artifacts-verified.json).
- Real device, actual Doze delivery, Bluetooth/calls, Play purchase/restore and
  Play-track upgrade are separate checks, not proven by Java API doubles or web
  tests. No data clear, uninstall or production account changes were performed.
- Play's BOOT_COMPLETED/microphone warning is not declared fixed. App source and
  the locked notification receiver show boot-triggered notification scheduling,
  but no boot-to-microphone-service path. The merged manifest confirms that the
  boot receiver belongs to local notifications and the microphone service is
  not exported. Android 15/16 boot/device behavior remains unverified.
- Browser screen verification was blocked by automatic approval review citing
  prior interruption; an explicit browser-resume question is pending. Code and
  regression work continued independently.
- This record does not claim a store submission, store approval or rollout.

## Applied audit rules

Game rules v0.27.0: REL-002/004/005, VAL-001–005/011, MOB-001–006,
AUD-001/002, LIF-001/002, DAT-001/002 and the project's mobile game test matrix.
Changes are verified at their actual layer; static findings do not count as
device or store-track observations.

## Integration and distribution checkpoint

- PR #4 merged to main as 4181ac937d39aaf63115d9b6050b90202f367e70. Its tree
  matches the tested source. PR: https://github.com/chona4900/kotodama-match/pull/4
- Android CI: https://github.com/chona4900/kotodama-match/actions/runs/39236299776
- AAB: 1.0.12, versionCode 23, package com.kotodamamatch.app. Verification APK
  uses versionName 1.0.12-test. Do not uninstall an existing Play copy or clear
  player data to work around a Play-signing/upload-signing mismatch.
- Online Worker updated from prior version a26ec27f-5692-427a-9eff-10b6b05662f4
  to ef2020be-95dd-4a41-bf3f-d7f61633f2c9. Existing bindings, compatibility
  date, database and schema are unchanged. No migration or deletion ran.
- Production verification passed with two synthetic, unranked connections:
  create/join, reconnect, battle and result replay. No player profile was used.
  The health endpoint returned HTTP 200 with `{ "ok": true }`.
- Store submission/approval/rollout: not performed. Browser resume approval
  is pending; real-device, Play-track and visual checks remain open.
