/**
 * 超絶！仕分け工場 - Audited & Refactored Precision Script
 */

const CONFIG = {
    LOGICAL_WIDTH: 600,
    LOGICAL_HEIGHT: 1000,
    COLORS: { RED: '#ff3366', BLUE: '#00c3ff' },
    SHAPES: { CIRCLE: 0, SQUARE: 1 },
    SIZES: { SMALL: 64, LARGE: 164 },
    RULES: { COLOR: '色', SHAPE: '形', SIZE: '大きさ', NUMBER: '数字' }
};

const STATE = { START: 0, PLAYING: 1, GAMEOVER: 2 };

// Best score state with in-memory fallback for restricted/private storage environments
let memoryBestScore = null;

function readBestScore() {
    try {
        const raw = localStorage.getItem('sorting_best_score');
        if (raw === null) return memoryBestScore;
        const value = parseInt(raw, 10);
        const valid = Number.isFinite(value) && value >= 0 ? value : null;
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
        localStorage.setItem('sorting_best_score', String(score));
        return true;
    } catch (error) {
        console.warn('ベストスコアの保存に失敗しました。インメモリで維持します。', error);
        return false;
    }
}

// ==========================================
// AudioManager (Safe AudioContext & Master Gain Node)
// ==========================================
class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.masterGain = null;
        this.isMuted = localStorage.getItem('katakata-minigames-mute') === 'true';
    }

    setMute(muted) {
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

    playError() {
        if (this.isMuted || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const audioNode = this._createOscillator('sawtooth', 150);
        if (!audioNode) return;
        const { osc, gain } = audioNode;
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playSiren() {
        if (this.isMuted || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const audioNode = this._createOscillator('square', 600);
        if (!audioNode) return;
        const { osc, gain } = audioNode;
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.2);
        osc.frequency.setValueAtTime(600, now + 0.4);
        osc.frequency.setValueAtTime(800, now + 0.6);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 1.0);
        osc.start(now);
        osc.stop(now + 1.0);
    }

    playSlam() {
        if (this.isMuted || !this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const audioNode = this._createOscillator('square', 100);
        if (!audioNode) return;
        const { osc, gain } = audioNode;
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
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
        this.ruleDisplay = document.getElementById('rule-display');
        this.currentRuleText = document.getElementById('current-rule-text');
        this.ruleAlert = document.getElementById('rule-alert');
        this.alertText = document.getElementById('alert-text');
        this.bgEffect = document.getElementById('bg-effect');
        
        this.touchLeft = document.getElementById('touch-left');
        this.touchRight = document.getElementById('touch-right');

        this.scoreValueEl = document.getElementById('score-value');
        this.finalScoreEl = document.getElementById('final-score');
        this.rankTextEl = document.getElementById('rank-text');
        
        this.bestScoreValueEl = document.getElementById('best-score-value');
        this.newRecordBadge = document.getElementById('new-record-badge');
    }

    startGameUI() {
        if (this.startScreen) this.startScreen.classList.remove('active');
        if (this.resultScreen) this.resultScreen.classList.remove('active');
        if (this.scoreHud) this.scoreHud.classList.remove('hidden');
        if (this.ruleDisplay) this.ruleDisplay.classList.remove('hidden');
        if (this.touchLeft) this.touchLeft.classList.remove('hidden');
        if (this.touchRight) this.touchRight.classList.remove('hidden');
        if (this.bgEffect) this.bgEffect.classList.add('moving');
        this.updateScore(0);
    }

    setRule(ruleName) {
        if (!this.currentRuleText || !this.ruleDisplay) return;
        this.currentRuleText.innerText = ruleName;
        this.ruleDisplay.classList.add('changed');
        setTimeout(() => {
            if (this.ruleDisplay) this.ruleDisplay.classList.remove('changed');
        }, 300);
    }

    showRuleAlert(ruleName) {
        if (!this.alertText || !this.ruleAlert) return;
        this.alertText.innerText = ruleName;
        this.ruleAlert.classList.remove('hidden');
    }

    hideRuleAlert() {
        if (this.ruleAlert) this.ruleAlert.classList.add('hidden');
    }

    updateScore(score) {
        if (this.scoreValueEl) this.scoreValueEl.innerText = score;
    }

    showGameOver(score, bestScore, isNewRecord) {
        if (this.bgEffect) this.bgEffect.classList.remove('moving');
        if (this.scoreHud) this.scoreHud.classList.add('hidden');
        if (this.ruleDisplay) this.ruleDisplay.classList.add('hidden');
        if (this.touchLeft) this.touchLeft.classList.add('hidden');
        if (this.touchRight) this.touchRight.classList.add('hidden');

        if (this.finalScoreEl) this.finalScoreEl.innerText = score;
        if (this.bestScoreValueEl) this.bestScoreValueEl.innerText = bestScore !== null ? bestScore : '--';

        if (this.newRecordBadge) {
            if (isNewRecord) {
                this.newRecordBadge.classList.remove('hidden');
            } else {
                this.newRecordBadge.classList.add('hidden');
            }
        }

        if (this.rankTextEl) {
            if (score < 10) this.rankTextEl.innerText = 'クビ寸前';
            else if (score < 30) this.rankTextEl.innerText = '新人バイト';
            else if (score < 60) this.rankTextEl.innerText = '優秀なパート';
            else if (score < 100) this.rankTextEl.innerText = '熟練ライン長';
            else this.rankTextEl.innerText = 'スーパーAI頭脳';
        }

        if (this.resultScreen) this.resultScreen.classList.add('active');
    }
}

// ==========================================
// Entities (Item, Particles, Floating Text)
// ==========================================
class Item {
    constructor() {
        this.reset();
    }

    reset() {
        this.color = Math.random() < 0.5 ? CONFIG.COLORS.RED : CONFIG.COLORS.BLUE;
        this.shape = Math.random() < 0.5 ? CONFIG.SHAPES.CIRCLE : CONFIG.SHAPES.SQUARE;
        this.size = Math.random() < 0.5 ? CONFIG.SIZES.SMALL : CONFIG.SIZES.LARGE;
        this.number = Math.floor(Math.random() * 9) + 1; // 1-9
        
        this.x = CONFIG.LOGICAL_WIDTH / 2;
        this.y = -this.size;
        this.isSorted = false;
        this.sortDir = 0;
        this.alpha = 1;
    }

    update(dt, fallSpeed) {
        if (!this.isSorted) {
            this.y += fallSpeed * dt;
        } else {
            this.x += this.sortDir * 1200 * dt;
            this.y += 2000 * dt; // 重みのある落下
            this.alpha -= 5 * dt;
        }
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        if (this.shape === CONFIG.SHAPES.CIRCLE) {
            ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size, 12);
            } else {
                ctx.rect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size);
            }
            ctx.fill();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = `bold ${this.size * 0.6}px "Teko", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(this.number, this.x, this.y + (this.size * 0.05));

        ctx.restore();
    }
}

class Particle {
    constructor() {
        this.active = false;
        this.x = 0;
        this.y = 0;
        this.color = '#fff';
        this.size = 10;
        this.vx = 0;
        this.vy = 0;
        this.life = 0;
    }

    spawn(x, y, color) {
        this.active = true;
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 15 + 5;
        this.vx = (Math.random() - 0.5) * 600;
        this.vy = (Math.random() - 0.5) * 600;
        this.life = 1.0;
    }

    update(dt) {
        if (!this.active) return;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= 2.0 * dt;
        this.size *= Math.max(0, 1 - dt * 2);
        if (this.life <= 0) this.active = false;
    }

    draw(ctx) {
        if (!this.active || this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.pool = [];
        for (let i = 0; i < 150; i++) {
            this.pool.push(new Particle());
        }
    }

    spawn(x, y, color) {
        let spawned = 0;
        for (let p of this.pool) {
            if (!p.active) {
                p.spawn(x, y, color);
                spawned++;
                if (spawned >= 18) break;
            }
        }
    }

    updateAndDraw(ctx, dt) {
        for (let p of this.pool) {
            if (p.active) {
                p.update(dt);
                p.draw(ctx);
            }
        }
    }

    clear() {
        for (let p of this.pool) p.active = false;
    }
}

class FloatingText {
    constructor(x, y, text, color = '#ffd700', scale = 1.0) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.scale = scale;
        this.life = 1.0;
    }

    update(dt) {
        this.y -= 80 * dt;
        this.life -= 1.5 * dt;
    }

    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#000';
        ctx.font = `900 ${Math.floor(26 * this.scale)}px "M PLUS Rounded 1c", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
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
        this.particles = new ParticleSystem();
        this.floatingTexts = [];

        this.state = STATE.START;
        this.lastTime = 0;
        this.animationId = null;

        this.score = 0;
        this.comboCount = 0;
        this.currentRule = CONFIG.RULES.COLOR;
        
        this.items = [];
        this.fallSpeed = 200;
        this.spawnIntervalTime = 1.8;
        this.timeSinceLastSpawn = 0;

        this.screenShake = 0;
        this.freezeTimer = 0;
        this.flipperAngleLeft = 0;
        this.flipperAngleRight = 0;
        this.dpr = 1;

        if (this.canvas) {
            this.initCanvas();
            this.bindEvents();
            this.drawBoxes();
        }

        const muteToggle = document.getElementById('sound-mute-toggle');
        if (muteToggle) {
            muteToggle.checked = this.audio.isMuted;
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

    bindEvents() {
        const handleInput = (dir, e) => {
            if (e) {
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
            }
            this.processInput(dir);
        };

        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            if (this.state === STATE.PLAYING) {
                if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    e.preventDefault();
                    this.processInput(-1);
                } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    e.preventDefault();
                    this.processInput(1);
                }
            } else if (this.state === STATE.START || this.state === STATE.GAMEOVER) {
                if (e.key === ' ' || e.key === 'Enter') {
                    if (document.activeElement && document.activeElement.tagName === 'BUTTON') return;
                    e.preventDefault();
                    this.startGame();
                }
            }
        });
        
        let startX = 0;
        let startY = 0;
        let touchActive = false;

        const handleTouchStart = (e) => {
            if (this.state !== STATE.PLAYING) return;
            const touch = e.touches[0];
            startX = touch.clientX;
            startY = touch.clientY;
            touchActive = true;
        };

        const handleTouchMove = (e) => {
            if (!touchActive || this.state !== STATE.PLAYING) return;
            const touch = e.touches[0];
            const diffX = touch.clientX - startX;
            const diffY = touch.clientY - startY;

            if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                if (e.cancelable) e.preventDefault();
                const dir = diffX < 0 ? -1 : 1;
                this.processInput(dir);
                touchActive = false;
            }
        };

        const handleTouchEnd = (e, defaultDir) => {
            if (!touchActive || this.state !== STATE.PLAYING) return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();
            this.processInput(defaultDir);
            touchActive = false;
        };

        if (this.ui.touchLeft && this.ui.touchRight) {
            this.ui.touchLeft.addEventListener('touchstart', handleTouchStart, { passive: true });
            this.ui.touchRight.addEventListener('touchstart', handleTouchStart, { passive: true });

            this.ui.touchLeft.addEventListener('touchmove', handleTouchMove, { passive: false });
            this.ui.touchRight.addEventListener('touchmove', handleTouchMove, { passive: false });

            this.ui.touchLeft.addEventListener('touchend', (e) => handleTouchEnd(e, -1), { passive: false });
            this.ui.touchRight.addEventListener('touchend', (e) => handleTouchEnd(e, 1), { passive: false });

            this.ui.touchLeft.addEventListener('mousedown', (e) => handleInput(-1, e));
            this.ui.touchRight.addEventListener('mousedown', (e) => handleInput(1, e));
        }

        if (this.canvas) {
            this.canvas.addEventListener('pointerdown', (e) => this.handleCanvasPointer(e));
        }

        const startBtn = document.getElementById('start-btn');
        const retryBtn = document.getElementById('retry-btn');
        const shareBtn = document.getElementById('share-btn');
        const menuBtn = document.getElementById('menu-btn');
        const menuBtnTitle = document.getElementById('menu-btn-title');
        const muteToggle = document.getElementById('sound-mute-toggle');

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
            muteToggle.addEventListener('change', (e) => {
                this.audio.setMute(e.target.checked);
            });
        }
    }

    handleCanvasPointer(e) {
        if (this.state !== STATE.PLAYING) return;
        const rect = this.canvas.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height * 0.4) return;
        if (e.cancelable) e.preventDefault();
        const clientX = e.clientX;
        const direction = clientX < rect.left + rect.width / 2 ? -1 : 1;
        this.processInput(direction);
    }

    startGame() {
        this.audio.init();
        this.state = STATE.PLAYING;
        this.score = 0;
        this.comboCount = 0;
        this.fallSpeed = 300;
        this.spawnIntervalTime = 1.5;
        this.timeSinceLastSpawn = this.spawnIntervalTime;
        this.lastTime = 0;
        this.screenShake = 0;
        this.freezeTimer = 0;
        this.flipperAngleLeft = 0;
        this.flipperAngleRight = 0;
        this.sortsUntilChange = this.getRandomRuleChangeCount();
        this.items = [];
        this.floatingTexts = [];
        this.particles.clear();
        this.ui.hideRuleAlert();
        
        this.currentRule = CONFIG.RULES.COLOR;
        this.ui.startGameUI();
        this.ui.setRule(this.currentRule);

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    getRandomRuleChangeCount() {
        return Math.floor(Math.random() * 11) + 5; // 5~15回
    }

    getRandomRule() {
        const rules = Object.values(CONFIG.RULES);
        let newRule;
        do {
            newRule = rules[Math.floor(Math.random() * rules.length)];
        } while (newRule === this.currentRule);
        return newRule;
    }

    setRule(newRule) {
        if (this.currentRule !== newRule && this.state === STATE.PLAYING) {
            this.audio.playSiren();
            this.freezeTimer = 1.0;
            this.ui.showRuleAlert(newRule);
            this.floatingTexts.push(new FloatingText(CONFIG.LOGICAL_WIDTH / 2, 400, `RULE: ${newRule}`, '#ff3366', 1.8));
        }
        this.currentRule = newRule;
        this.ui.setRule(this.currentRule);
    }

    processInput(direction) {
        if (this.state !== STATE.PLAYING) return;
        if (this.freezeTimer > 0) return;

        let targetItem = null;
        for (let i = 0; i < this.items.length; i++) {
            if (!this.items[i].isSorted) {
                targetItem = this.items[i];
                break;
            }
        }

        if (!targetItem) return;

        let expectedDir = 0;
        if (this.currentRule === CONFIG.RULES.COLOR) {
            expectedDir = targetItem.color === CONFIG.COLORS.RED ? -1 : 1;
        } else if (this.currentRule === CONFIG.RULES.SHAPE) {
            expectedDir = targetItem.shape === CONFIG.SHAPES.CIRCLE ? -1 : 1;
        } else if (this.currentRule === CONFIG.RULES.SIZE) {
            expectedDir = targetItem.size === CONFIG.SIZES.SMALL ? -1 : 1;
        } else if (this.currentRule === CONFIG.RULES.NUMBER) {
            expectedDir = targetItem.number % 2 !== 0 ? -1 : 1;
        }

        if (direction === expectedDir) {
            this.audio.playSlam();
            targetItem.isSorted = true;
            targetItem.sortDir = direction;
            if (direction === -1) this.flipperAngleLeft = Math.PI / 3;
            else this.flipperAngleRight = Math.PI / 3;

            this.particles.spawn(targetItem.x, targetItem.y, targetItem.color);
            
            this.comboCount = (this.comboCount || 0) + 1;
            let addedPoints = 1;
            if (this.comboCount % 10 === 0) {
                addedPoints += 5;
                this.particles.spawn(targetItem.x, targetItem.y, '#ffd700');
                this.floatingTexts.push(new FloatingText(targetItem.x, targetItem.y - 40, `${this.comboCount} FEVER!`, '#ffd700', 1.5));
            } else if (this.comboCount > 3) {
                this.floatingTexts.push(new FloatingText(targetItem.x, targetItem.y - 20, `${this.comboCount} COMBO`, '#00c3ff', 1.1));
            }
            this.score += addedPoints;
            
            this.fallSpeed = Math.min(this.fallSpeed + 8, 1200);
            this.spawnIntervalTime = Math.max(this.spawnIntervalTime - 0.02, 0.5);

            this.sortsUntilChange--;
            if (this.sortsUntilChange <= 0) {
                this.setRule(this.getRandomRule());
                this.sortsUntilChange = this.getRandomRuleChangeCount();
            }

            this.ui.updateScore(this.score);
        } else {
            this.comboCount = 0;
            this.triggerGameOver();
        }
    }

    triggerGameOver() {
        this.audio.playError();
        this.state = STATE.GAMEOVER;
        if (this.animationId) cancelAnimationFrame(this.animationId);
        
        if (this.container) {
            this.container.style.backgroundColor = '#ff0000';
            setTimeout(() => { if (this.container) this.container.style.backgroundColor = '#111118'; }, 100);
        }
        this.screenShake = 15;

        let bestScore = readBestScore();
        let isNewRecord = false;

        if (bestScore === null || this.score > bestScore) {
            writeBestScore(this.score);
            bestScore = this.score;
            isNewRecord = true;
        }

        this.ui.showGameOver(this.score, bestScore, isNewRecord);
        this.draw();
    }

    update(dt) {
        if (this.screenShake > 0) {
            this.screenShake -= 30 * dt;
            if (this.screenShake < 0) this.screenShake = 0;
        }
        
        if (this.flipperAngleLeft > 0) this.flipperAngleLeft = Math.max(0, this.flipperAngleLeft - 15 * dt);
        if (this.flipperAngleRight > 0) this.flipperAngleRight = Math.max(0, this.flipperAngleRight - 15 * dt);

        if (this.freezeTimer > 0) {
            this.freezeTimer -= dt;
            if (this.freezeTimer <= 0) {
                this.freezeTimer = 0;
                this.ui.hideRuleAlert();
            }
            return;
        }

        this.timeSinceLastSpawn += dt;
        if (this.timeSinceLastSpawn >= this.spawnIntervalTime) {
            this.items.push(new Item());
            this.timeSinceLastSpawn = 0;
        }

        for (let i = 0; i < this.items.length; i++) {
            this.items[i].update(dt, this.fallSpeed);

            if (!this.items[i].isSorted && this.items[i].y > CONFIG.LOGICAL_HEIGHT - 100) {
                this.triggerGameOver();
                return;
            }
        }

        this.items = this.items.filter(item => item.alpha > 0);

        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    drawBoxes() {
        if (!this.ctx) return;
        const boxHeight = 60;
        const boxY = CONFIG.LOGICAL_HEIGHT - boxHeight;
        const boxWidth = CONFIG.LOGICAL_WIDTH / 2;
        const isColor = this.currentRule === CONFIG.RULES.COLOR;
        
        // Left Box
        this.ctx.fillStyle = isColor ? 'rgba(255, 51, 102, 0.5)' : 'rgba(30, 30, 40, 0.8)';
        this.ctx.fillRect(0, boxY, boxWidth, boxHeight);
        this.ctx.strokeStyle = isColor ? CONFIG.COLORS.RED : '#555';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath(); this.ctx.moveTo(0, boxY); this.ctx.lineTo(boxWidth, boxY); this.ctx.stroke();

        // Right Box
        this.ctx.fillStyle = isColor ? 'rgba(0, 195, 255, 0.5)' : 'rgba(30, 30, 40, 0.8)';
        this.ctx.fillRect(boxWidth, boxY, boxWidth, boxHeight);
        this.ctx.strokeStyle = isColor ? CONFIG.COLORS.BLUE : '#555';
        this.ctx.beginPath(); this.ctx.moveTo(boxWidth, boxY); this.ctx.lineTo(CONFIG.LOGICAL_WIDTH, boxY); this.ctx.stroke();

        // Shape Icons / Size Labels / Number Labels
        if (this.currentRule === CONFIG.RULES.SHAPE) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            this.ctx.lineWidth = 4;
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#fff';
            // Circle left
            this.ctx.beginPath(); this.ctx.arc(boxWidth / 2, boxY + 30, 16, 0, Math.PI * 2); this.ctx.stroke();
            // Square right
            this.ctx.beginPath();
            if (typeof this.ctx.roundRect === 'function') {
                this.ctx.roundRect(boxWidth + boxWidth / 2 - 16, boxY + 14, 32, 32, 6);
            } else {
                this.ctx.rect(boxWidth + boxWidth / 2 - 16, boxY + 14, 32, 32);
            }
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        } else if (this.currentRule === CONFIG.RULES.SIZE) {
            this.drawSizeGuides(boxWidth, boxY);
        } else if (this.currentRule === CONFIG.RULES.NUMBER) {
            this.drawNumberGuides(boxWidth, boxY);
        }

        // 境界線
        this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath(); this.ctx.moveTo(boxWidth, 0); this.ctx.lineTo(boxWidth, CONFIG.LOGICAL_HEIGHT); this.ctx.stroke();
        
        // フリッパー（仕分けゲート）
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        
        // Left Flipper
        this.ctx.save();
        this.ctx.translate(boxWidth, boxY);
        this.ctx.rotate(Math.PI - this.flipperAngleLeft);
        this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.lineTo(boxWidth, 0); this.ctx.stroke();
        this.ctx.restore();

        // Right Flipper
        this.ctx.save();
        this.ctx.translate(boxWidth, boxY);
        this.ctx.rotate(this.flipperAngleRight);
        this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.lineTo(boxWidth, 0); this.ctx.stroke();
        this.ctx.restore();
    }

    drawSizeGuides(boxWidth, boxY) {
        this.ctx.save();
        this.ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        this.ctx.fillStyle = 'rgba(255,255,255,0.92)';
        this.ctx.lineWidth = 4;
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#fff';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        this.ctx.beginPath();
        this.ctx.arc(boxWidth / 2 - 34, boxY + 30, 14, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.font = 'bold 22px "M PLUS Rounded 1c"';
        this.ctx.fillText('小', boxWidth / 2 + 28, boxY + 30);

        this.ctx.beginPath();
        this.ctx.arc(boxWidth + boxWidth / 2 - 46, boxY + 30, 24, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.font = 'bold 28px "M PLUS Rounded 1c"';
        this.ctx.fillText('大', boxWidth + boxWidth / 2 + 34, boxY + 30);
        this.ctx.restore();
    }

    drawNumberGuides(boxWidth, boxY) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(255,255,255,0.92)';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = '#fff';
        this.ctx.font = 'bold 22px "Teko", sans-serif';
        this.ctx.fillText('1 3 5', boxWidth / 2, boxY + 22);
        this.ctx.fillText('2 4 6', boxWidth + boxWidth / 2, boxY + 22);
        this.ctx.shadowBlur = 0;
        this.ctx.font = 'bold 15px "M PLUS Rounded 1c"';
        this.ctx.fillText('奇数', boxWidth / 2, boxY + 46);
        this.ctx.fillText('偶数', boxWidth + boxWidth / 2, boxY + 46);
        this.ctx.restore();
    }

    draw() {
        if (!this.ctx) return;
        this.ctx.save();
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.ctx.clearRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
        
        if (this.screenShake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        this.drawBoxes();

        for (let item of this.items) {
            item.draw(this.ctx);
        }

        this.particles.updateAndDraw(this.ctx, 0.016);

        for (let ft of this.floatingTexts) {
            ft.draw(this.ctx);
        }

        if (this.freezeTimer > 0) {
            this.ctx.fillStyle = 'rgba(255, 215, 0, 0.08)';
            this.ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
        }

        this.ctx.restore();
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        if (dt > 0.1) dt = 0.1;
        this.lastTime = timestamp;

        if (this.state === STATE.PLAYING) {
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

        const rankName = this.ui.rankTextEl ? this.ui.rankTextEl.innerText : '作業員';
        const text = `脳の処理限界に到達…！ 【${this.score}個】のアイテムを仕分けました！ 称号：[${rankName}]`;
        const url = "https://hajikkoroom.xsrv.jp/sorting-factory/";
        const hashtags = "CornerNeighbor,超絶仕分け工場";
        const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`;

        try {
            if (navigator.share) {
                await navigator.share({ title: '超絶！仕分け工場', text, url });
                return;
            }

            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(`${text} ${url} #${hashtags.replace(',', ' #')}`);
                this.showShareFeedback('コピーしました');
                return;
            }
        } catch (error) {
            console.warn('共有処理をフォールバックします。', error);
        }

        const popup = window.open(shareUrl, '_blank', 'noopener,noreferrer');
        if (!popup) this.showShareFeedback('ポップアップを許可してください');
    }

    showShareFeedback(message) {
        const shareBtn = document.getElementById('share-btn');
        if (!shareBtn) return;
        const original = shareBtn.innerText;
        shareBtn.innerText = message;
        window.clearTimeout(this.shareFeedbackTimer);
        this.shareFeedbackTimer = window.setTimeout(() => {
            shareBtn.innerText = original;
        }, 1600);
    }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
