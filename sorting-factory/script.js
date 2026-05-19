/**
 * 超絶！仕分け工場 - Refactored Main Script
 */

const CONFIG = {
    LOGICAL_WIDTH: 600,
    LOGICAL_HEIGHT: 1500,
    COLORS: { RED: '#ff3366', BLUE: '#00c3ff' },
    SHAPES: { CIRCLE: 0, SQUARE: 1 },
    SIZES: { SMALL: 60, LARGE: 110 },
    RULES: { COLOR: '色', SHAPE: '形', SIZE: '大きさ', NUMBER: '数字' }
};

const STATE = { START: 0, PLAYING: 1, GAMEOVER: 2 };

// ==========================================
// AudioManager
// ==========================================
class AudioManager {
    constructor() {
        this.audioCtx = null;
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

    playSort(combo) {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('sine', 800 + (Math.min(combo, 20) * 20));
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }

    playError() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('sawtooth', 150);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playSiren() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('square', 600);
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.2);
        osc.frequency.setValueAtTime(600, now + 0.4);
        osc.frequency.setValueAtTime(800, now + 0.6);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0, now + 1.0);
        osc.start(now);
        osc.stop(now + 1.0);
    }

    playSlam() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('square', 100);
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
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
        this.comboValueEl = document.getElementById('combo-value');
        this.finalScoreEl = document.getElementById('final-score');
        this.maxComboEl = document.getElementById('max-combo');
        this.rankTextEl = document.getElementById('rank-text');
        
        this.bestScoreValueEl = document.getElementById('best-score-value');
        this.bestComboValueEl = document.getElementById('best-combo-value');
        this.newRecordBadge = document.getElementById('new-record-badge');
    }

    startGameUI() {
        this.startScreen.classList.remove('active');
        this.resultScreen.classList.remove('active');
        this.scoreHud.classList.remove('hidden');
        this.ruleDisplay.classList.remove('hidden');
        this.touchLeft.classList.remove('hidden');
        this.touchRight.classList.remove('hidden');
        this.bgEffect.classList.add('moving');
        this.updateScore(0, 0);
    }

    setRule(ruleName) {
        this.currentRuleText.innerText = `${ruleName}で仕分けろ！`;
        this.ruleDisplay.classList.add('changed');
        setTimeout(() => this.ruleDisplay.classList.remove('changed'), 300);
    }

    showRuleAlert(ruleName) {
        this.alertText.innerText = ruleName;
        this.ruleAlert.classList.remove('hidden');
    }

    hideRuleAlert() {
        this.ruleAlert.classList.add('hidden');
    }

    updateScore(score, combo) {
        this.scoreValueEl.innerText = score;
        if (combo > 1) {
            this.comboValueEl.innerText = `${combo} COMBO!`;
            this.comboValueEl.style.opacity = 1;
            if (combo > 10) this.comboValueEl.classList.add('high');
            else this.comboValueEl.classList.remove('high');
        } else {
            this.comboValueEl.style.opacity = 0;
        }
    }

    showGameOver(score, maxCombo, bestScore, bestCombo, isNewRecord) {
        this.bgEffect.classList.remove('moving');
        this.scoreHud.classList.add('hidden');
        this.ruleDisplay.classList.add('hidden');
        this.touchLeft.classList.add('hidden');
        this.touchRight.classList.add('hidden');

        this.finalScoreEl.innerText = score;
        this.maxComboEl.innerText = maxCombo;
        
        this.bestScoreValueEl.innerText = bestScore !== null ? bestScore : '--';
        this.bestComboValueEl.innerText = bestCombo !== null ? bestCombo : '--';

        if (isNewRecord) {
            this.newRecordBadge.classList.remove('hidden');
        } else {
            this.newRecordBadge.classList.add('hidden');
        }

        if (score < 10) this.rankTextEl.innerText = 'クビ寸前';
        else if (score < 30) this.rankTextEl.innerText = '新人バイト';
        else if (score < 60) this.rankTextEl.innerText = '優秀なパート';
        else if (score < 100) this.rankTextEl.innerText = '熟練ライン長';
        else this.rankTextEl.innerText = 'スーパーAI頭脳';

        this.resultScreen.classList.add('active');
    }
}

