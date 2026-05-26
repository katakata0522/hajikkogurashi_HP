// Kanji Slicer & Merge (漢字スライサー・マージ)
// Version: v1.4.0
// Core Game Logic

// Virtual coordinate space (maintains consistency across all screens)
const V_WIDTH = 400;
const V_HEIGHT = 640;

// Game margins
const WALL_MARGIN = 15;
const FLOOR_MARGIN = 20;
const DEAD_LINE = 145;
const DROP_HEIGHT = 80;

// Physics parameters
const GRAVITY = 0.35;
const AIR_RESISTANCE = 0.99;
const RESTITUTION = 0.15; // Bounce bounce factor (low for stability)
const FLOOR_FRICTION = 0.95;

// Kanji Database (Tiers, Colors, Glows)
const KANJI_DATA = {
    // Tier 1 (Base)
    '木': { tier: 1, color: '#4ab97a', glow: '#2e7d32', read: 'もく' },
    '日': { tier: 1, color: '#f5c242', glow: '#f57f17', read: 'にち' },
    '月': { tier: 1, color: '#42bcf5', glow: '#0288d1', read: 'げつ' },
    '人': { tier: 1, color: '#f0f0f0', glow: '#9e9e9e', read: 'じん' },
    '女': { tier: 1, color: '#f576ba', glow: '#c2185b', read: 'じょ' },
    '子': { tier: 1, color: '#76f0f5', glow: '#0097a7', read: 'し' },
    '山': { tier: 1, color: '#a8764a', glow: '#5d4037', read: 'さん' },
    '石': { tier: 1, color: '#949ca8', glow: '#455a64', read: 'せき' },
    '門': { tier: 1, color: '#7676f5', glow: '#303f9f', read: 'もん' },
    '口': { tier: 1, color: '#f57a42', glow: '#e64a19', read: 'こう' },
    '火': { tier: 1, color: '#f54a4a', glow: '#d32f2f', read: 'か' },
    
    // Tier 2 (Compounds)
    '林': { tier: 2, color: '#68d391', glow: '#2f855a', read: 'りん' },
    '明': { tier: 2, color: '#faf089', glow: '#b7791f', read: 'めい' },
    '休': { tier: 2, color: '#81e6d9', glow: '#2c7a7b', read: 'きゅう' },
    '好': { tier: 2, color: '#fbb6ce', glow: '#b83280', read: 'こう' },
    '岩': { tier: 2, color: '#cbd5e0', glow: '#4a5568', read: 'がん' },
    '間': { tier: 2, color: '#b794f4', glow: '#553c9a', read: 'かん' },
    '問': { tier: 2, color: '#90cdf4', glow: '#2b6cb0', read: 'もん' },
    '炎': { tier: 2, color: '#fc8181', glow: '#9b2c2c', read: 'えん' },
    '回': { tier: 2, color: '#fbd38d', glow: '#dd6b20', read: 'かい' },
    '朋': { tier: 2, color: '#90cdf4', glow: '#2b6cb0', read: 'ほう' },
    
    // Tier 3
    '森': { tier: 3, color: '#48bb78', glow: '#22543d', read: 'しん' }
};

const TIER1_KANJI = ['木', '日', '月', '人', '女', '子', '山', '石', '門', '口', '火'];
const TIER2_KANJI = ['林', '明', '休', '好', '岩', '間', '問', '炎', '回', '朋'];

// Merge Recipes
const RECIPES = [
    { a: '木', b: '木', result: '林', tier: 2 },
    { a: '林', b: '木', result: '森', tier: 3 },
    { a: '木', b: '林', result: '森', tier: 3 },
    { a: '日', b: '月', result: '明', tier: 2 },
    { a: '月', b: '日', result: '明', tier: 2 },
    { a: '人', b: '木', result: '休', tier: 2 },
    { a: '木', b: '人', result: '休', tier: 2 },
    { a: '女', b: '子', result: '好', tier: 2 },
    { a: '子', b: '女', result: '好', tier: 2 },
    { a: '山', b: '石', result: '岩', tier: 2 },
    { a: '石', b: '山', result: '岩', tier: 2 },
    { a: '門', b: '日', result: '間', tier: 2 },
    { a: '日', b: '門', result: '間', tier: 2 },
    { a: '門', b: '口', result: '問', tier: 2 },
    { a: '口', b: '門', result: '問', tier: 2 },
    { a: '火', b: '火', result: '炎', tier: 2 },
    { a: '口', b: '口', result: '回', tier: 2 },
    { a: '月', b: '月', result: '朋', tier: 2 }
];

// Decomposition mappings for Slicing
const DECOMPOSITIONS = {
    '林': ['木', '木'],
    '森': ['林', '木'],
    '明': ['日', '月'],
    '休': ['人', '木'],
    '好': ['女', '子'],
    '岩': ['山', '石'],
    '間': ['門', '日'],
    '問': ['門', '口'],
    '炎': ['火', '火'],
    '回': ['口', '口'],
    '朋': ['月', '月']
};

// Radii based on Tier
function getRadiusForTier(tier) {
    if (tier === 1) return 24;
    if (tier === 2) return 38;
    return 54; // Tier 3
}

