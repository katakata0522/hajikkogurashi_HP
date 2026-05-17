const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// UI
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const scoreHud = document.getElementById('score-hud');
const hintText = document.getElementById('hint-text');
const bgFever = document.getElementById('bg-fever');

const scoreValueEl = document.getElementById('score-value');
const finalScoreEl = document.getElementById('final-score');
const rankTextEl = document.getElementById('rank-text');

// Buttons
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('share-btn').addEventListener('click', shareResult);

// --- 内部解像度の固定（環境依存バグの解消） ---
const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 800;
canvas.width = LOGICAL_WIDTH;
canvas.height = LOGICAL_HEIGHT;

function resizeCanvas() {
    const aspect = LOGICAL_WIDTH / LOGICAL_HEIGHT;
    const windowAspect = container.clientWidth / container.clientHeight;
    
    if (windowAspect > aspect) {
        canvas.style.width = (container.clientHeight * aspect) + 'px';
        canvas.style.height = container.clientHeight + 'px';
    } else {
        canvas.style.width = container.clientWidth + 'px';
        canvas.style.height = (container.clientWidth / aspect) + 'px';
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

let workSoundInterval;
let playSoundInterval;

function playSoundEffect(type) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    if (type === 'warning') {
        // ピコーン！（警戒）
        osc.type = 'square';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1760, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'look') {
        // ドドン！（振り向き）
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
    } else if (type === 'gameover') {
        // ドカーン！（クビ）
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(10, now + 1.0);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
        osc.start(now);
        osc.stop(now + 1.0);
    } else if (type === 'type') {
        // カタカタ（仕事音）
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200 + Math.random() * 400, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
    } else if (type === 'coin') {
        // チャリン（サボり音）
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200 + Math.random() * 200, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    }
}

// Game State
const STATE = { START: 0, PLAYING: 1, GAMEOVER: 2 };
let gameState = STATE.START;

// Boss State
const BOSS = { AWAY: 0, WARNING: 1, LOOKING: 2 };
let bossState = BOSS.AWAY;
let bossTimer = 0; // performance.now() ではなくミリ秒で管理

// Player State
let isSlacking = false;
let score = 0;
let animationId;
let lastTime = 0;

const EMOJIS = {
    BOSS_AWAY: '🧑‍💼',
    BOSS_LOOK: '👺',
    PLAYER_WORK: '🧑‍💻',
    PLAYER_PLAY: '🎮',
    WARNING: '❗',
    SWEAT: '💦'
};

let floatingTexts = [];

// --- ゲームループ ---

function startGame(e) {
    if (e) {
        e.stopPropagation();
        e.preventDefault();
    }
    initAudio();
    gameState = STATE.PLAYING;
    bossState = BOSS.AWAY;
    score = 0;
    bossTimer = getRandomInt(2000, 4000); 
    isSlacking = false;
    floatingTexts = [];
    lastTime = 0;
    
    scoreValueEl.innerText = '0';
    startScreen.classList.remove('active');
    resultScreen.classList.remove('active');
    scoreHud.classList.remove('hidden');
    hintText.classList.remove('hidden');
    
    // 定期的な環境音のセット
    clearInterval(workSoundInterval);
    clearInterval(playSoundInterval);
    workSoundInterval = setInterval(() => {
        if(gameState === STATE.PLAYING && !isSlacking && bossState !== BOSS.LOOKING) playSoundEffect('type');
    }, 150);
    playSoundInterval = setInterval(() => {
        if(gameState === STATE.PLAYING && isSlacking) playSoundEffect('coin');
    }, 100);

    animationId = requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // フレーム落ち対策
    lastTime = timestamp;

    if (gameState !== STATE.PLAYING) return;
    
    update(dt);
    draw();
    
    animationId = requestAnimationFrame(gameLoop);
}

function update(dt) {
    // 経過時間をミリ秒で扱う（既存ロジックに合わせるため）
    const dtMs = dt * 1000;

    // スコア加算 (60FPS基準の加算をdtで吸収)
    if (isSlacking) {
        // 元のロジック: 1フレーム(約16.6ms)あたり `Math.floor(score / 1000) + 10` 加算
        // 1秒(60フレーム)あたり `(Math.floor(score / 1000) + 10) * 60` 加算
        const scorePerSec = (Math.floor(score / 1000) + 10) * 60;
        score += scorePerSec * dt;
        
        scoreValueEl.innerText = Math.floor(score);
        
        if (Math.random() < 0.3 * (dtMs / 16.6)) {
            floatingTexts.push({
                x: LOGICAL_WIDTH / 2 + (Math.random() * 80 - 40),
                y: LOGICAL_HEIGHT * 0.7,
                life: 1.0,
                text: 'ﾌヒﾋw'
            });
        }
    }

    // 上司のAI
    bossTimer -= dtMs;
    
    if (bossState === BOSS.AWAY) {
        if (bossTimer <= 0) {
            let isFeint = (score > 10000 && Math.random() < 0.3);
            bossState = BOSS.WARNING;
            let warningTime = Math.max(300, 1000 - (score / 100));
            bossTimer = warningTime;
            playSoundEffect('warning');
            
            // フェイントフラグ（雑実装を改め、プロパティで管理）
            bossState.isFeint = isFeint;
        }
    } else if (bossState === BOSS.WARNING) {
        if (bossTimer <= 0) {
            if (bossState.isFeint) {
                bossState = BOSS.AWAY;
                bossTimer = getRandomInt(1000, 3000);
                bossState.isFeint = false;
            } else {
                bossState = BOSS.LOOKING;
                bossTimer = getRandomInt(1000, 2500);
                playSoundEffect('look');
            }
        }
    } else if (bossState === BOSS.LOOKING) {
        if (isSlacking) {
            triggerGameOver();
            return;
        }
        if (bossTimer <= 0) {
            bossState = BOSS.AWAY;
            let nextAwayTime = Math.max(800, 3000 - (score / 50));
            bossTimer = getRandomInt(nextAwayTime, nextAwayTime + 1500);
        }
    }

    // 浮遊テキスト
    for (let i = floatingTexts.length - 1; i >= 0; i--) {
        floatingTexts[i].y -= 120 * dt;
        floatingTexts[i].life -= 1.2 * dt;
        if (floatingTexts[i].life <= 0) floatingTexts.splice(i, 1);
    }
}

function triggerGameOver() {
    gameState = STATE.GAMEOVER;
    playSoundEffect('gameover');
    clearInterval(workSoundInterval);
    clearInterval(playSoundInterval);
    
    bgFever.classList.remove('active');
    hintText.classList.add('hidden');
    scoreHud.classList.add('hidden');
    
    ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    
    let rank = "";
    if (score < 5000) rank = "真面目か！";
    else if (score < 20000) rank = "給料泥棒";
    else if (score < 50000) rank = "プロニート";
    else if (score < 100000) rank = "伝説のサボり魔";
    else rank = "会社を裏で牛耳る者";

    finalScoreEl.innerText = Math.floor(score);
    rankTextEl.innerText = rank;

    setTimeout(() => { resultScreen.classList.add('active'); }, 1000);
    draw(); // 最後の1フレームを描画
}

// --- 描画処理 ---

function draw() {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const horizon = LOGICAL_HEIGHT * 0.4;
    
    // 床
    ctx.fillStyle = 'rgba(0,0,0,0.05)';
    ctx.fillRect(0, horizon, LOGICAL_WIDTH, LOGICAL_HEIGHT - horizon);

    // --- 上司の描画（奥） ---
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const bossX = LOGICAL_WIDTH / 2;
    const bossY = horizon - 20;

    // デスク（上司用）
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(bossX - 80, bossY + 20, 160, 50);

    // 上司の顔
    ctx.font = '100px Arial'; // 論理解像度に合わせて少し大きく
    if (bossState === BOSS.AWAY) {
        ctx.fillText(EMOJIS.BOSS_AWAY, bossX, bossY);
    } else if (bossState === BOSS.WARNING) {
        ctx.fillText(EMOJIS.BOSS_AWAY, bossX, bossY);
        // 「！」
        ctx.font = '80px Arial';
        ctx.fillText(EMOJIS.WARNING, bossX + 50, bossY - 60);
    } else if (bossState === BOSS.LOOKING) {
        ctx.font = gameState === STATE.GAMEOVER ? '200px Arial' : '100px Arial';
        ctx.fillText(EMOJIS.BOSS_LOOK, bossX, bossY - (gameState === STATE.GAMEOVER ? 40 : 0));
        
        if (gameState === STATE.GAMEOVER) {
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 8;
            ctx.beginPath();
            for(let i=0; i<8; i++){
                ctx.moveTo(bossX, bossY);
                ctx.lineTo(bossX + Math.cos(i*Math.PI/4)*300, bossY + Math.sin(i*Math.PI/4)*300);
            }
            ctx.stroke();
        }
    }

    // --- プレイヤーの描画（手前） ---
    const playerX = LOGICAL_WIDTH / 2;
    const playerY = LOGICAL_HEIGHT * 0.75;

    // デスク（自分用）
    ctx.fillStyle = '#A0522D';
    ctx.fillRect(playerX - 150, playerY + 30, 300, 120);

    ctx.font = '160px Arial';
    if (isSlacking) {
        ctx.fillText(EMOJIS.PLAYER_PLAY, playerX, playerY);
    } else {
        ctx.fillText(EMOJIS.PLAYER_WORK, playerX, playerY);
        if (bossState === BOSS.LOOKING) {
            ctx.font = '60px Arial';
            ctx.fillText(EMOJIS.SWEAT, playerX + 80, playerY - 50);
        }
    }

    // 浮遊テキスト
    ctx.font = 'bold 24px "M PLUS Rounded 1c"';
    ctx.fillStyle = '#ff3366';
    for (let ft of floatingTexts) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1.0;
}

// --- 入力処理 ---

function startSlacking() {
    if (gameState !== STATE.PLAYING) return;
    initAudio(); // iOS等でのオーディオ制限解除用
    isSlacking = true;
    bgFever.classList.add('active');
    hintText.classList.add('hidden');
}

function stopSlacking() {
    if (gameState !== STATE.PLAYING) return;
    isSlacking = false;
    bgFever.classList.remove('active');
}

container.addEventListener('mousedown', startSlacking);
window.addEventListener('mouseup', stopSlacking);

container.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startSlacking();
}, {passive: false});
window.addEventListener('touchend', stopSlacking);
window.addEventListener('touchcancel', stopSlacking);

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shareResult() {
    const text = `上司の目を盗んで【${Math.floor(score)}】サボりました。バレてクビになりました。 称号：[${rankTextEl.innerText}]`;
    const url = "https://hajikkoroom.xsrv.jp/stealth-slacker/";
    const hashtags = "限界ステルスサボタージュ,はじっこぐらし";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
}

draw();
