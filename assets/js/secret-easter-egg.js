/**
 * Corner Neighbor - Secret Easter Egg & Midnight Mode
 * 1. コナミコマンド (↑ ↑ ↓ ↓ ← → ← → B A) で隠し開発室 (/secret.html) へワープ
 * 2. スマホ用隠しトリガー (フッターのCorner Neighborロゴを5回連続タップ)
 * 3. 深夜モード (0:00 - 4:59) でフッターに「🌙 MIDNIGHT // 深夜開発中」が点灯
 */
(function() {
  'use strict';

  // 1. 深夜モード判定 (0:00 - 4:59)
  function initMidnightMode() {
    try {
      const now = new Date();
      const hour = now.getHours();
      if (hour >= 0 && hour < 5) {
        const midnightBadge = document.getElementById('footer-midnight-badge');
        if (midnightBadge) {
          midnightBadge.style.display = 'inline-flex';
        }
      }
    } catch (e) {}
  }

  // 2. コナミコマンド (↑ ↑ ↓ ↓ ← → ← → B A)
  const konamiCode = [
    'ArrowUp', 'ArrowUp',
    'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight',
    'ArrowLeft', 'ArrowRight',
    'b', 'a'
  ];
  let konamiIndex = 0;

  window.addEventListener('keydown', function(e) {
    // フォーム入力中は除外
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

    const key = e.key;
    const expected = konamiCode[konamiIndex];

    if (key.toLowerCase() === expected.toLowerCase()) {
      konamiIndex++;
      if (konamiIndex === konamiCode.length) {
        konamiIndex = 0;
        triggerSecretWarp();
      }
    } else {
      konamiIndex = (key.toLowerCase() === 'arrowup') ? 1 : 0;
    }
  });

  // 3. スマホ用隠しトリガー (フッターロゴを5回タップ)
  function initSecretMobileTrigger() {
    const trigger = document.getElementById('footer-secret-trigger');
    if (!trigger) return;

    let tapCount = 0;
    let lastTapTime = 0;

    trigger.addEventListener('click', function(e) {
      const now = Date.now();
      if (now - lastTapTime < 800) {
        tapCount++;
      } else {
        tapCount = 1;
      }
      lastTapTime = now;

      if (tapCount >= 5) {
        e.preventDefault();
        tapCount = 0;
        triggerSecretWarp();
      }
    });
  }

  // 4. シークレットワープ演出 (グリーンCRTフラッシュ ＆ 画面遷移)
  function triggerSecretWarp() {
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100vw';
    flash.style.height = '100vh';
    flash.style.background = '#22c55e';
    flash.style.zIndex = '99999';
    flash.style.opacity = '0.9';
    flash.style.transition = 'opacity 0.25s ease';
    flash.style.pointerEvents = 'none';
    document.body.appendChild(flash);

    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => {
        if (flash.parentNode) flash.parentNode.removeChild(flash);
        window.location.href = '/secret.html';
      }, 200);
    }, 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initMidnightMode();
      initSecretMobileTrigger();
    });
  } else {
    initMidnightMode();
    initSecretMobileTrigger();
  }
})();