// Sketchy Zen-style brush circle (円相 Enso)
function drawEnsoCircle(ctx, r, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    
    // Draw 2 overlapping sketchy strokes with slight noise
    for (let j = 0; j < 2; j++) {
        ctx.lineWidth = j === 0 ? 2.5 : 1.0;
        ctx.beginPath();
        const steps = 28;
        // Leave a tiny gap at the end (Zen circle)
        const startAngle = -Math.PI / 2 + (j * 0.05); // slight offset for second stroke
        const endAngle = startAngle + Math.PI * 2 * 0.95;
        
        for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            const angle = startAngle + (endAngle - startAngle) * ratio;
            
            // Radial jitter noise
            const radialNoise = Math.sin(angle * 5) * 0.6 + Math.cos(angle * 11) * 0.3;
            const currentRadius = r + radialNoise;
            
            const x = Math.cos(angle) * currentRadius;
            const y = Math.sin(angle) * currentRadius;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    ctx.restore();
}

// Sound Synthesizer via Web Audio API
class SoundSynth {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.compressor = null;
        this.lastPlayTimes = {};
    }

    suspend() {
        if (this.ctx && this.ctx.state === 'running') {
            this.ctx.suspend();
        }
    }

    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.ctx = new AudioContext();
            
            // Create dynamics compressor to prevent clipping spikes (audio overloading)
            this.compressor = this.ctx.createDynamicsCompressor();
            this.compressor.threshold.setValueAtTime(-15, this.ctx.currentTime);
            this.compressor.knee.setValueAtTime(30, this.ctx.currentTime);
            this.compressor.ratio.setValueAtTime(12, this.ctx.currentTime);
            this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
            this.compressor.release.setValueAtTime(0.25, this.ctx.currentTime);
            
            this.compressor.connect(this.ctx.destination);
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }

    play(type) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;
        
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        
        // Concurrency limit (debounce) to prevent ear-splitting volume stacking
        const lastPlay = this.lastPlayTimes[type] || 0;
        if (now - lastPlay < 0.05 && (type === 'bounce' || type === 'drop')) {
            return;
        }
        this.lastPlayTimes[type] = now;
        
        const dest = this.compressor || this.ctx.destination;
        
        if (type === 'drop') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(dest);

            osc.frequency.setValueAtTime(160, now);
            osc.frequency.exponentialRampToValueAtTime(70, now + 0.08);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

            osc.start(now);
            osc.stop(now + 0.08);
        }
        else if (type === 'bounce') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(dest);

            osc.frequency.setValueAtTime(100, now);
            osc.frequency.exponentialRampToValueAtTime(45, now + 0.1);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

            osc.start(now);
            osc.stop(now + 0.1);
        }
        else if (type === 'slice_hard') {
            // Metallic clink
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            
            osc1.type = 'triangle';
            osc2.type = 'sine';
            
            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(dest);

            osc1.frequency.setValueAtTime(900, now);
            osc2.frequency.setValueAtTime(1400, now);

            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

            osc1.start(now);
            osc2.start(now);
            osc1.stop(now + 0.12);
            osc2.stop(now + 0.12);
        }
        else if (type === 'slice_split') {
            // Whoosh slash + glass ring
            const oscWhoosh = this.ctx.createOscillator();
            const gainWhoosh = this.ctx.createGain();
            oscWhoosh.type = 'triangle';
            oscWhoosh.connect(gainWhoosh);
            gainWhoosh.connect(dest);
            
            oscWhoosh.frequency.setValueAtTime(500, now);
            oscWhoosh.frequency.exponentialRampToValueAtTime(120, now + 0.12);
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(800, now);
            oscWhoosh.disconnect(gainWhoosh);
            oscWhoosh.connect(filter);
            filter.connect(gainWhoosh);

            gainWhoosh.gain.setValueAtTime(0.12, now);
            gainWhoosh.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            
            oscWhoosh.start(now);
            oscWhoosh.stop(now + 0.12);

            // Chime split
            const oscRing = this.ctx.createOscillator();
            const gainRing = this.ctx.createGain();
            oscRing.type = 'sine';
            oscRing.connect(gainRing);
            gainRing.connect(dest);

            oscRing.frequency.setValueAtTime(1200, now);
            oscRing.frequency.exponentialRampToValueAtTime(1800, now + 0.2);

            gainRing.gain.setValueAtTime(0.06, now);
            gainRing.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

            oscRing.start(now);
            oscRing.stop(now + 0.2);
        }
        else if (type === 'merge') {
            // Traditional Koto harp sound (C major scale chimes)
            const notes = [261.63, 329.63, 392.00, 523.25];
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const filter = this.ctx.createBiquadFilter();
                
                osc.type = 'triangle';
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(700, now + idx * 0.04);

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(dest);

                osc.frequency.setValueAtTime(freq, now + idx * 0.04);
                osc.frequency.exponentialRampToValueAtTime(freq * 0.97, now + idx * 0.04 + 0.35);

                gain.gain.setValueAtTime(0.0, now);
                gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.04 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.4);

                osc.start(now + idx * 0.04);
                osc.stop(now + idx * 0.04 + 0.45);
            });
        }
        else if (type === 'mission_clear') {
            // Elegant jingle
            const notes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
            notes.forEach((freq, idx) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'sine';
                osc.connect(gain);
                gain.connect(dest);

                osc.frequency.setValueAtTime(freq, now + idx * 0.07);

                gain.gain.setValueAtTime(0.0, now);
                gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.07 + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.4);

                osc.start(now + idx * 0.07);
                osc.stop(now + idx * 0.07 + 0.5);
            });
        }
        else if (type === 'gameover') {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(500, now);
            filter.frequency.exponentialRampToValueAtTime(80, now + 1.2);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(dest);

            osc.frequency.setValueAtTime(220, now);
            osc.frequency.linearRampToValueAtTime(60, now + 1.2);

            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

            osc.start(now);
            osc.stop(now + 1.2);
        }
    }
}

