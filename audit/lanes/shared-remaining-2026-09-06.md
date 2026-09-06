# 共有コード残存監査 — 2026-09-06

対象は `4b771a8` を基点にした、既存の未コミット修正を含む作業ツリーである。共有ゲーム状態、Web Storage、オンライン対戦、ランキング、UI/アクセシビリティ、依存関係を静的追跡した。この文書以外のファイルは変更していない。ネイティブ実行・実機・ストア配布物は未確認なので、静的確認を「不具合なし」の証明にはしない。

## 先に対応する候補

### 今すぐ低リスクで変更

| 項目 | 根拠 | 影響・推奨方針 | 検証 |
| --- | --- | --- | --- |
| 画面拡大を禁止している | `index.html:5` は `maximum-scale=1.0, user-scalable=no`。 | 低視力ユーザーがOS/ブラウザの拡大を使えない。`maximum-scale` と `user-scalable=no` を削除する。ゲームの二本指ズーム対策は既存の `touch-action: manipulation` (`style.css:9-12`) を維持して実機で確認する。 | Android TalkBack/iOS VoiceOverを有効にし、200%相当の文字/ページ拡大、縦横回転、最小高端末で操作ボタンと全オーバーレイを確認する。 |
| 壊れた対戦再接続情報で再試行不能になり得る | `restoreOnlineBattleSession` は `token` の型だけを確認し、空文字を受理する (`main.js:4269-4281`)。認証失敗の `error` は状態を消さず (`main.js:4720-4728`)、同じ無効セッションを次回も復元する。 | 保存破損、バックアップ復元、将来の形式変更で、メニューを開くたびに認証失敗・再接続ループになり得る。復元時に空白でないtokenを必須にし、`expired` と認証失敗時はソケットを閉じ、メモリ中/保存済みのセッションを消す。 | DevToolsで `kotodama_online_battle_session_v1` のtokenを空文字・不正値にし、メニューを再度開いて新規部屋作成まで戻れること。正常な再接続、期限切れ、認証失敗も各1回確認する。 |
| 対戦中に送信前のソケット断で復帰操作がない | 作戦確定後、接続が閉じていると `submitOnlineBattleAction` は文言を出すだけ (`main.js:4790-4798`)。`selectedBattleAction` はすでに設定済み、`pendingBattleOptions` はnull (`main.js:4995-5021`)。再接続後の `room` は `started` のため画面を組み直さない (`main.js:4730-4739`)。 | ユーザーは「やり直してね」と表示されても対戦オーバーレイを閉じられず、作戦の再選択もできない。送信失敗なら選択を未確定へ戻して再接続後に作戦ボタンを再表示する。自動再送はサーバー側の一回制約 (`online-battle/src/index.mjs:272-306`) と競合し得るため行わない。 | 片側で作戦選択の900ms待機中に機内モードへ切替→復帰。送信済み/未送信の両方で、二重結果・二重ランキングなしに完走できることを2端末で確認する。 |
| 本番で不要な画像処理ライブラリがproduction dependency | `jimp` は `package.json:21-28` の `dependencies` にあるが、利用箇所は `check_sizes.py` 等ではなく、少なくともゲーム/Worker/Capacitor実行パスに見つからない。 | アプリ実行時に不要なNode画像処理パッケージを本番依存として解決する必要はない。使用目的がビルド補助のみなら `devDependencies` へ移し、lockfileを更新する。 | `npm ci`、`npm test`、`npm run build`、Android/iOS CI を通す。`npm ls --omit=dev` にJimpが残らないことを確認する。 |

### 仕様判断後に変更

