# Android 残存リスク再監査（2026-09-06）

対象: コトダマっち 1.0.10、ブランチ `main`、基準コミット `4b771a8` に未コミットのQA修正を含む現在の作業ツリー
監査範囲: `BackgroundListeningService` / `SpeechRecognizer`、Android 13+通知、バックアップ、正確なアラーム、Gradle/CI、Google Play Console
制約: Windows環境のためAndroidネイティブ実行とPlay Consoleのログイン状態は未確認。静的確認だけを実機確認済みとは扱わない。

## 結論

今回のMIC連続認識修正、正確なアラーム対応、Android CIへのGradle test/Lint追加は、ソース上は妥当で共有テストも合格した。ただし、ストア提出可能と判定するにはまだ足りない。

特に重要な残存点は次の3つ。

1. **P1候補: 古いAndroid音声認識コールバックを無効化する世代ガードがネイティブ側にない。** 現在の `recognitionSessionId` はJSイベントの区切りには使えるが、古い `SpeechRecognizer` の遅延コールバック自体は拒否しない。これは仕様変更ではないため、リリース前に低リスク修正する対象。
2. **P1要件判断: Foreground Serviceは通知だけを所有し、認識器はActivityに紐づくCapacitorプラグインが所有する。** 「別アプリを開いている間のベストエフォート」なら現方式を実機確認して使えるが、タスク除去・Activity破棄・プロセス死後も継続する保証が必要なら設計変更が必要。
3. **P1プライバシー判断: WebViewの同じLocal Storageに進行データ、匿名プロフィール用トークン、直近の認識文字列が同居しており、Androidバックアップが全体に有効。** XMLだけでLocal Storage内のキーを選別できないため、進行データ移行と機密データ除外の優先順位を決めてから変更する。

## 判断一覧

| 項目 | 分類 | 現在の判定 | 次の行動 |
|---|---|---|---|
| 古い `SpeechRecognizer` コールバックの世代ガード | **今すぐ低リスクで変更** | 回帰余地あり | 認識器ごとのListenerに世代IDを閉じ込め、旧世代の全callbackを破棄する |
| BackgroundListeningServiceと認識器の所有関係・プロセス死 | **仕様判断後に変更** | ベストエフォートのみ | 継続保証の境界を決め、必要ならService所有へ再設計 |
| Android 13+通知拒否時のFGS可視性 | **仕様判断後に変更** | OS上は起動可、通知欄では不可視 | 通知拒否時にバックグラウンド待受を許すか決める |
| backup / dataExtractionRules | **仕様判断後に変更** | 現状は広すぎる | 進行データ移行と音声・認証情報除外の方針決定後に分離 |
| exact alarmのソース実装 | **現状維持** | 必要要素あり | 実機マトリクスで精度と再予約を確認 |
| Android Gradle/CI定義 | **現状維持**（自動ゲート化は**今すぐ低リスクで変更**可能） | 手動ワークフロー内のtest/Lintあり | 現在の差分をpush後に実行。常時ゲートが必要なら検証専用workflowを追加 |
| Play ConsoleのFGS申告・AAB状態 | **実機/外部確認のみ** | リポジトリだけでは証明不能 | Play Consoleと内部テスト配布物で確認 |

## 1. P1候補 — 古い音声認識コールバックの世代ガード

**分類: 今すぐ低リスクで変更**

### 根拠

- `android/app/src/main/java/com/kotodamamatch/app/SpeechRecognitionPlugin.java:267-268` で、各認識器のListenerとしてプラグイン自身の `this` を登録している。
- 同ファイル `279-280` は認識開始前にグローバルな `recognitionSessionId` を増やす。
- 同ファイル `317-321` は旧認識器を `cancel()` / `destroy()` するが、旧認識器から遅れて届くcallbackを識別する値はcallback側に閉じ込められていない。
- 同ファイル `177-205` の `onError()` は `listeningRequested` だけを確認する。新セッション開始後は `true` なので、旧セッションの遅延エラーが新認識器を破棄・再試行させ得る。
- 同ファイル `211-216` の `onResults()` は `listeningRequested` すら確認せず、旧セッションの結果も処理し得る。
- 同ファイル `229-236` はイベント送出時点のグローバル `recognitionSessionId` を付けるため、旧結果を新セッションの結果として誤表示・誤加算する可能性がある。
- `scripts/gameplay-regressions.test.js:405-407` はID増分とJS側リセットの文字列を確認しているだけで、旧callbackの破棄は検証していない。

