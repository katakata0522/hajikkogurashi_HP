const DIRECTIONS = ['up', 'right', 'down', 'left'];

const DIRECTION_LABEL = {
  up: '上',
  right: '右',
  down: '下',
  left: '左',
};

// 難易度別のゲーム設計パラメータ
const DIFFICULTY_CONFIG = {
  easy: {
    maxLives: 5,
    baseLength: 2,
    startShowMs: 850,
    startGapMs: 300,
    minShowMs: 450,
    minGapMs: 150,
    maxLessonPressure: 9, // LESSON 10で最速
  },
  normal: {
    maxLives: 3,
    baseLength: 3,
    startShowMs: 720,
    startGapMs: 260,
    minShowMs: 360,
    minGapMs: 120,
    maxLessonPressure: 13, // LESSON 14で最速
  },
  hard: {
    maxLives: 1,
    baseLength: 4,
    startShowMs: 500,
    startGapMs: 180,
    minShowMs: 240,
    minGapMs: 80,
    maxLessonPressure: 24, // LESSON 25で最速
  }
};

const STORAGE_KEY = 'kage-mane-dojo-record';
const MUTE_KEY = 'katakata-minigames-mute';
const USERNAME_KEY = 'kage-mane-dojo-username';
const DIFF_KEY = 'kage-mane-dojo-difficulty';

const state = {
  mode: 'title',
  lesson: 1,
  streak: 0,
  sequence: [],
  inputIndex: 0,
  bestLesson: 0,
  timers: [],
  isMuted: false,
  lives: 3,
  maxLives: 3,
  difficulty: 'normal',
  username: '名無しの修行者',
  
  // 果たし状（挑戦）モード用の状態
  isChallengeMode: false,
  seed: 0,
  originalSeed: 0,
  prng: null,
};

const elements = {
  titleScreen: document.getElementById('titleScreen'),
  playScreen: document.getElementById('playScreen'),
  resultScreen: document.getElementById('resultScreen'),
  startButton: document.getElementById('startButton'),
  retryButton: document.getElementById('retryButton'),
  shareButton: document.getElementById('shareButton'),
  menuButtonTitle: document.getElementById('menuButtonTitle'),
  menuButtonResult: document.getElementById('menuButtonResult'),
  bestLesson: document.getElementById('bestLesson'),
  currentStreak: document.getElementById('currentStreak'),
  lessonLabel: document.getElementById('lessonLabel'),
  progressLabel: document.getElementById('progressLabel'),
  statusText: document.getElementById('statusText'),
  master: document.getElementById('master'),
  student: document.getElementById('student'),
  directionFlash: document.getElementById('directionFlash'),
  inputPad: document.getElementById('inputPad'),
  dirButtons: Array.from(document.querySelectorAll('.dir-button')),
  resultTitle: document.getElementById('resultTitle'),
  resultLesson: document.getElementById('resultLesson'),
  rankText: document.getElementById('rankText'),
  resultComment: document.getElementById('resultComment'),
  toast: document.getElementById('toast'),
  muteButton: document.getElementById('muteButton'),
  muteIcon: document.getElementById('muteIcon'),
  certDate: document.getElementById('certDate'),
  certUser: document.getElementById('certUser'),
  usernameInput: document.getElementById('usernameInput'),
  difficultySelect: document.getElementById('difficultySelect'),
  dojoLives: document.getElementById('dojoLives'),
  
  // 果たし状用の新規要素
  challengeBanner: document.getElementById('challengeBanner'),
  certChallengeDesc: document.getElementById('certChallengeDesc'),
};

