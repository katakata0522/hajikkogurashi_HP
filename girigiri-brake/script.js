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
const rankTextEl = document.getElementById('rank-text');
const startBtn = document.getElementById('start-btn');
const retryBtn = document.getElementById('retry-btn');
const shareBtn = document.getElementById('share-btn');

// --- 内部解像度の固定（環境依存バグの解消） ---
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

// --- サウンド（Web Audio API）実装 ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
let audioCtx;

function initAudio() {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'start') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'brake') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
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
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        osc.frequency.setValueAtTime(800, now + 0.2);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    }
}

// ゲームのステート
const STATE = { START: 0, READY: 1, RUNNING: 2, BRAKING: 3, RESULT: 4 };
let currentState = STATE.START;

// ゲーム内変数
const gameConfig = {
    groundY: LOGICAL_HEIGHT * 0.75,
    cliffX: LOGICAL_WIDTH * 0.85,
    startSpeed: 0,
    acceleration: 1500, // px/s^2
    friction: 2000,     // px/s^2
    playerSize: 60
};

let player = {
    x: 50,
    y: 0,
    speed: 0,
    width: gameConfig.playerSize * 2,
    height: gameConfig.playerSize,
    color: '#00f2fe'
};

let particles = [];
let animationId;
let lastTime = 0;
let resultDistance = 0;

// --- 描画 ---
function drawBackground() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    // 地面
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, gameConfig.groundY, gameConfig.cliffX, LOGICAL_HEIGHT - gameConfig.groundY);
    
    // 崖
    ctx.fillStyle = '#050508';
    ctx.fillRect(gameConfig.cliffX, gameConfig.groundY, LOGICAL_WIDTH - gameConfig.cliffX, LOGICAL_HEIGHT - gameConfig.groundY);

    // 警戒線
    ctx.save();
    ctx.translate(gameConfig.cliffX - 30, gameConfig.groundY);
    const stripeCount = 10;
    const stripeWidth = (LOGICAL_HEIGHT - gameConfig.groundY) / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#222';
        ctx.fillRect(0, i * stripeWidth, 30, stripeWidth);
    }
    ctx.restore();

    // ネオンライン
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ff416c';
    ctx.strokeStyle = '#ff416c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, gameConfig.groundY);
    ctx.lineTo(gameConfig.cliffX, gameConfig.groundY);
    ctx.lineTo(gameConfig.cliffX, LOGICAL_HEIGHT);
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawPlayer() {
    player.y = gameConfig.groundY - player.height;
    ctx.fillStyle = player.color;
    ctx.shadowBlur = 20;
    ctx.shadowColor = player.color;
    
    ctx.beginPath();
    ctx.roundRect(player.x, player.y, player.width, player.height, 8);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.roundRect(player.x + player.width - 30, player.y + 10, 20, player.height - 20, 4);
    ctx.fill();

    if (currentState === STATE.BRAKING) {
        ctx.fillStyle = '#ff0000';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff0000';
        ctx.beginPath();
        ctx.roundRect(player.x - 5, player.y + 10, 10, 20, 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

class Particle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 8 + 4;
        this.speedX = (Math.random() - 0.5) * -200;
        this.speedY = (Math.random() - 1) * 100;
        this.life = 1.0;
        this.decay = Math.random() * 1.5 + 1.0; // 1秒あたりの減衰
    }
    update(dt) {
        this.x += this.speedX * dt;
        this.y += this.speedY * dt;
        this.life -= this.decay * dt;
        this.size *= (1 - dt*2);
    }
    draw(ctx) {
        if(this.life <= 0) return;
        ctx.globalAlpha = this.life;
        ctx.fillStyle = '#ffeb3b';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    }
}

function updateDrawParticles(dt) {
    if (currentState === STATE.BRAKING && player.speed > 0) {
        particles.push(new Particle(player.x + 10, player.y + player.height));
    }
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }
}

