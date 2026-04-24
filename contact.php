<?php
declare(strict_types=1);

mb_language('Japanese');
mb_internal_encoding('UTF-8');

const CONTACT_EMAIL = 'hajikkogurashi.official@gmail.com';
const CONTACT_FROM = 'webform@hajikkoroom.xsrv.jp';
const CONTACT_SUBJECT = '【はじっこぐらし公式サイト】お問い合わせ';

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
  <title>{$safeTitle}</title>
  <style>
    body { font-family: sans-serif; background: #f7f7f7; color: #222; margin: 0; }
    main { max-width: 720px; margin: 48px auto; padding: 24px; background: #fff; border-radius: 16px; box-shadow: 0 12px 32px rgba(0,0,0,.08); }
    h1 { margin-top: 0; font-size: 1.8rem; }
    p { line-height: 1.8; }
    a.button { display: inline-block; margin-top: 16px; padding: 12px 18px; background: #1f6feb; color: #fff; text-decoration: none; border-radius: 999px; }
  </style>
</head>
<body>
  <main>
    <h1>{$safeTitle}</h1>
    <p>{$safeMessage}</p>
    <a class="button" href="{$safeReturnTo}#contact">前のページに戻る</a>
  </main>
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
        '/portfolio.html'
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
    'はじっこぐらし公式サイトのお問い合わせ',
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
