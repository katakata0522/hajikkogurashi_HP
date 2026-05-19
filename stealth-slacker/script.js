/**
 * 限界！ステルスサボタージュ - Refactored Main Script
 */

const CONFIG = {
    LOGICAL_WIDTH: 600,
    LOGICAL_HEIGHT: 800
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

        this.scoreValueEl = document.getElementById('score-value');
        this.finalScoreEl = document.getElementById('final-score');
        this.bestScoreValueEl = document.getElementById('best-score-value');
        this.newRecordBadge = document.getElementById('new-record-badge');
        this.rankTextEl = document.getElementById('rank-text');
    }

    startGameUI() {
        this.startScreen.classList.remove('active');
        this.resultScreen.classList.remove('active');
        this.scoreHud.classList.remove('hidden');
        this.hintText.classList.remove('hidden');
        this.scoreValueEl.innerText = '0';
        this.scoreValueEl.style.transform = 'scale(1)';
        this.scoreValueEl.style.color = 'var(--border-color)';
        this.bgFever.style.animationDuration = '10s';
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
        
        // カオス演出（スコアが高いほど赤くなり、揺れる）
        if (score > 10000) {
            const chaosLevel = Math.min((score - 10000) / 100000, 1); // 0 to 1
            const scale = 1 + (chaosLevel * 0.5);
            const red = Math.floor(chaosLevel * 255);
            this.scoreValueEl.style.transform = `scale(${scale}) rotate(${(Math.random()-0.5)*10*chaosLevel}deg)`;
            this.scoreValueEl.style.color = `rgb(${red}, 0, 0)`;
            
            // 背景の回転速度UP
            const duration = Math.max(1, 10 - (chaosLevel * 9));
            this.bgFever.style.animationDuration = `${duration}s`;
        }
    }

    showGameOver(score, bestScore, isNewRecord) {
        this.bgFever.classList.remove('active');
        this.hintText.classList.add('hidden');
        this.scoreHud.classList.add('hidden');
        
        let rank = "";
        if (score < 5000) rank = "真面目か！";
        else if (score < 20000) rank = "給料泥棒";
        else if (score < 50000) rank = "プロニート";
        else if (score < 100000) rank = "伝説のサボり魔";
        else rank = "会社を裏で牛耳る者";

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
        
        this.isSlacking = false;
        this.score = 0;
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
        const handleDown = (e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            if (this.gameState === STATE.START || this.gameState === STATE.RESULT) return;
            this.startSlacking();
        };

        const handleUp = (e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            this.stopSlacking();
        };

        this.container.addEventListener('mousedown', handleDown);
        window.addEventListener('mouseup', handleUp);
        this.container.addEventListener('touchstart', handleDown, {passive: false});
        window.addEventListener('touchend', handleUp, {passive: false});
        window.addEventListener('touchcancel', handleUp, {passive: false});
        
        // コンテキストメニュー（右クリック・長押しメニュー）を無効化
        window.addEventListener('contextmenu', (e) => { e.preventDefault(); });

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

    triggerGameOver() {
        this.gameState = STATE.GAMEOVER;
        this.audio.stopEnvironmentSounds();
        this.audio.playEffect('gameover');
        this.screenShake = 30;
        
        // Flash Red
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);
        
        let isNewRecord = false;
        let bestScore = localStorage.getItem('stealth_best_score');
        bestScore = bestScore ? parseInt(bestScore) : null;

        if (!bestScore || this.score > bestScore) {
            localStorage.setItem('stealth_best_score', Math.floor(this.score).toString());
            bestScore = this.score;
            isNewRecord = true;
        }

        this.ui.showGameOver(this.score, bestScore, isNewRecord);
        this.draw(); 
    }

    update(dt) {
        const dtMs = dt * 1000;

        if (this.screenShake > 0) {
            this.screenShake -= 50 * dt;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        // --- Score & Chaos ---
        if (this.isSlacking) {
            const scorePerSec = (Math.floor(this.score / 1000) + 10) * 60;
            this.score += scorePerSec * dt;
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
                // スコアが高いほどフェイント率上昇、最大50%
                const feintRate = Math.min(0.1 + (this.score / 50000), 0.5);
                this.isFeint = Math.random() < feintRate;
                
                this.bossState = BOSS.WARNING;
                // 警戒時間。スコアが高いほど短くなる
                const warningTime = Math.max(200, 1000 - (this.score / 100));
                this.bossTimer = warningTime;
                this.audio.playEffect('warning');
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
                this.triggerGameOver();
                return;
            }
            if (this.bossTimer <= 0) {
                this.bossState = BOSS.AWAY;
                const nextAwayTime = Math.max(500, 3000 - (this.score / 50));
                this.bossTimer = this.getRandomInt(nextAwayTime, nextAwayTime + 1500);
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
            this.ctx.fillStyle = '#ffd700';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ffd700';
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
            
            // ゲーム機
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath(); this.ctx.roundRect(playerX - 35, playerY + 15, 70, 35, 10); this.ctx.fill();
            this.ctx.fillStyle = '#111';
            this.ctx.fillRect(playerX - 25, playerY + 20, 50, 25);
            
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

            // 汗
            if (this.bossState === BOSS.LOOKING && this.gameState !== STATE.GAMEOVER) {
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

    shareResult(e) {
        e.stopPropagation();
        const text = `上司の目を盗んで【${Math.floor(this.score)}】サボりました。バレてクビになりました。 称号：[${this.ui.rankTextEl.innerText}]`;
        const url = "https://hajikkoroom.xsrv.jp/stealth-slacker/";
        const hashtags = "限界ステルスサボタージュ,はじっこぐらし";
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
    }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});