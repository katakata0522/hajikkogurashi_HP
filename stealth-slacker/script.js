/**
 * 限界！ステルスサボタージュ - Refactored Main Script
 */

const CONFIG = {
    LOGICAL_WIDTH: 600,
    LOGICAL_HEIGHT: 800,
    MIN_WARNING_TIME: 400,
    DOUBLE_TURN_DELAY_MIN: 500,
    DOUBLE_TURN_DELAY_MAX: 800,
    DOUBLE_TURN_WARNING_MIN: 500,
    DOUBLE_TURN_WARNING_MAX: 650,
    SAFE_SLACK_AFTER_LOOK_MS: 450
};

const STATE = { START: 0, PLAYING: 1, GAMEOVER: 2 };
const BOSS = { AWAY: 0, WARNING: 1, LOOKING: 2 };
const EMOJIS = {
    BOSS_AWAY: '🧑‍💼',
    BOSS_LOOK: '👺',
    PLAYER_WORK: '🧑‍💻',
    PLAYER_PLAY: '🎮',
    WARNING: '❗',
    SWEAT: '💦'
};

function readBestScore() {
    try {
        const rawScore = localStorage.getItem('stealth_best_score');
        const bestScore = Number.parseInt(rawScore, 10);
        return Number.isFinite(bestScore) && bestScore > 0 ? bestScore : null;
    } catch (error) {
        return null;
    }
}

function writeBestScore(score) {
    try {
        localStorage.setItem('stealth_best_score', String(score));
        return true;
    } catch (error) {
        return false;
    }
}

