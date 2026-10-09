/*
 * minigame-audio-lifecycle.js
 * ミニゲーム共通: 効果音（Web Audio）の「止まったまま鳴らなくなる」問題への対策（2026-10）
 *
 * - スマホ（特に iPhone）では、別アプリや別タブから戻ると AudioContext が
 *   ブラウザによって一時停止され、そのまま音が出なくなることがある。
 *   → 次に画面をタップ／キー入力したときに自動で再開する。
 * - タブを隠したら音を止め、戻ったら（ブラウザが止めた分だけ）再開する。
 * - ゲーム側が「ミュート」や「一時停止」のために自分で suspend() したものは再開しない。
 *
 * 各ゲームの音の鳴らし方は変えず、AudioContext の作成だけを見守る小さな部品。
 * ゲーム本体のスクリプトより前に読み込むこと。
 */
(function (window, document) {
  'use strict';

  var Native = window.AudioContext || window.webkitAudioContext;
  if (typeof Native !== 'function' || window.__minigameAudioLifecycle) return;

  var contexts = [];
  var GESTURES = ['pointerdown', 'touchend', 'keydown', 'click'];

  function track(ctx) {
    if (!ctx || contexts.indexOf(ctx) !== -1) return;
    contexts.push(ctx);
    var nativeSuspend = ctx.suspend;
    var nativeResume = ctx.resume;
    // ゲームが画面表示中に自分で止めた（ミュート・一時停止）かどうかを覚えておく
    ctx.suspend = function () {
      if (document.visibilityState === 'visible') ctx.__keepSuspended = true;
      return nativeSuspend.apply(ctx, arguments);
    };
    ctx.resume = function () {
      ctx.__keepSuspended = false;
      return nativeResume.apply(ctx, arguments);
    };
  }

  function canAutoResume(ctx) {
    return !ctx.__keepSuspended && (ctx.state === 'suspended' || ctx.state === 'interrupted');
  }

  function resumeAll() {
    if (document.visibilityState !== 'visible') return;
    for (var i = 0; i < contexts.length; i += 1) {
      var ctx = contexts[i];
      if (!canAutoResume(ctx)) continue;
      try {
        var p = Function.prototype.call.call(Object.getPrototypeOf(ctx).resume, ctx);
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (_) { /* 再開できない環境では何もしない */ }
    }
  }

  function suspendAllForHidden() {
    for (var i = 0; i < contexts.length; i += 1) {
      var ctx = contexts[i];
      if (ctx.state !== 'running') continue;
      try {
        var p = Function.prototype.call.call(Object.getPrototypeOf(ctx).suspend, ctx);
        if (p && typeof p.catch === 'function') p.catch(function () {});
      } catch (_) { /* noop */ }
    }
  }

  function Tracked() {
    // new AudioContext(options) と同じ引数でそのまま作る
    var ctx = Reflect.construct(Native, arguments, new.target || Tracked);
    track(ctx);
    return ctx;
  }
  Tracked.prototype = Native.prototype;
  Object.setPrototypeOf(Tracked, Native);

  // 書き換えできない環境（テストや一部ブラウザ）でもエラーにしない
  function install(name) {
    if (!window[name]) return;
    try {
      Object.defineProperty(window, name, { value: Tracked, configurable: true, writable: true });
    } catch (_) {
      try { window[name] = Tracked; } catch (__) { /* そのまま（見守りなし）で動かす */ }
    }
  }
  install('AudioContext');
  install('webkitAudioContext');

  for (var g = 0; g < GESTURES.length; g += 1) {
    window.addEventListener(GESTURES[g], resumeAll, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') suspendAllForHidden();
    else resumeAll();
  });
  window.addEventListener('pageshow', resumeAll);

  window.__minigameAudioLifecycle = {
    contexts: contexts,
    resumeAll: resumeAll,
    suspendAllForHidden: suspendAllForHidden,
  };
})(window, document);
