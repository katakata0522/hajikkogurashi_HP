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
  サイト全体の共通デザイン
- `assets/css/index.css`
  トップページ専用の見た目
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

## HTMLとPHPの境界

現行トップ・旧トップともにメールアプリから連絡できます。公開サイトにはPHPを配置しません。
旧PHPのURLは`.htaccess`の303転送で静的な連絡先・お知らせへ案内します。
`.html` / `.htm` をPHPへ渡すAddHandlerは不要です。

`node scripts/html-php-boundary-smoke-test.mjs` でPHPファイル・HTML内PHP・旧送信先の再混入とメール導線を検査します。
`node scripts/mail-contact-browser-test.mjs` は320/390/1365pxとJavaScript無効時の連絡導線を確認します。
旧PHPの原本は公開対象外の `docs/retired-php-20261022.md` とGit履歴に保持しています。
復元が必要ならPHP廃止PR全体を作業ブランチでrevertし、CI合格後に通常のXserverデプロイで反映します。
