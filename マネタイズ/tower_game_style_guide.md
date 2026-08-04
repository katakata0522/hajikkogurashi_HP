# 『はじっこ勇者のインフレ魔塔』ビジュアルスタイルガイド (v1.0.0)

本ドキュメントは、新規ステージ進行型ゲーム『はじっこ勇者のインフレ魔塔（Hajikko Hero's Infinity Tower）』におけるビジュアル、UI/UXデザインの一貫性と品質を保つための公式スタイルガイドです。
モバイル（WebView）およびPCブラウザの双方で「プレイヤーを魅了し、没入させる」プレミアムな体験を提供するため、実装レベルのCSS設計を含めて記述しています。

---

## 1. デザインコンセプト：インフレ感と触覚の融合

本作のデザインコアは**「数字が爆発的に伸びる爽快感（インフレ）」**と、**「指先で迷宮を切り開くフィジカルな心地よさ（一筆書き）」**の融合です。
画面全体が美しく発光し、プレイヤーのアクションに対して小気味よく、かつダイナミックに反応する「生きたUI」を目指します。

---

## 2. 日本向け最適化＆情報レイアウト

日本のモバイルゲーム市場において、ユーザーは「一目で戦況を把握できる適度な情報密度」と「無駄のない操作性」を求めます。海外風の極端に余白の広いレイアウトではなく、整理されたモダンな情報集約型レイアウトを採用します。

### 2.1 タイポグラフィ規格
美しさと視認性を両立するため、日本語テキストには親しみやすさとモダンさを兼ね備えた「Noto Sans JP」、数値および英字には幾何学的で視認性の高い「Outfit」を採用し、CSSの優先順位でこれらを美しく混在させます。

```css
/* グローバルフォント設定 */
body {
  font-family: 'Outfit', 'Noto Sans JP', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ダミーテキスト・UI用クラス例 */
.status-value {
  font-family: 'Outfit', sans-serif;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.ui-label {
  font-family: 'Noto Sans JP', sans-serif;
  font-weight: 500;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}
```

### 2.2 モバイル・PC両対応「指が隠れない」画面構成
WebViewおよびPCブラウザで最適な表示を保つため、アスペクト比「9:16〜9:19.5」の縦画面レイアウトを基準とし、画面を以下の3つのゾーンに分割します。

```
+-----------------------------------+  [上部 15%: ステータス・階層表示]
|  [階層: 1,200F] [所持ゴールド]   |  プレイヤーの視線が集中するエリア
+-----------------------------------+
|                                   |  [中部 35%: バトル演出・魔塔可視化]
|       バトルアニメーション        |  勇者と敵のアクションが展開される
|      （3D/2Dビジュアル領域）     |
+-----------------------------------+
|                                   |  [下部 50%: 一筆書き操作グリッド]
|       [ A ] - [ B ] - [ C ]       |  プレイヤーが指で操作する領域。
|         |       |       |         |  指の移動によって上部の戦闘画面や
|       [ D ] - [ E ] - [ F ]       |  主要ステータスが隠れないよう配置。
+-----------------------------------+
```

- **操作の邪魔をしない設計**: 指でなぞる「グリッド領域」を画面の下半分に完全に隔離し、指や手がバトルの数値ポップアップや勇者のグラフィックを遮らないようにします。

---

## 3. カラーパレット＆世界観

魔塔の深層へと進むにつれ、背景と世界観はドラマチックに変化します。背景は多層的なグラデーションで表現し、UIは背景の美しさを引き立てる「すりガラス（Glassmorphism）」で統一します。

### 3.1 エリア別背景グラデーション

| エリア | テーマ | カラーコード (開始 ➔ 終了) | アクセントカラー | デザイン意図 |
| :--- | :--- | :--- | :--- | :--- |
| **エリア 1** | 新緑 of 遺跡 | `#112A1D` ➔ `#08140E` | `#10B981` (Emerald) | 古代の息吹を感じる神秘的な緑 |
| **エリア 2** | 灼熱 of 溶岩 | `#2D0B0B` ➔ `#120303` | `#EF4444` (Rose Neon) | 脈動する熱気と緊張感の赤 |
| **エリア 3** | 氷結 of 神殿 | `#0A1C2A` ➔ `#030914` | `#06B6D4` (Cyan Laser) | 静寂と絶対零度の世界を表現する青 |
| **エリア 4** | 虚空 of 宇宙 | `#14002A` ➔ `#050010` | `#A855F7` (Deep Purple) | 深淵なる宇宙と終わりなきインフレの紫 |

```css
/* エリア別背景CSS定義 */
.bg-area-1 { background: radial-gradient(circle at top, #112A1D 0%, #08140E 100%); }
.bg-area-2 { background: radial-gradient(circle at top, #2D0B0B 0%, #120303 100%); }
.bg-area-3 { background: radial-gradient(circle at top, #0A1C2A 0%, #030914 100%); }
.bg-area-4 { background: radial-gradient(circle at top, #14002A 0%, #050010 100%); }
```

### 3.2 Glassmorphism UI（すりガラス）
背景のレイヤー感と調和し、プレミアムな質感を演出するすりガラスUIの共通CSS規格です。

```css
.glass-panel {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px) saturate(120%);
  -webkit-backdrop-filter: blur(16px) saturate(120%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

/* プレミアムなゴールドボーダー (ボス戦やレアアイテム用) */
.glass-panel-premium {
  background: rgba(255, 215, 0, 0.02);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 215, 0, 0.2);
  border-radius: 16px;
  box-shadow: 0 0 20px rgba(255, 215, 0, 0.1);
}
```

---

## 4. インタラクション＆エフェクト設計

