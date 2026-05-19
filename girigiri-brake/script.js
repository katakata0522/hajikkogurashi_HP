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
        
        // 高音の摩擦悲鳴（キキキーッ）をリアルに表現するため、2つの波形オシレーターをミックス
        const { osc, gain } = this._createOscillator('sawtooth', 850);
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1700, now);
        
        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        
        gain.gain.setValueAtTime(0.06, now);
        gain2.gain.setValueAtTime(0.03, now);
        
        osc.start(now);
        osc2.start(now);
        
        this.skidOscillator = osc;
        this.skidOscillator2 = osc2;
        this.skidGain = gain;
        this.skidGain2 = gain2;
    }

    updateSkid(speed) {
        if (this.skidOscillator && speed > 0 && this.audioCtx) {
            const now = this.audioCtx.currentTime;
            // 速度低下に合わせて摩擦ピッチがキキーと変化するよう動的に制御
            const baseFreq = Math.max(250, (speed / 2000) * 600 + 250);
            
            // ビブラート（高速揺れ）を加えてタイヤがアスファルトを削る粗い摩擦感を再現
            const vibrato = Math.sin(now * 60) * 20;
            this.skidOscillator.frequency.setValueAtTime(baseFreq + vibrato, now);
            
            if (this.skidOscillator2) {
                this.skidOscillator2.frequency.setValueAtTime((baseFreq * 2) + vibrato, now);
            }
        }
    }

    stopSkid() {
        if (this.skidOscillator && this.audioCtx) {
            const now = this.audioCtx.currentTime;
            this.skidGain.gain.linearRampToValueAtTime(0, now + 0.1);
            this.skidOscillator.stop(now + 0.1);
            this.skidOscillator = null;
            this.skidGain = null;
            
            if (this.skidOscillator2) {
                this.skidGain2.gain.linearRampToValueAtTime(0, now + 0.1);
                this.skidOscillator2.stop(now + 0.1);
                this.skidOscillator2 = null;
                this.skidGain2 = null;
            }
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
        if (type === 'fall') return; // 落下時はshowResultで処理済み

        const dist = type; // processResultから距離(m)を直接受け取る
        const totalDist = (CONFIG.CLIFF_X - 20) / 100; // 全体距離(m)
        const percent = (dist / totalDist) * 100; // 残り距離の割合(%)

        this.rankText.className = 'rank-text'; // クラスリセット

        if (dist < 1.0) {
            this.rankText.innerText = '神回避！！🔥';
            this.rankText.classList.add('rank-perfect');
        } else if (dist < 3.0) {
            this.rankText.innerText = '凄腕ドライバー🚗💨';
            this.rankText.classList.add('rank-success');
        } else if (percent < 5) {
            this.rankText.innerText = 'ナイス・ブレーキ👍';
            this.rankText.classList.add('rank-success');
        } else if (percent < 15) {
            this.rankText.innerText = 'ビビリ運転手🔰';
            this.rankText.classList.add('rank-chicken');
        } else if (percent < 30) {
            this.rankText.innerText = 'チキン野郎🐔';
            this.rankText.classList.add('rank-chicken');
        } else if (percent < 60) {
            this.rankText.innerText = '超絶チキン野郎🐣';
            this.rankText.classList.add('rank-chicken');
        } else {
            this.rankText.innerText = '歩いた方がマシ🐌';
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
            y: CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE,
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
        const handleInput = (e) => {
            if (e) { e.stopPropagation(); e.preventDefault(); }
            if (this.state === STATE.START || this.state === STATE.RESULT) return;
            if (this.state === STATE.READY) this.triggerRun();
            else if (this.state === STATE.RUNNING) this.triggerBrake();
        };

        // PointerEventsを利用して、タッチとクリックの重複発火（ゴーストタップ）を完全に防止
        this.container.addEventListener('pointerdown', handleInput);

        // PC向け：スペースキーでの直感的なプレイ操作を追加
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault(); // 画面スクロールを防止
                if (this.state === STATE.START || this.state === STATE.RESULT) {
                    this.startGame();
                } else {
                    handleInput(e);
                }
            }
        });

        const startBtn = document.getElementById('start-btn');
        const retryBtn = document.getElementById('retry-btn');
        const shareBtn = document.getElementById('share-btn');
        const menuBtn = document.getElementById('menu-btn');

        // ボタンのクリックイベントは click イベントのみで制御（モバイル・PC共に高レスポンスで動く）
        startBtn.addEventListener('click', (e) => this.startGame(e));
        retryBtn.addEventListener('click', (e) => this.startGame(e));
        shareBtn.addEventListener('click', (e) => this.shareResult(e));
        menuBtn.addEventListener('click', (e) => { e.stopPropagation(); window.location.href = '../minigames.html'; });
    }

    startGame(e) {
        if (e) { e.stopPropagation(); e.preventDefault(); }
        this.audio.init();
        
        // --- ランダム要素の追加 ---
        // 崖までの距離を毎回ランダムに設定（10000px 〜 15000px）し、タイミングの暗記を防止
        CONFIG.CLIFF_X = Math.floor(Math.random() * 5000) + 10000;
        
        // 崖からの相対距離で看板を動的生成（ランダム距離対応）
        this.signboards = [
            { x: Math.max(0, CONFIG.CLIFF_X - 9000), text: 'あと 90m' },
            { x: Math.max(0, CONFIG.CLIFF_X - 6000), text: 'あと 60m' },
            { x: Math.max(0, CONFIG.CLIFF_X - 3000), text: 'あと 30m' },
            { x: Math.max(0, CONFIG.CLIFF_X - 1000), text: 'あと 10m' },
            { x: Math.max(0, CONFIG.CLIFF_X - 500),  text: '⚠️ DANGER!' }
        ];

        this.weather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
        this.state = STATE.READY;
        this.player.x = 20;
        this.player.y = CONFIG.GROUND_Y - CONFIG.PLAYER_SIZE; // 落下後の再スタート時に車が画面外に取り残されるバグを修正
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
            if (dt > 0.1) dt = 0.1; // タブ切り替え時のワープ落下を防止
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

        if (distanceMeter < 0 || distanceMeter < 5.0) {
            this.audio.playSuccess();
        }

        // _setRankTextに直接距離(m)を渡して詳細な評価判定を行わせる
        let rankType = distanceMeter;

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

            // 速度に応じてカメラの先読み量を動的に変更（スピードが速いほど自車が画面左寄りに配置され、前方視野が大きく広がる）
            const lookAheadFactor = Math.min(0.18, (this.player.speed / 5000) * 0.15); // スピードに応じて最大15%視野を広げる
            const cameraPercent = 0.3 - lookAheadFactor; 
            const targetCameraX = Math.max(0, this.player.x - (CONFIG.LOGICAL_WIDTH * cameraPercent));
            // 急激なカメラジャンプを防ぎ、ダイナミックで滑らかな追従を実現
            this.cameraX += (targetCameraX - this.cameraX) * 8 * dt;

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

            // ブレーキ中も減速に合わせて滑らかにカメラの先読み量を調整
            const lookAheadFactor = Math.min(0.18, (this.player.speed / 5000) * 0.15);
            const cameraPercent = 0.3 - lookAheadFactor;
            const targetCameraX = this.player.x - (CONFIG.LOGICAL_WIDTH * cameraPercent);
            this.cameraX += (targetCameraX - this.cameraX) * 8 * dt;

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
        if (this.signboards) {
            for (let sign of this.signboards) {
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


        // --- 天候エフェクト描画（背景・雰囲気の可視化） ---
        if (this.weather.name.includes('RAIN')) {
            this.ctx.strokeStyle = 'rgba(174, 207, 238, 0.4)';
            this.ctx.lineWidth = 1.5;
            const rainSeed = (Date.now() / 12) % 300;
            for (let i = 0; i < 40; i++) {
                const x = ((i * 37) + rainSeed * 2.5) % CONFIG.LOGICAL_WIDTH;
                const y = ((i * 19) + rainSeed * 5) % CONFIG.LOGICAL_HEIGHT;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x - 6, y + 18);
                this.ctx.stroke();
            }
        } else if (this.weather.name.includes('TAILWIND')) {
            this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
            this.ctx.lineWidth = 1.2;
            const windSeed = (Date.now() / 10) % 500;
            for (let i = 0; i < 8; i++) {
                const x = ((i * 123) + windSeed * 4.5) % (CONFIG.LOGICAL_WIDTH + 100) - 50;
                const y = (i * 73) % (CONFIG.LOGICAL_HEIGHT - 200) + 50;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + 70, y);
                this.ctx.stroke();
            }
        } else if (this.weather.name.includes('HEADWIND')) {
            this.ctx.strokeStyle = 'rgba(255, 179, 71, 0.15)';
            this.ctx.lineWidth = 1.2;
            const windSeed = (Date.now() / 10) % 500;
            for (let i = 0; i < 8; i++) {
                const x = CONFIG.LOGICAL_WIDTH - (((i * 123) + windSeed * 4.5) % (CONFIG.LOGICAL_WIDTH + 100)) + 50;
                const y = (i * 73) % (CONFIG.LOGICAL_HEIGHT - 200) + 50;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x - 70, y);
                this.ctx.stroke();
            }
        }

        // --- 天候エフェクト描画（背景・雰囲気の可視化） ---
        if (this.weather.name.includes('RAIN')) {
            this.ctx.strokeStyle = 'rgba(174, 207, 238, 0.4)';
            this.ctx.lineWidth = 1.5;
            const rainSeed = (Date.now() / 12) % 300;
            for (let i = 0; i < 40; i++) {
                const x = ((i * 37) + rainSeed * 2.5) % CONFIG.LOGICAL_WIDTH;
                const y = ((i * 19) + rainSeed * 5) % CONFIG.LOGICAL_HEIGHT;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x - 6, y + 18);
                this.ctx.stroke();
            }
        } else if (this.weather.name.includes('TAILWIND')) {
            this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.15)';
            this.ctx.lineWidth = 1.2;
            const windSeed = (Date.now() / 10) % 500;
            for (let i = 0; i < 8; i++) {
                const x = ((i * 123) + windSeed * 4.5) % (CONFIG.LOGICAL_WIDTH + 100) - 50;
                const y = (i * 73) % (CONFIG.LOGICAL_HEIGHT - 200) + 50;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x + 70, y);
                this.ctx.stroke();
            }
        } else if (this.weather.name.includes('HEADWIND')) {
            this.ctx.strokeStyle = 'rgba(255, 179, 71, 0.15)';
            this.ctx.lineWidth = 1.2;
            const windSeed = (Date.now() / 10) % 500;
            for (let i = 0; i < 8; i++) {
                const x = CONFIG.LOGICAL_WIDTH - (((i * 123) + windSeed * 4.5) % (CONFIG.LOGICAL_WIDTH + 100)) + 50;
                const y = (i * 73) % (CONFIG.LOGICAL_HEIGHT - 200) + 50;
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(x - 70, y);
                this.ctx.stroke();
            }
        }

        // --- 崖距離インジケーター（プログレスバー） ---
        if (this.state === STATE.RUNNING || this.state === STATE.BRAKING) {
            const barX = 300;
            const barY = 40;
            const barW = 400;
            const barH = 12;

            this.ctx.save();
            
            // バーの背景
            this.ctx.fillStyle = 'rgba(10, 10, 20, 0.8)';
            this.ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
            this.ctx.lineWidth = 2;
            
            // 警告ゾーン判定（崖まで残り30m = 3000px 未満）
            const playerDistToCliff = CONFIG.CLIFF_X - (this.player.x + this.player.width);
            const isDangerZone = playerDistToCliff < 3000;
            
            if (isDangerZone && this.state !== STATE.RESULT) {
                const flash = Math.sin(Date.now() / 60) > 0;
                this.ctx.strokeStyle = flash ? '#ff3333' : 'rgba(255, 51, 51, 0.3)';
                this.ctx.shadowColor = '#ff3333';
                this.ctx.shadowBlur = flash ? 12 : 0;
            }

            this.ctx.beginPath();
            this.ctx.roundRect(barX, barY, barW, barH, 4);
            this.ctx.fill();
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;

            // 進行割合（20pxからCLIFF_Xまでの進捗）
            const totalTrack = CONFIG.CLIFF_X - 20;
            const currentProgress = Math.min(1.0, (this.player.x - 20) / totalTrack);
            const fillW = barW * currentProgress;

            // プログレスバーのグラデーション塗りつぶし
            const progressGrad = this.ctx.createLinearGradient(barX, barY, barX + barW, barY);
            progressGrad.addColorStop(0, '#00f2fe');
            progressGrad.addColorStop(0.7, '#ffd700');
            progressGrad.addColorStop(1.0, '#ff3333');
            this.ctx.fillStyle = progressGrad;
            
            this.ctx.beginPath();
            this.ctx.roundRect(barX, barY, fillW, barH, 4);
            this.ctx.fill();

            // 自車位置インジケーター（ネオンサークル）
            const indicatorX = barX + fillW;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(indicatorX, barY + barH / 2, 7, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.shadowBlur = 0;

            // ゴール（崖・🏁）マークを描画
            this.ctx.fillStyle = '#ff3333';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('🏁', barX + barW + 10, barY + barH + 1);

            // 残り距離（m）のリアルタイムテキスト表示
            const distMeter = Math.max(0, parseFloat((playerDistToCliff / 100).toFixed(1)));
            this.ctx.fillStyle = isDangerZone ? '#ff3333' : '#ffffff';
            this.ctx.font = isDangerZone ? 'bold 12px Orbitron, sans-serif' : '12px Orbitron, sans-serif';
            this.ctx.textAlign = 'right';
            this.ctx.fillText(`LIMIT: ${distMeter.toFixed(1)}m`, barX - 15, barY + barH + 1);

            // 危険領域に入った時の大きな中央警告表示（ビジュアル演出）
            if (isDangerZone && this.state === STATE.RUNNING) {
                const dangerFlash = Math.sin(Date.now() / 60) > 0;
                if (dangerFlash) {
                    this.ctx.fillStyle = 'rgba(255, 51, 51, 0.95)';
                    this.ctx.font = 'bold 24px Orbitron, sans-serif';
                    this.ctx.textAlign = 'center';
                    this.ctx.shadowColor = '#ff3333';
                    this.ctx.shadowBlur = 15;
                    this.ctx.fillText('⚠️ DANGER ZONE ⚠️', CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT / 2 - 80);
                    this.ctx.shadowBlur = 0;
                }
            }

            this.ctx.restore();
        }

        this.ctx.restore(); // 画面揺れ解除

        // --- プレイヤー描画（長方形から流線型のネオンスポーツカーへ） ---
        this.ctx.save();
        if (this.screenShake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }
        const screenX = this.player.x - this.cameraX;
        
        // 1. アンダーグロー（サイバーパンクな底面発光）
        this.ctx.fillStyle = 'rgba(0, 242, 254, 0.18)';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = this.player.color;
        this.ctx.beginPath();
        this.ctx.ellipse(screenX + this.player.width / 2, this.player.y + this.player.height, this.player.width / 1.4, 5, 0, 0, Math.PI * 2);
        this.ctx.fill();

        // 2. 流線型スポーツカーのボディライン
        this.ctx.fillStyle = this.player.color;
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + 4, this.player.y + this.player.height - 4); // 左下
        this.ctx.lineTo(screenX + 2, this.player.y + 13); // リア後端
        this.ctx.quadraticCurveTo(screenX + 15, this.player.y + 5, screenX + 32, this.player.y + 5); // ルーフ
        this.ctx.lineTo(screenX + 44, this.player.y + 17); // フロントガラス斜面
        this.ctx.lineTo(screenX + this.player.width - 3, this.player.y + 19); // ボンネット
        this.ctx.lineTo(screenX + this.player.width, this.player.y + this.player.height - 4); // フロントバンパー
        this.ctx.closePath();
        this.ctx.fill();

        // 3. フロント・サイドウィンドウの描画
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        this.ctx.shadowBlur = 0; // グローを窓には適用しない
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + 25, this.player.y + 8);
        this.ctx.lineTo(screenX + 33, this.player.y + 8);
        this.ctx.lineTo(screenX + 39, this.player.y + 16);
        this.ctx.lineTo(screenX + 28, this.player.y + 16);
        this.ctx.closePath();
        this.ctx.fill();

        // 4. ホイールとタイヤ（サイバーブルーのリム付き）
        this.ctx.fillStyle = '#0f172a';
        this.ctx.strokeStyle = '#00f2fe';
        this.ctx.lineWidth = 1.8;
        
        // 後輪
        this.ctx.beginPath();
        this.ctx.arc(screenX + 16, this.player.y + this.player.height - 4, 7, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(screenX + 16, this.player.y + this.player.height - 4, 2, 0, Math.PI * 2);
        this.ctx.fill();
        
        // 前輪
        this.ctx.fillStyle = '#0f172a';
        this.ctx.beginPath();
        this.ctx.arc(screenX + this.player.width - 16, this.player.y + this.player.height - 4, 7, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.arc(screenX + this.player.width - 16, this.player.y + this.player.height - 4, 2, 0, Math.PI * 2);
        this.ctx.fill();

        // 5. リアスポイラー（ウイング）
        this.ctx.strokeStyle = this.player.color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(screenX + 2, this.player.y + 9);
        this.ctx.lineTo(screenX + 8, this.player.y + 3);
        this.ctx.stroke();

        // 6. 前方ヘッドライト光線（走行中のみ投光）
        if (this.state === STATE.RUNNING) {
            this.ctx.save();
            const grad = this.ctx.createLinearGradient(screenX + this.player.width, this.player.y + 19, screenX + this.player.width + 120, this.player.y + 24);
            grad.addColorStop(0, 'rgba(255, 255, 200, 0.45)');
            grad.addColorStop(1, 'rgba(255, 255, 200, 0.0)');
            this.ctx.fillStyle = grad;
            this.ctx.beginPath();
            this.ctx.moveTo(screenX + this.player.width, this.player.y + 17);
            this.ctx.lineTo(screenX + this.player.width + 120, this.player.y + 8);
            this.ctx.lineTo(screenX + this.player.width + 120, this.player.y + 38);
            this.ctx.lineTo(screenX + this.player.width, this.player.y + 23);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.restore();
        }

        // 7. テールランプ発光（ブレーキ時のみ赤色で発光）
        if (this.state === STATE.BRAKING) {
            this.ctx.fillStyle = '#ff3333';
            this.ctx.shadowBlur = 25;
            this.ctx.shadowColor = '#ff3333';
            this.ctx.beginPath();
            this.ctx.roundRect(screenX - 1, this.player.y + 10, 4, 6, 1);
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
