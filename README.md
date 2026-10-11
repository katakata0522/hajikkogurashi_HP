# Corner Neighbor公式サイト

このリポジトリは、`HTML + CSS + JavaScript` だけで管理する静的サイトです。  
今後は **Jekyll 用の `.md` や `_includes` は触らず**、公開用の `html` を直接編集します。

## まず触る場所

- `index.html`
  トップページ
- `aboutus.html`
  私たちについて
- `members.html`
  メンバー紹介
- `news.html`
  お知らせ
- `portfolio.html`
  作品一覧
- `coming-soon.html`
  制作中ページ
- `privacy-policy.html`
  プライバシーポリシー
- `terms-of-service.html`
  利用規約
- `404.html`
  404ページ

## デザインを変える場所

- `assets/css/main.css`
  従来の下層ページで使う共通デザイン（新トップは独立したV2）
- `assets/css/home-v2.css`
  新トップページ（V2）専用のレスポンシブデザイン
- `assets/css/site-navigation.css` / `assets/js/site-navigation.js`
  トップと下層ページの共通ヘッダー・モバイルメニュー・フォーカス制御
- `assets/css/portfolio.css`
  作品一覧ページ専用の見た目
- `assets/images/`
  画像
- `assets/js/`
  メニューや演出などのJavaScript

## 更新の基本手順

1. 編集したい `html` を直接開いて内容を直す
2. 必要なら `assets/css/*.css` で見た目を調整する
3. ローカル確認をする
4. スモークテストを実行する
5. サーバーへ反映する

## ローカル確認

このサイトは `/aboutus.html` のような絶対パスを使っているため、ファイルを直接ダブルクリックするより、ローカルサーバーで見る方が安全です。

PowerShell で次を実行します。

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-preview.ps1
```

起動後は `http://localhost:8000/` をブラウザで開きます。

## 動作確認コマンド

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\static-site-smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\home-asset-smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\structure-smoke-test.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\local-reference-check.ps1
```

## 反映時の考え方

Xserver に置くのは、基本的にこのリポジトリ直下の静的ファイルです。

- `*.html`
- `assets/`
- `.nojekyll`

逆に、以下は公開先へ置く必要がありません。

- `.github/`
- `scripts/`
- `README.md`
- `CONTRIBUTING.md`
- `LICENSE.md`
- `.gitignore`

## 補足

旧 Jekyll ソース一式は、このリポジトリの外へ退避済みです。  
必要になった場合は、ローカルバックアップか Git 履歴から戻せます。

## 新トップの公開前確認（V2）

- `index.html` は PHP/Jekyll に依存せず、`home-v2.css` と共通 `site-navigation.css` / `site-navigation.js` を外部読み込みします。
- `scripts/home-asset-smoke-test.ps1` はV2のナビ、セクション、メニュー、連絡先、参照を検査します。
- 作品名・メンバーの紹介・ゲームリンクは、既存の公開ページを確認してから更新してください。架空のゲームを実績として載せないでください。
- 下層ページの本文・カードと各ゲームは既存レイアウトを維持しています。共通ヘッダーとページ末尾の活動リンクだけを段階的に統一しました。`home-v2.css` を下層ページに読み込まないでください。
- 公開後に本番のスマホ・PCで `#about`、`#works`、`#play`、`#journal`、`#people`、`#contact` とモバイルメニューの動作を確認します。

## 共通導線とキャッシュの更新

- ナビの文言・リンク・現在地は `scripts/site-config.mjs` で管理します。HTMLには静的に展開するため、ブラウザ側の生成に依存しません。
- HTML、CSS、JSを編集したら `npm run sync:site` を実行して変更をコミットします。各ファイルの原本バイトのSHA-256先頭12桁をURLに付けます。CSSとJSは別々の内容ハッシュです。
- `npm run test:site` はナビの同期と正確な内容ハッシュを検査します。コメント、template、重複、古いURL、無効な読み込みでは通りません。
- `npm run test:site:browser` は6画面幅×10ページ、メニュー・キーボード・アンカー・再訪キャッシュを実Chromeで検査します。`CHROME_PATH` で実行ファイルを指定できます。任意の `SITE_SCREENSHOT_DIR` へ画面を出力します。
- `.htaccess` はサイトの通常の入口HTMLだけを `no-cache` にします。ゲームディレクトリとCSS/JSの既存キャッシュ方針は維持します。
- 公開後は `npm run verify:site:live` で通常URLのHTML再検証、資産のHTTP状態・MIME・全SHA-256一致を確認します。ローカルの模擬HTTP成功は本番設定の証拠になりません。
- PR #51の漢字スライサー資産検査は `versioned-assets.mjs` を共用し、スケジューラー順序の追加条件と既存回帰ケースを維持します。
- Draft中のActionsスキップを維持します。Readyにする前にローカル回帰と公開準備を確認し、実機・Xserver検証が終わるまでマージしません。
