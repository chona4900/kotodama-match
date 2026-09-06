# iOS 残存リスク再監査（2026-09-06）

対象: コトダマっち 1.0.10 の現在の未コミット作業ツリー（HEAD `4b771a8` を基準）
監査レーン: Swift 音声認識、セッション／ライフサイクル、`AVAudioSession`、バックグラウンド／復帰、通知、権限、Swift Package／Xcode、ネイティブテスト／CI
結論: **共有回帰テストは合格しているが、iOSネイティブの割込み制御と実機バックグラウンド動作は未証明。現時点では内部TestFlight候補であり、ストア提出可とは判定しない。**

## 監査方法と現在の証拠

- `skills/mobile-game-quality-audit/SKILL.md` と `references/mobile-test-matrix.md` を全文読んだうえで、現在のソース、生成済みiOS資産、Xcode設定、CI、テストを照合した。
- `npm test` を2026-09-06に実行し、**43件中43件合格、失敗0件**。`Release preflight passed.` も確認した。
- ただしiOS関連の既存テストは `scripts/gameplay-regressions.test.js:374-421` の正規表現によるソース構造チェックが中心で、Swift、`SFSpeechRecognizer`、`AVAudioEngine`、`AVAudioSession` を実行していない。
- `node skills/mobile-game-quality-audit/scripts/mobile_game_audit.mjs . --json` はiOSの権限文言と世代IDをPASS、**iOS CIに `xcodebuild test` がないことをWARN**とした。
- `main.js`、`www/main.js`、`ios/App/App/public/main.js` のSHA-256は一致。`data.js` もルート、`www`、iOS publicで一致し、今回監査した共有コードはiOSプロジェクトへ同期済み。
- このホストは Windows 10 (`Microsoft Windows NT 10.0.26200.0`) で、`xcodebuild` は存在しない。したがって **Swiftコンパイル、Xcodeビルド、Simulator、実機、TestFlight成果物はすべて未検証**。

## リリースを止める優先リスク

1. **P1 — iOS再試行回数が、認識開始直後にエラーを繰り返す経路では実質無制限になり得る。** `main.js:3460-3477` は最大4回を意図する一方、`main.js:3591-3595` が `started` のたびに回数を0へ戻す。Swiftはエンジン開始時点で `started` を送信し（`SpeechRecognitionPlugin.swift:104-108`）、その後の認識タスクエラーでは停止するだけ（同:96-101）なので、「開始成功→即エラー→再開」が続くと上限が効かない。
2. **P1 — iOSネイティブは割込みと音声経路変更を直接監視していない。** `AVAudioSession.interruptionNotification`、`routeChangeNotification`、`mediaServicesWereResetNotification` の購読がなく、`AppDelegate.swift:25-45` のライフサイクル処理も復帰時のカテゴリ確認だけである。通話、Siri、別録音アプリ、Bluetooth切断後に、エンジン状態と実際の録音可能状態がずれる可能性がある。
3. **P1 — 「バックグラウンドでも聞き取り続ける」という現在の説明と、実機で保証できる実装境界が未確認。** `Info.plist:27-30` はbackground audioを宣言し、`Info.plist:54-57` は他アプリ利用中も聞き取ると説明する。一方、復旧はWeb側タイマーとforeground復帰イベントに依存している（`main.js:3460-3477`, `3627-3631`）。OS停止、画面ロック、長時間バックグラウンド、認識タスク終了後も継続できるかは静的監査では証明できない。
4. **P1 — 60秒だけ有効なイベントに対し、iOS通知の実着信時刻が未検証。** ゲーム窓は `main.js:1263-1265` の12:00:00〜12:00:59だが、通知は11:59のカレンダー通知（`main.js:1372-1386`）。Focus、低電力、端末再起動、時刻・タイムゾーン変更を含め、12:00:59までに利用者が開ける保証はない。
5. **P2 — iOSネイティブテストターゲットがない。** `project.pbxproj:79-100,131-133` にアプリターゲット1つしかなく、Swift Packageにもテストターゲットがない（`plugins/kotodama-speech-recognition/Package.swift:15-22`）。CIは共有JSテストとArchiveのみで、`xcodebuild test` を実行しない（`.github/workflows/ios-build.yml:31-41,86-115`）。

## 分類A: 今すぐ低リスクで変更

### A1. 再試行上限のリセットを「started」から「有効な認識結果」に移す

