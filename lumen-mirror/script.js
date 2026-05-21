/* ==========================================================================
   LUMEN_MIRROR - PERFECTED CORE ENGINE & AUDIO SYNTHESIZER
   ========================================================================== */

// --- Constants & Config ---
const CONFIG = {
    WIDTH: 600,
    HEIGHT: 800,
    MAX_REFLECTIONS: 12,
    LASER_SPEED: 1800, // px per second (faster & smoother)
    PARTICLE_COUNT: 30,
    MAX_INK: 450, // maximum ink length in px
};

const STATE = {
    TITLE: 0,
    PLAYING: 1,
    EMITTING: 2,
    CLEAR: 3,
};

// --- Web Audio API Synth (3D Stereo ASMR & Crystal Sound) ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.iceNoiseNode = null;
        this.iceGain = null;
        this.iceFilter = null;
        this.icePanner = null;
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

        // Generate 2 seconds of high quality white noise
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
        this.iceFilter = this.ctx.createBiquadFilter();
        this.iceFilter.type = 'bandpass';
        this.iceFilter.frequency.value = 3500; // high frequency scratch
        this.iceFilter.Q.value = 8.0;

        this.iceGain = this.ctx.createGain();
        this.iceGain.gain.value = 0; // starts silent

        // 3D Stereo Panning
        if (this.ctx.createStereoPanner) {
            this.icePanner = this.ctx.createStereoPanner();
            this.icePanner.pan.value = 0;

            noise.connect(this.iceFilter);
            this.iceFilter.connect(this.iceGain);
            this.iceGain.connect(this.icePanner);
            this.icePanner.connect(this.ctx.destination);
        } else {
            noise.connect(this.iceFilter);
            this.iceFilter.connect(this.iceGain);
            this.iceGain.connect(this.ctx.destination);
        }

        noise.start(0);
        this.iceNoiseNode = noise;
    }

    updatePan(x) {
        if (!this.ctx || !this.icePanner) return;
        // Map X coordinate (0 to 600) to Pan range (-1.0 to 1.0)
        const pan = Math.max(-1.0, Math.min(1.0, (x / 300) - 1.0));
        this.icePanner.pan.setValueAtTime(pan, this.ctx.currentTime);
    }

    startIceScratch(x) {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.updatePan(x);
        if (this.isPlayingIce) return;

        this.iceGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.iceGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.05);
        this.isPlayingIce = true;
    }

    updateIceScratch(speed, x) {
        if (!this.isPlayingIce) return;
        this.updatePan(x);

        // Organic 변調 - simulates uneven microscopic bumps on real ice
        const volume = Math.min(0.015 + (speed / 2500), 0.08);
        const baseFreq = Math.min(2000 + speed * 1.5, 4800);
        const organicNoise = Math.sin(Date.now() * 0.08) * 180; // minor speed noise
        const frequency = baseFreq + organicNoise;
        
        const qVal = Math.min(5.0 + (speed / 400), 12.0); // sharp metallic click speed

        this.iceGain.gain.setValueAtTime(volume, this.ctx.currentTime);
        this.iceFilter.frequency.setValueAtTime(frequency, this.ctx.currentTime);
        this.iceFilter.Q.setValueAtTime(qVal, this.ctx.currentTime);
    }

    stopIceScratch() {
        if (!this.isPlayingIce) return;
        this.iceGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.iceGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.08);
        this.isPlayingIce = false;
    }

    // Laser hit sound (Crystal glass clang: "カキィン" with 3D Stereo space)
    playCrystalClang(x) {
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

        gain.gain.setValueAtTime(0.20, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

        // Add subtle bandpass to emphasize crystal resonance
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1900;
        filter.Q.value = 5.0;

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(filter);

        if (this.ctx.createStereoPanner && x !== undefined) {
            const pan = Math.max(-1.0, Math.min(1.0, (x / 300) - 1.0));
            const panner = this.ctx.createStereoPanner();
            panner.pan.setValueAtTime(pan, now);
            filter.connect(panner);
            panner.connect(this.ctx.destination);
        } else {
            filter.connect(this.ctx.destination);
        }

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.5);
        osc2.stop(now + 0.5);
    }

    // Clear chord (Mystical major chord with stereo widening)
    playClearChord() {
        this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        
        // F Major 7th chord (F4, A4, C5, E5) - beautiful, mystical and open
        const frequencies = [349.23, 440.00, 523.25, 659.25];
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.20, now + 0.5); // soft attack
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8); // long decay

        frequencies.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle'; // rich soft tone
            osc.frequency.value = freq;
            
            if (this.ctx.createStereoPanner) {
                // Wide pan distribution for a divine sonic wrap
                const pan = (idx - 1.5) * 0.5; // -0.75, -0.25, 0.25, 0.75
                const panner = this.ctx.createStereoPanner();
                panner.pan.setValueAtTime(pan, now);
                osc.connect(panner);
                panner.connect(gain);
            } else {
                osc.connect(gain);
            }
            
            osc.start(now);
            osc.stop(now + 3.2);
        });

        // Soft filter to cut sharp frequencies dynamically
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(900, now);
        lp.frequency.exponentialRampToValueAtTime(350, now + 2.6);

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

    draw(ctx, isHovered) {
        ctx.save();
        ctx.lineWidth = isHovered ? 3.5 : 1.8;
        
        // Neon pulse effect
        const alpha = isHovered 
            ? 0.85 + Math.sin(Date.now() * 0.02) * 0.15 
            : 0.6 + Math.sin(Date.now() * 0.008 + this.length) * 0.2;
            
        ctx.shadowBlur = isHovered ? 14 : 6;
        ctx.shadowColor = isHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(192, 192, 216, 0.7)';
        ctx.strokeStyle = isHovered ? '#ffffff' : `rgba(192, 192, 216, ${alpha})`;
        
        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();
        
        // Draw cold metallic endpoints
        ctx.fillStyle = isHovered ? '#ffffff' : '#c0c0d8';
        ctx.shadowBlur = isHovered ? 8 : 3;
        ctx.beginPath();
        ctx.arc(this.p1.x, this.p1.y, isHovered ? 4.5 : 3, 0, Math.PI * 2);
        ctx.arc(this.p2.x, this.p2.y, isHovered ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Cybernetic bracket focus UI when hovered (very cool visual assistance)
        if (isHovered) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 0;
            this.drawCyberBrackets(ctx, this.p1);
            this.drawCyberBrackets(ctx, this.p2);
        }
        
        ctx.restore();
    }

    drawCyberBrackets(ctx, p) {
        const size = 10;
        ctx.beginPath();
        // Top-left bracket
        ctx.moveTo(p.x - size, p.y - size / 2);
        ctx.lineTo(p.x - size, p.y - size);
        ctx.lineTo(p.x - size / 2, p.y - size);
        // Top-right
        ctx.moveTo(p.x + size, p.y - size / 2);
        ctx.lineTo(p.x + size, p.y - size);
        ctx.lineTo(p.x + size / 2, p.y - size);
        // Bottom-left
        ctx.moveTo(p.x - size, p.y + size / 2);
        ctx.lineTo(p.x - size, p.y + size);
        ctx.lineTo(p.x - size / 2, p.y + size);
        // Bottom-right
        ctx.moveTo(p.x + size, p.y + size / 2);
        ctx.lineTo(p.x + size, p.y + size);
        ctx.lineTo(p.x + size / 2, p.y + size);
        ctx.stroke();
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
        ctx.shadowBlur = 18;
        ctx.shadowColor = 'rgba(0, 243, 255, 0.9)';
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2.0;
        
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.stroke();

        // Industrial crosshair ticks
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
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
        ctx.lineTo(4, -5);
        ctx.lineTo(4, 5);
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
        this.angle += (this.isTuned ? 4.5 : 0.75) * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Neon Prism Diamond
        ctx.shadowBlur = this.isTuned ? 30 : 12;
        ctx.shadowColor = this.isTuned ? 'rgba(255, 0, 127, 0.95)' : 'rgba(255, 0, 127, 0.45)';
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = this.isTuned ? 3.0 : 1.8;

        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.stroke();

        // Inner aesthetic geometry
        ctx.strokeStyle = this.isTuned ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 0, 127, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
        ctx.stroke();

        // Center nuclear glow
        ctx.fillStyle = this.isTuned ? '#ffffff' : 'rgba(255, 0, 127, 0.15)';
        ctx.beginPath();
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
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
        
        // Gravity pull field (Faint structural circles)
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.035)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.pullRadius, 0, Math.PI * 2);
        ctx.arc(this.x, this.y, this.pullRadius * 0.6, 0, Math.PI * 2);
        ctx.stroke();

        // Event Horizon Glow
        ctx.shadowBlur = 25;
        ctx.shadowColor = 'rgba(0, 243, 255, 0.3)';
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 25);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.5, '#020205');
        grad.addColorStop(0.8, 'rgba(0, 243, 255, 0.18)');
        grad.addColorStop(1, 'transparent');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 25, 0, Math.PI * 2);
        ctx.fill();

        // Absorb Core Singularity
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 10 + pulseRad, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    containsPoint(p) {
        // Core absorption radius
        return dist(p, this) <= 18;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    spawn(x, y, color) {
        for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 90 + 35;
            this.particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 1.6 + 1.2,
                color
            });
        }
    }

    spawnMirrorDissolve(m) {
        const step = 8;
        const count = Math.floor(m.length / step);
        
        for (let i = 0; i <= count; i++) {
            const ratio = i / count;
            const x = m.p1.x + (m.p2.x - m.p1.x) * ratio;
            const y = m.p1.y + (m.p2.y - m.p1.y) * ratio;
            
            for (let j = 0; j < 3; j++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 45 + 15;
                this.particles.push({
                    x,
                    y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 0.9,
                    decay: Math.random() * 1.5 + 1.0,
                    color: 'rgba(192, 192, 216, 0.85)' // structural metallic sparkles
                });
            }
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
            ctx.shadowBlur = 6;
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
        
        // Emit Animation Pulse variables
        this.photonPosition = { x: 0, y: 0 };
        this.currentSegmentIdx = 0;
        this.segmentProgress = 0;
        
        this.particles = new ParticleSystem();
        
        // Hover/Erase Assistance states (essential for flawless UX)
        this.hoveredMirrorIdx = -1;
        this.lastMousePos = { x: 0, y: 0 };
        this.mouseSpeed = 0;

        // Path Cache (Laser data)
        this.laserCache = [];       // Smooth high density points for smooth laser render/physics trace
        this.reflectionPoints = []; // Pure physics events (mirrors, blackholes, target hits)
        this.hasHitPrism = false;
        
        this.initCanvas();
        this.bindEvents();
        this.loadStage(0);
        
        // Game Loop
        this.lastTime = 0;
        requestAnimationFrame((t) => this.loop(t));
    }

    initCanvas() {
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
        
        // 1. Maintain logical display layout size (CSS style pixels)
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;

        // 2. High-DPI physical backing store calibration (Zero blur neon)
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CONFIG.WIDTH * dpr;
        this.canvas.height = CONFIG.HEIGHT * dpr;

        // 3. Keep drawing operations mapped to 600x800 logical canvas size
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
            
            // UX check: Erase mirror on click if close enough (extended 30px threshold for mobile finger comfort)
            const mirrorToEraseIdx = this.findMirrorAt(pos, 30);
            if (mirrorToEraseIdx !== -1) {
                const erased = this.mirrors.splice(mirrorToEraseIdx, 1)[0];
                this.inkLeft = Math.min(CONFIG.MAX_INK, this.inkLeft + erased.length);
                this.updateHUD();
                
                // Play stereophonic sound on erase
                audio.playCrystalClang(pos.x);
                this.particles.spawnMirrorDissolve(erased);
                
                this.hoveredMirrorIdx = -1;
                this.calculateLaserPath();
                return;
            }

            // Start drawing new mirror if we have remaining ink capacity
            if (this.inkLeft > 10) {
                this.isDrawing = true;
                this.drawStart = pos;
                this.drawEnd = pos;
                this.lastMousePos = pos;
                audio.startIceScratch(pos.x);
            }
        };

        const handleMove = (e) => {
            if (this.state !== STATE.PLAYING) return;
            e.preventDefault();
            
            const pos = getLogicalPos(e);
            
            if (this.isDrawing) {
                // Limit maximum length of the mirror being drawn to remaining ink capacity
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

                // Cybernetic stereo ASMR speed pitch modulation
                const speed = dist(this.lastMousePos, pos) / 0.016; // px per sec
                audio.updateIceScratch(speed, pos.x);
                this.lastMousePos = pos;
                
                this.calculateLaserPath();
            } else {
                // Standard Hover check to aid visual erasing
                this.hoveredMirrorIdx = this.findMirrorAt(pos, 30);
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

        // Wire canvas operations
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

    findMirrorAt(pos, threshold = 22) {
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
        this.hoveredMirrorIdx = -1;
        
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
        audio.playCrystalClang(300); // sound center
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

    // --- Trace ray intersection with everything (Aesthetic & Physics Separation) ---
    calculateLaserPath() {
        let rayStart = { x: this.emitter.x, y: this.emitter.y };
        let rayAngle = this.emitter.angle;
        
        this.laserCache = [{ ...rayStart }];
        this.reflectionPoints = []; // Capture true reflection spots for precise scores/sounds
        this.hasHitPrism = false;
        
        let activePoint = { ...rayStart };
        let activeVel = { x: Math.cos(rayAngle), y: Math.sin(rayAngle) };
        let stepCount = 0;
        const maxSteps = 1400; // Continuous step count
        const stepSize = 1.3;

        let lastBouncedMirror = null;
        let checkDrawLine = this.isDrawing ? new Mirror(this.drawStart.x, this.drawStart.y, this.drawEnd.x, this.drawEnd.y) : null;

        while (stepCount < maxSteps) {
            let nextPoint = {
                x: activePoint.x + activeVel.x * stepSize,
                y: activePoint.y + activeVel.y * stepSize
            };

            // 1. Gravity pull calculation from Black Holes (Fluid integrations)
            for (const bh of this.blackholes) {
                const d = dist(activePoint, bh);
                if (d < bh.pullRadius) {
                    if (bh.containsPoint(activePoint)) {
                        // Absorbed in gravity singularity: GLORIOUS SPIRAL CURVATURE PATHWAY
                        const spiralSteps = 45;
                        let rDist = d;
                        let angle = Math.atan2(activePoint.y - bh.y, activePoint.x - bh.x);
                        
                        for (let j = 0; j < spiralSteps; j++) {
                            const ratio = (spiralSteps - j) / spiralSteps;
                            const r = rDist * ratio;
                            angle += 0.22; // smooth winding spiral rotation
                            this.laserCache.push({
                                x: bh.x + Math.cos(angle) * r,
                                y: bh.y + Math.sin(angle) * r
                            });
                        }
                        
                        // Push spatial absorption event
                        this.reflectionPoints.push({ x: activePoint.x, y: activePoint.y, type: 'blackhole' });
                        return;
                    }
                    
                    // Normal gravity calculation
                    const force = (bh.mass / (d * d)) * stepSize * 0.18;
                    const pullX = (bh.x - activePoint.x) / d;
                    const pullY = (bh.y - activePoint.y) / d;

                    activeVel.x += pullX * force;
                    activeVel.y += pullY * force;
                    
                    // Normalize velocity vector
                    const speed = Math.hypot(activeVel.x, activeVel.y);
                    activeVel.x /= speed;
                    activeVel.y /= speed;
                }
            }

            // 2. Out of bounds check
            if (nextPoint.x < -10 || nextPoint.x > CONFIG.WIDTH + 10 || nextPoint.y < -10 || nextPoint.y > CONFIG.HEIGHT + 10) {
                this.laserCache.push(nextPoint);
                break;
            }

            // 3. Prism target check
            if (this.prism.containsPoint(nextPoint)) {
                this.laserCache.push(nextPoint);
                this.hasHitPrism = true;
                this.reflectionPoints.push({ x: nextPoint.x, y: nextPoint.y, type: 'prism' });
                break;
            }

            // 4. Mirror collision checks
            let collidedMirror = null;
            let hitInfo = null;

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
                const mx = collidedMirror.p2.x - collidedMirror.p1.x;
                const my = collidedMirror.p2.y - collidedMirror.p1.y;
                const mLen = collidedMirror.length;
                
                const nx = -my / mLen;
                const ny = mx / mLen;

                const dotProduct = activeVel.x * nx + activeVel.y * ny;
                
                activeVel.x = activeVel.x - 2 * dotProduct * nx;
                activeVel.y = activeVel.y - 2 * dotProduct * ny;

                // Position correct expanded to 1.5px to guarantee complete safety against infinite rounding bugs
                activePoint = {
                    x: hitInfo.x + activeVel.x * 1.5,
                    y: hitInfo.y + activeVel.y * 1.5
                };

                this.laserCache.push(hitInfo);
                this.reflectionPoints.push({ x: hitInfo.x, y: hitInfo.y, type: 'mirror' });
                lastBouncedMirror = collidedMirror;
                
                if (this.reflectionPoints.filter(p => p.type === 'mirror').length > CONFIG.MAX_REFLECTIONS) break;
            } else {
                activePoint = nextPoint;
            }

            // Cache EVERY physics step in high-resolution (avoids wobbly speeds or animation steps)
            this.laserCache.push({ ...activePoint });
            stepCount++;
        }
    }

    // --- Action Button: Emit Pulse Animation ---
    emitPhoton() {
        if (this.state !== STATE.PLAYING) return;
        
        this.state = STATE.EMITTING;
        this.updateHUD();
        
        this.calculateLaserPath();
        
        this.currentSegmentIdx = 0;
        this.segmentProgress = 0;
        this.photonPosition = { ...this.laserCache[0] };
        
        audio.playCrystalClang(this.emitter.x); // discharge sound (spatialized)
    }

    triggerClear() {
        this.state = STATE.CLEAR;
        this.prism.isTuned = true;
        this.particles.spawn(this.prism.x, this.prism.y, '#ff007f');
        audio.playClearChord();

        // Calculate precise mirror reflections
        const reflectCount = this.reflectionPoints.filter(p => p.type === 'mirror').length;
        let rank = "S";
        const inkUsed = CONFIG.MAX_INK - this.inkLeft;
        const stage = STAGES[this.currentStageIdx];

        if (inkUsed > stage.parMirrorLength * 0.9) rank = "A";
        if (inkUsed > stage.parMirrorLength * 1.2) rank = "B";
        if (inkUsed > stage.parMirrorLength * 1.5) rank = "C";

        document.getElementById('stat-reflect').innerText = reflectCount;
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

        // Fluid Emission interpolation directly matching high-density cache (No speed variations)
        if (this.state === STATE.EMITTING) {
            if (this.currentSegmentIdx < this.laserCache.length - 1) {
                const p1 = this.laserCache[this.currentSegmentIdx];
                const p2 = this.laserCache[this.currentSegmentIdx + 1];
                const segLen = dist(p1, p2);
                
                const segmentTime = segLen / CONFIG.LASER_SPEED;
                // Safe boundary check
                this.segmentProgress += (segmentTime > 0) ? (dt / segmentTime) : 1.0;

                if (this.segmentProgress >= 1.0) {
                    this.photonPosition = { ...p2 };
                    this.currentSegmentIdx++;
                    this.segmentProgress = 0;

                    // Play spatialized reflection beep or handle absorption/clear trigger events
                    const nextPoint = this.laserCache[this.currentSegmentIdx];
                    
                    // Look ahead if it hits an event point
                    const matchedEvent = this.reflectionPoints.find(rp => dist(rp, nextPoint) < 2.0);
                    
                    if (matchedEvent) {
                        if (matchedEvent.type === 'mirror') {
                            audio.playCrystalClang(nextPoint.x);
                            this.particles.spawn(nextPoint.x, nextPoint.y, '#00f3ff');
                        } else if (matchedEvent.type === 'prism' && this.hasHitPrism) {
                            this.triggerClear();
                        } else if (matchedEvent.type === 'blackhole') {
                            // Absorption event
                            this.particles.spawn(nextPoint.x, nextPoint.y, '#00f3ff');
                            this.showToast("光は幾何学から外れ、深淵に消えた");
                            setTimeout(() => {
                                this.state = STATE.PLAYING;
                                this.calculateLaserPath();
                                this.updateHUD();
                            }, 1000);
                        }
                    }
                } else {
                    this.photonPosition.x = p1.x + (p2.x - p1.x) * this.segmentProgress;
                    this.photonPosition.y = p1.y + (p2.y - p1.y) * this.segmentProgress;
                }
            } else {
                // Reached absolute termination point without hitting target
                if (!this.hasHitPrism) {
                    this.showToast("光は幾何学から外れ、深淵に消えた");
                    setTimeout(() => {
                        this.state = STATE.PLAYING;
                        this.calculateLaserPath();
                        this.updateHUD();
                    }, 1000);
                }
            }
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);

        // 1. Draw structural items
        this.emitter.draw(this.ctx);
        this.prism.draw(this.ctx);
        this.blackholes.forEach(bh => bh.draw(this.ctx));

        // 2. Draw placed mirrors
        for (let i = 0; i < this.mirrors.length; i++) {
            this.mirrors[i].draw(this.ctx, i === this.hoveredMirrorIdx);
        }

        // 3. Draw active drawing session line (GLORIOUS CYBER TUNING DRAW SYSTEM)
        if (this.isDrawing) {
            this.drawTuningDrawingLine();
        }

        // 4. Draw Laser Path
        if (this.state === STATE.PLAYING) {
            // Elegant glowing preview trail
            this.drawLaserPath(this.laserCache, 'rgba(0, 243, 255, 0.45)', 1.2, true);
        } else if (this.state === STATE.EMITTING) {
            const activeSegments = this.laserCache.slice(0, this.currentSegmentIdx + 1);
            if (this.segmentProgress > 0 && this.currentSegmentIdx < this.laserCache.length - 1) {
                activeSegments.push({ ...this.photonPosition });
            }
            this.drawLaserPath(activeSegments, '#00f3ff', 2.2, false);
            
            // Draw photon core particle
            this.ctx.save();
            this.ctx.shadowBlur = 18;
            this.ctx.shadowColor = '#00f3ff';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath();
            this.ctx.arc(this.photonPosition.x, this.photonPosition.y, 4.5, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        } else if (this.state === STATE.CLEAR) {
            // Amplified laser shine on stage success
            this.drawLaserPath(this.laserCache, '#00f3ff', 3.2, false);
        }

        // 5. Draw Particle systems
        this.particles.draw(this.ctx);
    }

    drawTuningDrawingLine() {
        const p1 = this.drawStart;
        const p2 = this.drawEnd;
        const length = dist(p1, p2);
        const angleDeg = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI).toFixed(1);

        this.ctx.save();
        
        // 1. Neon glowing preview bridge
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 2.0;
        this.ctx.setLineDash([6, 6]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
        
        // 2. High-precision reticles (military cyber scopes)
        this.ctx.setLineDash([]);
        this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)';
        this.ctx.fillStyle = 'rgba(0, 243, 255, 0.9)';
        this.ctx.lineWidth = 1;
        
        const drawCross = (p) => {
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.beginPath();
            this.ctx.moveTo(p.x - 12, p.y); this.ctx.lineTo(p.x + 12, p.y);
            this.ctx.moveTo(p.x, p.y - 12); this.ctx.lineTo(p.x, p.y + 12);
            this.ctx.stroke();
        };

        drawCross(p1);
        drawCross(p2);

        // 3. Coordinate HUD readings printed directly to the screen (Extremely high detailed aesthetic)
        this.ctx.fillStyle = 'rgba(0, 243, 255, 0.7)';
        this.ctx.font = "10px 'Inter', monospace";
        this.ctx.fillText(`X:${p1.x.toFixed(0)} Y:${p1.y.toFixed(0)}`, p1.x + 15, p1.y - 8);
        this.ctx.fillText(`LEN:${length.toFixed(0)}px ANG:${angleDeg}°`, p2.x + 15, p2.y - 8);

        this.ctx.restore();
    }

    drawLaserPath(path, color, width, isDashed) {
        if (path.length < 2) return;
        
        this.ctx.save();
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.shadowBlur = width > 1.5 ? 15 : 6;
        this.ctx.shadowColor = 'rgba(0, 243, 255, 0.8)';
        
        if (isDashed) {
            this.ctx.setLineDash([8, 12]);
        }

        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);
        
        // Fluid continuous trail rendering (smooth as glass)
        for (let i = 1; i < path.length; i++) {
            this.ctx.lineTo(path[i].x, path[i].y);
        }
        
        this.ctx.stroke();
        this.ctx.restore();
    }
}

// --- Initialize On Load ---
window.addEventListener('DOMContentLoaded', () => {
    new GameController();
});
