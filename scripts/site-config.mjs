// 共通ヘッダー・ナビゲーションの元データ（PR #52 の仕組みから、ナビ部分だけを取り込み）
// 変更したら `npm run sync:site` で 10 ページに反映し、`npm run test:site` で同期漏れを確認する。
export const sitePages = ['index.html', 'aboutus.html', 'portfolio.html', 'minigames.html', 'news.html', 'members.html', 'coming-soon.html', 'privacy-policy.html', 'terms-of-service.html', '404.html'];
// ラベルは PR #52 のもの（既存メニューとの違いは OVERNIGHT_NOTES.md に記録）
export const navigation = [
  { label: 'わたしたち', page: 'aboutus.html', section: 'about' },
  { label: 'つくるもの', page: 'portfolio.html', section: 'works' },
  { label: 'いますぐあそぶ', page: 'minigames.html', section: 'play' },
  { label: '活動の記録', page: 'news.html', section: 'journal' },
  { label: 'メンバー', page: 'members.html', section: 'people' },
  { label: 'お問い合わせ', section: 'contact' },
];
export function navigationMarkup(page) {
  const home = page === 'index.html';
  // このブランチのトップには PR #52 の #about などの区切りが無いので、各ページへの通常リンクにする。
  // お問い合わせはトップの #contact（includes/contact-section.php）へ。
  const href = entry => entry.page ? `/${entry.page}` : (home ? '#contact' : '/#contact');
  const current = entry => entry.page === page ? ' aria-current="page"' : '';
  const link = entry => `<a href="${href(entry)}"${current(entry)}>${entry.label}</a>`;
  return `<!-- site-nav:start -->
    <header class="site-header" id="site-header">
      <a class="brand" href="/" aria-label="Corner Neighbor トップに戻る">
        <span class="brand-symbol" aria-hidden="true"><i></i><b></b><em></em></span>
        <span class="brand-name">corner<span>neighbor</span><small>はじっこぐらし</small></span>
      </a>
      <nav class="desktop-nav" aria-label="メインナビゲーション">
        ${navigation.filter(entry => !['play', 'contact'].includes(entry.section)).map(link).join('')}
      </nav>
      <div class="header-actions">
        <a class="header-play" href="${href(navigation[2])}"${current(navigation[2])}>あそぶ <span aria-hidden="true">↗</span></a>
        <button class="menu-toggle" type="button" aria-controls="mobile-menu" aria-expanded="false" aria-label="メニューを開く">
          <span class="menu-toggle-lines" aria-hidden="true"><i></i><i></i></span><span class="menu-toggle-text">MENU</span>
        </button>
      </div>
    </header>
    <nav class="mobile-menu" id="mobile-menu" aria-label="モバイルメニュー" inert>
      <div class="mobile-menu-inner">
        <p>WHERE TO?</p>
${home ? '' : '<a href="/"><span aria-hidden="true">00</span> ホームへ</a>'}
        ${navigation.map((entry, i) => `<a href="${href(entry)}"${current(entry)}><span aria-hidden="true">0${i + 1}</span> ${entry.label}</a>`).join('\n        ')}
        <div class="mobile-menu-bottom">なんでもない日を、ちょっと面白く。</div>
      </div>
    </nav>
    <!-- site-nav:end -->`;
}
