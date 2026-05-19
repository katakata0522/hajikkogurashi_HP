// ==========================================
// CONFIG & CONSTANTS
// ==========================================
const CONFIG = {
    LOGICAL_WIDTH: 600,
    LOGICAL_HEIGHT: 800,
    FPS: 60
};

const STATE = {
    START: 0,
    PLAYING: 1,
    GAMEOVER: 2
};

// ==========================================
// Utils & Math
// ==========================================
function getIntersection(p1, p2, p3, p4) {
    const s1_x = p2.x - p1.x;
    const s1_y = p2.y - p1.y;
    const s2_x = p4.x - p3.x;
    const s2_y = p4.y - p3.y;

    const denom = -s2_x * s1_y + s1_x * s2_y;
    if (Math.abs(denom) < 0.0001) return null; // Collinear or parallel

    const s = (-s1_y * (p1.x - p3.x) + s1_x * (p1.y - p3.y)) / denom;
    const t = ( s2_x * (p1.y - p3.y) - s2_y * (p1.x - p3.x)) / denom;

    if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
        return {
            x: p1.x + (t * s1_x),
            y: p1.y + (t * s1_y)
        };
    }
    return null;
}

function dist2(v, w) { 
    return (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y); 
}

function distToSegmentSquared(p, v, w) {
    const l2 = dist2(v, w);
    if (l2 == 0) return dist2(p, v);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return dist2(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) });
}