// ==========================================
// AudioManager
// ==========================================
class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.workSoundInterval = null;
        this.playSoundInterval = null;
        this.isWorking = false;
        this.isSlacking = false;
        this.isMuted = localStorage.getItem('katakata-minigames-mute') === 'true';
    }

    setMuted(muted) {
        this.isMuted = muted;
        localStorage.setItem('katakata-minigames-mute', String(muted));
    }

    init() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioCtx = new AudioContext();
        }
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    _createOscillator(type, freq) {
        if (!this.audioCtx) return null;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        return { osc, gain };
    }

    playEffect(type) {
        if (this.isMuted) return;
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        if (type === 'warning') {
            const { osc, gain } = this._createOscillator('square', 880);
            osc.frequency.setValueAtTime(1760, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'look') {
            const { osc, gain } = this._createOscillator('triangle', 100);
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'gameover') {
            const { osc, gain } = this._createOscillator('sawtooth', 100);
            osc.frequency.exponentialRampToValueAtTime(10, now + 1.0);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
            osc.start(now);
            osc.stop(now + 1.0);
        } else if (type === 'type') {
            const { osc, gain } = this._createOscillator('square', 1200 + Math.random() * 400);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'coin') {
            const { osc, gain } = this._createOscillator('sine', 1200 + Math.random() * 200);
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    }

    startEnvironmentSounds() {
        this.stopEnvironmentSounds();
        this.workSoundInterval = setInterval(() => {
            if (this.isWorking) this.playEffect('type');
        }, 150);
        this.playSoundInterval = setInterval(() => {
            if (this.isSlacking) this.playEffect('coin');
        }, 100);
    }

    setPlayerState(isSlacking, isBossLooking, isGameOver) {
        if (isGameOver) {
            this.isWorking = false;
            this.isSlacking = false;
        } else {
            this.isSlacking = isSlacking;
            this.isWorking = !isSlacking && !isBossLooking;
        }
    }

    stopEnvironmentSounds() {
        clearInterval(this.workSoundInterval);
        clearInterval(this.playSoundInterval);
        this.isWorking = false;
        this.isSlacking = false;
    }
}

// ==========================================
// UIManager
// ==========================================
class UIManager {
    constructor() {
        this.startScreen = document.getElementById('start-screen');
        this.resultScreen = document.getElementById('result-screen');
        this.scoreHud = document.getElementById('score-hud');
        this.hintText = document.getElementById('hint-text');
        this.bgFever = document.getElementById('bg-fever');
        
        this.stressHud = document.getElementById('stress-hud');
        this.stressBarFill = document.getElementById('stress-bar-fill');

        this.scoreValueEl = document.getElementById('score-value');
        this.finalScoreEl = document.getElementById('final-score');
        this.bestScoreValueEl = document.getElementById('best-score-value');
        this.newRecordBadge = document.getElementById('new-record-badge');
        this.rankTextEl = document.getElementById('rank-text');
        this.shareBtn = document.getElementById('share-btn');
        this.shareFeedbackTimer = null;

        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        this.darkModeLabel = document.querySelector('.dark-mode-label');
        if (this.darkModeToggle) {
            if (this.darkModeLabel) {
                this.darkModeLabel.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.darkModeToggle.checked = !this.darkModeToggle.checked;
                    this.applyDarkMode(this.darkModeToggle.checked);
                });
            }
            this.darkModeToggle.addEventListener('change', (e) => {
                this.applyDarkMode(e.target.checked);
            });
        }
    }

    applyDarkMode(isDark) {
        document.body.classList.toggle('dark-mode', isDark);
    }

    startGameUI() {
        this.startScreen.classList.remove('active');
        this.resultScreen.classList.remove('active');
        this.scoreHud.classList.remove('hidden');
        this.stressHud.classList.remove('hidden');
        this.hintText.classList.remove('hidden');
        this.scoreValueEl.innerText = '0';
        this.scoreValueEl.style.transform = 'scale(1)';
        this.scoreValueEl.style.color = 'var(--border-color)';
        this.bgFever.style.animationDuration = '10s';
        this.updateStress(0);
    }

    setSlacking(isSlacking) {
        if (isSlacking) {
            this.bgFever.classList.add('active');
            this.hintText.classList.add('hidden');
        } else {
            this.bgFever.classList.remove('active');
        }
    }

    updateScore(score) {
        this.scoreValueEl.innerText = Math.floor(score);
        
        // カオス演出
        if (score > 10000) {
            const chaosLevel = Math.min((score - 10000) / 100000, 1);
            const scale = 1 + (chaosLevel * 0.5);
            const red = Math.floor(chaosLevel * 255);
            this.scoreValueEl.style.transform = `scale(${scale}) rotate(${(Math.random()-0.5)*10*chaosLevel}deg)`;
            this.scoreValueEl.style.color = `rgb(${red}, 0, 0)`;
            
            const duration = Math.max(1, 10 - (chaosLevel * 9));
            this.bgFever.style.animationDuration = `${duration}s`;
        }
    }

    updateStress(stress) {
        this.stressBarFill.style.width = `${Math.min(100, Math.max(0, stress))}%`;
        if (stress >= 80) {
            this.stressBarFill.classList.add('danger');
        } else {
            this.stressBarFill.classList.remove('danger');
        }
    }

    showGameOver(score, bestScore, isNewRecord, reason) {
        this.bgFever.classList.remove('active');
        this.hintText.classList.add('hidden');
        this.scoreHud.classList.add('hidden');
        this.stressHud.classList.add('hidden');
        
        let rank = "";
        if (score < 1000) rank = "模範的社畜";
        else if (score < 5000) rank = "真面目か！";
        else if (score < 10000) rank = "こっそりスマホ民";
        else if (score < 20000) rank = "窓際族のエース";
        else if (score < 30000) rank = "給料泥棒";
        else if (score < 50000) rank = "プロニート";
        else if (score < 75000) rank = "息をするようにサボる者";
        else if (score < 100000) rank = "伝説のサボり魔";
        else if (score < 150000) rank = "社長より偉い平社員";
        else rank = "会社を裏で牛耳る者";

        const titleEl = this.resultScreen.querySelector('.result-title');
        if (reason === 'karoushi') {
            titleEl.innerHTML = "GAME OVER<br><span class=\"sub-title\">（過労で倒れた！）</span>";
        } else {
            titleEl.innerHTML = "YOU'RE FIRED!!<br><span class=\"sub-title\">（見つかった！）</span>";
        }

        this.finalScoreEl.innerText = Math.floor(score);
        this.rankTextEl.innerText = rank;
        this.bestScoreValueEl.innerText = bestScore !== null ? Math.floor(bestScore) : '--';
        
        if (isNewRecord) {
            this.newRecordBadge.classList.remove('hidden');
        } else {
            this.newRecordBadge.classList.add('hidden');
        }

        setTimeout(() => { this.resultScreen.classList.add('active'); }, 1000);
    }

    showShareFeedback(message = 'コピーしました！') {
        if (!this.shareBtn) return;
        clearTimeout(this.shareFeedbackTimer);
        const defaultText = this.shareBtn.dataset.defaultText || this.shareBtn.textContent;
        this.shareBtn.dataset.defaultText = defaultText;
        this.shareBtn.textContent = message;
        this.shareBtn.classList.add('copied');
        this.shareFeedbackTimer = setTimeout(() => {
            this.shareBtn.textContent = defaultText;
            this.shareBtn.classList.remove('copied');
        }, 1800);
    }
}