プレイヤーの入力アクション（一筆書き）に対して、強力かつ直感的な視覚フィードバックを返します。

### 4.1 一筆書きルートの可視化 (Glowing Line)
指でなぞった軌跡（ルート）は、ネオンのように怪しく光り輝くラインで接続されます。

```css
/* ルート接続ライン (SVG path 用) */
.route-line {
  stroke: #FF007F; /* ネオンピンク */
  stroke-width: 6px;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 8px #FF007F) drop-shadow(0 0 15px rgba(255, 0, 127, 0.5));
  animation: line-flow 1.5s linear infinite;
}

@keyframes line-flow {
  0% { stroke-dashoffset: 24; }
  100% { stroke-dashoffset: 0; }
}
```

### 4.2 接続パネルの脈動エフェクト (Pulsing Panel)
ルートに含まれるパネル（踏んだタイル）は、エネルギーがチャージされたように脈動し、ネオンシャドウが明滅します。

```css
.grid-panel.selected {
  transform: scale(1.05);
  border-color: #FF007F;
  box-shadow: 0 0 15px rgba(255, 0, 127, 0.6), inset 0 0 10px rgba(255, 0, 127, 0.4);
  animation: panel-pulse 1.2s infinite ease-in-out;
  transition: transform 0.1s ease;
}

@keyframes panel-pulse {
  0%, 100% {
    transform: scale(1.05);
    filter: brightness(1);
  }
  50% {
    transform: scale(1.08);
    filter: brightness(1.3);
  }
}
```

---

## 5. 戦闘・回復アニメーション

インフレゲームに不可欠な「ド派手で気持ちいい」エフェクト群です。

### 5.1 敵撃破時の数値ポップアップ (Damage Pop-up)
敵を倒した瞬間、インフレしたダメージ数値が軽快に跳ね上がって消え去るアニメーションです。

```css
.popup-text {
  position: absolute;
  font-family: 'Outfit', sans-serif;
  font-weight: 900;
  font-size: 28px;
  text-shadow: 0 0 4px #000, 0 0 12px var(--glow-color);
  pointer-events: none;
  animation: float-up-fade 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
}

/* クリティカルダメージ (インフレ赤) */
.popup-critical {
  --glow-color: #FF3B30;
  color: #FFF;
  scale: 1.2;
}

/* 回復数値 (グリーンシャドウ) */
.popup-heal {
  --glow-color: #34C759;
  color: #E5FFE9;
}

@keyframes float-up-fade {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.6);
  }
  20% {
    opacity: 1;
    transform: translateY(0) scale(1.1);
  }
  80% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-40px) scale(0.8);
  }
}
```

### 5.2 被ダメージ時の画面フラッシュ (Screen Flash)
プレイヤーが強烈なダメージを負った際、危機感を煽る赤いフラッシュを瞬時に走らせます。

```css
.damage-flash-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(255, 0, 0, 0.25);
  pointer-events: none;
  opacity: 0;
  z-index: 999;
}

.damage-flash-active {
  animation: flash-red 0.3s ease-out;
}

@keyframes flash-red {
  0% { opacity: 1; }
  100% { opacity: 0; }
}
```

### 5.3 レベルアップ「LEVEL UP!」ネオン回転エフェクト
レベルが上がった瞬間、画面中央に巨大な「LEVEL UP!」の文字がネオンのように発光しながら、3D回転を伴って顕現します。

```css
.level-up-container {
  position: fixed;
  top: 40%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1000;
  pointer-events: none;
}

.level-up-text {
  font-family: 'Outfit', sans-serif;
  font-weight: 900;
  font-size: 48px;
  color: #FFF;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-shadow: 
    0 0 10px #00FFFF, 
    0 0 20px #00FFFF, 
    0 0 40px #007FFF;
  animation: 
    level-up-spin 2.0s cubic-bezier(0.19, 1, 0.22, 1) forwards,
    level-up-glow 1.5s infinite alternate;
}

@keyframes level-up-spin {
  0% {
    transform: scale(0.2) rotateY(270deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.1) rotateY(0deg);
    opacity: 1;
  }
  70% {
    transform: scale(1.0) rotateY(0deg);
  }
  100% {
    transform: scale(1.0) translateY(-30px);
    opacity: 0;
  }
}

@keyframes level-up-glow {
  0% {
    text-shadow: 0 0 10px #00FFFF, 0 0 20px #00FFFF, 0 0 30px #007FFF;
  }
  100% {
    text-shadow: 0 0 15px #FF00FF, 0 0 30px #FF00FF, 0 0 50px #9400D3;
  }
}
```

---

## 6. UXディテール＆音響感覚の同期

ビジュアルの強さに加え、プレイヤーの操作（触覚）と演出のシンクロ率を高めるためのUX設計方針です。

1. **触覚フィードバック（Haptic Feedback）**:
   - パネルをなぞって接続する瞬間、および敵を撃破した瞬間、モバイル端末に微細な振動（ライトタップ）を発生させます。
2. **数字のインフレ感演出**:
   - 数値の上昇速度に合わせて、フォントサイズを一時的に最大1.15倍まで「膨張」させ、元のサイズに滑らかに戻すトランジションを仕込みます。
3. **イージングの徹底**:
   - すべてのアニメーションには `ease` や `linear` ではなく、急加速・急減速を表現する `cubic-bezier(0.19, 1, 0.22, 1)` 等を多用し、ゲームとしての「キレ」を重視します。

---

本ガイドに沿ってUIコンポーネントおよびアニメーションを実装することで、プレイヤーが「遊んでいて飽きない」「強くなる爽快感が無限に感じられる」最高の体験を提供することができます。

デザイナー：私
