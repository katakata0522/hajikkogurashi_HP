const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const gameContainer = document.getElementById('game-container');

// UI要素
const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const resultScreen = document.getElementById('result-screen');
const speedValueEl = document.getElementById('speed-value');
const statusTextEl = document.getElementById('status-text');
const scoreValueEl = document.getElementById('score-value');
const bestScoreValueEl = document.getElementById('best-score-value');
const newRecordBadge = document.getElementById('new-record-badge');
const rankTextEl = document.getElementById('rank-text');
const weatherValueEl = document.getElementById('weather-value');

// Buttons
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const shareBtn = document.getElementById('share-btn');
const menuBtn = document.getElementById('menu-btn');

// --- 内部解像度 ---
const LOGICAL_WIDTH = 1000;
const LOGICAL_HEIGHT = 600;
canvas.width = LOGICAL_WIDTH;
canvas.height = LOGICAL_HEIGHT;

function resizeCanvas() {
    const aspect = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    const windowAspect = gameContainer.clientWidth / gameContainer.clientHeight;
    
    if (windowAspect > aspect) {
        canvas.style.width = (gameContainer.clientHeight * aspect) + 'px';
        canvas.style.height = gameContainer.clientHeight + 'px';
    } else {
        canvas.style.width = gameContainer.clientWidth + 'px';
        canvas.style.height = (gameContainer.clientWidth / aspect) + 'px';
    }
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- サウンド ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;
let skidOscillator = null;
let skidGain = null;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    if (type === 'skid_start') {
        if(skidOscillator) return;
        skidOscillator = audioCtx.createOscillator();
        skidGain = audioCtx.createGain();
        skidOscillator.connect(skidGain);
        skidGain.connect(audioCtx.destination);
        skidOscillator.type = 'sawtooth';
        skidOscillator.frequency.setValueAtTime(600, now);
        skidGain.gain.setValueAtTime(0.1, now);
        skidOscillator.start(now);
    } else if (type === 'skid_update') {
        if(skidOscillator && player.speed > 0) {
            // スピードに応じて音程としきい値を下げる
            const freq = Math.max(100, (player.speed / 2000) * 600 + 100);
            skidOscillator.frequency.setValueAtTime(freq, now);
        }
    } else if (type === 'skid_stop') {
        if(skidOscillator) {
            skidGain.gain.linearRampToValueAtTime(0, now + 0.1);
            skidOscillator.stop(now + 0.1);
            skidOscillator = null;
            skidGain = null;
        }
    } else {
        // One-shot sounds
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        if (type === 'start') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(500, now + 0.5);
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        } else if (type === 'fall') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(20, now + 1);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.linearRampToValueAtTime(0, now + 1);
            osc.start(now);
            osc.stop(now + 1);
        } else if (type === 'success') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.2); // G5
            osc.frequency.setValueAtTime(1046.50, now + 0.3); // C6
            gain.gain.setValueAtTime(0.2, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.6);
            osc.start(now);
            osc.stop(now + 0.6);
        }
    }
}

// ゲーム設定と状態
const STATE = { START: 0, READY: 1, RUNNING: 2, BRAKING: 3, RESULT: 4 };
let currentState = STATE.START;

const WEATHERS = [
    { name: '☀️ NORMAL', acc: 1.0, fric: 1.0, color: '#fff' },
    { name: '💨 TAILWIND (追い風)', acc: 1.3, fric: 0.8, color: '#00f2fe' },
    { name: '🌪️ HEADWIND (向かい風)', acc: 0.8, fric: 1.2, color: '#ffb347' },
    { name: '🌧️ RAIN (滑る)', acc: 0.9, fric: 0.4, color: '#5555ff' }
];
let currentWeather = WEATHERS[0];

const gameConfig = {
    groundY: LOGICAL_HEIGHT * 0.75,
    cliffX: 12000, // 距離を大幅に延長
    baseAcc: 1200, 
    baseFric: 1500,
    playerSize: 30 // 車を小さくして広大さを演出
};

let cameraX = 0; // スクロール用カメラ

let player = {
    x: 100,
    y: 0,
    speed: 0,
    width: gameConfig.playerSize * 2,
    height: gameConfig.playerSize,
    color: '#00f2fe'
};

// 看板データ (x座標, テキスト)
const signboards = [
    { x: 3000, text: 'あと 90m' },
    { x: 6000, text: 'あと 60m' },
    { x: 9000, text: 'あと 30m' },
    { x: 11000, text: 'あと 10m' },
    { x: 11500, text: '⚠️ DANGER!' }
];