// ==========================================
// Entities (Item & Particles)
// ==========================================
class Item {
    constructor() {
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

    draw(ctx, currentRule) {
        if (this.alpha <= 0) return;
        ctx.globalAlpha = Math.max(0, this.alpha);
        
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        if (this.shape === CONFIG.SHAPES.CIRCLE) {
            ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.roundRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size, 12);
            ctx.fill();
        }

        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = `bold ${this.size * 0.6}px "Teko", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(this.number, this.x, this.y + (this.size * 0.05));

        ctx.globalAlpha = 1.0;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 15 + 5;
        this.vx = (Math.random() - 0.5) * 600;
        this.vy = (Math.random() - 0.5) * 600;
        this.life = 1.0;
    }
    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= 2.0 * dt;
        this.size *= Math.max(0, 1 - dt * 2);
    }
    draw(ctx) {
        if(this.life <= 0) return;
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI*2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

class ParticleSystem {
    constructor() { this.particles = []; }
    spawn(x, y, color) {
        for(let i=0; i<20; i++) this.particles.push(new Particle(x, y, color));
    }
    updateAndDraw(ctx, dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            this.particles[i].draw(ctx);
            if (this.particles[i].life <= 0) this.particles.splice(i, 1);
        }
    }
    clear() { this.particles = []; }
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
        this.particles = new ParticleSystem();

        this.state = STATE.START;
        this.lastTime = 0;
        this.animationId = null;

        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.currentRule = CONFIG.RULES.COLOR;
        
        this.items = [];
        this.fallSpeed = 300;
        this.spawnIntervalTime = 1.5;
        this.timeSinceLastSpawn = 0;

        this.screenShake = 0;

        this.initCanvas();
        this.bindEvents();
        this.drawBoxes();
    }

    initCanvas() {
        this.canvas.width = CONFIG.LOGICAL_WIDTH;
        this.canvas.height = CONFIG.LOGICAL_HEIGHT;
        window.addEventListener('resize', () => this.resizeCanvas());
        this.resizeCanvas();
    }

    resizeCanvas() {
        const aspect = CONFIG.LOGICAL_WIDTH / CONFIG.LOGICAL_HEIGHT;
        const windowAspect = this.container.clientWidth / this.container.clientHeight;
        
        let cssWidth, cssHeight;
        if (windowAspect > aspect) {
            cssWidth = (this.container.clientHeight * aspect);
            cssHeight = this.container.clientHeight;
        } else {
            cssWidth = this.container.clientWidth;
            cssHeight = (this.container.clientWidth / aspect);
        }

        const styles = {
            width: cssWidth + 'px',
            height: cssHeight + 'px',
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)'
        };

        Object.assign(this.canvas.style, styles);
        const uiLayer = document.getElementById('ui-layer');
        Object.assign(uiLayer.style, styles);
    }

    bindEvents() {
        const handleInput = (dir, e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            this.processInput(dir);
        };

        window.addEventListener('keydown', (e) => {
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
        
        this.ui.touchLeft.addEventListener('touchstart', (e) => handleInput(-1, e), {passive: false});
        this.ui.touchRight.addEventListener('touchstart', (e) => handleInput(1, e), {passive: false});
        this.ui.touchLeft.addEventListener('mousedown', (e) => handleInput(-1, e));
        this.ui.touchRight.addEventListener('mousedown', (e) => handleInput(1, e));

        const startBtn = document.getElementById('start-btn');
        const retryBtn = document.getElementById('retry-btn');
        const shareBtn = document.getElementById('share-btn');
        const menuBtn = document.getElementById('menu-btn');

        const startWrapper = (e) => { e.stopPropagation(); e.preventDefault(); this.startGame(); };
        startBtn.addEventListener('click', startWrapper);
        startBtn.addEventListener('touchstart', startWrapper);
        retryBtn.addEventListener('click', startWrapper);
        retryBtn.addEventListener('touchstart', startWrapper);

        shareBtn.addEventListener('click', (e) => this.shareResult(e));
        shareBtn.addEventListener('touchstart', (e) => this.shareResult(e));

        const goMenu = (e) => { e.stopPropagation(); window.location.href = '../minigames.html'; };
        menuBtn.addEventListener('click', goMenu);
        menuBtn.addEventListener('touchstart', goMenu);
    }

    startGame() {
        this.audio.init();
        this.state = STATE.PLAYING;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
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
        this.particles.clear();
        this.ui.hideRuleAlert();
        
        this.currentRule = CONFIG.RULES.COLOR;
        this.ui.startGameUI();
        this.ui.setRule(this.currentRule);

        if(this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    getRandomRuleChangeCount() {
        return Math.floor(Math.random() * 11) + 5; // 5回〜15回
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
        if(this.currentRule !== newRule && this.state === STATE.PLAYING) {
            this.audio.playSiren();
            this.freezeTimer = 1.0; // 1秒間タイムフリーズして思考時間を確保
            this.ui.showRuleAlert(newRule);
        }
        this.currentRule = newRule;
        this.ui.setRule(this.currentRule);
    }

    processInput(direction) {
        if (this.state !== STATE.PLAYING) return;
        if (this.freezeTimer > 0) return; // フリーズ中は入力を無視

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
            expectedDir = targetItem.number % 2 !== 0 ? -1 : 1; // 奇数は左(-1)、偶数は右(1)
        }

        if (direction === expectedDir) {
            this.audio.playSlam();
            targetItem.isSorted = true;
            targetItem.sortDir = direction;
            if (direction === -1) this.flipperAngleLeft = Math.PI / 3;
            else this.flipperAngleRight = Math.PI / 3;

            this.particles.spawn(targetItem.x, targetItem.y, targetItem.color);
            
            this.score++;
            this.combo++;
            if (this.combo > this.maxCombo) this.maxCombo = this.combo;
            
            this.fallSpeed = Math.min(this.fallSpeed + 10, 1500);
            this.spawnIntervalTime = Math.max(this.spawnIntervalTime - 0.02, 0.4);

            this.sortsUntilChange--;
            if (this.sortsUntilChange <= 0) {
                this.setRule(this.getRandomRule());
                this.sortsUntilChange = this.getRandomRuleChangeCount();
            }

            this.ui.updateScore(this.score, this.combo);
        } else {
            this.triggerGameOver();
        }
    }

    triggerGameOver() {
        this.audio.playError();
        this.state = STATE.GAMEOVER;
        cancelAnimationFrame(this.animationId);
        
        this.container.style.backgroundColor = '#ff0000';
        this.screenShake = 15;
        setTimeout(() => { this.container.style.backgroundColor = '#111118'; }, 100);

        let isNewRecord = false;
        let bestScore = localStorage.getItem('sorting_best_score');
        let bestCombo = localStorage.getItem('sorting_best_combo');
        
        bestScore = bestScore ? parseInt(bestScore) : null;
        bestCombo = bestCombo ? parseInt(bestCombo) : null;

        if (!bestScore || this.score > bestScore) {
            localStorage.setItem('sorting_best_score', this.score.toString());
            bestScore = this.score;
            isNewRecord = true;
        }
        if (!bestCombo || this.maxCombo > bestCombo) {
            localStorage.setItem('sorting_best_combo', this.maxCombo.toString());
            bestCombo = this.maxCombo;
        }

        this.ui.showGameOver(this.score, this.maxCombo, bestScore, bestCombo, isNewRecord);
        this.draw(); // Final render with shake
    }

    update(dt) {
        if (this.screenShake > 0) {
            this.screenShake -= 30 * dt;
            if (this.screenShake < 0) this.screenShake = 0;
        }
        
        if (this.flipperAngleLeft > 0) this.flipperAngleLeft = Math.max(0, this.flipperAngleLeft - 15 * dt);
        if (this.flipperAngleRight > 0) this.flipperAngleRight = Math.max(0, this.flipperAngleRight - 15 * dt);

        // タイムフリーズ中の処理
        if (this.freezeTimer > 0) {
            this.freezeTimer -= dt;
            if (this.freezeTimer <= 0) {
                this.freezeTimer = 0;
                this.ui.hideRuleAlert();
            }
            return; // タイムフリーズ中はアイテムの移動と出現をストップ
        }

        this.timeSinceLastSpawn += dt;
        if (this.timeSinceLastSpawn >= this.spawnIntervalTime) {
            this.items.push(new Item());
            this.timeSinceLastSpawn = 0;
        }

        for (let i = 0; i < this.items.length; i++) {
            this.items[i].update(dt, this.fallSpeed);

            if (!this.items[i].isSorted && this.items[i].y > CONFIG.LOGICAL_HEIGHT - 150) {
                this.triggerGameOver();
                return;
            }
        }

        this.items = this.items.filter(item => item.alpha > 0);
    }

    drawBoxes() {
        const boxY = CONFIG.LOGICAL_HEIGHT - 150;
        const boxWidth = CONFIG.LOGICAL_WIDTH / 2;
        const isColor = this.currentRule === CONFIG.RULES.COLOR;
        
        // Left Box
        this.ctx.fillStyle = isColor ? 'rgba(255, 51, 102, 0.5)' : 'rgba(30, 30, 40, 0.8)';
        this.ctx.fillRect(0, boxY, boxWidth, 150);
        this.ctx.strokeStyle = isColor ? CONFIG.COLORS.RED : '#555';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath(); this.ctx.moveTo(0, boxY); this.ctx.lineTo(boxWidth, boxY); this.ctx.stroke();

        // Right Box
        this.ctx.fillStyle = isColor ? 'rgba(0, 195, 255, 0.5)' : 'rgba(30, 30, 40, 0.8)';
        this.ctx.fillRect(boxWidth, boxY, boxWidth, 150);
        this.ctx.strokeStyle = isColor ? CONFIG.COLORS.BLUE : '#555';
        this.ctx.beginPath(); this.ctx.moveTo(boxWidth, boxY); this.ctx.lineTo(CONFIG.LOGICAL_WIDTH, boxY); this.ctx.stroke();

        // Shape Icons / Size Labels / Number Labels
        if (this.currentRule === CONFIG.RULES.SHAPE) {
            this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
            this.ctx.lineWidth = 10;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#fff';
            // Circle left
            this.ctx.beginPath(); this.ctx.arc(boxWidth/2, boxY + 75, 40, 0, Math.PI*2); this.ctx.stroke();
            // Square right
            this.ctx.beginPath(); this.ctx.roundRect(boxWidth + boxWidth/2 - 40, boxY + 35, 80, 80, 10); this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        } else if (this.currentRule === CONFIG.RULES.SIZE) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 40px "M PLUS Rounded 1c"';
            this.ctx.fillText('小 (SMALL)', boxWidth/2, boxY + 85);
            this.ctx.font = 'bold 50px "M PLUS Rounded 1c"';
            this.ctx.fillText('大 (LARGE)', boxWidth + boxWidth/2, boxY + 85);
        } else if (this.currentRule === CONFIG.RULES.NUMBER) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
            this.ctx.textAlign = 'center';
            this.ctx.font = 'bold 30px "M PLUS Rounded 1c"';
            this.ctx.fillText('奇数 (1,3,5...)', boxWidth/2, boxY + 85);
            this.ctx.fillText('偶数 (2,4,6...)', boxWidth + boxWidth/2, boxY + 85);
        }

        // 境界線
        this.ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath(); this.ctx.moveTo(boxWidth, 0); this.ctx.lineTo(boxWidth, CONFIG.LOGICAL_HEIGHT); this.ctx.stroke();
        
        // フリッパー（仕分けゲート）の描画
        this.ctx.strokeStyle = '#ffd700';
        this.ctx.lineWidth = 10;
        this.ctx.lineCap = 'round';
        
        // Left Flipper
        this.ctx.save();
        this.ctx.translate(boxWidth, boxY);
        this.ctx.rotate(Math.PI - this.flipperAngleLeft);
        this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.lineTo(boxWidth - 20, 0); this.ctx.stroke();
        this.ctx.restore();

        // Right Flipper
        this.ctx.save();
        this.ctx.translate(boxWidth, boxY);
        this.ctx.rotate(this.flipperAngleRight);
        this.ctx.beginPath(); this.ctx.moveTo(0, 0); this.ctx.lineTo(boxWidth - 20, 0); this.ctx.stroke();
        this.ctx.restore();

        // 次のルール変更までのカウントダウン
        this.ctx.fillStyle = '#ffd700';
        this.ctx.font = 'bold 24px "Teko"';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`NEXT OVERRIDE IN : ${this.sortsUntilChange}`, CONFIG.LOGICAL_WIDTH / 2, boxY - 30);
    }

    draw() {
        this.ctx.clearRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
        
        this.ctx.save();
        if (this.screenShake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        this.drawBoxes();

        for (let item of this.items) {
            item.draw(this.ctx, this.currentRule);
        }

        this.ctx.restore();
    }

    loop(timestamp) {
        if(!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        if(dt > 0.1) dt = 0.1;
        this.lastTime = timestamp;

        if (this.state === STATE.PLAYING) {
            this.update(dt);
            this.draw();
            this.particles.updateAndDraw(this.ctx, dt);
            this.animationId = requestAnimationFrame((t) => this.loop(t));
        }
    }

    shareResult(e) {
        e.stopPropagation();
        const text = `脳の処理限界に到達…！ 【${this.score}個】のアイテムを仕分けました！（最大${this.maxCombo}コンボ） 称号：[${this.ui.rankTextEl.innerText}]`;
        const url = "https://hajikkoroom.xsrv.jp/sorting-factory/";
        const hashtags = "はじっこぐらし,超絶仕分け工場";
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
    }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});