// 32bit線形合同法 (LCG) による超軽量・堅牢な疑似乱数生成器 (PRNG)
function createPrng(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// 果たし状（挑戦状）URLの安全なパースと復元
function parseChallengeUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ch = params.get('ch');
    if (!ch) return;

    // 形式: [シード値]-[難易度] (例: 87532-hard)
    const parts = ch.split('-');
    const parsedSeed = Number.parseInt(parts[0], 10);
    const parsedDiff = parts[1];

    if (Number.isFinite(parsedSeed) && parsedSeed > 0 && DIFFICULTY_CONFIG[parsedDiff]) {
      state.isChallengeMode = true;
      state.seed = parsedSeed;
      state.originalSeed = parsedSeed;
      state.difficulty = parsedDiff;

      // UIの雅なアップデート
      if (elements.challengeBanner) {
        elements.challengeBanner.classList.add('active');
        const diffJp = { easy: '初級', normal: '中級', hard: '上級' }[parsedDiff] || '中級';
        elements.challengeBanner.innerHTML = `<span>✉ 果たし状（${diffJp}・其の${parsedSeed}）が届いています</span>`;
      }
      if (elements.startButton) {
        elements.startButton.textContent = '果たし状を受ける';
      }
      updateDifficultyUi();
    }
  } catch (error) {
    // パースに失敗した場合は通常プレイ
    state.isChallengeMode = false;
  }
}

// 門下生お名前のサニタイズ（セキュリティ・XSS対策の徹底）
function sanitizeUsername(input) {
  if (!input) return '名無しの修行者';
  
  // 改行、タブ、および不要なスペースを除去
  let name = input.replace(/[\r\n\t]/g, '').trim();
  
  if (name.length === 0) {
    return '名無しの修行者';
  }
  
  // 最大8文字に強制制限
  if (name.length > 8) {
    name = name.slice(0, 8);
  }
  
  return name;
}

// 身代わり木札（ライフ）UIの動的生成
function setupLivesUi() {
  if (!elements.dojoLives) return;
  
  const cfg = DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.normal;
  state.maxLives = cfg.maxLives;
  state.lives = state.maxLives;
  
  // 木札を動的にクリアしてから新規生成
  elements.dojoLives.innerHTML = '';
  for (let i = 0; i < state.maxLives; i += 1) {
    const talisman = document.createElement('span');
    talisman.className = 'life-talisman active';
    talisman.dataset.index = i;
    talisman.textContent = '札';
    elements.dojoLives.appendChild(talisman);
  }
}

// 難易度選択ボタンUIの同期
function updateDifficultyUi() {
  if (!elements.difficultySelect) return;
  const buttons = elements.difficultySelect.querySelectorAll('.diff-btn');
  buttons.forEach((btn) => {
    const isCurrent = btn.dataset.diff === state.difficulty;
    btn.classList.toggle('active', isCurrent);
  });
}

function loadRecord() {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10);
    state.bestLesson = Number.isFinite(value) && value > 0 ? value : 0;
    
    state.isMuted = localStorage.getItem(MUTE_KEY) === 'true';
    updateMuteUi();

    // お名前のロード
    const savedName = localStorage.getItem(USERNAME_KEY);
    if (savedName) {
      state.username = sanitizeUsername(savedName);
    }
    if (elements.usernameInput) {
      elements.usernameInput.value = state.username;
    }

    // 難易度のロード
    const savedDiff = localStorage.getItem(DIFF_KEY);
    if (savedDiff && DIFFICULTY_CONFIG[savedDiff]) {
      state.difficulty = savedDiff;
    }
    updateDifficultyUi();
  } catch (error) {
    state.bestLesson = 0;
    state.isMuted = false;
    state.username = '名無しの修行者';
    state.difficulty = 'normal';
  }

  // URLの果たし状パラメータを最後に適用（ローカル保存値より優先）
  parseChallengeUrl();
}

function saveRecord() {
  try {
    localStorage.setItem(STORAGE_KEY, String(state.bestLesson));
    localStorage.setItem(MUTE_KEY, String(state.isMuted));
    localStorage.setItem(USERNAME_KEY, state.username);
    localStorage.setItem(DIFF_KEY, state.difficulty);
  } catch (error) {
    // 保存失敗でもゲームは続行
  }
}

