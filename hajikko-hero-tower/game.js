(function () {
  'use strict';

  // ─── ゲームの数値・ギミック定数 ───
  const GameConfig = {
    gridSize: 5,
    maxFloor: 50,
    baseFeverDuration: 6, // ✅ フィーバーの継続ターン数（3→6に延長: 稀少にした分、発動時の達成感を確保）
    upgrades: {
      hp: { initialCost: 100, scale: 1.48, maxLv: 50, rate: 0.20 },
      atk: { initialCost: 150, scale: 1.48, maxLv: 50, rate: 0.15 },
      potion: { initialCost: 300, scale: 1.48, maxLv: 5, rate: 1 },
      gold: { initialCost: 200, scale: 1.48, maxLv: 30, rate: 0.10 },
      key: { initialCost: 1000, scale: 1.48, maxLv: 3, rate: 1 }
    }
  };

  const SAVE_KEY = "HAJIKKO_HERO_TOWER_SAVE_v2.2.1"; // ✅ v2.2.1: NaNバグによるセーブ汚染のクリアのためバンプ
  const XOR_KEY = 0x7E;
  const canvas = document.getElementById("neon-canvas");
  const ctx = canvas.getContext("2d");
  let _feverGradCache = null; // ✅ フィーバーグラデーションキャッシュ（毎フレームのオブジェクト生成を防止）
  
  // 🎇 v3.0.0 新規: ネオンパーティクルシステム (v3.2.2 隠しクラス最適化 ＆ 寿命ベース上書きアルゴリズム)
  class Particle {
    constructor() {
      this.active = false;
      this.x = 0;
      this.y = 0;
      this.vx = 0;
      this.vy = 0;
      this.size = 0;
      this.color = '#fff';
      this.alpha = 0;
      this.decay = 0;
      this.gravity = 0;
    }
  }

  class Shockwave {
    constructor() {
      this.active = false;
      this.x = 0;
      this.y = 0;
      this.radius = 0;
      this.maxRadius = 0;
      this.alpha = 0;
      this.color = '#fff';
      this.speed = 0;
    }
  }

  const PARTICLE_POOL_SIZE = 300;
  const SHOCKWAVE_POOL_SIZE = 30;
  
  const particlePool = Array.from({ length: PARTICLE_POOL_SIZE }, () => new Particle());
  const shockwavePool = Array.from({ length: SHOCKWAVE_POOL_SIZE }, () => new Shockwave());

  function spawnParticles(x, y, type = 'pink', count = 5) {
    let colors = ['#ff007f', '#ff00ff', '#ffffff']; // デフォルトはピンク
    if (type === 'fever') colors = ['#00ffff', '#00ff00', '#ff00ff', '#ffffff'];
    else if (type === 'heal') colors = ['#2ecc71', '#a3e4d7', '#ffffff'];
    else if (type === 'atk') colors = ['#f1c40f', '#f39c12', '#ffffff'];
    else if (type === 'shield') colors = ['#00bfff', '#87cefa', '#ffffff'];
    else if (type === 'error') colors = ['#ff3b30', '#ff0055', '#ffffff'];
    else if (type === 'towel') colors = ['#fc6767', '#ec008c', '#ffffff'];

    const initParticle = (p) => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.0 + Math.random() * 3.5;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 0.5;
      p.size = 2.0 + Math.random() * 4;
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.alpha = 1.0;
      p.decay = 0.015 + Math.random() * 0.02;
      p.gravity = 0.04;
    };

    // 1. パーティクルをプールから割り当て
    let spawnedCount = 0;
    for (let i = 0; i < PARTICLE_POOL_SIZE && spawnedCount < count; i++) {
      const p = particlePool[i];
      if (!p.active) {
        initParticle(p);
        spawnedCount++;
      }
    }

    // 空きスロットが不足している場合は、アルファ値（残り寿命）の低いアクティブ要素を上書き
    if (spawnedCount < count) {
      // 割り当て速度優先でループ探索（ソート負荷を回避するため簡易線形探索）
      for (let attempt = 0; attempt < (count - spawnedCount); attempt++) {
        let oldestIdx = -1;
        let minAlpha = 1.1;
        for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
          if (particlePool[i].active && particlePool[i].alpha < minAlpha) {
            minAlpha = particlePool[i].alpha;
            oldestIdx = i;
          }
        }
        if (oldestIdx !== -1) {
          initParticle(particlePool[oldestIdx]);
          spawnedCount++;
        }
      }
    }

    // 2. 衝撃波（輪っか）をプールから1つ割り当て
    let waveColor = '#ff007f';
    if (type === 'fever') waveColor = '#00ffff';
    else if (type === 'heal') waveColor = '#2ecc71';
    else if (type === 'atk') waveColor = '#f1c40f';
    else if (type === 'shield') waveColor = '#00bfff';
    else if (type === 'error') waveColor = '#ff3b30';
    else if (type === 'towel') waveColor = '#ec008c';

    const initShockwave = (w) => {
      w.active = true;
      w.x = x;
      w.y = y;
      w.radius = 5;
      w.maxRadius = 45 + Math.random() * 15;
      w.alpha = 1.0;
      w.color = waveColor;
      w.speed = 2.5;
    };

    let waveSpawned = false;
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      const w = shockwavePool[i];
      if (!w.active) {
        initShockwave(w);
        waveSpawned = true;
        break;
      }
    }

    // 空きがない場合は一番消えかかっている衝撃波を上書き
    if (!waveSpawned) {
      let oldestIdx = -1;
      let minAlpha = 1.1;
      for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
        if (shockwavePool[i].active && shockwavePool[i].alpha < minAlpha) {
          minAlpha = shockwavePool[i].alpha;
          oldestIdx = i;
        }
      }
      if (oldestIdx !== -1) {
        initShockwave(shockwavePool[oldestIdx]);
      }
    }
  }

  function hasActiveParticlesOrShockwaves() {
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      if (particlePool[i].active) return true;
    }
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      if (shockwavePool[i].active) return true;
    }
    return false;
  }

  function updateAndDrawParticles() {
    if (!hasActiveParticlesOrShockwaves()) return;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // 1. 衝撃波の更新と描画
    for (let i = 0; i < SHOCKWAVE_POOL_SIZE; i++) {
      const w = shockwavePool[i];
      if (!w.active) continue;

      w.radius += w.speed;
      w.alpha = 1.0 - (w.radius / w.maxRadius);

      if (w.radius >= w.maxRadius || w.alpha <= 0) {
        w.active = false;
        continue;
      }

      ctx.beginPath();
      ctx.arc(w.x, w.y, w.radius, 0, Math.PI * 2);
      ctx.strokeStyle = w.color;
      ctx.lineWidth = 3 * w.alpha;
      ctx.globalAlpha = w.alpha;
      ctx.shadowBlur = 12;
      ctx.shadowColor = w.color;
      ctx.stroke();
    }

    // 2. 普通のパーティクルの更新と描画
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
      const p = particlePool[i];
      if (!p.active) continue;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.alpha -= p.decay;

      const currentSize = p.size * p.alpha;
      if (p.alpha <= 0 || currentSize <= 0.1) {
        p.active = false;
        continue;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.fill();
    }
    ctx.restore();
  }


  // DFSソルバー用の静的定数
  const DIRS = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];

  // 🔒 セーブデータ保護 (XOR + Base64)
  // ✅ v2.2修正: encryptとdecryptで同一キー(XOR_KEY固定)を使い、
  //    encodeURIComponent→XOR→btoa の順で処理してラウンドトリップを保証する
  function encryptData(str) {
    const encoded = encodeURIComponent(str); // マルチバイト文字を安全なASCIIに変換
    const key = XOR_KEY;                     // 固定キーで暗号化・復号を一致させる
    let xored = "";
    const len = encoded.length;
    for (let i = 0; i < len; i++) {
      xored += String.fromCharCode(encoded.charCodeAt(i) ^ key);
    }
    return btoa(xored);
  }

  function decryptData(str) {
    try {
      const xored = atob(str);   // base64デコード
      const key = XOR_KEY;       // 同じ固定キーで復号
      let encoded = "";
      const len = xored.length;
      for (let i = 0; i < len; i++) {
        encoded += String.fromCharCode(xored.charCodeAt(i) ^ key);
      }
      return decodeURIComponent(encoded); // URIデコードして元のJSON文字列を復元
    } catch(e) {
      return null;
    }
  }

  // Web Audio API 音響管理 (自動生成BGMを廃止し、手触り向上のためのSE再生に特化)
  const AudioManager = {
    ctx: null,
    seGainNode: null,

    init() {
      if (this.ctx === null) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
        this.seGainNode = this.ctx.createGain();
        this.seGainNode.connect(this.ctx.destination);
        this.setVolumes();
      }
    },

    setVolumes() {
      if (!this.seGainNode) return;
      this.seGainNode.gain.setValueAtTime(0.08, this.ctx.currentTime);
    },

    playSound(type, chain = 1) {
      recordInteraction();
      const mode = state.settings.audioMode;
      if (mode === 0) return;
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended' || this.ctx.state === 'interrupted') {
        this.ctx.resume().catch(() => {});
      }

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(this.seGainNode);

      let duration = 0.15;

      if (type === 'connect') {
        // ✅ なぞりコンボ数(chain)が増えるごとに音程を1半音ずつ引き上げる (ドレミ...)
        const semitone = chain - 1;
        const startFreq = 261.63 * Math.pow(1.059463, semitone); // C4(261.63Hz)から半音ずつ上昇
        const endFreq = startFreq * 1.8;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        gain.gain.linearRampToValueAtTime(0, now + 0.12);
        duration = 0.12;
      } else if (type === 'disconnect') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(250, now + 0.06);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        duration = 0.1;
      } else if (type === 'heal') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.05);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        duration = 0.3;
      } else if (type === 'atk') {
        // ⚡ チェインコンボに応じたピッチスライドSE効果（chainはデフォルト引数で受け取る）
        const pitchShift = 1.0 + (chain - 1) * 0.15;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120 * pitchShift, now);
        osc.frequency.exponentialRampToValueAtTime(80 * pitchShift, now + 0.15);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        duration = 0.2;
      } else if (type === 'hit') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(40, now + 0.22);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        gain.gain.linearRampToValueAtTime(0, now + 0.28);
        duration = 0.28;
      } else if (type === 'level_up') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(261.63, now);
        osc.frequency.setValueAtTime(329.63, now + 0.06);
        osc.frequency.setValueAtTime(392.00, now + 0.12);
        osc.frequency.setValueAtTime(523.25, now + 0.18);
        osc.frequency.setValueAtTime(659.25, now + 0.24);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        osc.frequency.setValueAtTime(1046.50, now + 0.36);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        gain.gain.linearRampToValueAtTime(0, now + 0.55);
        duration = 0.55;
      } else if (type === 'buy') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        duration = 0.15;
      } else if (type === 'clear') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.08);
        osc.frequency.setValueAtTime(783.99, now + 0.16);
        osc.frequency.setValueAtTime(1046.50, now + 0.24);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        gain.gain.linearRampToValueAtTime(0, now + 0.45);
        duration = 0.45;
      } else if (type === 'gameover') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(50, now + 0.6);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        gain.gain.linearRampToValueAtTime(0, now + 0.7);
        duration = 0.7;
      } else if (type === 'fever') {
        // 🔥 フィーバー専用ファンファーレSE
        osc.type = 'square';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.05);
        osc.frequency.setValueAtTime(659, now + 0.1);
        osc.frequency.setValueAtTime(880, now + 0.15);
        osc.frequency.setValueAtTime(1108, now + 0.2);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        gain.gain.linearRampToValueAtTime(0, now + 0.45);
        duration = 0.45;
      }

      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch(e){}
      };

      osc.start(now);
      osc.stop(now + duration);
    }
  };

  // ─── デフォルトのゲーム状態テンプレート ───
  const defaultState = {
    floor: 1,
    gold: 0,
    key: 0, // ✅ NaNバグ修正: 初期値テンプレートにkeyが抜けていたため、ロードデータが無いとNaNに汚染されていた
    totalGoldEarned: 0,
    permanentUpgrades: {
      hp: 0,
      atk: 0,
      potion: 0,
      gold: 0,
      key: 0
    },
    hero: {
      level: 1,
      exp: 0,
      hp: 100,
      maxHp: 100,
      atk: 10
    },
    artifacts: {
      fang: false,
      hourglass: false, // ⌛ 15Fボスドロップ
      boots: false,     // 🪽 20Fボスドロップ
      towel: false,     // 🧣 25Fボスドロップ
      sword: false,     // ⚔️ 30Fボスドロップ
      chalice: false    // 🏆 40Fボスドロップ
    },
    feverGauge: 0,
    isFever: false,
    feverTurns: 0,
    loopCount: 1,
    hasRevivedThisFloor: false,
    floorStartBackup: null, // 時の砂時計用フロアバックアップ
    // 🏆 統計システム
    stats: {
      totalKills: 0,
      totalTurns: 0,
      bestFloor: 1,
      feverCount: 0,
      comboRecord: 0
    },
    settings: {
      audioMode: 1,
      currentSkin: 'area-1',
      lastSaveTime: Date.now()
    }
  };

  // ⚡ ディープマージ
  function deepMerge(target, source) {
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
    return target;
  }

  // 🔒 状態セッター層における負数の自動クリップ
  function createReactiveState(target, onDirty) {
    // ✅ WeakMapキャッシュ: 同じオブジェクトへのアクセスごとに新規Proxyを生成する問題を解決
    const proxyCache = new WeakMap();
    const handler = {
      get(obj, prop) {
        const val = obj[prop];
        if (val !== null && typeof val === 'object') {
          if (!proxyCache.has(val)) {
            proxyCache.set(val, new Proxy(val, handler));
          }
          return proxyCache.get(val);
        }
        return val;
      },
      set(obj, prop, value) {
        if (['hp', 'gold', 'key', 'exp', 'floor'].includes(prop) && typeof value === 'number') {
          // ✅ NaNが代入されようとした場合は0にフォールバックして耐性を強化
          value = isNaN(value) ? 0 : Math.max(0, value);
        }
        if (prop === 'feverGauge' && typeof value === 'number') {
          value = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
        }
        if (obj[prop] !== value) {
          obj[prop] = value;
          onDirty();
        }
        return true;
      }
    };
    return new Proxy(target, handler);
  }

  // リアクティブ状態
  const state = createReactiveState(structuredClone(defaultState), () => {
    UIManager.isDirty = true;
  });

  // 主要ローカル変数
  let gridData = [];
  let pathTracker = null;
  let cellBoundsCache = [];
  let lastUserInteractionTime = performance.now(); // ✅ performance.nowで統一（mainLoopのtimestampと同単位）
  let gameStarted = false;

  // DOMキャッシュ
  const dom = {};
  function initDOMCache() {
    dom.gameContainer = document.getElementById("game-container");
    dom.gridSectionWrap = document.querySelector(".grid-section-wrap"); // ✅ パフォーマンス最適化: キャッシュ化
    dom.floorDisplay = document.getElementById("floor-display");
    dom.goldDisplay = document.getElementById("gold-display");
    dom.keyDisplay = document.getElementById("key-display");
    
    dom.heroLevel = document.getElementById("hero-level");
    dom.expBarFill = document.getElementById("exp-bar-fill");
    dom.expText = document.getElementById("exp-text");
    dom.heroHp = document.getElementById("hero-hp");
    dom.heroMaxHp = document.getElementById("hero-max-hp");
    dom.heroAtk = document.getElementById("hero-atk");
    dom.hpBarFill = document.getElementById("hp-bar-fill");
    dom.hpBarPrediction = document.getElementById("hp-bar-prediction");
    dom.hpBarContainer = document.getElementById("hp-bar-container");

    dom.predictedDamage = document.getElementById("predicted-damage");
    dom.predictedExp = document.getElementById("predicted-exp");
    dom.predictedGold = document.getElementById("predicted-gold");
    dom.battleLogView = document.getElementById("battle-log-view");
    dom.battleLogText = document.getElementById("battle-log-text");
    dom.previewDefaultView = document.getElementById("preview-default-view");

    dom.gridContainer = document.getElementById("grid-container");
    dom.floatingTextContainer = document.getElementById("floating-text-container");
    dom.damageFlash = document.getElementById("damage-flash");
    dom.levelUpOverlay = document.getElementById("level-up-overlay");

    dom.shopModal = document.getElementById("shop-modal");
    dom.shopGoldAmount = document.getElementById("shop-gold-amount");
    dom.retryBtn = document.getElementById("retry-btn");
    
    dom.clearModal = document.getElementById("clear-modal");
    dom.clearFloorLabel = document.getElementById("clear-floor-label");
    dom.nextFloorLabel = document.getElementById("next-floor-label");
    dom.nextFloorBtn = document.getElementById("next-floor-btn");

    dom.victoryModal = document.getElementById("victory-modal");
    dom.victoryLevel = document.getElementById("victory-level");
    dom.victoryGold = document.getElementById("victory-gold");
    dom.victoryUpgrades = document.getElementById("victory-upgrades");
    dom.victoryResetBtn = document.getElementById("victory-reset-btn");

    dom.startOverlay = document.getElementById("start-overlay");
    dom.startPlayBtn = document.getElementById("start-play-btn");
    dom.dragGuideHand = document.getElementById("drag-guide-hand");
    dom.soundBtn = document.getElementById("sound-btn");

    dom.artFang = document.getElementById("art-fang");
    dom.artHourglass = document.getElementById("art-hourglass");
    dom.artBoots = document.getElementById("art-boots");
    dom.artTowel = document.getElementById("art-towel");
    dom.artSword = document.getElementById("art-sword");
    dom.artChalice = document.getElementById("art-chalice");
    dom.artifactSlots = document.getElementById("artifact-slots");

    dom.feverBarFill = document.getElementById("fever-bar-fill");
    dom.feverText = document.getElementById("fever-text");
    dom.feverOverlay = document.getElementById("fever-overlay");

    // ✅ ショップDOMキャッシュ（updateUpgradeModalUIの毎回 getElementById 庞止）
    dom.shopDescs = {};
    dom.shopBtns  = {};
    ['hp', 'atk', 'potion', 'gold', 'key'].forEach(k => {
      dom.shopDescs[k] = document.getElementById(`shop-desc-${k}`);
      dom.shopBtns[k]  = document.getElementById(`shop-btn-${k}`);
    });

    // 💻 PC専用サイドパネルDOM
    dom.pcShopGold = document.getElementById("pc-shop-gold");
    dom.pcShopDescs = {};
    dom.pcStatusLvs = {};
    dom.pcStatusProgresses = {};
    ['hp', 'atk', 'potion', 'gold', 'key'].forEach(k => {
      dom.pcShopDescs[k] = document.getElementById(`pc-shop-desc-${k}`);
      dom.pcStatusLvs[k] = document.getElementById(`pc-status-lv-${k}`);
      dom.pcStatusProgresses[k] = document.getElementById(`pc-status-progress-${k}`);
    });

    dom.statKills = document.getElementById("stat-kills");
    dom.statTurns = document.getElementById("stat-turns");
    dom.statCombo = document.getElementById("stat-combo");
    dom.statFever = document.getElementById("stat-fever");
    dom.pcLogTerminal = document.getElementById("pc-log-terminal");

    // 📱 スマホ専用ドラッグプレビューDOM
    dom.mobileDragPreview = document.getElementById("mobile-drag-preview");
    dom.dragPreviewIcon = document.getElementById("drag-preview-icon");
    dom.dragPreviewHp = document.getElementById("drag-preview-hp");
    
    // index.htmlの重複id 'hero-level' のうち、ステータス表示用に新設した 'hero-level-display' も登録
    dom.heroLevelDisplay = document.getElementById("hero-level-display");
  }

  // 💻 PC用リアルタイムログ出力ヘルパー
  function writeTerminalLog(msg, type = 'system') {
    if (!dom.pcLogTerminal) return;
    const line = document.createElement("div");
    line.className = `terminal-line ${type}-msg`;
    line.innerHTML = `<span class="log-prompt">&gt;</span> ${msg}`;
    dom.pcLogTerminal.appendChild(line);
    
    if (dom.pcLogTerminal.children.length > 15) {
      dom.pcLogTerminal.children[0].remove();
    }
    dom.pcLogTerminal.scrollTop = dom.pcLogTerminal.scrollHeight;
  }

  // 💡 戦闘計算の共通化
  function calculateBattle(heroAtk, hasSwordBuff, cell) {
    const swordMultiplier = state.artifacts.sword ? 2.5 : 1.8;
    const feverAtkMultiplier = state.isFever ? 2.0 : 1.0;
    
    const enemyAtk = cell.val.atk;
    const currentAtk = Math.floor(heroAtk * (hasSwordBuff ? swordMultiplier : 1.0) * feverAtkMultiplier);
    
    let dmg = 0;
    if (currentAtk < enemyAtk) {
      dmg = (enemyAtk - currentAtk) * (cell.type === 'boss' ? 2 : 1);
    }

    // ✅ シールド（バリア）ギミック: 剣バフが無いモンスター攻撃時は被ダメージが2倍
    if (cell.val && cell.val.shield && !hasSwordBuff) {
      dmg = dmg === 0 ? 10 : dmg * 2; // 無傷の場合でもシールド抵抗で最低10ダメ
    }

    const goldMul = (1.0 + (state.permanentUpgrades.gold * GameConfig.upgrades.gold.rate)) * (state.isFever ? 3.0 : 1.0);
    const gold = Math.floor(cell.val.gold * goldMul);
    const exp = cell.val.exp;

    return { dmg, gold, exp };
  }

  // 🔒 安全チェックサム生成
  function generateChecksum(str) {
    let hash = 0;
    const salt = "hajikko_hero_tower_salt_v1.7";
    const saltedStr = str + salt;
    const len = saltedStr.length;
    for (let i = 0; i < len; i++) {
      hash = (hash << 5) - hash + saltedStr.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36) + "_secure";
  }

  function getAreaPitchMultiplier() {
    if (state.settings.currentSkin === 'area-2') return 1.15;
    if (state.settings.currentSkin === 'area-3') return 0.85;
    if (state.settings.currentSkin === 'area-4') return 1.3;
    return 1.0;
  }

  // ─── 一筆書き追跡アルゴリズム ───
  class PathTracker {
    constructor() {
      this.path = [];
      this.isDragging = false;
      this.warpPairsUsed = new Set();
      this.warpLocked = false;      // ⚡ ワープ直後の空中移動ガード用ロック
      this.warpTargetIdx = -1;      // ⚡ 空中移動の目的地インデックス
    }

    start(idx) {
      recordInteraction();
      const cell = gridData[idx];
      if (!cell || cell.type !== 'hero') return false;

      this.path = [idx];
      this.isDragging = true;
      this.warpPairsUsed.clear();
      this.warpLocked = false;
      this.warpTargetIdx = -1;
      
      cacheCellBounds();
      
      AudioManager.playSound('connect', this.path.length);
      return true;
    }

    moveTo(idx) {
      if (!this.isDragging) return false;

      // ⚡ ワープ直後ロック時の挙動: 物理的な指がジャンプ先ワープセル上に到着するまで他セルへの接続を完全にブロック
      if (this.warpLocked) {
        if (idx === this.warpTargetIdx) {
          this.warpLocked = false; // 物理的にワープ先に到着したのでロック解除
          this.warpTargetIdx = -1;
          AudioManager.playSound('connect', this.path.length);
        }
        return false;
      }

      const len = this.path.length;
      if (len === 0) return false;

      const currIdx = this.path[len - 1];
      const prevIdx = len > 1 ? this.path[len - 2] : null;

      if (currIdx === idx) return false;

      if (prevIdx !== null && prevIdx === idx) {
        const currentCell = gridData[currIdx];
        if (currentCell && currentCell.type === 'warp') {
          const pairName = currentCell.val;
          this.warpPairsUsed.delete(pairName);
        }

        // 戻り（Backtrack）時はロックをリセット
        this.warpLocked = false;
        this.warpTargetIdx = -1;

        this.path.pop();
        AudioManager.playSound('disconnect');
        simulatePathEffects();
        return true;
      }

      if (this.path.includes(idx)) return false;

      const cx = currIdx % 5;
      const cy = Math.floor(currIdx / 5);
      const tx = idx % 5;
      const ty = Math.floor(idx / 5);
      const dx = Math.abs(tx - cx);
      const dy = Math.abs(ty - cy);

      if (dx + dy !== 1) return false;

      // ✅ 空セル通過を許可（DFSソルバーと一貫性を保つ）
      // 空セルは「何もない床」として通過可能。effectはexecutePath内でスキップされる
      const targetCell = gridData[idx];

      // ✅ エラー時の明滅＋揺れアニメーションをパネルに付与するヘルパー
      function triggerPanelError(idx) {
        const panels = dom.gridContainer.children;
        const panel = panels[idx];
        if (panel) {
          panel.classList.remove("panel-error-shake");
          void panel.offsetWidth; // リフロー強制でアニメーションを再起動
          panel.classList.add("panel-error-shake");
          AudioManager.playSound('disconnect');
          
          // パーティクルを赤色で噴出
          const bounds = cellBoundsCache[idx];
          if (bounds) {
            const cx = (bounds.left + bounds.right) / 2 - dom.gameContainer.getBoundingClientRect().left - window.pageXOffset;
            const cy = (bounds.top + bounds.bottom) / 2 - dom.gameContainer.getBoundingClientRect().top - window.pageYOffset;
            spawnParticles(cx, cy, 'error', 6);
          }

          setTimeout(() => {
            panel.classList.remove("panel-error-shake");
          }, 400);
        }
      }

      if (targetCell && targetCell.type === 'door') {
        const sim = simulatePathDetails();
        if (sim.keys < 1) {
          triggerPanelError(idx); // ✅ 鍵不足時のエラーフィードバック
          showToast("扉を開けるには🔑鍵が必要です！");
          return false;
        }
      }
      if (targetCell && targetCell.type === 'chest') {
        const sim = simulatePathDetails();
        if (sim.keys < 1) {
          triggerPanelError(idx); // ✅ 鍵不足時のエラーフィードバック
          showToast("宝箱を開けるには🔑鍵が必要です！");
          return false;
        }
      }

      this.path.push(idx);
      AudioManager.playSound('connect', this.path.length);

      if (targetCell && targetCell.type === 'warp') {
        const pairName = targetCell.val;
        if (!this.warpPairsUsed.has(pairName)) {
          const otherWarpIdx = gridData.findIndex((c, i) => i !== idx && c && c.type === 'warp' && c.val === pairName);
          if (otherWarpIdx !== -1) {
            this.warpPairsUsed.add(pairName);
            this.path.push(otherWarpIdx);
            AudioManager.playSound('connect', this.path.length);
          }
        }
      }

      simulatePathEffects();
      return true;
    }

    end() {
      const finalPath = [...this.path];
      this.isDragging = false;
      this.path = [];
      this.warpPairsUsed.clear();
      return finalPath;
    }
  }

  function cacheCellBounds() {
    cellBoundsCache = [];
    const panels = dom.gridContainer.children;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const len = panels.length;

    for (let i = 0; i < len; i++) {
      const rect = panels[i].getBoundingClientRect();
      cellBoundsCache.push({
        left: rect.left + scrollX,
        right: rect.right + scrollX,
        top: rect.top + scrollY,
        bottom: rect.bottom + scrollY
      });
    }
  }

  // ⚡ チェイン数に応じたコンボ倍率の計算（段階的スケール - 6体以上を狙う意義を作る）
  function getChainMultiplier(kills) {
    if (kills <= 1) return 1.0;
    if (kills === 2) return 1.15;
    if (kills === 3) return 1.35;
    if (kills === 4) return 1.60;
    if (kills === 5) return 1.90;
    return Math.min(3.5, 1.0 + kills * 0.45); // 6連以上は段階的スケール（上限3.5倍）
  }

  // ─── 経路シミュレーション ───
  function simulatePathDetails() {
    let hp = state.hero.hp;
    let maxHp = state.hero.maxHp;
    let atk = state.hero.atk;
    let level = state.hero.level;
    let exp = state.hero.exp;
    let keys = state.key;
    let goldGained = 0;
    let expGained = 0;
    
    let hasSwordBuff = false;
    let killCount = 0;
    const path = pathTracker ? pathTracker.path : [];

    // ✅ ライトニング・チェイン判定: 経路上の敵が5体以上なら被ダメ20%軽減が発動
    const monsterCount = path.filter(idx => {
      const c = gridData[idx];
      return c && (c.type === 'monster' || c.type === 'boss');
    }).length;
    const isLightning = monsterCount >= 5;

    path.forEach(idx => {
      const cell = gridData[idx];
      if (!cell) return;

      if (cell.type === 'monster' || cell.type === 'boss') {
        killCount++;
        const chainMul = getChainMultiplier(killCount);
        const result = calculateBattle(atk, hasSwordBuff, cell);
        
        // ✅ 必殺効果: 被ダメージを20%軽減
        let dmg = result.dmg;
        if (isLightning) {
          dmg = Math.floor(dmg * 0.8);
        }
        hp -= dmg;
        
        if (state.artifacts.fang && hp > 0) {
          hp = Math.min(maxHp, hp + Math.floor(maxHp * 0.03));
        }
        goldGained += Math.floor(result.gold * chainMul);
        expGained += Math.floor(result.exp * chainMul);
        
        if (cell.type === 'boss') keys++;
      }
      else if (cell.type === 'potion') {
        const recover = Math.floor(maxHp * 0.30);
        hp = Math.min(maxHp, hp + recover);
      }
      else if (cell.type === 'sword') {
        hasSwordBuff = true;
      }
      else if (cell.type === 'trap') {
        if (state.isFever) {
          goldGained += Math.floor(maxHp * 0.05);
        } else {
          const trapRate = state.artifacts.towel ? 0 : (state.artifacts.boots ? 0.05 : 0.15);
          hp -= Math.floor(maxHp * trapRate);
        }
      }
      else if (cell.type === 'key') {
        keys++;
      }
      else if (cell.type === 'chest') {
        keys--;
        const goldBase = Math.floor(8 * Math.pow(1.22, state.floor - 1)) + 5;
        const goldMul = 1.0 + (state.permanentUpgrades.gold * GameConfig.upgrades.gold.rate);
        let gained = Math.floor(goldBase * 5 * goldMul);
        
        if (state.artifacts.chalice) gained *= 2;
        if (state.isFever) gained *= 3;
        
        goldGained += gained;
      }
      else if (cell.type === 'door') {
        keys--;
      }
    });

    let nextExp = Math.round(10 * Math.pow(level, 1.4));
    let simExp = exp + expGained;
    let simLevel = level;
    let simMaxHp = maxHp;
    let simAtk = atk;

    while (simExp >= nextExp && hp > 0) { // ✅ hp>0ガード: 死亡状態での無限ループを防止
      simExp -= nextExp;
      simLevel++;
      simMaxHp = Math.round(100 * Math.pow(simLevel, 1.2) + (simLevel - 1) * 15);
      simAtk = Math.round(10 * Math.pow(simLevel, 1.1) + (simLevel - 1) * 3);
      hp = simMaxHp; // ⚡ レベルアップ時に100%全回復！
      nextExp = Math.round(10 * Math.pow(simLevel, 1.4));
    }

    return {
      hp: Math.max(0, hp),
      maxHp: simMaxHp,
      atk: simAtk,
      level: simLevel,
      exp: simExp,
      keys: keys,
      goldGained: goldGained,
      expGained: expGained,
      damageTaken: state.hero.hp - hp
    };
  }

  // リアルタイム予測値の更新 ＆ 盤面上の数値予測バッジの動的反映
  // リアルタイム予測値の更新 ＆ 盤面上の数値予測バッジの動的反映
  function simulatePathEffects() {
    const sim = simulatePathDetails();
    
    dom.predictedDamage.textContent = Math.max(0, sim.damageTaken).toLocaleString();
    dom.predictedExp.textContent = `+${sim.expGained} EXP`;
    dom.predictedGold.textContent = `+${sim.goldGained} G`;

    // 🟢 HP予測ゴーストバーの反映
    const maxHp = state.hero.maxHp;
    if (dom.hpBarPrediction && dom.hpBarContainer) {
      if (sim.hp <= 0) {
        // 💀 死亡予測時はHPバー全体を赤色の明滅警告にする
        dom.hpBarContainer.classList.add("death-warning");
        dom.hpBarPrediction.style.width = `${(state.hero.hp / maxHp) * 100}%`;
        dom.hpBarPrediction.style.left = "0%";
      } else {
        dom.hpBarContainer.classList.remove("death-warning");
        if (sim.hp < state.hero.hp) {
          // ダメージを受ける場合、減少予測分を赤いバーで表示
          const dmgPercent = ((state.hero.hp - sim.hp) / maxHp) * 100;
          const leftPercent = (sim.hp / maxHp) * 100;
          dom.hpBarPrediction.style.width = `${dmgPercent}%`;
          dom.hpBarPrediction.style.left = `${leftPercent}%`;
        } else {
          // 回復時やHPに変化がない場合
          dom.hpBarPrediction.style.width = "0%";
          dom.hpBarPrediction.style.left = "100%";
        }
      }
    }

    if (sim.hp <= 0) {
      dom.predictedDamage.innerHTML = `<span class="dmg-val font-outfit">💀 死亡予測</span>`;
    }

    const path = pathTracker ? pathTracker.path : [];
    const panels = dom.gridContainer.children;
    
    for (let i = 0; i < 25; i++) {
      const badge = panels[i]?.querySelector(".panel-prediction-badge");
      if (badge) {
        badge.textContent = "";
        badge.className = "panel-prediction-badge";
      }
    }

    let currentHp = state.hero.hp;
    const atk = state.hero.atk;
    const swordMultiplier = state.artifacts.sword ? 2.5 : 1.8;
    let hasSwordBuff = false;
    let killCount = 0;

    path.forEach((idx, step) => {
      if (step === 0) return;
      const cell = gridData[idx];
      const panel = panels[idx];
      const badge = panel?.querySelector(".panel-prediction-badge");
      if (!badge || !cell) return;

      badge.className = "panel-prediction-badge active";

      if (cell.type === 'monster' || cell.type === 'boss') {
        killCount++;
        const chainMul = getChainMultiplier(killCount);
        const battle = calculateBattle(atk, hasSwordBuff, cell);
        currentHp -= battle.dmg;
        
        if (state.artifacts.fang && currentHp > 0) {
          currentHp = Math.min(maxHp, currentHp + Math.floor(maxHp * 0.03));
        }

        if (currentHp <= 0) {
          badge.textContent = "💀";
          badge.classList.add("badge-dmg", "death-warning-badge");
        } else {
          // ✅ ダメージが0なら「OK」、受けるなら「HP値」
          if (battle.dmg === 0) {
            badge.textContent = "🛡️ OK";
            badge.classList.add("badge-buff"); // 盾（ゴールド枠）で安全を示す
          } else {
            badge.textContent = `HP ${currentHp}`;
            badge.classList.add("badge-dmg");
          }
        }
      }
      else if (cell.type === 'potion') {
        const recover = Math.floor(maxHp * 0.30);
        currentHp = Math.min(maxHp, currentHp + recover);
        badge.textContent = `HP ${currentHp}`;
        badge.classList.add("badge-heal");
      }
      else if (cell.type === 'sword') {
        hasSwordBuff = true;
        badge.textContent = `ATK UP`;
        badge.classList.add("badge-buff");
      }
      else if (cell.type === 'trap') {
        if (state.isFever) {
          const trapGold = Math.floor(maxHp * 0.05);
          badge.textContent = `無敵G`;
          badge.classList.add("badge-heal");
        } else {
          const trapRate = state.artifacts.boots ? 0.05 : 0.15;
          const trapDmg = Math.floor(maxHp * trapRate);
          currentHp -= trapDmg;
          if (currentHp <= 0) {
            badge.textContent = "💀";
            badge.classList.add("badge-dmg", "death-warning-badge");
          } else {
            badge.textContent = `HP ${currentHp}`;
            badge.classList.add("badge-dmg");
          }
        }
      }
      else if (cell.type === 'key') {
        badge.textContent = "+1 🔑";
        badge.classList.add("badge-buff");
      }
      else if (cell.type === 'chest') {
        const goldBase = Math.floor(8 * Math.pow(1.22, state.floor - 1)) + 5;
        const goldMul = 1.0 + (state.permanentUpgrades.gold * GameConfig.upgrades.gold.rate);
        let gained = Math.floor(goldBase * 5 * goldMul);
        if (state.artifacts.chalice) gained *= 2;
        if (state.isFever) gained *= 3;
        badge.textContent = `+${gained}G`;
        badge.classList.add("badge-heal");
      }
      else if (cell.type === 'door') {
        badge.textContent = "CLEAR 🚪";
        badge.classList.add("badge-buff");
      }
    });
  }

  // ─── ルート確定実行 (チェインボーナス ＆ SEピッチ適用) ───
  function executePath(path) {
    if (path.length < 2) return;

    let hp = state.hero.hp;
    let maxHp = state.hero.maxHp;
    let atk = state.hero.atk;
    let level = state.hero.level;
    let exp = state.hero.exp;
    let keys = state.key;
    let goldGained = 0;
    let expGained = 0;
    let gaugeEarned = 0;
    
    let hasSwordBuff = false;
    let levelUpOccurred = false;
    let nextFloorTriggered = false;
    let killCount = 0;

    // ✅ ライトニング・チェイン判定: 経路上の敵が5体以上なら被ダメ20%軽減が発動
    const monsterCount = path.filter(idx => {
      const c = gridData[idx];
      return c && (c.type === 'monster' || c.type === 'boss');
    }).length;
    const isLightning = monsterCount >= 5;

    const panels = dom.gridContainer.children;

    path.forEach(idx => {
      const cell = gridData[idx];
      if (!cell) return;

      const rect = panels[idx].getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();
      
      const scrollY = window.pageYOffset || document.documentElement.scrollTop;
      const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
      const cx = (rect.left + scrollX) - (containerRect.left + scrollX) + rect.width / 2;
      const cy = (rect.top + scrollY) - (containerRect.top + scrollY) + 10;

      if (cell.type === 'monster' || cell.type === 'boss') {
        killCount++;
        const chainMul = getChainMultiplier(killCount);
        const result = calculateBattle(atk, hasSwordBuff, cell);
        
        const finalGold = Math.floor(result.gold * chainMul);
        const finalExp = Math.floor(result.exp * chainMul);

        // ✅ 必殺効果: 被ダメージを20%軽減
        let dmg = result.dmg;
        if (isLightning) {
          dmg = Math.floor(dmg * 0.8);
        }
        hp -= dmg;
        
        let healAmount = 0;
        if (state.artifacts.fang && hp > 0) {
          healAmount = Math.floor(maxHp * 0.03);
          hp = Math.min(maxHp, hp + healAmount);
        }

        goldGained += finalGold;
        exp += finalExp;
        expGained += finalExp;

        if (!state.isFever) {
          // ✅ FEVER調整: 敵1体+5、ボス+18 → 約20ターン分の戦闘でFEVER発動（希少性確保）
          gaugeEarned += (cell.type === 'boss') ? 18 : 5;
        }

        if (dmg > 0) {
          spawnFloatingText(`-${dmg} HP`, cx, cy, "#ff3b30");
          triggerDamageFlash();
          AudioManager.playSound('hit');
          const lLabel = isLightning ? " [必殺20%減]" : "";
          const cLabel = killCount > 1 ? ` [x${chainMul.toFixed(2)}]` : "";
          writeTerminalLog(`モンスターから ${dmg} 被ダメ${lLabel}${cLabel} (残:${hp})`, "damage");
          spawnParticles(cx, cy, 'error', 8);
        } else {
          AudioManager.playSound('atk', killCount);
          const cLabel = killCount > 1 ? ` [x${chainMul.toFixed(2)}]` : "";
          writeTerminalLog(`モンスターを無傷で撃破!${cLabel} (残:${hp})`, "system");
          spawnParticles(cx, cy, 'atk', 8);
        }
        if (healAmount > 0) {
          spawnFloatingText(`+${healAmount} HP (吸血)`, cx, cy - 25, "#2ecc71");
          spawnParticles(cx, cy - 25, 'heal', 4);
        }

        // 🔥 コンボ表示の強化
        if (killCount >= 2) {
          const comboLabel = killCount === 2 ? "DOUBLE!" : killCount === 3 ? "TRIPLE!" : `${killCount}COMBO!`;
          spawnFloatingText(comboLabel, cx, cy - 40, "#ff007f", killCount);
        }

        // ✅ 5チェイン以上で「ライトニング・チェイン」必殺技発動
        if (killCount >= 5) {
          spawnFloatingText("⚡ LIGHTNING CHAIN! ⚡", cx, cy - 50, "#00ffff", killCount);
          spawnParticles(cx, cy, 'fever', 12); // 青白い火花を大量に撒き散らす
          writeTerminalLog(`⚡ライトニング・チェイン必殺発動！戦闘被ダメージを20%軽減！⚡`, "fever");
        }

        const chainLabel = killCount > 1 ? ` (${killCount}連撃! x${chainMul.toFixed(2)})` : "";
        spawnFloatingText(`+${finalGold} G${chainLabel}`, cx, cy + 14, "#f1c40f", killCount);
        spawnFloatingText(`+${finalExp} EXP${chainLabel}`, cx, cy - 14, "#3498db", killCount);

        if (cell.type === 'boss') {
          keys++;
          if (state.floor === 25) {
            spawnFloatingText(`宇宙旅行用タオル🧣獲得!`, cx, cy - 35, "#ff007f");
            writeTerminalLog(`宇宙の秘宝「宇宙旅行用タオル🧣」を獲得！罠ダメージを完全に無効化します！`, "level");
          }
          spawnFloatingText(`ボス撃破! 🔑獲得`, cx, cy - 20, "#3498db");
          unlockBossArtifact(state.floor);
          writeTerminalLog(`エリアボスを討伐！鍵🔑を獲得`, "fever");
          spawnParticles(cx, cy, 'fever', 20);
        }

        gridData[idx] = null;
      }
      else if (cell.type === 'potion') {
        const recover = Math.floor(maxHp * 0.30);
        hp = Math.min(maxHp, hp + recover);
        spawnFloatingText(`+${recover} HP`, cx, cy, "#2ecc71");
        AudioManager.playSound('heal');
        writeTerminalLog(`ポーションで回復 +${recover} HP (現在:${hp})`, "system");
        spawnParticles(cx, cy, 'heal', 8);
        gridData[idx] = null;
      }
      else if (cell.type === 'sword') {
        hasSwordBuff = true;
        const swordMul = state.artifacts.sword ? 2.5 : 1.8;
        spawnFloatingText(`攻撃バフ ${swordMul}倍!`, cx, cy, "#f1c40f");
        AudioManager.playSound('heal');
        writeTerminalLog(`ルーンの剣を獲得！攻撃力 ${swordMul}倍バフ有効`, "gain");
        spawnParticles(cx, cy, 'atk', 8);
        gridData[idx] = null;
      }
      else if (cell.type === 'trap') {
        if (state.isFever) {
          const trapGold = Math.floor(maxHp * 0.05);
          goldGained += trapGold;
          spawnFloatingText(`無敵! +${trapGold} G`, cx, cy, "#ff007f");
          AudioManager.playSound('buy');
          writeTerminalLog(`無敵中トラップ無効！ +${trapGold} Gに還元`, "gain");
          spawnParticles(cx, cy, 'fever', 10);
        } else {
          const trapRate = state.artifacts.towel ? 0 : (state.artifacts.boots ? 0.05 : 0.15);
          const trapDmg = Math.floor(maxHp * trapRate);
          hp -= trapDmg;
          if (state.artifacts.towel) {
            spawnFloatingText(`ガード! (タオル)`, cx, cy, "#2ecc71");
            writeTerminalLog(`トラップを踏んだが、宇宙旅行用タオルで安全に防いだ！`, "system");
            spawnParticles(cx, cy, 'towel', 8);
          } else {
            spawnFloatingText(`-${trapDmg} HP (トゲ)`, cx, cy, "#ff3b30");
            triggerDamageFlash();
            AudioManager.playSound('hit');
            writeTerminalLog(`トゲ罠により ${trapDmg} 被ダメ (残:${hp})`, "damage");
            spawnParticles(cx, cy, 'error', 8);
          }
        }
      }
      else if (cell.type === 'key') {
        keys++;
        spawnFloatingText("+1 🔑鍵", cx, cy, "#3498db");
        AudioManager.playSound('heal');
        writeTerminalLog("道端で鍵🔑を拾った！", "system");
        spawnParticles(cx, cy, 'shield', 8);
        gridData[idx] = null;
      }
      else if (cell.type === 'chest') {
        keys--;
        const goldBase = Math.floor(8 * Math.pow(1.22, state.floor - 1)) + 5;
        const goldMul = 1.0 + (state.permanentUpgrades.gold * GameConfig.upgrades.gold.rate);
        let gained = Math.floor(goldBase * 5 * goldMul);
        
        if (state.artifacts.chalice) gained *= 2;
        if (state.isFever) gained *= 3;

        goldGained += gained;
        spawnFloatingText(`🎁 +${gained} G!`, cx, cy, "#9b59b6");
        AudioManager.playSound('clear');
        writeTerminalLog(`宝箱を開放！ 🪙 +${gained} G 獲得`, "gain");
        spawnParticles(cx, cy, 'fever', 15);
        gridData[idx] = null;
      }
      else if (cell.type === 'door') {
        keys--;
        AudioManager.playSound('clear');
        nextFloorTriggered = true;
        writeTerminalLog("フロアの扉を開放した！", "system");
      }
    });

    state.hero.hp = Math.max(0, hp);
    state.key = keys;
    state.gold += goldGained;
    state.totalGoldEarned += goldGained;

    if (goldGained > 0) writeTerminalLog(`このターンで総額 +${goldGained} G 獲得`, "gain");
    if (expGained > 0) writeTerminalLog(`経験値 +${expGained} EXP 獲得`, "system");

    // 📊 統計を更新
    if (state.stats) {
      state.stats.totalKills = (state.stats.totalKills || 0) + killCount;
      state.stats.totalTurns = (state.stats.totalTurns || 0) + 1;
      if (killCount > (state.stats.comboRecord || 0)) {
        state.stats.comboRecord = killCount;
      }
    }

    let nextExp = Math.round(10 * Math.pow(level, 1.4));
    while (exp >= nextExp && hp > 0) {
      exp -= nextExp;
      level++;
      maxHp = Math.round(100 * Math.pow(level, 1.2) + (level - 1) * 15);
      atk = Math.round(10 * Math.pow(level, 1.1) + (level - 1) * 3);
      hp = maxHp; // ⚡ レベルアップ時に100%全回復！
      nextExp = Math.round(10 * Math.pow(level, 1.4));
      levelUpOccurred = true;
    }

    state.hero.level = level;
    state.hero.exp = exp;
    state.hero.maxHp = maxHp;
    state.hero.atk = atk;
    state.hero.hp = Math.max(0, hp);

    if (levelUpOccurred && state.hero.hp > 0) {
      triggerLevelUpOverlay();
      AudioManager.playSound('level_up');
      writeTerminalLog(`レベルアップ！ Lv.${level} 到達！`, "level");
    }

    if (state.isFever) {
      state.feverTurns--;
      if (state.feverTurns <= 0) {
        state.isFever = false;
        state.feverGauge = 0;
        showToast("フィーバー終了 🧊");
        writeTerminalLog("フィーバータイムが終了しました", "system");
      } else {
        state.feverGauge = (state.feverTurns / GameConfig.baseFeverDuration) * 100;
      }
    } else if (gaugeEarned > 0) {
      state.feverGauge += gaugeEarned;
      if (state.feverGauge >= 100) {
        state.isFever = true;
        state.feverTurns = GameConfig.baseFeverDuration;
        state.feverGauge = 100;
        // 📊 フィーバー回数の統計更新
        if (state.stats) state.stats.feverCount = (state.stats.feverCount || 0) + 1;
        triggerFeverOverlay();
        AudioManager.playSound('fever');
        writeTerminalLog("🔥 FEVER TIME 発動！無双ラッシュ開始！", "fever");
      }
    }

    if (state.hero.hp <= 0) {
      handleGameOver();
    } else if (nextFloorTriggered) {
      handleFloorClear();
    } else {
      const lastIdx = path[path.length - 1];
      const oldHeroIdx = gridData.findIndex(c => c && c.type === 'hero');
      if (oldHeroIdx !== -1) gridData[oldHeroIdx] = null;
      gridData[lastIdx] = { type: 'hero' };
      saveGame();
    }
  }

  function triggerFeverOverlay() {
    dom.feverOverlay.style.display = "block";
    setTimeout(() => { dom.feverOverlay.style.display = "none"; }, 600);
  }

  // ─── 被ダメージ赤フラッシュ ───
  function triggerDamageFlash() {
    dom.damageFlash.classList.remove("damage-flash-active");
    void dom.damageFlash.offsetWidth;
    dom.damageFlash.classList.add("damage-flash-active");
  }

  // ─── レベルアップ演出 ───
  function triggerLevelUpOverlay() {
    dom.levelUpOverlay.style.display = "block";
    
    // 画面中央付近から段階的にパーティクルを放出
    const containerRect = dom.gameContainer.getBoundingClientRect();
    const cx = containerRect.width / 2;
    const cy = containerRect.height / 2;
    
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        spawnParticles(cx, cy + (Math.random() * 40 - 20), 'fever', 15);
      }, i * 250);
    }
    
    setTimeout(() => { dom.levelUpOverlay.style.display = "none"; }, 1800);
  }

  // ─── 浮遊数値テキストエフェクト ───
  function spawnFloatingText(text, x, y, color, chainCount = 0) {
    const floatEl = document.createElement("div");
    floatEl.className = "floating-dmg";
    floatEl.textContent = text;
    floatEl.style.left = `${x}px`;
    floatEl.style.top = `${y}px`;
    floatEl.style.setProperty('--glow-c', color);
    floatEl.style.color = "#fff";

    // ✅ チェインコンボ数(chainCount)に応じてフォントサイズと発光を拡大 (インフレ感の演出)
    if (chainCount > 1) {
      const scale = Math.min(1.6, 1.0 + (chainCount - 1) * 0.08);
      floatEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
      floatEl.style.fontWeight = "900";
      floatEl.style.textShadow = `0 0 ${8 * scale}px ${color}, 0 0 ${16 * scale}px ${color}`;
    }
    
    dom.floatingTextContainer.appendChild(floatEl);

    setTimeout(() => { floatEl.remove(); }, 800);
  }

  // ─── ゲームオーバー (時の砂時計 1F巻き戻し復活) ───
  function handleGameOver() {
    // ⏳ 時の砂時計の自動復活ロジック
    if (state.artifacts.hourglass && !state.hasRevivedThisFloor) {
      rollbackCurrentTurn();
      return;
    }

    saveGame(); // ✅ ゲームオーバー確定時セーブ（最後ターンのゴールドを保存）
    AudioManager.playSound('gameover');
    dom.shopGoldAmount.textContent = state.gold.toLocaleString();
    updateUpgradeModalUI();
    dom.shopModal.style.display = "flex";
    writeTerminalLog(`勇者が力尽きました。到達階層:${state.floor} F`, "damage");
  }

  // ⌛ 時の砂時計・自動復活時のタイムワープ逆再生演出
  function triggerTimeWarpEffect() {
    const overlay = document.createElement("div");
    overlay.className = "time-warp-overlay";
    
    const hourglassEl = document.createElement("div");
    hourglassEl.className = "time-warp-hourglass";
    hourglassEl.textContent = "⌛";
    overlay.appendChild(hourglassEl);
    
    document.body.appendChild(overlay);
    
    AudioManager.playSound('clear'); // 神秘的なサウンドを再生
    
    setTimeout(() => {
      overlay.classList.add("fade-out");
      setTimeout(() => {
        overlay.remove();
      }, 800);
    }, 1100);
  }

  // ⌛ 時の砂時計・手動なぞり直し（RESET）
  function rollbackCurrentTurn() {
    if (!state.artifacts.hourglass || state.hasRevivedThisFloor || !state.floorStartBackup) return;
    
    // ✅ クラッシュ防止: なぞり中（ドラッグ中）にRキー等で巻き戻された場合、安全になぞりを強制終了させる
    if (pathTracker && pathTracker.isDragging) {
      pathTracker.end();
    }

    recordInteraction();
    state.hasRevivedThisFloor = true;
    
    // バックアップからフロア初期状態を復元
    gridData = structuredClone(state.floorStartBackup.gridData);
    state.hero.hp = state.floorStartBackup.heroHp;
    state.hero.atk = state.floorStartBackup.heroAtk;
    state.hero.level = state.floorStartBackup.heroLevel;
    state.hero.exp = state.floorStartBackup.heroExp;
    state.key = state.floorStartBackup.keys;
    state.feverGauge = state.floorStartBackup.feverGauge;
    state.isFever = state.floorStartBackup.isFever;
    state.feverTurns = state.floorStartBackup.feverTurns;
    
    // ✅ 秘宝（アーティファクト）の所持状況も復元（死による持ち逃げ防止）
    if (state.floorStartBackup.artifacts) {
      state.artifacts = structuredClone(state.floorStartBackup.artifacts);
    }
    
    // ✅ 統計データもフロア開始時の状態に巻き戻す（二重加算を防止）
    if (state.floorStartBackup.stats) {
      state.stats = structuredClone(state.floorStartBackup.stats);
    }
    
    triggerTimeWarpEffect(); // タイムワープ逆再生演出を発動
    showToast("⌛ 時の砂時計が輝き、フロア開始時に巻き戻った！");
    writeTerminalLog("⌛ 時の砂時計が発動！フロア開始時に巻き戻しました", "system");
    
    buildGridDOM();
    simulatePathEffects();
    saveGame();
  }

  // ─── ステージクリア ───
  function handleFloorClear() {
    AudioManager.playSound('clear');
    
    // 周回数に応じたクリアゴールドボーナスの追加補正
    // ✅ clearBonus緩和: sqrtスケールで爆発を防止
    // 旧: floor*50*loopCount (3周目50F→　7500G) → 新: floor*50*sqrt(loopCount) (→　4330G)
    const clearBonus = Math.floor(state.floor * 50 * Math.sqrt(state.loopCount));
    state.gold += clearBonus;
    state.totalGoldEarned += clearBonus;
    
    // 📊 到達最大階層の更新
    if (state.stats && state.floor > (state.stats.bestFloor || 1)) {
      state.stats.bestFloor = state.floor;
    }
    
    showToast(`ステージクリアボーナス! 🪙+${clearBonus} G`);

    if (state.floor >= GameConfig.maxFloor) {
      handleGameVictory();
    } else {
      dom.clearFloorLabel.textContent = `${state.floor} F`;
      dom.nextFloorLabel.textContent = `${state.floor + 1} F`;
      dom.clearModal.style.display = "flex";
    }
  }

  // ─── ゲーム完全制覇 ───
  function handleGameVictory() {
    AudioManager.playSound('level_up');
    dom.victoryLevel.textContent = `Lv.${state.hero.level}`;
    dom.victoryGold.textContent = `${state.totalGoldEarned.toLocaleString()} G`;
    const upgCount = Object.values(state.permanentUpgrades).reduce((a, b) => a + b, 0);
    dom.victoryUpgrades.textContent = `${upgCount} 回`;
    dom.victoryModal.style.display = "flex";
  }

  // ─── 永続ショップアップグレードUI更新 ───
  function updateUpgradeModalUI() {
    dom.shopGoldAmount.textContent = state.gold.toLocaleString();

    Object.keys(GameConfig.upgrades).forEach(key => {
      const config = GameConfig.upgrades[key];
      const currentLv = state.permanentUpgrades[key];
      // ✅ ショップDOMキャッシュを使用（毎回 getElementById 庞止）
      const descEl = dom.shopDescs[key];
      const btnEl = dom.shopBtns[key];

      let rateText = "";
      if (key === 'hp') rateText = `初期HP+20% (現在: +${currentLv * 20}%)`;
      else if (key === 'atk') rateText = `初期ATK+15% (現在: +${currentLv * 15}%)`;
      else if (key === 'potion') rateText = `開始時ポーション所持 (現在: ${currentLv}個)`;
      else if (key === 'gold') rateText = `ゴールド獲得量+10% (現在: +${currentLv * 10}%)`;
      else if (key === 'key') rateText = `開始時キー所持+1 (現在: ${currentLv}個)`;

      descEl.textContent = `${rateText} / 最大Lv.${config.maxLv}`;

      if (currentLv >= config.maxLv) {
        btnEl.textContent = "最大";
        btnEl.disabled = true;
      } else {
        const cost = Math.floor(config.initialCost * Math.pow(config.scale, currentLv));
        btnEl.textContent = `${cost.toLocaleString()} G`;
        btnEl.disabled = state.gold < cost;
      }
    });
  }

  function buyUpgrade(key) {
    const config = GameConfig.upgrades[key];
    const currentLv = state.permanentUpgrades[key];
    if (currentLv >= config.maxLv) return;

    const cost = Math.floor(config.initialCost * Math.pow(config.scale, currentLv));
    if (state.gold >= cost) {
      state.gold -= cost;
      state.permanentUpgrades[key]++;
      AudioManager.playSound('buy');
      updateUpgradeModalUI();
      saveGame();
    }
  }

  // ─── 次の階層への移行 ───
  function nextFloor() {
    state.floor++;
    state.hasRevivedThisFloor = false;
    dom.clearModal.style.display = "none";
    updateSkinForFloor();
    generateFloorData();
    saveGame();
  }

  // ─── リトライ（再挑戦・1Fから） ───
  function retryGame(keepLoop = false, keepArtifacts = false) {
    dom.shopModal.style.display = "none";

    const hpLv = state.permanentUpgrades.hp;
    const atkLv = state.permanentUpgrades.atk;
    const initKey = state.permanentUpgrades.key;

    state.floor = 1;
    state.key = initKey;
    state.hero.level = 1;
    state.hero.exp = 0;
    
    if (!keepLoop) {
      state.loopCount = 1; // ✅ 通常リトライ時のみ周回数を1に戻す
    }
    
    state.isFever = false;
    state.feverTurns = 0;
    state.feverGauge = 0;
    state.hasRevivedThisFloor = false;

    // ✅ 周回引き継ぎでない場合は秘宝（ダンジョン内アーティファクト）をリセット（死亡リトライ時はリセット）
    if (!keepArtifacts) {
      state.artifacts = {
        fang: false,
        hourglass: false,
        boots: false,
        towel: false,
        sword: false,
        chalice: false
      };
    }

    const baseMaxHp = 100;
    const baseAtk = 10;
    state.hero.maxHp = Math.round(baseMaxHp * (1.0 + hpLv * GameConfig.upgrades.hp.rate));
    state.hero.atk = Math.round(baseAtk * (1.0 + atkLv * GameConfig.upgrades.atk.rate));
    state.hero.hp = state.hero.maxHp;

    updateSkinForFloor();
    generateFloorData();
    saveGame();
  }

  // 2周目（強くてニューゲーム）への移行
  function resetVictoryGame() {
    dom.victoryModal.style.display = "none";
    state.loopCount++;
    state.hasRevivedThisFloor = false;
    showToast(`🏆 脅威Lv.${state.loopCount} に突入しました！`);
    retryGame(true, true); // ✅ 周回数とアーティファクトを引き継いでリスタート
  }

  // ─── 階層によるスキンの自動切替 ───
  function updateSkinForFloor() {
    const f = state.floor;
    let skin = 'area-1';
    if (f > 30) skin = 'area-4';
    else if (f > 20) skin = 'area-3';
    else if (f > 10) skin = 'area-2';

    state.settings.currentSkin = skin;
    document.body.className = "";
    if (skin === 'area-2') document.body.className = "bg-area-2";
    else if (skin === 'area-3') document.body.className = "bg-area-3";
    else if (skin === 'area-4') document.body.className = "bg-area-4";
    else document.body.className = "bg-area-1";


  }

  // ─── ランダムフロア自動生成アルゴリズム (周回インフレ補正付き) ───
  function generateFloorData() {
    let retries = 0;
    const maxRetries = 100;
    
    // 🪙 2周目以降の敵のインフレ乗数 (1周ごとに+50%強化)
    const loopMultiplier = 1.0 + (state.loopCount - 1) * 0.50;

    while (retries < maxRetries) {
      gridData = Array(25).fill(null);

      const isBossFloor = (state.floor % 10 === 0 || state.floor === 25);

      const heroIdx = 20;
      gridData[heroIdx] = { type: 'hero' };

      const doorIdx = 4;
      gridData[doorIdx] = { type: 'door' };

      if (isBossFloor) {
        const bossIdx = 12;
        const bHp = Math.round(Math.round(10 * Math.pow(1.28, state.floor - 1)) * 8 * loopMultiplier);
        const bAtk = Math.round(Math.round(8 * Math.pow(1.25, state.floor - 1)) * 2.2 * loopMultiplier);
        const bExp = Math.round(2 * Math.pow(1.12, state.floor - 1)) + state.floor;
        
        gridData[bossIdx] = {
          type: 'boss',
          val: {
            hp: bHp,
            atk: bAtk,
            exp: bExp * 10,
            gold: bExp * 12
          }
        };
      } else {
        const keyIdx = getRandomFreeIndex([heroIdx, doorIdx]);
        if (keyIdx !== -1) gridData[keyIdx] = { type: 'key' }; // ✅ -1ガード: 空き枠なしのエッジケースを安全に処理
      }

      if (state.floor >= 15 && Math.random() < 0.45) {
        const w1 = getRandomFreeIndex([heroIdx, doorIdx]);
        const w2 = getRandomFreeIndex([heroIdx, doorIdx, w1]);
        if (w1 !== -1 && w2 !== -1) {
          gridData[w1] = { type: 'warp', val: 'W1' };
          gridData[w2] = { type: 'warp', val: 'W1' };
        }
      }

      if (Math.random() < 0.35) {
        const chestIdx = getRandomFreeIndex([heroIdx, doorIdx]);
        if (chestIdx !== -1) gridData[chestIdx] = { type: 'chest' };
      }

      for (let i = 0; i < 25; i++) {
        if (gridData[i] !== null) continue;

        const rand = Math.random();
        if (rand < 0.38) {
          const baseHp = Math.round(Math.round(10 * Math.pow(1.28, state.floor - 1)) * loopMultiplier);
          const baseAtk = Math.round(Math.round(8 * Math.pow(1.25, state.floor - 1)) * loopMultiplier);
          const baseExp = Math.round(2 * Math.pow(1.12, state.floor - 1)) + state.floor;

          const isElite = Math.random() < 0.15;
          const isShield = !isElite && state.floor >= 3 && Math.random() < 0.30; // エリートでなく、3F以上で30%の確率でシールド
          gridData[i] = {
            type: 'monster',
            val: {
              hp: isElite ? Math.round(baseHp * 2.5) : baseHp,
              atk: isElite ? Math.round(baseAtk * 1.5) : baseAtk,
              exp: isElite ? baseExp * 3 : baseExp,
              gold: isElite ? baseExp * 3.5 : baseExp,
              elite: isElite,
              shield: isShield // ✅ シールドプロパティ
            }
          };
        }
        else if (rand < 0.48) {
          gridData[i] = { type: 'potion' };
        }
        else if (rand < 0.55) {
          gridData[i] = { type: 'sword' };
        }
        else if (rand < 0.65) {
          gridData[i] = { type: 'trap' };
        }
      }

      if (validateFloorClearable()) {
        break;
      }
      retries++;
    }

    if (retries >= maxRetries) {
      // ✅ 再帰呼び出し禁止: 安全な最小フロアを強制構築してスタックオーバーフローを防止
      gridData = Array(25).fill(null);
      gridData[20] = { type: 'hero' };
      gridData[4]  = { type: 'door' };
      gridData[12] = { type: 'key' };
      for (let fi = 0; fi < 25; fi++) {
        if (gridData[fi] === null) gridData[fi] = { type: 'potion' };
      }
      state.hero.hp = state.hero.maxHp;
      showToast("⚠️ 魔石の加護でフロアが安定化しました...");
    }

    // ✅ ポーション永続強化の反映（retryGame後も含め、毎フロアで追加ポーションを配置）
    const extraPotions = state.permanentUpgrades.potion || 0;
    for (let p = 0; p < extraPotions; p++) {
      const potionFreeIdx = getRandomFreeIndex([]);
      if (potionFreeIdx !== -1) gridData[potionFreeIdx] = { type: 'potion' };
    }

    buildGridDOM();
    simulatePathEffects();
    
    // 💡 フロア初期状態のスナップショットをバックアップ (時の砂時計用)
    backupFloorStart();
  }

  // ⏳ 時の砂時計用のフロアバックアップ関数
  function backupFloorStart() {
    state.floorStartBackup = {
      gridData: structuredClone(gridData),
      heroHp: state.hero.hp,
      heroAtk: state.hero.atk,
      heroLevel: state.hero.level,
      heroExp: state.hero.exp,
      keys: state.key,
      feverGauge: state.feverGauge,
      isFever: state.isFever,
      feverTurns: state.feverTurns,
      stats: structuredClone(state.stats), // ✅ 統計データもフロア開始時にバックアップ
      artifacts: structuredClone(state.artifacts) // ✅ アーティファクトの所有状況もバックアップ（死による持ち逃げ防止）
    };
  }

  function validateFloorClearable() {
    const startIdx = 20;
    const doorIdx = 4;

    const visited = new Set();
    let solved = false;

    const currentSwordMul = state.artifacts.sword ? 2.5 : 1.8;
    const feverAtkMul = state.isFever ? 2.0 : 1.0;

    function dfs(curr, hp, maxHp, atk, keys, tempAtk, warpPairsUsed, kills = 0) {
      if (solved) return;
      if (curr === doorIdx) {
        if (hp > 0) solved = true;
        return;
      }

      visited.add(curr);

      const cx = curr % 5;
      const cy = Math.floor(curr / 5);
      const neighbors = [];

      const dirsLen = DIRS.length;
      for (let d = 0; d < dirsLen; d++) {
        const tx = cx + DIRS[d].x;
        const ty = cy + DIRS[d].y;
        if (tx >= 0 && tx < 5 && ty >= 0 && ty < 5) {
          neighbors.push(ty * 5 + tx);
        }
      }

      for (const next of neighbors) {
        if (visited.has(next)) continue;
        const cell = gridData[next];

        let nextHp = hp;
        let nextMaxHp = maxHp;
        let nextAtk = atk;
        let nextKeys = keys;
        let nextTempAtk = tempAtk;
        let nextWarpPairsUsed = new Set(warpPairsUsed);
        let nextKills = kills;

        if (!cell) {
          dfs(next, nextHp, nextMaxHp, nextAtk, nextKeys, nextTempAtk, nextWarpPairsUsed, kills);
          continue;
        }

        if (cell.type === 'monster' || cell.type === 'boss') {
          nextKills++;
          const isLightningSim = nextKills >= 5;

          const currentAtk = Math.floor(nextAtk * nextTempAtk * feverAtkMul);
          let dmg = 0;
          if (currentAtk < cell.val.atk) {
            dmg = (cell.val.atk - currentAtk) * (cell.type === 'boss' ? 2 : 1);
          }
          // ✅ DFS側にもバリアロジックを追加
          if (cell.val && cell.val.shield && nextTempAtk === 1.0) {
            dmg = dmg === 0 ? 10 : dmg * 2;
          }

          // ⚡ ライトニング軽減適用
          if (isLightningSim) {
            dmg = Math.floor(dmg * 0.8);
          }
          nextHp -= dmg;
          
          if (state.artifacts.fang && nextHp > 0) {
            nextHp = Math.min(nextMaxHp, nextHp + Math.floor(nextMaxHp * 0.03));
          }
          if (cell.type === 'boss') nextKeys++;
        }
        else if (cell.type === 'potion') {
          const recover = Math.floor(nextMaxHp * 0.30);
          nextHp = Math.min(nextMaxHp, nextHp + recover);
        }
        else if (cell.type === 'sword') {
          nextTempAtk = currentSwordMul;
        }
        else if (cell.type === 'trap') {
          if (!state.isFever) {
            const trapRate = state.artifacts.boots ? 0.05 : 0.15;
            nextHp -= Math.floor(nextMaxHp * trapRate);
          }
        }
        else if (cell.type === 'key') {
          nextKeys++;
        }
        else if (cell.type === 'chest') {
          if (nextKeys < 1) continue;
          nextKeys--;
        }
        else if (cell.type === 'door') {
          if (nextKeys < 1) continue;
          nextKeys--;
        }
        else if (cell.type === 'warp') {
          const pairName = cell.val;
          if (!nextWarpPairsUsed.has(pairName)) {
            const otherWarpIdx = gridData.findIndex((c, i) => i !== next && c && c.type === 'warp' && c.val === pairName);
            if (otherWarpIdx !== -1 && !visited.has(otherWarpIdx)) {
              nextWarpPairsUsed.add(pairName);
              visited.add(next);
              dfs(otherWarpIdx, nextHp, nextMaxHp, nextAtk, nextKeys, nextTempAtk, nextWarpPairsUsed, kills);
              visited.delete(next);
              continue;
            }
          }
        }

        if (nextHp > 0) {
          dfs(next, nextHp, nextMaxHp, nextAtk, nextKeys, nextTempAtk, nextWarpPairsUsed, nextKills);
        }
      }

      visited.delete(curr);
    }

    dfs(startIdx, state.hero.hp, state.hero.maxHp, state.hero.atk, state.key, 1.0, new Set());
    return solved;
  }

  function getRandomFreeIndex(excludeList) {
    const frees = [];
    for (let i = 0; i < 25; i++) {
      if (gridData[i] === null && !excludeList.includes(i)) {
        frees.push(i);
      }
    }
    if (frees.length === 0) return -1;
    return frees[Math.floor(Math.random() * frees.length)];
  }

  // ─── UI レンダラー ───
  const UIManager = {
    isDirty: true,
    cache: {
      floor: -1,
      loopCount: -1,
      gold: -1,
      key: -1,
      heroLevel: -1,
      heroHp: -1,
      heroMaxHp: -1,
      heroAtk: -1,
      heroExp: -1,
      artifacts: null // ✅ アーティファクトキャッシュ追加（毎フレームの無駄なDOM操作を防止）
    },

    init() {
      initDOMCache();
      this.updateAudioButtonVisual();
    },

    updateAudioButtonVisual() {
      const mode = state.settings.audioMode;
      dom.soundBtn.innerText = mode === 0 ? "🔇 OFF" : "🔊 ON";
    },

    render() {
      const hero = state.hero;
      const swordMultiplier = state.artifacts.sword ? 2.5 : 1.8;

      if (this.cache.floor !== state.floor || this.cache.loopCount !== state.loopCount) {
        this.cache.floor = state.floor;
        this.cache.loopCount = state.loopCount;
        const loopLabel = state.loopCount > 1 ? ` (${state.loopCount}周目)` : "";
        dom.floorDisplay.textContent = `${this.cache.floor} F${loopLabel}`;
      }
      if (this.cache.gold !== state.gold) {
        this.cache.gold = state.gold;
        dom.goldDisplay.textContent = this.cache.gold.toLocaleString();
      }
      if (this.cache.key !== state.key) {
        this.cache.key = state.key;
        dom.keyDisplay.textContent = this.cache.key;
      }
      if (this.cache.heroLevel !== hero.level) {
        this.cache.heroLevel = hero.level;
        dom.heroLevel.textContent = this.cache.heroLevel;
        if (dom.heroLevelDisplay) dom.heroLevelDisplay.textContent = this.cache.heroLevel;
      }
      if (this.cache.heroHp !== hero.hp || this.cache.heroMaxHp !== hero.maxHp) {
        this.cache.heroHp = hero.hp;
        this.cache.heroMaxHp = hero.maxHp;
        dom.heroHp.textContent = this.cache.heroHp.toLocaleString();
        dom.heroMaxHp.textContent = this.cache.heroMaxHp.toLocaleString();
        // ✅ HPバー更新
        if (dom.hpBarFill) {
          const pct = this.cache.heroMaxHp > 0 ? (this.cache.heroHp / this.cache.heroMaxHp) * 100 : 0;
          dom.hpBarFill.style.width = `${pct}%`;
          // HP割合に応じて色を変化（緑→黄→赤）
          dom.hpBarFill.style.background = pct > 50
            ? 'linear-gradient(90deg, #2ecc71, #27ae60)'
            : pct > 25
              ? 'linear-gradient(90deg, #f39c12, #e67e22)'
              : 'linear-gradient(90deg, #e74c3c, #c0392b)';
        }
        // ✅ 実HP更新時は予測ゴーストバーをリセット
        if (dom.hpBarPrediction && dom.hpBarContainer) {
          dom.hpBarPrediction.style.width = "0%";
          dom.hpBarPrediction.style.left = "100%";
          dom.hpBarContainer.classList.remove("death-warning");
        }
      }
      if (this.cache.heroAtk !== hero.atk) {
        this.cache.heroAtk = hero.atk;
        dom.heroAtk.textContent = this.cache.heroAtk.toLocaleString();
      }

      const nextExp = Math.round(10 * Math.pow(hero.level, 1.4));
      if (this.cache.heroExp !== hero.exp) {
        this.cache.heroExp = hero.exp;
        dom.expText.textContent = `EXP: ${this.cache.heroExp} / ${nextExp}`;
        dom.expBarFill.style.width = `${(this.cache.heroExp / nextExp) * 100}%`;
      }

      if (dom.feverBarFill && dom.feverText) {
        dom.feverBarFill.style.width = `${state.feverGauge}%`;
        dom.feverText.textContent = state.isFever ? `FEVER: ${state.feverTurns}T` : `${Math.floor(state.feverGauge)}%`;
      }
      dom.gameContainer.classList.toggle("fever-active", state.isFever);

      // ✅ アーティファクトキャッシュ: 変化があった時だけDOM更新（毎フレーム10回のtoggle廃止）
      const artKey = `${state.artifacts.fang}|${state.artifacts.hourglass}|${state.artifacts.boots}|${state.artifacts.towel}|${state.artifacts.sword}|${state.artifacts.chalice}`;
      if (this.cache.artifacts !== artKey) {
        this.cache.artifacts = artKey;
        dom.artFang.classList.toggle('unlocked', state.artifacts.fang);
        dom.artFang.classList.toggle('locked', !state.artifacts.fang);
        dom.artHourglass.classList.toggle('unlocked', state.artifacts.hourglass);
        dom.artHourglass.classList.toggle('locked', !state.artifacts.hourglass);
        dom.artBoots.classList.toggle('unlocked', state.artifacts.boots);
        dom.artBoots.classList.toggle('locked', !state.artifacts.boots);
        dom.artTowel.classList.toggle('unlocked', state.artifacts.towel);
        dom.artTowel.classList.toggle('locked', !state.artifacts.towel);
        dom.artSword.classList.toggle('unlocked', state.artifacts.sword);
        dom.artSword.classList.toggle('locked', !state.artifacts.sword);
        dom.artChalice.classList.toggle('unlocked', state.artifacts.chalice);
        dom.artChalice.classList.toggle('locked', !state.artifacts.chalice);
      }



      // 💻 PC用常時ショップ＆統計・モニター情報の更新
      if (dom.pcShopGold) {
        dom.pcShopGold.textContent = state.gold.toLocaleString();

        Object.keys(GameConfig.upgrades).forEach(key => {
          const config = GameConfig.upgrades[key];
          const currentLv = state.permanentUpgrades[key];
          const descEl = dom.pcShopDescs[key];
          const lvEl = dom.pcStatusLvs[key];
          const progressEl = dom.pcStatusProgresses[key];

          if (descEl && lvEl && progressEl) {
            let rateText = "";
            if (key === 'hp') rateText = `初期HP +${currentLv * 20}%`;
            else if (key === 'atk') rateText = `初期ATK +${currentLv * 15}%`;
            else if (key === 'potion') rateText = `開始ポーション所持: ${currentLv}個`;
            else if (key === 'gold') rateText = `ゴールド獲得量 +${currentLv * 10}%`;
            else if (key === 'key') rateText = `開始キー所持: +${currentLv}個`;

            descEl.textContent = rateText;
            lvEl.textContent = `Lv.${currentLv} / ${config.maxLv}`;

            const percent = (currentLv / config.maxLv) * 100;
            progressEl.style.width = `${percent}%`;
          }
        });
      }

      // 💻 PC用統計情報の更新
      if (state.stats) {
        if (dom.statKills) dom.statKills.textContent = state.stats.totalKills || 0;
        if (dom.statTurns) dom.statTurns.textContent = state.stats.totalTurns || 0;
        if (dom.statCombo) dom.statCombo.textContent = state.stats.comboRecord || 0;
        if (dom.statFever) dom.statFever.textContent = state.stats.feverCount || 0;
      }

      // ─── ✅ 修正: グリッドレンダリングの正確な実装 ───
      const panels = dom.gridContainer.children;
      const path = pathTracker ? pathTracker.path : [];
      const isDragging = pathTracker && pathTracker.isDragging;
      const lastIdx = isDragging ? path[path.length - 1] : null;

      for (let i = 0; i < 25; i++) {
        const panel = panels[i];
        if (!panel) continue;

        const cell = gridData[i];
        const isSelected = path.includes(i);

        // パネルタイプに基づいてCSSクラスを正確に設定
        if (cell) {
          let typeClass = "panel-empty";
          let iconText = "";
          let valText = "";

          if (cell.type === 'hero') {
            typeClass = "panel-hero";
            iconText = "⚔️";
            valText = "HERO"; // ✅ デザイン調整: 英語に統一
          }
          else if (cell.type === 'monster') {
            typeClass = cell.val.elite ? "panel-boss" : "panel-monster";
            // ✅ シールドバリア効果のネオンクラスを追加
            if (cell.val.shield) {
              typeClass += " panel-shield-active";
            }
            iconText = cell.val.elite ? "😈" : (cell.val.shield ? "🛡️👾" : "👾");
            valText = `ATK ${cell.val.atk.toLocaleString()}`;
          }
          else if (cell.type === 'boss') {
            typeClass = "panel-boss";
            iconText = "👹";
            valText = `BOSS ${cell.val.atk.toLocaleString()}`;
          }
          else if (cell.type === 'potion') {
            typeClass = "panel-potion";
            iconText = "🧪";
            valText = "+30%HP";
          }
          else if (cell.type === 'sword') {
            typeClass = "panel-sword";
            iconText = "🗡️";
            valText = `x${swordMultiplier} ATK`;
          }
          else if (cell.type === 'trap') {
            typeClass = "panel-trap";
            iconText = "🕸️";
            valText = state.isFever ? "無敵 G還元" : (state.artifacts.towel ? "0%HP" : (state.artifacts.boots ? "-5%HP" : "-15%HP"));
          }
          else if (cell.type === 'towel') {
            typeClass = "panel-towel";
            iconText = "🧣";
            valText = "TOWEL";
          }
          else if (cell.type === 'key') {
            typeClass = "panel-key";
            iconText = "🔑";
            valText = "KEY"; // ✅ デザイン調整: 英語に統一
          }
          else if (cell.type === 'chest') {
            typeClass = "panel-chest";
            iconText = "🎁";
            valText = "CHEST"; // ✅ デザイン調整: 英語に統一
          }
          else if (cell.type === 'door') {
            typeClass = "panel-door";
            iconText = "🚪";
            valText = "DOOR"; // ✅ デザイン調整: 英語に統一
          }
          else if (cell.type === 'warp') {
            typeClass = "panel-warp";
            iconText = "🌀";
            valText = cell.val;
          }

          // クラス名を組み立てる (selectedは明示的な場合のみ付与)
          let className = `grid-panel glass-panel ${typeClass}`;
          if (isSelected) className += " selected";
          panel.className = className;

          const iconEl = panel.querySelector(".panel-icon");
          const valEl = panel.querySelector(".panel-val");
          if (iconEl) iconEl.textContent = iconText;
          if (valEl) valEl.textContent = valText;

          // ✅ シールドバッジの表示制御
          const sBadge = panel.querySelector(".shield-badge");
          if (sBadge) {
            sBadge.style.display = (cell.type === 'monster' && cell.val.shield) ? "block" : "none";
          }

        } else {
          // セルが空の場合
          let className = "grid-panel glass-panel";
          if (isSelected) className += " selected";
          panel.className = className;

          const iconEl = panel.querySelector(".panel-icon");
          const valEl = panel.querySelector(".panel-val");
          if (iconEl) iconEl.textContent = "";
          if (valEl) valEl.textContent = "";

          const sBadge = panel.querySelector(".shield-badge");
          if (sBadge) sBadge.style.display = "none";
        }

        // ドラッグ中の隣接セル表示
        if (isDragging && !isSelected && lastIdx !== null) {
          const cx = lastIdx % 5;
          const cy = Math.floor(lastIdx / 5);
          const tx = i % 5;
          const ty = Math.floor(i / 5);
          const isAdjacent = (Math.abs(tx - cx) + Math.abs(ty - cy) === 1);
          if (isAdjacent) {
            panel.classList.add("target-connectable");
          }
        }
      }
    }
  };

  // ✅ フィーバーグラデーション取得ヘルパー（キャンバスサイズ変更時のみ再生成）
  function getFeverStrokeStyle() {
    if (!_feverGradCache || _feverGradCache._cw !== canvas.width || _feverGradCache._ch !== canvas.height) {
      const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      g.addColorStop(0,    '#ff007f');
      g.addColorStop(0.25, '#ff00ff');
      g.addColorStop(0.5,  '#00ffff');
      g.addColorStop(0.75, '#00ff00');
      g.addColorStop(1,    '#ff007f');
      g._cw = canvas.width;
      g._ch = canvas.height;
      _feverGradCache = g;
    }
    return _feverGradCache;
  }

  // ─── 一筆書きネオンライン描画 (Canvas) ───
  function drawWarpLine(ctx, p1, p2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.quadraticCurveTo(canvas.width / 2, canvas.height / 2, p2.x, p2.y);
    
    const pulseSpeed = Date.now() / 150;
    const pulseWidth = 10 + Math.sin(pulseSpeed) * 1.5;
    const pulseBlur = 12 + Math.cos(pulseSpeed) * 3;

    if (state.isFever) {
      ctx.strokeStyle = 'rgba(255, 0, 255, 0.6)';
      ctx.lineWidth = pulseWidth;
      ctx.shadowColor = '#ff00ff';
    } else {
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.4)';
      ctx.lineWidth = pulseWidth;
      ctx.shadowColor = '#a855f7';
    }
    
    ctx.lineCap = 'round';
    ctx.shadowBlur = pulseBlur;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 0;
    ctx.stroke();
    
    ctx.restore();
  }

  function drawNeonLines() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const path = pathTracker ? pathTracker.path : [];
    if (path.length < 2) return;

    const panels = dom.gridContainer.children;
    const getCenter = (idx) => {
      const rect = panels[idx].getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();
      return {
        x: rect.left - containerRect.left + rect.width / 2,
        y: rect.top - containerRect.top + rect.height / 2
      };
    };

    ctx.save();
    ctx.beginPath();

    const start = getCenter(path[0]);
    ctx.moveTo(start.x, start.y);

    const len = path.length;
    const pulseSpeed = Date.now() / 150;
    const pulseWidth = 12 + Math.sin(pulseSpeed) * 1.5;
    const pulseBlur = 12 + Math.cos(pulseSpeed) * 3;

    for (let i = 1; i < len; i++) {
      const currIdx = path[i];
      const prevIdx = path[i - 1];

      const cx = prevIdx % 5;
      const cy = Math.floor(prevIdx / 5);
      const tx = currIdx % 5;
      const ty = Math.floor(currIdx / 5);
      const isAdjacent = (Math.abs(tx - cx) + Math.abs(ty - cy) === 1);

      const pt = getCenter(currIdx);
      if (isAdjacent) {
        ctx.lineTo(pt.x, pt.y);
      } else {
        if (state.isFever) {
          ctx.strokeStyle = getFeverStrokeStyle();
          ctx.shadowColor = '#ff00ff';
        } else {
          ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
          ctx.shadowColor = '#ff007f';
        }

        ctx.lineWidth = pulseWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowBlur = pulseBlur;
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.shadowBlur = 0;
        ctx.stroke();

        const p1 = getCenter(prevIdx);
        drawWarpLine(ctx, p1, pt);

        ctx.beginPath();
        ctx.moveTo(pt.x, pt.y);
      }
    }

    if (state.isFever) {
      ctx.strokeStyle = getFeverStrokeStyle();
      ctx.shadowColor = '#ff00ff';
    } else {
      ctx.strokeStyle = 'rgba(255, 0, 127, 0.4)';
      ctx.shadowColor = '#ff007f';
    }

    ctx.lineWidth = pulseWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = pulseBlur;
    ctx.stroke();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0;
    ctx.stroke();

    // ☄️ コネクション・アロー / 流れる光の粒子アニメーション (なぞりの方向と順序を直感的に可視化)
    const dotSpacing = 40; // 粒子の間隔
    const particleSpeed = (Date.now() / 10) % dotSpacing; // 時間経過によるオフセット
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = state.isFever ? '#00ffff' : '#ff007f';
    ctx.shadowBlur = 6;

    for (let i = 1; i < len; i++) {
      const currIdx = path[i];
      const prevIdx = path[i - 1];
      const cx = prevIdx % 5;
      const cy = Math.floor(prevIdx / 5);
      const tx = currIdx % 5;
      const ty = Math.floor(currIdx / 5);
      const isAdjacent = (Math.abs(tx - cx) + Math.abs(ty - cy) === 1);

      if (isAdjacent) {
        const p1 = getCenter(prevIdx);
        const p2 = getCenter(currIdx);
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const unitX = dx / distance;
        const unitY = dy / distance;

        let startDist = particleSpeed;
        while (startDist < distance) {
          const px = p1.x + unitX * startDist;
          const py = p1.y + unitY * startDist;
          ctx.beginPath();
          ctx.arc(px, py, 2.8, 0, Math.PI * 2);
          ctx.fill();
          startDist += dotSpacing;
        }
      }
    }

    ctx.restore();
  }

  // ─── ゲームループ ───
  let isCanvasClean = false; // ✅ 静止時のキャンバスクリアの重複実行を避ける最適化フラグ
  function mainLoop(timestamp) {
    if (timestamp - lastUserInteractionTime >= 180000) {
      if (AudioManager.ctx && AudioManager.ctx.state === 'running') {
        AudioManager.ctx.suspend();
      }
    }

    // ✅ パーティクルが存在するか、ドラッグ中か、フィーバー中ならキャンバスを更新 (最適化)
    const needsDraw = (pathTracker && pathTracker.isDragging) || state.isFever || hasActiveParticlesOrShockwaves();
    if (needsDraw) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if ((pathTracker && pathTracker.isDragging) || state.isFever) {
        drawNeonLines();
      }
      updateAndDrawParticles();
      isCanvasClean = false;
    } else if (!isCanvasClean) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      isCanvasClean = true;
    }

    if (UIManager.isDirty) {
      UIManager.render();
      UIManager.isDirty = false;
    }

    requestAnimationFrame(mainLoop);
  }

  function recordInteraction() {
    lastUserInteractionTime = performance.now();
    if (AudioManager.ctx) {
      if (AudioManager.ctx.state === 'suspended' || AudioManager.ctx.state === 'interrupted') {
        AudioManager.ctx.resume().catch(() => {});
      }
    }
  }

  // ─── 案内手アニメーション ───
  function updateDragGuideVisual() {
    if (state.permanentUpgrades.hp > 0 || state.floor > 1) {
      dom.dragGuideHand.style.display = "none";
      return;
    }

    const heroIdx = gridData.findIndex(c => c && c.type === 'hero');
    const potionIdx = gridData.findIndex(c => c && c.type === 'potion');

    if (heroIdx !== -1 && potionIdx !== -1) {
      const panels = dom.gridContainer.children;
      const hRect = panels[heroIdx].getBoundingClientRect();
      const pRect = panels[potionIdx].getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();

      const fx = hRect.left - containerRect.left + hRect.width / 2 - 10;
      const fy = hRect.top - containerRect.top + hRect.height / 2 - 10;
      const tx = pRect.left - containerRect.left + pRect.width / 2 - 10;
      const ty = pRect.top - containerRect.top + pRect.height / 2 - 10;

      dom.dragGuideHand.style.left = `${fx}px`;
      dom.dragGuideHand.style.top = `${fy}px`;
      dom.dragGuideHand.style.setProperty('--drag-dx', `${tx - fx}px`);
      dom.dragGuideHand.style.setProperty('--drag-dy', `${ty - fy}px`);
      dom.dragGuideHand.style.display = "block";
      dom.dragGuideHand.style.animation = "handDragMove 2.2s infinite ease-in-out";
    } else {
      dom.dragGuideHand.style.display = "none";
    }
  }

  // ─── 5x5グリッド構築 ───
  function buildGridDOM() {
    dom.gridContainer.innerHTML = "";
    for (let i = 0; i < 25; i++) {
      const panel = document.createElement("div");
      panel.className = "grid-panel glass-panel";
      panel.dataset.index = i;

      const icon = document.createElement("span");
      icon.className = "panel-icon";
      panel.appendChild(icon);

      const val = document.createElement("span");
      val.className = "panel-val";
      panel.appendChild(val);

      const badge = document.createElement("span");
      badge.className = "panel-prediction-badge";
      panel.appendChild(badge);

      // ✅ シールドバッジ用エレメント
      const sBadge = document.createElement("span");
      sBadge.className = "shield-badge";
      sBadge.style.display = "none";
      sBadge.textContent = "🛡️";
      panel.appendChild(sBadge);

      dom.gridContainer.appendChild(panel);
    }
    UIManager.isDirty = true;
  }

  // イベント委譲
  function handleGridPointerDown(e) {
    if (!gameStarted) return;
    const panel = e.target.closest('.grid-panel');
    if (panel && dom.gridContainer.contains(panel)) {
      const idx = parseInt(panel.dataset.index, 10);
      pathTracker.start(idx);

      // 📱 スマホ専用：タッチ開始時にもプレビューポップアップを即座に表示
      if (window.innerWidth < 1024 && dom.mobileDragPreview && dom.gameContainer) {
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (clientX !== undefined && clientY !== undefined) {
          const containerRect = dom.gameContainer.getBoundingClientRect();
          const cx = clientX - containerRect.left;
          const cy = clientY - containerRect.top;

          dom.mobileDragPreview.style.display = "flex";
          dom.mobileDragPreview.style.left = `${cx}px`;
          dom.mobileDragPreview.style.top = `${cy - 65}px`;

          if (dom.dragPreviewIcon) dom.dragPreviewIcon.textContent = "⚔️";
          if (dom.dragPreviewHp) {
            dom.dragPreviewHp.textContent = `HP ${state.hero.hp}`;
            dom.dragPreviewHp.style.color = "#ffffff";
          }
        }
      }
      e.preventDefault();
    }
  }

  // 算術的セル特定 ＆ なぞり連動3Dチルト効果
  function handleGlobalPointerMove(e) {
    if (!gameStarted || !pathTracker || !pathTracker.isDragging) return;
    recordInteraction(); // ✅ ドラッグ操作中もインタラクション時間を更新し、長考中のBGM停止を防ぐ

    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    if (clientX === undefined || clientY === undefined) return;

    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const px = clientX + scrollX;
    const py = clientY + scrollY;

    // 📱 スマホ専用：指隠れ防止ドラッグプレビュー表示
      if (window.innerWidth < 1024 && dom.mobileDragPreview && dom.gameContainer) {
        const containerRect = dom.gameContainer.getBoundingClientRect();
        const cx = clientX - containerRect.left;
        const cy = clientY - containerRect.top;

        dom.mobileDragPreview.style.display = "flex";
        dom.mobileDragPreview.style.left = `${cx}px`;
        dom.mobileDragPreview.style.top = `${cy - 65}px`;

        // リアルタイム予測値の取得
        const sim = simulatePathDetails();
        const path = pathTracker.path;
        if (path.length > 0) {
          const lastIdx = path[path.length - 1];
          const cell = gridData[lastIdx];
          
          let emoji = "⚔️";
          if (cell) {
            if (cell.type === 'monster') emoji = cell.val.shield ? "🛡️👾" : "👾";
            else if (cell.type === 'boss') emoji = "👹";
            else if (cell.type === 'potion') emoji = "🧪";
            else if (cell.type === 'sword') emoji = "🗡️";
            else if (cell.type === 'trap') emoji = "🕸️";
            else if (cell.type === 'key') emoji = "🔑";
            else if (cell.type === 'chest') emoji = "🎁";
            else if (cell.type === 'door') emoji = "🚪";
            else if (cell.type === 'warp') emoji = "🌀";
          }
          
          if (dom.dragPreviewIcon) dom.dragPreviewIcon.textContent = emoji;
          if (dom.dragPreviewHp) {
            dom.dragPreviewHp.textContent = sim.hp <= 0 ? "💀 死亡予測" : `HP ${sim.hp}`;
            dom.dragPreviewHp.style.color = sim.hp <= 0 ? "#ff3b30" : "#ffffff";
          }
        }
      }

    // 🧠 人間工学的スナップ判定: 各セルの中心点からの距離を測定し、最も近いセルに滑らかに吸着させる
    let closestIdx = -1;
    let minDistance = Infinity;

    const path = pathTracker ? pathTracker.path : [];
    const len = cellBoundsCache.length;
    const pathLen = path.length;
    const prevIdx = pathLen > 1 ? path[pathLen - 2] : -1;

    for (let i = 0; i < len; i++) {
      const bounds = cellBoundsCache[i];
      const centerX = (bounds.left + bounds.right) / 2;
      const centerY = (bounds.top + bounds.bottom) / 2;
      const dx = px - centerX;
      const dy = py - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const cellWidth = bounds.right - bounds.left;
      
      // ✅ ヒステリシス設計: 一歩戻る(Undo)対象のセルの場合のみ、指が深く中心に近づく（半径40%以下）までUndo判定を抑制する。
      // 進むセルの場合は、吸着しやすいように従来どおり緩めの判定（半径75%以下）を適用する。
      let activeRadius = cellWidth * 0.75;
      if (i === prevIdx) {
        activeRadius = cellWidth * 0.50;
      }

      if (dist < activeRadius && dist < minDistance) {
        minDistance = dist;
        closestIdx = i;
      }
    }

    if (closestIdx !== -1) {
      pathTracker.moveTo(closestIdx);
    }
    e.preventDefault();
  }

  // 高DPI/Retinaディスプレイ対応のCanvas鮮明化最適化
  function resizeCanvas() {
    const wrap = dom.gridSectionWrap;
    if (wrap) {
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();

      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      _feverGradCache = null; // ✅ サイズ変更時はグラデーションキャッシュをリセット
      isCanvasClean = false; // ✅ サイズ変更時は強制的にクリア状態をフラッシュ
    }
    if (gameStarted) cacheCellBounds();
  }

  // ─── セーブ・ロード ───
  function saveGame() {
    try {
      state.settings.lastSaveTime = Date.now();
      const json = JSON.stringify(state);
      
      const encrypted = encryptData(json);
      const chk = generateChecksum(encrypted);
      
      localStorage.setItem(SAVE_KEY, encrypted);
      localStorage.setItem(SAVE_KEY + "_chk", chk);
    } catch(e) {
      console.warn("セーブ失敗:", e);
    }
  }

  function loadGame() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      const chk = localStorage.getItem(SAVE_KEY + "_chk");

      if (data) {
        if (generateChecksum(data) !== chk) {
          showToast("⚠️ セーブデータの改ざん・不整合を検知しました。");
          return;
        }

        const decrypted = decryptData(data);
        if (!decrypted) return;

        const parsed = JSON.parse(decrypted);
        if (parsed && typeof parsed === 'object') {
          const merged = deepMerge(structuredClone(defaultState), parsed);
          for (const key in merged) {
            state[key] = merged[key];
          }
        }
      }
    } catch(e) {
      console.error("ロード失敗:", e);
    }
  }

  function toggleAudioMode() {
    state.settings.audioMode = state.settings.audioMode === 0 ? 1 : 0;
    UIManager.updateAudioButtonVisual();
    AudioManager.playSound('buy');
    saveGame();
  }

  // 💻 キーボード操作ショートカットハンドラ
  function handleKeyDown(e) {
    if (!gameStarted) return;
    
    const key = e.key;

    // 各種モーダル（クリア、敗北ショップ、エンディング、スタート）が露出しているか
    const isClearOpen = dom.clearModal && dom.clearModal.style.display === "flex";
    const isShopOpen = dom.shopModal && dom.shopModal.style.display === "flex";
    const isVictoryOpen = dom.victoryModal && dom.victoryModal.style.display === "flex";
    const isStartOpen = dom.startOverlay && dom.startOverlay.style.display !== "none";
    const isAnyModalVisible = isClearOpen || isShopOpen || isVictoryOpen || isStartOpen;
    
    // 1. Space/Enterによるステージクリア・ゲームオーバーの進行（モーダル表示中のみ受付）
    if (key === ' ' || key === 'Enter') {
      if (isClearOpen) {
        nextFloor();
        e.preventDefault();
      } else if (isShopOpen) {
        retryGame();
        e.preventDefault();
      }
      return;
    }

    // モーダル表示中はRキー巻き戻しやアップグレード購入などのゲームプレイアクションキーをブロック
    if (isAnyModalVisible) return;
    

    
    // 3. 1〜5キーによるアップグレード購入（誤爆防止のため、ゲームオーバー中のショップ画面のみキー購入を許可）
    // ※通常のPC大画面プレイ中は誤爆リスクが高いため、キー購入は無効化し、マウスでのクリック購入のみ許可する
    if (key >= '1' && key <= '5') {
      if (isShopOpen) {
        const upgradeKeys = ['hp', 'atk', 'potion', 'gold', 'key'];
        const targetUpgrade = upgradeKeys[parseInt(key, 10) - 1];
        buyUpgrade(targetUpgrade);
        e.preventDefault();
      }
    }
  }

  function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "toast-message";
    toast.textContent = message;
    toast.style.opacity = 1;
    dom.gameContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = 0;
      setTimeout(() => toast.remove(), 400);
    }, 1800);
  }

  // 🔑 アーティファクトアンロック判定
  // ✅ saveGame()重複呼び出し廃止: 呼び出し元のexecutePath末尾で1回だけ保存する
  function unlockBossArtifact(floor) {
    const goldBonus = 1500 * state.loopCount;

    if (floor === 10) {
      if (!state.artifacts.fang) {
        state.artifacts.fang = true;
        showToast("🩸 秘宝『吸血の牙』を獲得しました！");
      } else {
        state.gold += goldBonus;
        state.totalGoldEarned += goldBonus;
        showToast(`🩸 秘宝共鳴ボーナス！🪙+${goldBonus} G`);
        writeTerminalLog(`秘宝『吸血の牙』の共鳴ボーナスとして ${goldBonus} G 獲得`, "gain");
      }
    } else if (floor === 15) {
      if (!state.artifacts.hourglass) {
        state.artifacts.hourglass = true;
        showToast("⌛ 秘宝『時の砂時計』を獲得しました！");
      } else {
        state.gold += goldBonus;
        state.totalGoldEarned += goldBonus;
        showToast(`⌛ 秘宝共鳴ボーナス！🪙+${goldBonus} G`);
        writeTerminalLog(`秘宝『時の砂時計』の共鳴ボーナスとして ${goldBonus} G 獲得`, "gain");
      }
    } else if (floor === 20) {
      if (!state.artifacts.boots) {
        state.artifacts.boots = true;
        showToast("🪽 秘宝『浮遊の靴』を獲得しました！");
      } else {
        state.gold += goldBonus;
        state.totalGoldEarned += goldBonus;
        showToast(`🪽 秘宝共鳴ボーナス！🪙+${goldBonus} G`);
        writeTerminalLog(`秘宝『浮遊の靴』の共鳴ボーナスとして ${goldBonus} G 獲得`, "gain");
      }
    } else if (floor === 25) {
      if (!state.artifacts.towel) {
        state.artifacts.towel = true;
        showToast("🧣 秘宝『宇宙旅行用タオル』を獲得しました！");
      } else {
        state.gold += goldBonus;
        state.totalGoldEarned += goldBonus;
        showToast(`🧣 秘宝共鳴ボーナス！🪙+${goldBonus} G`);
        writeTerminalLog(`秘宝『宇宙旅行用タオル』の共鳴ボーナスとして ${goldBonus} G 獲得`, "gain");
      }
    } else if (floor === 30) {
      if (!state.artifacts.sword) {
        state.artifacts.sword = true;
        showToast("⚔️ 秘宝『ルーンの剣』を獲得しました！");
      } else {
        state.gold += goldBonus;
        state.totalGoldEarned += goldBonus;
        showToast(`⚔️ 秘宝共鳴ボーナス！🪙+${goldBonus} G`);
        writeTerminalLog(`秘宝『ルーンの剣』の共鳴ボーナスとして ${goldBonus} G 獲得`, "gain");
      }
    } else if (floor === 40) {
      if (!state.artifacts.chalice) {
        state.artifacts.chalice = true;
        showToast("🏆 秘宝『黄金の杯』を獲得しました！");
      } else {
        state.gold += goldBonus;
        state.totalGoldEarned += goldBonus;
        showToast(`🏆 秘宝共鳴ボーナス！🪙+${goldBonus} G`);
        writeTerminalLog(`秘宝『黄金の杯』の共鳴ボーナスとして ${goldBonus} G 獲得`, "gain");
      }
    }
  }

  // スマホ対応：アーティファクトの動的説明表示
  function handleArtifactClick(e) {
    const badge = e.target.closest('.art-badge');
    if (!badge) return;

    const artKey = badge.dataset.art;
    const isUnlocked = state.artifacts[artKey];
    
    let name = "";
    let desc = "";
    let condition = "";

    if (artKey === 'fang') {
      name = "🩸 吸血の牙";
      desc = "モンスター撃破時に最大HPの3%を即座に回復する。";
      condition = "10Fのボスがドロップ。";
    } else if (artKey === 'hourglass') {
      name = "⌛ 時の砂時計";
      desc = "HPが0になってゲームオーバーになった瞬間、1フロアにつき1回だけフロア開始時に時を巻き戻して復活する。";
      condition = "15Fのボスがドロップ。";
    } else if (artKey === 'boots') {
      name = "🪽 浮遊の靴";
      desc = "トゲ床（罠）から受けるダメージを最大HPの15%から5%に軽減する。";
      condition = "20Fのボスがドロップ。";
    } else if (artKey === 'towel') {
      name = "🧣 宇宙旅行用タオル";
      desc = "あらゆるトラップ（クモの巣など）のダメージを完全に無効化する。";
      condition = "25Fのボスがドロップ。";
    } else if (artKey === 'sword') {
      name = "⚔️ ルーンの剣";
      desc = "ソード（武器）を拾った際の一時攻撃力バフ倍率が1.8倍から2.5倍に強化される。";
      condition = "30Fのボスがドロップ。";
    } else if (artKey === 'chalice') {
      name = "🏆 黄金の杯";
      desc = "宝箱（Chest）を開けたときの獲得ゴールドが2倍に増加する。";
      condition = "40Fのボスがドロップ。";
    }

    dom.previewDefaultView.style.display = "none";
    dom.battleLogView.style.display = "block";
    
    const statusText = isUnlocked ? `<span style="color:#2ecc71;">【有効中】</span>` : `<span style="color:#95a5a6;">【未解放】</span>`;
    dom.battleLogText.innerHTML = `<strong>${name} ${statusText}</strong><br>${desc}<br><span style="font-size:0.6rem; opacity:0.8;">解放条件: ${condition}</span>`;

    AudioManager.playSound('connect');
  }

  // ─── イベントバインド ───
  function bindEvents() {
    dom.soundBtn.addEventListener("click", () => toggleAudioMode());


    // 💻 キーボードショートカットの登録
    window.addEventListener("keydown", handleKeyDown);

    document.getElementById("shop-btn-hp").addEventListener("click", () => buyUpgrade('hp'));
    document.getElementById("shop-btn-atk").addEventListener("click", () => buyUpgrade('atk'));
    document.getElementById("shop-btn-potion").addEventListener("click", () => buyUpgrade('potion'));
    document.getElementById("shop-btn-gold").addEventListener("click", () => buyUpgrade('gold'));
    document.getElementById("shop-btn-key").addEventListener("click", () => buyUpgrade('key'));

    dom.retryBtn.addEventListener("click", () => retryGame());
    dom.nextFloorBtn.addEventListener("click", () => nextFloor());
    dom.victoryResetBtn.addEventListener("click", () => resetVictoryGame());

    dom.gridContainer.addEventListener("pointerdown", handleGridPointerDown);

    window.addEventListener("pointermove", handleGlobalPointerMove, { passive: false });
    window.addEventListener("touchmove", handleGlobalPointerMove, { passive: false });

    dom.artifactSlots.addEventListener("pointerdown", handleArtifactClick);

    // はみ出し誤操作キャンセル設計
    const endDrag = (e) => {
      if (pathTracker && pathTracker.isDragging) {
        const clientX = e.clientX || (e.changedTouches && e.changedTouches[0]?.clientX);
        const clientY = e.clientY || (e.changedTouches && e.changedTouches[0]?.clientY);

        let isInsideGrid = false;
        if (clientX !== undefined && clientY !== undefined) {
          const scrollY = window.pageYOffset || document.documentElement.scrollTop;
          const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
          const px = clientX + scrollX;
          const py = clientY + scrollY;

          const len = cellBoundsCache.length;
          for (let i = 0; i < len; i++) {
            const bounds = cellBoundsCache[i];
            if (px >= (bounds.left - 5) && px <= (bounds.right + 5) && 
                py >= (bounds.top - 5) && py <= (bounds.bottom + 5)) {
              isInsideGrid = true;
              break;
            }
          }
        }

        const finalPath = pathTracker.end();
        
        if (!isInsideGrid && finalPath.length > 0) {
          AudioManager.playSound('disconnect');
          showToast("なぞりをキャンセルしました ❄️");
          simulatePathEffects();
        } else {
          // ✅ 空セルのみのパスを棄却（無駄なターン消費を防止）
          const hasMeaningfulCell = finalPath.slice(1).some(i => gridData[i] !== null);
          if (hasMeaningfulCell) {
            executePath(finalPath);
          } else if (finalPath.length >= 2) {
            showToast("目標セルを含むルートを描いてみましょう！");
            simulatePathEffects();
          }
        }

        const panels = dom.gridContainer.children;
        const pLen = panels.length;
        for (let i = 0; i < pLen; i++) {
          const badge = panels[i]?.querySelector(".panel-prediction-badge");
          if (badge) {
            badge.textContent = "";
            badge.className = "panel-prediction-badge";
          }
        }

        // 🟢 HP予測表示と死亡警告の強制リセット
        if (dom.hpBarPrediction && dom.hpBarContainer) {
          dom.hpBarPrediction.style.width = "0%";
          dom.hpBarPrediction.style.left = "100%";
          dom.hpBarContainer.classList.remove("death-warning");
        }

        // 📱 スマホプレビューの非表示化
        if (dom.mobileDragPreview) {
          dom.mobileDragPreview.style.display = "none";
        }
      }

    };

    window.removeEventListener("pointerup", endDrag);
    window.addEventListener("pointerup", endDrag);

    window.removeEventListener("touchend", endDrag);
    window.addEventListener("touchend", endDrag);

    // 🕹️ 能動的スタートボタンイベント
    dom.startPlayBtn.addEventListener("click", () => {
      AudioManager.init();

      gameStarted = true;
      dom.startOverlay.style.display = "none";

      recordInteraction();
      loadGame();
      updateSkinForFloor();
      generateFloorData();
      
      setTimeout(cacheCellBounds, 100);

      UIManager.isDirty = true;
      requestAnimationFrame(mainLoop);
    });

    const userEvents = ['mousedown', 'touchstart', 'pointerdown', 'keydown'];
    userEvents.forEach(evt => {
      window.addEventListener(evt, () => recordInteraction(), { passive: true });
    });
  }

  function run() {
    initDOMCache();
    bindEvents();
    pathTracker = new PathTracker();

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (AudioManager.ctx) AudioManager.ctx.suspend();
      } else {
        if (AudioManager.ctx && state.settings.audioMode !== 0 && gameStarted) {
          AudioManager.ctx.resume().catch(() => {});
        }
      }
    });

    setInterval(updateDragGuideVisual, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
