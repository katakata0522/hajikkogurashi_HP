/**
 * ギリギリ・ブレーキ！ - Refactored Main Script
 *
 * [Architecture Overview]
 * - Config: 定数やゲームの基本設定
 * - AudioManager: Web Audio APIを用いた動的サウンド生成の管理
 * - UIManager: DOM操作と画面遷移、アニメーションの管理
 * - ParticleSystem: パーティクル（火花など）の物理演算と描画
 * - GameController: メインのゲームループ、状態遷移、入力判定を統括
 */

const CONFIG = {
    LOGICAL_WIDTH: 1000,
    LOGICAL_HEIGHT: 600,
    GROUND_Y: 450, // 600 * 0.75
    CLIFF_X: 12000,
    BASE_ACC: 1200,
    BASE_FRIC: 1500,
    PLAYER_SIZE: 30
};

const STATE = { START: 0, READY: 1, RUNNING: 2, BRAKING: 3, RESULT: 4 };

const WEATHERS = [
    { name: '☀️ NORMAL', acc: 1.0, fric: 1.0, color: '#fff' },
    { name: '💨 TAILWIND (追い風)', acc: 1.3, fric: 0.8, color: '#00f2fe' },
    { name: '🌪️ HEADWIND (向かい風)', acc: 0.8, fric: 1.2, color: '#ffb347' },
    { name: '🌧️ RAIN (滑る)', acc: 0.9, fric: 0.4, color: '#5555ff' }
];

const SIGNBOARDS = [
    { x: 3000, text: 'あと 90m' },
    { x: 6000, text: 'あと 60m' },
    { x: 9000, text: 'あと 30m' },
    { x: 11000, text: 'あと 10m' },
    { x: 11500, text: '⚠️ DANGER!' }
];