function updateMuteUi() {
  if (elements.muteIcon) {
    // ベルマークからスピーカーマーク (🔊/🔇) に変更
    elements.muteIcon.textContent = state.isMuted ? '🔇' : '🔊';
  }
  if (elements.muteButton) {
    elements.muteButton.classList.toggle('muted', state.isMuted);
    elements.muteButton.setAttribute('aria-label', state.isMuted ? '音声を有効化' : '消音切り替え');
  }
}

function toggleMute() {
  state.isMuted = !state.isMuted;
  saveRecord();
  updateMuteUi();
  if (!state.isMuted) {
    initAudio();
  }
}

function showScreen(name) {
  elements.titleScreen.classList.toggle('active', name === 'title');
  elements.playScreen.classList.toggle('active', name === 'play');
  elements.resultScreen.classList.toggle('active', name === 'result');
}

function updateHud() {
  elements.bestLesson.textContent = state.bestLesson;
  elements.currentStreak.textContent = state.streak;
  elements.lessonLabel.textContent = state.lesson;
  elements.progressLabel.textContent = `${state.inputIndex}/${state.sequence.length}`;
}

function clearTimers() {
  state.timers.forEach((timer) => window.clearTimeout(timer));
  state.timers = [];
}

function setInputEnabled(enabled) {
  elements.dirButtons.forEach((button) => {
    button.disabled = !enabled;
  });
}

function generateSequence(length) {
  const sequence = [];
  for (let i = 0; i < length; i += 1) {
    const previous = sequence[i - 1];
    
    // 疑似乱数生成器があればそれを使用、なければ標準の乱数
    const rand = state.prng ? state.prng() : Math.random();
    let next = DIRECTIONS[Math.floor(rand * DIRECTIONS.length)];
    
    if (previous && sequence[i - 2] === previous) {
      const candidates = DIRECTIONS.filter((direction) => direction !== previous);
      const randCand = state.prng ? state.prng() : Math.random();
      next = candidates[Math.floor(randCand * candidates.length)];
    }
    sequence.push(next);
  }
  return sequence;
}

function getTiming() {
  const cfg = DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.normal;
  const pressure = Math.min(state.lesson - 1, cfg.maxLessonPressure);
  
  // 難易度に応じたテンポ加速を線形で精密計算
  const showMs = Math.max(
    cfg.minShowMs,
    cfg.startShowMs - pressure * ((cfg.startShowMs - cfg.minShowMs) / cfg.maxLessonPressure)
  );
  const gapMs = Math.max(
    cfg.minGapMs,
    cfg.startGapMs - pressure * ((cfg.startGapMs - cfg.minGapMs) / cfg.maxLessonPressure)
  );
  
  return { showMs, gapMs };
}

function clearMoveClasses(character) {
  DIRECTIONS.forEach((direction) => character.classList.remove(`move-${direction}`));
  character.classList.remove('active');
}

function flashDirection(actor, direction) {
  const button = elements.dirButtons.find((item) => item.dataset.direction === direction);
  clearMoveClasses(actor);
  actor.classList.add('active', `move-${direction}`);
  elements.directionFlash.textContent = DIRECTION_LABEL[direction];
  elements.directionFlash.classList.add('show');
  button?.classList.add('flash');

  playHyoshigi();

  window.setTimeout(() => {
    clearMoveClasses(actor);
    elements.directionFlash.classList.remove('show');
    button?.classList.remove('flash');
  }, 180);
}

function showSequence() {
  const { showMs, gapMs } = getTiming();
  state.mode = 'watching';
  setInputEnabled(false);
  elements.statusText.textContent = '師範の型を見る';
  updateHud();

  let elapsed = 520;
  state.sequence.forEach((direction, index) => {
    state.timers.push(window.setTimeout(() => {
      elements.statusText.textContent = `${index + 1}手目`;
      flashDirection(elements.master, direction);
    }, elapsed));
    elapsed += showMs + gapMs;
  });

  state.timers.push(window.setTimeout(() => {
    state.mode = 'input';
    state.inputIndex = 0;
    elements.statusText.textContent = '同じ順に打つ';
    setInputEnabled(true);
    updateHud();
  }, elapsed + 100));
}