- 根拠: `main.js:3460-3477`, `3578-3588`, `3591-3595`, `3606-3613`。
- 影響: 通信断やSpeechサービス障害時に、録音セッションを永続的に再作成して電池・発熱・画面状態を悪化させる可能性がある。
- 推奨方針: `listeningState=started` では再試行回数を0へ戻さず、当該sessionIdで最初のpartial/final結果を受けた時、または一定秒数安定稼働した時だけ0へ戻す。4回失敗後はMICオン意思を解除し、ユーザー操作で再開する。
- 検証: JSテストへ「started→stoppedを5回連続」「partialResults後の失敗」「手動stop中のタイマー発火」をイベント列として追加し、4回で停止することを振る舞いで確認。続いて実機の機内モード／ネットワーク断で録音アイコンと消費電力を確認する。

### A2. Swiftから構造化した認識エラーを通知する

- 根拠: Web側は `recognitionError` を購読する（`main.js:3619-3626`）が、iOS Swiftはこのイベントを送らず、エラー時に `stopRecognition` するだけ（`SpeechRecognitionPlugin.swift:96-101`）。
- 影響: 権限取消・利用不可・一時的通信障害を同じ「stopped」として扱い、再試行可否と利用者向け表示を正しく分けられない。
- 推奨方針: iOSでもエラーのdomain/code、`willRetry`、sessionIdを `recognitionError` として送る。権限拒否・restricted・非対応ロケールは再試行しない。一時エラーだけをA1の上限内で再試行する。
- 検証: エラー分類を純粋関数化してSwift単体テストを追加。JS側はfatalで `nativeListeningRequested=false`、transientで上限付き再試行になることをテストする。

### A3. 音声tapが現在の共有プロパティではなく、そのセッションのrequestへだけ書くようにする

- 根拠: `SpeechRecognitionPlugin.swift:72-74` のtap closureは `self?.recognitionRequest?.append(buffer)` を使い、開始時に生成したローカル `request` とsessionIdを検証しない。認識コールバック側には世代ガードがある（同:76-77）がtap側にはない。
- 影響: stop/start境界で古いaudio render callbackが遅延した場合、新しいrequestへ旧セッションのbufferを追加する競合余地がある。再現頻度は低いが、同一語連続認識や最初の音節に影響し得る。
- 推奨方針: tap closureで開始時の `request` と `sessionId` を捕捉し、現在のsessionIdと一致する時だけそのrequestへappendする。共有 `recognitionRequest` をtapから読まない。
- 検証: XcodeのThread Sanitizerを有効にしたDebug実機で、MIC連打、同一語10回、final直後の再開、バックグラウンド往復を反復。Swiftコンパイルも必須。

### A4. 「stopped」の通知条件を `audioEngine.isRunning` だけにしない

- 根拠: `SpeechRecognitionPlugin.swift:206-227` は停止前に `audioEngine?.isRunning` がtrueだった場合だけ `listeningState=stopped` を通知する。
- 影響: OS割込みで先にengineが停止した後に認識エラーが届くと、JSが停止を知らずMIC表示が残る。foreground復帰時の `isListening` 同期まで回復が遅れる可能性がある。
- 推奨方針: 明示的なnative state（idle/starting/listening/stopping）か、task/requestの存在を基準に「開始済みセッションを一度だけ停止通知」する。開始前の失敗では誤通知しないようsessionId単位で重複排除する。
- 検証: interruptionでengineが先に止まる模擬テスト、手動stop、final、start失敗の各経路でstoppedが0回または1回だけ届くことを確認する。

### A5. CIの依存導入を `npm install` から `npm ci` へ変更する

- 根拠: lockfileは存在するが、iOS CIは `.github/workflows/ios-build.yml:31-35` で `npm install` を使用する。実インストールはCapacitor iOS/core 8.3.0、App 8.1.0、Local Notifications 8.0.0で、生成SPMはnode_modulesのpath依存を使う（`ios/App/CapApp-SPM/Package.swift:13-27`）。
- 影響: lockfileとmanifestの不一致をCIが修正して進む余地があり、監査時と異なる依存解決を見逃しやすい。
- 推奨方針: リリースCIでは `npm ci` を用い、lockfile不一致を失敗にする。依存更新は別PRで `npm install`→`npx cap sync ios`→全テストの順に行う。
- 検証: クリーンなGitHub runnerでinstall、共有テスト、cap sync、Archiveまで通し、`git diff --exit-code package-lock.json ios/App/CapApp-SPM/Package.swift` 相当で意図しない生成差分がないことを確認する。