let particles = [];
let animationId;
let lastTime = 0;
let resultDistance = 0;
let screenShake = 0;

// --- 描画処理 ---
function drawBackground() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    // 画面揺れエフェクト
    ctx.save();
    if (screenShake > 0) {
        const dx = (Math.random() - 0.5) * screenShake;
        const dy = (Math.random() - 0.5) * screenShake;
        ctx.translate(dx, dy);
    }
    
    // --- パララックス背景（奥の山やビル） ---
    ctx.fillStyle = '#111827';
    // カメラの動きの20%で動く
    const bgScrollX = (cameraX * 0.2) % 400; 
    for(let i=0; i<4; i++) {
        const x = i * 400 - bgScrollX;
        ctx.beginPath();
        ctx.moveTo(x, gameConfig.groundY);
        ctx.lineTo(x + 150, gameConfig.groundY - 200);
        ctx.lineTo(x + 300, gameConfig.groundY);
        ctx.fill();
    }

    // --- 地面 ---
    ctx.fillStyle = '#0a0a14';
    // 崖が画面内に入るまでは全画面地面
    const cliffScreenX = gameConfig.cliffX - cameraX;
    ctx.fillRect(0, gameConfig.groundY, Math.min(LOGICAL_WIDTH, cliffScreenX), LOGICAL_HEIGHT - gameConfig.groundY);
    
    // 崖（奈落）
    if (cliffScreenX < LOGICAL_WIDTH) {
        ctx.fillStyle = '#050508';
        ctx.fillRect(cliffScreenX, gameConfig.groundY, LOGICAL_WIDTH - cliffScreenX, LOGICAL_HEIGHT - gameConfig.groundY);
        
        // 警戒線
        ctx.save();
        ctx.translate(cliffScreenX - 30, gameConfig.groundY);
        const stripeCount = 10;
        const stripeWidth = (LOGICAL_HEIGHT - gameConfig.groundY) / stripeCount;
        for (let i = 0; i < stripeCount; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#222';
            ctx.fillRect(0, i * stripeWidth, 30, stripeWidth);
        }
        ctx.restore();

        // 崖のネオンライン
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff416c';
        ctx.strokeStyle = '#ff416c';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(cliffScreenX, gameConfig.groundY);
        ctx.lineTo(cliffScreenX, LOGICAL_HEIGHT);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // --- 流れる地面のライン（スピード感） ---
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.3)';
    ctx.lineWidth = 2;
    const lineScrollX = cameraX % 200;
    for(let i=0; i<6; i++) {
        const x = i * 200 - lineScrollX;
        if (x < cliffScreenX) {
            ctx.beginPath();
            ctx.moveTo(x, gameConfig.groundY);
            ctx.lineTo(x - 100, LOGICAL_HEIGHT);
            ctx.stroke();
        }
    }

    // 地面の上端ライン
    ctx.strokeStyle = '#ff416c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, gameConfig.groundY);
    ctx.lineTo(Math.min(LOGICAL_WIDTH, cliffScreenX), gameConfig.groundY);
    ctx.stroke();

    // --- 看板の描画 ---
    for (let sign of signboards) {
        const signScreenX = sign.x - cameraX;
        if (signScreenX > -100 && signScreenX < LOGICAL_WIDTH + 100) {
            // ポール
            ctx.fillStyle = '#555';
            ctx.fillRect(signScreenX - 5, gameConfig.groundY - 80, 10, 80);
            // 板
            ctx.fillStyle = '#222';
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.fillRect(signScreenX - 60, gameConfig.groundY - 120, 120, 40);
            ctx.strokeRect(signScreenX - 60, gameConfig.groundY - 120, 120, 40);
            // 文字
            ctx.fillStyle = sign.text.includes('DANGER') ? '#ff416c' : '#fff';
            ctx.font = 'bold 16px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(sign.text, signScreenX, gameConfig.groundY - 100);
        }
    }

    ctx.restore(); // 画面揺れ解除
}