function updateLivesUi() {
  const talismans = document.querySelectorAll('.life-talisman');
  talismans.forEach((talisman, index) => {
    talisman.classList.toggle('broken', index >= state.lives);
  });
}

function startLesson() {
  clearTimers();
  state.mode = 'watching';
  state.inputIndex = 0;
  
  // シード値を「元シード + レッスン数」で補正初期化し、常に一意かつ再現可能な譜面を生成
  const lessonSeed = state.originalSeed + state.lesson;
  state.prng = createPrng(lessonSeed);
  
  const cfg = DIFFICULTY_CONFIG[state.difficulty] || DIFFICULTY_CONFIG.normal;
  state.sequence = generateSequence(cfg.baseLength + state.lesson - 1);
  
  showScreen('play');
  updateLivesUi();
  showSequence();
}

function startGame() {
  // お名前の確定とサニタイズ（安全な値でのロード）
  if (elements.usernameInput) {
    state.username = sanitizeUsername(elements.usernameInput.value);
    elements.usernameInput.value = state.username;
  }
  
  // 挑戦モードでなければ新しいランダムシード（5〜6桁の正の整数）を生成してプレイ
  if (!state.isChallengeMode) {
    state.seed = Math.floor(Math.random() * 900000) + 100000;
    state.originalSeed = state.seed;
  } else {
    // 挑戦モードなら、ロードされたシードを最初からやり直すためにリセット
    state.seed = state.originalSeed;
  }

  setupLivesUi(); // 難易度に応じたライフ最大数とUIの同期生成
  saveRecord();

  state.lesson = 1;
  state.streak = 0;
  startLesson();
}

function completeLesson() {
  state.streak += 1;
  state.bestLesson = Math.max(state.bestLesson, state.lesson);
  saveRecord();
  state.lesson += 1;
  elements.statusText.textContent = 'よし、次の型へ';
  setInputEnabled(false);
  updateHud();

  playTaiko();

  state.timers.push(window.setTimeout(startLesson, 760));
}

function getRank(lesson) {
  if (lesson >= 15) return ['一子相伝', '師範が黙ってうなずきました。もう型が身体に入っています。'];
  if (lesson >= 12) return ['師範代', '道場にあなたの足音が残っています。'];
  if (lesson >= 9) return ['影まね名人', '見てから動くまでの迷いがかなり減っています。'];
  if (lesson >= 6) return ['無心の弟子', '型を追う目ができてきました。'];
  if (lesson >= 4) return ['道場の星', 'いい集中です。次は呼吸まで合わせましょう。'];
  if (lesson >= 2) return ['型を覚えた者', '最初の壁は越えています。'];
  return ['見習い', '師範の動きを最後まで見るところからです。'];
}

function failLesson() {
  clearTimers();
  state.mode = 'result';
  setInputEnabled(false);
  const reached = state.lesson - 1;
  const [rank, comment] = getRank(reached);
  
  elements.resultLesson.textContent = reached;
  elements.rankText.textContent = rank;
  
  if (elements.certUser) {
    // 貴殿のお名前を textContent を使って安全に挿入（XSS防止）
    elements.certUser.textContent = state.username;
  }
  
  // 果たし状の詳細を免状に動的に記載
  if (elements.certChallengeDesc) {
    if (state.isChallengeMode) {
      const diffJp = { easy: '初級', normal: '中級', hard: '上級' }[state.difficulty] || '中級';
      elements.certChallengeDesc.textContent = `※果たし状 其の${state.originalSeed}（${diffJp}）より挑戦`;
      elements.certChallengeDesc.style.display = 'block';
    } else {
      elements.certChallengeDesc.style.display = 'none';
    }
  }
  
  if (elements.certDate) {
    elements.certDate.textContent = getJapaneseDateString();
  }

  state.bestLesson = Math.max(state.bestLesson, reached);

  saveRecord();
  updateHud();
  showScreen('result');
}

// スマホ触覚フィードバック (バイブレーション) 用軽量ヘルパー
function triggerVibration(pattern) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // 一部環境のエラー回避
    }
  }
}

