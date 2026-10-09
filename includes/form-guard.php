<?php
/**
 * お問い合わせフォームの迷惑送信対策（共通処理）
 *
 * - フォーム表示時刻に署名を付け、早すぎる送信（ボット）と古すぎる送信を見分ける
 * - 同じ接続元からの短時間の連続送信を制限する
 *
 * 秘密鍵とカウンターは公開フォルダの外（無理なら一時フォルダ）に保存する。
 * どちらにも書けない環境では、署名チェックと回数制限だけを諦めて動作を続ける。
 */
declare(strict_types=1);

if (!defined('HAJIKKO_FORM_GUARD')) {
    define('HAJIKKO_FORM_GUARD', true);

    function formGuardDir(): ?string
    {
        static $dir = false;
        if ($dir !== false) {
            return $dir;
        }
        $candidates = array();
        $docRoot = $_SERVER['DOCUMENT_ROOT'] ?? '';
        if ($docRoot !== '') {
            $candidates[] = dirname(rtrim($docRoot, '/')) . '/.hajikko-form';
        }
        $candidates[] = rtrim(sys_get_temp_dir(), '/') . '/hajikko-form-' . substr(hash('sha256', __DIR__), 0, 12);
        foreach ($candidates as $candidate) {
            if (is_dir($candidate) || @mkdir($candidate, 0700, true)) {
                if (is_writable($candidate)) {
                    return $dir = $candidate;
                }
            }
        }
        return $dir = null;
    }

    function formGuardSecret(): ?string
    {
        $dir = formGuardDir();
        if ($dir === null) {
            return null;
        }
        $file = $dir . '/secret';
        $secret = @file_get_contents($file);
        if (is_string($secret) && strlen($secret) >= 32) {
            return $secret;
        }
        $secret = bin2hex(random_bytes(32));
        if (@file_put_contents($file, $secret, LOCK_EX) === false) {
            return null;
        }
        @chmod($file, 0600);
        return $secret;
    }

    /** フォームに埋め込む「表示時刻＋署名」を作る。 */
    function formGuardIssueToken(): string
    {
        $time = (string) time();
        $secret = formGuardSecret();
        if ($secret === null) {
            return $time . '.nosig';
        }
        return $time . '.' . hash_hmac('sha256', $time, $secret);
    }

    /**
     * 送られてきたトークンを確認する。
     * 戻り値: 'ok' / 'too_fast' / 'expired' / 'invalid'
     */
    function formGuardCheckToken(string $token, int $minSeconds = 3, int $maxSeconds = 86400): string
    {
        if (!preg_match('/^(\d{9,11})\.([a-f0-9]{64}|nosig)$/', $token, $m)) {
            return 'invalid';
        }
        $issued = (int) $m[1];
        $secret = formGuardSecret();
        if ($secret !== null) {
            if ($m[2] === 'nosig' || !hash_equals(hash_hmac('sha256', $m[1], $secret), $m[2])) {
                return 'invalid';
            }
        }
        $age = time() - $issued;
        if ($age < $minSeconds) {
            return 'too_fast';
        }
        if ($age > $maxSeconds) {
            return 'expired';
        }
        return 'ok';
    }

    /** 同じ接続元からの送信回数を数え、上限を超えたら false。 */
    function formGuardAllowRate(string $clientKey, int $limit = 5, int $windowSeconds = 900): bool
    {
        $dir = formGuardDir();
        if ($dir === null) {
            return true;
        }
        $file = $dir . '/rate-' . hash('sha256', $clientKey) . '.json';
        $handle = @fopen($file, 'c+');
        if ($handle === false) {
            return true;
        }
        try {
            flock($handle, LOCK_EX);
            $raw = stream_get_contents($handle);
            $stamps = json_decode($raw === false ? '' : $raw, true);
            $now = time();
            $stamps = array_values(array_filter(is_array($stamps) ? $stamps : array(), static function ($t) use ($now, $windowSeconds) {
                return is_int($t) && $t > $now - $windowSeconds;
            }));
            if (count($stamps) >= $limit) {
                return false;
            }
            $stamps[] = $now;
            ftruncate($handle, 0);
            rewind($handle);
            fwrite($handle, json_encode($stamps));
            return true;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }
}