// ==========================================
// AudioManager
// ==========================================
class AudioManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }

    playTone(freq, type, duration, vol = 1.0) {
        if (!this.initialized || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(this.masterGain);
        
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playEffect(name) {
        switch(name) {
            case 'start':
                this.playTone(440, 'square', 0.1, 0.5);
                setTimeout(() => this.playTone(660, 'square', 0.2, 0.5), 100);
                break;
            case 'blackhole':
                // Suck sound
                if (!this.initialized) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(100, this.ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.3);
                gain.gain.setValueAtTime(0.5, this.ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);
                osc.connect(gain);
                gain.connect(this.masterGain);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.3);
                break;
            case 'damage':
                this.playTone(150, 'sawtooth', 0.3, 0.8);
                break;
            case 'gameover':
                this.playTone(200, 'square', 0.2);
                setTimeout(() => this.playTone(150, 'square', 0.3), 200);
                setTimeout(() => this.playTone(100, 'square', 0.5), 500);
                break;
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
        this.hud = document.getElementById('hud');
        this.hintText = document.getElementById('hint-text');

        this.scoreValueEl = document.getElementById('score-value');
        this.finalScoreEl = document.getElementById('final-score');
        this.bestScoreValueEl = document.getElementById('best-score-value');
        this.newRecordBadge = document.getElementById('new-record-badge');
        this.rankTextEl = document.getElementById('rank-text');
        this.hearts = document.querySelectorAll('.heart');

        this.darkModeToggle = document.getElementById('dark-mode-toggle');
        if (this.darkModeToggle) {
            // 初期状態は「残業モード（ON）」＝ダークモードにする
            this.darkModeToggle.checked = true;
            document.body.classList.add('dark-mode');
            
            this.darkModeToggle.addEventListener('change', (e) => {
                if (e.target.checked) document.body.classList.add('dark-mode');
                else document.body.classList.remove('dark-mode');
            });
        }
    }

    startGameUI() {
        this.startScreen.classList.remove('active');
        this.resultScreen.classList.remove('active');
        this.hud.classList.remove('hidden');
        this.hintText.classList.remove('hidden');
        this.updateScore(0);
        this.updateLife(3);
    }

    hideHint() {
        this.hintText.classList.add('hidden');
    }

    updateScore(score) {
        this.scoreValueEl.innerText = Math.floor(score);
    }

    updateLife(life) {
        this.hearts.forEach((h, i) => {
            if (i < life) h.classList.add('active');
            else h.classList.remove('active');
        });
    }

    showGameOver(score, bestScore, isNewRecord) {
        this.hud.classList.add('hidden');
        this.hintText.classList.add('hidden');
        
        let rank = "";
        if (score < 500) rank = "新人火消し";
        else if (score < 2000) rank = "一人前の掃除屋";
        else if (score < 5000) rank = "炎上プロジェクトキラー";
        else if (score < 10000) rank = "ブラックホールマスター";
        else rank = "宇宙の特異点";

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
// Enemies
// ==========================================
class Enemy {
    constructor(type, x, y) {
        this.type = type; // 0: normal, 1: fast, 2: tracker
        this.x = x;
        this.y = y;
        this.radius = type === 1 ? 8 : 12;
        
        let speedMult = 1;
        if (type === 1) speedMult = 2.5;
        if (type === 2) speedMult = 0.6;

        const angle = Math.random() * Math.PI * 2;
        const speed = (50 + Math.random() * 50) * speedMult;
        
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        
        this.color = type === 0 ? '#33ff33' : (type === 1 ? '#ffff33' : '#ff3366');
    }

    update(dt, targetX, targetY) {
        if (this.type === 2 && targetX !== null && targetY !== null) {
            // Tracker moves towards target (finger)
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0) {
                this.vx = (dx / dist) * 80;
                this.vy = (dy / dist) * 80;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Bounce off walls
        if (this.x < this.radius) { this.x = this.radius; this.vx *= -1; }
        if (this.x > CONFIG.LOGICAL_WIDTH - this.radius) { this.x = CONFIG.LOGICAL_WIDTH - this.radius; this.vx *= -1; }
        if (this.y < this.radius) { this.y = this.radius; this.vy *= -1; }
        if (this.y > CONFIG.LOGICAL_HEIGHT - this.radius) { this.y = CONFIG.LOGICAL_HEIGHT - this.radius; this.vy *= -1; }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        const isDark = document.body.classList.contains('dark-mode');
        if (isDark) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.color;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Inner detail
        ctx.fillStyle = isDark ? '#000' : '#fff';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();
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
        this.score = 0;
        this.life = 3;
        this.enemies = [];
        this.points = []; // Drawn line points
        this.isDrawing = false;
        
        this.blackholes = []; // Visual effects for loops
        this.particles = [];
        this.screenShake = 0;
        
        this.spawnTimer = 0;
        this.difficultyTimer = 0;
        
        this.mouseX = null;
        this.mouseY = null;

        this.lastTime = 0;
        this.animationId = null;

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
    }

    bindEvents() {
        const getLogicalPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            let clientX, clientY;
            if (e.touches && e.touches.length > 0) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            return {
                x: (clientX - rect.left) / rect.width * CONFIG.LOGICAL_WIDTH,
                y: (clientY - rect.top) / rect.height * CONFIG.LOGICAL_HEIGHT
            };
        };

        const handleDown = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            if (e) { e.preventDefault(); }
            
            if (this.gameState === STATE.PLAYING) {
                this.isDrawing = true;
                this.points = [];
                const pos = getLogicalPos(e);
                this.points.push(pos);
                this.mouseX = pos.x;
                this.mouseY = pos.y;
                this.ui.hideHint();
            }
        };

        const handleMove = (e) => {
            if (e) { e.preventDefault(); }
            if (this.gameState === STATE.PLAYING && this.isDrawing) {
                const pos = getLogicalPos(e);
                this.mouseX = pos.x;
                this.mouseY = pos.y;
                
                // Add point if moved enough
                const last = this.points[this.points.length - 1];
                if (dist2(last, pos) > 100) { // dist > 10
                    this.points.push(pos);
                    this.checkIntersection();
                }
            }
        };

        const handleUp = (e) => {
            if (e) { e.preventDefault(); }
            this.isDrawing = false;
            this.points = [];
            this.mouseX = null;
            this.mouseY = null;
        };

        // Double tap retry
        let lastTap = 0;
        const checkDoubleTap = () => {
            if (this.gameState === STATE.GAMEOVER || this.gameState === STATE.START) {
                // スタートまたはゲームオーバー画面でのみ機能
                const now = Date.now();
                if (now - lastTap < 300) {
                    this.startGame();
                }
                lastTap = now;
            }
        };

        this.canvas.addEventListener('mousedown', handleDown);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', (e) => { handleUp(e); checkDoubleTap(); });
        
        this.canvas.addEventListener('touchstart', handleDown, {passive: false});
        this.canvas.addEventListener('touchmove', handleMove, {passive: false});
        window.addEventListener('touchend', (e) => { handleUp(e); checkDoubleTap(); }, {passive: false});
        window.addEventListener('touchcancel', handleUp, {passive: false});

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('retry-btn').addEventListener('click', () => this.startGame());
        document.getElementById('share-btn').addEventListener('click', (e) => this.shareResult(e));
        document.getElementById('menu-btn').addEventListener('click', () => { window.location.href = '../minigames.html'; });
    }

    startGame() {
        this.audio.init();
        this.audio.playEffect('start');
        this.gameState = STATE.PLAYING;
        this.score = 0;
        this.life = 3;
        this.enemies = [];
        this.points = [];
        this.blackholes = [];
        this.particles = [];
        this.isDrawing = false;
        this.spawnTimer = 1000;
        this.difficultyTimer = 0;
        this.lastTime = 0;
        this.screenShake = 0;

        // Initial enemies
        for(let i=0; i<3; i++) this.spawnEnemy();

        this.ui.startGameUI();

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    spawnEnemy() {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = Math.random() * CONFIG.LOGICAL_WIDTH; y = -20; }
        else if (edge === 1) { x = Math.random() * CONFIG.LOGICAL_WIDTH; y = CONFIG.LOGICAL_HEIGHT + 20; }
        else if (edge === 2) { x = -20; y = Math.random() * CONFIG.LOGICAL_HEIGHT; }
        else { x = CONFIG.LOGICAL_WIDTH + 20; y = Math.random() * CONFIG.LOGICAL_HEIGHT; }

        let type = 0;
        const r = Math.random();
        // Difficulty scaling
        const diff = Math.min(this.difficultyTimer / 60000, 1); // Max difficulty at 60s
        if (r < 0.2 + diff * 0.3) type = 1;
        else if (r > 0.9 - diff * 0.4) type = 2;

        this.enemies.push(new Enemy(type, x, y));
    }

    triggerGameOver() {
        this.gameState = STATE.GAMEOVER;
        this.audio.playEffect('gameover');
        this.isDrawing = false;
        this.points = [];
        this.screenShake = 20;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        let isNewRecord = false;
        let bestScore = localStorage.getItem('blackhole_best_score');
        bestScore = bestScore ? parseInt(bestScore) : null;

        if (!bestScore || this.score > bestScore) {
            localStorage.setItem('blackhole_best_score', Math.floor(this.score).toString());
            bestScore = this.score;
            isNewRecord = true;
        }

        this.ui.showGameOver(this.score, bestScore, isNewRecord);
    }

    checkIntersection() {
        if (this.points.length < 4) return;
        
        const len = this.points.length;
        const p3 = this.points[len-2];
        const p4 = this.points[len-1];

        // Check against older segments
        for (let i = 0; i < len - 3; i++) {
            const p1 = this.points[i];
            const p2 = this.points[i+1];
            
            const intersect = getIntersection(p1, p2, p3, p4);
            if (intersect) {
                // Loop found!
                const loopPoints = [intersect].concat(this.points.slice(i+1, len-1)).concat([intersect]);
                this.resolveBlackhole(loopPoints);
                
                // Clear points
                this.points = [];
                this.isDrawing = false;
                break;
            }
        }
    }

    resolveBlackhole(loopPoints) {
        if (loopPoints.length < 3) return;

        // Create path to check points
        const path = new Path2D();
        path.moveTo(loopPoints[0].x, loopPoints[0].y);
        for(let i=1; i<loopPoints.length; i++) {
            path.lineTo(loopPoints[i].x, loopPoints[i].y);
        }
        path.closePath();

        let caught = 0;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            // Since path2D requires current context transformation, it's easier to check on a clean context.
            // But we can just use this.ctx.isPointInPath
            if (this.ctx.isPointInPath(path, e.x, e.y)) {
                caught++;
                this.enemies.splice(i, 1);
                this.spawnParticles(e.x, e.y, e.color);
            }
        }

        if (caught > 0) {
            this.audio.playEffect('blackhole');
            let multiplier = 1;
            if (caught === 2) multiplier = 2;
            else if (caught === 3) multiplier = 3;
            else if (caught >= 4) multiplier = 5;

            const pts = caught * 100 * multiplier;
            this.score += pts;
            this.ui.updateScore(this.score);

            if (caught >= 4) this.screenShake = 15;

            // Find center of loop for visual effect
            let cx = 0, cy = 0;
            loopPoints.forEach(p => { cx += p.x; cy += p.y; });
            cx /= loopPoints.length;

            this.blackholes.push({ x: cx, y: cy, life: 1.0, caught: caught, pts: pts });
        }
    }

    checkDamage() {
        if (!this.isDrawing || this.points.length < 2) return;

        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            for (let j = 0; j < this.points.length - 1; j++) {
                const distSq = distToSegmentSquared(e, this.points[j], this.points[j+1]);
                const threshold = e.radius + 5; // Line width is ~5
                if (distSq < threshold * threshold) {
                    // Damage!
                    this.life--;
                    this.ui.updateLife(this.life);
                    this.audio.playEffect('damage');
                    this.screenShake = 10;
                    if (navigator.vibrate) navigator.vibrate(100);
                    
                    // Clear line to prevent multiple hits
                    this.points = [];
                    this.isDrawing = false;

                    if (this.life <= 0) {
                        this.triggerGameOver();
                    }
                    return; // one hit per frame max
                }
            }
        }
    }

    spawnParticles(x, y, color) {
        for(let i=0; i<8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 100 + 50;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                color: color
            });
        }
    }

    update(dt) {
        if (this.screenShake > 0) {
            this.screenShake -= 60 * dt;
            if (this.screenShake < 0) this.screenShake = 0;
        }

        this.difficultyTimer += dt * 1000;
        
        // Spawning
        this.spawnTimer -= dt * 1000;
        if (this.spawnTimer <= 0) {
            this.spawnEnemy();
            const diff = Math.min(this.difficultyTimer / 60000, 1);
            this.spawnTimer = 2000 - (diff * 1200); // gets faster
        }

        // Target for trackers
        let tx = null, ty = null;
        if (this.isDrawing) { tx = this.mouseX; ty = this.mouseY; }

        this.enemies.forEach(e => e.update(dt, tx, ty));

        this.checkDamage();

        // Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= 2 * dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        // Blackholes
        for (let i = this.blackholes.length - 1; i >= 0; i--) {
            this.blackholes[i].life -= 1.5 * dt;
            if (this.blackholes[i].life <= 0) this.blackholes.splice(i, 1);
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, CONFIG.LOGICAL_WIDTH, CONFIG.LOGICAL_HEIGHT);

        this.ctx.save();
        if (this.screenShake > 0) {
            this.ctx.translate((Math.random() - 0.5) * this.screenShake, (Math.random() - 0.5) * this.screenShake);
        }

        // Blackholes (Effect)
        for (const bh of this.blackholes) {
            this.ctx.globalAlpha = bh.life;
            const isDark = document.body.classList.contains('dark-mode');
            this.ctx.fillStyle = isDark ? '#00ffff' : '#007bff';
            this.ctx.beginPath();
            this.ctx.arc(bh.x, bh.y, (1 - bh.life) * 100, 0, Math.PI*2);
            this.ctx.fill();
            
            // Text
            this.ctx.fillStyle = isDark ? '#fff' : '#333';
            this.ctx.font = 'bold 30px "M PLUS Rounded 1c"';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(`+${bh.pts}`, bh.x, bh.y - 30);
            if (bh.caught > 1) {
                this.ctx.fillStyle = '#ff3366';
                this.ctx.fillText(`${bh.caught} COMBO!`, bh.x, bh.y + 10);
            }
        }
        this.ctx.globalAlpha = 1.0;

        // Enemies
        this.enemies.forEach(e => e.draw(this.ctx));

        // Particles
        for (const p of this.particles) {
            this.ctx.globalAlpha = Math.max(0, p.life);
            this.ctx.fillStyle = p.color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
            this.ctx.fill();
        }
        this.ctx.globalAlpha = 1.0;

        // Drawn Line
        if (this.isDrawing && this.points.length > 0) {
            const isDark = document.body.classList.contains('dark-mode');
            this.ctx.strokeStyle = isDark ? '#00ffff' : '#007bff';
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            if (isDark) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = '#00ffff';
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(this.points[0].x, this.points[0].y);
            for(let i=1; i<this.points.length; i++) {
                this.ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            if (this.mouseX !== null && this.mouseY !== null) {
                this.ctx.lineTo(this.mouseX, this.mouseY);
            }
            this.ctx.stroke();
            this.ctx.shadowBlur = 0;
            
            // Draw head
            if (this.mouseX !== null && this.mouseY !== null) {
                this.ctx.fillStyle = isDark ? '#fff' : '#007bff';
                this.ctx.beginPath();
                this.ctx.arc(this.mouseX, this.mouseY, 6, 0, Math.PI*2);
                this.ctx.fill();
            }
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

    shareResult(e) {
        if (e) e.stopPropagation();
        
        let reasonText = "";
        if (this.score < 1000) {
            reasonText = "【結果：瞬殺（バグに秒で囲まれた）】";
        } else {
            const excuses = [
                "「これは一時的な仕様バグで、次のスプリントで直します！」",
                "「ローカル環境では動いていたんですが…」",
                "「進捗はきわめて順調です（冷や汗）」",
                "「GitHub Actionsのデプロイエラーのせいです！」",
                "「仕様変更が急に入りまして…」"
            ];
            reasonText = "言い訳：" + excuses[Math.floor(Math.random() * excuses.length)];
        }

        const text = `ブラックホールでバグを【${Math.floor(this.score)}】点分吸い込みました！ 評価：[${this.ui.rankTextEl.innerText}]\n${reasonText}`;
        const url = "https://hajikkoroom.xsrv.jp/blackhole-sweeper/";
        const hashtags = "ブラックホールスイーパー,炎上タスク火消し,はじっこぐらし";
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`);
    }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
