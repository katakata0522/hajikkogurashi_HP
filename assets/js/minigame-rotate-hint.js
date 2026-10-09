/*
 * 縦画面向けミニゲーム用: スマホを横向きにした時だけ「縦向きにしてね」と案内する。
 * - 判定は「タッチ操作が主」かつ「横向き」かつ「高さ 500px 以下」（＝横向きのスマホ）
 * - 「このまま遊ぶ」でいつでも閉じられる（遊ぶのを妨げない）
 * - パソコンやタブレットでは何も表示しない
 */
(function () {
    'use strict';
    if (!window.matchMedia || !document.body) return;

    var query = window.matchMedia('(orientation: landscape) and (max-height: 500px) and (pointer: coarse)');
    var dismissed = false;
    var hint = null;

    function build() {
        hint = document.createElement('div');
        hint.className = 'cn-rotate-hint';
        hint.setAttribute('role', 'dialog');
        hint.setAttribute('aria-modal', 'false');
        hint.setAttribute('aria-labelledby', 'cn-rotate-hint-title');

        var box = document.createElement('div');
        box.className = 'cn-rotate-hint__box';

        var icon = document.createElement('div');
        icon.className = 'cn-rotate-hint__icon';
        icon.setAttribute('aria-hidden', 'true');

        var title = document.createElement('p');
        title.id = 'cn-rotate-hint-title';
        title.className = 'cn-rotate-hint__title';
        title.textContent = 'スマホを縦向きにして遊んでね';

        var note = document.createElement('p');
        note.className = 'cn-rotate-hint__note';
        note.textContent = 'このゲームは縦画面向けに作られています。';

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'cn-rotate-hint__button';
        button.textContent = 'このまま遊ぶ';
        button.addEventListener('click', function () {
            dismissed = true;
            update();
        });

        box.appendChild(icon);
        box.appendChild(title);
        box.appendChild(note);
        box.appendChild(button);
        hint.appendChild(box);
        document.body.appendChild(hint);
    }

    function update() {
        var show = query.matches && !dismissed;
        if (show && !hint) build();
        if (hint) hint.classList.toggle('is-visible', show);
    }

    if (query.addEventListener) query.addEventListener('change', update);
    else if (query.addListener) query.addListener(update);
    update();
})();
