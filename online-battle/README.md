# コトダマっち オンライン対戦サーバー

招待コードを使う、2人用のリアルタイム対戦サーバーです。各招待コードは1つの Durable Object に割り当てられ、作戦の確定と戦闘結果の計算はサーバー側で一度だけ行われます。D1には匿名プロフィールと週間ランキング「コトダマ杯」を保存します。

## 仕組み

1. ホストが部屋を作成すると、4桁数字の招待コードと端末だけが持つ入室トークンを発行します。
2. ゲストがコードを入力して入室します。部屋は2人で締め切られ、15分で自動削除されます。
3. 両者が「攻める / 守る / 祈る」を選ぶと、サーバーが結果を1回だけ計算し、WebSocketで双方へ同じ結果を返します。
4. 両者が有効な匿名プロフィールを使っていた場合だけ、サーバー確定結果をランキングに反映します。プロフィール未対応の旧クライアントも対戦できますが、ランキング対象外です。

## コトダマ杯のルール

- 1シーズンは日本時間の月曜00:00から翌月曜00:00までです。
- 勝利数の多い順、同数なら異なる対戦相手の人数（ご縁）の多い順です。さらに同数ならその勝利数への到達が早い順、最後に匿名プロフィールID順で順位を固定します。
- 同じ勝者から同じ相手への勝利は、日本時間の1日につき3勝まで加算します。対戦自体と新しい相手とのご縁は記録されます。
- 終了したシーズンの上位3名には、金・銀・銅に対応する恒久的な記念実績を付与します。確定処理と試合記録は再実行しても重複しません。
- 対戦後は `thanks` / `nice` / `again` の固定スタンプだけをWebSocketで各席1回送れます。連打防止のため対戦ルームに一時保持し、ルームとともに15分以内に削除します。D1には保存しません。

## API

```text
POST   /v1/profiles
GET    /v1/rankings/weekly?playerId=... Authorization: Bearer <playerToken>
PATCH  /v1/profiles/:playerId    Authorization: Bearer <playerToken>
DELETE /v1/profiles/:playerId    Authorization: Bearer <playerToken>
POST   /v1/rooms
POST   /v1/rooms/:code
GET    /v1/rooms/:code
GET    /v1/rooms/:code/socket    WebSocket upgrade
```

`POST /v1/profiles` は `{playerId, playerToken, displayName}` を返します。表示名はサーバー側の安全な語から自動生成されます。`PATCH /v1/profiles/:playerId` では、認証済みの本人が16文字以内の安全な表記で表示名を変更できます。

プロフィール対応クライアントは、部屋作成・参加の既存JSONに次を追加します。

```json
{
  "snapshot": { "form": "adult_1", "hp": 100, "attack": 10, "evasionRate": 5, "criticalRate": 5, "wins": 0 },
  "profile": { "playerId": "...", "playerToken": "..." }
}
```

週間ランキングは `{seasonKey, seasonEndsAt, entries, me, awards}` を返します。公開用の `entries` は匿名IDを含まない `{rank, displayName, wins, connections, isMe}` です。`playerId` をクエリに付ける場合は同じプロフィールのBearerトークンが必須で、本人の行だけ `isMe: true` になります。認証済みの `me` は `{rank, playerId, displayName, wins, connections, activeAwardRank}`、今週未対戦なら `rank` は `null` です。`awards` は認証したプロフィールが過去に獲得した恒久実績 `{seasonKey, rank}` です。`playerId` なしの公開取得では `me` は `null`、`awards` は空配列です。

匿名プロフィールを使うルームの `host` / `guest` には、自動表示名 `displayName` と直前シーズン入賞 `awardRank`（1〜3または `null`）も含まれます。入賞表示は次のシーズン中だけ有効です。

WebSocketで対戦後に `{ "type": "stamp", "stamp": "thanks" }` を送ると、両者へ `{ "type": "stamp", "seat": "host", "stamp": "thanks" }` の形式で届きます。

## ローカル確認

```powershell
Push-Location online-battle
npx wrangler d1 migrations apply RANKINGS_DB --config wrangler.jsonc --local
npx wrangler dev --config wrangler.jsonc --local --port 8787
Pop-Location
node --test online-battle/test/*.test.mjs
```

現在のリポジトリに入っているWrangler 4.116.0のローカルruntimeは互換日付2026-08-24に未対応です。Wranglerを更新するまでは、`wrangler dev` のローカル確認だけ `--compatibility-date 2026-08-06` を追加してください。本番設定とdry-runは2026-08-24のままにします。

## 初回デプロイ（公開はまだしない）

```powershell
Push-Location online-battle
npx wrangler login
npx wrangler d1 create kotodama-match-rankings
# 上の出力にある database_id を wrangler.jsonc の RANKINGS_DB に設定する
npx wrangler d1 migrations apply RANKINGS_DB --config wrangler.jsonc --remote
npx wrangler deploy --config wrangler.jsonc --dry-run
npx wrangler deploy --config wrangler.jsonc
Pop-Location
```

デプロイ後に表示される `https://...workers.dev` を、アプリ側の `online-battle-config.js` の `apiUrl` に設定してから iOS ビルドを作ります。トークン、Apple証明書、P12はこのサーバーに置きません。

## 仕様上の注意

ランキングにはサーバーが確定したオンライン対戦だけを使用します。匿名プロフィールトークンは端末だけに保存し、サーバーにはSHA-256ハッシュだけを保存します。プロフィール削除APIはプロフィールにひもづく対戦・集計・実績を削除します。

育成ステータスは引き続き端末側の値を上限検証して使うカジュアル対戦です。ランキング報酬はゲーム性能を上げない記念実績に限定し、将来価値のある賞品を導入する場合は、サーバー保存の育成データや追加の不正検知を先に導入します。
