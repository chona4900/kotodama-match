# コトダマっち オンライン対戦サーバー

招待コードを使う、2人用のリアルタイム対戦サーバーです。各招待コードは1つの Durable Object に割り当てられ、作戦の確定と戦闘結果の計算はサーバー側で一度だけ行われます。

## 仕組み

1. ホストが部屋を作成すると、6文字の招待コードと端末だけが持つ入室トークンを発行します。
2. ゲストがコードを入力して入室します。部屋は2人で締め切られ、15分で自動削除されます。
3. 両者が「攻める / 守る / 祈る」を選ぶと、サーバーが結果を1回だけ計算し、WebSocketで双方へ同じ結果を返します。

## ローカル確認

```powershell
Push-Location online-battle
npx wrangler dev --config wrangler.jsonc --local --port 8787
Pop-Location
node --test online-battle/test/battle-engine.test.mjs
```

## 初回デプロイ（公開はまだしない）

```powershell
Push-Location online-battle
npx wrangler login
npx wrangler deploy --config wrangler.jsonc --dry-run
npx wrangler deploy --config wrangler.jsonc
Pop-Location
```

デプロイ後に表示される `https://...workers.dev` を、アプリ側の `online-battle-config.js` の `apiUrl` に設定してから iOS ビルドを作ります。トークン、Apple証明書、P12はこのサーバーに置きません。

## 仕様上の注意

この段階は、招待した友だち同士のカジュアル対戦です。端末側で生成した育成ステータスを受け取るため、ランキングや賞品を伴う対戦には、ログイン・サーバー保存の育成データ・不正検知を別途導入します。
