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

const ACHIEVEMENTS = [
    { id: 'rookie', kind: 'score', target: 0, name: '新人火消し', description: 'まずは宇宙のゴミ掃除を始めた' },
    { id: 'first-sweep', kind: 'score', target: 300, name: '初回吸引成功', description: 'ターゲットを吸い込む感覚をつかんだ' },
    { id: 'cleaner', kind: 'score', target: 800, name: '一人前の掃除屋', description: '小さな炎上なら吸い込める' },
    { id: 'combo-two', kind: 'combo', target: 2, name: '二連重力使い', description: '2体同時吸引を決めた' },
    { id: 'area-control', kind: 'area', target: 250, name: '広域封鎖担当', description: '大きなブラックホールで場を制した' },
    { id: 'no-damage', kind: 'noDamage', target: 1, name: '無傷の清掃員', description: 'シールドを割らずに任務を終えた' },
    { id: 'project-killer', kind: 'score', target: 2000, name: '炎上プロジェクトキラー', description: '厄介なターゲットをまとめて処理できる' },
    { id: 'blackhole-master', kind: 'score', target: 5000, name: 'ブラックホールマスター', description: '重力を読んで大物を逃さない' },
    { id: 'singularity', kind: 'score', target: 10000, name: '宇宙の特異点', description: 'もはや掃除される側が震える存在' }
];

function getRank(score) {
    let rank = ACHIEVEMENTS[0].name;
    for (const achievement of ACHIEVEMENTS) {
        if (achievement.kind === 'score' && score >= achievement.target) rank = achievement.name;
    }
    return rank;
}

function getDefaultAchievementStats() {
    return { bestScore: 0, maxCombo: 0, maxAreaBonus: 0, noDamageClear: false };
}

function readAchievementStats() {
    const stats = getDefaultAchievementStats();
    try {
        const rawStats = JSON.parse(localStorage.getItem('blackhole_achievement_stats') || '{}');
        return {
            bestScore: Math.max(stats.bestScore, Number(rawStats.bestScore) || 0, readBestScore() || 0),
            maxCombo: Math.max(stats.maxCombo, Number(rawStats.maxCombo) || 0),
            maxAreaBonus: Math.max(stats.maxAreaBonus, Number(rawStats.maxAreaBonus) || 0),
            noDamageClear: Boolean(rawStats.noDamageClear)
        };
    } catch (error) {
        stats.bestScore = readBestScore() || 0;
        return stats;
    }
}

function writeAchievementStats(stats) {
    try {
        localStorage.setItem('blackhole_achievement_stats', JSON.stringify(stats));
        return true;
    } catch (error) {
        return false;
    }
}

function hasSeenTutorial() {
    try {
        return localStorage.getItem('blackhole_tutorial_seen') === '1';
    } catch (error) {
        return false;
    }
}

function markTutorialSeen() {
    try {
        localStorage.setItem('blackhole_tutorial_seen', '1');
    } catch (error) {
        // Tutorial state is optional.
    }
}

function mergeAchievementStats(previous, run) {
    return {
        bestScore: Math.max(previous.bestScore || 0, run.bestScore || 0),
        maxCombo: Math.max(previous.maxCombo || 0, run.maxCombo || 0),
        maxAreaBonus: Math.max(previous.maxAreaBonus || 0, run.maxAreaBonus || 0),
        noDamageClear: Boolean(previous.noDamageClear || run.noDamageClear)
    };
}

function isAchievementUnlocked(achievement, stats) {
    if (achievement.kind === 'score') return (stats.bestScore || 0) >= achievement.target;
    if (achievement.kind === 'combo') return (stats.maxCombo || 0) >= achievement.target;
    if (achievement.kind === 'area') return (stats.maxAreaBonus || 0) >= achievement.target;
    if (achievement.kind === 'noDamage') return Boolean(stats.noDamageClear);
    return false;
}

function getAchievementProgressLabel(achievement, stats) {
    if (achievement.kind === 'score') return achievement.target === 0 ? 'START' : `${achievement.target}pt`;
    if (achievement.kind === 'combo') return `${achievement.target}体同時`;
    if (achievement.kind === 'area') return `AREA+${achievement.target}`;
    if (achievement.kind === 'noDamage') return 'NO DAMAGE';
    return '';
}