### 影響

再認識器生成直後、ユーザー停止直後、マイク競合からの回復時に、古い結果が1回余計に数えられたり、古いエラーによって新しい認識が回復ループに入る可能性が残る。発生頻度は端末の音声認識サービス実装に依存するが、連続MIC不具合と同じ境界にある。

### 推奨方針

- `SpeechRecognitionPlugin` 自身を全世代共通Listenerにせず、`startRecognizer()` ごとにローカルな世代IDを捕捉する `RecognitionListener` を登録する。
- callback冒頭で「捕捉したIDが現在IDと一致する」「ユーザーのMICオン意思が残る」を確認し、不一致なら無処理で返す。
- `stop()` / `destroyRecognizer()` で世代を明示的に無効化する。
- `start()` の二重開始判定は `listening` だけでなく `listeningRequested || restartScheduled` も含める。

### 検証方法

1. Listenerと認識器生成を注入可能な薄い状態機械へ分離し、「旧世代のfinal/errorを新世代開始後に送る」JVM単体テストを追加する。
2. 実機で `ERROR_CLIENT` / `ERROR_RECOGNIZER_BUSY` 相当の競合（他の録音アプリ、Google Assistant、着信）を起こし、回復後に重複加算がないことをログのsession IDで確認する。
3. MICオフ直後に発話結果が返っても回数が増えないことを10回繰り返す。

## 2. BackgroundListeningServiceとSpeechRecognizerの所有関係・プロセス死

**分類: 仕様判断後に変更**

### 根拠

- `android/app/src/main/java/com/kotodamamatch/app/BackgroundListeningService.java:31-52` は通知を作って `startForeground()` するだけで、`SpeechRecognizer`、Listener、再試行状態を持たない。
- 音声認識器と `listeningRequested` は `SpeechRecognitionPlugin.java:33-44` が所有する。
- このプラグインは `android/app/src/main/java/com/kotodamamatch/app/MainActivity.java:6-10` で `BridgeActivity` に登録される。
- `SpeechRecognitionPlugin.java:325-332` はプラグイン破棄時に認識器とForeground Serviceを停止する。
- `BackgroundListeningService.java:52` は `START_NOT_STICKY` を返す。プロセスが終了してもサービス再生成を要求しない。
- `main.js:3627-3633` と `3480-3503` はActivity/WebViewが残って復帰callbackを受けられる場合の状態同期であり、プロセス死後のMICオン意思を永続化・復元していない。
- 公開説明は `support.html:16` と `privacy.html:20-21` で「別アプリを開いている間も聞き取る」としている。タスク除去・再起動後までとは明記していない。

### 影響

- 通常のアプリ切替でActivityとプロセスが生存すれば動く可能性がある。
- Activity破棄、タスク除去、低メモリ、OEM省電力、認識サービス死、OSによるプロセス終了では停止し得る。
- 通知だけが残り実際は聞いていない、または認識は止まったがUIの意思状態が残る、という不一致は実機条件でしか否定できない。
- `START_STICKY` へ変えるだけでは解決しない。Android 14+ではマイク型FGSをバックグラウンドから無条件に再作成できず、ユーザー可視Activityで開始するという制約がある。

### 推奨方針

まず次のどちらを製品仕様にするか決める。

- **A: ベストエフォート継続** — ユーザーがMICを押してから、Activity/プロセスが生きている通常のアプリ切替中だけ継続。タスク除去・再起動・OS停止後はMICオフ。現在設計を維持し、説明とUIをこの境界に合わせる。
- **B: 強いバックグラウンド継続** — 画面消灯やActivity再生成後も可能な範囲で継続。この場合はServiceが認識器、世代、再試行、ユーザー意思を所有し、Activityはbind/event表示だけを担当する設計へ変更する。ただしプロセス死後の無断再開はOS制約とプライバシー上保証しない。

安全性と審査説明の明快さから、ゲーム用途ではAを既定案とする。常時音声待受が中核価値として実機で十分な需要が確認できた場合だけBを採用する。

### 検証方法

- Android 12/13/14/15系で、ホーム移動、別アプリ5分、画面ロック5分、戻る、タスクスワイプ除去、`adb shell am kill com.kotodamamatch.app`、低メモリ再生成を分けて試す。
- 各操作で、FGS通知、マイク使用インジケータ、`listeningState`、認識結果、復帰時UIの5点が一致するか記録する。
- `adb logcat` にサービス `onStartCommand` / `onDestroy`、Activity lifecycle、session ID、SpeechRecognizer error codeを構造化出力して画面録画と突合する。