const soundSynth = new SoundSynth();

// Game State variables
let bodies = [];
let particles = [];
let slashTrail = [];
let floatingTexts = [];
let shockwaves = [];
let shakeIntensity = 0;
let lastMergeTime = 0;
let chainCount = 0;
let slicesInSwipe = 0;

function spawnFloatingText(x, y, text, color = '#ffffff') {
    floatingTexts.push({
        x: x,
        y: y,
        vy: -1.2,
        text: text,
        color: color,
        alpha: 1,
        decay: 0.02
    });
}

// Discovered Kanji tracking (Encyclopedia)
let discoveredKanji = JSON.parse(localStorage.getItem('kanjislicer_discovered') || '[]');
// Tier 1 bases are discovered by default
TIER1_KANJI.forEach(k => {
    if (!discoveredKanji.includes(k)) discoveredKanji.push(k);
});
localStorage.setItem('kanjislicer_discovered', JSON.stringify(discoveredKanji));

let hasUnsavedDiscoveries = false;

function saveDiscoveredKanji() {
    if (!hasUnsavedDiscoveries) return;
    localStorage.setItem('kanjislicer_discovered', JSON.stringify(discoveredKanji));
    hasUnsavedDiscoveries = false;
}

let score = 0;
let bestScore = 0;
let currentMission = '林';
let currentKanji = '木';
let nextKanji = '木';

let previewX = V_WIDTH / 2;
let dropCooldown = 0;
let isDraggingPreview = false;
let isSlicing = false;
let isPaused = false;
let gameOverCounter = 0;
let isGameOver = false;

// Elements
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestScoreEl = document.getElementById('best-score');
const missionKanjiEl = document.getElementById('mission-kanji');
const missionReadingEl = document.getElementById('mission-reading');
const nextPreviewEl = document.getElementById('next-preview');
const btnSound = document.getElementById('btn-sound');
const btnPause = document.getElementById('btn-pause');
const pauseModal = document.getElementById('pause-modal');
const btnResume = document.getElementById('btn-resume');
const btnPauseRestart = document.getElementById('btn-pause-restart');
const dictGrid = document.getElementById('dictionary-grid');
const deadLineAlert = document.getElementById('dead-line-alert');
const gameoverModal = document.getElementById('gameover-modal');
const finalScoreEl = document.getElementById('final-score');
const btnRestart = document.getElementById('btn-restart');

// Load Best Score
bestScore = parseInt(localStorage.getItem('kanjislicer_best') || '0', 10);
bestScoreEl.textContent = bestScore;

// Canvas Sizing and high-DPI scaling
function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * (window.devicePixelRatio || 1);
    canvas.height = rect.height * (window.devicePixelRatio || 1);
    
    // Reset context transforms to identity
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Scale virtual space coordinates (V_WIDTH, V_HEIGHT) to match screen DPI
    ctx.scale(canvas.width / V_WIDTH, canvas.height / V_HEIGHT);
}
window.addEventListener('resize', resize);
resize();

// Helper: Get Base Components of a Kanji
function getBaseComponents(kanji) {
    if (TIER1_KANJI.includes(kanji)) return [kanji];
    const decomp = DECOMPOSITIONS[kanji];
    if (!decomp) return [kanji];
    return [
        ...getBaseComponents(decomp[0]),
        ...getBaseComponents(decomp[1])
    ];
}

// Generate Next Kanji dynamically influenced by the current mission
function generateNextKanji() {
    const bases = getBaseComponents(currentMission);
    
    // 50% chance of supplying a core component needed for the active mission
    if (Math.random() < 0.5 && bases.length > 0) {
        return bases[Math.floor(Math.random() * bases.length)];
    } else {
        // Otherwise, pick a random base kanji
        return TIER1_KANJI[Math.floor(Math.random() * TIER1_KANJI.length)];
    }
}

// Choose a New Mission
function chooseNewMission() {
    const pool = score >= 150 ? [...TIER2_KANJI, '森'] : TIER2_KANJI;
    let oldMission = currentMission;
    
    // Select new random mission, different from current
    do {
        currentMission = pool[Math.floor(Math.random() * pool.length)];
    } while (currentMission === oldMission && pool.length > 1);
    
    missionKanjiEl.textContent = currentMission;
    
    // Render Rubies for accessibility and educational aids
    const read = KANJI_DATA[currentMission].read;
    if (missionReadingEl) {
        missionReadingEl.textContent = `読み：${read} | 合体して作ろう！`;
    }
    
    // Update active drop queue based on new mission base components
    currentKanji = generateNextKanji();
    nextKanji = generateNextKanji();
    nextPreviewEl.textContent = nextKanji;
}

// Add Score
function addScore(pts) {
    score += pts;
    scoreEl.textContent = score;
    
    // Trigger UI micro-animation pop
    const scoreBox = document.querySelector('.score-box');
    if (scoreBox) {
        scoreBox.classList.add('pop');
        setTimeout(() => scoreBox.classList.remove('pop'), 150);
    }

    if (score > bestScore) {
        bestScore = score;
        bestScoreEl.textContent = bestScore;
        localStorage.setItem('kanjislicer_best', bestScore);
    }
}

// Spawn Particles
function spawnParticles(x, y, color, count, isGolden = false) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + (isGolden ? 1 : 2);
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (isGolden ? 1.5 : 0.5),
            radius: Math.random() * 3 + (isGolden ? 2 : 1),
            color: color,
            alpha: 1,
            decay: Math.random() * 0.02 + 0.015,
            gravity: isGolden ? -0.02 : 0.12 // Golden floats up
        });
    }
}