// ==========================================
// AudioManager
// ==========================================
class AudioManager {
    constructor() {
        this.audioCtx = null;
        this.skidOscillator = null;
        this.skidGain = null;
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

    playStart() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('square', 150);
        osc.frequency.exponentialRampToValueAtTime(500, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }

    playFall() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('triangle', 200);
        osc.frequency.exponentialRampToValueAtTime(20, now + 1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.linearRampToValueAtTime(0, now + 1);
        osc.start(now);
        osc.stop(now + 1);
    }

    playSuccess() {
        if (!this.audioCtx) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('sine', 523.25);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        osc.frequency.setValueAtTime(783.99, now + 0.2);
        osc.frequency.setValueAtTime(1046.50, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }

    playSkidStart() {
        if (!this.audioCtx || this.skidOscillator) return;
        const now = this.audioCtx.currentTime;
        const { osc, gain } = this._createOscillator('sawtooth', 600);
        gain.gain.setValueAtTime(0.1, now);
        osc.start(now);
        this.skidOscillator = osc;
        this.skidGain = gain;
    }

    updateSkid(speed) {
        if (this.skidOscillator && speed > 0 && this.audioCtx) {
            const freq = Math.max(100, (speed / 2000) * 600 + 100);
            this.skidOscillator.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
        }
    }

    stopSkid() {
        if (this.skidOscillator && this.audioCtx) {
            const now = this.audioCtx.currentTime;
            this.skidGain.gain.linearRampToValueAtTime(0, now + 0.1);
            this.skidOscillator.stop(now + 0.1);
            this.skidOscillator = null;
            this.skidGain = null;
        }
    }
}

// ==========================================
// UIManager
// ==========================================
class UIManager {
    constructor() {
        this.startScreen = document.getElementById('start-screen');
        this.hud = document.getElementById('hud');
        this.resultScreen = document.getElementById('result-screen');
        
        this.speedValue = document.getElementById('speed-value');
        this.statusText = document.getElementById('status-text');
        this.scoreValue = document.getElementById('score-value');
        this.bestScoreValue = document.getElementById('best-score-value');
        this.newRecordBadge = document.getElementById('new-record-badge');
        this.rankText = document.getElementById('rank-text');
        this.weatherValue = document.getElementById('weather-value');
    }

    showStartScreen() {
        this.startScreen.classList.add('active');
        this.hud.classList.remove('active');
        this.resultScreen.classList.remove('active');
    }

    showHUD(weather) {
        this.startScreen.classList.remove('active');
        this.resultScreen.classList.remove('active');
        this.hud.classList.add('active');

        this.weatherValue.innerText = weather.name;
        this.weatherValue.style.color = weather.color;
        this.statusText.innerText = 'TAP TO GO!';
        this.statusText.className = 'status-text blink';
        this.statusText.style.color = '#ffd700';
        this.speedValue.innerText = '0';
    }

    setStatusDanger() {
        this.statusText.innerText = 'DANGER!!';
        this.statusText.className = 'status-text';
        this.statusText.style.color = '#ff416c';
    }

    setStatusBrake() {
        this.statusText.innerText = 'BRAKE!!';
        this.statusText.style.color = '#ffd700';
    }

    updateSpeed(speed) {
        this.speedValue.innerText = Math.floor(speed / 10);
    }

    showResult(distance, type, bestDist, isNewRecord) {
        this.hud.classList.remove('active');
        this.resultScreen.classList.add('active');
        this.rankText.className = 'rank-text';
        
        if (isNewRecord) {
            this.newRecordBadge.classList.remove('hidden');
        } else {
            this.newRecordBadge.classList.add('hidden');
        }
        this.bestScoreValue.innerText = bestDist ? bestDist.toFixed(2) : '--';

        if (type === 'fall') {
            this.scoreValue.innerText = "落下";
            this.scoreValue.style.color = '#ff416c';
            document.querySelector('.score-unit').style.display = 'none';
            this.rankText.innerText = '大クラッシュ...';
            this.rankText.classList.add('rank-fall');
        } else {
            document.querySelector('.score-unit').style.display = 'inline-block';
            this.scoreValue.style.color = '#00f2fe';

            let current = Math.min(100.0, distance + 50);
            const step = (current - distance) / 30;
            
            const anim = () => {
                current -= step;
                if (current <= distance) {
                    current = distance;
                    this.scoreValue.innerText = current.toFixed(2);
                    this._setRankText(type);
                } else {
                    this.scoreValue.innerText = current.toFixed(2);
                    requestAnimationFrame(anim);
                }
            };
            anim();
        }
    }

    _setRankText(type) {
        if (type === 'perfect') {
            this.rankText.innerText = '神回避！！';
            this.rankText.classList.add('rank-perfect');
        } else if (type === 'success') {
            this.rankText.innerText = 'ナイス・ブレーキ！';
            this.rankText.classList.add('rank-success');
        } else {
            this.rankText.innerText = 'チキン野郎🐔';
            this.rankText.classList.add('rank-chicken');
        }
    }
}

// ==========================================
// ParticleSystem
// ==========================================
class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 6 + 2;
        this.speedX = (Math.random() - 0.5) * -300;
        this.speedY = (Math.random() - 1) * 150;
        this.life = 1.0;
        this.decay = Math.random() * 2.0 + 1.0;
    }
    update(dt) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
        this.life -= this.decay * dt;
        this.size *= Math.max(0, 1 - dt * 2);
    }
    draw(ctx, cameraX, screenShake) {
        if (this.life <= 0) return;
        const screenX = this.x - cameraX;
        if (screenX < 0 || screenX > CONFIG.LOGICAL_WIDTH) return;

        ctx.save();
        if (screenShake > 0) ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(screenX, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }
    addSpark(x, y) {
        this.particles.push(new Particle(x, y));
    }
    updateAndDraw(ctx, dt, cameraX, screenShake) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            p.draw(ctx, cameraX, screenShake);
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }
    clear() {
        this.particles = [];
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
        this.particles = new ParticleSystem();

        this.state = STATE.START;
        this.lastTime = 0;
        this.animationId = null;

        this.weather = WEATHERS[0];
        this.cameraX = 0;
        this.screenShake = 0;
        this.resultDistance = 0;

        this.player = {
            x: 100,
            y: 0,
            speed: 0,
            width: CONFIG.PLAYER_SIZE * 2,
            height: CONFIG.PLAYER_SIZE,
            color: '#00f2fe'
        };

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
        const aspect = CONFIG.LOGICAL_WIDTH / CONFIG.LOGICAL_HEIGHT;
        const windowAspect = this.container.clientWidth / this.container.clientHeight;
        
        if (windowAspect > aspect) {
            this.canvas.style.width = (this.container.clientHeight * aspect) + 'px';
            this.canvas.style.height = this.container.clientHeight + 'px';
        } else {
            this.canvas.style.width = this.container.clientWidth + 'px';
            this.canvas.style.height = (this.container.clientWidth / aspect) + 'px';
        }
        this.canvas.style.position = 'absolute';
        this.canvas.style.left = '50%';
        this.canvas.style.top = '50%';
        this.canvas.style.transform = 'translate(-50%, -50%)';
    }

    bindEvents() {
        const handleInput = (e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            if (this.state === STATE.START || this.state === STATE.RESULT) return;
            if (this.state === STATE.READY) this.triggerRun();
            else if (this.state === STATE.RUNNING) this.triggerBrake();
        };

        this.container.addEventListener('mousedown', handleInput);
        this.container.addEventListener('touchstart', handleInput, { passive: false });

        const startBtn = document.getElementById('start-btn');
        const retryBtn = document.getElementById('retry-btn');
        const shareBtn = document.getElementById('share-btn');
        const menuBtn = document.getElementById('menu-btn');

        startBtn.addEventListener('click', (e) => this.startGame(e));
        startBtn.addEventListener('touchstart', (e) => this.startGame(e));
        retryBtn.addEventListener('click', (e) => this.startGame(e));
        retryBtn.addEventListener('touchstart', (e) => this.startGame(e));
        
        shareBtn.addEventListener('click', (e) => this.shareResult(e));
        shareBtn.addEventListener('touchstart', (e) => this.shareResult(e));
        
        menuBtn.addEventListener('click', (e) => { e.stopPropagation(); window.location.href = '../minigames.html'; });
        menuBtn.addEventListener('touchstart', (e) => { e.stopPropagation(); window.location.href = '../minigames.html'; });
    }

    startGame(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        this.audio.init();
        
        this.weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
        this.state = STATE.READY;
        this.player.x = 20;
        this.player.speed = 0;
        this.cameraX = 0;
        this.screenShake = 0;
        this.particles.clear();
        this.lastTime = 0;
        
        this.ui.showHUD(this.weather);
        this.draw();
    }

    triggerRun() {
        this.audio.playStart();
        this.state = STATE.RUNNING;
        this.ui.setStatusDanger();
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    triggerBrake() {
        this.audio.playSkidStart();
        this.state = STATE.BRAKING;
        this.ui.setStatusBrake();
    }

    triggerGameOverFall() {
        this.audio.stopSkid();
        this.audio.playFall();
        this.state = STATE.RESULT;
        this.screenShake = 20;
        
        let fallSpeedY = 0;
        let fallSpeedX = this.player.speed > 200 ? this.player.speed : 200;
        
        const fallAnim = (timestamp) => {
            if(!this.lastTime) this.lastTime = timestamp;
            let dt = (timestamp - this.lastTime) / 1000;
            this.lastTime = timestamp;

            if (this.screenShake > 0) this.screenShake -= 15 * dt;

            this.player.x += fallSpeedX * dt;
            this.player.y += fallSpeedY * dt;
            fallSpeedY += 1500 * dt;

            this.draw();
            
            if (this.player.y < CONFIG.LOGICAL_HEIGHT + 100) {
                requestAnimationFrame(fallAnim);
            } else {
                this.processResult('fall');
            }
        };
        requestAnimationFrame(fallAnim);
    }

    processResult(type) {
        this.audio.stopSkid();
        this.state = STATE.RESULT;
        this.screenShake = 0;
        
        let isNewRecord = false;
        let bestDist = localStorage.getItem('girigiri_best_distance');
        bestDist = bestDist ? parseFloat(bestDist) : null;

        if (type === 'fall') {
            this.ui.showResult(0, 'fall', bestDist, false);
            return;
        }

        const playerFrontX = this.player.x + this.player.width;
        const distancePixel = CONFIG.CLIFF_X - playerFrontX;
        const distanceMeter = parseFloat((distancePixel / 100).toFixed(2));
        this.resultDistance = distanceMeter;

        let rankType = 'chicken';
        if (distanceMeter < 0 || distanceMeter < 1.0) {
            this.audio.playSuccess();
            rankType = 'perfect';
        } else if (distanceMeter < 5.0) {
            this.audio.playSuccess();
            rankType = 'success';
        }

        if (!bestDist || distanceMeter < bestDist) {
            localStorage.setItem('girigiri_best_distance', distanceMeter.toString());
            bestDist = distanceMeter;
            isNewRecord = true;
        }

        this.ui.showResult(distanceMeter, rankType, bestDist, isNewRecord);
    }

    update(dt) {
        if (this.screenShake > 0) {
            this.screenShake -= 20 * dt;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        if (this.state === STATE.RUNNING) {
            const acc = CONFIG.BASE_ACC * this.weather.acc;
            this.player.speed += acc * dt;
            this.player.x += this.player.speed * dt;
            
            this.ui.updateSpeed(this.player.speed);

            this.cameraX = Math.max(0, this.player.x - (CONFIG.LOGICAL_WIDTH * 0.3));

            if (this.player.x + this.player.width / 2 > CONFIG.CLIFF_X) {
                this.triggerGameOverFall();
            }

        } else if (this.state === STATE.BRAKING) {
            const fric = CONFIG.BASE_FRIC * this.weather.fric;
            this.player.speed -= fric * dt;
            if (this.player.speed < 0) this.player.speed = 0;
            
            this.player.x += this.player.speed * dt;
            this.ui.updateSpeed(this.player.speed);
            
            if (this.player.speed > 200) {
                this.screenShake = Math.min((this.player.speed / 1000) * 15, 15);
                this.particles.addSpark(this.player.x + 5, this.player.y + this.player.height);
            }

            this.audio.updateSkid(this.player.speed);

            const targetCameraX = this.player.x - (CONFIG.LOGICAL_WIDTH * 0.3);
            this.cameraX += (targetCameraX - this.cameraX) * 5 * dt;

            if (this.player.x + this.player.width / 2 > CONFIG.CLIFF_X) {
                this.triggerGameOverFall();
            } else if (this.player.speed <= 0) {
                this.processResult('success');
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

        this.ctx.save();
        if (this.screenShake > 0) {
            const dx = (Math.random() - 0.5) * this.screenShake;
            const dy = (Math.random() - 0.5) * this.screenShake;
            this.ctx.translate(dx, dy);
        }
        
        // --- パララックス背景 ---
        this.ctx.fillStyle = '#111827';
        const bgScrollX = (this.cameraX * 0.2) % 400; 
        for(let i=0; i<4; i++) {
            const x = i * 400 - bgScrollX;
            this.ctx.beginPath();
            this.ctx.moveTo(x, CONFIG.GROUND_Y);
            this.ctx.lineTo(x + 150, CONFIG.GROUND_Y - 200);
            this.ctx.lineTo(x + 300, CONFIG.GROUND_Y);
            this.ctx.fill();
        }

        // --- 地面 ---
        this.ctx.fillStyle = '#0a0a14';
        const cliffScreenX = CONFIG.CLIFF_X - this.cameraX;
        this.ctx.fillRect(0, CONFIG.GROUND_Y, Math.min(CONFIG.LOGICAL_WIDTH, cliffScreenX), CONFIG.LOGICAL_HEIGHT - CONFIG.GROUND_Y);
        
        // --- 崖 ---
        if (cliffScreenX < CONFIG.LOGICAL_WIDTH) {
            this.ctx.fillStyle = '#050508';
            this.ctx.fillRect(cliffScreenX, CONFIG.GROUND_Y, CONFIG.LOGICAL_WIDTH - cliffScreenX, CONFIG.LOGICAL_HEIGHT - CONFIG.GROUND_Y);
            
            this.ctx.save();
            this.ctx.translate(cliffScreenX - 30, CONFIG.GROUND_Y);
            const stripeCount = 10;
            const stripeWidth = (CONFIG.LOGICAL_HEIGHT - CONFIG.GROUND_Y) / stripeCount;
            for (let i = 0; i < stripeCount; i++) {
                this.ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#222';
                this.ctx.fillRect(0, i * stripeWidth, 30, stripeWidth);
            }
            this.ctx.restore();

            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#ff416c';
            this.ctx.strokeStyle = '#ff416c';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(cliffScreenX, CONFIG.GROUND_Y);
            this.ctx.lineTo(cliffScreenX, CONFIG.LOGICAL_HEIGHT);
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
        }

        // --- 地面のライン ---
        this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
        this.ctx.lineWidth = 2;
        const lineScrollX = this.cameraX % 200;
        for(let i=0; i<6; i++) {
            const x = i * 200 - lineScrollX;
            if (x < cliffScreenX) {
                this.ctx.beginPath();
                this.ctx.moveTo(x, CONFIG.GROUND_Y);
                this.ctx.lineTo(x - 100, CONFIG.LOGICAL_HEIGHT);
                this.ctx.stroke();
            }
        }

        this.ctx.strokeStyle = '#ff416c';
        this.ctx.lineWidth = 4;
        this.ctx.beginPath();
        this.ctx.moveTo(0, CONFIG.GROUND_Y);
        this.ctx.lineTo(Math.min(CONFIG.LOGICAL_WIDTH, cliffScreenX), CONFIG.GROUND_Y);
        this.ctx.stroke();

        // --- 看板 ---
        for (let sign of SIGNBOARDS) {
            const signScreenX = sign.x - this.cameraX;
            if (signScreenX > -100 && signScreenX < CONFIG.LOGICAL_WIDTH + 100) {
                this.ctx.fillStyle = '#555';
                this.ctx.fillRect(signScreenX - 5, CONFIG.GROUND_Y - 80, 10, 80);
                this.ctx.fillStyle = '#222';
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.fillRect(signScreenX - 60, CONFIG.GROUND_Y - 120, 120, 40);
                this.ctx.strokeRect(signScreenX - 60, CONFIG.GROUND_Y - 120, 120, 40);
                this.ctx.fillStyle = sign.text.includes('DANGER') ? '#ff416c' : '#fff';
                this.ctx.font = 'bold 16px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(sign.text, signScreenX, CONFIG.GROUND_Y - 100);
            }
        }

        this.ctx.restore(); // 画面揺れ解除

        // --- プレイヤー描画 ---
        this.ctx.save();
        if (this.screenShake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }
        const screenX = this.player.x - this.cameraX;
        this.player.y = CONFIG.GROUND_Y - this.player.height;
        
        this.ctx.fillStyle = this.player.color;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.player.color;
        
        this.ctx.beginPath();
        this.ctx.roundRect(screenX, this.player.y, this.player.width, this.player.height, 6);
        this.ctx.fill();

        this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
        this.ctx.shadowBlur = 0;
        this.ctx.beginPath();
        this.ctx.roundRect(screenX + this.player.width - 15, this.player.y + 5, 10, this.player.height - 10, 2);
        this.ctx.fill();

        if (this.state === STATE.BRAKING) {
            this.ctx.fillStyle = '#ff0000';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#ff0000';
            this.ctx.beginPath();
            this.ctx.roundRect(screenX - 5, this.player.y + 5, 8, this.player.height - 10, 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;
        }
        this.ctx.restore();
    }

    loop(timestamp) {
        if(!this.lastTime) this.lastTime = timestamp;
        let dt = (timestamp - this.lastTime) / 1000;
        if(dt > 0.1) dt = 0.1;
        this.lastTime = timestamp;

        if(this.state !== STATE.RESULT) {
            this.update(dt);
        }
        
        this.draw();
        // dtを渡してパーティクルを更新＆描画
        this.particles.updateAndDraw(this.ctx, dt, this.cameraX, this.screenShake);

        if (this.state !== STATE.START) {
            this.animationId = requestAnimationFrame((t) => this.loop(t));
        }
    }

    shareResult(e) {
        e.stopPropagation();
        const rankText = document.getElementById('rank-text').innerText;
        let text = "";
        if (rankText === '大クラッシュ...') {
            text = `【${this.weather.name}】あああああ！崖から落ちた…（チキン度 100%）`;
        } else {
            text = `【${this.weather.name}】崖っぷちでストップ！残り距離 ${this.resultDistance}m！！ [評価: ${rankText}]`;
        }
        const url = "https://hajikkoroom.xsrv.jp/girigiri-brake/";
        const hashtags = "はじっこぐらし,ギリギリブレーキ";
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
    }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
