const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('game-container');

// UI Elements
const uiLayer = document.getElementById('ui-layer');
const startScreen = document.getElementById('start-screen');
const resultScreen = document.getElementById('result-screen');
const scoreHud = document.getElementById('score-hud');
const ruleDisplay = document.getElementById('rule-display');
const currentRuleText = document.getElementById('current-rule-text');

const scoreValueEl = document.getElementById('score-value');
const comboValueEl = document.getElementById('combo-value');
const finalScoreEl = document.getElementById('final-score');
const maxComboEl = document.getElementById('max-combo');
const rankTextEl = document.getElementById('rank-text');

const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');
const bgEffect = document.getElementById('bg-effect');

// --- 内部解像度の固定（環境依存バグの解消） ---
const LOGICAL_WIDTH = 600;
const LOGICAL_HEIGHT = 1000;
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

function playSound(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    if (type === 'sort') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800 + (Math.min(combo, 20) * 20), now); // コンボで音程が上がる
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
    } else if (type === 'error') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'rule_change') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.setValueAtTime(600, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

// Constants
const COLORS = { RED: '#ff3366', BLUE: '#00c3ff' };
const SHAPES = { CIRCLE: 0, SQUARE: 1 };
const RULES = { COLOR: '色', SHAPE: '形' };

// Game State
let state = 'START'; 
let score = 0;
let combo = 0;
let maxCombo = 0;
let currentRule = RULES.COLOR;
let items = [];
let particles = [];

// Physics / Timing variables
let fallSpeed = 300; // px/sec
let spawnIntervalTime = 2.0; // seconds
let timeSinceLastSpawn = 0;
let lastTime = 0;
let animationId;

// Item Class
class Item {
    constructor() {
        this.color = Math.random() < 0.5 ? COLORS.RED : COLORS.BLUE;
        this.shape = Math.random() < 0.5 ? SHAPES.CIRCLE : SHAPES.SQUARE;
        this.size = 80; // 論理解像度に合わせて大きく
        this.x = LOGICAL_WIDTH / 2;
        this.y = -this.size;
        this.isSorted = false;
        this.sortDir = 0;
        this.alpha = 1;
    }

    update(dt) {
        if (!this.isSorted) {
            this.y += fallSpeed * dt;
        } else {
            this.x += this.sortDir * 1000 * dt;
            this.y += 300 * dt;
            this.alpha -= 5 * dt;
        }
    }

    draw(ctx) {
        if (this.alpha <= 0) return;
        ctx.globalAlpha = Math.max(0, this.alpha);
        ctx.fillStyle = this.color;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;

        ctx.beginPath();
        if (this.shape === SHAPES.CIRCLE) {
            ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.roundRect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size, 12);
            ctx.fill();
        }

        // Inner highlight
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        if (this.shape === SHAPES.CIRCLE) {
            ctx.arc(this.x - 15, this.y - 15, 12, 0, Math.PI * 2);
        } else {
            ctx.roundRect(this.x - this.size/2 + 10, this.y - this.size/2 + 10, 20, 20, 4);
        }
        ctx.fill();

        ctx.globalAlpha = 1.0;
    }
}

// Particle System
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
        this.life -= 2.0 * dt; // 0.5秒で消える
        this.size *= (1 - dt * 2);
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

function spawnParticles(x, y, color) {
    for(let i=0; i<20; i++) particles.push(new Particle(x, y, color));
}

// Game Logic
function startGame() {
    initAudio();
    state = 'PLAYING';
    score = 0;
    combo = 0;
    maxCombo = 0;
    fallSpeed = 300;
    spawnIntervalTime = 1.5;
    timeSinceLastSpawn = spawnIntervalTime; // すぐに最初の1個が出るように
    lastTime = 0;
    items = [];
    particles = [];
    
    updateScoreUI();
    setRule(RULES.COLOR);

    startScreen.classList.remove('active');
    resultScreen.classList.remove('active');
    scoreHud.classList.remove('hidden');
    ruleDisplay.classList.remove('hidden');
    touchLeft.classList.remove('hidden');
    touchRight.classList.remove('hidden');
    bgEffect.classList.add('moving');

    animationId = requestAnimationFrame(gameLoop);
}

function setRule(newRule) {
    if(currentRule !== newRule && state === 'PLAYING') playSound('rule_change');
    currentRule = newRule;
    currentRuleText.innerText = `${currentRule}で仕分けろ！`;
    
    ruleDisplay.classList.add('changed');
    setTimeout(() => {
        ruleDisplay.classList.remove('changed');
    }, 300);
}

function gameOver() {
    playSound('error');
    state = 'GAMEOVER';
    cancelAnimationFrame(animationId);
    
    container.style.backgroundColor = '#ff0000';
    setTimeout(() => { container.style.backgroundColor = '#111118'; }, 100);

    bgEffect.classList.remove('moving');
    scoreHud.classList.add('hidden');
    ruleDisplay.classList.add('hidden');
    touchLeft.classList.add('hidden');
    touchRight.classList.add('hidden');

    finalScoreEl.innerText = score;
    maxComboEl.innerText = maxCombo;
    
    if (score < 10) rankTextEl.innerText = 'クビ寸前';
    else if (score < 30) rankTextEl.innerText = '新人バイト';
    else if (score < 60) rankTextEl.innerText = '優秀なパート';
    else if (score < 100) rankTextEl.innerText = '熟練ライン長';
    else rankTextEl.innerText = 'スーパーAI頭脳';

    resultScreen.classList.add('active');
}