// Check and resolve recipe merges
let bodiesToSpawn = [];
function checkMerge(c1, c2) {
    if (c1.toDelete || c2.toDelete) return;
    
    // Find recipe
    const recipe = RECIPES.find(r => 
        (r.a === c1.kanji && r.b === c2.kanji) || 
        (r.a === c2.kanji && r.b === c1.kanji)
    );
    
    if (recipe) {
        c1.toDelete = true;
        c2.toDelete = true;
        
        const midX = (c1.x + c2.x) / 2;
        const midY = (c1.y + c2.y) / 2;
        const newKanji = recipe.result;
        const newTier = recipe.tier;
        const newRadius = getRadiusForTier(newTier);
        
        // Track discovered encyclopedia
        if (!discoveredKanji.includes(newKanji)) {
            discoveredKanji.push(newKanji);
            hasUnsavedDiscoveries = true;
            spawnFloatingText(midX, midY - 35, '新漢字解放！', '#eb5e28');
        }
        
        // Spawn particles
        spawnParticles(midX, midY, KANJI_DATA[newKanji].color, 12);
        
        // Dynamic combo chain check (within 1.2 seconds)
        const now = Date.now();
        if (now - lastMergeTime < 1200) {
            chainCount++;
        } else {
            chainCount = 1;
        }
        lastMergeTime = now;
        
        // Screen Shake & Shockwave effects
        shakeIntensity = Math.min(shakeIntensity + (newTier === 3 ? 9 : 4.5), 14);
        shockwaves.push({
            x: midX,
            y: midY,
            r: 10,
            maxR: newRadius * 2.2,
            color: KANJI_DATA[newKanji].color,
            alpha: 1,
            speed: 3.0
        });

        // Check if this fulfills the mission
        if (newKanji === currentMission) {
            const basePoints = 100;
            const finalPoints = basePoints * chainCount;
            
            // Mission cleared! Consume the Kanji, do not spawn it, clear space
            soundSynth.play('mission_clear');
            spawnParticles(midX, midY, '#ffd700', 32, true); // Golden sparks
            addScore(finalPoints);
            
            // Trigger floating text / notification
            if (chainCount > 1) {
                spawnFloatingText(midX, midY - 20, `${chainCount}連鎖！お題達成 +${finalPoints}`, '#ffd700');
            } else {
                spawnFloatingText(midX, midY - 20, 'お題達成！ +100', '#ffd700');
            }
            chooseNewMission();
        } else {
            // Normal merge: Spawn the compound circle
            const basePoints = newTier * 10;
            const finalPoints = basePoints * chainCount;
            
            bodiesToSpawn.push({
                x: midX,
                y: midY,
                vx: (c1.vx + c2.vx) / 2,
                vy: (c1.vy + c2.vy) / 2 - 1.5, // slight pop up
                radius: newRadius,
                kanji: newKanji,
                tier: newTier,
                color: KANJI_DATA[newKanji].color,
                angle: 0,
                angularVelocity: (Math.random() - 0.5) * 0.1,
                mass: newRadius,
                mergeCooldown: 12, // short delay to prevent instant secondary merges
                age: 0,
                toDelete: false
            });
            
            addScore(finalPoints);
            soundSynth.play('merge');
            
            if (chainCount > 1) {
                spawnFloatingText(midX, midY - 15, `${chainCount}連鎖！ +${finalPoints}`, '#ffd700');
            } else {
                spawnFloatingText(midX, midY - 15, `+${finalPoints}`, KANJI_DATA[newKanji].color);
            }
        }
    }
}

// Slice detection: Segment-Circle Intersection Check
function checkLineCircleIntersection(A, B, C, r) {
    let ab_x = B.x - A.x;
    let ab_y = B.y - A.y;
    let ac_x = C.x - A.x;
    let ac_y = C.y - A.y;
    
    let ab_len_sq = ab_x * ab_x + ab_y * ab_y;
    if (ab_len_sq === 0) {
        let dist = Math.sqrt(ac_x * ac_x + ac_y * ac_y);
        return dist <= r;
    }
    
    let t = (ac_x * ab_x + ac_y * ab_y) / ab_len_sq;
    t = Math.max(0, Math.min(1, t)); // clamp to line segment
    
    let closest_x = A.x + t * ab_x;
    let closest_y = A.y + t * ab_y;
    
    let dx = C.x - closest_x;
    let dy = C.y - closest_y;
    let dist_sq = dx * dx + dy * dy;
    
    return dist_sq <= r * r;
}

