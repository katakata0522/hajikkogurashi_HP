/* ==========================================================================
   LUMEN_MIRROR - CORE ENGINE & AUDIO SYNTHESIZER
   ========================================================================== */

// --- Constants & Config ---
const CONFIG = {
    WIDTH: 600,
    HEIGHT: 800,
    MAX_REFLECTIONS: 12,
    LASER_SPEED: 1200, // px per second
    PARTICLE_COUNT: 25,
    MAX_INK: 450, // maximum ink length in px
};

const STATE = {
    TITLE: 0,
    PLAYING: 1,
    EMITTING: 2,
    CLEAR: 3,
};

// --- Web Audio API Synth (ASMR & Crystal Sound) ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.iceNoiseNode = null;
        this.iceGain = null;
        this.isPlayingIce = false;
    }

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.setupIceSynth();
    }

    // Line drawing sound (ASMR: Scratchy ice dust noise)
    setupIceSynth() {
        if (!this.ctx) return;

        // Generate 2 seconds of white noise
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        // Filter to make it sound thin, icy and scratchy
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 3500; // high frequency scratch
        filter.Q.value = 8.0;

        this.iceGain = this.ctx.createGain();
        this.iceGain.gain.value = 0; // starts silent

        noise.connect(filter);
        filter.connect(this.iceGain);
        this.iceGain.connect(this.ctx.destination);

        noise.start(0);
        this.iceNoiseNode = noise;
    }

    startIceScratch() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        if (this.isPlayingIce) return;

        this.iceGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.iceGain.gain.linearRampToValueAtTime(0.04, this.ctx.currentTime + 0.05);
        this.isPlayingIce = true;
    }

    updateIceScratch(speed) {
        if (!this.isPlayingIce) return;
        // Dynamically shift volume & frequency based on movement speed
        const volume = Math.min(0.02 + (speed / 2000), 0.08);
        const frequency = Math.min(2500 + speed * 2, 5500);
        
        this.iceGain.gain.setValueAtTime(volume, this.ctx.currentTime);
    }

    stopIceScratch() {
        if (!this.isPlayingIce) return;
        this.iceGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.iceGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
        this.isPlayingIce = false;
    }

    // Laser hit sound (Crystal glass clang: "カキィン")
    playCrystalClang() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1800, now); // Principal thin clang
        osc1.frequency.exponentialRampToValueAtTime(1500, now + 0.35);

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(2600, now); // Overtone crystal vibration
        osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.15);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

        // Add subtle bandpass to emphasize crystal resonance
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1900;
        filter.Q.value = 4.0;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(filter);
        filter.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
    }

    // Clear chord (Sacred Major Chord harmony)
    playClearChord() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        
        // F Major 7th chord (F4, A4, C5, E5) - beautiful, mystical and open
        const frequencies = [349.23, 440.00, 523.25, 659.25];
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.4); // soft attack
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5); // long decay

        frequencies.forEach(freq => {
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle'; // rich soft tone
            osc.frequency.value = freq;
            osc.connect(gain);
            osc.start(now);
            osc.stop(now + 3.0);
        });

        // Soft filter to cut sharp frequencies
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(800, now);
        lp.frequency.exponentialRampToValueAtTime(300, now + 2.5);

        gain.connect(lp);
        lp.connect(this.ctx.destination);
    }
}

const audio = new AudioManager();

// --- Linear Algebra & Vector Helpers ---
function dist(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

function getIntersection(p1, p2, p3, p4) {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < 1e-8) return null; // Parallel

    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return {
            x: p1.x + ua * (p2.x - p1.x),
            y: p1.y + ua * (p2.y - p1.y),
            ua: ua,
            ub: ub
        };
    }
    return null;
}

// --- Entities ---

class Mirror {
    constructor(x1, y1, x2, y2) {
        this.p1 = { x: x1, y: y1 };
        this.p2 = { x: x2, y: y2 };
        this.length = dist(this.p1, this.p2);
        this.pulse = 0;
    }

