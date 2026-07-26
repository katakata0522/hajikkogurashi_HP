(function () {
  'use strict';

  // 📖 スライム図鑑の定義
  const DEX_CONFIG = {
    "1-normal": { name: "ぷにぷにドロップ", desc: "水たまりから生まれた、ぷるぷる of 基本スライム。おっとりとした性格で、跳ねるのが大好き。", type: "通常", colorClass: "slime-lv1" },
    "2-normal": { name: "ふたばスライム", desc: "頭から小さなふたばが生えた、自然を愛するスライム。光合成をするとゴールドの生産量が上がるらしい。", type: "通常", colorClass: "slime-lv2" },
    "3-normal": { name: "いちごベリー", desc: "甘酸っぱい香りが漂う、いちごのようなスライム。種のような模様は、実は小さなハートのドット。", type: "通常", colorClass: "slime-lv3" },
    "4-normal": { name: "ハニーバブル", desc: "蜂たちが集まる、甘いハチミツのスライム。体から滲み出る蜜は極上のスイーツとして取引される。", type: "通常", colorClass: "slime-lv4" },
    "5-normal": { name: "ソーダフロート", desc: "シュワシュワと泡立つ炭酸が爽快なスライム。怒るとシュワシュワの泡をたくさん噴き出す。", type: "通常", colorClass: "slime-lv5" },
    "6-normal": { name: "キャンドルナイト", desc: "暗闇を優しく照らす、揺らめく灯火のスライム。静かな夜に彼らを集めて読書をするのが牧場主の密かな趣味。", type: "通常", colorClass: "slime-lv6" },
    "7-normal": { name: "マジカルクラウン", desc: "小さな王冠を戴いた、魔法使いのスライム。手に持たないタイプの魔法を使い、牧場の繁栄を祈る。", type: "通常", colorClass: "slime-lv7" },
    "8-normal": { name: "スペースコスモ", desc: "体の中に無限の宇宙を宿したスライム。彼らの内部に見える星々は、本当にどこか別の銀河を映しているらしい。", type: "通常", colorClass: "slime-lv8" },
    "9-normal": { name: "ゴールドフィーバー", desc: "黄金の輝きを放ち、周囲を豊かにするスライム。彼らが跳ねた跡には、きらめく金粉が残る。", type: "通常", colorClass: "slime-lv9" },
    "10-normal": { name: "レインボーキング", desc: "すべてのスライムを統べる、虹色の伝説の王。その輝きは多元宇宙の隅々まで照らし出す。", type: "通常", colorClass: "slime-lv10" },

    "1-shiny": { name: "星ドロップ", desc: "星屑が逆巻いて生まれた、光り輝く奇跡のドロップ。通常の5倍の速度で輝きを放つ。", type: "シャイニー", colorClass: "slime-lv1" },
    "2-shiny": { name: "黄金のふたば", desc: "太陽の強烈な光を浴びて黄金に輝く葉を持つスライム。その輝きは枯れることがない。", type: "シャイニー", colorClass: "slime-lv2" },
    "3-shiny": { name: "極上いちご", desc: "1粒数万円の価値があると言われる、幻のイチゴスライム。芳醇な甘みとゴールドを放つ。", type: "シャイニー", colorClass: "slime-lv3" },
    "4-shiny": { name: "ロイヤルハニー", desc: "王室御用達の超濃厚なハチミツを秘めたスライム。彼らがいる牧場には幸運が訪れる。", type: "シャイニー", colorClass: "slime-lv4" },
    "5-shiny": { name: "クリスタルソーダ", desc: "氷のように透明で美しい、奇跡 of 炭酸スライム。放たれる冷気は牧場全体を心地よく冷やす。", type: "シャイニー", colorClass: "slime-lv5" },
    "6-shiny": { name: "ゴーストキャンドル", desc: "妖しく青く燃え盛る、魂 of 灯火スライム。その火は熱くなく、触れた者の心を穏やかにする。", type: "シャイニー", colorClass: "slime-lv6" },
    "7-shiny": { name: "大魔導士クラウン", desc: "禁忌 of 魔導書を修めた、最高位魔術師スライム。詠唱を必要とせず、一瞬でゴールドを創り出す。", type: "シャイニー", colorClass: "slime-lv7" },
    "8-shiny": { name: "ギャラクシー銀河", desc: "体の中にブラックホールと超新星を抱く宇宙スライム。彼らの重力は周囲のゴールドを引き寄せる。", type: "シャイニー", colorClass: "slime-lv8" },
    "9-shiny": { name: "アルティメットゴールド", desc: "触れるものすべてを純金に変える伝説の黄金スライム。牧場のゴールドインフレの元凶。", type: "シャイニー", colorClass: "slime-lv9" },
    "10-shiny": { name: "レインボーエンペラー", desc: "多元宇宙を支配する、無限 of 輝きを持つ究極の皇帝。すべての存在がひれ伏すほどの威光を放つ。", type: "シャイニー", colorClass: "slime-lv10" }
  };

  const SPIN_PRIZES = [
    { name: "100 G", type: "gold", val: 100, color: "#e74c3c" },
    { name: "Lv.1スライム", type: "slime", val: 1, color: "#3498db" },
    { name: "500 G", type: "gold", val: 500, color: "#2ecc71" },
    { name: "30秒ワープ⏳", type: "warp", val: 30, color: "#9b59b6" },
    { name: "1,000 G", type: "gold", val: 1000, color: "#f1c40f" },
    { name: "Lv.3スライム", type: "slime", val: 3, color: "#e67e22" },
    { name: "3,000 G", type: "gold", val: 3000, color: "#1abc9c" },
    { name: "Lv.5スライム", type: "slime", val: 5, color: "#34495e" }
  ];

  const PARTICLE_POOL_SIZE = 80;
  const FLOAT_POOL_SIZE = 35;

  const GameConfig = {
    slotUpgradeCosts: { 13: 500, 14: 2000, 15: 8000, 16: 30000 },
    slimeConfig: {
      1: { name: "ぷにぷにドロップ", cps: 1, class: "slime-lv1" },
      2: { name: "ふたばスライム", cps: 3, class: "slime-lv2" },
      3: { name: "いちごベリー", cps: 8, class: "slime-lv3" },
      4: { name: "ハニーバブル", cps: 22, class: "slime-lv4" },
      5: { name: "ソーダフロート", cps: 60, class: "slime-lv5" },
      6: { name: "キャンドルナイト", cps: 150, class: "slime-lv6" },
      7: { name: "マジカルクラウン", cps: 400, class: "slime-lv7" },
      8: { name: "スペースコスモ", cps: 1200, class: "slime-lv8" },
      9: { name: "ゴールドフィーバー", cps: 4000, class: "slime-lv9" },
      10: { name: "レインボーキング", cps: 15000, class: "slime-lv10" }
    },
    dexConfig: DEX_CONFIG,
    spinPrizes: SPIN_PRIZES,
    maxPrestigeMutLevel: 5,
    maxPrestigeFeverLevel: 5,
    maxPrestigeStartLevel: 2,
    baseFeverDuration: 10,
    baseMutationProb: 0.03,
    feverMultiplier: 10,
    boostMultiplier: 3
  };

  const SAVE_KEY = "bouncy_slime_ranch_save_v2.5";
  const canvas = document.getElementById("effect-canvas");
  const ctx = canvas.getContext("2d");

  // ローカル状態管理
  let draggedIdx = null;
  let activeBalloonEl = null;
  let isSpinning = false;
  let lastMergeTime = 0;
  let comboCount = 0;
  let lastUserInteractionTime = Date.now();
  let gameStarted = false; // 自動再生ポリシー能動的解決フラグ

  const skillCooldowns = {
    rain: { max: 45, current: 0, timer: null },
    warp: { max: 90, current: 0, timer: null }
  };

  // デフォルトのゲーム状態テンプレート (ディープマージのベース)
  const defaultState = {
    economy: {
      gold: 50,
      totalGoldEarned: 50,
      baseCps: 0,
      boostMultiplier: 1,
      buyPrice: 10
    },
    ranch: {
      grid: Array(16).fill(null),
      unlockedSlots: 12
    },
    upgrades: {
      autoMerge: false,
      autoSpawn: false,
      maxBuyLicense: false
    },
    stats: {
      mergeCount: 0,
      maxLevelReached: 1
    },
    achievements: {
      merge5: false,
      slots14: false,
      level5: false,
      gold10k: false,
      prestige1: false,
      level10: false
    },
    discoveredSlimes: {},
    prestige: {
      prestigeCount: 0,
      prestigeStars: 0,
      mutProbLevel: 0,
      feverDurationLevel: 0,
      startLevel: 0
    },
    system: {
      tutorialCompleted: false,
      currentSkin: 'green',
      audioMode: 3,
      lastSaveTime: Date.now(),
      lastSpinTime: 0,
      boostTimer: 0
    },
    fever: {
      gauge: 0,
      timer: 0
    }
  };

  // ⚡ 1. ディープマージ復元処理 (古いセーブデータ互換性の完全解決)
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

  // ⚡ 2. Proxy によるディープ・リアクティブ状態監視システムの実装 (DirtyFlag自動トリガー)
  function createReactiveState(target, onDirty) {
    const handler = {
      get(obj, prop) {
        const val = obj[prop];
        if (val !== null && typeof val === 'object') {
          return new Proxy(val, handler);
        }
        return val;
      },
      set(obj, prop, value) {
        if (obj[prop] !== value) {
          obj[prop] = value;
          onDirty();
        }
        return true;
      }
    };
    return new Proxy(target, handler);
  }

  // リアクティブ化された状態オブジェクト
  const state = createReactiveState(JSON.parse(JSON.stringify(defaultState)), () => {
    UIManager.isDirty = true; // 状態が変更されたらDirtyフラグを自動起立
  });

  const ranch = state.ranch;
  const economy = state.economy;

  // 主要DOMキャッシュ
  const dom = {};
  function initDOMCache() {
    dom.gameContainer = document.getElementById("game-container");
    dom.goldDisplay = document.getElementById("gold-display");
    dom.cpsDisplay = document.getElementById("cps-display");
    dom.buyPriceDisplay = document.getElementById("price-display");
    dom.buyLabel = document.getElementById("buy-label");
    dom.buyBtn = document.getElementById("buy-btn");
    dom.maxBuyBtn = document.getElementById("max-buy-btn");
    dom.prestigeDisplay = document.getElementById("prestige-display");
    dom.feverBar = document.getElementById("fever-bar");
    dom.feverText = document.getElementById("fever-text");

    dom.maxLevelLabel = document.getElementById("max-level-label");
    dom.progressFill = document.getElementById("progress-track-fill");
    dom.prestigeStarsDisplay = document.getElementById("prestige-stars-display");

    dom.starUpgradeMutDesc = document.getElementById("star-upgrade-mut-desc");
    dom.starUpgradeMutBtn = document.getElementById("star-upgrade-mut-btn");
    dom.starUpgradeFeverDesc = document.getElementById("star-upgrade-fever-desc");
    dom.starUpgradeFeverBtn = document.getElementById("star-upgrade-fever-btn");
    dom.starUpgradeLevelDesc = document.getElementById("star-upgrade-level-desc");
    dom.starUpgradeLevelBtn = document.getElementById("star-upgrade-level-btn");

    dom.slotUpgradeTitle = document.getElementById("slot-upgrade-title");
    dom.slotUpgradeBtn = document.getElementById("slot-upgrade-btn");
    dom.autoMergeBtn = document.getElementById("auto-merge-btn");
    dom.autoSpawnBtn = document.getElementById("auto-spawn-btn");
    dom.maxbuyLicenseBtn = document.getElementById("maxbuy-license-btn");

    dom.prestigeBtn = document.getElementById("prestige-btn");
    dom.prestigeDescLabel = document.getElementById("prestige-desc-label");

    dom.ranchGrid = document.getElementById("ranch-grid");
    dom.upgradeList = document.getElementById("upgrade-list");
    dom.achievementList = document.getElementById("achievement-list");
    dom.dexList = document.getElementById("dex-list");
    dom.dexGrid = document.getElementById("dex-grid");
    dom.dexPct = document.getElementById("dex-pct");
    dom.dexCount = document.getElementById("dex-count");

    dom.toastMessage = document.getElementById("toast-message");
    dom.dragGuideHand = document.getElementById("drag-guide-hand");
  }

  // 改ざん検知
  function generateChecksum(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  // ─── 音響システム ───
  const AudioManager = {
    ctx: null,
    bgmGainNode: null,
    notes: [
      [261.63, 329.63, 392.00], // C
      [220.00, 261.63, 329.63], // Am
      [174.61, 220.00, 261.63], // F
      [196.00, 246.94, 293.66]  // G
    ],
    currentChord: 0,
    bgmInterval: null,
    activeVoices: [],
    maxVoices: 12,

    init() {
      if (this.ctx === null) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.bgmGainNode = this.ctx.createGain();
        this.bgmGainNode.connect(this.ctx.destination);
        this.setVolume();

        const audioMode = state.system.audioMode;
        if (audioMode === 1 || audioMode === 3) this.startBgmLoop();
      }
    },

    setVolume() {
      if (!this.bgmGainNode) return;
      this.bgmGainNode.gain.setValueAtTime(0.015, this.ctx.currentTime);
    },

    startBgmLoop() {
      if (!this.ctx) return;
      if (this.bgmInterval) clearInterval(this.bgmInterval);

      this.bgmInterval = setInterval(() => {
        const audioMode = state.system.audioMode;
        if ((audioMode !== 1 && audioMode !== 3) || this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        const chord = this.notes[this.currentChord];

        const delay = state.fever.timer > 0 ? 0.07 : 0.15;
        const pitchMultiplier = state.fever.timer > 0 ? 1.5 : 1.0;

        chord.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const noteGain = this.ctx.createGain();

          osc.connect(noteGain);
          noteGain.connect(this.bgmGainNode);

          osc.type = 'sine';
          const noteStart = now + idx * delay;
          osc.frequency.setValueAtTime(freq * pitchMultiplier, noteStart);

          noteGain.gain.setValueAtTime(0, now);
          noteGain.gain.linearRampToValueAtTime(0.12, noteStart + 0.04);
          noteGain.gain.exponentialRampToValueAtTime(0.001, noteStart + (state.fever.timer > 0 ? 1.4 : 2.8));

          osc.start(noteStart);
          osc.stop(noteStart + (state.fever.timer > 0 ? 1.5 : 2.9));

          this.registerVoice(osc, noteGain, noteStart + (state.fever.timer > 0 ? 1.5 : 2.9));
        });

        this.currentChord = (this.currentChord + 1) % this.notes.length;
      }, state.fever.timer > 0 ? 2200 : 4500);
    },

    registerVoice(osc, gain, stopTime) {
      const voiceObj = { osc, gain, stopTime };

      if (this.activeVoices.length >= this.maxVoices) {
        const oldVoice = this.activeVoices.shift();
        try {
          oldVoice.gain.gain.setValueAtTime(oldVoice.gain.gain.value, this.ctx.currentTime);
          oldVoice.gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);
          setTimeout(() => {
            oldVoice.osc.stop();
            oldVoice.osc.disconnect();
            oldVoice.gain.disconnect();
          }, 60);
        } catch(e){}
      }

      this.activeVoices.push(voiceObj);

      const durationMs = (stopTime - this.ctx.currentTime) * 1000;
      setTimeout(() => {
        const index = this.activeVoices.indexOf(voiceObj);
        if (index !== -1) {
          this.activeVoices.splice(index, 1);
          try {
            osc.disconnect();
            gain.disconnect();
          } catch(e){}
        }
      }, Math.max(10, durationMs));
    },

    playSynthesizedSound(type, xRatio = 0.5) {
      recordInteraction();
      const audioMode = state.system.audioMode;
      if (audioMode !== 2 && audioMode !== 3) return;
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();

      const now = this.ctx.currentTime;
      let finalDest = this.ctx.destination;

      if (this.ctx.createStereoPanner) {
        const panNode = this.ctx.createStereoPanner();
        panNode.pan.setValueAtTime((xRatio - 0.5) * 2, now);
        panNode.connect(this.ctx.destination);
        finalDest = panNode;
      }

      if (type === 'merge') {
        const comboFrequencies = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
        const pitchIdx = Math.min(comboCount, comboFrequencies.length - 1);
        const rootFreq = comboFrequencies[pitchIdx];
        const freqs = [rootFreq, rootFreq * 1.25, rootFreq * 1.5];

        freqs.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.connect(gain);
          gain.connect(finalDest);

          osc.type = idx === 0 ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(freq, now);
          osc.frequency.exponentialRampToValueAtTime(freq * 2, now + 0.35);

          gain.gain.setValueAtTime(0.12, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.start(now);
          osc.stop(now + 0.35);

          this.registerVoice(osc, gain, now + 0.35);
        });
      } else {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(finalDest);

        let duration = 0.15;
        if (type === 'buy') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(160, now);
          osc.frequency.exponentialRampToValueAtTime(450, now + 0.1);
          gain.gain.setValueAtTime(0.3, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
          duration = 0.15;
        } else if (type === 'sell') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(950, now);
          osc.frequency.setValueAtTime(1400, now + 0.05);
          gain.gain.setValueAtTime(0.22, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          duration = 0.25;
        } else if (type === 'boost') {
          osc.type = 'square';
          osc.frequency.setValueAtTime(250, now);
          osc.frequency.setValueAtTime(375, now + 0.08);
          osc.frequency.setValueAtTime(500, now + 0.16);
          osc.frequency.setValueAtTime(750, now + 0.24);
          gain.gain.setValueAtTime(0.15, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
          duration = 0.35;
        } else if (type === 'balloon') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(600, now);
          osc.frequency.exponentialRampToValueAtTime(2000, now + 0.2);
          gain.gain.setValueAtTime(0.32, now);
          gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
          duration = 0.25;
        } else if (type === 'mutation') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, now);
          osc.frequency.setValueAtTime(659.25, now + 0.08);
          osc.frequency.setValueAtTime(783.99, now + 0.16);
          osc.frequency.setValueAtTime(1046.50, now + 0.24);
          gain.gain.setValueAtTime(0.25, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
          duration = 0.5;
        } else if (type === 'fever_start') {
          const notesArr = [392.00, 523.25, 659.25, 783.99];
          notesArr.forEach((freq, idx) => {
            const fOsc = this.ctx.createOscillator();
            const fGain = this.ctx.createGain();
            fOsc.connect(fGain);
            fOsc.type = 'sawtooth';
            fOsc.frequency.setValueAtTime(freq, now + idx * 0.1);
            fGain.connect(this.ctx.destination);
            fGain.gain.setValueAtTime(0.15, now + idx * 0.1);
            fGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);
            fOsc.start(now + idx * 0.1);
            fOsc.stop(now + idx * 0.1 + 0.4);
            this.registerVoice(fOsc, fGain, now + idx * 0.1 + 0.4);
          });
          return;
        }

        osc.start(now);
        osc.stop(now + duration);
        this.registerVoice(osc, gain, now + duration);
      }
    }
  };

  // ─── 物理・グラフィックマネージャー ───
  const FXManager = {
    particlePool: [],
    floatPool: [],
    activeParticleIndices: [],
    activeFloatIndices: [],
    freeParticles: [],
    freeFloats: [],
    ambientObjects: [],

    init() {
      this.particlePool.length = 0;
      this.floatPool.length = 0;
      this.activeParticleIndices.length = 0;
      this.activeFloatIndices.length = 0;
      this.freeParticles.length = 0;
      this.freeFloats.length = 0;
      this.ambientObjects.length = 0;

      for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        this.particlePool.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, alpha: 0, size: 0, color: "", isRain: false, glow: false, index: i, type: "star" });
        this.freeParticles.push(i);
      }
      for (let i = 0; i < FLOAT_POOL_SIZE; i++) {
        this.floatPool.push({ active: false, x: 0, y: 0, text: "", color: "", alpha: 0, isPraise: false, isMini: false, index: i });
        this.freeFloats.push(i);
      }
    },

    getFreeParticle() {
      if (this.freeParticles.length > 0) {
        const idx = this.freeParticles.pop();
        const p = this.particlePool[idx];
        p.active = true;
        this.activeParticleIndices.push(idx);
        return p;
      }
      return null;
    },

    getFreeFloatText() {
      if (this.freeFloats.length > 0) {
        const idx = this.freeFloats.pop();
        const f = this.floatPool[idx];
        f.active = true;
        this.activeFloatIndices.push(idx);
        return f;
      }
      return null;
    },

    releaseParticle(p, activeArrayIdx) {
      p.active = false;
      this.freeParticles.push(p.index);
      this.activeParticleIndices.splice(activeArrayIdx, 1);
    },

    releaseFloat(f, activeArrayIdx) {
      f.active = false;
      this.freeFloats.push(f.index);
      this.activeFloatIndices.splice(activeArrayIdx, 1);
    },

    spawnCoinShower() {
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      for (let i = 0; i < 35; i++) {
        const p = this.getFreeParticle();
        if (p) {
          p.x = cx;
          p.y = cy;
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8;
          const speed = 4 + Math.random() * 7;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 2.5;
          p.alpha = 1.3;
          p.size = 6 + Math.random() * 5;
          p.color = "#f1c40f";
          p.isRain = false;
          p.glow = true;
          p.type = "coin";
        }
      }
    },

    spawnSlotParticles(slotIndex) {
      const slots = dom.ranchGrid.children;
      const targetSlot = slots[slotIndex];
      if (!targetSlot) return;

      const rect = targetSlot.getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();
      const cx = rect.left - containerRect.left + rect.width / 2;
      const cy = rect.top - containerRect.top + rect.height / 2;

      const colors = ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6"];
      for (let i = 0; i < 12; i++) {
        const p = this.getFreeParticle();
        if (p) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 2 + Math.random() * 3.5;
          p.x = cx;
          p.y = cy;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 1.2;
          p.alpha = 1.0;
          p.size = 5 + Math.random() * 5;
          p.color = colors[Math.floor(Math.random() * colors.length)];
          p.isRain = false;
          p.glow = false;
          p.type = "star";
        }
      }
    },

    spawnBigPraiseText(text, slotIndex) {
      const slots = dom.ranchGrid.children;
      const targetSlot = slots[slotIndex];
      if (!targetSlot) return;

      const rect = targetSlot.getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();
      const cx = rect.left - containerRect.left + rect.width / 2;
      const cy = rect.top - containerRect.top + rect.height / 2;

      const f = this.getFreeFloatText();
      if (f) {
        f.x = cx;
        f.y = cy - 25;
        f.text = text;
        f.color = "#ff007f";
        f.alpha = 2.0;
        f.isPraise = true;
        f.isMini = false;
      }

      const colors = ["#ff007f", "#ff7f00", "#ffff00", "#00ff00", "#00ffff", "#8b5cf6"];
      for (let i = 0; i < 22; i++) {
        const p = this.getFreeParticle();
        if (p) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3 + Math.random() * 6;
          p.x = cx;
          p.y = cy;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 1.8;
          p.alpha = 1.2;
          p.size = 6 + Math.random() * 7;
          p.color = colors[Math.floor(Math.random() * colors.length)];
          p.isRain = false;
          p.glow = true;
          p.type = "star";
        }
      }
    },

    spawnMutationPraiseText(text, slotIndex) {
      const slots = dom.ranchGrid.children;
      const targetSlot = slots[slotIndex];
      if (!targetSlot) return;

      const rect = targetSlot.getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();
      const cx = rect.left - containerRect.left + rect.width / 2;
      const cy = rect.top - containerRect.top + rect.height / 2;

      const f = this.getFreeFloatText();
      if (f) {
        f.x = cx;
        f.y = cy - 25;
        f.text = text;
        f.color = "#f1c40f";
        f.alpha = 2.5;
        f.isPraise = true;
        f.isMini = false;
      }

      for (let i = 0; i < 28; i++) {
        const p = this.getFreeParticle();
        if (p) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 3.5 + Math.random() * 7.5;
          p.x = cx;
          p.y = cy;
          p.vx = Math.cos(angle) * speed;
          p.vy = Math.sin(angle) * speed - 2.0;
          p.alpha = 1.3;
          p.size = 7 + Math.random() * 7;
          p.color = "#f1c40f";
          p.isRain = false;
          p.glow = true;
          p.type = "star";
        }
      }
    },

    spawnMiniCpsFloater(text, cx, cy) {
      const f = this.getFreeFloatText();
      if (f) {
        f.x = cx;
        f.y = cy;
        f.text = text;
        f.color = "#e67e22";
        f.alpha = 0.85;
        f.isPraise = false;
        f.isMini = true;
      }
    },

    spawnTextFloater(text, slotIndex, color) {
      const slots = dom.ranchGrid.children;
      const targetSlot = slots[slotIndex];
      if (!targetSlot) return;

      const rect = targetSlot.getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();

      const f = this.getFreeFloatText();
      if (f) {
        f.x = rect.left - containerRect.left + rect.width / 2;
        f.y = rect.top - containerRect.top + 10;
        f.text = text;
        f.color = color;
        f.alpha = 1.0;
        f.isPraise = false;
        f.isMini = false;
      }
    },

    spawnAmbientObject(skin, randomizeY = false) {
      return {
        x: Math.random() * canvas.width,
        y: randomizeY ? Math.random() * canvas.height : -10,
        vx: skin === 'cherry' ? 0.3 + Math.random() * 0.5 : 0,
        vy: skin === 'cherry' ? 0.5 + Math.random() * 0.8 : 0.05 + Math.random() * 0.1,
        size: skin === 'cherry' ? 4 + Math.random() * 5 : 1 + Math.random() * 2,
        alpha: 0.2 + Math.random() * 0.5,
        color: skin === 'cherry' ? "#ffc0cb" : "#ffffff",
        angle: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.04,
        type: skin
      };
    },

    updatePhysics(dt) {
      const skin = state.system.currentSkin;
      const isFever = state.fever.timer > 0;

      if (skin === 'cherry' || skin === 'space' || isFever) {
        const maxObjects = isFever ? 20 : 12;
        const spawnProb = isFever ? 0.15 : 0.03;

        if (this.ambientObjects.length < maxObjects && Math.random() < spawnProb) {
          this.ambientObjects.push(this.spawnAmbientObject(isFever ? 'space' : skin));
        }

        for (let i = this.ambientObjects.length - 1; i >= 0; i--) {
          const obj = this.ambientObjects[i];
          obj.x += obj.vx * dt;
          obj.y += (isFever ? obj.vy * 3 : obj.vy) * dt;

          if (obj.y > canvas.height || obj.x > canvas.width) {
            this.ambientObjects.splice(i, 1);
          }
        }
      }

      for (let i = this.activeParticleIndices.length - 1; i >= 0; i--) {
        const poolIdx = this.activeParticleIndices[i];
        const p = this.particlePool[poolIdx];

        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.isRain ? 0 : 0.15) * dt;
        p.alpha -= (p.isRain ? 0.045 : 0.02) * dt;

        if (p.alpha <= 0 || p.y > canvas.height) {
          this.releaseParticle(p, i);
        }
      }

      for (let i = this.activeFloatIndices.length - 1; i >= 0; i--) {
        const poolIdx = this.activeFloatIndices[i];
        const f = this.floatPool[poolIdx];

        f.y -= (f.isPraise ? 0.45 : (f.isMini ? 0.8 : 1.25)) * dt;
        f.alpha -= (f.isMini ? 0.045 : 0.025) * dt;

        if (f.alpha <= 0) {
          this.releaseFloat(f, i);
        }
      }
    },

    draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const isFever = state.fever.timer > 0;

      this.ambientObjects.forEach((obj, i) => {
        if (obj.type === 'cherry' && !isFever) {
          obj.angle += obj.spin;
          ctx.save();
          ctx.globalAlpha = obj.alpha;
          ctx.fillStyle = obj.color;
          ctx.translate(obj.x, obj.y);
          ctx.rotate(obj.angle);
          ctx.beginPath();
          ctx.ellipse(0, 0, obj.size, obj.size / 2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.globalAlpha = isFever ? obj.alpha * 1.5 : obj.alpha;
          ctx.fillStyle = isFever ? `hsl(${Math.random() * 360}, 100%, 75%)` : obj.color;
          ctx.beginPath();
          ctx.arc(obj.x, obj.y, obj.size * (0.65 + Math.abs(Math.sin(Date.now() / 250 + i)) * 0.35), 0, Math.PI * 2);
          ctx.fill();
        }
      });

      this.activeParticleIndices.forEach(poolIdx => {
        const p = this.particlePool[poolIdx];
        const useGlow = p.glow || isFever;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.fillStyle = p.color;

        if (useGlow) {
          ctx.shadowBlur = 8;
          ctx.shadowColor = p.color;
        }

        if (p.isRain) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, p.y + 11);
          ctx.stroke();
        } else if (p.type === "coin") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#d35400";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        } else {
          ctx.beginPath();
          this.drawStarPath(p.x, p.y, 5, p.size, p.size / 2);
          ctx.fill();
        }
        ctx.restore();
      });

      this.activeFloatIndices.forEach(poolIdx => {
        const f = this.floatPool[poolIdx];
        ctx.save();
        ctx.globalAlpha = Math.min(1, Math.max(0, f.alpha));

        if (f.isPraise) {
          const gradient = ctx.createLinearGradient(0, f.y - 18, 0, f.y + 8);
          gradient.addColorStop(0, "#ff007f");
          gradient.addColorStop(0.5, "#ffff00");
          gradient.addColorStop(1, "#8b5cf6");
          ctx.fillStyle = gradient;
          ctx.font = `black 900 22px 'Outfit', 'Noto Sans JP'`;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 4.5;
        } else if (f.isMini) {
          ctx.fillStyle = "#e67e22";
          ctx.font = `bold 10px 'Outfit', sans-serif`;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5;
        } else {
          ctx.fillStyle = f.color;
          ctx.font = `black 900 14px 'Outfit', 'Noto Sans JP'`;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5;
        }

        ctx.textAlign = "center";
        ctx.strokeText(f.text, f.x, f.y);
        ctx.fillText(f.text, f.x, f.y);
        ctx.restore();
      });
    },

    drawStarPath(cx, cy, spikes, outerRadius, innerRadius) {
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      let step = Math.PI / spikes;

      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
    }
  };

  // UIマネージャー
  const UIManager = {
    activeTab: 'ranch',
    isDirty: true, // ⚡ Dirty Flag 自動トリガーシステム
    cache: {
      gold: -1,
      cps: -1,
      maxLevel: -1,
      feverGauge: -1,
      feverTimer: -1,
      prestigeStars: -1
    },

    slotDirtyCache: Array(16).fill(null),

    init() {
      initDOMCache();
      this.switchTab('ranch');
      this.updateAudioButtonVisual();
    },

    updateAudioButtonVisual() {
      const soundBtn = document.getElementById("sound-btn");
      const mode = state.system.audioMode;
      if (mode === 3) soundBtn.innerText = "🔊 すべてON";
      else if (mode === 2) soundBtn.innerText = "💥 SEのみ";
      else if (mode === 1) soundBtn.innerText = "🎵 BGMのみ";
      else soundBtn.innerText = "🔇 ミュート";
    },

    switchTab(tab) {
      this.activeTab = tab;
      const tabRanch = document.getElementById("tab-ranch");
      const tabUpgrade = document.getElementById("tab-upgrade");
      const tabAch = document.getElementById("tab-achievement");
      const tabDex = document.getElementById("tab-dex");

      tabRanch.classList.toggle("active", tab === 'ranch');
      tabUpgrade.classList.toggle("active", tab === 'upgrade');
      tabAch.classList.toggle("active", tab === 'achievement');
      tabDex.classList.toggle("active", tab === 'dex');

      dom.ranchGrid.style.display = tab === 'ranch' ? 'grid' : 'none';
      dom.upgradeList.style.display = tab === 'upgrade' ? 'flex' : 'none';
      dom.achievementList.style.display = tab === 'achievement' ? 'flex' : 'none';

      if (tab === 'dex') {
        dom.dexList.style.display = "flex";
        this.buildDexDOM();
      } else {
        dom.dexList.style.display = "none";
      }
      this.isDirty = true;
    },

    render() {
      const fever = state.fever;
      const stats = state.stats;
      const prestige = state.prestige;

      if (this.cache.gold !== Math.floor(economy.gold)) {
        this.cache.gold = Math.floor(economy.gold);
        dom.goldDisplay.textContent = this.cache.gold.toLocaleString();
        this.updateUpgradeUI();
      }

      const finalCps = getFinalCps();
      if (this.cache.cps !== Math.floor(finalCps)) {
        this.cache.cps = Math.floor(finalCps);
        dom.cpsDisplay.textContent = this.cache.cps.toLocaleString();
      }

      if (this.cache.maxLevel !== stats.maxLevelReached) {
        this.cache.maxLevel = stats.maxLevelReached;
        dom.maxLevelLabel.textContent = this.cache.maxLevel;
        dom.progressFill.style.width = `${(this.cache.maxLevel / 10) * 100}%`;
      }

      if (this.cache.feverGauge !== fever.gauge || this.cache.feverTimer !== fever.timer) {
        this.cache.feverGauge = fever.gauge;
        this.cache.feverTimer = fever.timer;

        if (fever.timer > 0) {
          dom.feverBar.style.width = "100%";
          dom.feverBar.classList.add("fever-active");
          dom.feverText.classList.add("fever-active-txt");
          dom.feverText.textContent = `🔥 FEVER TIME: ${fever.timer}s 🔥`;
          dom.gameContainer.classList.add("fever-container-active");
        } else {
          dom.feverBar.style.width = `${fever.gauge}%`;
          dom.feverBar.classList.remove("fever-active");
          dom.feverText.classList.remove("fever-active-txt");
          dom.feverText.textContent = `FEVER GAUGE ${Math.floor(fever.gauge)}%`;
          dom.gameContainer.classList.remove("fever-container-active");
        }
      }

      if (prestige.prestigeCount > 0) {
        dom.prestigeDisplay.textContent = `転生 x${prestige.prestigeCount}`;
        dom.prestigeDisplay.style.display = "inline-block";
      } else {
        dom.prestigeDisplay.style.display = "none";
      }

      const startLv = 1 + (prestige.startLevel || 0);
      dom.buyLabel.textContent = `👾 購入 (Lv.${startLv})`;
      dom.buyPriceDisplay.textContent = economy.buyPrice.toLocaleString() + " G";

      const hasEmptySlot = getEmptySlotIndex() !== -1;
      dom.buyBtn.style.opacity = (economy.gold < economy.buyPrice || !hasEmptySlot) ? "0.75" : "1";

      if (!state.upgrades.maxBuyLicense) {
        dom.maxBuyBtn.disabled = true;
        dom.maxBuyBtn.textContent = "🔒 一括購入";
        dom.maxBuyBtn.style.opacity = "0.6";
      } else {
        dom.maxBuyBtn.disabled = (economy.gold < economy.buyPrice || !hasEmptySlot);
        dom.maxBuyBtn.textContent = "一括購入 (Max)";
        dom.maxBuyBtn.style.opacity = "1";
      }

      const slots = dom.ranchGrid.children;
      const achMul = getAchievementMultiplier();

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        if (i >= ranch.unlockedSlots) continue;

        const slimeData = ranch.grid[i];
        const slimeEl = slot.querySelector(".slime");
        const cacheKey = slimeData ? `${slimeData.level}-${slimeData.shiny ? 1 : 0}-${fever.timer > 0 ? 1 : 0}-${draggedIdx === i ? 1 : 0}` : "null";

        if (this.slotDirtyCache[i] !== cacheKey) {
          this.slotDirtyCache[i] = cacheKey;

          if (slimeData) {
            const config = GameConfig.slimeConfig[slimeData.level];
            let baseCps = config.cps;
            if (slimeData.shiny) baseCps *= 5;

            const wobbleClass = (fever.timer > 0 || draggedIdx === i) ? "wobble-active" : "";
            const jumpClass = fever.timer > 0 ? "slime-fever-jump" : "";

            if (!slimeEl) {
              const newSlime = document.createElement("div");
              newSlime.className = `slime ${config.class} ${slimeData.shiny ? 'shiny-slime' : ''} ${jumpClass} ${wobbleClass}`;
              newSlime.dataset.index = i;

              const face = document.createElement("div");
              face.className = "slime-face";
              face.innerHTML = `<div class="slime-eye"></div><div class="slime-eye"></div><div class="slime-mouth"></div>`;
              newSlime.appendChild(face);

              const badge = document.createElement("span");
              badge.className = "level-badge";
              badge.textContent = `Lv.${slimeData.level}${slimeData.shiny ? '✨' : ''}`;
              newSlime.appendChild(badge);

              const cpsB = document.createElement("span");
              cpsB.className = "cps-badge";
              cpsB.textContent = `+${Math.floor(baseCps * achMul)}/s`;
              newSlime.appendChild(cpsB);

              slot.appendChild(newSlime);
            } else {
              const badge = slimeEl.querySelector(".level-badge");
              const cpsBadge = slimeEl.querySelector(".cps-badge");
              const targetBadgeText = `Lv.${slimeData.level}${slimeData.shiny ? '✨' : ''}`;

              slimeEl.className = `slime ${config.class} ${slimeData.shiny ? 'shiny-slime' : ''} ${jumpClass} ${wobbleClass}`;

              if (badge) badge.textContent = targetBadgeText;
              if (cpsBadge) cpsBadge.textContent = `+${Math.floor(baseCps * achMul)}/s`;

              slimeEl.classList.add("merge-bounce", "wobble-active");
              setTimeout(() => {
                slimeEl.classList.remove("merge-bounce");
                if (state.fever.timer <= 0 && draggedIdx !== i) {
                  slimeEl.classList.remove("wobble-active");
                }
              }, 400);

              slimeEl.classList.add("slime-happy");
              setTimeout(() => slimeEl.classList.remove("slime-happy"), 1500);
            }
          } else {
            if (slimeEl) slimeEl.remove();
          }
        }
      }

      checkAchievements();
    },

    updateUpgradeUI() {
      const prestige = state.prestige;

      dom.prestigeStarsDisplay.textContent = prestige.prestigeStars;

      const curMutProb = 3.0 + (prestige.mutProbLevel * 1.5);
      dom.starUpgradeMutDesc.textContent = `発生率 +1.5%アップ (現在: ${curMutProb}% / 最大5段階)`;
      if (prestige.mutProbLevel >= GameConfig.maxPrestigeMutLevel) {
        dom.starUpgradeMutBtn.textContent = "済";
        dom.starUpgradeMutBtn.disabled = true;
      } else {
        dom.starUpgradeMutBtn.textContent = "1 🌟";
        dom.starUpgradeMutBtn.disabled = prestige.prestigeStars < 1;
      }

      const curFeverDur = 10 + (prestige.feverDurationLevel * 1);
      dom.starUpgradeFeverDesc.textContent = `継続時間 +1秒延長 (現在: ${curFeverDur}秒 / 最大5段階)`;
      if (prestige.feverDurationLevel >= GameConfig.maxPrestigeFeverLevel) {
        dom.starUpgradeFeverBtn.textContent = "済";
        dom.starUpgradeFeverBtn.disabled = true;
      } else {
        dom.starUpgradeFeverBtn.textContent = "1 🌟";
        dom.starUpgradeFeverBtn.disabled = prestige.prestigeStars < 1;
      }

      const curStartLv = 1 + (prestige.startLevel || 0);
      dom.starUpgradeLevelDesc.textContent = `購入時のスライムLvを+1 (現在: Lv.${curStartLv} / 最大Lv.3)`;
      if (prestige.startLevel >= GameConfig.maxPrestigeStartLevel) {
        dom.starUpgradeLevelBtn.textContent = "済";
        dom.starUpgradeLevelBtn.disabled = true;
      } else {
        dom.starUpgradeLevelBtn.textContent = "2 🌟";
        dom.starUpgradeLevelBtn.disabled = prestige.prestigeStars < 2;
      }

      const nextSlot = ranch.unlockedSlots + 1;
      const cost = GameConfig.slotUpgradeCosts[nextSlot];
      if (!cost) {
        dom.slotUpgradeTitle.textContent = "牧場拡張 (最大)";
        dom.slotUpgradeBtn.textContent = "済";
        dom.slotUpgradeBtn.disabled = true;
      } else {
        dom.slotUpgradeTitle.textContent = `牧場拡張 (${nextSlot}マス目)`;
        dom.slotUpgradeBtn.textContent = `${cost.toLocaleString()} G`;
        dom.slotUpgradeBtn.disabled = economy.gold < cost;
      }

      if (state.upgrades.autoMerge) {
        dom.autoMergeBtn.textContent = "済";
        dom.autoMergeBtn.disabled = true;
      } else {
        dom.autoMergeBtn.disabled = economy.gold < 1500;
      }

      if (state.upgrades.autoSpawn) {
        dom.autoSpawnBtn.textContent = "済";
        dom.autoSpawnBtn.disabled = true;
      } else {
        dom.autoSpawnBtn.disabled = economy.gold < 3000;
      }

      if (state.upgrades.maxBuyLicense) {
        dom.maxbuyLicenseBtn.textContent = "済";
        dom.maxbuyLicenseBtn.disabled = true;
      } else {
        dom.maxbuyLicenseBtn.disabled = economy.gold < 1000;
      }

      const hasLv8 = ranch.grid.some(slime => slime && slime.level >= 8);
      dom.prestigeBtn.disabled = !hasLv8;

      const nextStars = calculatePrestigeStars();
      dom.prestigeDescLabel.innerHTML = `条件: Lv.8スライムの保有<br>報酬: 基本1個＋高Lvボーナス (予定: +${nextStars} 🌟)`;
    },

    buildDexDOM() {
      dom.dexGrid.innerHTML = "";
      let discoveredCount = 0;

      Object.keys(GameConfig.dexConfig).forEach(key => {
        const config = GameConfig.dexConfig[key];
        const isDiscovered = state.discoveredSlimes[key] === true;

        const item = document.createElement("div");
        item.className = `dex-item ${isDiscovered ? 'discovered' : 'undiscovered'}`;

        if (isDiscovered) {
          discoveredCount++;
          item.onclick = () => openDexModal(key);
        } else {
          item.onclick = () => showToast("まだ発見していません！マージして見つけよう！");
        }

        const render = document.createElement("div");
        render.className = `dex-slime-render ${isDiscovered ? config.colorClass : ''}`;

        if (isDiscovered && key.includes("shiny")) {
          render.classList.add("shiny-slime");
        }

        const label = document.createElement("div");
        label.className = "dex-label";
        label.textContent = isDiscovered ? config.name : "？？？";

        const badge = document.createElement("div");
        badge.className = "dex-type-badge";
        badge.style.background = config.type === "シャイニー" ? "#f1c40f" : "#3498db";
        badge.textContent = config.type;

        item.appendChild(badge);
        item.appendChild(render);
        item.appendChild(label);
        dom.dexGrid.appendChild(item);
      });

      const total = Object.keys(GameConfig.dexConfig).length;
      const pct = Math.floor((discoveredCount / total) * 100);
      dom.dexPct.textContent = `${pct}%`;
      dom.dexCount.textContent = discoveredCount;
    }
  };

  // ドラッグ＆ドロップマネージャー
  const DragManager = {
    pointerId: null,
    draggedIdx: null,
    draggedEl: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    isMoving: false,

    onPointerDown(e) {
      initAudio();
      recordInteraction();
      if (this.pointerId !== null) return;

      const slime = e.currentTarget.querySelector(".slime");
      if (!slime) return;

      this.draggedEl = slime;
      this.draggedIdx = parseInt(slime.dataset.index);
      draggedIdx = this.draggedIdx;
      this.pointerId = e.pointerId;

      const rect = slime.getBoundingClientRect();
      this.startX = e.clientX - rect.left - rect.width / 2;
      this.startY = e.clientY - rect.top - rect.height / 2;

      slime.classList.add("slime-surprised", "wobble-active");

      const draggedLevel = ranch.grid[this.draggedIdx].level;
      const slots = dom.ranchGrid.children;
      for (let i = 0; i < slots.length; i++) {
        if (i < ranch.unlockedSlots && i !== this.draggedIdx) {
          const sData = ranch.grid[i];
          if (sData && sData.level === draggedLevel && draggedLevel < 10) {
            slots[i].classList.add("slot-highlight");
          }
        }
      }

      slime.style.pointerEvents = "none";
      slime.style.transform = `scale(1.15)`;
      document.getElementById("trash-bin").style.borderColor = "#ef4444";

      this.currentX = e.clientX;
      this.currentY = e.clientY;
      this.isMoving = true;

      this.boundMove = this.onPointerMove.bind(this);
      this.boundUp = this.onPointerUp.bind(this);

      window.addEventListener("pointermove", this.boundMove);
      window.addEventListener("pointerup", this.boundUp);
    },

    onPointerMove(e) {
      if (e.pointerId !== this.pointerId) return;
      this.currentX = e.clientX;
      this.currentY = e.clientY;
    },

    update() {
      if (!this.isMoving || !this.draggedEl) return;

      const gridRect = dom.ranchGrid.getBoundingClientRect();
      const x = this.currentX - gridRect.left - this.startX - this.draggedEl.offsetWidth / 2;
      const y = this.currentY - gridRect.top - this.startY - this.draggedEl.offsetHeight / 2;

      this.draggedEl.style.left = `${x}px`;
      this.draggedEl.style.top = `${y}px`;

      const trashRect = document.getElementById("trash-bin").getBoundingClientRect();
      const inTrash = this.currentX >= trashRect.left && this.currentX <= trashRect.right &&
                      this.currentY >= trashRect.top && this.currentY <= trashRect.bottom;

      document.getElementById("trash-bin").classList.toggle("drag-over", inTrash);

      if (inTrash) {
        this.draggedEl.classList.remove("slime-surprised");
        this.draggedEl.classList.add("slime-scared");
      } else {
        this.draggedEl.classList.remove("slime-scared");
        this.draggedEl.classList.add("slime-surprised");
      }
    },

    onPointerUp(e) {
      if (e.pointerId !== this.pointerId) return;

      window.removeEventListener("pointermove", this.boundMove);
      window.removeEventListener("pointerup", this.boundUp);

      this.isMoving = false;

      const slots = dom.ranchGrid.children;
      for (let i = 0; i < slots.length; i++) {
        slots[i].classList.remove("slot-highlight");
      }

      const trashRect = document.getElementById("trash-bin").getBoundingClientRect();
      const inTrash = this.currentX >= trashRect.left && this.currentX <= trashRect.right &&
                      this.currentY >= trashRect.top && this.currentY <= trashRect.bottom;

      if (inTrash) {
        sellSlime(this.draggedIdx);
      } else {
        if (this.draggedEl) this.draggedEl.style.display = "none";
        const targetSlot = document.elementFromPoint(this.currentX, this.currentY)?.closest(".grid-slot");
        if (this.draggedEl) this.draggedEl.style.display = "block";

        const targetIndex = targetSlot ? parseInt(targetSlot.dataset.index) : null;

        if (targetIndex !== null && targetIndex !== this.draggedIdx && targetIndex < ranch.unlockedSlots) {
          handleMergeOrSwap(this.draggedIdx, targetIndex);
        }
      }

      if (this.draggedEl) {
        this.draggedEl.style.pointerEvents = "auto";
        this.draggedEl.style.left = "";
        this.draggedEl.style.top = "";
        this.draggedEl.style.transform = "";
        this.draggedEl.classList.remove("slime-surprised", "slime-scared");

        if (state.fever.timer <= 0) {
          this.draggedEl.classList.remove("wobble-active");
        }
      }

      document.getElementById("trash-bin").style.borderColor = "";
      document.getElementById("trash-bin").classList.remove("drag-over");

      this.pointerId = null;
      this.draggedIdx = null;
      this.draggedEl = null;
      draggedIdx = null;

      updateCps();
    }
  };

  // タイマー管理
  const GameLoopManager = {
    lastAutoMergeTime: 0,
    lastAutoSpawnTime: 0,
    lastBalloonSpawnTime: 0,
    lastSaveTime: 0,
    lastOneSecTime: 0,

    init(now) {
      this.lastAutoMergeTime = now;
      this.lastAutoSpawnTime = now;
      this.lastBalloonSpawnTime = now;
      this.lastSaveTime = now;
      this.lastOneSecTime = now;
    },

    update(now) {
      if (now - lastUserInteractionTime >= 180000) {
        if (AudioManager.ctx && AudioManager.ctx.state === 'running') {
          AudioManager.ctx.suspend();
        }
      }

      if (now - this.lastOneSecTime >= 1000) {
        this.lastOneSecTime = now;
        this.onOneSecond();
      }
      if (now - this.lastAutoMergeTime >= 7500) {
        this.lastAutoMergeTime = now;
        this.onAutoMerge();
      }
      if (now - this.lastAutoSpawnTime >= 11500) {
        this.lastAutoSpawnTime = now;
        this.onAutoSpawn();
      }
      if (now - this.lastBalloonSpawnTime >= 30000) {
        this.lastBalloonSpawnTime = now;
        this.onBalloonSpawn();
      }
      if (now - this.lastSaveTime >= 5000) {
        this.lastSaveTime = now;
        this.onSave();
      }
    },

    onOneSecond() {
      const fever = state.fever;

      if (fever.timer > 0) {
        fever.timer--;

        const slots = dom.ranchGrid.children;
        const containerRect = dom.gameContainer.getBoundingClientRect();
        ranch.grid.forEach((slime, idx) => {
          if (slime && idx < ranch.unlockedSlots && Math.random() < 0.6) {
            const rect = slots[idx].getBoundingClientRect();
            const cx = rect.left - containerRect.left + rect.width / 2;
            const cy = rect.top - containerRect.top + rect.height / 2;

            const p = FXManager.getFreeParticle();
            if (p) {
              p.x = cx;
              p.y = cy - 10;
              p.vx = (Math.random() - 0.5) * 1.5;
              p.vy = -1.2 - Math.random() * 1.8;
              p.alpha = 1.0;
              p.size = 4 + Math.random() * 4;
              p.color = "#f1c40f";
              p.isRain = false;
              p.glow = true;
              p.type = "star";
            }
          }
        });

        if (fever.timer === 0) {
          fever.gauge = 0;
          showToast("フィーバータイム終了！");
          document.querySelectorAll(".slime").forEach(el => el.classList.remove("wobble-active"));
          if (state.system.audioMode === 1 || state.system.audioMode === 3) AudioManager.startBgmLoop();
        }
      }

      const achMul = getAchievementMultiplier();
      const feverMul = fever.timer > 0 ? GameConfig.feverMultiplier : 1;
      const slots = dom.ranchGrid.children;
      const containerRect = dom.gameContainer.getBoundingClientRect();

      ranch.grid.forEach((slime, idx) => {
        if (slime && idx < ranch.unlockedSlots) {
          const config = GameConfig.slimeConfig[slime.level];
          let baseCps = config.cps;

          if (slime.shiny) {
            baseCps *= 5;

            if (Math.random() < 0.4) {
              const rect = slots[idx].getBoundingClientRect();
              const cx = rect.left - containerRect.left + rect.width / 2 + (Math.random() - 0.5) * 20;
              const cy = rect.top - containerRect.top + rect.height / 2;

              const p = FXManager.getFreeParticle();
              if (p) {
                p.x = cx;
                p.y = cy;
                p.vx = (Math.random() - 0.5) * 0.6;
                p.vy = -0.6 - Math.random() * 0.8;
                p.alpha = 0.9;
                p.size = 3 + Math.random() * 3;
                p.color = "#f1c40f";
                p.isRain = false;
                p.glow = true;
                p.type = "star";
              }
            }
          }

          const gained = Math.floor(baseCps * economy.boostMultiplier * achMul * feverMul);
          if (gained > 0) {
            economy.gold += gained;
            economy.totalGoldEarned += gained;

            const rect = slots[idx].getBoundingClientRect();
            const cx = rect.left - containerRect.left + rect.width / 2 + (Math.random() - 0.5) * 10;
            const cy = rect.top - containerRect.top + 10;
            FXManager.spawnMiniCpsFloater(`+${gained}`, cx, cy);
          }
        }
      });

      if (state.system.boostTimer > 0) {
        state.system.boostTimer--;
        if (state.system.boostTimer === 0) {
          economy.boostMultiplier = 1;
          document.getElementById("boost-btn").classList.remove("boost-active");
          showToast("広告ブースト終了！");
        }
      }
    },

    onAutoMerge() {
      handleAutoMergeCycle();
    },

    onAutoSpawn() {
      handleAutoSpawnCycle();
    },

    onBalloonSpawn() {
      spawnBalloonEvent();
    },

    onSave() {
      saveGame();
    }
  };

  function recordInteraction() {
    lastUserInteractionTime = performance.now();
    if (AudioManager.ctx && AudioManager.ctx.state === 'suspended') {
      AudioManager.ctx.resume();
    }
  }

  // Delta Time 同期メインループ
  let lastLoopTime = performance.now();
  function mainLoop(timestamp) {
    const elapsed = timestamp - lastLoopTime;
    lastLoopTime = timestamp;

    const dt = elapsed / 16.67;

    if (state.fever.timer > 0 || draggedIdx !== null) {
      const turb = document.querySelector("#slime-wobble feTurbulence");
      if (turb) {
        const freqX = 0.04 + Math.sin(timestamp * 0.001) * 0.005;
        const freqY = 0.03 + Math.cos(timestamp * 0.0015) * 0.004;
        turb.setAttribute("baseFrequency", `${freqX} ${freqY}`);
      }
    }

    FXManager.updatePhysics(dt);
    FXManager.draw();

    DragManager.update();
    GameLoopManager.update(timestamp);

    // ⚡ リアクティブ・Dirtyフラグが立っている時のみUI再描画を実行
    if (UIManager.isDirty) {
      UIManager.render();
      UIManager.isDirty = false;
    }

    requestAnimationFrame(mainLoop);
  }

  function discoverSlime(level, shiny) {
    const key = `${level}-${shiny ? 'shiny' : 'normal'}`;
    if (!state.discoveredSlimes[key]) {
      state.discoveredSlimes[key] = true;
      const config = GameConfig.dexConfig[key];

      if (config) {
        document.getElementById("discovery-name").textContent = `${config.name}${shiny ? ' (シャイニー✨)' : ''}`;
        document.getElementById("discovery-desc").textContent = config.desc;

        const wrap = document.getElementById("discovery-render-wrap");
        wrap.innerHTML = "";
        const render = document.createElement("div");
        render.className = `slime ${config.colorClass} ${shiny ? 'shiny-slime' : ''}`;
        render.style.position = "relative";
        render.style.width = "62px";
        render.style.height = "62px";
        render.style.animation = "coinRotate 2s infinite linear";
        render.innerHTML = `
          <div class="slime-face">
            <div class="slime-eye"></div>
            <div class="slime-eye"></div>
            <div class="slime-mouth"></div>
          </div>
        `;
        wrap.appendChild(render);

        document.getElementById("discovery-modal").style.display = "flex";
        AudioManager.playSynthesizedSound('mutation');
      }
      saveGame();
    }
  }

  function closeDiscoveryModal() {
    document.getElementById("discovery-modal").style.display = "none";
    AudioManager.playSynthesizedSound('buy');
  }

  function changeSkin(skin) {
    document.body.className = "";
    document.querySelectorAll(".skin-opt").forEach(opt => opt.classList.remove("active"));
    state.system.currentSkin = skin;

    if (skin === 'cherry') {
      document.body.classList.add("skin-cherry");
      document.getElementById("skin-opt-cherry").classList.add("active");
    } else if (skin === 'space') {
      document.body.classList.add("skin-space");
      document.getElementById("skin-opt-space").classList.add("active");
    } else {
      document.body.classList.add("skin-green");
      document.getElementById("skin-opt-green").classList.add("active");
    }

    FXManager.ambientObjects.length = 0;
    if (skin === 'cherry' || skin === 'space') {
      for (let i = 0; i < 8; i++) {
        FXManager.ambientObjects.push(FXManager.spawnAmbientObject(skin, true));
      }
    }
  }

  function closeTutorial() {
    state.system.tutorialCompleted = true;
    document.getElementById("tutorial-overlay").style.display = "none";
    AudioManager.playSynthesizedSound('buy');
    saveGame();
  }

  function initBlinkTimer() {
    setInterval(() => {
      const slimes = document.querySelectorAll(".slime");
      if (slimes.length === 0) return;

      const target = slimes[Math.floor(Math.random() * slimes.length)];
      const eyes = target.querySelectorAll(".slime-eye");
      eyes.forEach(eye => eye.classList.add("blink"));

      setTimeout(() => {
        eyes.forEach(eye => eye.classList.remove("blink"));
      }, 150);
    }, 2500);
  }

  function resizeCanvas() {
    const container = dom.gameContainer;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
  }

  function buildGridDOM() {
    dom.ranchGrid.innerHTML = "";
    UIManager.slotDirtyCache = Array(16).fill(null);
    for (let i = 0; i < 16; i++) {
      const slot = document.createElement("div");
      slot.className = "grid-slot";
      slot.dataset.index = i;

      if (i >= ranch.unlockedSlots) {
        slot.classList.add("locked");
      } else {
        slot.addEventListener("pointerdown", (e) => DragManager.onPointerDown(e));
      }
      dom.ranchGrid.appendChild(slot);
    }
  }

  function openDexModal(key) {
    const config = GameConfig.dexConfig[key];
    const isShiny = key.includes("shiny");
    const level = parseInt(key);
    const slimeConf = GameConfig.slimeConfig[level];
    let cps = slimeConf.cps;
    if (isShiny) cps *= 5;

    document.getElementById("dex-modal-title").textContent = config.name;
    document.getElementById("dex-modal-type").textContent = isShiny ? "✨ 突然変異（シャイニー） ─ 生産量5倍！" : "🌿 通常スライム";
    document.getElementById("dex-modal-type").style.color = isShiny ? "#f1c40f" : "#3498db";
    document.getElementById("dex-modal-desc").textContent = config.desc;
    document.getElementById("dex-modal-cps").textContent = `🪙 ゴールド生産: +${cps * getAchievementMultiplier()}/s`;

    const wrap = document.getElementById("dex-modal-render-wrap");
    wrap.innerHTML = "";
    const render = document.createElement("div");
    render.className = `slime ${config.colorClass} ${isShiny ? 'shiny-slime' : ''}`;
    render.style.position = "relative";
    render.style.width = "50px";
    render.style.height = "50px";
    render.innerHTML = `
      <div class="slime-face">
        <div class="slime-eye"></div>
        <div class="slime-eye"></div>
        <div class="slime-mouth"></div>
      </div>
    `;
    wrap.appendChild(render);

    document.getElementById("dex-modal").style.display = "flex";
    AudioManager.playSynthesizedSound('buy');
  }

  function closeDexModal() {
    document.getElementById("dex-modal").style.display = "none";
  }

  function handleBuyClick() {
    const emptyIndex = getEmptySlotIndex();
    if (emptyIndex === -1) {
      showToast("牧場がいっぱいです！不要なスライムを売却してください。");
      return;
    }
    if (economy.gold < economy.buyPrice) {
      showToast("ゴールドが足りません！");
      return;
    }
    buySlime();
  }

  function handleMaxBuyClick() {
    if (!state.upgrades.maxBuyLicense) {
      showToast("ショップで一括購入ライセンスを購入してください！");
      return;
    }
    let buyCount = 0;
    while (true) {
      const emptyIndex = getEmptySlotIndex();
      if (emptyIndex === -1 || economy.gold < economy.buyPrice) break;
      buySlime();
      buyCount++;
    }
    if (buyCount > 0) {
      showToast(`${buyCount}匹のスライムを一括購入しました！`);
    } else {
      const emptyIndex = getEmptySlotIndex();
      if (emptyIndex === -1) showToast("牧場がいっぱいで購入できません！");
      else showToast("ゴールドが足りません！");
    }
  }

  function buySlime() {
    const emptyIndex = getEmptySlotIndex();
    if (emptyIndex === -1) return;

    economy.gold -= economy.buyPrice;
    const startLv = 1 + (state.prestige.startLevel || 0);
    ranch.grid[emptyIndex] = { level: startLv, shiny: false };
    discoverSlime(startLv, false);
    economy.buyPrice = Math.floor(economy.buyPrice * 1.09);

    const slots = dom.ranchGrid.children;
    const xRatio = slots[emptyIndex].getBoundingClientRect().left / window.innerWidth;

    AudioManager.playSynthesizedSound('buy', xRatio);
    updateCps();
    FXManager.spawnSlotParticles(emptyIndex);
  }

  function getEmptySlotIndex() {
    for (let i = 0; i < ranch.unlockedSlots; i++) {
      if (ranch.grid[i] === null) return i;
    }
    return -1;
  }

  function updateCps() {
    let totalCps = 0;
    ranch.grid.forEach((slime, idx) => {
      if (slime && idx < ranch.unlockedSlots) {
        const config = GameConfig.slimeConfig[slime.level];
        let baseCps = config.cps;
        if (slime.shiny) baseCps *= 5;
        totalCps += baseCps;
      }
    });
    economy.baseCps = totalCps;
  }

  function sellSlime(idx) {
    const slime = ranch.grid[idx];
    if (!slime) return;

    if (slime.level >= 5) {
      const config = GameConfig.slimeConfig[slime.level];
      if (!confirm(`⚠️ 警告: 【Lv.${slime.level} ${config.name}${slime.shiny ? ' (シャイニー)' : ''}】を本当に売却してもよろしいですか？`)) return;
    }

    let returnGold = Math.floor(10 * Math.pow(1.5, slime.level - 1));
    if (slime.shiny) returnGold *= 3;

    economy.gold += returnGold;
    economy.totalGoldEarned += returnGold;
    ranch.grid[idx] = null;

    AudioManager.playSynthesizedSound('sell');
    FXManager.spawnTextFloater(`+${returnGold}G (売却)`, idx, "#e74c3c");
    FXManager.spawnSlotParticles(idx);
  }

  function triggerScreenShake() {
    dom.gameContainer.classList.remove("shake-active");
    void dom.gameContainer.offsetWidth;
    dom.gameContainer.classList.add("shake-active");
    setTimeout(() => dom.gameContainer.classList.remove("shake-active"), 150);
  }

  function handleMergeOrSwap(srcIndex, destIndex) {
    const srcSlime = ranch.grid[srcIndex];
    const destSlime = ranch.grid[destIndex];

    if (!destSlime) {
      ranch.grid[destIndex] = srcSlime;
      ranch.grid[srcIndex] = null;
    } else if (srcSlime.level === destSlime.level && srcSlime.level < 10) {
      const nextLv = srcSlime.level + 1;
      let isShiny = false;

      if (srcSlime.shiny || destSlime.shiny) {
        isShiny = true;
      } else {
        const mutProb = GameConfig.baseMutationProb + (state.prestige.mutProbLevel * 0.015);
        if (Math.random() < mutProb) isShiny = true;
      }

      ranch.grid[destIndex] = { level: nextLv, shiny: isShiny };
      ranch.grid[srcIndex] = null;

      triggerScreenShake();
      discoverSlime(nextLv, isShiny);

      state.stats.mergeCount++;
      state.stats.maxLevelReached = Math.max(state.stats.maxLevelReached, nextLv);

      const now = Date.now();
      if (now - lastMergeTime < 3000) comboCount++;
      else comboCount = 0;
      lastMergeTime = now;

      if (state.fever.timer <= 0) {
        state.fever.gauge = Math.min(100, state.fever.gauge + 5 + (comboCount * 2.5));
        if (state.fever.gauge >= 100) triggerFeverMode();
      }

      const slots = dom.ranchGrid.children;
      const xRatio = slots[destIndex].getBoundingClientRect().left / window.innerWidth;

      if (isShiny) {
        AudioManager.playSynthesizedSound('mutation', xRatio);
        FXManager.spawnMutationPraiseText(`✨突然変異!!✨`, destIndex);
      } else {
        AudioManager.playSynthesizedSound('merge', xRatio);
        FXManager.spawnSlotParticles(destIndex);
        if (nextLv >= 5) {
          const praises = ["EXCELLENT! 🌟", "MAGICAL! ✨", "AMAZING! 💖", "KING OF SLIME! 👑"];
          const praiseText = praises[Math.min(nextLv - 5, praises.length - 1)];
          FXManager.spawnBigPraiseText(praiseText, destIndex);
        } else {
          FXManager.spawnTextFloater(`Lv.${nextLv}!`, destIndex, "#2ecc71");
        }
      }
    } else {
      ranch.grid[srcIndex] = destSlime;
      ranch.grid[destIndex] = srcSlime;
    }
  }

  function triggerFeverMode() {
    const feverMax = GameConfig.baseFeverDuration + (state.prestige.feverDurationLevel * 1);
    state.fever.timer = feverMax;
    state.fever.gauge = 100;
    AudioManager.playSynthesizedSound('fever_start');
    showToast(`🔥 フィーバーモード突入！生産量10倍！(${feverMax}秒) 🔥`);

    document.querySelectorAll(".slime").forEach(el => el.classList.add("slime-fever-jump", "wobble-active"));

    if (state.system.audioMode === 1 || state.system.audioMode === 3) AudioManager.startBgmLoop();
  }

  function calculatePrestigeStars() {
    let stars = 1;
    ranch.grid.forEach(slime => {
      if (slime) {
        if (slime.level === 8) stars += 1;
        else if (slime.level === 9) stars += 2;
        else if (slime.level === 10) stars += 4;
      }
    });
    return stars;
  }

  function triggerPrestige() {
    const hasLv8 = ranch.grid.some(slime => slime && slime.level >= 8);
    if (!hasLv8) {
      alert("転生するには、Lv.8（スペースコスモ）以上のスライムを1体以上保有している必要があります！");
      return;
    }

    const getStars = calculatePrestigeStars();

    if (confirm(`牧場を転生させますか？\n【獲得予定スター】: ${getStars} 🌟\n\n【警告】所持ゴールド、牧場内のスライム、アンロックしたマス、通常アップグレードはすべてリセットされますが、スターを使って永続バフショップでさらに強化できるようになります！`)) {
      state.prestige.prestigeCount++;
      state.prestige.prestigeStars += getStars;

      economy.gold = 50;
      economy.buyPrice = 10;
      ranch.unlockedSlots = 12;
      ranch.grid = Array(16).fill(null);
      state.upgrades = { autoMerge: false, autoSpawn: false, maxBuyLicense: false };

      const startLv = 1 + (state.prestige.startLevel || 0);
      ranch.grid[0] = { level: startLv, shiny: false };
      discoverSlime(startLv, false);

      state.fever.gauge = 0;
      state.fever.timer = 0;

      AudioManager.playSynthesizedSound('boost');
      buildGridDOM();
      updateCps();
      saveGame();

      for (let i = 0; i < 4; i++) {
        setTimeout(() => FXManager.spawnSlotParticles(5), i * 150);
      }
    }
  }

  function buyStarUpgrade(type) {
    const prestige = state.prestige;
    if (type === 'mut') {
      const cost = 1;
      if (prestige.prestigeStars >= cost && prestige.mutProbLevel < GameConfig.maxPrestigeMutLevel) {
        prestige.prestigeStars -= cost;
        prestige.mutProbLevel++;
        AudioManager.playSynthesizedSound('boost');
        saveGame();
      }
    } else if (type === 'fever') {
      const cost = 1;
      if (prestige.prestigeStars >= cost && prestige.feverDurationLevel < GameConfig.maxPrestigeFeverLevel) {
        prestige.prestigeStars -= cost;
        prestige.feverDurationLevel++;
        AudioManager.playSynthesizedSound('boost');
        saveGame();
      }
    } else if (type === 'level') {
      const cost = 2;
      if (prestige.prestigeStars >= cost && prestige.startLevel < GameConfig.maxPrestigeStartLevel) {
        prestige.prestigeStars -= cost;
        prestige.startLevel++;

        const startLv = 1 + prestige.startLevel;
        discoverSlime(startLv, false);

        AudioManager.playSynthesizedSound('boost');
        saveGame();
      }
    }
  }

  function spawnBalloonEvent() {
    if (activeBalloonEl) return;
    if (Math.random() > 0.3) {
      const balloon = document.createElement("div");
      balloon.className = "event-balloon";
      balloon.textContent = "🎈";
      balloon.style.left = "-50px";
      balloon.style.top = `${60 + Math.random() * 150}px`;
      dom.gameContainer.appendChild(balloon);

      activeBalloonEl = balloon;
      balloon.addEventListener("pointerdown", (e) => triggerBalloonTap(e));

      let posX = -50;
      const velocityX = 1.3 + Math.random() * 1.5;
      const containerWidth = dom.gameContainer.clientWidth;

      const moveInterval = setInterval(() => {
        if (!activeBalloonEl) {
          clearInterval(moveInterval);
          return;
        }
        posX += velocityX;
        balloon.style.left = `${posX}px`;

        if (posX > containerWidth + 50) {
          clearInterval(moveInterval);
          balloon.remove();
          activeBalloonEl = null;
        }
      }, 16);
    }
  }

  function triggerBalloonTap(e) {
    e.stopPropagation();
    e.preventDefault();
    if (!activeBalloonEl) return;

    AudioManager.playSynthesizedSound('balloon');

    const reward = Math.max(100, getFinalCps() * 60);
    economy.gold += reward;
    economy.totalGoldEarned += reward;

    const rect = activeBalloonEl.getBoundingClientRect();
    const containerRect = dom.gameContainer.getBoundingClientRect();
    const cx = rect.left - containerRect.left + 15;
    const cy = rect.top - containerRect.top + 15;

    for (let i = 0; i < 18; i++) {
      const p = FXManager.getFreeParticle();
      if (p) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2.5 + Math.random() * 5.5;
        p.x = cx;
        p.y = cy;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 1.5;
        p.alpha = 1.0;
        p.size = 7 + Math.random() * 7;
        p.color = `hsl(${Math.random() * 360}, 100%, 60%)`;
        p.isRain = false;
        p.glow = true;
        p.type = "star";
      }
    }

    const f = FXManager.getFreeFloatText();
    if (f) {
      f.x = cx;
      f.y = cy - 20;
      f.text = `🎈 +${Math.floor(reward)}G!`;
      f.color = "#9b59b6";
      f.alpha = 1.3;
      f.isPraise = true;
      f.isMini = false;
    }

    activeBalloonEl.remove();
    activeBalloonEl = null;
  }

  function openSpinModal() {
    initAudio();
    document.getElementById("spin-modal").style.display = "flex";
    drawWheelCanvas();
    updateSpinTimer();
  }

  function closeSpinModal() {
    if (isSpinning) return;
    document.getElementById("spin-modal").style.display = "none";
  }

  function updateSpinTimer() {
    const now = Date.now();
    const diff = now - state.system.lastSpinTime;
    const cd = 180000;

    const label = document.getElementById("spin-timer-label");
    const btn = document.getElementById("spin-start-btn");

    if (diff < cd) {
      const remaining = Math.ceil((cd - diff) / 1000);
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      label.textContent = `スピン可能まで: ${mins}分${String(secs).padStart(2, '0')}秒`;
      btn.disabled = true;
      btn.textContent = "クールダウン中";
    } else {
      label.textContent = "無料でスピンを回そう！";
      btn.disabled = false;
      btn.textContent = "スピンスタート！";
    }
  }

  function drawWheelCanvas() {
    const wCanvas = document.getElementById("wheel-canvas");
    if (!wCanvas) return;
    const wCtx = wCanvas.getContext("2d");
    const cx = wCanvas.width / 2;
    const cy = wCanvas.height / 2;
    const r = cx - 4;

    wCtx.clearRect(0, 0, wCanvas.width, wCanvas.height);
    const numSegments = GameConfig.spinPrizes.length;
    const anglePerSegment = (Math.PI * 2) / numSegments;

    for (let i = 0; i < numSegments; i++) {
      const startAngle = i * anglePerSegment;
      const endAngle = startAngle + anglePerSegment;
      const prize = GameConfig.spinPrizes[i];

      wCtx.beginPath();
      wCtx.moveTo(cx, cy);
      wCtx.arc(cx, cy, r, startAngle, endAngle);
      wCtx.fillStyle = prize.color;
      wCtx.fill();
      wCtx.lineWidth = 1.5;
      wCtx.strokeStyle = "#ffffff";
      wCtx.stroke();

      wCtx.save();
      wCtx.translate(cx, cy);
      wCtx.rotate(startAngle + anglePerSegment / 2);
      wCtx.textAlign = "right";
      wCtx.fillStyle = "#ffffff";
      wCtx.font = "bold 9px 'Noto Sans JP'";
      wCtx.fillText(prize.name, r - 10, 3);
      wCtx.restore();
    }

    wCtx.beginPath();
    wCtx.arc(cx, cy, 10, 0, Math.PI * 2);
    wCtx.fillStyle = "#ffffff";
    wCtx.fill();
    wCtx.stroke();
  }

  function spinWheel() {
    if (isSpinning) return;
    isSpinning = true;
    AudioManager.playSynthesizedSound('boost');

    const wheel = document.getElementById("wheel-container");
    const prizeIndex = Math.floor(Math.random() * GameConfig.spinPrizes.length);
    const numSegments = GameConfig.spinPrizes.length;
    const segmentAngle = 360 / numSegments;
    const targetAngle = 270 - (prizeIndex * segmentAngle) - (segmentAngle / 2);
    const totalRotation = 1800 + targetAngle;

    wheel.style.transform = `rotate(${totalRotation}deg)`;

    setTimeout(() => {
      isSpinning = false;
      state.system.lastSpinTime = Date.now();
      saveGame();
      updateSpinTimer();

      applySpinPrize(prizeIndex);

      wheel.style.transition = "none";
      wheel.style.transform = `rotate(${targetAngle}deg)`;
      setTimeout(() => {
        wheel.style.transition = "transform 3.5s cubic-bezier(0.1, 0.8, 0.1, 1)";
      }, 50);

    }, 3600);
  }

  function applySpinPrize(prizeIndex) {
    AudioManager.playSynthesizedSound('merge');
    const prize = GameConfig.spinPrizes[prizeIndex];

    FXManager.spawnCoinShower();

    if (prize.type === 'gold') {
      economy.gold += prize.val;
      economy.totalGoldEarned += prize.val;
      alert(`🎉 ルーレット結果: 【${prize.name}】獲得！`);
    } else if (prize.type === 'warp') {
      const earned = Math.max(200, getFinalCps() * 30);
      economy.gold += earned;
      economy.totalGoldEarned += earned;
      alert(`🎉 ルーレット結果: 【${prize.name}】！\n瞬時に ${earned}G を獲得しました！`);
    } else if (prize.type === 'slime') {
      const emptyIndex = getEmptySlotIndex();
      if (emptyIndex !== -1) {
        ranch.grid[emptyIndex] = { level: prize.val, shiny: false };
        discoverSlime(prize.val, false);
        alert(`🎉 ルーレット結果: 【${prize.name}】！\n牧場にスライムが召喚されました！`);
      } else {
        const refund = 100 * prize.val;
        economy.gold += refund;
        alert(`🎉 ルーレット結果: 【${prize.name}】！\n牧場が満杯のため、代わりに ${refund}G を獲得しました！`);
      }
    }

    FXManager.spawnSlotParticles(6);
  }

  function triggerBoost() {
    initAudio();
    if (state.system.boostTimer > 0) return;
    state.system.boostTimer = 30;
    economy.boostMultiplier = GameConfig.boostMultiplier;

    const boostBtn = document.getElementById("boost-btn");
    boostBtn.classList.add("boost-active");

    AudioManager.playSynthesizedSound('boost');
    updateCps();
  }

  function checkOfflineProgress() {
    const timeDiff = Date.now() - state.system.lastSaveTime;
    const offlineSeconds = Math.floor(timeDiff / 1000);

    if (offlineSeconds > 10 && economy.baseCps > 0) {
      const cappedSeconds = Math.min(offlineSeconds, 43200);
      const earned = Math.floor(economy.baseCps * cappedSeconds * getAchievementMultiplier());

      document.getElementById("offline-gold").textContent = earned.toLocaleString();
      document.getElementById("offline-modal").style.display = "flex";
      state.tempOfflineGold = earned;
    }
  }

  function claimOffline(multiplier) {
    const total = state.tempOfflineGold * multiplier;
    economy.gold += total;
    economy.totalGoldEarned += total;
    document.getElementById("offline-modal").style.display = "none";
    AudioManager.playSynthesizedSound('sell');
    FXManager.spawnSlotParticles(6);
  }

  function buySlotUpgrade() {
    const currentNext = ranch.unlockedSlots + 1;
    const cost = GameConfig.slotUpgradeCosts[currentNext];
    if (cost && economy.gold >= cost) {
      economy.gold -= cost;
      ranch.unlockedSlots = currentNext;
      AudioManager.playSynthesizedSound('boost');
      buildGridDOM();
      FXManager.spawnSlotParticles(currentNext - 1);
    }
  }

  function buyAutoMerge() {
    if (economy.gold >= 1500 && !state.upgrades.autoMerge) {
      economy.gold -= 1500;
      state.upgrades.autoMerge = true;
      AudioManager.playSynthesizedSound('boost');
    }
  }

  function buyAutoSpawn() {
    if (economy.gold >= 3000 && !state.upgrades.autoSpawn) {
      economy.gold -= 3000;
      state.upgrades.autoSpawn = true;
      AudioManager.playSynthesizedSound('boost');
    }
  }

  function buyMaxBuyLicense() {
    if (economy.gold >= 1000 && !state.upgrades.maxBuyLicense) {
      economy.gold -= 1000;
      state.upgrades.maxBuyLicense = true;
      AudioManager.playSynthesizedSound('boost');
    }
  }

  function getAchievementMultiplier() {
    let multiplier = 1.0;
    if (state.achievements.merge5) multiplier += 0.10;
    if (state.achievements.slots14) multiplier += 0.15;
    if (state.achievements.level5) multiplier += 0.25;
    if (state.achievements.gold10k) multiplier += 0.30;
    if (state.achievements.prestige1) multiplier += 0.50;
    if (state.achievements.level10) multiplier += 1.00;
    multiplier += state.prestige.prestigeCount * 1.0;
    return multiplier;
  }

  function getFinalCps() {
    const feverMul = state.fever.timer > 0 ? GameConfig.feverMultiplier : 1;
    return economy.baseCps * economy.boostMultiplier * getAchievementMultiplier() * feverMul;
  }

  function checkAchievements() {
    if (state.stats.mergeCount >= 5 && !state.achievements.merge5) state.achievements.merge5 = true;
    if (ranch.unlockedSlots >= 14 && !state.achievements.slots14) state.achievements.slots14 = true;
    if (state.stats.maxLevelReached >= 5 && !state.achievements.level5) state.achievements.level5 = true;
    if (economy.totalGoldEarned >= 10000 && !state.achievements.gold10k) state.achievements.gold10k = true;
    if (state.prestige.prestigeCount >= 1 && !state.achievements.prestige1) state.achievements.prestige1 = true;
    if (state.stats.maxLevelReached >= 10 && !state.achievements.level10) state.achievements.level10 = true;

    const act_merge_5 = document.getElementById("ach-merge-5");
    act_merge_5.textContent = state.achievements.merge5 ? "達成中" : "未達成";
    act_merge_5.className = `achievement-status ${state.achievements.merge5 ? 'unlocked' : ''}`;

    const act_slots_14 = document.getElementById("ach-slots-14");
    act_slots_14.textContent = state.achievements.slots14 ? "達成中" : "未達成";
    act_slots_14.className = `achievement-status ${state.achievements.slots14 ? 'unlocked' : ''}`;

    const act_level_5 = document.getElementById("ach-level-5");
    act_level_5.textContent = state.achievements.level5 ? "達成中" : "未達成";
    act_level_5.className = `achievement-status ${state.achievements.level5 ? 'unlocked' : ''}`;

    const act_gold_10k = document.getElementById("ach-gold-10k");
    act_gold_10k.textContent = state.achievements.gold10k ? "達成中" : "未達成";
    act_gold_10k.className = `achievement-status ${state.achievements.gold10k ? 'unlocked' : ''}`;

    const act_prestige_1 = document.getElementById("ach-prestige-1");
    act_prestige_1.textContent = state.achievements.prestige1 ? "達成中" : "未達成";
    act_prestige_1.className = `achievement-status ${state.achievements.prestige1 ? 'unlocked' : ''}`;

    const act_level_10 = document.getElementById("ach-level-10");
    act_level_10.textContent = state.achievements.level10 ? "達成中" : "未達成";
    act_level_10.className = `achievement-status ${state.achievements.level10 ? 'unlocked' : ''}`;
  }

  function handleAutoMergeCycle() {
    if (!state.upgrades.autoMerge) return;

    let merged = false;
    for (let i = 0; i < ranch.unlockedSlots; i++) {
      if (!ranch.grid[i] || i === draggedIdx) continue;
      for (let j = i + 1; j < ranch.unlockedSlots; j++) {
        if (!ranch.grid[j] || j === draggedIdx) continue;

        if (ranch.grid[i].level === ranch.grid[j].level && ranch.grid[i].level < 10) {
          const nextLv = ranch.grid[i].level + 1;
          let isShiny = false;

          if (ranch.grid[i].shiny || ranch.grid[j].shiny) {
            isShiny = true;
          } else {
            const mutProb = GameConfig.baseMutationProb + (state.prestige.mutProbLevel * 0.015);
            if (Math.random() < mutProb) isShiny = true;
          }

          ranch.grid[i] = { level: nextLv, shiny: isShiny };
          ranch.grid[j] = null;

          triggerScreenShake();
          discoverSlime(nextLv, isShiny);

          state.stats.mergeCount++;
          state.stats.maxLevelReached = Math.max(state.stats.maxLevelReached, nextLv);

          if (state.fever.timer <= 0) {
            state.fever.gauge = Math.min(100, state.fever.gauge + 5);
            if (state.fever.gauge >= 100) triggerFeverMode();
          }

          if (isShiny) {
            AudioManager.playSynthesizedSound('mutation');
            FXManager.spawnMutationPraiseText(`✨突然変異!!✨`, i);
          } else {
            AudioManager.playSynthesizedSound('merge');
            FXManager.spawnSlotParticles(i);
            FXManager.spawnTextFloater(`オートLv.${nextLv}!`, i, "#2ecc71");
          }
          merged = true;
          break;
        }
      }
      if (merged) break;
    }

    if (merged) {
      updateCps();
    }
  }

  function handleAutoSpawnCycle() {
    if (!state.upgrades.autoSpawn) return;

    const emptyIdx = getEmptySlotIndex();
    if (emptyIdx === -1) return;

    const startLv = 1 + (state.prestige.startLevel || 0);
    ranch.grid[emptyIdx] = { level: startLv, shiny: false };

    discoverSlime(startLv, false);

    AudioManager.playSynthesizedSound('buy');
    FXManager.spawnSlotParticles(emptyIdx);
    FXManager.spawnTextFloater("🤖 自動召喚!", emptyIdx, "#2ecc71");

    updateCps();
  }

  function saveGame() {
    try {
      state.system.lastSaveTime = Date.now();
      const rawState = JSON.parse(JSON.stringify(state));
      const json = JSON.stringify(rawState);
      const chk = generateChecksum(json);
      localStorage.setItem(SAVE_KEY, json);
      localStorage.setItem(SAVE_KEY + "_chk", chk);
    } catch (e) {
      console.warn("セーブ失敗 (LocalStorage制限等):", e);
    }
  }

  function loadGame() {
    try {
      const data = localStorage.getItem(SAVE_KEY);
      const chk = localStorage.getItem(SAVE_KEY + "_chk");

      if (data) {
        if (generateChecksum(data) !== chk) {
          showToast("⚠️ セーブデータ不整合検知！初期化修復します。");
          return;
        }

        const parsed = JSON.parse(data);
        if (parsed && typeof parsed === 'object') {
          const merged = deepMerge(JSON.parse(JSON.stringify(defaultState)), parsed);
          for (const key in merged) {
            state[key] = merged[key];
          }
        }
      }
    } catch (e) {
      console.error("ロード失敗:", e);
    }
  }

  function updateDragGuideVisual() {
    if (state.system.tutorialCompleted) {
      dom.dragGuideHand.style.display = "none";
      dom.dragGuideHand.style.animation = "";
      return;
    }

    let pair = null;
    for (let i = 0; i < ranch.unlockedSlots; i++) {
      if (!ranch.grid[i]) continue;
      for (let j = i + 1; j < ranch.unlockedSlots; j++) {
        if (ranch.grid[j] && ranch.grid[i].level === ranch.grid[j].level && ranch.grid[i].level < 10) {
          pair = { from: i, to: j };
          break;
        }
      }
      if (pair) break;
    }

    if (pair) {
      const slots = dom.ranchGrid.children;
      const fromRect = slots[pair.from].getBoundingClientRect();
      const toRect = slots[pair.to].getBoundingClientRect();
      const containerRect = dom.gameContainer.getBoundingClientRect();

      const fx = fromRect.left - containerRect.left + fromRect.width / 2 - 10;
      const fy = fromRect.top - containerRect.top + fromRect.height / 2 - 10;
      const tx = toRect.left - containerRect.left + toRect.width / 2 - 10;
      const ty = toRect.top - containerRect.top + toRect.height / 2 - 10;

      const dx = tx - fx;
      const dy = ty - fy;

      dom.dragGuideHand.style.left = `${fx}px`;
      dom.dragGuideHand.style.top = `${fy}px`;
      dom.dragGuideHand.style.setProperty('--drag-dx', `${dx}px`);
      dom.dragGuideHand.style.setProperty('--drag-dy', `${dy}px`);
      dom.dragGuideHand.style.display = "block";
      dom.dragGuideHand.style.animation = "handDragMove 2.2s infinite ease-in-out";
    } else {
      dom.dragGuideHand.style.display = "none";
      dom.dragGuideHand.style.animation = "";
    }
  }

  function activateSlimeRain() {
    recordInteraction();
    if (skillCooldowns.rain.current > 0) return;

    AudioManager.playSynthesizedSound('boost');
    startCooldown('rain');

    let rainTicks = 0;
    const startLv = 1 + (state.prestige.startLevel || 0);

    const rainInterval = setInterval(() => {
      const emptyIndex = getEmptySlotIndex();
      if (emptyIndex !== -1) {
        ranch.grid[emptyIndex] = { level: startLv, shiny: false };
        discoverSlime(startLv, false);
        FXManager.spawnSlotParticles(emptyIndex);
        FXManager.spawnTextFloater("🌧️ 降雨!", emptyIndex, "#3498db");

        const slots = dom.ranchGrid.children;
        const rect = slots[emptyIndex].getBoundingClientRect();
        const containerRect = dom.gameContainer.getBoundingClientRect();
        const cx = rect.left - containerRect.left + rect.width / 2;

        for (let i = 0; i < 3; i++) {
          const p = FXManager.getFreeParticle();
          if (p) {
            p.x = cx;
            p.y = -40;
            p.vx = 0;
            p.vy = 12 + Math.random() * 4;
            p.alpha = 0.75;
            p.size = 2;
            p.color = "#3498db";
            p.isRain = true;
            p.glow = false;
            p.type = "star";
          }
        }
      }

      rainTicks++;
      if (rainTicks >= 10) {
        clearInterval(rainInterval);
        updateCps();
      }
    }, 300);
  }

  function activateTimeWarp() {
    recordInteraction();
    if (skillCooldowns.warp.current > 0) return;

    AudioManager.playSynthesizedSound('boost');
    startCooldown('warp');

    const reward = Math.max(200, getFinalCps() * 30);
    economy.gold += reward;
    economy.totalGoldEarned += reward;

    const f = FXManager.getFreeFloatText();
    if (f) {
      f.x = canvas.width / 2;
      f.y = canvas.height / 2;
      f.text = `⏳ TIME WARP +${Math.floor(reward)}G!`;
      f.color = "#8b5cf6";
      f.alpha = 1.6;
      f.isPraise = true;
      f.isMini = false;
    }

    for (let i = 0; i < 26; i++) {
      const p = FXManager.getFreeParticle();
      if (p) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 7;
        p.x = canvas.width / 2;
        p.y = canvas.height / 2;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.alpha = 1.0;
        p.size = 5 + Math.random() * 6;
        p.color = "#a855f7";
        p.isRain = false;
        p.glow = true;
        p.type = "star";
      }
    }
  }

  function startCooldown(skill) {
    const cdInfo = skillCooldowns[skill];
    cdInfo.current = cdInfo.max;

    const bar = document.getElementById(`${skill}-cd-bar`);
    const btn = document.getElementById(`skill-${skill}-btn`);
    btn.disabled = true;

    cdInfo.timer = setInterval(() => {
      cdInfo.current--;
      const pct = (cdInfo.current / cdInfo.max) * 100;
      bar.style.width = `${pct}%`;

      if (cdInfo.current <= 0) {
        clearInterval(cdInfo.timer);
        btn.disabled = false;
        bar.style.width = `0%`;
      }
    }, 1000);
  }

  function showToast(message) {
    dom.toastMessage.textContent = message;
    dom.toastMessage.style.opacity = 1;
    setTimeout(() => { dom.toastMessage.style.opacity = 0; }, 1800);
  }

  function initAudio() {
    AudioManager.init();
  }

  function toggleAudioMode() {
    let mode = state.system.audioMode;
    mode = (mode + 1) % 4;
    state.system.audioMode = mode;

    UIManager.updateAudioButtonVisual();

    if (mode === 0 || mode === 2) {
      if (AudioManager.bgmInterval) clearInterval(AudioManager.bgmInterval);
    } else {
      AudioManager.startBgmLoop();
    }
    AudioManager.playSynthesizedSound('buy');
    saveGame();
  }

  // ─── ⚡ イベントバインド ───
  function bindEvents() {
    document.getElementById("sound-btn").addEventListener("click", () => toggleAudioMode());

    document.getElementById("tutorial-overlay").addEventListener("click", () => closeTutorial());
    document.getElementById("tutorial-box-inner").addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("tutorial-close-btn").addEventListener("click", () => closeTutorial());

    document.getElementById("discovery-modal").addEventListener("click", () => closeDiscoveryModal());
    document.getElementById("discovery-modal-content").addEventListener("click", (e) => e.stopPropagation());
    document.getElementById("discovery-ok-btn").addEventListener("click", () => closeDiscoveryModal());

    document.getElementById("help-trigger-btn").addEventListener("click", () => showHelp());

    document.getElementById("skin-opt-green").addEventListener("click", () => changeSkin('green'));
    document.getElementById("skin-opt-cherry").addEventListener("click", () => changeSkin('cherry'));
    document.getElementById("skin-opt-space").addEventListener("click", () => changeSkin('space'));

    document.getElementById("tab-ranch").addEventListener("click", () => UIManager.switchTab('ranch'));
    document.getElementById("tab-upgrade").addEventListener("click", () => UIManager.switchTab('upgrade'));
    document.getElementById("tab-achievement").addEventListener("click", () => UIManager.switchTab('achievement'));
    document.getElementById("tab-dex").addEventListener("click", () => UIManager.switchTab('dex'));

    document.getElementById("star-upgrade-mut-btn").addEventListener("click", () => buyStarUpgrade('mut'));
    document.getElementById("star-upgrade-fever-btn").addEventListener("click", () => buyStarUpgrade('fever'));
    document.getElementById("star-upgrade-level-btn").addEventListener("click", () => buyStarUpgrade('level'));

    document.getElementById("prestige-btn").addEventListener("click", () => triggerPrestige());
    document.getElementById("slot-upgrade-btn").addEventListener("click", () => buySlotUpgrade());
    document.getElementById("auto-merge-btn").addEventListener("click", () => buyAutoMerge());
    document.getElementById("auto-spawn-btn").addEventListener("click", () => buyAutoSpawn());
    document.getElementById("maxbuy-license-btn").addEventListener("click", () => buyMaxBuyLicense());

    document.getElementById("skill-rain-btn").addEventListener("click", () => activateSlimeRain());
    document.getElementById("skill-warp-btn").addEventListener("click", () => activateTimeWarp());

    document.getElementById("buy-btn").addEventListener("click", () => handleBuyClick());
    document.getElementById("max-buy-btn").addEventListener("click", () => handleMaxBuyClick());

    document.getElementById("boost-btn").addEventListener("click", () => triggerBoost());
    document.getElementById("spin-trigger-btn").addEventListener("click", () => openSpinModal());

    document.getElementById("offline-claim-btn").addEventListener("click", () => claimOffline(1));
    document.getElementById("offline-double-btn").addEventListener("click", () => claimOffline(2));

    document.getElementById("spin-start-btn").addEventListener("click", () => spinWheel());
    document.getElementById("spin-close-btn").addEventListener("click", () => closeSpinModal());

    document.getElementById("dex-close-btn").addEventListener("click", () => closeDexModal());
    document.getElementById("dex-modal").addEventListener("click", () => closeDexModal());
    document.getElementById("dex-modal-content").addEventListener("click", (e) => e.stopPropagation());

    const userEvents = ['mousedown', 'touchstart', 'pointerdown', 'keydown'];
    userEvents.forEach(evt => {
      window.addEventListener(evt, () => recordInteraction(), { passive: true });
    });

    document.getElementById("start-play-btn").addEventListener("click", () => {
      gameStarted = true;
      document.getElementById("start-overlay").style.display = "none";

      initAudio();
      recordInteraction();

      const now = performance.now();
      loadGame();
      buildGridDOM();
      updateCps();
      changeSkin(state.system.currentSkin);

      UIManager.isDirty = true;

      checkOfflineProgress();
      initBlinkTimer();
      showTutorialIfNeeded();

      const startLv = 1 + (state.prestige.startLevel || 0);
      discoverSlime(startLv, false);

      GameLoopManager.init(now);
      requestAnimationFrame(mainLoop);
    });
  }

  function showTutorialIfNeeded() {
    if (!state.system.tutorialCompleted) {
      document.getElementById("tutorial-overlay").style.display = "flex";
    }
  }

  function showHelp() {
    initAudio();
    document.getElementById("tutorial-overlay").style.display = "flex";
    AudioManager.playSynthesizedSound('boost');
  }

  function run() {
    initDOMCache();
    bindEvents();
    FXManager.init();

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (AudioManager.ctx) AudioManager.ctx.suspend();
      } else {
        if (AudioManager.ctx && (state.system.audioMode === 1 || state.system.audioMode === 3) && gameStarted) {
          AudioManager.ctx.resume();
        }
      }
    });

    setInterval(updateDragGuideVisual, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

})();