### A6. IPA artifactの保存失敗を成功扱いにしない

- 根拠: `.github/workflows/ios-build.yml:117-122` のartifact uploadに `continue-on-error: true` がある。
- 影響: Archive/Export後にIPAのパス違い・保存失敗があってもworkflowが成功表示になり、監査した成果物を取得できない。
- 推奨方針: `continue-on-error` を外し、生成IPAを列挙して1件であることと署名情報を確認してから必須artifactとして保存する。
- 検証: 手動CIでartifactをダウンロードし、bundle ID、version、build number、埋め込みprovisioning profileを検査する。

## 分類B: 仕様判断後に変更

### B1. iOSでバックグラウンド常時待受を本当に製品要件にするか決める

- 根拠: background audio宣言と説明文は `Info.plist:27-30,54-57`。現状はJSがMICオン意思を保持し、final/stop後の再開をWebタイマーで行う（`main.js:3430-3477,3606-3613`）。
- 影響: 要件が曖昧なままだと、端末・OS差で「他アプリを開いても継続」「復帰後だけ再開」「OS停止なら終了」が混在し、プライバシー説明と実挙動もずれる。
- 推奨方針: 次のどちらかを明文化する。
  - foreground中心: background移行で認識を明示停止し、復帰時に利用者の意思を確認して再開。不要なら `UIBackgroundModes=audio` と「他アプリ中も」の説明を削除する。
  - background継続: Swift側がユーザー意図・認識世代・再試行・割込み・routeを所有し、Webタイマーへの依存を減らす。OSが許可しない停止はUIで明示する。
- 検証: 選んだ仕様を受入条件にし、画面ロック、ホーム、他アプリ5/30分、通話、Siri、プロセス終了、低電力で実機確認する。

### B2. `AVAudioSession` の割込み・route変更・media service resetを一つのstate machineで扱う

- 根拠: 録音設定は `SpeechRecognitionPlugin.swift:193-204`、復元は同:219-223、AppDelegateの再活性化は `AppDelegate.swift:10-17,39-45` に分散している。割込み通知の購読はない。
- 影響: 通話/Siri/別録音アプリ/Bluetooth切断の順序によって、カテゴリだけ `.playAndRecord` のままなのにsessionが非active、またはengineだけrunningというずれが起き得る。
- 推奨方針: B1の要件確定後、音声sessionの所有者をSpeech pluginへ寄せる。interruption beganで物理録音を止め、endedの `shouldResume`、route change、media services resetをsessionId付きで処理し、Webへrecovering/stoppedを一貫して通知する。AppDelegateは競合するカテゴリ変更を行わない。
- 検証: 実機ログへsessionId、reason、category/mode、route、engine/task/request stateを記録し、全イベント順序を確認する。

### B3. Bluetoothと他アプリ音声の方針を決めてAudio Session optionを調整する

- 根拠: 録音は `.playAndRecord` + `.measurement` + `[.defaultToSpeaker, .mixWithOthers]`（`SpeechRecognitionPlugin.swift:193-195`）。Bluetooth HFPを明示的に許可するoptionはない。停止後は `.playback` + `.mixWithOthers`（同:198-203）。
- 影響: Bluetoothマイクを期待しても内蔵マイクへ落ちる、出力routeが変わる、BGMや他アプリ音声が認識へ回り込むなど、期待と異なる可能性がある。
- 推奨方針: 「Bluetoothマイク対応」「他アプリ音声と混在」「MIC中のゲームBGM」「消音スイッチ時の出力」を仕様表にする。Bluetooth入力を正式対応する場合だけ適切なHFP optionを加え、A2DP出力との切替を実機で調整する。
- 検証: 内蔵、AirPods/HFP、Bluetoothスピーカー、USB/有線、接続解除中の各routeで入力元・出力先・認識率を記録する。

### B4. 60秒イベントに通知遅延・取り逃し救済を設けるか決める