// Perform Slicing on a Body
function sliceBody(body, p1, p2) {
    if (body.tier === 1) {
        // Tier 1 is indestructible. Apply simple push bounce
        const dx = body.x - (p1.x + p2.x) / 2;
        const dy = body.y - (p1.y + p2.y) / 2;
        const len = Math.sqrt(dx*dx + dy*dy) || 1;
        
        body.vx += (dx / len) * 2;
        body.vy += (dy / len) * 2 - 1;
        body.angularVelocity = (Math.random() - 0.5) * 0.3;
        
        soundSynth.play('slice_hard');
        spawnParticles(body.x, body.y, '#949ca8', 4);
        return;
    }
    
    // Tier 2 & 3 gets sliced!
    body.toDelete = true;
    soundSynth.play('slice_split');
    
    // Track multi-slice combo in a single swipe
    slicesInSwipe++;
    shakeIntensity = Math.min(shakeIntensity + 5.0, 13);
    
    if (slicesInSwipe > 1) {
        const comboText = slicesInSwipe === 2 ? '二連斬！' : (slicesInSwipe === 3 ? '三連斬！' : '神速連斬！');
        spawnFloatingText(body.x, body.y - 25, comboText, '#ffffff');
        addScore(slicesInSwipe * 5); // Combo bonus score!
    }
    
    const decomp = DECOMPOSITIONS[body.kanji];
    if (decomp) {
        // Calculate slash normal
        let sx = p2.x - p1.x;
        let sy = p2.y - p1.y;
        let len = Math.sqrt(sx*sx + sy*sy) || 1;
        let nx = -sy / len;
        let ny = sx / len;
        
        // Spawn component 1 & 2
        const c1Kanji = decomp[0];
        const c2Kanji = decomp[1];
        
        const r1 = getRadiusForTier(KANJI_DATA[c1Kanji].tier);
        const r2 = getRadiusForTier(KANJI_DATA[c2Kanji].tier);
        
        // Push apart perpendicularly to slash line
        const pushX = nx * body.radius * 0.45;
        const pushY = ny * body.radius * 0.45;
        
        const spawnComponent = (kanji, rx, px, py, dir) => {
            bodiesToSpawn.push({
                x: body.x + px * dir,
                y: body.y + py * dir,
                vx: body.vx + nx * dir * 2.8,
                vy: body.vy + ny * dir * 2.8 - 1.2, // slight pop up
                radius: rx,
                kanji: kanji,
                tier: KANJI_DATA[kanji].tier,
                color: KANJI_DATA[kanji].color,
                angle: Math.random() * Math.PI,
                angularVelocity: dir * 0.25,
                mass: rx,
                mergeCooldown: 50, // high cooldown frames to let them separate
                age: 0,
                toDelete: false
            });
        };
        
        spawnComponent(c1Kanji, r1, pushX, pushY, 1);
        spawnComponent(c2Kanji, r2, pushX, pushY, -1);
        
        // Spatter particles (ink splat theme)
        spawnParticles(body.x, body.y, '#1c1c1e', 18);
        spawnParticles(body.x, body.y, KANJI_DATA[body.kanji].color, 8);
    }
}

// Input Helpers
function getVirtualCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    // Scale client coordinate to virtual coordinate space
    const x = ((clientX - rect.left) / rect.width) * V_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * V_HEIGHT;
    return { x, y };
}

// Mouse/Touch Listeners
function handleStart(e) {
    if (isGameOver || isPaused) return;
    soundSynth.init(); // Initialize audio context on first tap
    
    const coords = getVirtualCoords(e);
    
    if (coords.y <= DEAD_LINE - 25) {
        // Drop zone interaction
        if (dropCooldown === 0) {
            isDraggingPreview = true;
            previewX = Math.max(WALL_MARGIN + getRadiusForTier(1), Math.min(V_WIDTH - WALL_MARGIN - getRadiusForTier(1), coords.x));
        }
    } else {
        // Slash zone interaction
        isSlicing = true;
        slicesInSwipe = 0; // reset combo count for this swipe
        slashTrail = [{ x: coords.x, y: coords.y, age: 0 }];
    }
}

function handleMove(e) {
    if (isGameOver || isPaused) return;
    const coords = getVirtualCoords(e);
    
    if (isDraggingPreview) {
        previewX = Math.max(WALL_MARGIN + getRadiusForTier(1), Math.min(V_WIDTH - WALL_MARGIN - getRadiusForTier(1), coords.x));
    } else if (isSlicing) {
        const lastPt = slashTrail[slashTrail.length - 1];
        if (lastPt) {
            const dist = Math.sqrt((coords.x - lastPt.x)**2 + (coords.y - lastPt.y)**2);
            if (dist > 3) {
                // Check slice intersections on all active bodies
                const p1 = { x: lastPt.x, y: lastPt.y };
                const p2 = { x: coords.x, y: coords.y };
                
                for (let body of bodies) {
                    if (!body.toDelete && checkLineCircleIntersection(p1, p2, body, body.radius)) {
                        sliceBody(body, p1, p2);
                    }
                }
                
                slashTrail.push({ x: coords.x, y: coords.y, age: 0 });
            }
        }
    }
}

function handleEnd(e) {
    if (isPaused || isGameOver) {
        isDraggingPreview = false;
        isSlicing = false;
        return;
    }
    if (isDraggingPreview && dropCooldown === 0) {
        // Drop Kanji!
        const r = getRadiusForTier(1);
        bodies.push({
            x: previewX,
            y: DROP_HEIGHT,
            vx: 0,
            vy: 2.5,
            radius: r,
            kanji: currentKanji,
            tier: 1,
            color: KANJI_DATA[currentKanji].color,
            angle: 0,
            angularVelocity: 0,
            mass: r,
            mergeCooldown: 0,
            age: 0,
            toDelete: false
        });
        
        soundSynth.play('drop');
        dropCooldown = 40; // Cooldown frames (~0.66s)
        
        currentKanji = nextKanji;
        nextKanji = generateNextKanji();
        nextPreviewEl.textContent = nextKanji;
    }
    
    isDraggingPreview = false;
    isSlicing = false;
}

canvas.addEventListener('mousedown', handleStart);
canvas.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

canvas.addEventListener('touchstart', handleStart, { passive: true });
canvas.addEventListener('touchmove', handleMove, { passive: true });
window.addEventListener('touchend', handleEnd);
window.addEventListener('blur', () => {
    isDraggingPreview = false;
    isSlicing = false;
    slashTrail = [];
});

