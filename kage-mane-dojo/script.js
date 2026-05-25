const DIRECTIONS = ['up', 'right', 'down', 'left'];

const DIRECTION_LABEL = {
  up: '上',
  right: '右',
  down: '下',
  left: '左',
};

const CONFIG = {
  baseLength: 3,
  minShowMs: 360,
  minGapMs: 120,
  startShowMs: 720,
  startGapMs: 260,
};

const STORAGE_KEY = 'kage-mane-dojo-record';
const MUTE_KEY = 'kage-mane-dojo-mute';

const state = {
  mode: 'title',
  lesson: 1,
  streak: 0,
  sequence: [],
  inputIndex: 0,
  bestLesson: 0,
  timers: [],
  isMuted: false, // ミュート状態管理
};

const elements = {
  titleScreen: document.getElementById('titleScreen'),
  playScreen: document.getElementById('playScreen'),
  resultScreen: document.getElementById('resultScreen'),
  startButton: document.getElementById('startButton'),
  retryButton: document.getElementById('retryButton'),
  shareButton: document.getElementById('shareButton'),
  bestLesson: document.getElementById('bestLesson'),
  currentStreak: document.getElementById('currentStreak'),
  lessonLabel: document.getElementById('lessonLabel'),
  lengthLabel: document.getElementById('lengthLabel'),
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
};

function loadRecord() {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10);
    state.bestLesson = Number.isFinite(value) && value > 0 ? value : 0;
    
    // ミュート状態のロード
    state.isMuted = localStorage.getItem(MUTE_KEY) === 'true';
    updateMuteUi();
  } catch (error) {
    state.bestLesson = 0;
    state.isMuted = false;
  }
}

function saveRecord() {
  try {
    localStorage.setItem(STORAGE_KEY, String(state.bestLesson));
    localStorage.setItem(MUTE_KEY, String(state.isMuted));
  } catch (error) {
    // 記録保存に失敗してもゲームは続ける。
  }
}

function updateMuteUi() {
  if (elements.muteIcon) {
    elements.muteIcon.textContent = state.isMuted ? '🔕' : '🔔';
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
  // ミュート解除時はAudioContextをアクティブ化
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
  elements.lengthLabel.textContent = state.sequence.length;
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
    let next = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    if (previous && sequence[i - 2] === previous) {
      const candidates = DIRECTIONS.filter((direction) => direction !== previous);
      next = candidates[Math.floor(Math.random() * candidates.length)];
    }
    sequence.push(next);
  }
  return sequence;
}

function getTiming() {
  const pressure = Math.min(state.lesson - 1, 14);
  return {
    showMs: Math.max(CONFIG.minShowMs, CONFIG.startShowMs - pressure * 24),
    gapMs: Math.max(CONFIG.minGapMs, CONFIG.startGapMs - pressure * 8),
  };
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

  // 拍子木の音 (カァン！) を鳴らす
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

function startLesson() {
  clearTimers();
  state.mode = 'watching';
  state.inputIndex = 0;
  state.sequence = generateSequence(CONFIG.baseLength + state.lesson - 1);
  showScreen('play');
  showSequence();
}

function startGame() {
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

  // レッスンクリア時に太鼓 (ドン！) を鳴らす
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
  elements.resultTitle.textContent = reached > 0 ? '稽古終了' : 'お手つき';
  elements.resultLesson.textContent = reached;
  elements.rankText.textContent = rank;
  elements.resultComment.textContent = comment;
  state.bestLesson = Math.max(state.bestLesson, reached);

  // お手つきの瞬間に鐘はすでに鳴らしているため、ここでは重複防止で呼出を削除
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
    // 答え合わせ演出の開始：入力を即座にロック
    state.mode = 'waiting';
    clearTimers();
    setInputEnabled(false);
    
    // 1. 間違えた方向ボタンを朱赤にして震えさせる
    const pressedButton = elements.dirButtons.find((item) => item.dataset.direction === direction);
    pressedButton?.classList.add('error');
    
    // 2. 正解だった方向札をゴールドで強調表示する
    elements.directionFlash.textContent = DIRECTION_LABEL[expected];
    elements.directionFlash.classList.add('correct-hint');
    
    // 3. 警告の2連続バイブレーション
    triggerVibration([50, 40, 50]);
    
    // 4. お手つきの瞬間に鐘「ゴーン...」を響かせる
    playKane();
    
    // 5. 0.45秒後にリザルトへ安全に遷移
    window.setTimeout(() => {
      pressedButton?.classList.remove('error');
      elements.directionFlash.classList.remove('correct-hint');
      failLesson();
    }, 450);
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
  const text = `影まね道場で${elements.resultLesson.textContent}段まで到達！ 称号「${elements.rankText.textContent}」\nhttps://hajikkoroom.xsrv.jp/kage-mane-dojo/`;
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

  if (elements.muteButton) {
    elements.muteButton.addEventListener('click', toggleMute);
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
