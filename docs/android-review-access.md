# Android review access

The production payment gate has a visible `審査用アクセス / Review access` section.
Google reviewers can enter the reusable code supplied privately in Play Console and
use the same game, assets, saves, microphone, CPU battles, and online battles.
There is no alternative demo game, automatic purchase, location check, OTP, expiry,
or dependency on the reviewer's Google account being a license tester.

The normal non-consumable `kotodama_full_game` / `full-game` purchase stays unchanged.
Review access is a separate native preference; it never creates a Google Play
receipt or claims ownership. Billing restore cannot clear that preference.
Reinstalling clears the preference, after which the same code can be entered again.
Only a SHA-256 digest of the random 128-bit credential is in the source and build.
The credential and complete Console instructions are in ignored local storage
and must not be committed or packaged as public assets.

## Play Console instructions (English)

1. Open the app. On the full-game purchase screen, expand `審査用アクセス / Review access`.
2. Paste the supplied review code into `審査用コード / Review code`.
3. Tap `審査用コードで開始 / Start review`.
4. The purchase screen closes and the ordinary full game opens. No purchase,
   payment details, license-test account, or developer approval is required.
5. Dismiss the initial guide, then allow microphone permission when testing voice.
   Use the microphone control for voice growth, `対戦` for CPU/online battles,
   and `図鑑` for the character catalogue.
6. Access persists across app restarts. After clearing app data or reinstalling,
   repeat steps 1–3 with the same code. The code does not expire or depend on location.

Do not replace these instructions in Console until the matching new Android bundle
has been built and verified. Version code 20 does not contain this entry.

## Verification scope

JS regressions cover unpaid users, pending purchase, invalid credential,
review unlock, restore failure, stalled Play connection and restored review state.
Java tests cover credential validation, normalization, invalid inputs and reuse.
Real Android preference persistence, Capacitor bridging and payment/voice/device
behavior require native build/device checks and must be reported separately.
