# 言霊っち用：ピクセルアート生成プロンプト集

「言霊っち」の24x24ドット絵スタイルを、Geminiなどの画像生成AIで作成するためのプロンプトです。

## 1. キャラクターデザイン変換プロンプト
参照画像（例：白虎の写真やイラスト）をアップロードし、以下のプロンプトを組み合わせて使用してください。

### 基本プロンプト（単体キャラクター用）
> **Prompt:**
> 2D pixel art of a [CHARACTER_NAME], GameBoy style, 24x24 resolution look, thick dark outlines, pure black and white (monochrome) palette, centered on a plain white background, sharp pixels, no anti-aliasing, retro handheld game aesthetic.
> 
> **日本語訳:**
> [キャラクター名]の2Dピクセルアート、ゲームボーイスタイル、24x24解像度の見た目、太い暗色の輪郭、純粋な白黒（モノクロ）パレット、白い背景の中央に配置、シャープなピクセル、アンチエイリアスなし、レトロな携帯ゲーム機の意匠。

---

## 2. アニメーション（左右の動き）生成プロンプト
キャラクターが「左に揺れる」「右に揺れる」といった、アプリ内でのアニメーション用のコマを1枚の画像（スプライトシート）に生成させるためのプロンプトです。

### 左右の動き：3コマのスプライトシート
> **Prompt:**
> A horizontal sprite sheet for a 2D pixel art [CHARACTER_NAME]. Please generate 3 distinct frames in a single row for a continuous animation:
> 1. Center: Character standing still and facing forward.
> 2. Left-tilt: Character leaning or stepping to the left.
> 3. Right-tilt: Character leaning or stepping to the right.
> 
> GameBoy style, 24x24 pixel grid feel, pure black and white (monochrome) palette, thick dark outlines, sharp high-contrast pixels, plain white background, consistent character size and design across all 3 frames.
> 
> **日本語訳:**
> [キャラクター名]の2Dピクセルアート用水平スプライトシート。連続したアニメーションのために、1行に3つの異なるフレームを生成してください：
> 1. 中央：直立して正面を向いている。
> 2. 左傾斜：左側に傾く、または一歩踏み出す。
> 3. 右傾斜：右側に傾く、または一歩踏み出す。
> 
> ゲームボーイスタイル、24x24ピクセルグリッド感、純粋な白黒（モノクロ）パレット、太い暗色の輪郭、シャープで高コントラストなピクセル、白い背景、3つのフレームすべてでキャラクターのサイズとデザインを統一。

### 確実に「コマ割り」させるためのコツ
1枚しか出てこない場合は、以下の言葉をプロンプトに追記してください：
- **"Divide into 3 separate boxes"**: 3つの箱に分けて描いて
- **"Series of frames"**: フレームの連続
- **"Filmstrip style"**: フィルムのコマのようなスタイル
- **"Multiple poses on one line"**: 1行の中に複数のポーズを

---

## 3. 生成後のワークフロー（コツ）

1.  **高解像度で生成し、後で縮小する:**
    AIは本物の24x24ピクセルで出力するのが苦手なため、一度高解像度（512x512など）の「ドット絵風画像」として生成させます。
2.  **バイリニア（補間なし）で縮小:**
    生成された画像を24x24ピクセルにリサイズする際、「ニアレストネイバー（Nearest Neighbor）」法で縮小すると、ドットが崩れず綺麗にアプリに組み込めます。
3.  **コードへの変換:**
    現在の `index.html` にある `█`（黒四角）の配列に変換するには、グレースケール化した画像の明るさで0/1を判定する簡単なスクリプトを使うのが効率的です。

---

## 4. フリー素材（画像）からアニメーションコマを生成するプロンプト（Image-to-Image用・最終調整版）

お好きなフリー画像（ヘビや鳳凰など）をGeminiやChatGPTにアップロードし、以下のプロンプトと一緒に送信することで、パラパラ漫画風のコマ画像を作成させます。
※「余白」や「解剖学的な破綻（頭が2つになる等）」を防ぎつつ、「全く同じコマが3つ並ぶ」のを防ぐため、フレームごとに明確な動きの差を強制するように調整しました。

> **AIへの送信文例（コピペ用）:**
> 
> 添付した画像をベースにして、動きのあるレトロゲーム風の白黒ドット絵アニメーション素材（スプライトシート）を作成してください。
> スタイルやコマ割りの「厳格なルール」は以下の英語の指示に従ってください。
> 横長（アスペクト比 3:1）で、上下の余白をなくし、3つのコマは「全く同じ画像」ではなく「明確にポーズや表情が変わっている」状態にしてください。
> 
> **Prompt:**
> I have uploaded a reference image. Please convert this into a 2D pixel art sprite sheet for a retro handheld game animation.
> 
> **CRITICAL LAYOUT RULES:**
> * The canvas MUST be a wide horizontal rectangle (3:1 aspect ratio).
> * EXACTLY ONE ROW containing 3 frames. Crop tightly to the characters, NO massive white margins above or below.
> * DO NOT draw anything else. No extra art, no extra text.
> 
> **STYLE REQUIREMENTS:**
> * **Resolution:** 24x24 pixel grid feel per frame.
> * **Color Palette:** Pure black and white (monochrome) only. No gray, no gradients.
> * **Aesthetic:** Sharp high-contrast pixels, thick dark outlines, GameBoy / retro digital pet style.
> 
> **ANIMATION REQUIREMENTS (Force distinct poses):**
> * IMPORTANT: The 3 frames MUST NOT be exactly identical. You must draw 3 DIFFERENT states of the character to create a flipbook animation.
> * **Frame 1:** Default standing pose, adapted cleanly from the reference image.
> * **Frame 2:** "Action" pose. The character must visibly change shape from Frame 1 (e.g., looking sharply to the side, mouth wide open, heavily squished down, or jumping).
> * **Frame 3:** "Recovery" pose or alternate state (e.g., looking the other way, eyes closed, or returning midway to the default pose).
> * **Consistency:** Keep the character design consistent and the anatomy strictly correct (do not draw two heads), but FORCE a visible change in pose, silhouette, or expression in each frame.

---

## プロンプト調整用キーワード
- **Low bit:** レトロ感を出す
- **Flat color:** 影をシンプルにする
- **Silhouette:** 形をハッキリさせる
- **Sprite sheet:** 複数のポーズを1枚に出す