- 根拠: ゲーム可能時間は `main.js:1259-1269`、通知スケジュールは `main.js:1363-1422`。通知tapは `main.js:1429-1435` で画面を開くが、遅れて開いた場合の救済はない。
- 影響: 通知自体が正しく登録されても、FocusやOS判断で表示が遅れると機能を利用できず、利用者には故障に見える。
- 推奨方針: 「時刻厳守の儀式」を優先するなら遅延は既知制約として表示し、アプリ内事前カウントダウン等を追加する。「通知から参加できる」を優先するなら受付時間または猶予を延ばし、通知tap時刻を記録して救済する。
- 検証: 選択した最大許容遅延を受入条件にし、Focus/低電力/再起動/オフライン/タイムゾーン/DSTでTestFlight実測する。

### B5. iPadのorientationを全方向対応のままにするか決める

- 根拠: iPhoneはportraitのみだが、iPadはportrait/逆portrait/左右landscapeを宣言する（`Info.plist:39-49`）。Xcode targetはiPhone/iPad両方（`project.pbxproj:312,333`）。
- 影響: UIがportrait前提ならiPad landscapeで崩れやすい。反対にportrait固定へ変えると既存iPad利用者の操作性に影響する。
- 推奨方針: iPad対応範囲を決め、全方向を維持するなら各overlay、音声状態表示、通知導線をlandscapeで検証する。未対応なら宣言をportrait系へ限定する。
- 検証: 最小/最大iPad Simulatorと実機、Split View相当のサイズ変化、200%文字で全画面を確認する。

### B6. ネイティブ音声テストを可能にする小規模リファクタリング

- 根拠: 音声pluginは `AVAudioSession.sharedInstance()`、`AVAudioEngine()`、`SFSpeechRecognizer` を直接生成する（`SpeechRecognitionPlugin.swift:20-23,49,59,67`）。test targetもない。
- 影響: stale callback、エラー分類、通知回数、割込み順序をCIで再現できず、端末テストだけでは再発検出が遅い。
- 推奨方針: recognizer/audio/sessionをprotocol経由で注入し、session generationとstate transitionを純粋なcontrollerへ分離する。Swift Packageにtest targetを追加してA1〜A4/B2を固定する。
- 検証: `xcodebuild test` またはpackage schemeのiOS Simulator testをCIで必須化し、テストレポートをartifact保存する。

### B7. CIを手動リリース専用のままにするか、PR検証を分離する

- 根拠: `.github/workflows/ios-build.yml:3-10` は `workflow_dispatch` のみ。署名付きArchiveは同:43以降でsecretを必要とする。
- 影響: iOS/Swift/Package変更がPRやpush時に自動コンパイルされず、手動リリース時まで破損を発見できない。
- 推奨方針: 署名・TestFlight workflowは手動のまま維持し、別にPR用のunsigned build + shared tests + native testsを作る。Xcodeバージョンは「latest-stable追随」か「固定して計画更新」かを決める。
- 検証: secretなしfork相当のPRでも検証jobが通り、Swiftコンパイルエラーを意図的に入れると確実に失敗することを確認する。

## 分類C: 現状維持

### C1. stale callback対策と同一語セッション分離

- 根拠: Swiftが世代IDを保持・更新し（`SpeechRecognitionPlugin.swift:24,57-58,206-209`）、認識callbackを世代一致でguardする（同:76-77）。partial resultにもsessionIdを含める（同:79-86）。WebはID変更時に中間集計をリセットする（`main.js:3578-3588`）。final後は早期returnする（Swift同:90-93）。
- 影響: 旧taskの遅延callbackが新taskを止める既知競合と、同じ言霊を次セッションで数えられない問題を抑止する。
- 推奨方針: この設計は維持する。A3/B2の改修でもsessionIdを一貫して全イベント・tapへ伝播する。
- 検証: Swiftネイティブテスト追加後、session Nをcancel→N+1開始→Nのresult/error遅延到着を注入し、N+1が変化しないことを確認する。

### C2. ja-JPの利用可能判定と開始前権限確認

- 根拠: `available()` はja-JP recognizerを確認する（`SpeechRecognitionPlugin.swift:26-28`）。start前にSpeechとmicrophoneをguardする（同:30-38）。Webも押下時に権限を再確認し、未決定だけrequestする（`main.js:3509-3567`）。
- 影響: 端末の既定言語が日本語以外でも誤ったrecognizerを確認せず、拒否済み利用者へプロンプトを繰り返さない。
- 推奨方針: 維持する。A2で権限取消エラーもfatal分類へ統合する。
- 検証: 日本語/英語端末、初回prompt、片方だけdeny、設定からlater grant/revokeで表示と再開可否を確認する。

