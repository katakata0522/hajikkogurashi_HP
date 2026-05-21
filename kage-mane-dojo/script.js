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

const state = {
  mode: 'title',
  lesson: 1,
  streak: 0,
  sequence: [],
  inputIndex: 0,
  bestLesson: 0,
  timers: [],
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
};

function loadRecord() {
  try {
    const value = Number.parseInt(localStorage.getItem(STORAGE_KEY), 10);
    state.bestLesson = Number.isFinite(value) && value > 0 ? value : 0;
  } catch (error) {
    state.bestLesson = 0;
  }
}

function saveRecord() {
  try {
    localStorage.setItem(STORAGE_KEY, String(state.bestLesson));
  } catch (error) {
    // 記録保存に失敗してもゲームは続ける。
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
  saveRecord();
  updateHud();
  showScreen('result');
}

function handleDirection(direction) {
  if (state.mode !== 'input') return;
  flashDirection(elements.student, direction);
  const expected = state.sequence[state.inputIndex];
  if (direction !== expected) {
    failLesson();
    return;
  }

  state.inputIndex += 1;
  updateHud();
  if (state.inputIndex >= state.sequence.length) {
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
    event.preventDefault();
    handleDirection(direction);
  });
}

loadRecord();
updateHud();
setInputEnabled(false);
bindEvents();
