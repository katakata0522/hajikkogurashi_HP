<?php
// 現在のファイルパスから動的に戻り先URLを判定（安全対策込み）
$current_script = $_SERVER['SCRIPT_NAME'] ?? '/';
$allowed_redirect_paths = array(
    '/',
    '/index.html',
    '/aboutus.html',
    '/portfolio.html'
);

$safe_return_to = '/';
foreach ($allowed_redirect_paths as $path) {
    if (strpos($current_script, $path) !== false) {
        // 例: /index.html や /aboutus.html に部分一致、または完全一致した場合
        // Xserver等でディレクトリトップの場合は / になるため / も許可
        $safe_return_to = $path;
        break;
    }
}
// index.htmlはルートパス / にマッピング
if ($safe_return_to === '/index.html') {
    $safe_return_to = '/';
}
?>
		<!-- Contact -->
		<section id="contact">
			<div class="inner">
				<section class="contact-panel contact-panel--form">
					<header class="major">
						<h2>お問い合わせ</h2>
					</header>
					<form action="/contact.php" method="POST" class="contact-form">
						<div class="field half first">
							<label for="name">お名前</label>
							<input type="text" name="name" id="name" autocomplete="name" required />
						</div>
						<div class="field half">
							<label for="email"><span class="required-mark">※</span>メールアドレス</label>
							<input type="email" name="_replyto" id="email" autocomplete="email" inputmode="email" placeholder="例：example@mail.com" required />
						</div>
						<div class="field">
							<label for="message">お問い合わせ内容</label>
							<textarea name="message" id="message" rows="6" required></textarea>
						</div>
						<input type="hidden" name="return_to" value="<?php echo htmlspecialchars($safe_return_to, ENT_QUOTES, 'UTF-8'); ?>" />
						<div style="display:none;">
							<label for="company">会社名</label>
							<input type="text" name="company" id="company" tabindex="-1" autocomplete="off" />
						</div>
						<ul class="actions">
							<li><input type="submit" value="送信する" class="special" /></li>
							<li><input type="reset" value="入力をリセット" /></li>
						</ul>
					</form>
					<p>フォームが送信できない場合は、<a href="mailto:hajikkogurashi.official@gmail.com">メール</a>でもご連絡いただけます。</p>
				</section>

				<section class="split contact-panel contact-panel--info">
					<section>
						<div class="contact-method">
							<span class="icon alt fa-envelope"></span>
							<h3>メール</h3>
							<a href="mailto:hajikkogurashi.official@gmail.com">hajikkogurashi.official@gmail.com</a>
						</div>
					</section>

					<section>
						<div class="contact-method">
							<span class="icon alt fa-home"></span>
							<h3>拠点</h3>
							<span>日本のどこかのはじっこ</span>
						</div>
					</section>

					<section>
						<div class="contact-method contact-method--social">
							<span class="icon alt fa-share-alt"></span>
							<h3>SNS</h3>
							<ul class="icons social-links">
								<li class="social-links__item">
									<a href="https://note.com/hajikkogurashi01" class="icon alt fa-sticky-note-o" target="_blank" rel="noopener noreferrer" aria-label="note" title="note">
										<span class="label">note</span>
									</a>
								</li>
								<li class="social-links__item">
									<a href="https://x.com/Corner_neighbor" class="icon alt fa-twitter" target="_blank" rel="noopener noreferrer" aria-label="X" title="X">
										<span class="label">X</span>
									</a>
								</li>
								<li class="social-links__item">
									<a href="https://www.youtube.com/@hajikkogurashi" class="icon alt fa-youtube-play" target="_blank" rel="noopener noreferrer" aria-label="YouTube" title="YouTube">
										<span class="label">YouTube</span>
									</a>
								</li>
							</ul>
						</div>
					</section>
				</section>
			</div>
		</section>