## 3. Android 13+通知拒否とForeground Serviceの可視性

**分類: 仕様判断後に変更**

### 根拠

- Local Notificationsライブラリのmanifest `node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml:17-19` が `POST_NOTIFICATIONS` を宣言するため、マージ後のアプリにも入る。
- 正午通知では `main.js:1471-1491` が明示的に通知許可を要求する。
- MIC開始経路 `main.js:3387-3413` はマイク許可だけを確認し、通知許可を確認しない。
- `BackgroundListeningService.java:39-51` はFGS通知を必ず作るが、Android 13+で通知拒否時、FGS自体は起動できても通知は通常の通知ドロワーに出ずTask Manager側だけに表示される。
- 公開説明 `privacy.html:20-21` と `support.html:16` はAndroidで「ききとり中の通知が表示」と断定しており、通知拒否時の実動作と一致しない。
- Android公式「Notification runtime permission」は、通知拒否時にもFGS起動は可能だが、FGS通知は通知ドロワーではなくTask Managerにのみ表示されるとしている: <https://developer.android.com/develop/ui/compose/notifications/notification-permission>

### 影響

通知を拒否したユーザーが別アプリへ移動すると、通常の通知一覧には継続待受が見えず、停止方法にも気づきにくい。OSのマイク表示は残るものの、アプリ自身のプライバシー説明と可視性が弱くなる。

### 推奨方針

次のどちらかを明文化する。

- **推奨:** 通知拒否時は前面でのみ認識し、バックグラウンド移行時に停止する。MIC開始時に「バックグラウンドでも続けるには通知を許可」と非強制で案内する。
- バックグラウンド継続を優先する場合は、通知拒否でもOS上は継続し得ること、通知欄ではなくシステムの実行中アプリ表示になること、停止方法をMIC開始前のアプリ内画面に明記する。

単にMIC操作時に毎回通知ダイアログを強制するのは避ける。正午通知を断った人にも音声機能を使えるよう、音声とリマインダーの許可目的を分ける。

### 検証方法

- Android 13/14/15で `POST_NOTIFICATIONS` を許可、拒否、後から取消の3状態にする。
- 各状態でMICを開始して別アプリへ移り、通知ドロワー、実行中アプリ/Task Manager、マイクインジケータ、停止導線を動画に撮る。
- 通知チャンネル単体OFFとアプリ通知全体OFFも分けて試す。

## 4. Android backup / dataExtractionRules

**分類: 仕様判断後に変更**

### 根拠

- `android/app/src/main/AndroidManifest.xml:16-22` は `android:allowBackup="true"` だが、`android:dataExtractionRules` と `android:fullBackupContent` がない。
- `android/app/src/main/res/xml/` には `file_paths.xml` しかなく、バックアップ選別ルールがない。
- 進行データは `main.js:847-878` の `kotodama_state` と `kotodama_state_backup` に保存する。
- 直近20件の生の認識文字列は `main.js:3271-3327` の `kotodama_speech_recognition_log_v1` に保存する。
- 匿名プロフィールの `playerToken` は `main.js:4093-4099` と `4164-4174` でLocal Storageに保存する。
- 対戦再接続トークンは `main.js:4251-4277` に保存し、有効期限切れなら消す。一方、プロフィールトークンには端末移行時の再発行判定がない。
- Android公式では、デフォルトでほぼ全アプリデータがAuto Backup対象。API 31+は `data-extraction-rules`、Android 11以下との互換には `fullBackupContent` を使う: <https://developer.android.com/identity/data/autobackup>

### 影響

- 利点: 再インストールや端末移行後に育成進行を復元できる可能性がある。
- リスク: 聞き取った文字列と認証用tokenもGoogle Driveバックアップや端末間移行の対象になり得る。復元先端末で同一tokenを使う設計がサーバー側想定と一致するか不明。
- CapacitorのWebView Local Storageは同一データベース内に複数キーを格納するため、XML backup ruleだけで `kotodama_state` は残し `playerToken` と音声ログだけ除外することはできない。

### 推奨方針

1. **推奨設計:** 進行データをバックアップ対象のネイティブ保存へ、プロフィールtokenと音声ログをno-backupまたは安全な専用保存へ分離する。音声ログは必要性を再確認し、既定OFFまたは短期自動削除も検討する。
2. 暫定でプライバシーを最優先するなら `allowBackup=false`。ただし既存ユーザーの育成データ移行を失う仕様変更なので、無断で行わない。
3. 暫定で進行移行を最優先するなら現状を維持し、Data safety/プライバシー説明、tokenの複数端末・失効仕様、音声ログのバックアップ扱いを明確にする。