function getNextAchievement(stats) {
    return ACHIEVEMENTS.find((achievement) => !isAchievementUnlocked(achievement, stats)) || null;
}

function readBestScore() {
    try {
        const rawScore = localStorage.getItem('blackhole_best_score');
        const bestScore = Number.parseInt(rawScore, 10);
        return Number.isFinite(bestScore) && bestScore > 0 ? bestScore : null;
    } catch (error) {
        return null;
    }
}

function writeBestScore(score) {
    try {
        localStorage.setItem('blackhole_best_score', String(score));
        return true;
    } catch (error) {
        return false;
    }
}

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

// 面積を計算する（Shoelace formula）
function getPolygonArea(points) {
    let area = 0;
    const len = points.length;
    if (len < 3) return 0;
    for (let i = 0; i < len; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % len];
        area += (p1.x * p2.y) - (p2.x * p1.y);
    }
    return Math.abs(area / 2);
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
            case 'miss':
                this.playTone(260, 'triangle', 0.08, 0.35);
                setTimeout(() => this.playTone(180, 'triangle', 0.08, 0.25), 70);
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
        this.tutorialOverlay = document.getElementById('tutorial-overlay');

        this.scoreValueEl = document.getElementById('score-value');
        this.finalScoreEl = document.getElementById('final-score');
        this.bestScoreValueEl = document.getElementById('best-score-value');
        this.newRecordBadge = document.getElementById('new-record-badge');
        this.rankTextEl = document.getElementById('rank-text');
        this.nextAchievementTextEl = document.getElementById('next-achievement-text');
        this.hearts = document.querySelectorAll('.heart');
        this.achievementsModal = document.getElementById('achievements-modal');
        this.achievementsList = document.getElementById('achievements-list');
        this.toastContainer = document.getElementById('toast-container');
    }

    startGameUI(showTutorial) {
        this.startScreen.classList.remove('active');
        this.resultScreen.classList.remove('active');
        this.hud.classList.remove('hidden');
        this.hintText.classList.remove('hidden');
        this.tutorialOverlay.classList.toggle('hidden', !showTutorial);
        this.updateScore(0);
        this.updateLife(3);
    }

    hideHint() {
        this.hintText.classList.add('hidden');
        this.tutorialOverlay.classList.add('hidden');
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
        
        const rank = getRank(score);

        this.finalScoreEl.innerText = Math.floor(score);
        this.rankTextEl.innerText = rank;
        this.bestScoreValueEl.innerText = bestScore !== null ? Math.floor(bestScore) : '--';
        this.updateNextAchievement(readAchievementStats());
        
        if (isNewRecord) {
            this.newRecordBadge.classList.remove('hidden');
        } else {
            this.newRecordBadge.classList.add('hidden');
        }

        setTimeout(() => { this.resultScreen.classList.add('active'); }, 1000);
    }

    updateNextAchievement(stats) {
        const nextAchievement = getNextAchievement(stats);
        if (!nextAchievement) {
            this.nextAchievementTextEl.textContent = '称号図鑑コンプリート';
            return;
        }
        this.nextAchievementTextEl.textContent = `次: ${nextAchievement.name} / ${getAchievementProgressLabel(nextAchievement, stats)}`;
    }

    openAchievements(stats) {
        this.renderAchievements(stats);
        this.achievementsModal.classList.remove('hidden');
    }

    closeAchievements() {
        this.achievementsModal.classList.add('hidden');
    }

    renderAchievements(stats) {
        this.achievementsList.innerHTML = ACHIEVEMENTS.map((achievement) => {
            const unlocked = isAchievementUnlocked(achievement, stats);
            const progressLabel = getAchievementProgressLabel(achievement, stats);
            return `
                <div class="achievement-card ${unlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-score">${progressLabel}</div>
                    <div>
                        <div class="achievement-name">${unlocked ? achievement.name : '???'}</div>
                        <div class="achievement-desc">${unlocked ? achievement.description : 'まだ重力が足りない'}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    showToast(message) {
        if (!this.toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        this.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 1800);
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

        // 新機能用パラメータ
        this.age = 0; // 寿命管理
        this.stunTimer = 0; // スタン
        this.isSucked = false; // 吸引中か
        this.suckProgress = 0;
        this.suckTarget = null;
        this.isDead = false; // 完全消滅フラグ
        this.isSlowed = false; // 重力スロー状態
        this.isStatic = false; // 動かない練習用ターゲット
    }

    update(dt, targetX, targetY, isDrawing) {
        // 吸引中アニメーション
        if (this.isSucked && this.suckTarget) {
            this.suckProgress += 4 * dt; // 0.25秒で完了
            if (this.suckProgress >= 1) {
                this.suckProgress = 1;
                this.isDead = true;
            }
            // 重心へ引き寄せ
            this.x += (this.suckTarget.x - this.x) * 10 * dt;
            this.y += (this.suckTarget.y - this.y) * 10 * dt;
            return;
        }

        // 動かない敵は移動や寿命、スタン等をスキップ
        if (this.isStatic) {
            return;
        }

        // 寿命システム（15秒で自然消滅）
        this.age += dt;
        if (this.age > 15) {
            this.isDead = true;
            return;
        }

        // スタン状態の処理
        if (this.stunTimer > 0) {
            this.stunTimer -= dt;
            // スタン中は摩擦で減速（摩擦を少し強化してスムーズに停止させる）
            this.vx *= Math.exp(-3 * dt);
            this.vy *= Math.exp(-3 * dt);
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            // 境界チェック
            this.bounceCheck();
            return;
        }

        // 重力スロー状態の速度補正（一時的に速度を半分にする）
        const currentDtSpeed = this.isSlowed ? 0.4 : 1.0;

        // 追跡バグは「線を引いている時だけ」かつ「少し遅い速度」で指を追う
        if (this.type === 2) {
            if (isDrawing && targetX !== null && targetY !== null) {
                const dx = targetX - this.x;
                const dy = targetY - this.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 0) {
                    // 最大追跡速度を75に制限（マイルドに）
                    const targetVx = (dx / dist) * 75 * currentDtSpeed;
                    const targetVy = (dy / dist) * 75 * currentDtSpeed;
                    // イージングで滑らかに旋回
                    this.vx += (targetVx - this.vx) * 3 * dt;
                    this.vy += (targetVy - this.vy) * 3 * dt;
                }
            } else {
                // 描いていない時はランダムにゆったり漂う
                const speed = 40 * currentDtSpeed;
                const angle = Math.atan2(this.vy, this.vx) + (Math.random() - 0.5) * dt * 2;
                this.vx = Math.cos(angle) * speed;
                this.vy = Math.sin(angle) * speed;
            }
        } else {
            // 通常・高速バグのスロー補正
            // 元々の角度をキープしつつ速度を調整
            const currentSpeed = Math.hypot(this.vx, this.vy);
            const targetSpeed = (this.type === 1 ? 200 : 75) * currentDtSpeed;
            if (currentSpeed > 0) {
                this.vx = (this.vx / currentSpeed) * targetSpeed;
                this.vy = (this.vy / currentSpeed) * targetSpeed;
            }
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.bounceCheck();
    }

    bounceCheck() {
        // Bounce off walls (If stunned, absorb velocity to stick to the wall and prevent instant rebounds)
        const isStunned = this.stunTimer > 0;
        if (this.x < this.radius) { 
            this.x = this.radius; 
            this.vx = isStunned ? 0 : this.vx * -1; 
        }
        if (this.x > CONFIG.LOGICAL_WIDTH - this.radius) { 
            this.x = CONFIG.LOGICAL_WIDTH - this.radius; 
            this.vx = isStunned ? 0 : this.vx * -1; 
        }
        if (this.y < this.radius) { 
            this.y = this.radius; 
            this.vy = isStunned ? 0 : this.vy * -1; 
        }
        if (this.y > CONFIG.LOGICAL_HEIGHT - this.radius) { 
            this.y = CONFIG.LOGICAL_HEIGHT - this.radius; 
            this.vy = isStunned ? 0 : this.vy * -1; 
        }
    }

    draw(ctx) {
        // 寿命間近（12秒以上）の点滅処理
        if (!this.isSucked && this.age > 12) {
            if (Math.floor(this.age * 8) % 2 === 0) return; // 点滅で描画スキップ
        }

        ctx.save();

        // 重力スロー状態のビジュアルエフェクト（ゴースト残像）
        if (this.isSlowed && !this.isSucked) {
            ctx.fillStyle = 'rgba(0, 229, 255, 0.15)';
            ctx.beginPath();
            ctx.arc(this.x - this.vx * 0.05, this.y - this.vy * 0.05, this.radius * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }

        // スロー時はカラーをシアン寄りに変更して重力の歪みを表現
        ctx.fillStyle = this.isSlowed && !this.isSucked ? '#00e5ff' : this.color;
        
        // 吸引中の縮小
        let currentRadius = this.radius;
        if (this.isSucked) {
            currentRadius = this.radius * (1 - this.suckProgress);
        }

        // スタン中のエフェクト（震えと光彩カット）
        if (this.stunTimer > 0) {
            ctx.translate((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4);
            ctx.shadowBlur = 4;
            ctx.shadowColor = '#ffffff';
        } else {
            ctx.shadowBlur = 10;
            ctx.shadowColor = this.isSlowed ? '#00e5ff' : this.color;
        }

        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Inner detail
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x, this.y, currentRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
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
        this.missEffects = [];
        this.particles = [];
        this.screenShake = 0;
        this.empWave = null; // EMP波エフェクト
        this.invincibleTimer = 0; // 無敵時間
        this.maxCombo = 0;
        this.maxAreaBonus = 0;
        this.tookDamage = false;
        
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
            const isTouch = !!(e.touches && e.touches.length > 0);
            
            if (isTouch) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }

            // 新機能：スマホのタッチ操作の時だけ、指で画面が隠れないように描画先端を45px上にオフセットする
            const offsetY = isTouch ? -45 : 0;
            
            return {
                x: (clientX - rect.left) / rect.width * CONFIG.LOGICAL_WIDTH,
                y: ((clientY - rect.top) / rect.height * CONFIG.LOGICAL_HEIGHT) + offsetY
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
                if (!this.isTutorialMode) {
                    this.ui.hideHint();
                    markTutorialSeen();
                }
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
            if (e?.target?.tagName === 'BUTTON') return;
            if (e) { e.preventDefault(); }
            this.isDrawing = false;
            this.points = [];
            this.mouseX = null;
            this.mouseY = null;
        };

        // Double tap retry
        let lastTap = 0;
        const checkDoubleTap = () => {
            if (this.gameState === STATE.GAMEOVER) {
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
        window.addEventListener('touchend', (e) => {
            handleUp(e);
            if (e.target.tagName !== 'BUTTON') checkDoubleTap();
        }, {passive: false});
        window.addEventListener('touchcancel', handleUp, {passive: false});

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('retry-btn').addEventListener('click', () => this.startGame());
        document.getElementById('share-btn').addEventListener('click', (e) => this.shareResult(e));
        document.getElementById('menu-btn').addEventListener('click', () => { window.location.href = '../minigames.html'; });
        document.getElementById('trophy-btn').addEventListener('click', () => this.ui.openAchievements(readAchievementStats()));
        document.getElementById('close-modal-btn').addEventListener('click', () => this.ui.closeAchievements());
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
        this.missEffects = [];
        this.particles = [];
        this.isDrawing = false;
        this.spawnTimer = 1000;
        this.difficultyTimer = 0;
        this.lastTime = 0;
        this.screenShake = 0;
        this.empWave = null;
        this.invincibleTimer = 0;
        this.maxCombo = 0;
        this.maxAreaBonus = 0;
        this.tookDamage = false;
        this.ui.closeAchievements();

        // チュートリアル中かどうかの判定
        this.isTutorialMode = !hasSeenTutorial();

        if (this.isTutorialMode) {
            // チュートリアル中は画面中央に動かない敵を1匹だけ配置
            const tutorialEnemy = new Enemy(0, CONFIG.LOGICAL_WIDTH / 2, CONFIG.LOGICAL_HEIGHT / 2);
            tutorialEnemy.isStatic = true;
            this.enemies.push(tutorialEnemy);
        } else {
            // 通常開始時は初期の敵3匹（すべて緑）を配置
            for(let i=0; i<3; i++) this.spawnEnemy(0);
        }

        this.ui.startGameUI(this.isTutorialMode);

        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = requestAnimationFrame((t) => this.loop(t));
    }

    spawnEnemy(forcedType = null) {
        // ハードリミット：画面上の敵が12匹以上の場合はスポーンをスキップして「詰み」を防止
        if (this.enemies.filter(e => !e.isSucked).length >= 12) return;

        const edge = Math.floor(Math.random() * 4);
        let x, y;
        if (edge === 0) { x = Math.random() * CONFIG.LOGICAL_WIDTH; y = -20; }
        else if (edge === 1) { x = Math.random() * CONFIG.LOGICAL_WIDTH; y = CONFIG.LOGICAL_HEIGHT + 20; }
        else if (edge === 2) { x = -20; y = Math.random() * CONFIG.LOGICAL_HEIGHT; }
        else { x = CONFIG.LOGICAL_WIDTH + 20; y = Math.random() * CONFIG.LOGICAL_HEIGHT; }

        let type = 0;
        if (forcedType !== null) {
            type = forcedType;
        } else {
            const r = Math.random();
            // Difficulty scaling
            const diff = Math.min(this.difficultyTimer / 60000, 1); // Max difficulty at 60s
            if (r < 0.2 + diff * 0.3) type = 1;
            else if (r > 0.9 - diff * 0.4) type = 2;
        }

        this.enemies.push(new Enemy(type, x, y));
    }

    triggerGameOver() {
        this.gameState = STATE.GAMEOVER;
        this.audio.playEffect('gameover');
        this.isDrawing = false;
        this.points = [];
        this.screenShake = 20;
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);

        const finalScore = Math.floor(this.score);
        const previousBest = readBestScore();
        let isNewRecord = false;
        let bestScore = previousBest;

        if (finalScore > 0 && (bestScore === null || finalScore > bestScore)) {
            if (writeBestScore(finalScore)) {
                bestScore = finalScore;
                isNewRecord = true;
            }
        }

        const previousStats = readAchievementStats();
        const currentStats = mergeAchievementStats(previousStats, {
            bestScore: finalScore,
            maxCombo: this.maxCombo,
            maxAreaBonus: this.maxAreaBonus,
            noDamageClear: finalScore > 0 && !this.tookDamage
        });
        writeAchievementStats(currentStats);

        this.ui.showGameOver(this.score, bestScore, isNewRecord);
        const newlyUnlocked = ACHIEVEMENTS.filter((achievement) => (
            !isAchievementUnlocked(achievement, previousStats) && isAchievementUnlocked(achievement, currentStats)
        ));
        if (newlyUnlocked.length > 0) {
            this.ui.showToast(`称号獲得: ${newlyUnlocked[0].name}`);
        } else if (isNewRecord && getRank(finalScore) !== getRank(previousBest ?? 0)) {
            this.ui.showToast(`称号獲得: ${getRank(finalScore)}`);
        }
    }

    checkIntersection() {
        if (this.points.length < 4) return;
        
        const len = this.points.length;
        const p3 = this.points[len-2];
        const p4 = this.points[len-1];

        // 誤爆防止の遊び：直近10フレーム分（約0.15秒分）の線は交差判定の対象から除外する
        const safetyMargin = 10;
        if (len - safetyMargin <= 0) return;

        // Check against older segments
        for (let i = 0; i < len - safetyMargin; i++) {
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

        // ループの中心（重心）を計算
        let cx = 0, cy = 0;
        loopPoints.forEach(p => { cx += p.x; cy += p.y; });
        cx /= loopPoints.length;
        cy /= loopPoints.length;

        // 判定：ブラックホールの中にターゲットがいるかどうかを事前カウント
        let caught = 0;
        const targetsToSuck = [];
        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (!e.isSucked && this.ctx.isPointInPath(path, e.x, e.y)) {
                caught++;
                targetsToSuck.push(e);
            }
        }

        // 新機能：ターゲットを1匹も囲んでいない（空振り）の場合は、ブラックホールを発動せず無効（フラフープ稼ぎの完全排除）
        if (caught === 0) {
            this.addMissEffect(cx, cy);
            this.audio.playEffect('miss');
            return;
        }

        // ターゲットを吸引
        let hasSuckedTutorialEnemy = false;
        targetsToSuck.forEach(e => {
            e.isSucked = true;
            e.suckTarget = { x: cx, y: cy };
            this.spawnParticles(e.x, e.y, e.color);
            if (e.isStatic) {
                hasSuckedTutorialEnemy = true;
            }
        });

        this.audio.playEffect('blackhole');

        // チュートリアル敵を吸い込んだ場合の本番移行プロセス
        if (hasSuckedTutorialEnemy && this.isTutorialMode) {
            this.isTutorialMode = false;
            markTutorialSeen();
            
            // 吸い込まれたアニメーション（約0.25秒）の余韻を残して1秒後に本番スタート
            setTimeout(() => {
                this.ui.hideHint();
                this.ui.showToast('チュートリアル完了！本番スタート！');
                
                // 本番用の敵3匹（すべて緑）を配置
                for (let i = 0; i < 3; i++) {
                    this.spawnEnemy(0);
                }
                // タイマーを初期化して本番ゲームのスポーンを開始
                this.spawnTimer = 2000;
                this.difficultyTimer = 0;
            }, 1000);
        }
        
        // コンボ倍率
        let multiplier = 1;
        if (caught === 2) multiplier = 2;
        else if (caught === 3) multiplier = 3;
        else if (caught >= 4) multiplier = 5;

        // 新機能：面積ボーナスの計算（ターゲットを巻き込んだ数に応じて面積スコアも増大）
        const area = getPolygonArea(loopPoints);
        const areaBonus = Math.floor((area / 150) * (1 + (caught - 1) * 0.5)); 

        const pts = (caught * 100 * multiplier) + areaBonus;
        this.score += pts;
        this.maxCombo = Math.max(this.maxCombo, caught);
        this.maxAreaBonus = Math.max(this.maxAreaBonus, areaBonus);
        this.ui.updateScore(this.score);

        if (caught >= 4 || areaBonus > 200) this.screenShake = 15;

        // ブラックホールエフェクトの追加
        this.blackholes.push({ 
            x: cx, 
            y: cy, 
            life: 1.0, 
            caught: caught, 
            pts: pts,
            areaBonus: areaBonus 
        });
    }

    addMissEffect(x, y) {
        this.missEffects.push({
            x,
            y,
            life: 1.0,
            radius: 14
        });
        this.screenShake = Math.max(this.screenShake, 4);
    }

    checkDamage() {
        if (!this.isDrawing || this.points.length < 2) return;
        if (this.invincibleTimer > 0) return; // 無敵時間中は被弾しない

        for (let i = 0; i < this.enemies.length; i++) {
            const e = this.enemies[i];
            if (e.isSucked) continue; // 吸引中の敵からは被弾しない

            const threshold = e.radius + 5; // Line width is ~5
            const thresholdSq = threshold * threshold;

            for (let j = 0; j < this.points.length - 1; j++) {
                const p1 = this.points[j];
                const p2 = this.points[j+1];

                // AABB（軸平行境界ボックス）事前判定による衝突判定の軽量化（O(N*M)の距離二乗計算をほぼバイパス）
                const minX = Math.min(p1.x, p2.x) - threshold;
                const maxX = Math.max(p1.x, p2.x) + threshold;
                if (e.x < minX || e.x > maxX) continue;

                const minY = Math.min(p1.y, p2.y) - threshold;
                const maxY = Math.max(p1.y, p2.y) + threshold;
                if (e.y < minY || e.y > maxY) continue;

                // 境界ボックス内にある場合のみ、高価な距離二乗計算を実行
                const distSq = distToSegmentSquared(e, p1, p2);
                if (distSq < thresholdSq) {
                    // ダメージ・被弾処理
                    this.life--;
                    this.tookDamage = true;
                    this.ui.updateLife(this.life);
                    this.audio.playEffect('damage');
                    this.screenShake = 15;
                    if (navigator.vibrate) navigator.vibrate(200);

                    // 詰み防止：無敵時間の設定
                    this.invincibleTimer = 1.5;

                    // 詰み防止：被弾時EMPバーストの発生
                    // 線と敵の衝突点をバーストの中心にする
                    const hitX = p1.x;
                    const hitY = p1.y;
                    this.triggerEmpBurst(hitX, hitY);
                    
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

    triggerEmpBurst(hitX, hitY) {
        // EMP衝撃波の描画用パラメータ
        this.empWave = {
            x: hitX,
            y: hitY,
            radius: 0,
            maxRadius: 500,
            life: 1.0
        };

        // すべての敵にスタンと強いノックバック（吹き飛ばし）を適用
        this.enemies.forEach(e => {
            if (e.isSucked) return;

            const dx = e.x - hitX;
            const dy = e.y - hitY;
            const dist = Math.hypot(dx, dy) || 1;

            // 衝突点から外側に向かうベクトルを計算し、強く吹き飛ばす
            e.vx = (dx / dist) * 450;
            e.vy = (dy / dist) * 450;
            
            // 詰み防止：1.5秒スタンさせて一時停止させる
            e.stunTimer = 1.5;
        });
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

        // 無敵タイマーの更新
        if (this.invincibleTimer > 0) {
            this.invincibleTimer -= dt;
        }

        // EMP波エフェクトの更新
        if (this.empWave) {
            this.empWave.radius += 800 * dt; // 高速で拡大
            this.empWave.life -= 1.8 * dt;  // 徐々に薄くなる
            if (this.empWave.life <= 0) {
                this.empWave = null;
            }
        }

        // チュートリアル中はゲーム内の難易度タイマーやスポーンタイマーを進めない
        if (!this.isTutorialMode) {
            this.difficultyTimer += dt * 1000;
            
            // Spawning
            this.spawnTimer -= dt * 1000;
            if (this.spawnTimer <= 0) {
                this.spawnEnemy();
                const diff = Math.min(this.difficultyTimer / 60000, 1);
                this.spawnTimer = 2000 - (diff * 1200); // gets faster
            }
        }

        // Target for trackers
        let tx = null, ty = null;
        if (this.isDrawing) { tx = this.mouseX; ty = this.mouseY; }

        // 新機能：線の周囲の「重力スロー（空間歪み）」判定
        // 描画中で、かつ線が2点以上引かれている場合のみ有効
        const slowThreshold = 45; // 45ピクセル以内でスロー発動
        const slowThresholdSq = slowThreshold * slowThreshold;

        this.enemies.forEach(e => {
            e.isSlowed = false; // デフォルトでリセット
            if (e.isSucked) return;

            if (this.isDrawing && this.points.length >= 2) {
                for (let j = 0; j < this.points.length - 1; j++) {
                    const p1 = this.points[j];
                    const p2 = this.points[j+1];

                    // AABB（軸平行境界ボックス）による事前判定で高負荷な距離計算を回避
                    const minX = Math.min(p1.x, p2.x) - slowThreshold;
                    const maxX = Math.max(p1.x, p2.x) + slowThreshold;
                    if (e.x < minX || e.x > maxX) continue;

                    const minY = Math.min(p1.y, p2.y) - slowThreshold;
                    const maxY = Math.max(p1.y, p2.y) + slowThreshold;
                    if (e.y < minY || e.y > maxY) continue;

                    const distSq = distToSegmentSquared(e, p1, p2);
                    if (distSq < slowThresholdSq) {
                        e.isSlowed = true;
                        break;
                    }
                }
            }
        });

        // 敵の更新（死んだ敵や自然消滅した敵を配列から除外）
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, tx, ty, this.isDrawing);
            if (e.isDead) {
                this.enemies.splice(i, 1);
            }
        }

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

        // Empty-loop miss feedback
        for (let i = this.missEffects.length - 1; i >= 0; i--) {
            const miss = this.missEffects[i];
            miss.life -= 2.5 * dt;
            miss.radius += 220 * dt;
            if (miss.life <= 0) this.missEffects.splice(i, 1);
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
            this.ctx.fillStyle = '#00ffff';
            this.ctx.beginPath();
            this.ctx.arc(bh.x, bh.y, (1 - bh.life) * 100, 0, Math.PI*2);
            this.ctx.fill();
            
            // Text
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 24px "M PLUS Rounded 1c"';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            
            // コンボと面積ボーナスを綺麗に表示
            if (bh.areaBonus > 50) {
                this.ctx.fillText(`+${bh.pts} (AREA:+${bh.areaBonus})`, bh.x, bh.y - 30);
            } else {
                this.ctx.fillText(`+${bh.pts}`, bh.x, bh.y - 30);
            }

            if (bh.caught > 1) {
                this.ctx.fillStyle = '#ff3366';
                this.ctx.fillText(`${bh.caught} COMBO!`, bh.x, bh.y + 10);
            }
        }
        this.ctx.globalAlpha = 1.0;

        // Empty-loop miss effects
        for (const miss of this.missEffects) {
            const alpha = Math.max(0, miss.life);
            this.ctx.save();
            this.ctx.globalAlpha = alpha;
            this.ctx.strokeStyle = '#ff3366';
            this.ctx.lineWidth = 4;
            this.ctx.shadowBlur = 12;
            this.ctx.shadowColor = '#ff3366';
            this.ctx.beginPath();
            this.ctx.arc(miss.x, miss.y, miss.radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.arc(miss.x, miss.y, miss.radius * 0.55, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // EMP衝撃波の描画
        if (this.empWave) {
            this.ctx.save();
            this.ctx.globalAlpha = Math.max(0, this.empWave.life);
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 6;
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(this.empWave.x, this.empWave.y, this.empWave.radius, 0, Math.PI * 2);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // Enemies
        this.enemies.forEach(e => e.draw(this.ctx));

        // 新機能：無敵時間（Invincible Frame）中の指先「ネオンシールドバリア」
        if (this.invincibleTimer > 0 && this.isDrawing && this.mouseX !== null && this.mouseY !== null) {
            this.ctx.save();
            // 無敵シールドのパルス効果
            const pulse = 1 + Math.sin(Date.now() * 0.02) * 0.1;
            const shieldRadius = 45 * pulse;
            const alpha = Math.max(0.2, this.invincibleTimer / 1.5) * 0.5;

            // ネオンシールドのグラデーション
            const grad = this.ctx.createRadialGradient(this.mouseX, this.mouseY, 5, this.mouseX, this.mouseY, shieldRadius);
            grad.addColorStop(0, 'rgba(0, 229, 255, 0.05)');
            grad.addColorStop(0.8, `rgba(0, 229, 255, ${alpha * 0.3})`);
            grad.addColorStop(1, `rgba(0, 229, 255, ${alpha})`);

            this.ctx.fillStyle = grad;
            this.ctx.strokeStyle = `rgba(0, 229, 255, ${alpha * 1.5})`;
            this.ctx.lineWidth = 3;
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#00ffff';

            // バリア描画
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, shieldRadius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // 内側の幾何学的なサブシールド
            this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.arc(this.mouseX, this.mouseY, shieldRadius * 0.6, 0, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.restore();
        }

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
            // 無敵時間中は線が少し半透明で点滅
            if (this.invincibleTimer > 0 && Math.floor(Date.now() / 100) % 2 === 0) {
                this.ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
            } else {
                this.ctx.strokeStyle = '#00ffff';
            }

            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = '#00ffff';
            
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
                this.ctx.fillStyle = '#fff';
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

    async shareResult(e) {
        if (e) {
            e.stopPropagation();
            e.preventDefault();
        }
        const text = `ブラックホールでターゲットを【${Math.floor(this.score)}】点分吸い込みました！ 評価：[${this.ui.rankTextEl.innerText}]`;
        const url = "https://hajikkoroom.xsrv.jp/blackhole-sweeper/";
        const hashtags = "ブラックホールスイーパー,はじっこぐらし";
        const shareText = `${text}\n${url}\n#ブラックホールスイーパー #はじっこぐらし`;
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtags)}`;

        if (navigator.share) {
            try {
                await navigator.share({ text: shareText, url });
                return;
            } catch (error) {
                if (error.name === 'AbortError') return;
            }
        }

        if (navigator.clipboard?.writeText) {
            try {
                await navigator.clipboard.writeText(shareText);
                this.ui.showToast('結果をコピーしました');
                return;
            } catch (error) {
                // Fall through to the tweet intent when clipboard access is blocked.
            }
        }

        const shareWindow = window.open(tweetUrl, '_blank', 'noopener,noreferrer');
        if (shareWindow) shareWindow.opener = null;
    }
}

// ==========================================
// Initialization
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