| 項目 | 根拠 | 影響・推奨方針 | 検証 |
| --- | --- | --- | --- |
| Androidバックアップと認証・聞き取り文字列の扱い | Androidは `android:allowBackup="true"` (`android/app/src/main/AndroidManifest.xml:15`)。Web StorageにはランキングのBearer token (`main.js:4093-4103`)、部屋token (`4251-4262`)、直近20件の文字起こし (`3271-3331`) がある。 | 進行データの端末移行を維持するか、認証token/聞き取り記録を移行対象から除くかは製品・プライバシー判断が必要。前者なら説明を明確化、後者ならAndroid Data Extraction Rulesで除外し、復元後は再認証/再参加にする。 | Android 12以降のバックアップ→別端末復元と、アプリ再インストールをそれぞれ検証。tokenと聞き取り記録、ゲーム進捗、削除操作の期待値を確認する。 |
| 現行saveDataVersion 3の破損値をどう復旧するか | v3は `migrateSavedState` がそのまま返す (`state-migrations.js:69-115`)。`loadState` は数値を有限値/範囲へ正規化せず、配列も `includes` を前提にする (`main.js:916-950`)。例えば `unlockedForms:{}` や `totalCount:"Infinity"` で例外・不正UIになり得る。 | 正本を予備保存から戻すか、各フィールドを安全な最小値へ直すか、利用者に選択させるかを決める。決定後はv3もschema/type/finiteチェックして、回復した理由を画面に知らせる。静かに進捗を初期化しない。 | 主要/予備ともにJSON破損、型違い、負数、Infinity、未知フォーム、配列でない解放リスト、容量不足、書込中断を自動テストする。旧v1/v2/v3とバックアップ復元の組合せを含める。 |
| 公開ランキング・部屋作成の乱用対策 | 匿名プロフィール作成 (`online-battle/src/index.mjs:405-416`) と部屋作成 (`455-478`) は呼出元認証やレート制限なし。ランキングは同一プロフィール対戦の日次上限を持つが (`ranking-rules.mjs:5`, `ranking-store.mjs:135-181`)、複数プロフィール作成は防がない。 | 対象年齢・賞品性・ランキングの重要度に応じ、Cloudflare Rate Limiting/Turnstile/端末アテステーション/招待関係のどれを採用するか決める。アカウント必須化は利用導線と個人情報方針を変えるので先に判断する。 | 負荷テストは本番に向けず、ステージングでprofile/room作成、コード総当たり、同一端末複数プロフィール、429時のクライアント表示を確認する。 |
| 開発/CI依存の更新方針 | `npm audit --json` は合計27件（moderate 11/high 14/critical 2）を報告。主な直接経路は `@capacitor/assets`→`sharp`（修正なし）、`live-server`、`wrangler`。`@capacitor/cli`/`tar`、`websocket-driver`等にも更新可能な指摘がある。`package.json:30-35`。 | これは出荷モバイルバイナリのruntime依存ではないが、CI/開発端末で使うツールのリスク。`npm audit fix --force` を一括実行せず、Capacitor/Assets/Wranglerを互換表に沿って個別更新し、ロックファイルをレビューする。 | 更新ごとに `npm ci`、全テスト、`npm run build`、Android/iOS CI、Worker dry-runを実行。画像入力など信頼しないデータをCIに渡さない。 |
| モーダルの完全なアクセシビリティ仕様 | 同意画面だけはdialogで初期focusを移す (`index.html:119-135`, `main.js:4115-4129`)。対して図鑑詳細はクリック可能な`div`で、dialog role・keyboard操作・focus復帰がない (`main.js:2493-2532`, `index.html:624-642`)。正午、対戦、陰徳、進化等の重なりも同様に統一されていない。 | キーボード操作対象、Esc/戻る、背景focus遮断、focus復帰、読み上げ順を共通コンポーネント化する方針を決める。単なるaria属性追加ではフォーカストラップ不全を解決しない。 | Android TalkBack + 外付けキーボード、iOS VoiceOver + Switch Controlで、全オーバーレイの開閉、Tab循環、戻る、通知からの遷移を確認する。 |

### 現状維持