### C3. Privacy usage descriptionとbundle/version/minimum OS

- 根拠: microphoneとSpeechの両説明がある（`Info.plist:54-57`）。bundle IDは `com.kotodamamatch.app`、versionは1.0.10/build 78、iOS minimumは15.0（`project.pbxproj:299-312,321-333`）。Capacitor configのapp IDも一致（`capacitor.config.json:1-5`）。
- 影響: 静的には権限promptとアプリ識別が整合している。
- 推奨方針: B1でbackground仕様を変えない限り維持する。CIのbuild number overrideはE6で配布物を確認する。
- 検証: fresh installの実prompt文、Settings表示、IPA内Info.plistを確認する。

### C4. Capacitor SPMへのplugin登録とバージョン整合

- 根拠: 生成PackageはCapacitor 8.3.0 exact、App/Local Notifications/custom Speechをpath依存・product登録する（`ios/App/CapApp-SPM/Package.swift:13-29`）。生成capacitor configも `AppPlugin`、`LocalNotificationsPlugin`、`SpeechRecognition` を列挙する（`ios/App/App/capacitor.config.json:1-10`）。custom packageのminimum iOSも15（`plugins/kotodama-speech-recognition/Package.swift:1-21`）。
- 影響: 静的にはplugin欠落やminimum OS不一致は見つからない。
- 推奨方針: 生成 `CapApp-SPM/Package.swift` は直接編集せず、package.json変更後にCapacitor syncで再生成する。A5のlockfile厳格化は別途行う。
- 検証: macOSでpackage resolve、unsigned build、Archive後に3pluginがロードされることを起動ログとJS呼出しで確認する。

### C5. iOS通知の登録形とtap route

- 根拠: daily 11:59、毎月1日/15日18:59を固定IDで登録し（`main.js:1363-1422`）、権限許可時とvisible復帰時に再登録する（同:1425-1440,1500-1508）。tap eventはIDまたはextra routeで儀式画面を開く（同:1429-1434）。
- 影響: 静的にはforeground/background/terminated由来のtapを一つのrouteへ集約できている。生成Local Notifications pluginはactionをretainしてlistenerへ渡す実装を含む。
- 推奨方針: 登録形とroute判定は維持する。ただしB4の時間仕様とE4の実着信試験は必須。
- 検証: `getPending()` で3 IDを確認し、foreground/background/terminatedのtapが一度だけ同じ画面を開くことを実機で確認する。

### C6. Web Audioの出力回復ガード

- 根拠: 録音中はnative audio sessionを不用意に再構成せず（`data.js:6-19`）、touch/click/visibility/pageshowでWeb Audioとnative playbackを復帰する（`data.js:37-87`）。AppDelegateもMICの `.playAndRecord` を上書きしない（`AppDelegate.swift:39-45`）。
- 影響: 消音解除やforeground復帰時の無音対策として妥当で、録音中のsession変更を避けている。
- 推奨方針: 現状のガードを維持する。B2で音声session ownershipを変更する場合は、この処理との二重活性化を統合する。
- 検証: MICオン/オフ双方で消音スイッチ、通話後、画面復帰、効果音連打を実機確認する。

## 分類D: 実機／外部確認のみ（現環境では完了不能）

### D1. Swift/Xcodeのcompile・Archive・native test

- 根拠: Windowsホストに `xcodebuild` がなく、CIにはnative test target/commandがない。Archive定義は `.github/workflows/ios-build.yml:86-115` に存在するが、今回の実行結果は未取得。
- 影響: 現在のSwift変更がXcode最新安定版でコンパイル・署名・起動することをまだ証明できない。
- 推奨方針: まずA1〜A6を反映したcommitでmacOS CIを実行。unsigned compile、テスト、Archive、IPA検査を順に必須gate化する。
- 検証: GitHub Actionsのrun URL、commit SHA、Xcode version、全log、IPA hashを監査記録へ残す。

### D2. 音声認識の実機failure matrix

- 根拠: 静的には世代guardがあるが、端末音声経路とOS callback順序は再現していない。
- 影響: 初回発話後の継続、同一語連続、認識率、無音・通信断・サービス停止時のUIは端末依存である。
- 推奨方針: iPhone SE系と現行大型iPhoneを最低各1台、iOS 15系と最新iOSを可能な範囲で含める。
- 検証: fresh/upgrade、初回/同一語10回/長文/無音、offline/online、permission deny/later grant/revoke、MIC高速連打をTestFlight版で実施。sessionId付きnative logと画面録画を残す。