    draw(ctx, isSelected) {
        ctx.save();
        ctx.lineWidth = isSelected ? 4 : 2;
        
        // Neon pulse effect
        const alpha = 0.6 + Math.sin(Date.now() * 0.01 + this.length) * 0.25;
        ctx.shadowBlur = isSelected ? 12 : 6;
        ctx.shadowColor = 'rgba(192, 192, 216, 0.8)';
        ctx.strokeStyle = isSelected ? '#ffffff' : `rgba(192, 192, 216, ${alpha})`;
        
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        
        // Draw cold metallic endpoints
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(this.p1.x, this.p1.y, 3, 0, Math.PI * 2);
        ctx.arc(this.p2.x, this.p2.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    // Distance from a point to this mirror line segment
    distanceToPoint(p) {
        const l2 = this.length * this.length;
        if (l2 === 0) return dist(p, this.p1);
        
        let t = ((p.x - this.p1.x) * (this.p2.x - this.p1.x) + (p.y - this.p1.y) * (this.p2.y - this.p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        
        return dist(p, {
            x: this.p1.x + t * (this.p2.x - this.p1.x),
            y: this.p1.y + t * (this.p2.y - this.p1.y)
        });
    }
}

class Emitter {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle; // in radians
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Core cyan neon emitter circle
        ctx.shadowBlur = 15;
        ctx.shadowColor = 'rgba(0, 243, 255, 0.8)';
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Industrial crosshair ticks
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
        ctx.beginPath();
        ctx.moveTo(-20, 0); ctx.lineTo(-14, 0);
        ctx.moveTo(14, 0); ctx.lineTo(20, 0);
        ctx.moveTo(0, -20); ctx.lineTo(0, -14);
        ctx.moveTo(0, 14); ctx.lineTo(0, 20);
        ctx.stroke();

        // Direction pointer arrow
        ctx.fillStyle = '#00f3ff';
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(5, -4);
        ctx.lineTo(5, 4);
        ctx.fill();

        ctx.restore();
    }
}

class Prism {
    constructor(x, y, radius = 20) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.angle = 0;
        this.isTuned = false;
    }

    update(dt) {
        // Slow mechanical spin
        this.angle += (this.isTuned ? 3.0 : 0.6) * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Neon Prism Diamond
        ctx.shadowBlur = this.isTuned ? 25 : 10;
        ctx.shadowColor = this.isTuned ? 'rgba(255, 0, 127, 0.9)' : 'rgba(255, 0, 127, 0.4)';
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = this.isTuned ? 2.5 : 1.5;

        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.stroke();

        // Inner aesthetic geometry
        ctx.strokeStyle = this.isTuned ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 0, 127, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        // Center nuclear glow
        ctx.fillStyle = this.isTuned ? '#ffffff' : 'rgba(255, 0, 127, 0.1)';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    containsPoint(p) {
        return dist(p, this) <= this.radius;
    }
}

class BlackHole {
    constructor(x, y, mass = 60, pullRadius = 150) {
        this.x = x;
        this.y = y;
        this.mass = mass; // Gravity strength
        this.pullRadius = pullRadius;
        this.pulse = 0;
    }

    draw(ctx) {
        this.pulse += 0.05;
        const pulseRad = 3 + Math.sin(this.pulse) * 1.5;

        ctx.save();
        
        // Gravity pull field (Faint circles)
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.02)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.pullRadius, 0, Math.PI * 2);
        ctx.arc(this.x, this.y, this.pullRadius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        // Event Horizon Glow
        ctx.shadowBlur = 20;
        ctx.shadowColor = 'rgba(0, 243, 255, 0.25)';
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 25);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.5, '#020205');
        grad.addColorStop(0.85, 'rgba(0, 243, 255, 0.15)');
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 25, 0, Math.PI * 2);
        ctx.fill();

        // Absorb Core Singularity
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10 + pulseRad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    containsPoint(p) {
        // Core absorption radius
        return dist(p, this) <= 15;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    spawn(x, y, color) {
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 80 + 30;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 1.5 + 1.2,
                color
            });
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= p.decay * dt;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowBlur = 5;
            ctx.shadowColor = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// --- Stage Database ---
const STAGES = [
    {
        name: "TUNING_01: REFLECTION",
        emitter: new Emitter(80, 150, 0), // points right
        prism: new Prism(520, 650, 20),
        blackholes: [],
        parMirrorLength: 200,
        hint: "斜めに銀の鏡を引いて、光を屈折させ右下の結晶へ導け"
    },
    {
        name: "TUNING_02: DOUBLE_ANGLE",
        emitter: new Emitter(80, 150, Math.PI * 0.25), // points down-right
        prism: new Prism(500, 150, 20),
        blackholes: [],
        parMirrorLength: 350,
        hint: "光を二段階反射させて、ターゲットへと紡ぎ戻せ"
    },
    {
        name: "TUNING_03: GRAVITY_WELL",
        emitter: new Emitter(80, 400, 0), // points right
        prism: new Prism(520, 400, 20),
        blackholes: [new BlackHole(300, 400, 75, 140)],
        parMirrorLength: 400,
        hint: "中心のブラックホールの超重力を避け、鏡線で光を迂回させよ"
    }
];

// --- Main Game Controller ---
class GameController {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        this.state = STATE.TITLE;
        this.currentStageIdx = 0;
        this.mirrors = [];
        this.emitter = null;
        this.prism = null;
        this.blackholes = [];
        