// Sound Button toggle
btnSound.addEventListener('click', () => {
    const isEnabled = soundSynth.toggle();
    btnSound.textContent = isEnabled ? '🔊' : '🔇';
});

// Pause button click
btnPause.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent canvas drop trigger if clicked fast
    if (isGameOver) return;
    isPaused = true;
    
    // Reset active dragging/slicing input states to avoid sticky previews on resume
    isDraggingPreview = false;
    isSlicing = false;
    slashTrail = [];
    
    soundSynth.suspend();
    saveDiscoveredKanji();
    updateDictionaryUI();
    
    pauseModal.classList.remove('hidden');
});

// Resume button click
btnResume.addEventListener('click', () => {
    isPaused = false;
    soundSynth.resume();
    pauseModal.classList.add('hidden');
});

// Restart button from pause menu
btnPauseRestart.addEventListener('click', () => {
    isPaused = false;
    soundSynth.resume();
    pauseModal.classList.add('hidden');
    restartGame();
});

// Get formula text for dictionary UI
function getFormulaText(kanji) {
    const decomp = DECOMPOSITIONS[kanji];
    if (!decomp) return '';
    return `${decomp[0]} + ${decomp[1]}`;
}

// Convert Hex to RGB helper for box shadow transparency
function hexToRgb(hex) {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    hex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
}

// Initialize Dictionary skeleton once to avoid heavy garbage collection (GC) load
let isDictInitialized = false;
function initDictionarySkeleton() {
    if (isDictInitialized) return;
    dictGrid.innerHTML = '';
    
    const targetKanji = [...TIER2_KANJI, '森'];
    targetKanji.forEach(k => {
        const card = document.createElement('div');
        card.className = 'recipe-card locked';
        card.setAttribute('data-kanji', k);
        
        const kanjiEl = document.createElement('div');
        kanjiEl.className = 'dict-kanji';
        kanjiEl.textContent = '?';
        
        const readingEl = document.createElement('div');
        readingEl.className = 'dict-reading';
        readingEl.textContent = '???';
        
        const formulaEl = document.createElement('div');
        formulaEl.className = 'dict-formula';
        formulaEl.textContent = getFormulaText(k);
        
        card.appendChild(kanjiEl);
        card.appendChild(readingEl);
        card.appendChild(formulaEl);
        dictGrid.appendChild(card);
    });
    isDictInitialized = true;
}

// Efficiently update dictionary card attributes instead of destroying and recreating DOM nodes
function updateDictionaryUI() {
    initDictionarySkeleton();
    
    const cards = dictGrid.querySelectorAll('.recipe-card');
    cards.forEach(card => {
        const k = card.getAttribute('data-kanji');
        const data = KANJI_DATA[k];
        if (!data) return;
        
        const isUnlocked = discoveredKanji.includes(k);
        const kanjiEl = card.querySelector('.dict-kanji');
        const readingEl = card.querySelector('.dict-reading');
        
        if (isUnlocked) {
            card.className = 'recipe-card unlocked';
            card.style.borderColor = data.color;
            card.style.boxShadow = `inset 0 0 10px rgba(${hexToRgb(data.color)}, 0.15)`;
            
            kanjiEl.textContent = k;
            kanjiEl.style.color = data.color;
            kanjiEl.style.textShadow = `0 0 8px ${data.glow}`;
            
            readingEl.textContent = `読み: ${data.read}`;
        } else {
            card.className = 'recipe-card locked';
            card.style.borderColor = '';
            card.style.boxShadow = '';
            
            kanjiEl.textContent = '?';
            kanjiEl.style.color = '';
            kanjiEl.style.textShadow = '';
            
            readingEl.textContent = '???';
        }
    });
}