| 項目 | 根拠 | 判断・継続検証 |
| --- | --- | --- |
| リセットとサーバー削除の境界 | Bリセットはゲーム内の定義済み項目だけを戻す (`main.js:2991-3016`)。コトダマ杯データ削除はサーバーDELETE成功後だけlocal credentialを消し、失敗時に「未削除」とする (`2953-2988`, `3019-3051`)。 | ネットワーク失敗で「削除済み」と誤表示しないため、現設計を維持。サーバー削除・404・通信断の回帰テストを維持する。 |
| 通信/認証の基本防御 | プロフィール更新・削除・個人ランキングはBearer token検証 (`online-battle/src/index.mjs:133-172`, `418-445`)。トークンはサーバーにhashでのみ保存 (`405-415`)。ランキング/相手名はDOMへ `textContent` で描画し、固定外のスタンプを拒否する (`main.js:4284-4325`, `4800-4844`; `index.mjs:259-267`)。 | 現状維持。トークンをログや画面に出さない規約を保ち、API変更時に認可テストを追加する。 |
| 非同期の基本的な古い結果抑制 | プロフィール/ランキング/部屋作成にはgeneration又はin-flight guardがある (`main.js:4183-4196`, `4501-4507`, `4630-4687`)。ソケットイベントはsession identityを比較し、再接続は4回に制限 (`4689-4724`)。 | 上記の「選択直前断線」だけを補強し、通常経路は維持。二重タップ、close→再open、result重複の回帰テストを増やす。 |
| reduced motionの基礎対応 | 全体停止の後、進化やバトルに短い代替演出を与えて状態変化を保つ (`style.css:1270-1415`)。主要状態文言にはlive regionがある (`index.html:18`, `90`, `107`, `171-172`)。 | 現設計を維持。ただし実機の「視差を減らす」設定で長時間の点滅・オーラが負担でないか確認する。 |

### 実機/外部確認のみ

| 項目 | 必要な確認 | 合格条件 |
| --- | --- | --- |
| 保存・移行 | Android/iOSで、初回、v1/v2/v3からの更新、壊れたprimary/backup、OSバックアップ復元、Bリセット、コトダマ杯サーバー削除失敗を確認。 | 意図したデータだけを維持/消去し、破損時は安全に回復または明示的に案内する。 |
| 通信・再接続 | 実機2台で作成/参加、選択前・選択後・結果表示中の機内モード、遅延、WebSocket close/error順序、アプリkill→復帰、15分期限切れを確認。 | 再送・二重ランキング・画面閉じ込めなし。各失敗で次に取る操作が画面から分かる。 |
| UI/アクセシビリティ | Android最小画面/大型画面、iPhone SE級、高テキスト倍率、200%拡大、縦横、安全領域、TalkBack/VoiceOver、キーボード、reduced motionを確認。 | 主要操作のタップ領域、読み上げ、焦点、閉じる手段、ステータスが全画面で利用可能。 |
| 依存・配布物 | CIのAndroid lint/unit test、iOS build/test、Play内部テスト/TestFlightの署名済み成果物で起動・保存・音声・通知・通信を確認。 | `www`とソースが一致した正しいversion/buildの配布物で、テスト記録に端末/OS/権限/ネットワークを残す。 |

## 実行記録

- `node skills/mobile-game-quality-audit/scripts/mobile_game_audit.mjs . --strict`: エラーなし。WARNはAndroid backupとiOS CIのnative test未検出。静的スキャナーはAndroidのclient/rate-limit speech分類、最終結果の継続、Android CI検査、version/asset同期を検出した。
- `npm test`: 43/43 passed（release preflight含む）。
- `npm run online:test`: 12/12 passed。
- `npm run release:preflight`: passed。
- `npm run build`: 105ファイルを`www`へ同期。`git diff --check` はエラーなし（既存の改行コード警告のみ）。
- `npm ls --omit=dev --depth=0`: 本番依存7件の解決を確認。
- `npm audit --omit=dev --audit-level=high`: `found 0 vulnerabilities`。
- `npm audit --json`: 開発依存を含め27件（moderate 11/high 14/critical 2）。出荷バイナリのruntime依存0件とは別に扱う。
- Android Gradle native test/compileはこのWindows環境にJDK/JAVA_HOMEがなく未実行。iOS Xcode build/testもWindowsでは未実行。エミュレータ、実機、ストアトラックは未実施。

## リリース判断

共有ロジックの自動テストは通過したが、上の「対戦中の送信前断線」は利用者を画面に閉じ込める再現可能な経路であり、オンライン対戦を案内する内部テストには先に対処を推奨する。音声、通知、バックアップ、アクセシビリティは実機/署名済み配布物での確認が残るため、この静的監査だけでストア提出可とは判定しない。