// ==========================================
// GameController
// ==========================================
class GameController {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.getElementById('game-container');
        
        this.audio = new AudioManager();
        this.ui = new UIManager();

        this.gameState = STATE.START;
        this.bossState = BOSS.AWAY;
        this.bossTimer = 0;
        this.isFeint = false;
        
        this.currentWarningTime = 1000;
        this.doubleTurnPending = false;
        this.doubleTurnSetup = false;
        this.safeSlackingTimer = 0;
        
        this.isSlacking = false;
        this.score = 0;
        this.stress = 0; // 0 to 100
        this.stressRate = 16; // Increase per second when working
        this.reliefRate = 40; // Decrease per second when slacking

        this.animationId = null;
        this.lastTime = 0;
        this.floatingTexts = [];
        this.screenShake = 0;

        this.initCanvas();
        this.bindEvents();
        this.draw();
    }

    initCanvas() {
        this.canvas.width = CONFIG.LOGICAL_WIDTH;
        this.canvas.height = CONFIG.LOGICAL_HEIGHT;
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    resizeCanvas() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        CONFIG.LOGICAL_HEIGHT = CONFIG.LOGICAL_WIDTH * (height / width);

        this.canvas.width = CONFIG.LOGICAL_WIDTH;
        this.canvas.height = CONFIG.LOGICAL_HEIGHT;

        const styles = {
            width: width + 'px',
            height: height + 'px',
            position: 'absolute',
            left: '0',
            top: '0',
            transform: 'none'
        };

        Object.assign(this.canvas.style, styles);
        const uiLayer = document.getElementById('ui-layer');
        Object.assign(uiLayer.style, styles);
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    bindEvents() {
        const isUiControlEvent = (e) => e?.target?.closest?.('button, .dark-mode-container');

        const handleDown = (e) => {
            if (isUiControlEvent(e)) return;
            if (e) { e.stopPropagation(); e.preventDefault(); }
            if (this.gameState !== STATE.PLAYING) return;
            this.startSlacking();
        };

        const handleUp = (e) => {
            if (isUiControlEvent(e)) return;
            if (e) { e.stopPropagation(); e.preventDefault(); }
            this.stopSlacking();
        };

        let lastTapTime = 0;
        const handleDoubleTap = () => {
            if (this.gameState === STATE.GAMEOVER) {
                const now = Date.now();
                if (now - lastTapTime < 300) {
                    this.startGame();
                }
                lastTapTime = now;
            }
        };

        this.container.addEventListener('mousedown', handleDown);
        window.addEventListener('mouseup', (e) => { handleUp(e); handleDoubleTap(); });
        this.container.addEventListener('touchstart', handleDown, {passive: false});
        window.addEventListener('touchend', (e) => { handleUp(e); handleDoubleTap(); }, {passive: false});
        window.addEventListener('touchcancel', handleUp, {passive: false});
        
        this.container.addEventListener('contextmenu', (e) => {
            if (this.gameState === STATE.PLAYING) e.preventDefault();
        });

        // スペースキー対応
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (e.target.tagName !== 'BUTTON') e.preventDefault();
                if (this.gameState !== STATE.PLAYING) return;
                if (!e.repeat) this.startSlacking();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                if (e.target.tagName !== 'BUTTON') e.preventDefault();
                this.stopSlacking();
            }
        });

        // フォーカス喪失時（別タブ移動や別ウィンドウクリック等）に強制的に仕事状態に戻す
        window.addEventListener('blur', () => {
            if (this.gameState === STATE.PLAYING) {
                this.stopSlacking();
            }
        });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.gameState === STATE.PLAYING) {
                this.stopSlacking();
            }
        });

        const startBtn = document.getElementById('start-btn');
        const retryBtn = document.getElementById('retry-btn');
        const shareBtn = document.getElementById('share-btn');
        const menuBtn = document.getElementById('menu-btn');
        const menuBtnTitle = document.getElementById('menu-btn-title');
        const muteToggle = document.getElementById('sound-mute-toggle');
        const muteLabel = document.getElementById('sound-mute-label');

        const startWrapper = (e) => { e.stopPropagation(); e.preventDefault(); this.startGame(); };
        startBtn.addEventListener('click', startWrapper);
        startBtn.addEventListener('touchstart', startWrapper);
        retryBtn.addEventListener('click', startWrapper);
        retryBtn.addEventListener('touchstart', startWrapper);

        shareBtn.addEventListener('click', (e) => this.shareResult(e));
        shareBtn.addEventListener('touchstart', (e) => this.shareResult(e));
        
        const goMenu = (e) => { e.stopPropagation(); window.location.href = '/minigames.html'; };
        menuBtn.addEventListener('click', goMenu);
        menuBtn.addEventListener('touchstart', goMenu);

        if (menuBtnTitle) {
            menuBtnTitle.addEventListener('click', goMenu);
            menuBtnTitle.addEventListener('touchstart', goMenu);
        }

        // ミュート状態の初期反映とバインド
        if (muteToggle) {
            muteToggle.checked = this.audio.isMuted;
            if (muteLabel) {
                muteLabel.textContent = this.audio.isMuted ? '音 OFF 🔇' : '音 ON 🔊';
            }
            muteToggle.addEventListener('change', (e) => {
                const isMuted = e.target.checked;
                this.audio.setMuted(isMuted);
                if (muteLabel) {
                    muteLabel.textContent = isMuted ? '音 OFF 🔇' : '音 ON 🔊';
                }
            });
            if (muteLabel) {
                muteLabel.addEventListener('click', (e) => {
                    e.preventDefault();
                    muteToggle.checked = !muteToggle.checked;
                    const isMuted = muteToggle.checked;
                    this.audio.setMuted(isMuted);
                    muteLabel.textContent = isMuted ? '音 OFF 🔇' : '音 ON 🔊';
                });
            }
        }
    }

    startSlacking() {
        if (this.gameState !== STATE.PLAYING) return;
        this.audio.init();
        this.isSlacking = true;
        this.ui.setSlacking(true);
        this.audio.setPlayerState(this.isSlacking, this.bossState === BOSS.LOOKING, false);
    }

    stopSlacking() {
        if (this.gameState !== STATE.PLAYING) return;
        this.isSlacking = false;
        this.ui.setSlacking(false);
        this.audio.setPlayerState(this.isSlacking, this.bossState === BOSS.LOOKING, false);
    }

    startGame() {
        this.audio.init();
        this.gameState = STATE.PLAYING;
        this.bossState = BOSS.AWAY;
        this.score = 0;
        this.stress = 0;
        this.doubleTurnPending = false;
        this.doubleTurnSetup = false;
        this.safeSlackingTimer = 0;
        this.bossTimer = this.getRandomInt(2000, 4000); 
        this.isSlacking = false;
        this.floatingTexts = [];
        this.lastTime = 0;
        this.screenShake = 0;
        
        this.ui.startGameUI();
        this.audio.startEnvironmentSounds();
        this.audio.setPlayerState(false, false, false);

        if(this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    triggerGameOver(reason = 'found') {
        this.gameState = STATE.GAMEOVER;
        this.audio.stopEnvironmentSounds();
        this.audio.playEffect('gameover');
        this.screenShake = 30;
        this.deathReason = reason;
        
        // Vibrate if supported
        if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
        }
        
        // Flash Red
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
        
        const finalScore = Math.floor(this.score);
        let isNewRecord = false;
        let bestScore = readBestScore();

        if (finalScore > 0 && (bestScore === null || finalScore > bestScore)) {
            if (writeBestScore(finalScore)) {
                bestScore = finalScore;
                isNewRecord = true;
            }
        }

        this.ui.showGameOver(this.score, bestScore, isNewRecord, reason);
        this.draw(); 
    }

    update(dt) {
        const dtMs = dt * 1000;

        if (this.screenShake > 0) {
            this.screenShake -= 50 * dt;
            if (this.screenShake < 0) this.screenShake = 0;
        }
        if (this.safeSlackingTimer > 0) {
            this.safeSlackingTimer = Math.max(0, this.safeSlackingTimer - dtMs);
        }

        // --- Stress Update ---
        if (this.isSlacking) {
            this.stress -= this.reliefRate * dt;
            if (this.stress < 0) this.stress = 0;
        } else {
            const stressRate = this.safeSlackingTimer > 0 ? 0 : this.stressRate;
            this.stress += stressRate * dt;
            if (this.stress >= 100) {
                this.triggerGameOver('karoushi');
                return;
            }
        }
        this.ui.updateStress(this.stress);

        // --- Score & Chaos & Risk/Reward ---
        if (this.isSlacking) {
            let multiplier = 1;
            
            // 見切りボーナス：上司が『！』を出している間はスコア爆増
            if (this.bossState === BOSS.WARNING) {
                const factor = 1 - (this.bossTimer / this.currentWarningTime); // 0 to 1
                multiplier = 2 + (factor * 8); // 2倍〜10倍！
                
                if (Math.random() < 0.1) {
                    this.floatingTexts.push({
                        x: CONFIG.LOGICAL_WIDTH / 2 + (Math.random() * 200 - 100),
                        y: CONFIG.LOGICAL_HEIGHT * 0.7 - 50,
                        life: 1.0,
                        text: `x${Math.floor(multiplier)}!`,
                        scale: 1.5
                    });
                }
            }

            const scorePerSec = (Math.floor(this.score / 1000) + 10) * 60;
            this.score += scorePerSec * multiplier * dt;
            this.ui.updateScore(this.score);
            
            // Chaos texts
            const chaosMultiplier = Math.max(1, this.score / 10000);
            if (Math.random() < 0.3 * (dtMs / 16.6) * chaosMultiplier) {
                this.floatingTexts.push({
                    x: CONFIG.LOGICAL_WIDTH / 2 + (Math.random() * 200 - 100),
                    y: CONFIG.LOGICAL_HEIGHT * 0.7 + (Math.random() * 100 - 50),
                    life: 1.0,
                    text: 'ﾌヒﾋw',
                    scale: 1 + Math.random() * chaosMultiplier * 0.5
                });
            }
            if (this.score > 10000) {
                this.screenShake = Math.min((this.score / 10000) * 2, 10);
            }
        }

        // --- Boss AI ---
        this.bossTimer -= dtMs;
        
        if (this.bossState === BOSS.AWAY) {
            if (this.bossTimer <= 0) {
                const difficulty = Math.min(this.score / 50000, 1); // 0 to 1

                if (this.doubleTurnPending) {
                    // 二段振り向き発動。短すぎる即死ではなく、読める強攻撃にする。
                    this.isFeint = false;
                    this.bossState = BOSS.WARNING;
                    this.currentWarningTime = this.getRandomInt(CONFIG.DOUBLE_TURN_WARNING_MIN, CONFIG.DOUBLE_TURN_WARNING_MAX);
                    this.bossTimer = this.currentWarningTime;
                    this.audio.playEffect('warning');
                    this.doubleTurnPending = false;
                } else {
                    const rand = Math.random();
                    if (rand < 0.15 + (difficulty * 0.15)) {
                        // フェイント
                        this.isFeint = true;
                        this.bossState = BOSS.WARNING;
                        this.currentWarningTime = Math.max(CONFIG.MIN_WARNING_TIME, 800 - (difficulty * 300));
                        this.bossTimer = this.currentWarningTime;
                        this.audio.playEffect('warning');
                    } else if (rand < 0.3 + (difficulty * 0.15) && difficulty > 0.1) {
                        // 二段振り向きの布石（最初は普通に振り向く）
                        this.isFeint = false;
                        this.doubleTurnSetup = true;
                        this.bossState = BOSS.WARNING;
                        this.currentWarningTime = Math.max(CONFIG.MIN_WARNING_TIME, 1000 - (difficulty * 500));
                        this.bossTimer = this.currentWarningTime;
                        this.audio.playEffect('warning');
                    } else {
                        // 通常振り向き（緩急あり）
                        this.isFeint = false;
                        const isFast = Math.random() < difficulty; 
                        this.bossState = BOSS.WARNING;
                        this.currentWarningTime = isFast ? Math.max(CONFIG.MIN_WARNING_TIME, 700 - (difficulty * 300)) : 1000 + Math.random() * 500;
                        this.bossTimer = this.currentWarningTime;
                        this.audio.playEffect('warning');
                    }
                }
            }
        } else if (this.bossState === BOSS.WARNING) {
            if (this.bossTimer <= 0) {
                if (this.isFeint) {
                    this.bossState = BOSS.AWAY;
                    this.bossTimer = this.getRandomInt(1000, 3000);
                    this.isFeint = false;
                } else {
                    this.bossState = BOSS.LOOKING;
                    this.bossTimer = this.getRandomInt(1000, 2500);
                    this.audio.playEffect('look');
                }
            }
        } else if (this.bossState === BOSS.LOOKING) {
            if (this.isSlacking) {
                this.triggerGameOver('found');
                return;
            }
            if (this.bossTimer <= 0) {
                this.bossState = BOSS.AWAY;
                this.safeSlackingTimer = CONFIG.SAFE_SLACK_AFTER_LOOK_MS;
                if (this.doubleTurnSetup) {
                    this.bossTimer = this.getRandomInt(CONFIG.DOUBLE_TURN_DELAY_MIN, CONFIG.DOUBLE_TURN_DELAY_MAX);
                    this.doubleTurnPending = true;
                    this.doubleTurnSetup = false;
                } else {
                    const nextAwayTime = Math.max(500, 3000 - (this.score / 50));
                    this.bossTimer = this.getRandomInt(nextAwayTime, nextAwayTime + 1500);
                }
            }
        }

        // Audio state update
        this.audio.setPlayerState(this.isSlacking, this.bossState === BOSS.LOOKING, false);

        // Floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].y -= 120 * dt;
            this.floatingTexts[i].life -= 1.2 * dt;
            if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

        this.ctx.save();
        if (this.screenShake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        const horizon = CONFIG.LOGICAL_HEIGHT * 0.4;
        
        // Floor
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(0, horizon, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT - horizon);

        // --- Boss (図形描画でスタイリッシュに) ---
        const bossX = CONFIG.LOGICAL_WIDTH / 2;
        const bossY = horizon - 50;

        // Boss Desk
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(bossX - 120, bossY + 40, 240, 60);
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(bossX - 110, bossY + 45, 220, 10);

        if (this.bossState === BOSS.AWAY) {
            // 後ろ姿
            this.ctx.fillStyle = '#555';
            this.ctx.beginPath(); this.ctx.arc(bossX, bossY, 40, 0, Math.PI*2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.roundRect(bossX - 55, bossY + 40, 110, 80, 10); this.ctx.fill();
        } else if (this.bossState === BOSS.WARNING) {
            // 警戒（少し振り向く気配）
            this.ctx.fillStyle = '#555';
            this.ctx.beginPath(); this.ctx.arc(bossX, bossY, 40, 0, Math.PI*2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.roundRect(bossX - 55, bossY + 40, 110, 80, 10); this.ctx.fill();
            
            // ! マーク
            const warningScale = 1 + Math.min(this.score / 20000, 1);
            this.ctx.fillStyle = '#ff3366'; // 背景の黄色と被らないように赤に変更
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff3366';
            this.ctx.font = `bold ${80 * warningScale}px "M PLUS Rounded 1c"`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('!', bossX + 60, bossY - 40);
            this.ctx.shadowBlur = 0;
        } else if (this.bossState === BOSS.LOOKING) {
            // 振り向いた！
            this.ctx.fillStyle = '#111'; // シルエット化
            this.ctx.beginPath(); this.ctx.arc(bossX, bossY, 40, 0, Math.PI*2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.roundRect(bossX - 55, bossY + 40, 110, 80, 10); this.ctx.fill();

            // 鋭い赤い目
            this.ctx.fillStyle = '#ff3366';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff3366';
            this.ctx.beginPath(); this.ctx.ellipse(bossX - 15, bossY - 5, 12, 6, 0.2, 0, Math.PI*2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.ellipse(bossX + 15, bossY - 5, 12, 6, -0.2, 0, Math.PI*2); this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // 視線のレーザー（スポットライト）
            const alpha = this.gameState === STATE.GAMEOVER ? 0.6 : 0.2;
            this.ctx.fillStyle = `rgba(255, 51, 102, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.moveTo(bossX, bossY);
            this.ctx.lineTo(bossX - 400, CONFIG.LOGICAL_HEIGHT);
            this.ctx.lineTo(bossX + 400, CONFIG.LOGICAL_HEIGHT);
            this.ctx.fill();

            // ゲームオーバー時の画面全体フラッシュ
            if (this.gameState === STATE.GAMEOVER) {
                this.ctx.fillStyle = 'rgba(255, 51, 102, 0.3)';
                this.ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
            }
        }

        // --- Player ---
        const playerX = CONFIG.LOGICAL_WIDTH / 2;
        const playerY = CONFIG.LOGICAL_HEIGHT * 0.75;

        // Player Desk
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.beginPath(); this.ctx.roundRect(playerX - 180, playerY + 50, 360, 150, 10); this.ctx.fill();
        this.ctx.fillStyle = '#33ccff';
        this.ctx.fillRect(playerX - 180, playerY + 50, 360, 5); // デスクのフチ

        if (this.isSlacking) {
            // サボり中（のけぞってスマホ/ゲーム機）
            this.ctx.fillStyle = '#ff3366'; // アクティブな色
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY, 35, 0, Math.PI*2); this.ctx.fill(); // 頭
            this.ctx.beginPath(); this.ctx.roundRect(playerX - 45, playerY + 30, 90, 80, 15); this.ctx.fill(); // 体
            
            // ニヤケ顔 (^ ^)
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath(); this.ctx.arc(playerX - 12, playerY - 5, 6, Math.PI, Math.PI*2); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.arc(playerX + 12, playerY - 5, 6, Math.PI, Math.PI*2); this.ctx.stroke();
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY + 8, 8, 0, Math.PI); this.ctx.fill(); // 口
            
            // ゲーム機
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath(); this.ctx.roundRect(playerX - 35, playerY + 15, 70, 35, 10); this.ctx.fill();
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(playerX - 25, playerY + 20, 50, 25);
            
            // 音符（♪）がフワフワ
            if (Date.now() % 1000 < 500) {
                this.ctx.fillStyle = '#ff3366';
                this.ctx.font = '24px Arial';
                this.ctx.fillText('♪', playerX + 45, playerY - 20);
            }
            
            // オーラ
            this.ctx.strokeStyle = 'rgba(255, 51, 102, 0.5)';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY + 20, 80 + Math.random()*10, 0, Math.PI*2); this.ctx.stroke();

        } else {
            // 仕事中（PCに向かっている前傾姿勢）
            this.ctx.fillStyle = '#777'; 
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY + 10, 35, 0, Math.PI*2); this.ctx.fill(); // 頭が下がっている
            this.ctx.beginPath(); this.ctx.roundRect(playerX - 45, playerY + 30, 90, 80, 15); this.ctx.fill(); // 体
            
            // ノートPC
            this.ctx.fillStyle = '#ddd';
            this.ctx.beginPath();
            this.ctx.moveTo(playerX - 50, playerY + 30);
            this.ctx.lineTo(playerX + 50, playerY + 30);
            this.ctx.lineTo(playerX + 70, playerY + 80);
            this.ctx.lineTo(playerX - 70, playerY + 80);
            this.ctx.fill();
            
            // 画面の光
            this.ctx.fillStyle = 'rgba(51, 204, 255, 0.15)';
            this.ctx.beginPath();
            this.ctx.moveTo(playerX - 40, playerY + 30);
            this.ctx.lineTo(playerX, playerY - 30);
            this.ctx.lineTo(playerX + 40, playerY + 30);
            this.ctx.fill();

            // 汗（ボスの視線がある時、またはストレスが高い時）
            if ((this.bossState === BOSS.LOOKING && this.gameState !== STATE.GAMEOVER) || this.stress > 50) {
                this.ctx.fillStyle = '#33ccff';
                this.ctx.beginPath();
                this.ctx.ellipse(playerX + 45, playerY - 10, 6, 10, Math.PI/4, 0, Math.PI*2);
                this.ctx.fill();
            }
        }

        // Floating texts (サボり中の「ﾌヒﾋw」等)
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        for (let ft of this.floatingTexts) {
            this.ctx.globalAlpha = Math.max(0, ft.life);
            this.ctx.font = `bold ${24 * ft.scale}px "M PLUS Rounded 1c"`;
            this.ctx.fillText(ft.text, ft.x, ft.y);
        }
        this.ctx.globalAlpha = 1.0;

        this.ctx.restore();
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1;
        this.lastTime = timestamp;

        if (this.gameState === STATE.PLAYING) {
            this.update(dt);
            this.draw();
            this.animationId = requestAnimationFrame((t) => this.loop(t));
        }
    }

    async shareResult(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        
        let reasonText = "";
        if (this.deathReason === 'karoushi') {
            reasonText = "【死因：過労死】";
        } else if (this.score < 1000) {
            reasonText = "【死因：秒殺（即バレ）】";
        } else {
            const excuses = [
                "「これはですね、仕様のコンパイル待ちでして…」",
                "「いや、猫がキーボードに乗ってきまして…」",
                "「瞑想による生産性向上のアプローチです！」",
                "「画面のバグをデバッグしていただけです！」",
                "「気絶していました。」",
                "「息を止めて気配を消したつもりでした…」"
            ];
            reasonText = "言い訳：" + excuses[Math.floor(Math.random() * excuses.length)];
        }

        const text = `上司の目を盗んで【${Math.floor(this.score)}】サボりました。バレてクビになりました。 称号：[${this.ui.rankTextEl.innerText}]\n${reasonText}`;
        const url = "https://hajikkoroom.xsrv.jp/stealth-slacker/";
        const hashtags = "限界ステルスサボタージュ,CornerNeighbor";
        const shareText = `${text}\n${url}\n#限界ステルスサボタージュ #CornerNeighbor`;
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`;

        if (navigator.share) {
            try {
                await navigator.share({ text: shareText, url });
                return;
            } catch (error) {
                if (error.name === 'AbortError') return;
            }
        }

        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(shareText);
                this.ui.showShareFeedback();
                return;
            } catch (error) {
                // Fall through to the tweet intent when clipboard access is blocked.
            }
        }

        const shareWindow = window.open(tweetUrl, '_blank', 'noopener,noreferrer');
        if (shareWindow) shareWindow.opener = null;
    }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