// Game loop physics updates
function updatePhysics() {
    // 1. Gravity and velocity updates
    for (let body of bodies) {
        body.vy += GRAVITY;
        body.vx *= AIR_RESISTANCE;
        body.vy *= AIR_RESISTANCE;
        
        body.x += body.vx;
        body.y += body.vy;
        
        body.angle += body.angularVelocity;
        body.angularVelocity *= 0.96; // spin damping
        
        if (body.mergeCooldown > 0) body.mergeCooldown--;
        body.age++;
    }
    
    // 2. Boundary bounds constraints
    for (let body of bodies) {
        const floorY = V_HEIGHT - FLOOR_MARGIN - body.radius;
        if (body.y > floorY) {
            body.y = floorY;
            
            // Resting contact threshold to prevent endless micro-bounces and jitter sounds
            if (Math.abs(body.vy) < 1.1) {
                body.vy = 0;
            } else {
                body.vy = -body.vy * RESTITUTION;
                if (Math.abs(body.vy) > 0.5) {
                    soundSynth.play('bounce');
                }
            }
            
            body.vx *= FLOOR_FRICTION;
            if (Math.abs(body.vx) < 0.08) {
                body.vx = 0;
            }
            
            // Roll animation spin based on velocity
            body.angularVelocity = body.vx / body.radius;
        }
        
        const leftX = WALL_MARGIN + body.radius;
        if (body.x < leftX) {
            body.x = leftX;
            body.vx = -body.vx * RESTITUTION;
            if (Math.abs(body.vx) < 0.1) body.vx = 0;
            body.angularVelocity = -body.vy / body.radius * 0.15;
        }
        
        const rightX = V_WIDTH - WALL_MARGIN - body.radius;
        if (body.x > rightX) {
            body.x = rightX;
            body.vx = -body.vx * RESTITUTION;
            if (Math.abs(body.vx) < 0.1) body.vx = 0;
            body.angularVelocity = body.vy / body.radius * 0.15;
        }
    }
    
    // 3. Circle-to-circle collisions (4 passes for stability)
    for (let pass = 0; pass < 4; pass++) {
        for (let i = 0; i < bodies.length; i++) {
            for (let j = i + 1; j < bodies.length; j++) {
                const c1 = bodies[i];
                const c2 = bodies[j];
                
                if (c1.toDelete || c2.toDelete) continue;
                
                const dx = c2.x - c1.x;
                const dy = c2.y - c1.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const minDist = c1.radius + c2.radius;
                
                if (dist < minDist) {
                    const overlap = minDist - dist;
                    const nx = dx / (dist || 1);
                    const ny = dy / (dist || 1);
                    
                    // Separate circles based on mass ratios
                    const totalMass = c1.mass + c2.mass;
                    const r1 = c2.mass / totalMass;
                    const r2 = c1.mass / totalMass;
                    
                    c1.x -= nx * overlap * r1;
                    c1.y -= ny * overlap * r1;
                    c2.x += nx * overlap * r2;
                    c2.y += ny * overlap * r2;
                    
                    // Relative velocities along normal
                    const rvx = c2.vx - c1.vx;
                    const rvy = c2.vy - c1.vy;
                    const velAlongNormal = rvx * nx + rvy * ny;
                    
                    if (velAlongNormal < 0) {
                        const impulse = -(1 + RESTITUTION) * velAlongNormal / (1/c1.mass + 1/c2.mass);
                        c1.vx -= (1/c1.mass) * impulse * nx;
                        c1.vy -= (1/c1.mass) * impulse * ny;
                        c2.vx += (1/c2.mass) * impulse * nx;
                        c2.vy += (1/c2.mass) * impulse * ny;
                        
                        // Apply tangent spin torque
                        const tx = -ny;
                        const ty = nx;
                        const rvt = rvx * tx + rvy * ty;
                        c1.angularVelocity += rvt * 0.005;
                        c2.angularVelocity -= rvt * 0.005;
                    }
                    
                    // Trigger Merge
                    if (c1.mergeCooldown === 0 && c2.mergeCooldown === 0) {
                        checkMerge(c1, c2);
                    }
                }
            }
        }
    }
    
    // Clean up deletes and spawn new ones
    bodies = bodies.filter(b => !b.toDelete);
    if (bodiesToSpawn.length > 0) {
        bodies.push(...bodiesToSpawn);
        bodiesToSpawn = [];
    }
}

// Dead Line Check (Game Over check)
function checkGameOver() {
    let overLimit = false;
    for (let body of bodies) {
        // Trigger alert only for settled items, aged past initial fall
        if (body.age > 80 && (body.y - body.radius < DEAD_LINE)) {
            overLimit = true;
            break;
        }
    }
    
    if (overLimit) {
        gameOverCounter++;
        deadLineAlert.classList.add('active');
        if (gameOverCounter > 180) { // 3 seconds at 60fps
            triggerGameOver();
        }
    } else {
        gameOverCounter = 0;
        deadLineAlert.classList.remove('active');
    }
}

function triggerGameOver() {
    isGameOver = true;
    saveDiscoveredKanji(); // Ensure discoveries are saved to localStorage on game over
    soundSynth.play('gameover');
    finalScoreEl.textContent = score;
    gameoverModal.classList.remove('hidden');
}

// Restart Game
function restartGame() {
    bodies = [];
    particles = [];
    slashTrail = [];
    floatingTexts = [];
    shockwaves = [];
    shakeIntensity = 0;
    chainCount = 0;
    slicesInSwipe = 0;
    score = 0;
    scoreEl.textContent = 0;
    gameOverCounter = 0;
    isGameOver = false;
    dropCooldown = 0;
    deadLineAlert.classList.remove('active');
    gameoverModal.classList.add('hidden');
    chooseNewMission();
}

btnRestart.addEventListener('click', restartGame);

