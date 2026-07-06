<?php
declare(strict_types=1);

mb_language('Japanese');
mb_internal_encoding('UTF-8');

const CONTACT_EMAIL = 'hajikkogurashi.official@gmail.com';
const CONTACT_FROM = 'webform@hajikkoroom.xsrv.jp';
const CONTACT_SUBJECT = '【Corner Neighbor公式サイト】お問い合わせ';

/**
 * 日本語を含む最小限の確認ページを返す。
 */
function renderPage(string $title, string $message, string $returnTo, int $statusCode): never
{
    http_response_code($statusCode);
    $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
    $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));
    $safeReturnTo = htmlspecialchars($returnTo, ENT_QUOTES, 'UTF-8');

    echo <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{$safeTitle} | Corner Neighbor</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Source+Sans+Pro:300,600&display=swap">
  <style>
    body {
      font-family: "Source Sans Pro", sans-serif;
      background-color: #242943;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      box-sizing: border-box;
    }
    header {
      background-color: #2a2f4a;
      box-shadow: 0 0 0.25em 0 rgba(0, 0, 0, 0.15);
      padding: 1.5rem;
      text-align: center;
    }
    .logo-text {
      color: #ffffff;
      font-size: 1.2rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-decoration: none;
    }
    main {
      flex-grow: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem 1.5rem;
    }
    .card {
      background-color: #2a2f4a;
      max-width: 600px;
      width: 100%;
      padding: 3rem 2.5rem;
      border-radius: 4px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      text-align: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    h1 {
      font-size: 2rem;
      font-weight: 600;
      margin-top: 0;
      margin-bottom: 1.5rem;
      letter-spacing: 0.05em;
    }
    h1::after {
      content: "";
      display: block;
      width: 80px;
      height: 2px;
      background-color: #9bf1ff;
      margin: 0.8rem auto 0 auto;
    }
    p {
      line-height: 1.8;
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.85);
      margin-bottom: 2rem;
    }
    a.button {
      display: inline-block;
      box-shadow: inset 0 0 0 2px #ffffff;
      color: #ffffff;
      text-decoration: none;
      font-size: 0.8rem;
      font-weight: 600;
      height: 3.5rem;
      line-height: 3.5rem;
      padding: 0 2.2rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, color 0.2s ease-in-out, transform 0.2s ease;
    }
    a.button:hover {
      box-shadow: inset 0 0 0 2px #9bf1ff;
      color: #9bf1ff;
      background-color: rgba(155, 241, 255, 0.05);
      transform: translateY(-2px);
    }
    a.button:active {
      transform: translateY(1px);
    }
    footer {
      padding: 2rem;
      text-align: center;
      font-size: 0.8rem;
      color: rgba(255, 255, 255, 0.5);
      background-color: #242943;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <header>
    <a href="/" class="logo-text">Corner Neighbor</a>
  </header>
  <main>
    <div class="card">
      <h1>{$safeTitle}</h1>
      <p>{$safeMessage}</p>
      <a class="button" href="{$safeReturnTo}#contact">前のページに戻る</a>
    </div>
  </main>
  <footer>
    © 2024-2026 Corner Neighbor
  </footer>
</body>
</html>
HTML;
    exit;
}

/**
 * 戻り先はサイト内の既知ページだけに限定する。
 */
function resolveReturnTo(mixed $value): string
{
    $allowedPaths = array(
        '/',
        '/aboutus.html',
        '/portfolio.html',
        '/members.html',
        '/news.html',
        '/minigames.html',
        '/coming-soon.html'
    );

    if (!is_string($value)) {
        return '/';
    }

    $normalized = trim($value);
    if ($normalized === '') {
        return '/';
    }

    return in_array($normalized, $allowedPaths, true) ? $normalized : '/';
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    renderPage('不正なアクセスです', 'このページはお問い合わせフォームの送信専用です。', '/', 405);
}

$returnTo = resolveReturnTo($_POST['return_to'] ?? '/');
$honeypot = trim((string)($_POST['company'] ?? ''));

if ($honeypot !== '') {
    renderPage('送信を受け付けました', 'お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご連絡します。', $returnTo, 200);
}

$name = trim((string)($_POST['name'] ?? ''));
$email = trim((string)($_POST['_replyto'] ?? ''));
$message = trim((string)($_POST['message'] ?? ''));

if ($name === '' || $email === '' || $message === '') {
    renderPage('入力内容をご確認ください', 'お名前・メールアドレス・お問い合わせ内容は必須です。', $returnTo, 400);
}

if (mb_strlen($name) > 100 || mb_strlen($message) > 5000) {
    renderPage('入力内容をご確認ください', '入力文字数が上限を超えています。', $returnTo, 400);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    renderPage('メールアドレスをご確認ください', 'メールアドレスの形式が正しくありません。', $returnTo, 400);
}

if (preg_match('/[\r\n]/', $name) || preg_match('/[\r\n]/', $email)) {
    renderPage('入力内容をご確認ください', '不正な改行を含む入力は送信できません。', $returnTo, 400);
}

$body = implode("\n", array(
    'Corner Neighbor公式サイトのお問い合わせ',
    '送信元ページ: ' . $returnTo,
    '送信日時: ' . date('Y-m-d H:i:s'),
    '',
    'お名前:',
    $name,
    '',
    'メールアドレス:',
    $email,
    '',
    'お問い合わせ内容:',
    $message,
));

$headers = implode("\r\n", array(
    'From: ' . CONTACT_FROM,
    'Reply-To: ' . $email,
    'Content-Type: text/plain; charset=UTF-8',
));

$subject = mb_encode_mimeheader(CONTACT_SUBJECT, 'UTF-8');
$sent = mb_send_mail(CONTACT_EMAIL, $subject, $body, $headers);

if (!$sent) {
    renderPage('送信に失敗しました', "現在フォームから送信できません。\nお手数ですがメールからご連絡ください。", $returnTo, 500);
}

renderPage('送信を受け付けました', 'お問い合わせありがとうございます。内容を確認のうえ、必要に応じてご連絡します。', $returnTo, 200);