// --- メインループ ---
function update(dt) {
    if (currentState === STATE.RUNNING) {
        player.speed += gameConfig.acceleration * dt;
        player.x += player.speed * dt;
        
        speedValueEl.innerText = Math.floor(player.speed / 10);

        if (player.x + player.width / 2 > gameConfig.cliffX) gameOverFall();

    } else if (currentState === STATE.BRAKING) {
        player.speed -= gameConfig.friction * dt;
        if (player.speed < 0) player.speed = 0;
        
        player.x += player.speed * dt;
        speedValueEl.innerText = Math.floor(player.speed / 10);

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
    if(dt > 0.1) dt = 0.1; // フレーム落ち対策
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
function startGame() {
    initAudio();
    currentState = STATE.READY;
    player.x = 20;
    player.speed = 0;
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
    playSound('brake');
    currentState = STATE.BRAKING;
    statusTextEl.innerText = 'BRAKE!!';
    statusTextEl.style.color = '#ffd700';
}

function gameOverFall() {
    playSound('fall');
    currentState = STATE.RESULT;
    
    let fallSpeedY = 0;
    let fallSpeedX = player.speed > 100 ? player.speed : 100;
    
    function fallAnim(timestamp) {
        if(!lastTime) lastTime = timestamp;
        let dt = (timestamp - lastTime) / 1000;
        lastTime = timestamp;

        player.x += fallSpeedX * dt;
        player.y += fallSpeedY * dt;
        fallSpeedY += 1500 * dt; // 重力

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
    currentState = STATE.RESULT;
    
    const playerFrontX = player.x + player.width;
    const distancePixel = gameConfig.cliffX - playerFrontX;
    
    // 論理座標の割合からリアルな数値へ
    // 崖までの道のりを 100m とした場合の換算
    const roadLength = gameConfig.cliffX - 20 - player.width;
    const ratio = distancePixel / roadLength;
    resultDistance = (ratio * 100).toFixed(2);
    
    if (resultDistance < 0) {
        playSound('success');
        showResult('perfect');
    } else if (resultDistance < 1.0) {
        playSound('success');
        showResult('perfect');
    } else if (resultDistance < 10.0) {
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
    
    if (type === 'fall') {
        scoreValueEl.innerText = "落下";
        scoreValueEl.style.color = '#ff416c';
        document.querySelector('.score-unit').style.display = 'none';
        rankTextEl.innerText = '大クラッシュ...';
        rankTextEl.classList.add('rank-fall');
    } else {
        // ミリ秒単位でのカウントアップ演出（ヒリヒリ感）
        let target = parseFloat(resultDistance);
        let current = 100.0;
        let step = (100.0 - target) / 30; // 30フレームでアニメーション
        
        document.querySelector('.score-unit').style.display = 'inline-block';
        scoreValueEl.style.color = '#00f2fe';
        
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
    handleInput();
}, { passive: false });

function handleInput() {
    if (currentState === STATE.START || currentState === STATE.RESULT) return;
    if (currentState === STATE.READY) triggerRun();
    else if (currentState === STATE.RUNNING) triggerBrake();
}

startBtn.addEventListener('click', () => { initAudio(); startGame(); });
retryBtn.addEventListener('click', startGame);
shareBtn.addEventListener('click', () => {
    let text = "";
    if (rankTextEl.classList.contains('rank-fall')) {
        text = `あああああ！崖から落ちた…（チキン度 100%）`;
    } else {
        text = `崖っぷちでストップ！残り距離 ${resultDistance}m！！ [評価: ${rankTextEl.innerText}]`;
    }
    const url = "https://hajikkoroom.xsrv.jp/girigiri-brake/";
    const hashtags = "はじっこぐらし,ギリギリブレーキ";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
});

// 初期描画
drawBackground();
player.y = gameConfig.groundY - player.height;
ctx.fillStyle = player.color;
ctx.roundRect(player.x, player.y, player.width, player.height, 8);
ctx.fill();