        // Drawing trace
        this.isDrawing = false;
        this.drawStart = { x: 0, y: 0 };
        this.drawEnd = { x: 0, y: 0 };
        this.inkLeft = CONFIG.MAX_INK;
        
        // Emit Animation Pulse
        this.photonBeam = [];
        this.emitProgress = 0;
        this.photonPosition = { x: 0, y: 0 };
        this.photonVelocity = { x: 0, y: 0 };
        this.photonPath = [];
        this.currentSegmentIdx = 0;
        this.segmentProgress = 0;
        
        this.particles = new ParticleSystem();
        
        // Touch offsets & speed tracking
        this.lastMousePos = { x: 0, y: 0 };
        this.mouseSpeed = 0;

        // Visual lasers cache
        this.laserCache = [];
        this.hasHitPrism = false;
        
        this.initCanvas();
        this.bindEvents();
        this.loadStage(0);
        
        // Game Loop
        this.lastTime = 0;
        requestAnimationFrame((t) => this.loop(t));
    }

    initCanvas() {
        this.canvas.width = CONFIG.WIDTH;
        this.canvas.height = CONFIG.HEIGHT;
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = document.getElementById('viewport');
        const aspect = CONFIG.WIDTH / CONFIG.HEIGHT;
        let w = container.clientWidth;
        let h = container.clientHeight;
        
        if (w / h > aspect) {
            w = h * aspect;
        } else {
            h = w / aspect;
        }
        
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
    }

    bindEvents() {
        const getLogicalPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            
            return {
                x: ((clientX - rect.left) / rect.width) * CONFIG.WIDTH,
                y: ((clientY - rect.top) / rect.height) * CONFIG.HEIGHT
            };
        };

        const handleDown = (e) => {
            if (this.state !== STATE.PLAYING) return;
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            
            const pos = getLogicalPos(e);
            
            // Check if clicked near an existing mirror to erase it
            const mirrorToEraseIdx = this.findMirrorAt(pos);
            if (mirrorToEraseIdx !== -1) {
                const erased = this.mirrors.splice(mirrorToEraseIdx, 1)[0];
                this.inkLeft = Math.min(CONFIG.MAX_INK, this.inkLeft + erased.length);
                this.updateHUD();
                audio.playCrystalClang(); // Cool crystal erase sound
                this.calculateLaserPath();
                return;
            }

            // Start drawing new mirror if we have ink
            if (this.inkLeft > 10) {
                this.isDrawing = true;
                this.drawStart = pos;
                this.drawEnd = pos;
                this.lastMousePos = pos;
                audio.startIceScratch();
            }
        };

        const handleMove = (e) => {
            if (this.state !== STATE.PLAYING) return;
            e.preventDefault();
            
            const pos = getLogicalPos(e);
            
            if (this.isDrawing) {
                // Limit maximum length of the mirror being drawn to remaining ink
                const d = dist(this.drawStart, pos);
                if (d <= this.inkLeft) {
                    this.drawEnd = pos;
                } else {
                    const ratio = this.inkLeft / d;
                    this.drawEnd = {
                        x: this.drawStart.x + (pos.x - this.drawStart.x) * ratio,
                        y: this.drawStart.y + (pos.y - this.drawStart.y) * ratio
                    };
                }

                // ASMR Speed pitch shifting
                const speed = dist(this.lastMousePos, pos) / 0.016; // px per sec roughly
                audio.updateIceScratch(speed);
                this.lastMousePos = pos;
                
                // Live preview laser calculation
                this.calculateLaserPath();
            }
        };