`dataExtractionRules` を形式だけ追加してWebView領域全体を除外する変更は、実質的に進行データ移行も切るため「低リスク修正」ではない。

### 検証方法

- 方針決定後、Android 11と12+の両ルールを追加し、`adb shell bmgr backupnow` / restoreまたはGoogleのbackup test手順で検証する。
- 新端末復元時に、進行データ、通知案内済みフラグ、音声ログ、プロフィールtoken、対戦tokenが期待どおり残る/消えることをキーごとに確認する。
- 復元されたプロフィールtokenをサーバーが安全に扱い、別端末同時利用や同意撤回後に再利用できないことをAPIテストする。

## 5. Exact alarm

**分類: 現状維持（動作保証は実機/外部確認のみ）**

### 根拠

- `android/app/src/main/AndroidManifest.xml:6-7` は `SCHEDULE_EXACT_ALARM` を宣言する。`USE_EXACT_ALARM` は使っていない。
- `main.js:1153-1158` は `checkExactNotificationSetting()` を呼ぶ。
- `main.js:1475-1485` はユーザーが通知設定を選んだ流れで `changeExactNotificationSetting()` を呼び、非許可/非exactを明示する。
- `main.js:1363-1422` はスケジュール結果の `warning` を確認する。
- `main.js:1500-1505` は画面復帰時に通知状態を再確認・再予約する。
- `scripts/noon-ritual.test.js:73-76` に宣言・API利用の静的回帰テストがある。
- Android公式ではAndroid 14+の多くの新規インストールで `SCHEDULE_EXACT_ALARM` は既定拒否。設定画面から戻った時の再確認と、拒否時の劣化動作が必要: <https://developer.android.com/about/versions/14/changes/schedule-exact-alarms>

### 影響

ソース上の不足は解消されている。ただし権限拒否時はinexact通知となり、12:00:00〜12:00:59という60秒のイベント窓に間に合う保証がない。現在の警告表示はこの制約をユーザーへ伝えるが、実配送精度は端末/OEM/Dozeに依存する。

### 推奨方針

- `SCHEDULE_EXACT_ALARM` を維持する。一般ゲームで審査制約の強い `USE_EXACT_ALARM` へ置き換えない。
- 非許可時は「通知予約はしたが時間どおりとは限らない」という現在の劣化動作を維持する。
- 60秒窓を絶対条件にするなら、実機結果が不安定な場合はイベントの参加猶予を広げる製品判断も候補にする。

### 検証方法

- Android 12/13/14/15系で、通知許可 × exact許可の4組み合わせ、Doze、再起動、タイムゾーン変更、手動時刻変更を試す。
- 11:59の配送実時刻を秒単位で記録し、12:00:59までにタップしてイベント開始できるか確認する。
- exact許可の付与/取消後にアプリへ戻り、予約が復元されることを確認する。

## 6. Gradle / CI

**分類: 現状維持。常時自動ゲート化は今すぐ低リスクで変更可能**

### 根拠

- `.github/workflows/android-build.yml:27-41` は `npm ci`、Web build、Capacitor sync、`npm test`、`testDebugUnitTest`、`lintDebug` を順に実行する。
- 同ファイル `3-5` は `workflow_dispatch` のみで、push/PRごとの自動検証ではない。
- 同ファイル `43-69` は署名済みAABを作るため、現在の未コミット差分はpush後にworkflow実行されるまで検証されない。
- `android/app/src/test/.../ExampleUnitTest.java:12-17` は `2 + 2` だけの雛形。
- `android/app/src/androidTest/.../ExampleInstrumentedTest.java:17-25` はpackage IDだけを検証する。またCIは `connectedAndroidTest` を実行しない。
- `scripts/gameplay-regressions.test.js:392-408` はAndroid音声再試行のソース文字列を検証し、実際のcallback順序やAndroid lifecycleは動かさない。
- `android/variables.gradle:2-5` はminSdk 24 / compileSdk 36 / targetSdk 36。`android/app/build.gradle:10-12` はversionName 1.0.10とrunnerを定義する。

### 影響

現在のworkflowはコンパイル/Lintの安全網として改善済みだが、手動実行前の差分や古いcallback順序、実機認識サービス差は検出できない。`testDebugUnitTest` が成功しても音声プラグインの振る舞いを証明しない。