### D3. 割込み・route・background/復帰

- 根拠: B1〜B3のとおり、現在は明示的なnative割込みstate machineがない。
- 影響: 通話/Siri/別録音、ロック、他アプリ、Bluetooth切断でMIC表示だけ残る、再開ループ、音が出ない可能性がある。
- 推奨方針: B1の仕様を決めてから、内蔵/有線/Bluetoothそれぞれで検証する。単なるforeground往復だけで完了扱いにしない。
- 検証: MICオン中に着信応答/拒否、Siri、録音アプリ、ロック5/30分、Bluetooth接続/解除、出力音量0→復帰、低電力を組み合わせる。終了後に次の言霊が認識されるか確認する。

### D4. 通知の時刻・権限・tap

- 根拠: 共有テストは通知ソースの存在を検査するだけで、iOS通知を配信していない。Local Notifications permissionはSwift plugin側ではなくCapacitor pluginが担当する。
- 影響: Focus、通知要約、低電力、再起動、時計変更による遅延と、cold launchのtap routeが未確認。
- 推奨方針: 11:59/18:59を待つ本番時刻試験に加え、検証用時刻を注入できるDebug/TestFlight構成を用意する。通知拒否後の設定案内も確認する。
- 検証: prompt/granted/denied/later grant、foreground/background/terminated、Focus、再起動、timezone/DST/manual clockで、登録時刻・到着時刻・tap時刻・画面遷移を記録する。

### D5. TestFlight配布物とApp Store側状態

- 根拠: ソースはversion 1.0.10/build 78だが、CIは `CURRENT_PROJECT_VERSION=$GITHUB_RUN_NUMBER` で上書きする（`.github/workflows/ios-build.yml:97-107`）。引き継ぎ上、外部で最後に確実だったTestFlight buildは138で、現在状態は未確認。
- 影響: build number重複、古い成果物のテスト、監査commitとTestFlight IPAの取り違えが起こり得る。
- 推奨方針: App Store Connectで最新build、処理状態、契約、対象テスターを確認し、監査commit SHAとbuild numberの対応表を残す。
- 検証: TestFlightから新規インストール／前版更新し、Settingsまたは診断画面でversion/buildを記録してD2〜D4を実施する。

### D6. background audio宣言とプライバシー説明の外部整合

- 根拠: `Info.plist:27-30,54-57`。実装上の宣言は存在するが、App Store Connectのprivacy回答、審査説明、実際のbackground挙動はリポジトリだけでは確認できない。
- 影響: 利用者説明と動作が一致しない場合の信頼・審査リスク。不要なbackground利用なら電池消費にもつながる。
- 推奨方針: B1の決定に合わせ、Info.plist、アプリ内説明、App Store privacy/審査メモを同時更新する。
- 検証: App Store Connectの現在回答とレビュー指摘履歴を確認し、TestFlightで録音indicator、停止導線、background継続時間を画面録画する。

## 推奨実施順

1. A1〜A4を同じ「iOS speech state」変更として実装し、イベント列JS回帰テストを追加する。
2. A5/A6でCI成果物の再現性を上げる。
3. B1を製品仕様として決め、B2/B3/B6を一体で設計する。background継続を選ぶ場合、Swift側が状態を所有する。
4. macOS CIでcompile/test/archiveを通す。失敗時は実機試験へ進まない。
5. TestFlight成果物でD2〜D4を実施し、B4/B5の仕様を確定する。
6. D5/D6の外部状態を確認後にのみストア提出可否を再判定する。

## 現時点の判定

- ローカル共有テスト: **合格（43/43）**。
- iOS生成Web資産: **ルート資産と一致**。
- Swift stale callback対策、権限文言、plugin登録: **静的確認済み**。
- Swiftコンパイル／Xcode native test／Simulator: **未検証（Windowsのため実行不能）**。
- iPhone実機／TestFlight／通知実着信／App Store外部設定: **未検証**。
- リリース判定: **内部TestFlightへ進む前にもA1〜A6とmacOS compileを推奨。ストア提出はB1/B4の仕様確定、D2〜D6完了まで保留。**