        const handleUp = (e) => {
            if (this.isDrawing) {
                this.isDrawing = false;
                audio.stopIceScratch();
                
                const newLength = dist(this.drawStart, this.drawEnd);
                if (newLength > 8) { // Minimum threshold to prevent tiny lines
                    this.mirrors.push(new Mirror(this.drawStart.x, this.drawStart.y, this.drawEnd.x, this.drawEnd.y));
                    this.inkLeft -= newLength;
                    this.updateHUD();
                    this.calculateLaserPath();
                }
            }
        };

        // Wire Buttons
        this.canvas.addEventListener('mousedown', handleDown);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);

        this.canvas.addEventListener('touchstart', handleDown, { passive: false });
        this.canvas.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp, { passive: false });

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('menu-back-btn').addEventListener('click', () => {
            window.location.href = '../minigames.html';
        });
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.href = '../minigames.html';
        });

        document.getElementById('emit-btn').addEventListener('click', () => this.emitPhoton());
        document.getElementById('reset-btn').addEventListener('click', () => this.resetStage());
        document.getElementById('next-btn').addEventListener('click', () => this.nextStage());
    }

    findMirrorAt(pos, threshold = 18) {
        for (let i = 0; i < this.mirrors.length; i++) {
            if (this.mirrors[i].distanceToPoint(pos) <= threshold) {
                return i;
            }
        }
        return -1;
    }

    loadStage(idx) {
        this.currentStageIdx = idx;
        const stage = STAGES[this.currentStageIdx];
        
        this.emitter = stage.emitter;
        this.prism = stage.prism;
        this.prism.isTuned = false;
        this.blackholes = stage.blackholes;
        this.mirrors = [];
        this.inkLeft = CONFIG.MAX_INK;
        this.hasHitPrism = false;
        
        this.updateHUD();
        this.calculateLaserPath();

        this.showToast(`STG_${idx + 1}: ${stage.name}`);
        this.showToast(stage.hint);
    }

    updateHUD() {
        document.getElementById('stage-name').innerText = `STG_0${this.currentStageIdx + 1}`;
        const inkPercent = (this.inkLeft / CONFIG.MAX_INK) * 100;
        document.getElementById('ink-bar').style.width = `${inkPercent}%`;
        document.getElementById('stability-value').innerText = `${inkPercent.toFixed(1)}%`;

        const emitBtn = document.getElementById('emit-btn');
        const resetBtn = document.getElementById('reset-btn');
        
        if (this.state === STATE.PLAYING) {
            emitBtn.disabled = false;
            resetBtn.disabled = this.mirrors.length === 0;
        } else {
            emitBtn.disabled = true;
            resetBtn.disabled = true;
        }
    }

    startGame() {
        audio.init();
        this.state = STATE.PLAYING;
        document.getElementById('start-screen').classList.add('hidden');
        this.loadStage(0);
    }

    resetStage() {
        if (this.state !== STATE.PLAYING) return;
        audio.playCrystalClang();
        this.loadStage(this.currentStageIdx);
    }

    nextStage() {
        document.getElementById('overlay').classList.add('hidden');
        this.state = STATE.PLAYING;
        
        if (this.currentStageIdx + 1 < STAGES.length) {
            this.loadStage(this.currentStageIdx + 1);
        } else {
            this.showToast("幾何学アーカイブをすべてクリアしました！");
            setTimeout(() => {
                window.location.href = '../minigames.html';
            }, 2000);
        }
    }

    showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        container.appendChild(toast);
        
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3200);
    }

    // --- Trace ray intersection with everything ---
    calculateLaserPath() {
        let rayStart = { x: this.emitter.x, y: this.emitter.y };
        let rayAngle = this.emitter.angle;
        
        this.laserCache = [rayStart];
        this.hasHitPrism = false;
        
        // Dynamic step limit to simulate gravity curves
        let activePoint = { ...rayStart };
        let activeVel = { x: Math.cos(rayAngle), y: Math.sin(rayAngle) };
        let stepCount = 0;
        const maxSteps = 1200; // Step count for Euler integration
        const stepSize = 1.2;

        let lastBouncedMirror = null;
        let checkDrawLine = this.isDrawing ? new Mirror(this.drawStart.x, this.drawStart.y, this.drawEnd.x, this.drawEnd.y) : null;

        while (stepCount < maxSteps) {
            let nextPoint = {
                x: activePoint.x + activeVel.x * stepSize,
                y: activePoint.y + activeVel.y * stepSize
            };

            // 1. Gravity pull calculation from Black Holes
            for (const bh of this.blackholes) {
                const d = dist(activePoint, bh);
                if (d < bh.pullRadius) {
                    if (bh.containsPoint(activePoint)) {
                        // Absorbed in gravity singularity
                        this.laserCache.push(activePoint);
                        return;
                    }
                    // Pull vector
                    const force = (bh.mass / (d * d)) * stepSize * 0.18;
                    const pullX = (bh.x - activePoint.x) / d;
                    const pullY = (bh.y - activePoint.y) / d;

                    activeVel.x += pullX * force;
                    activeVel.y += pullY * force;
                    
                    // Normalize velocity
                    const speed = Math.hypot(activeVel.x, activeVel.y);
                    activeVel.x /= speed;
                    activeVel.y /= speed;
                }
            }

            // 2. Out of bounds check
            if (nextPoint.x < 0 || nextPoint.x > CONFIG.WIDTH || nextPoint.y < 0 || nextPoint.y > CONFIG.HEIGHT) {
                this.laserCache.push(nextPoint);
                break;
            }

            // 3. Prism target check
            if (this.prism.containsPoint(nextPoint)) {
                this.laserCache.push(nextPoint);
                this.hasHitPrism = true;
                break;
            }

            // 4. Mirror collision checks (Raycast segment vs Segment)
            let collidedMirror = null;
            let hitInfo = null;

            // List of mirrors to test (including temporary mirror being drawn)
            const allMirrors = [...this.mirrors];
            if (checkDrawLine) allMirrors.push(checkDrawLine);

            for (const m of allMirrors) {
                if (m === lastBouncedMirror) continue;
                
                const hit = getIntersection(activePoint, nextPoint, m.p1, m.p2);
                if (hit) {
                    collidedMirror = m;
                    hitInfo = hit;
                    break;
                }
            }

            if (collidedMirror && hitInfo) {
                // Vector reflection calculation
                // Mirror vector
                const mx = collidedMirror.p2.x - collidedMirror.p1.x;
                const my = collidedMirror.p2.y - collidedMirror.p1.y;
                const mLen = collidedMirror.length;
                
                // Normal vector (unit)
                const nx = -my / mLen;
                const ny = mx / mLen;

                // Reflect ray velocity: R = V - 2(V . N)N
                const dotProduct = activeVel.x * nx + activeVel.y * ny;
                
                activeVel.x = activeVel.x - 2 * dotProduct * nx;
                activeVel.y = activeVel.y - 2 * dotProduct * ny;

                // Position correct slightly to avoid double collision
                activePoint = {
                    x: hitInfo.x + activeVel.x * 0.1,
                    y: hitInfo.y + activeVel.y * 0.1
                };

                this.laserCache.push(hitInfo);
                lastBouncedMirror = collidedMirror;
                
                if (this.laserCache.length > CONFIG.MAX_REFLECTIONS) break;
            } else {
                activePoint = nextPoint;
            }

            // Thinning preview segment caching (add point every 40 units of travel)
            if (stepCount % 35 === 0) {
                this.laserCache.push({ ...activePoint });
            }

            stepCount++;
        }

        // Add final point
        if (this.laserCache[this.laserCache.length - 1] !== activePoint) {
            this.laserCache.push(activePoint);
        }
    }

    // --- Action Button: Emit Pulse Animation ---
    emitPhoton() {
        if (this.state !== STATE.PLAYING) return;
        
        this.state = STATE.EMITTING;
        this.updateHUD();
        
        // Re-calculate final path and trigger animation
        this.calculateLaserPath();
        
        // Trace animation variables
        this.photonPath = [...this.laserCache];
        this.currentSegmentIdx = 0;
        this.segmentProgress = 0;
        this.photonPosition = { ...this.photonPath[0] };
        
        audio.playCrystalClang(); // Trigger emitter discharge
    }

    triggerClear() {
        this.state = STATE.CLEAR;
        this.prism.isTuned = true;
        this.particles.spawn(this.prism.x, this.prism.y, '#ff007f');
        audio.playClearChord();

        // Calculate stats
        const reflectCount = this.photonPath.length - 2; // Approximate count of reflections
        let rank = "S";
        const inkUsed = CONFIG.MAX_INK - this.inkLeft;
        const stage = STAGES[this.currentStageIdx];

        if (inkUsed > stage.parMirrorLength * 0.9) rank = "A";
        if (inkUsed > stage.parMirrorLength * 1.2) rank = "B";
        if (inkUsed > stage.parMirrorLength * 1.5) rank = "C";

        document.getElementById('stat-reflect').innerText = reflectCount >= 0 ? reflectCount : 0;
        document.getElementById('stat-rank').innerText = rank;

        setTimeout(() => {
            document.getElementById('overlay').classList.remove('hidden');
            this.updateHUD();
        }, 1200);
    }

    // --- Main Game Loop ---
    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        this.prism.update(dt);
        this.particles.update(dt);

        // Emit Photon pulse physics animation
        if (this.state === STATE.EMITTING) {
            if (this.currentSegmentIdx < this.photonPath.length - 1) {
                const p1 = this.photonPath[this.currentSegmentIdx];
                const p2 = this.photonPath[this.currentSegmentIdx + 1];
                const segLen = dist(p1, p2);
                
                // Time step based movement
                const segmentTime = segLen / CONFIG.LASER_SPEED;
                this.segmentProgress += dt / segmentTime;

                if (this.segmentProgress >= 1.0) {
                    this.photonPosition = { ...p2 };
                    this.currentSegmentIdx++;
                    this.segmentProgress = 0;

                    // Trigger sound & particle on hit
                    if (this.currentSegmentIdx < this.photonPath.length - 1) {
                        audio.playCrystalClang();
                        this.particles.spawn(p2.x, p2.y, '#00f3ff');
                    } else {
                        // Reached the end
                        if (this.hasHitPrism) {
                            this.triggerClear();
                        } else {
                            // Dissolve photon path
                            this.showToast("光は幾何学から外れ、深淵に消えた");
                            setTimeout(() => {
                                this.state = STATE.PLAYING;
                                this.calculateLaserPath();
                                this.updateHUD();
                            }, 1000);
                        }
                    }
                } else {
                    // Interpolate position
                    this.photonPosition.x = p1.x + (p2.x - p1.x) * this.segmentProgress;
                    this.photonPosition.y = p1.y + (p2.y - p1.y) * this.segmentProgress;
                }
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // 1. Draw Emitter, Prism, Black Holes
        this.emitter.draw(this.ctx);
        this.prism.draw(this.ctx);
        this.blackholes.forEach(bh => bh.draw(this.ctx));

        // 2. Draw active mirrors
        this.mirrors.forEach(m => m.draw(this.ctx, false));

        // 3. Draw mirror being currently drawn
        if (this.isDrawing) {
            ctxLine(this.ctx, this.drawStart, this.drawEnd, '#ffffff', 2, [5, 5]);
            // Draw end circle
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(this.drawEnd.x, this.drawEnd.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        }

        // 4. Draw Laser Path
        if (this.state === STATE.PLAYING) {
            // Thin static preview laser
            this.drawLaserPath(this.laserCache, 'rgba(0, 243, 255, 0.4)', 1.0, true);
        } else if (this.state === STATE.EMITTING) {
            // Emitting Photon Path
            const activeSegments = this.photonPath.slice(0, this.currentSegmentIdx + 1);
            if (this.segmentProgress > 0 && this.currentSegmentIdx < this.photonPath.length - 1) {
                activeSegments.push({ ...this.photonPosition });
            }
            this.drawLaserPath(activeSegments, '#00f3ff', 2.0, false);
            
            // Draw photon pulse particle
            this.ctx.save();
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#00f3ff';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(this.photonPosition.x, this.photonPosition.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        } else if (this.state === STATE.CLEAR) {
            // Brighter laser path when cleared
            this.drawLaserPath(this.photonPath, '#00f3ff', 3.0, false);
        }

        // 5. Particles
        this.particles.draw(this.ctx);
    }

    drawLaserPath(path, color, width, isDashed) {
        if (path.length < 2) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.shadowBlur = width > 1.5 ? 12 : 5;
        this.ctx.shadowColor = 'rgba(0, 243, 255, 0.8)';
        
        if (isDashed) {
            this.ctx.setLineDash([8, 12]);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        
        // Draw path with smooth curve nodes for gravity bends
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        
        this.ctx.stroke();
        this.ctx.restore();
    }
}

// --- Helper Functions ---
function ctxLine(ctx, p1, p2, color, width = 1, dash = []) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    if (dash.length > 0) ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
    ctx.restore();
}

// --- Initialize On Load ---
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
