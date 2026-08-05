/**
 * 限界！ステルスサボタージュ - Audited & Refactored Precision Script
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

// Best score state with in-memory fallback
let memoryBestScore = null;

function readBestScore() {
    try {
        const rawScore = localStorage.getItem('stealth_best_score');
        if (rawScore === null) return memoryBestScore;
        const bestScore = Number.parseInt(rawScore, 10);
        const valid = Number.isFinite(bestScore) && bestScore > 0 ? bestScore : null;
        if (valid !== null) memoryBestScore = valid;
        return memoryBestScore;
    } catch (error) {
        console.warn('ベストスコアの読み込みに失敗しました。インメモリにフォールバックします。', error);
        return memoryBestScore;
    }
}

function writeBestScore(score) {
    memoryBestScore = score;
    try {
        localStorage.setItem('stealth_best_score', String(score));
        return true;
    } catch (error) {
        console.warn('ベストスコアの保存に失敗しました。インメモリで維持します。', error);
        return false;
    }
}

// ==========================================
// AudioManager (Synced with Game Loop & Master Gain)
// ==========================================
class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.isWorking = false;
        this.isSlacking = false;
        this.isMuted = localStorage.getItem('katakata-minigames-mute') === 'true';
        this.soundTimer = 0;
    }

    setMuted(muted) {
        this.isMuted = muted;
        try {
            localStorage.setItem('katakata-minigames-mute', String(muted));
        } catch (e) {
            /* ignore storage block */
        }
    }

    init() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
                this.masterGain = this.audioCtx.createGain();
                this.masterGain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
                this.masterGain.connect(this.audioCtx.destination);
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }

    _createOscillator(type, freq) {
        if (this.isMuted || !this.audioCtx) return null;
        try {
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();
            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
            return { osc, gain };
        } catch (e) {
            return null;
        }
    }

    playEffect(type) {
        if (this.isMuted || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;

        if (type === 'warning') {
            const audioNode = this._createOscillator('square', 880);
            if (!audioNode) return;
            const { osc, gain } = audioNode;
            osc.frequency.setValueAtTime(1760, now + 0.1);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'look') {
            const audioNode = this._createOscillator('triangle', 100);
            if (!audioNode) return;
            const { osc, gain } = audioNode;
            osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'gameover') {
            const audioNode = this._createOscillator('sawtooth', 100);
            if (!audioNode) return;
            const { osc, gain } = audioNode;
            osc.frequency.exponentialRampToValueAtTime(10, now + 1.0);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.0);
            osc.start(now);
            osc.stop(now + 1.0);
        } else if (type === 'type') {
            const audioNode = this._createOscillator('square', 1200 + Math.random() * 400);
            if (!audioNode) return;
            const { osc, gain } = audioNode;
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'coin') {
            const audioNode = this._createOscillator('sine', 1200 + Math.random() * 200);
            if (!audioNode) return;
            const { osc, gain } = audioNode;
            gain.gain.setValueAtTime(0.05, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    }

    updateAudio(dt) {
        if (this.isMuted) return;
        this.soundTimer += dt;
        if (this.isSlacking) {
            if (this.soundTimer >= 0.1) {
                this.playEffect('coin');
                this.soundTimer = 0;
            }
        } else if (this.isWorking) {
            if (this.soundTimer >= 0.15) {
                this.playEffect('type');
                this.soundTimer = 0;
            }
        }
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

        this.initDarkMode();
    }

    initDarkMode() {
        const savedDark = localStorage.getItem('stealth-slacker-darkmode') === 'true';
        if (this.darkModeToggle) {
            this.darkModeToggle.checked = savedDark;
            this.applyDarkMode(savedDark);
            
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
        try {
            localStorage.setItem('stealth-slacker-darkmode', String(isDark));
        } catch (e) {
            /* ignore storage block */
        }
    }

    startGameUI() {
        if (this.startScreen) this.startScreen.classList.remove('active');
        if (this.resultScreen) this.resultScreen.classList.remove('active');
        if (this.scoreHud) this.scoreHud.classList.remove('hidden');
        if (this.stressHud) this.stressHud.classList.remove('hidden');
        if (this.hintText) this.hintText.classList.remove('hidden');
        if (this.scoreValueEl) {
            this.scoreValueEl.innerText = '0';
            this.scoreValueEl.style.transform = 'scale(1)';
            this.scoreValueEl.style.color = 'var(--border-color)';
        }
        if (this.bgFever) this.bgFever.style.animationDuration = '10s';
        this.updateStress(0);
    }

    setSlacking(isSlacking) {
        if (!this.bgFever) return;
        if (isSlacking) {
            this.bgFever.classList.add('active');
            if (this.hintText) this.hintText.classList.add('hidden');
        } else {
            this.bgFever.classList.remove('active');
        }
    }

    updateScore(score) {
        if (!this.scoreValueEl) return;
        const currentVal = Math.floor(score);
        this.scoreValueEl.innerText = currentVal;
        
        if (score > 10000) {
            const chaosLevel = Math.min((score - 10000) / 100000, 1);
            const scale = 1 + (chaosLevel * 0.5);
            const red = Math.floor(chaosLevel * 255);
            this.scoreValueEl.style.transform = `scale(${scale}) rotate(${(Math.random() - 0.5) * 10 * chaosLevel}deg)`;
            this.scoreValueEl.style.color = `rgb(${red}, 0, 0)`;
            
            if (this.bgFever) {
                const duration = Math.max(1, 10 - (chaosLevel * 9));
                this.bgFever.style.animationDuration = `${duration}s`;
            }
        }
    }

    updateStress(stress) {
        const value = Math.min(100, Math.max(0, stress));
        if (this.stressBarFill) {
            this.stressBarFill.style.width = `${value}%`;
            if (value >= 80) {
                this.stressBarFill.classList.add('danger');
            } else {
                this.stressBarFill.classList.remove('danger');
            }
        }
        if (this.stressHud) {
            this.stressHud.setAttribute('aria-valuenow', Math.floor(value));
        }
    }

    showGameOver(score, bestScore, isNewRecord, reason) {
        if (this.bgFever) this.bgFever.classList.remove('active');
        if (this.hintText) this.hintText.classList.add('hidden');
        if (this.scoreHud) this.scoreHud.classList.add('hidden');
        if (this.stressHud) this.stressHud.classList.add('hidden');
        
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

        if (this.resultScreen) {
            const titleEl = this.resultScreen.querySelector('.result-title');
            if (titleEl) {
                if (reason === 'karoushi') {
                    titleEl.innerHTML = "GAME OVER<br><span class=\"sub-title\">（過労で倒れた！）</span>";
                } else {
                    titleEl.innerHTML = "YOU'RE FIRED!!<br><span class=\"sub-title\">（見つかった！）</span>";
                }
            }
        }

        if (this.finalScoreEl) this.finalScoreEl.innerText = Math.floor(score);
        if (this.rankTextEl) this.rankTextEl.innerText = rank;
        if (this.bestScoreValueEl) this.bestScoreValueEl.innerText = bestScore !== null ? Math.floor(bestScore) : '--';
        
        if (this.newRecordBadge) {
            if (isNewRecord) {
                this.newRecordBadge.classList.remove('hidden');
            } else {
                this.newRecordBadge.classList.add('hidden');
            }
        }

        setTimeout(() => {
            if (this.resultScreen) this.resultScreen.classList.add('active');
        }, 300);
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
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
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
        this.stress = 0;
        this.stressRate = 16;
        this.reliefRate = 40;

        this.animationId = null;
        this.lastTime = 0;
        this.floatingTexts = [];
        this.sweatParticles = [];
        this.screenShake = 0;
        this.gameOverTime = 0;
        this.dpr = 1;

        if (this.canvas) {
            this.initCanvas();
            this.bindEvents();
            this.draw();
        }
    }

    initCanvas() {
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    resizeCanvas() {
        if (!this.container || !this.canvas || !this.ctx) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        CONFIG.LOGICAL_HEIGHT = CONFIG.LOGICAL_WIDTH * (height / width);

        this.canvas.width = CONFIG.LOGICAL_WIDTH * this.dpr;
        this.canvas.height = CONFIG.LOGICAL_HEIGHT * this.dpr;

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
        if (uiLayer) Object.assign(uiLayer.style, styles);
    }

    getRandomInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    bindEvents() {
        const isUiControlEvent = (e) => e?.target?.closest?.('button, .dark-mode-container, .sound-mute-container, a, input, label');

        const handleDown = (e) => {
            if (isUiControlEvent(e)) return;
            if (e && e.cancelable) e.preventDefault();
            if (this.gameState !== STATE.PLAYING) return;
            this.startSlacking();
        };

        const handleUp = (e) => {
            if (isUiControlEvent(e)) return;
            if (e && e.cancelable) e.preventDefault();
            this.stopSlacking();
        };

        let lastTapTime = 0;
        const handleDoubleTap = () => {
            if (this.gameState === STATE.GAMEOVER) {
                const now = Date.now();
                // 400ms buffer after game over before double tap is allowed
                if (now - this.gameOverTime > 400 && now - lastTapTime < 300) {
                    this.startGame();
                }
                lastTapTime = now;
            }
        };

        if (this.container) {
            this.container.addEventListener('mousedown', handleDown);
            this.container.addEventListener('touchstart', handleDown, { passive: false });
            this.container.addEventListener('contextmenu', (e) => {
                if (this.gameState === STATE.PLAYING && e.cancelable) e.preventDefault();
            });
        }

        window.addEventListener('mouseup', (e) => { handleUp(e); handleDoubleTap(); });
        window.addEventListener('touchend', (e) => { handleUp(e); handleDoubleTap(); }, { passive: false });
        window.addEventListener('touchcancel', handleUp, { passive: false });
        window.addEventListener('pointerleave', handleUp, { passive: false });
        window.addEventListener('pointerout', handleUp, { passive: false });

        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                if (e.target.tagName !== 'BUTTON') {
                    if (e.cancelable) e.preventDefault();
                }
                if (this.gameState !== STATE.PLAYING) return;
                if (!e.repeat) this.startSlacking();
            }
        });
        window.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                if (e.target.tagName !== 'BUTTON') {
                    if (e.cancelable) e.preventDefault();
                }
                this.stopSlacking();
            }
        });

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

        const startWrapper = (e) => {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
            this.startGame();
        };

        if (startBtn) {
            startBtn.addEventListener('click', startWrapper);
            startBtn.addEventListener('touchstart', startWrapper, { passive: false });
        }
        if (retryBtn) {
            retryBtn.addEventListener('click', startWrapper);
            retryBtn.addEventListener('touchstart', startWrapper, { passive: false });
        }

        if (shareBtn) {
            shareBtn.addEventListener('click', (e) => this.shareResult(e));
            shareBtn.addEventListener('touchstart', (e) => this.shareResult(e), { passive: false });
        }
        
        const goMenu = (e) => {
            e.stopPropagation();
            window.location.href = '/minigames.html';
        };
        if (menuBtn) {
            menuBtn.addEventListener('click', goMenu);
            menuBtn.addEventListener('touchstart', goMenu, { passive: false });
        }
        if (menuBtnTitle) {
            menuBtnTitle.addEventListener('click', goMenu);
            menuBtnTitle.addEventListener('touchstart', goMenu, { passive: false });
        }

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
        this.sweatParticles = [];
        this.lastTime = 0;
        this.screenShake = 0;
        
        this.ui.startGameUI();
        this.audio.setPlayerState(false, false, false);

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    triggerGameOver(reason = 'found') {
        this.gameState = STATE.GAMEOVER;
        this.gameOverTime = Date.now();
        this.audio.setPlayerState(false, false, true);
        this.audio.playEffect('gameover');
        this.screenShake = 30;
        this.deathReason = reason;
        
        if (navigator.vibrate) {
            try { navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
        }
        
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
        this.audio.updateAudio(dt);

        if (this.screenShake > 0) {
            this.screenShake -= 50 * dt;
            if (this.screenShake < 0) this.screenShake = 0;
        }
        if (this.safeSlackingTimer > 0) {
            this.safeSlackingTimer = Math.max(0, this.safeSlackingTimer - dtMs);
        }

        // --- Stress Update ---
        if (this.isSlacking) {
            const oldStress = this.stress;
            this.stress -= this.reliefRate * dt;
            if (this.stress <= 0) {
                this.stress = 0;
                if (oldStress > 0) {
                    this.audio.playEffect('coin');
                    this.addFloatingText(CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT * 0.7 - 70, '✨ REFRESHED!!', 1.6);
                }
            }
        } else {
            const stressRate = this.safeSlackingTimer > 0 ? 0 : this.stressRate;
            this.stress += stressRate * dt;
            if (this.stress >= 100) {
                this.triggerGameOver('karoushi');
                return;
            }
        }
        this.ui.updateStress(this.stress);

        // --- Sweat Particles when Stress > 50 ---
        if (this.stress > 50 || (this.bossState === BOSS.WARNING && !this.isSlacking)) {
            if (Math.random() < 0.2) {
                this.sweatParticles.push({
                    x: CONFIG.LOGICAL_WIDTH / 2 + (Math.random() * 40 - 20),
                    y: CONFIG.LOGICAL_HEIGHT * 0.75 - 20,
                    vy: Math.random() * 80 + 40,
                    life: 0.6
                });
            }
        }

        for (let i = this.sweatParticles.length - 1; i >= 0; i--) {
            this.sweatParticles[i].y += this.sweatParticles[i].vy * dt;
            this.sweatParticles[i].life -= dt;
            if (this.sweatParticles[i].life <= 0) this.sweatParticles.splice(i, 1);
        }

        // --- Score & Chaos & Risk/Reward ---
        if (this.isSlacking) {
            let multiplier = 1;
            
            if (this.bossState === BOSS.WARNING) {
                const factor = 1 - (this.bossTimer / this.currentWarningTime);
                multiplier = 2 + (factor * 8);
                
                if (Math.random() < 0.1) {
                    this.addFloatingText(
                        CONFIG.LOGICAL_WIDTH / 2 + (Math.random() * 200 - 100),
                        CONFIG.LOGICAL_HEIGHT * 0.7 - 50,
                        `x${Math.floor(multiplier)}!`,
                        1.5
                    );
                }
            }

            const scorePerSec = (Math.floor(this.score / 1000) + 10) * 60;
            this.score += scorePerSec * multiplier * dt;
            this.ui.updateScore(this.score);
            
            const chaosMultiplier = Math.max(1, this.score / 10000);
            if (Math.random() < 0.3 * (dtMs / 16.6) * chaosMultiplier) {
                this.addFloatingText(
                    CONFIG.LOGICAL_WIDTH / 2 + (Math.random() * 200 - 100),
                    CONFIG.LOGICAL_HEIGHT * 0.7 + (Math.random() * 100 - 50),
                    'ﾌヒﾋw',
                    1 + Math.random() * chaosMultiplier * 0.5
                );
            }
            if (this.score > 10000) {
                this.screenShake = Math.min((this.score / 10000) * 2, 10);
            }
        }

        // --- Boss AI ---
        this.bossTimer -= dtMs;
        
        if (this.bossState === BOSS.AWAY) {
            if (this.bossTimer <= 0) {
                const difficulty = Math.min(this.score / 50000, 1);

                if (this.doubleTurnPending) {
                    this.isFeint = false;
                    this.bossState = BOSS.WARNING;
                    this.currentWarningTime = this.getRandomInt(CONFIG.DOUBLE_TURN_WARNING_MIN, CONFIG.DOUBLE_TURN_WARNING_MAX);
                    this.bossTimer = this.currentWarningTime;
                    this.audio.playEffect('warning');
                    this.doubleTurnPending = false;
                } else {
                    const rand = Math.random();
                    if (rand < 0.15 + (difficulty * 0.15)) {
                        this.isFeint = true;
                        this.bossState = BOSS.WARNING;
                        this.currentWarningTime = Math.max(CONFIG.MIN_WARNING_TIME, 800 - (difficulty * 300));
                        this.bossTimer = this.currentWarningTime;
                        this.audio.playEffect('warning');
                    } else if (rand < 0.3 + (difficulty * 0.15) && difficulty > 0.1) {
                        this.isFeint = false;
                        this.doubleTurnSetup = true;
                        this.bossState = BOSS.WARNING;
                        this.currentWarningTime = Math.max(CONFIG.MIN_WARNING_TIME, 1000 - (difficulty * 500));
                        this.bossTimer = this.currentWarningTime;
                        this.audio.playEffect('warning');
                    } else {
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

        this.audio.setPlayerState(this.isSlacking, this.bossState === BOSS.LOOKING, false);

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].y -= 120 * dt;
            this.floatingTexts[i].life -= 1.2 * dt;
            if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    addFloatingText(x, y, text, scale = 1.0) {
        if (this.floatingTexts.length >= 25) {
            this.floatingTexts.shift();
        }
        this.floatingTexts.push({ x, y, text, scale, life: 1.0 });
    }

    draw() {
        if (!this.ctx) return;
        this.ctx.save();
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.clearRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

        if (this.screenShake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        const horizon = CONFIG.LOGICAL_HEIGHT * 0.4;
        
        // Floor
        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.fillRect(0, horizon, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT - horizon);

        // --- Boss ---
        const bossX = CONFIG.LOGICAL_WIDTH / 2;
        const bossY = horizon - 50;

        // Boss Desk
        this.ctx.fillStyle = '#222';
        this.ctx.fillRect(bossX - 120, bossY + 40, 240, 60);
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(bossX - 110, bossY + 45, 220, 10);

        if (this.bossState === BOSS.AWAY) {
            this.ctx.fillStyle = '#555';
            this.ctx.beginPath(); this.ctx.arc(bossX, bossY, 40, 0, Math.PI * 2); this.ctx.fill();
            if (typeof this.ctx.roundRect === 'function') {
                this.ctx.beginPath(); this.ctx.roundRect(bossX - 55, bossY + 40, 110, 80, 10); this.ctx.fill();
            } else {
                this.ctx.fillRect(bossX - 55, bossY + 40, 110, 80);
            }
        } else if (this.bossState === BOSS.WARNING) {
            this.ctx.fillStyle = '#555';
            this.ctx.beginPath(); this.ctx.arc(bossX, bossY, 40, 0, Math.PI * 2); this.ctx.fill();
            if (typeof this.ctx.roundRect === 'function') {
                this.ctx.beginPath(); this.ctx.roundRect(bossX - 55, bossY + 40, 110, 80, 10); this.ctx.fill();
            } else {
                this.ctx.fillRect(bossX - 55, bossY + 40, 110, 80);
            }
            
            const warningScale = 1 + Math.min(this.score / 20000, 1);
            this.ctx.fillStyle = '#ff3366';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff3366';
            this.ctx.font = `bold ${Math.floor(80 * warningScale)}px "M PLUS Rounded 1c"`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('!', bossX + 60, bossY - 40);
            this.ctx.shadowBlur = 0;
        } else if (this.bossState === BOSS.LOOKING) {
            this.ctx.fillStyle = '#111';
            this.ctx.beginPath(); this.ctx.arc(bossX, bossY, 40, 0, Math.PI * 2); this.ctx.fill();
            if (typeof this.ctx.roundRect === 'function') {
                this.ctx.beginPath(); this.ctx.roundRect(bossX - 55, bossY + 40, 110, 80, 10); this.ctx.fill();
            } else {
                this.ctx.fillRect(bossX - 55, bossY + 40, 110, 80);
            }

            this.ctx.fillStyle = '#ff3366';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ff3366';
            this.ctx.beginPath(); this.ctx.ellipse(bossX - 15, bossY - 5, 12, 6, 0.2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.ellipse(bossX + 15, bossY - 5, 12, 6, -0.2, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.shadowBlur = 0;

            const alpha = this.gameState === STATE.GAMEOVER ? 0.6 : 0.2;
            this.ctx.fillStyle = `rgba(255, 51, 102, ${alpha})`;
            this.ctx.beginPath();
            this.ctx.moveTo(bossX, bossY);
            this.ctx.lineTo(bossX - 400, CONFIG.LOGICAL_HEIGHT);
            this.ctx.lineTo(bossX + 400, CONFIG.LOGICAL_HEIGHT);
            this.ctx.fill();

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
        if (typeof this.ctx.roundRect === 'function') {
            this.ctx.beginPath(); this.ctx.roundRect(playerX - 180, playerY + 50, 360, 150, 10); this.ctx.fill();
        } else {
            this.ctx.fillRect(playerX - 180, playerY + 50, 360, 150);
        }
        this.ctx.fillStyle = '#33ccff';
        this.ctx.fillRect(playerX - 180, playerY + 50, 360, 5);

        if (this.isSlacking) {
            this.ctx.fillStyle = '#ff3366';
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY, 35, 0, Math.PI * 2); this.ctx.fill();
            if (typeof this.ctx.roundRect === 'function') {
                this.ctx.beginPath(); this.ctx.roundRect(playerX - 45, playerY + 30, 90, 80, 15); this.ctx.fill();
            } else {
                this.ctx.fillRect(playerX - 45, playerY + 30, 90, 80);
            }
            
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath(); this.ctx.arc(playerX - 12, playerY - 5, 6, Math.PI, Math.PI * 2); this.ctx.stroke();
            this.ctx.beginPath(); this.ctx.arc(playerX + 12, playerY - 5, 6, Math.PI, Math.PI * 2); this.ctx.stroke();
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY + 8, 8, 0, Math.PI); this.ctx.fill();
            
            this.ctx.fillStyle = '#fff';
            if (typeof this.ctx.roundRect === 'function') {
                this.ctx.beginPath(); this.ctx.roundRect(playerX - 35, playerY + 15, 70, 35, 10); this.ctx.fill();
            } else {
                this.ctx.fillRect(playerX - 35, playerY + 15, 70, 35);
            }
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(playerX - 25, playerY + 20, 50, 25);
            
            if (Date.now() % 1000 < 500) {
                this.ctx.fillStyle = '#ff3366';
                this.ctx.font = '24px Arial';
                this.ctx.fillText('♪', playerX + 45, playerY - 20);
            }
            
            this.ctx.strokeStyle = 'rgba(255, 51, 102, 0.5)';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY + 20, 80 + Math.random() * 10, 0, Math.PI * 2); this.ctx.stroke();

        } else {
            this.ctx.fillStyle = '#777'; 
            this.ctx.beginPath(); this.ctx.arc(playerX, playerY + 10, 35, 0, Math.PI * 2); this.ctx.fill();
            if (typeof this.ctx.roundRect === 'function') {
                this.ctx.beginPath(); this.ctx.roundRect(playerX - 45, playerY + 30, 90, 80, 15); this.ctx.fill();
            } else {
                this.ctx.fillRect(playerX - 45, playerY + 30, 90, 80);
            }
            
            this.ctx.fillStyle = '#ddd';
            this.ctx.beginPath();
            this.ctx.moveTo(playerX - 50, playerY + 30);
            this.ctx.lineTo(playerX + 50, playerY + 30);
            this.ctx.lineTo(playerX + 70, playerY + 80);
            this.ctx.lineTo(playerX - 70, playerY + 80);
            this.ctx.fill();
            
            this.ctx.fillStyle = 'rgba(51, 204, 255, 0.15)';
            this.ctx.beginPath();
            this.ctx.moveTo(playerX - 40, playerY + 30);
            this.ctx.lineTo(playerX, playerY - 30);
            this.ctx.lineTo(playerX + 40, playerY + 30);
            this.ctx.fill();

            if ((this.bossState === BOSS.LOOKING && this.gameState !== STATE.GAMEOVER) || this.stress > 50) {
                this.ctx.fillStyle = '#33ccff';
                this.ctx.beginPath();
                this.ctx.ellipse(playerX + 45, playerY - 10, 6, 10, Math.PI / 4, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        // Sweat drops
        this.ctx.fillStyle = '#33ccff';
        for (let sp of this.sweatParticles) {
            this.ctx.beginPath();
            this.ctx.arc(sp.x, sp.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // Floating texts
        this.ctx.fillStyle = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        for (let ft of this.floatingTexts) {
            this.ctx.globalAlpha = Math.max(0, ft.life);
            this.ctx.font = `bold ${Math.floor(24 * ft.scale)}px "M PLUS Rounded 1c"`;
            this.ctx.fillText(ft.text, ft.x, ft.y);
        }
        this.ctx.globalAlpha = 1.0;

        // High stress red vignette overlay
        if (this.stress > 75 && this.gameState === STATE.PLAYING) {
            const stressAlpha = ((this.stress - 75) / 25) * 0.25;
            this.ctx.fillStyle = `rgba(255, 0, 0, ${stressAlpha})`;
            this.ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
        }

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
            if (e.cancelable) e.preventDefault();
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
                "「息を止めて気気配を消したつもりでした…」"
            ];
            reasonText = "言い訳：" + excuses[Math.floor(Math.random() * excuses.length)];
        }

        const rankName = this.ui.rankTextEl ? this.ui.rankTextEl.innerText : '社畜';
        const text = `上司の目を盗んで【${Math.floor(this.score)}】サボりました。バレてクビになりました。 称号：[${rankName}]\n${reasonText}`;
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
                /* fallback to tweet window */
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