function updateScoreUI() {
    scoreValueEl.innerText = score;
    if (combo > 1) {
        comboValueEl.innerText = `${combo} COMBO!`;
        comboValueEl.style.opacity = 1;
        if (combo > 10) comboValueEl.classList.add('high');
        else comboValueEl.classList.remove('high');
    } else {
        comboValueEl.style.opacity = 0;
    }
}

// Input
function handleInput(direction) {
    if (state !== 'PLAYING') return;

    let targetItem = null;
    for (let i = 0; i < items.length; i++) {
        if (!items[i].isSorted) {
            targetItem = items[i];
            break;
        }
    }

    if (!targetItem) return;

    let expectedDir = 0;
    if (currentRule === RULES.COLOR) {
        expectedDir = targetItem.color === COLORS.RED ? -1 : 1;
    } else {
        expectedDir = targetItem.shape === SHAPES.CIRCLE ? -1 : 1;
    }

    if (direction === expectedDir) {
        playSound('sort');
        targetItem.isSorted = true;
        targetItem.sortDir = direction;
        spawnParticles(targetItem.x, targetItem.y, targetItem.color);
        
        score++;
        combo++;
        if (combo > maxCombo) maxCombo = combo;
        
        // 難易度上昇（dtベースの速度増加）
        fallSpeed = Math.min(fallSpeed + 10, 1500);
        spawnIntervalTime = Math.max(spawnIntervalTime - 0.05, 0.4);

        // ルール変更ガチャ
        if (score > 10 && Math.random() < 0.15) {
            setRule(currentRule === RULES.COLOR ? RULES.SHAPE : RULES.COLOR);
        }

        updateScoreUI();
    } else {
        gameOver();
    }
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') handleInput(-1);
    if (e.key === 'ArrowRight') handleInput(1);
});
touchLeft.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(-1); });
touchRight.addEventListener('touchstart', (e) => { e.preventDefault(); handleInput(1); });
touchLeft.addEventListener('mousedown', () => handleInput(-1));
touchRight.addEventListener('mousedown', () => handleInput(1));

document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('share-btn').addEventListener('click', () => {
    const text = `脳の処理限界に到達…！ 【${score}個】のアイテムを仕分けました！（最大${maxCombo}コンボ） 称号：[${rankTextEl.innerText}]`;
    const url = "https://hajikkoroom.xsrv.jp/sorting-factory/";
    const hashtags = "はじっこぐらし,超絶仕分け工場";
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
});

// Render
function drawBoxes() {
    const boxY = LOGICAL_HEIGHT - 150;
    const boxWidth = LOGICAL_WIDTH / 2;
    
    // Left Box
    ctx.fillStyle = 'rgba(255, 51, 102, 0.1)';
    ctx.fillRect(0, boxY, boxWidth, 150);
    ctx.strokeStyle = COLORS.RED;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, boxY); ctx.lineTo(boxWidth, boxY); ctx.stroke();

    // Right Box
    ctx.fillStyle = 'rgba(0, 195, 255, 0.1)';
    ctx.fillRect(boxWidth, boxY, boxWidth, 150);
    ctx.strokeStyle = COLORS.BLUE;
    ctx.beginPath(); ctx.moveTo(boxWidth, boxY); ctx.lineTo(LOGICAL_WIDTH, boxY); ctx.stroke();

    // Line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(boxWidth, 0); ctx.lineTo(boxWidth, LOGICAL_HEIGHT); ctx.stroke();
    
    // Labels
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = 'bold 30px "M PLUS Rounded 1c"';
    ctx.textAlign = 'center';
    if(currentRule === RULES.COLOR) {
        ctx.fillText('赤', boxWidth/2, boxY + 80);
        ctx.fillText('青', boxWidth + boxWidth/2, boxY + 80);
    } else {
        ctx.fillText('● (丸)', boxWidth/2, boxY + 80);
        ctx.fillText('■ (四角)', boxWidth + boxWidth/2, boxY + 80);
    }
}

function gameLoop(timestamp) {
    if(!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    if(dt > 0.1) dt = 0.1; // フレーム落ち対策
    lastTime = timestamp;

    if (state !== 'PLAYING') return;

    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    drawBoxes();

    // Spawn (Time-based)
    timeSinceLastSpawn += dt;
    if (timeSinceLastSpawn >= spawnIntervalTime) {
        items.push(new Item());
        timeSinceLastSpawn = 0;
    }

    // Update & Draw Items
    for (let i = 0; i < items.length; i++) {
        items[i].update(dt);
        items[i].draw(ctx);

        if (!items[i].isSorted && items[i].y > LOGICAL_HEIGHT - 150) {
            gameOver();
            return;
        }
    }

    items = items.filter(item => item.alpha > 0);

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        particles[i].draw(ctx);
        if (particles[i].life <= 0) particles.splice(i, 1);
    }

    animationId = requestAnimationFrame(gameLoop);
}

drawBoxes();