function handleDirection(direction) {
  if (state.mode !== 'input') return;
  const expected = state.sequence[state.inputIndex];
  
  if (direction !== expected) {
    // お手つきの演出開始：入力を即座にロック
    state.mode = 'waiting';
    clearTimers();
    setInputEnabled(false);
    
    // 1. ライフ（残機）を減少
    state.lives -= 1;
    updateLivesUi();
    
    // 2. 間違えた方向ボタンを朱赤にして震えさせる
    const pressedButton = elements.dirButtons.find((item) => item.dataset.direction === direction);
    pressedButton?.classList.add('error');
    
    // 3. 正解だった方向札をゴールドで強調表示する
    elements.directionFlash.textContent = DIRECTION_LABEL[expected];
    elements.directionFlash.classList.add('correct-hint');
    
    if (state.lives > 0) {
      // --- まだ残機（ライフ）がある場合 ---
      elements.statusText.textContent = '喝！ 型を見直しましょう';
      
      // 木札破壊音 (バキッ！) と 2回バイブレーション
      playWoodBreak();
      triggerVibration([60, 40, 60]);
      
      // 0.65秒後に答え合わせ演出を解除し、もう一度お手本を最初から再生！(修行やり直し)
      window.setTimeout(() => {
        pressedButton?.classList.remove('error');
        elements.directionFlash.classList.remove('correct-hint');
        
        // 手数をリセットしてお手本を再スタート
        state.inputIndex = 0;
        showSequence();
      }, 650);
      
    } else {
      // --- 残機（ライフ）が尽きた場合（ゲームオーバー） ---
      elements.statusText.textContent = 'そこまで！';
      
      // 最後の警告バイブレーションと、お寺の鐘「ゴーン...」を響かせる
      triggerVibration([80, 50, 80]);
      playKane();
      
      // 0.65秒後に段位認定証画面へ遷移
      window.setTimeout(() => {
        pressedButton?.classList.remove('error');
        elements.directionFlash.classList.remove('correct-hint');
        failLesson();
      }, 650);
    }
    return;
  }

  // 正解した時の演出
  flashDirection(elements.student, direction);
  triggerVibration(15); // コクッとしたタップ触覚フィードバック
  
  state.inputIndex += 1;
  updateHud();
  if (state.inputIndex >= state.sequence.length) {
    // レッスンクリアでバイブレーション (和太鼓「ドン！」とシンクロ)
    triggerVibration(85);
    completeLesson();
  }
}