function drawPlayer() {
    ctx.save();
    if (screenShake > 0) {
        ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    const screenX = player.x - cameraX;
    player.y = gameConfig.groundY - player.height;
    
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 15;
    ctx.shadowColor = player.color;
    
    ctx.beginPath();
    ctx.roundRect(screenX, player.y, player.width, player.height, 6);
    ctx.fill();

    // 窓
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(screenX + player.width - 15, player.y + 5, 10, player.height - 10, 2);
    ctx.fill();

    // ブレーキランプ
    if (currentState === STATE.BRAKING) {
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.roundRect(screenX - 5, player.y + 5, 8, player.height - 10, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    ctx.restore();
}

class Particle {
    constructor(x, y) {
        this.x = x; // ワールド座標
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
    draw(ctx) {
        if(this.life <= 0) return;
        const screenX = this.x - cameraX;
        if (screenX < 0 || screenX > LOGICAL_WIDTH) return;

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

function updateDrawParticles(dt) {
    if (currentState === STATE.BRAKING && player.speed > 50) {
        particles.push(new Particle(player.x + 5, player.y + player.height));
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
}

// --- メインループ ---
function update(dt) {
    // 画面揺れの減衰
    if (screenShake > 0) {
        screenShake -= 20 * dt;
        if (screenShake < 0) screenShake = 0;
    }

    if (currentState === STATE.RUNNING) {
        const acc = gameConfig.baseAcc * currentWeather.acc;
        player.speed += acc * dt;
        player.x += player.speed * dt;
        
        speedValueEl.innerText = Math.floor(player.speed / 10);

        // カメラ追従 (車が画面左側30%の位置になるように)
        cameraX = player.x - (LOGICAL_WIDTH * 0.3);
        if (cameraX < 0) cameraX = 0;

        if (player.x + player.width / 2 > gameConfig.cliffX) gameOverFall();

    } else if (currentState === STATE.BRAKING) {
        const fric = gameConfig.baseFric * currentWeather.fric;
        player.speed -= fric * dt;
        if (player.speed < 0) player.speed = 0;
        
        player.x += player.speed * dt;
        speedValueEl.innerText = Math.floor(player.speed / 10);
        
        // 激しいブレーキ中は画面を揺らす
        if (player.speed > 200) {
            screenShake = Math.min((player.speed / 1000) * 15, 15);
        }

        playSound('skid_update');

        // カメラは少し慣性をつけて追従
        const targetCameraX = player.x - (LOGICAL_WIDTH * 0.3);
        cameraX += (targetCameraX - cameraX) * 5 * dt;

        if (player.x + player.width / 2 > gameConfig.cliffX) {
            gameOverFall();
        } else if (player.speed <= 0) {
            checkResult();
        }
    }
}

function gameLoop(timestamp) {
    if(!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    if(dt > 0.1) dt = 0.1;
    lastTime = timestamp;

    if(currentState !== STATE.RESULT) {
        update(dt);
    }
    
    drawBackground();
    updateDrawParticles(dt);
    drawPlayer();

    if (currentState !== STATE.START) {
        animationId = requestAnimationFrame(gameLoop);
    }
}

// --- アクション ---
function startGame(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    initAudio();
    
    // 天気をランダムに決定
    currentWeather = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    weatherValueEl.innerText = currentWeather.name;
    weatherValueEl.style.color = currentWeather.color;

    currentState = STATE.READY;
    player.x = 20;
    player.speed = 0;
    cameraX = 0;
    screenShake = 0;
    particles = [];
    lastTime = 0;
    
    startScreen.classList.remove('active');
    resultScreen.classList.remove('active');
    hud.classList.add('active');
    
    statusTextEl.innerText = 'TAP TO GO!';
    statusTextEl.className = 'status-text blink';
    statusTextEl.style.color = '#ffd700';
    speedValueEl.innerText = '0';
    
    drawBackground();
    drawPlayer();
}

function triggerRun() {
    playSound('start');
    currentState = STATE.RUNNING;
    statusTextEl.innerText = 'DANGER!!';
    statusTextEl.className = 'status-text';
    statusTextEl.style.color = '#ff416c';
    
    animationId = requestAnimationFrame(gameLoop);
}

function triggerBrake() {
    playSound('skid_start');
    currentState = STATE.BRAKING;
    statusTextEl.innerText = 'BRAKE!!';
    statusTextEl.style.color = '#ffd700';
}

function gameOverFall() {
    playSound('skid_stop');
    playSound('fall');
    currentState = STATE.RESULT;
    screenShake = 20; // ドスン！
    
    let fallSpeedY = 0;
    let fallSpeedX = player.speed > 200 ? player.speed : 200;
    
    function fallAnim(timestamp) {
        if(!lastTime) lastTime = timestamp;
        let dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        if (screenShake > 0) screenShake -= 15 * dt;

        player.x += fallSpeedX * dt;
        player.y += fallSpeedY * dt;
        fallSpeedY += 1500 * dt;

        drawBackground();
        drawPlayer();
        
        if (player.y < LOGICAL_HEIGHT + 100) {
            requestAnimationFrame(fallAnim);
        } else {
            showResult('fall');
        }
    }
    requestAnimationFrame(fallAnim);
}

function checkResult() {
    playSound('skid_stop');
    currentState = STATE.RESULT;
    screenShake = 0;
    
    const playerFrontX = player.x + player.width;
    const distancePixel = gameConfig.cliffX - playerFrontX;
    
    // 換算 (100px = 1m とする)
    resultDistance = (distancePixel / 100).toFixed(2);
    
    if (resultDistance < 0) {
        playSound('success');
        showResult('perfect');
    } else if (resultDistance < 1.0) {
        playSound('success');
        showResult('perfect');
    } else if (resultDistance < 5.0) {
        playSound('success');
        showResult('success');
    } else {
        showResult('chicken');
    }
}

function showResult(type) {
    hud.classList.remove('active');
    resultScreen.classList.add('active');
    rankTextEl.className = 'rank-text';
    newRecordBadge.classList.add('hidden');
    
    // LocalStorage ロジック
    let bestDist = localStorage.getItem('girigiri_best_distance');
    if (bestDist) {
        bestScoreValueEl.innerText = parseFloat(bestDist).toFixed(2);
    } else {
        bestScoreValueEl.innerText = '--';
    }

    if (type === 'fall') {
        scoreValueEl.innerText = "落下";
        scoreValueEl.style.color = '#ff416c';
        document.querySelector('.score-unit').style.display = 'none';
        rankTextEl.innerText = '大クラッシュ...';
        rankTextEl.classList.add('rank-fall');
    } else {
        document.querySelector('.score-unit').style.display = 'inline-block';
        scoreValueEl.style.color = '#00f2fe';

        let target = parseFloat(resultDistance);

        // ベストスコア更新判定
        if (!bestDist || target < parseFloat(bestDist)) {
            localStorage.setItem('girigiri_best_distance', target.toString());
            bestScoreValueEl.innerText = target.toFixed(2);
            newRecordBadge.classList.remove('hidden');
        }

        // カウントダウン演出
        let current = Math.min(100.0, target + 50); // アニメーション開始値
        let step = (current - target) / 30;
        
        function countAnim() {
            current -= step;
            if(current <= target) {
                current = target;
                scoreValueEl.innerText = current.toFixed(2);
                
                if (type === 'perfect') {
                    rankTextEl.innerText = '神回避！！';
                    rankTextEl.classList.add('rank-perfect');
                } else if (type === 'success') {
                    rankTextEl.innerText = 'ナイス・ブレーキ！';
                    rankTextEl.classList.add('rank-success');
                } else if (type === 'chicken') {
                    rankTextEl.innerText = 'チキン野郎🐔';
                    rankTextEl.classList.add('rank-chicken');
                }
            } else {
                scoreValueEl.innerText = current.toFixed(2);
                requestAnimationFrame(countAnim);
            }
        }
        countAnim();
    }
}

// --- 入力 ---
gameContainer.addEventListener('mousedown', handleInput);
gameContainer.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput(e);
}, { passive: false });

function handleInput(e) {
    if (currentState === STATE.START || currentState === STATE.RESULT) return;
    if (currentState === STATE.READY) triggerRun();
    else if (currentState === STATE.RUNNING) triggerBrake();
}

startBtn.addEventListener('click', startGame);
startBtn.addEventListener('touchstart', startGame);
retryBtn.addEventListener('click', startGame);
retryBtn.addEventListener('touchstart', startGame);

shareBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    let text = "";
    if (rankTextEl.classList.contains('rank-fall')) {
        text = `【${currentWeather.name}】あああああ！崖から落ちた…（チキン度 100%）`;
    } else {
        text = `【${currentWeather.name}】崖っぷちでストップ！残り距離 ${resultDistance}m！！ [評価: ${rankTextEl.innerText}]`;
    }
    const url = "https://hajikkoroom.xsrv.jp/girigiri-brake/";
    const hashtags = "はじっこぐらし,ギリギリブレーキ";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
});
shareBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    shareBtn.click();
});

menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    window.location.href = '../minigames.html';
});
menuBtn.addEventListener('touchstart', (e) => {
    e.stopPropagation();
    menuBtn.click();
});

// 初期描画
drawBackground();
player.y = gameConfig.groundY - player.height;
ctx.fillStyle = player.color;
ctx.roundRect(player.x - cameraX, player.y, player.width, player.height, 8);
ctx.fill();