### 推奨方針

- 現在のrelease workflowは維持し、push後に必ず手動実行してAAB生成まで合格させる。
- 低リスク改善として、署名secretを使わない `android-verify.yml` を `pull_request` / `push` で実行し、`npm ci` → build/sync → `npm test` → `testDebugUnitTest lintDebug` を常時ゲート化する。
- P1 callback世代ガードを入れる際は、状態機械のJVM単体テストを追加する。実機テストは別ジョブまたはリリースチェック表で管理する。

### この環境での検証結果

- `npm test`: **43/43合格**、失敗0、`Release preflight passed`。
- `node skills/mobile-game-quality-audit/scripts/mobile_game_audit.mjs . --strict`: **exit 0**。Androidではbackup privacyのみWARN。Android FGS、RECORD_AUDIO、エラー分類、final後の継続、CI test/Lint、ID/version、packagingはPASS。
- `android/gradlew.bat testDebugUnitTest lintDebug --stacktrace`: **未実行扱い（exit 1）**。理由はこのWindows環境に `JAVA_HOME` と `java` がないため。コード不合格ではなく環境不足。GitHub ActionsではTemurin 21をセットアップする。
- `git diff --check`: エラーなし。CRLF変換警告のみ。
- root / `www` / Android assets / iOS assets の `main.js`: SHA-256一致。

## 7. Google Play Consoleとストア成果物

**分類: 実機/外部確認のみ**

### 根拠

- manifest側は `android/app/src/main/AndroidManifest.xml:3-7,36-39` に `RECORD_AUDIO`、FGS共通権限、microphone型権限、service type、exact alarmを宣言済み。
- Google Playの現行要件では、Android 14+対象アプリのFGS型をPlay Consoleの「アプリのコンテンツ」で申告し、機能説明、停止時の影響、利用開始手順を示す動画リンクが必要: <https://support.google.com/googleplay/android-developer/answer/13392821>
- `HANDOFF_2026-09-05.md:73-78` にpackage、Play Console App ID、旧確認状態はあるが、現在の1.0.10 AAB、審査、テストトラック、価格、FGS申告済みを証明する記録はない。
- この環境には `gh` CLIもなく、現在の未コミットworkflow差分を実行したGitHub Actions runは存在し得ない。

### 影響

ソースが正しくても、FGS申告不足、説明/動画との不一致、古いAAB、別versionCode、内部テストへの未配布があれば審査または実ユーザー検証は完了しない。

### 推奨方針と確認手順

1. 現在差分をレビュー・commit・push後、Android Release AAB workflowを実行する。
2. Actionsで `npm test`、Gradle unit test、Lint、`bundleRelease` の全stepが成功したrun URLとAAB SHA-256を記録する。
3. Play Console「アプリのコンテンツ > Foreground service permissions」で `microphone` を申告し、以下を動画で示す。
   - アプリ起動からMIC押下まで。
   - マイク許可と、必要な場合の通知案内。
   - 別アプリに移動しても聞き取り中であることと可視表示。
   - アプリへ戻ってMICを押し、確実に停止するところ。
4. Data safetyとプライバシーポリシーが、生音声は保存/送信しないこと、生の認識文字列は端末に最大20件保存すること、バックアップ方針と一致するか照合する。
5. Play内部テストから**同じAAB**をAndroid 13/14/15に新規インストールし、ローカルdebug APKではなく署名済み成果物でスモークテストする。
6. Play Console上のversionName 1.0.10、versionCode、対象トラック、審査警告、価格状態をスクリーンショットで残す。

## リリース判定

- **ローカル共有テスト:** 合格。
- **静的Android監査:** P1候補1件（旧SpeechRecognizer callback世代ガード）、仕様判断3件、実機/外部確認あり。
- **内部テスト配布:** 世代ガード修正とCI成功後なら可。ただしテスターへバックグラウンド継続がベストエフォートであることを明示する。
- **ストア提出:** 現時点では不可判定。Android実機マトリクス、署名済みAAB smoke、Play Console FGS申告、backup方針の決定・説明整合が未完了。

## 実機記録テンプレート

各ケースで次を残す: 端末/OEM、Android版、app version/versionCode、AAB SHA-256、インストール元、新規/更新/復元、マイク権限、通知権限、exact alarm、電池最適化、音声経路、ネットワーク、操作時刻、期待結果、実結果、session ID/error code、logcat、画面録画。