async function shareResult() {
  const reached = elements.resultLesson.textContent;
  const rank = elements.rankText.textContent;
  const diffJp = { easy: '初級', normal: '中級', hard: '上級' }[state.difficulty] || '中級';
  
  // 果たし状URLの生成 (ドメインやパスを自動取得して完全なURLにする)
  const challengeUrl = `${window.location.origin}${window.location.pathname}?ch=${state.originalSeed}-${state.difficulty}`;
  
  let text = '';
  if (state.isChallengeMode) {
    text = `影まね道場にて其の${state.originalSeed}の果たし状（${diffJp}）に挑戦し、${reached}段（称号「${rank}」）まで到達！ 我の背中を追ってみよ！\n${challengeUrl}`;
  } else {
    text = `影まね道場（${diffJp}）で其の${state.originalSeed}の果たし状を生成！${reached}段（称号「${rank}」）まで到達した！ 我の型を越えられるか？\n${challengeUrl}`;
  }

  try {
    if (navigator.share) {
      await navigator.share({ title: '影まね道場', text });
      return;
    }
    await navigator.clipboard.writeText(text);
    elements.toast.classList.add('show');
    window.setTimeout(() => elements.toast.classList.remove('show'), 1400);
  } catch (error) {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

function bindEvents() {
  elements.startButton.addEventListener('click', startGame);
  elements.retryButton.addEventListener('click', startGame);
  elements.shareButton.addEventListener('click', shareResult);

  if (elements.menuButtonTitle) {
    elements.menuButtonTitle.addEventListener('click', () => {
      window.location.href = '/minigames.html';
    });
  }
  if (elements.menuButtonResult) {
    elements.menuButtonResult.addEventListener('click', () => {
      window.location.href = '/minigames.html';
    });
  }

  if (elements.muteButton) {
    elements.muteButton.addEventListener('click', toggleMute);
  }

  // 難易度選択ボタンのバインディング
  if (elements.difficultySelect) {
    elements.difficultySelect.addEventListener('click', (event) => {
      const btn = event.target.closest('.diff-btn');
      if (!btn) return;
      const diff = btn.dataset.diff;
      if (DIFFICULTY_CONFIG[diff]) {
        state.difficulty = diff;
        updateDifficultyUi();
        saveRecord();
      }
    });
  }

  // 門下生お名前入力のリアルタイム/フォーカスアウト時セーブ
  if (elements.usernameInput) {
    elements.usernameInput.addEventListener('change', () => {
      state.username = sanitizeUsername(elements.usernameInput.value);
      elements.usernameInput.value = state.username;
      saveRecord();
    });
    
    // 入力中の制限
    elements.usernameInput.addEventListener('input', () => {
      if (elements.usernameInput.value.length > 8) {
        elements.usernameInput.value = elements.usernameInput.value.slice(0, 8);
      }
    });
  }

  elements.inputPad.addEventListener('click', (event) => {
    const button = event.target.closest('[data-direction]');
    if (!button) return;
    handleDirection(button.dataset.direction);
  });

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const keyMap = {
      ArrowUp: 'up',
      w: 'up',
      W: 'up',
      ArrowRight: 'right',
      d: 'right',
      D: 'right',
      ArrowDown: 'down',
      s: 'down',
      S: 'down',
      ArrowLeft: 'left',
      a: 'left',
      A: 'left',
    };
    const direction = keyMap[event.key];
    if (!direction) return;
    
    // ゲームの入力フェーズ時のみ、デフォルト動作（ページのスクロールなど）をブロックする (UX阻害の徹底防止)
    if (state.mode === 'input') {
      event.preventDefault();
      handleDirection(direction);
    }
  });

  // フォーカス喪失時にゲームを一時停止する
  window.addEventListener('blur', pauseGame);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      pauseGame();
    }
  });
}

loadRecord();
updateHud();
setInputEnabled(false);
bindEvents();

// ==========================================
// 🔊 和風リアルタイム音響合成システム (Web Audio API)
// ==========================================
let audioCtx = null;

function initAudio() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return; // Web Audio API 非対応の環境では安全に無視 (クラッシュ防止)

  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// 拍子木の音 (カァン！) - アタック部分に超高速パルスを挿入し、木製の鋭い打撃音を表現。再生終了後は接続を切断してメモリ解放。
function playHyoshigi() {
  try {
    initAudio();
    if (!audioCtx || state.isMuted) return; // 非対応環境または消音状態では早期リターン
    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(850, now);
    osc1.frequency.exponentialRampToValueAtTime(790, now + 0.1);
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1700, now); // 高い倍音
    
    // 超高精度アタックエンベロープ（0.003秒で最大音量にし、その後指数減衰）
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.24, now + 0.003); // 鋭いアタックの瞬間
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
    
    // ガベージコレクションを徹底し、メモリリークを100%防止する明示的クリーンアップ
    window.setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      gainNode.disconnect();
    }, 200);
  } catch (e) {
    // 非対応環境エラー回避
  }
}

// 和太鼓の音 (ドン！) - ピッチを急激に降下させて胴鳴りを再現。再生後にノードを切断。
function playTaiko() {
  try {
    initAudio();
    if (!audioCtx || state.isMuted) return; // 消音ガード
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
    
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.45, now + 0.005); // 太鼓の打撃アタック
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(now + 0.45);
    
    window.setTimeout(() => {
      osc.disconnect();
      gainNode.disconnect();
    }, 500);
  } catch (e) {
    // エラー回避
  }
}