// Render Call
function draw() {
    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);
    
    ctx.save();
    // Apply Screen Shake if active
    if (shakeIntensity > 0.1) {
        const dx = (Math.random() - 0.5) * shakeIntensity;
        const dy = (Math.random() - 0.5) * shakeIntensity;
        ctx.translate(dx, dy);
    }
    
    // 1. Draw grid backdrop (Subtle, calligraphy styled vibe)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < V_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, V_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < V_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(V_WIDTH, y);
        ctx.stroke();
    }
    
    // Drop zone visual background header area
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.fillRect(0, 0, V_WIDTH, DEAD_LINE - 25);
    
    // 2. Draw Drop Line & Dead Line
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(0, DEAD_LINE - 25);
    ctx.lineTo(V_WIDTH, DEAD_LINE - 25);
    ctx.stroke();
    
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.25)'; // Dead Line
    ctx.beginPath();
    ctx.moveTo(WALL_MARGIN, DEAD_LINE);
    ctx.lineTo(V_WIDTH - WALL_MARGIN, DEAD_LINE);
    ctx.stroke();
    ctx.setLineDash([]); // Reset dash
    
    // 3. Draw container boundaries
    ctx.fillStyle = '#1c1f26';
    ctx.fillRect(0, V_HEIGHT - FLOOR_MARGIN, V_WIDTH, FLOOR_MARGIN); // Floor
    ctx.fillRect(0, 0, WALL_MARGIN, V_HEIGHT); // Left wall
    ctx.fillRect(V_WIDTH - WALL_MARGIN, 0, WALL_MARGIN, V_HEIGHT); // Right wall
    
    // 4. Draw Guide line (when dragging preview)
    if (isDraggingPreview && dropCooldown === 0) {
        ctx.setLineDash([5, 8]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(previewX, DROP_HEIGHT);
        ctx.lineTo(previewX, V_HEIGHT - FLOOR_MARGIN);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // 5. Draw Preview Kanji
    if (dropCooldown === 0 && !isGameOver) {
        const data = KANJI_DATA[currentKanji];
        const r = getRadiusForTier(1);
        
        ctx.save();
        ctx.translate(previewX, DROP_HEIGHT);
        
        // Draw glow
        ctx.shadowColor = data.glow;
        ctx.shadowBlur = 8;
        ctx.fillStyle = 'rgba(25, 29, 38, 0.85)';
        ctx.strokeStyle = data.color;
        ctx.lineWidth = 2.5;
        
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow
        
        // Draw Text
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${r * 1.1}px 'Kaisei Decol', 'Noto Serif JP', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(currentKanji, 0, 1);
        ctx.restore();
    }
    
    // 5.5 Draw Shockwaves
    for (let sw of shockwaves) {
        ctx.save();
        ctx.globalAlpha = sw.alpha;
        ctx.strokeStyle = sw.color;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 8;
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // 6. Draw Physics Bodies
    for (let body of bodies) {
        const data = KANJI_DATA[body.kanji];
        ctx.save();
        ctx.translate(body.x, body.y);
        ctx.rotate(body.angle);
        
        // Check if this body is causing a game-over warning alert
        const isWarning = body.age > 80 && (body.y - body.radius < DEAD_LINE);
        
        if (isWarning) {
            // Apply warning micro-shake and red glow aura
            const shake = Math.sin(Date.now() / 25) * 0.9;
            ctx.translate(shake, -shake);
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 14 + Math.sin(Date.now() / 60) * 4;
        } else {
            ctx.shadowColor = data.glow;
            ctx.shadowBlur = 10;
        }
        
        // Translucent parchment/glass background circle
        ctx.fillStyle = 'rgba(16, 18, 23, 0.82)';
        ctx.beginPath();
        ctx.arc(0, 0, body.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Sketchy Zen-style brush circle boundary
        drawEnsoCircle(ctx, body.radius, isWarning ? '#ef4444' : data.color);
        ctx.shadowBlur = 0; // Reset
        
        // Kanji character text (shifted slightly up)
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${body.radius * 1.05}px 'Kaisei Decol', 'Noto Serif JP', serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(body.kanji, 0, -body.radius * 0.12);
        
        // Furigana (Ruby) reading under the Kanji
        ctx.fillStyle = 'rgba(255, 255, 255, 0.62)';
        ctx.font = `bold ${body.radius * 0.34}px 'Noto Sans JP', sans-serif`;
        ctx.fillText(data.read, 0, body.radius * 0.45);
        
        ctx.restore();
    }
    
    // 7. Draw Fading Particles
    for (let p of particles) {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    
    // 8. Draw Swipe / Slash trail
    if (slashTrail.length > 1) {
        ctx.save();
        ctx.shadowColor = KANJI_DATA[currentMission].color;
        ctx.shadowBlur = 8;
        
        // Draw connected line segments with decreasing widths
        for (let i = 1; i < slashTrail.length; i++) {
            const p1 = slashTrail[i - 1];
            const p2 = slashTrail[i];
            const ratio = i / slashTrail.length;
            
            ctx.strokeStyle = `rgba(255, 255, 255, ${ratio * 0.9})`;
            ctx.lineWidth = ratio * 5;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
        ctx.restore();
    }
    
    // 9. Draw Floating Texts
    for (let ft of floatingTexts) {
        ctx.save();
        ctx.globalAlpha = ft.alpha;
        ctx.fillStyle = ft.color;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 6;
        ctx.font = "bold 16px 'Noto Sans JP', sans-serif";
        ctx.textAlign = 'center';
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.restore();
    }
    ctx.restore(); // Restore screen shake save
}

// Update game mechanics loops
function update() {
    if (isPaused) return;
    
    if (!isGameOver) {
        updatePhysics();
        checkGameOver();
    }
    
    // Decay screen shake
    if (shakeIntensity > 0.05) {
        shakeIntensity *= 0.88;
    } else {
        shakeIntensity = 0;
    }
    
    // Update shockwaves
    for (let sw of shockwaves) {
        sw.r += sw.speed;
        sw.alpha -= 0.035;
    }
    shockwaves = shockwaves.filter(sw => sw.alpha > 0);
    
    // Update particles positions
    for (let p of particles) {
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
    }
    particles = particles.filter(p => p.alpha > 0);
    
    // Update floating texts positions
    for (let ft of floatingTexts) {
        ft.y += ft.vy;
        ft.alpha -= ft.decay;
    }
    floatingTexts = floatingTexts.filter(ft => ft.alpha > 0);
    
    // Update slash trail aging
    for (let pt of slashTrail) {
        pt.age++;
    }
    slashTrail = slashTrail.filter(pt => pt.age < 12);
    
    if (dropCooldown > 0) dropCooldown--;
}

// Tick Game Loop
function tick() {
    update();
    draw();
    requestAnimationFrame(tick);
}

// Start Game Setup
chooseNewMission();
requestAnimationFrame(tick);