// お寺の鐘の音 (ゴーン...) - 複数の不協倍音をブレンド。再生終了後にすべての接続を解放。
function playKane() {
  try {
    initAudio();
    if (!audioCtx || state.isMuted) return; // 消音ガード
    const now = audioCtx.currentTime;
    const frequencies = [135, 202, 303, 405]; // 鐘特有 of 不協倍音
    const gainNode = audioCtx.createGain();
    
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01); // 鐘が撞かれた瞬間
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);
    gainNode.gain.connect(audioCtx.destination);
    
    const oscs = [];
    frequencies.forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(gainNode);
      osc.start();
      osc.stop(now + 2.2);
      oscs.push(osc);
    });
    
    window.setTimeout(() => {
      oscs.forEach(osc => osc.disconnect());
      gainNode.disconnect();
    }, 2400);
  } catch (e) {
    // エラー回避
  }
}

// 木札が折れる音 (バキッ！) - 三角波と鋸歯状波の高速周波数降下ブレンドで木管が破裂するような音を合成
function playWoodBreak() {
  if (state.isMuted) return;
  try {
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(160, now);
    osc1.frequency.exponentialRampToValueAtTime(10, now + 0.12);
    
    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(80, now);
    osc2.frequency.exponentialRampToValueAtTime(5, now + 0.08); // 鋸歯状波の倍音で割れ感を表現
    
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.38, now + 0.003); // 瞬間破裂アタック
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc1.start();
    osc2.start();
    osc1.stop(now + 0.15);
    osc2.stop(now + 0.15);
    
    window.setTimeout(() => {
      osc1.disconnect();
      osc2.disconnect();
      gainNode.disconnect();
    }, 250);
  } catch (e) {}
}

// 和暦漢字日付の動的生成ヘルパー (例: 令和八年 五月 二十五日)
function getJapaneseDateString() {
  const now = new Date();
  const reiwaYear = now.getFullYear() - 2018; // 2018年引きで令和に変換
  const kanjiNumbers = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '二十一', '二十二', '二十三', '二十四', '二十五', '二十六', '二十七', '二十八', '二十九', '三十', '三十一'];
  
  let yearStr;
  if (reiwaYear === 1) yearStr = '元';
  else if (reiwaYear <= 31) yearStr = kanjiNumbers[reiwaYear];
  else yearStr = String(reiwaYear);
  
  const monthStr = kanjiNumbers[now.getMonth() + 1];
  const dayStr = kanjiNumbers[now.getDate()];
  
  return `令和${yearStr}年 ${monthStr}月 ${dayStr}日`;
}

// ==========================================
// ⏸ 一時停止（ポーズ）処理システム
// ==========================================
function showPauseOverlay() {
  let overlay = document.getElementById('dojoPauseOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'dojoPauseOverlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(8, 9, 12, 0.9)';
    overlay.style.display = 'flex';
    overlay.style.flexDirection = 'column';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999';
    overlay.style.color = '#fff';
    overlay.style.cursor = 'pointer';
    overlay.innerHTML = `
      <h2 style="font-family: 'Kaisei Decol', serif; font-size: 2.2em; color: #eb5e28; margin-bottom: 12px; letter-spacing: 0.1em; text-align: center;">修行一時停止</h2>
      <p style="font-size: 0.9em; color: #a0aec0; letter-spacing: 0.05em; text-align: center;">画面に触れて修行を再開</p>
    `;
    overlay.addEventListener('click', resumeFromPause);
    elements.playScreen.appendChild(overlay);
  }
}

function removePauseOverlay() {
  const overlay = document.getElementById('dojoPauseOverlay');
  if (overlay) {
    overlay.remove();
  }
}

function pauseGame() {
  if (state.mode === 'watching' || state.mode === 'input') {
    clearTimers();
    state.mode = 'paused';
    setInputEnabled(false);
    elements.statusText.textContent = '一時停止中';
    showPauseOverlay();
  }
}

function resumeFromPause() {
  if (state.mode === 'paused') {
    removePauseOverlay();
    // 師範のお手本からやり直す
    startLesson();
  }
}
