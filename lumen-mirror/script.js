/* ==========================================================================
   LUMEN_MIRROR - MAXIMUM QUALITY ENGINE v2.0
   ========================================================================== */

// --- Constants & Config ---
const CONFIG = {
    WIDTH: 600,
    HEIGHT: 800,
    MAX_REFLECTIONS: 14,
    LASER_SPEED: 720,   // adjusted to 1/4 of 2880 for elegant, highly visible tracking
    PARTICLE_COUNT: 30,
    
    // Physical & UI Thresholds (Refactored)
    ERASE_THRESHOLD_DRAW: 30,
    ERASE_THRESHOLD_IDLE: 30,
    ERASE_THRESHOLD_DEFAULT: 22,
    MIN_DRAW_LENGTH: 8,
    MIN_INK_DRAW: 10,
    
    // Animation Durations
    CHAIN_FLASH_INTERVAL: 0.12,
    CHAIN_FLASH_DURATION: 0.5,
    CLEAR_OVERLAY_DELAY: 1400,
    PORTAL_COOLDOWN_STEPS: 15,
    MAX_SUBSTEPS: 5000,
};

const STATE = {
    TITLE: 0,
    STAGE_SELECT: 1,
    PLAYING: 2,
    EMITTING: 3,
    CLEAR: 4,
    EDITING: 5,
    EDIT_PLAYING: 6,
    EDIT_CLEAR: 7
};

// ============================================================
// SCORE MANAGER (localStorage persistence)
// ============================================================
const RANK_ORDER = ['S', 'A', 'B', 'C'];

class ScoreManager {
    constructor() {
        this.KEY = 'lumen_mirror_scores_v2';
        this.data = this._load();
    }

    _load() {
        try {
            const raw = localStorage.getItem(this.KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    _save() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(this.data));
        } catch (e) { /* storage unavailable */ }
    }

    getBest(stageIdx) {
        return this.data[stageIdx] || null;
    }

    // Returns true if this is a new best rank
    update(stageIdx, rank, reflectCount) {
        const current = this.data[stageIdx];
        let isNewBest = false;

        if (!current) {
            isNewBest = true;
        } else {
            const curRankIdx = RANK_ORDER.indexOf(current.rank);
            const newRankIdx = RANK_ORDER.indexOf(rank);
            if (newRankIdx < curRankIdx) isNewBest = true;
            else if (newRankIdx === curRankIdx && reflectCount < current.reflectCount) isNewBest = true;
        }

        if (isNewBest) {
            this.data[stageIdx] = { rank, reflectCount };
            this._save();
        }
        return isNewBest;
    }

    isUnlocked(stageIdx) {
        if (stageIdx === 0) return true;
        return this.data[stageIdx - 1] != null;
    }
}

const scoreManager = new ScoreManager();

// ============================================================
// WEB AUDIO API SYNTH
// ============================================================
class AudioManager {
    constructor() {
        this.ctx = null;
        this.iceGain = null;
        this.iceFilter = null;
        this.icePanner = null;
        this.isPlayingIce = false;
    }

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._setupIceSynth();
    }

    _setupIceSynth() {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        this.iceFilter = this.ctx.createBiquadFilter();
        this.iceFilter.type = 'bandpass';
        this.iceFilter.frequency.value = 3500;
        this.iceFilter.Q.value = 8.0;

        this.iceGain = this.ctx.createGain();
        this.iceGain.gain.value = 0;

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
    }

    _resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
    _pan(x) {
        if (!this.ctx || !this.icePanner) return;
        const pan = Math.max(-1, Math.min(1, (x / 300) - 1));
        this.icePanner.pan.setValueAtTime(pan, this.ctx.currentTime);
    }

    startIceScratch(x) {
        this.init(); this._resume(); this._pan(x);
        if (this.isPlayingIce) return;
        this.iceGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.iceGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.05);
        this.isPlayingIce = true;
    }

    updateIceScratch(speed, x) {
        if (!this.isPlayingIce || !this.ctx) return;
        this._pan(x);
        const vol = Math.min(0.015 + speed / 2500, 0.08);
        const freq = Math.min(2000 + speed * 1.5, 4800) + Math.sin(Date.now() * 0.08) * 180;
        const q = Math.min(5 + speed / 400, 12);
        this.iceGain.gain.setValueAtTime(vol, this.ctx.currentTime);
        this.iceFilter.frequency.setValueAtTime(freq, this.ctx.currentTime);
        this.iceFilter.Q.setValueAtTime(q, this.ctx.currentTime);
    }

    stopIceScratch() {
        if (!this.isPlayingIce || !this.ctx) return;
        this.iceGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.iceGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.08);
        this.isPlayingIce = false;
    }

    playCrystalClang(x) {
        this.init(); this._resume();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc1.type = 'sine'; osc1.frequency.setValueAtTime(1800, now); osc1.frequency.exponentialRampToValueAtTime(1500, now + 0.35);
        osc2.type = 'sine'; osc2.frequency.setValueAtTime(2600, now); osc2.frequency.exponentialRampToValueAtTime(2400, now + 0.15);
        gain.gain.setValueAtTime(0.20, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = 1900; filter.Q.value = 5.0;
        osc1.connect(gain); osc2.connect(gain); gain.connect(filter);
        if (this.ctx.createStereoPanner && x !== undefined) {
            const pan = Math.max(-1, Math.min(1, (x / 300) - 1));
            const panner = this.ctx.createStereoPanner();
            panner.pan.setValueAtTime(pan, now);
            filter.connect(panner); panner.connect(this.ctx.destination);
        } else { filter.connect(this.ctx.destination); }
        osc1.start(now); osc2.start(now); osc1.stop(now + 0.5); osc2.stop(now + 0.5);
    }

    playPortalWarp(xIn, xOut) {
        this.init(); this._resume();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1500, now);
        osc.frequency.exponentialRampToValueAtTime(320, now + 0.10);
        osc.frequency.exponentialRampToValueAtTime(2000, now + 0.25);
        gain.gain.setValueAtTime(0.15, now); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'peaking'; filter.frequency.value = 1100; filter.Q.value = 6.0;
        osc.connect(gain); gain.connect(filter);
        if (this.ctx.createStereoPanner) {
            const panIn = Math.max(-1, Math.min(1, (xIn / 300) - 1));
            const panOut = Math.max(-1, Math.min(1, (xOut / 300) - 1));
            const panner = this.ctx.createStereoPanner();
            panner.pan.setValueAtTime(panIn, now); panner.pan.linearRampToValueAtTime(panOut, now + 0.25);
            filter.connect(panner); panner.connect(this.ctx.destination);
        } else { filter.connect(this.ctx.destination); }
        osc.start(now); osc.stop(now + 0.3);
    }

    playClearChord() {
        this.init(); this._resume();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const freqs = [349.23, 440.00, 523.25, 659.25];
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.20, now + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
        freqs.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            osc.type = 'triangle'; osc.frequency.value = freq;
            if (this.ctx.createStereoPanner) {
                const pan = (idx - 1.5) * 0.5;
                const panner = this.ctx.createStereoPanner();
                panner.pan.setValueAtTime(pan, now);
                osc.connect(panner); panner.connect(gain);
            } else { osc.connect(gain); }
            osc.start(now); osc.stop(now + 3.2);
        });
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, now); lp.frequency.exponentialRampToValueAtTime(350, now + 2.6);
        gain.connect(lp); lp.connect(this.ctx.destination);
    }
}

const audio = new AudioManager();

// ============================================================
// MATH HELPERS
// ============================================================
function dist(p1, p2) { return Math.hypot(p2.x - p1.x, p2.y - p1.y); }

function getIntersection(p1, p2, p3, p4) {
    const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
    if (Math.abs(denom) < 1e-8) return null;
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;
    if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
        return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y), ua, ub };
    }
    return null;
}

// ============================================================
// ENTITY CLASSES
// ============================================================
class Mirror {
    constructor(x1, y1, x2, y2) {
        this.p1 = { x: x1, y: y1 };
        this.p2 = { x: x2, y: y2 };
        this.length = dist(this.p1, this.p2);
        this.flashTimer = 0; // for chain flash on clear
    }

    draw(ctx, isHovered) {
        ctx.save();
        const flashAlpha = this.flashTimer > 0 ? Math.min(1, this.flashTimer * 3) : 0;
        const baseAlpha = 0.6 + Math.sin(Date.now() * 0.008 + this.length) * 0.2;

        ctx.lineWidth = isHovered ? 3.5 : (flashAlpha > 0 ? 2.5 : 1.8);
        ctx.shadowBlur = isHovered ? 14 : (flashAlpha > 0 ? 20 : 6);
        ctx.shadowColor = flashAlpha > 0
            ? `rgba(255, 255, 255, ${flashAlpha})`
            : isHovered ? 'rgba(255, 255, 255, 0.95)' : 'rgba(192, 192, 216, 0.7)';
        ctx.strokeStyle = flashAlpha > 0
            ? `rgba(255, 255, 255, ${0.6 + flashAlpha * 0.4})`
            : isHovered ? '#ffffff' : `rgba(192, 192, 216, ${baseAlpha})`;

        ctx.beginPath();
        ctx.moveTo(this.p1.x, this.p1.y);
        ctx.lineTo(this.p2.x, this.p2.y);
        ctx.stroke();

        ctx.fillStyle = flashAlpha > 0 ? '#ffffff' : (isHovered ? '#ffffff' : '#c0c0d8');
        ctx.shadowBlur = isHovered ? 8 : 3;
        ctx.beginPath();
        ctx.arc(this.p1.x, this.p1.y, isHovered ? 4.5 : 3, 0, Math.PI * 2);
        ctx.arc(this.p2.x, this.p2.y, isHovered ? 4.5 : 3, 0, Math.PI * 2);
        ctx.fill();

        if (isHovered) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.lineWidth = 1; ctx.shadowBlur = 0;
            this._drawBrackets(ctx, this.p1);
            this._drawBrackets(ctx, this.p2);
        }
        ctx.restore();
    }

    _drawBrackets(ctx, p) {
        const s = 10;
        ctx.beginPath();
        ctx.moveTo(p.x - s, p.y - s/2); ctx.lineTo(p.x - s, p.y - s); ctx.lineTo(p.x - s/2, p.y - s);
        ctx.moveTo(p.x + s, p.y - s/2); ctx.lineTo(p.x + s, p.y - s); ctx.lineTo(p.x + s/2, p.y - s);
        ctx.moveTo(p.x - s, p.y + s/2); ctx.lineTo(p.x - s, p.y + s); ctx.lineTo(p.x - s/2, p.y + s);
        ctx.moveTo(p.x + s, p.y + s/2); ctx.lineTo(p.x + s, p.y + s); ctx.lineTo(p.x + s/2, p.y + s);
        ctx.stroke();
    }

    distanceToPoint(p) {
        const l2 = this.length * this.length;
        if (l2 === 0) return dist(p, this.p1);
        let t = ((p.x - this.p1.x) * (this.p2.x - this.p1.x) + (p.y - this.p1.y) * (this.p2.y - this.p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return dist(p, { x: this.p1.x + t * (this.p2.x - this.p1.x), y: this.p1.y + t * (this.p2.y - this.p1.y) });
    }
}

class Emitter {
    constructor(x, y, angle) { this.x = x; this.y = y; this.angle = angle; }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = 18; ctx.shadowColor = 'rgba(0, 243, 255, 0.9)';
        ctx.strokeStyle = '#00f3ff'; ctx.lineWidth = 2.0;
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0, 243, 255, 0.5)';
        ctx.beginPath();
        ctx.moveTo(-20, 0); ctx.lineTo(-14, 0);
        ctx.moveTo(14, 0); ctx.lineTo(20, 0);
        ctx.moveTo(0, -20); ctx.lineTo(0, -14);
        ctx.moveTo(0, 14); ctx.lineTo(0, 20);
        ctx.stroke();
        ctx.fillStyle = '#00f3ff';
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(4, -5); ctx.lineTo(4, 5); ctx.fill();
        ctx.restore();
    }
}

class Prism {
    constructor(x, y, radius = 20, targetColor = null) {
        this.x = x; this.y = y; this.radius = radius;
        this.angle = 0; this.isTuned = false;
        this.clearRipples = []; // radial ripple animation on clear
        this.targetColor = targetColor; // null, or hex e.g., '#ff003c'
    }

    update(dt) {
        this.angle += (this.isTuned ? 4.5 : 0.75) * dt;
        // Update clear ripples
        for (let i = this.clearRipples.length - 1; i >= 0; i--) {
            this.clearRipples[i].r += 160 * dt;
            this.clearRipples[i].alpha -= 1.6 * dt;
            if (this.clearRipples[i].alpha <= 0) this.clearRipples.splice(i, 1);
        }
    }

    spawnClearRipple() {
        for (let i = 0; i < 4; i++) {
            this.clearRipples.push({ r: this.radius, alpha: 0.9 - i * 0.15, delay: i * 0.08 });
        }
    }

    draw(ctx) {
        const baseColor = this.targetColor || '#ff007f';
        const glowColor = this.targetColor ? (this.targetColor + 'aa') : 'rgba(255, 0, 127, 0.45)';

        // Draw ripples first (behind the prism)
        for (const rp of this.clearRipples) {
            if (rp.alpha <= 0) continue;
            ctx.save();
            ctx.strokeStyle = this.targetColor || `rgba(0, 243, 255, ${rp.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = this.targetColor || 'rgba(0, 243, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, rp.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = this.isTuned ? 35 : 12;
        ctx.shadowColor = this.isTuned ? 'rgba(255, 255, 255, 0.95)' : glowColor;
        ctx.strokeStyle = this.isTuned ? '#ffffff' : baseColor;
        ctx.lineWidth = this.isTuned ? 3.0 : 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius); ctx.lineTo(-this.radius, 0);
        ctx.closePath(); ctx.stroke();
        
        ctx.strokeStyle = this.isTuned ? 'rgba(255, 255, 255, 0.9)' : (this.targetColor ? (this.targetColor + '44') : 'rgba(255, 0, 127, 0.25)');
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = this.isTuned ? '#ffffff' : (this.targetColor ? (this.targetColor + '22') : 'rgba(255, 0, 127, 0.15)');
        ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }

    containsPoint(p) { return dist(p, this) <= this.radius; }
}

class BlackHole {
    constructor(x, y, mass = 60, pullRadius = 150) {
        this.x = x; this.y = y; this.mass = mass; this.pullRadius = pullRadius;
        this.pulse = 0; this.warpAngle = 0;
    }

    draw(ctx) {
        this.pulse += 0.05; this.warpAngle += 0.012;
        const pulseRad = 3 + Math.sin(this.pulse) * 1.5;

        ctx.save();

        // Gravity field visualization: visible swirling gradient rings
        const numRings = 4;
        for (let i = 0; i < numRings; i++) {
            const ratio = (i + 1) / numRings;
            const r = this.pullRadius * ratio;
            const alpha = 0.04 + (1 - ratio) * 0.06;

            // Draw rotated ellipse (warp distortion illusion)
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.warpAngle + (i * Math.PI / numRings));
            ctx.scale(1, 0.7 - ratio * 0.2);
            ctx.strokeStyle = `rgba(0, 243, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // CAUTION label
        ctx.save();
        ctx.fillStyle = 'rgba(0, 243, 255, 0.22)';
        ctx.font = "8px 'Inter', monospace";
        ctx.textAlign = 'center';
        ctx.fillText("⚠ GRAVITY FIELD", this.x, this.y - this.pullRadius - 6);
        ctx.restore();

        // Event Horizon Glow
        ctx.shadowBlur = 25; ctx.shadowColor = 'rgba(0, 243, 255, 0.3)';
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 25);
        grad.addColorStop(0, '#000000');
        grad.addColorStop(0.5, '#020205');
        grad.addColorStop(0.8, 'rgba(0, 243, 255, 0.18)');
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(this.x, this.y, 25, 0, Math.PI * 2); ctx.fill();

        // Core Singularity
        ctx.shadowBlur = 0; ctx.fillStyle = '#000000';
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.7)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(this.x, this.y, 10 + pulseRad, 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();

        ctx.restore();
    }

    containsPoint(p) { return dist(p, this) <= 18; }
}

class Wormhole {
    constructor(inX, inY, outX, outY, radius = 16) {
        this.inPort = { x: inX, y: inY };
        this.outPort = { x: outX, y: outY };
        this.radius = radius; this.pulse = 0;
    }

    update(dt) { this.pulse += 2.0 * dt; }

    draw(ctx) {
        ctx.save();
        const drawRing = (p, color, glow, phaseOffset) => {
            const radVar = this.radius + Math.sin(this.pulse + phaseOffset) * 2;
            ctx.shadowBlur = 15; ctx.shadowColor = glow;
            ctx.strokeStyle = color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(p.x, p.y, radVar, 0, Math.PI * 2); ctx.stroke();
            ctx.lineWidth = 0.8; ctx.strokeStyle = 'rgba(255,255,255,0.12)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.arc(p.x, p.y, radVar * 0.65, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#ffffff'; ctx.shadowBlur = 5; ctx.shadowColor = '#ffffff';
            const angle = this.pulse * 0.5 + phaseOffset;
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(angle) * radVar * 0.45, p.y + Math.sin(angle) * radVar * 0.45, 2.5, 0, Math.PI * 2);
            ctx.fill();
        };
        drawRing(this.inPort, '#00bfff', 'rgba(0, 191, 255, 0.55)', 0);
        drawRing(this.outPort, '#ff8c00', 'rgba(255, 140, 0, 0.55)', Math.PI);
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00bfff'; ctx.font = "8px 'Inter', monospace"; ctx.textAlign = 'center';
        ctx.fillText("PORT_IN", this.inPort.x, this.inPort.y - this.radius - 7);
        ctx.fillStyle = '#ff8c00';
        ctx.fillText("PORT_OUT", this.outPort.x, this.outPort.y - this.radius - 7);
        ctx.restore();
    }

    containsEntrance(p) { return dist(p, this.inPort) <= this.radius; }
}

class Block {
    constructor(x, y, radius = 18, moveOptions = null) {
        this.x = x;
        this.y = y;
        this.startX = x;
        this.startY = y;
        this.radius = radius;
        this.angle = 0;
        this.moveOptions = moveOptions; // { targetX, targetY, speed }
        this.progress = 0;
        this.direction = 1;
    }

    update(dt) {
        this.angle += 1.2 * dt;
        
        if (this.moveOptions) {
            const { targetX, targetY, speed } = this.moveOptions;
            const totalDist = Math.hypot(targetX - this.startX, targetY - this.startY);
            if (totalDist > 0) {
                const step = (speed / totalDist) * dt;
                this.progress += step * this.direction;
                if (this.progress >= 1.0) {
                    this.progress = 1.0;
                    this.direction = -1;
                } else if (this.progress <= 0.0) {
                    this.progress = 0.0;
                    this.direction = 1;
                }
                this.x = this.startX + (targetX - this.startX) * this.progress;
                this.y = this.startY + (targetY - this.startY) * this.progress;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // 外周のデジタル八角形ネオン
        ctx.shadowBlur = 15;
        const neonColor = this.moveOptions ? '#ffaa00' : '#ff003c';
        const shadowColor = this.moveOptions ? 'rgba(255, 170, 0, 0.85)' : 'rgba(255, 0, 60, 0.85)';
        ctx.shadowColor = shadowColor;
        ctx.strokeStyle = neonColor;
        ctx.lineWidth = 2.0;

        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const px = Math.cos(angle) * this.radius;
            const py = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        // 漆黒の障壁
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#030308';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius - 2, 0, Math.PI * 2);
        ctx.fill();

        // ハニカム調グリッド
        ctx.strokeStyle = this.moveOptions ? 'rgba(255, 170, 0, 0.2)' : 'rgba(255, 0, 60, 0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-this.radius + 4, 0); ctx.lineTo(this.radius - 4, 0);
        ctx.moveTo(0, -this.radius + 4); ctx.lineTo(0, this.radius - 4);
        ctx.stroke();

        // 中央の警告テキスト (回転を打ち消す)
        ctx.rotate(-this.angle);
        ctx.fillStyle = neonColor;
        ctx.font = "bold 9px 'Inter', sans-serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.moveOptions ? 'PATROL' : 'BLOCK', 0, 0);

        ctx.restore();
    }

    containsPoint(p) {
        return dist(p, this) <= this.radius;
    }
}

class ColorFilter {
    constructor(x, y, color = '#ff003c', radius = 18) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = radius;
        this.pulse = 0;
    }

    update(dt) {
        this.pulse += 2.0 * dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        const pulseRad = this.radius + Math.sin(this.pulse) * 1.5;
        ctx.shadowBlur = 18;
        ctx.shadowColor = this.color;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2.0;

        // 円形スリット
        ctx.beginPath();
        ctx.arc(0, 0, pulseRad, 0, Math.PI * 2);
        ctx.stroke();

        // 内側の半透明カラー
        ctx.fillStyle = this.color + '22';
        ctx.beginPath();
        ctx.arc(0, 0, pulseRad - 2, 0, Math.PI * 2);
        ctx.fill();

        // 中心コア
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        // ラベル
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 0;
        ctx.font = "8px 'Inter', monospace";
        ctx.textAlign = 'center';
        ctx.fillText("FILTER", 0, -pulseRad - 6);

        ctx.restore();
    }

    containsPoint(p) {
        return dist(p, this) <= this.radius;
    }
}

class ParticleSystem {
    constructor() { this.particles = []; }

    spawn(x, y, color, count = CONFIG.PARTICLE_COUNT) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 90 + 35;
            this.particles.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: 1.0, decay: Math.random()*1.6+1.2, color });
        }
    }

    spawnMirrorDissolve(m) {
        const count = Math.floor(m.length / 8);
        for (let i = 0; i <= count; i++) {
            const ratio = i / count;
            const x = m.p1.x + (m.p2.x - m.p1.x) * ratio;
            const y = m.p1.y + (m.p2.y - m.p1.y) * ratio;
            for (let j = 0; j < 3; j++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 45 + 15;
                this.particles.push({ x, y, vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed, life: 0.9, decay: Math.random()*1.5+1.0, color: 'rgba(192, 192, 216, 0.85)' });
            }
        }
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    draw(ctx) {
        ctx.save();
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color; ctx.shadowBlur = 6; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

// ============================================================
// STAGE DATABASE (Serialized templates for easy expansion)
// ============================================================
const STAGE_TEMPLATES = [
    {
        id: 0,
        name: "REFLECTION",
        displayName: "TUNING_01: REFLECTION",
        gimmicks: "基本反射",
        story: "システム起動——調律者よ、幾何学アーカイブへようこそ。まずは基本から。虚空に鏡を引き、光の経路を紡ぎ出せ。",
        objective: "放射された光子を、右下の結晶（PRISM）へ届けよ",
        gimmickList: [
            { type: 'mirror', name: 'MIRROR (鏡)', desc: '銀の反射面。ドラッグで配置し、完全反射の幾何学を利用して光を屈折させる。' },
            { type: 'blackhole', name: 'EMITTER (発射台)', desc: '調律エネルギー光子の射出基部。自動で一方向に光線を放ち続ける。' },
            { type: 'wormhole', name: 'PRISM (結晶)', desc: '調律終着点。光子がここに到達すると、空間の共鳴が完了しステージクリアとなる。' }
        ],
        emitter: { x: 80, y: 150, angle: 0 },
        prism: { x: 520, y: 650, radius: 20 },
        blackholes: [], portals: [], blocks: [],
        parMirrorLength: 220, inkCapacity: 520,
        tutorialStage: true,
        hints: ["斜めに銀の鏡を引いて、光を右下の結晶へ導け"]
    },
    {
        id: 1,
        name: "DOUBLE_ANGLE",
        displayName: "TUNING_02: DOUBLE_ANGLE",
        gimmicks: "二段階反射",
        story: "第一の調律完了。次の課題——二段階の反射を制御せよ。光の角度は鏡の傾きが支配する。計算せよ。",
        objective: "二回以上の反射を経由させて、左の結晶（PRISM）へ届けよ",
        gimmickList: [
            { type: 'mirror', name: 'MIRROR (鏡)', desc: '二枚の鏡を組み合わせて光を誘導する。鏡を置く順番と角度で届く先が決まる。' },
            { type: 'blackhole', name: 'EMITTER (発射台)', desc: '斜め45度に向けて光子を射出する。' },
            { type: 'wormhole', name: 'PRISM (結晶)', desc: 'パズルをクリアするために、効率的な二段階反射ルートを構築せよ。' }
        ],
        emitter: { x: 80, y: 150, angle: Math.PI * 0.25 },
        prism: { x: 500, y: 150, radius: 20 },
        blackholes: [], portals: [], blocks: [],
        parMirrorLength: 360, inkCapacity: 620,
        hints: ["光を二段階反射させて、ターゲットへと紡ぎ戻せ"]
    },
    {
        id: 2,
        name: "GRAVITY_WELL",
        displayName: "TUNING_03: GRAVITY_WELL",
        gimmicks: "ブラックホール",
        story: "警告——ブラックホールが近傍に出現した。その超重力場は光すら歪める。引力圏の外に、安全な経路を構築せよ。",
        objective: "重力に吸収されずに、右の結晶へ届けよ。引力圏（点線）の外側を迂回せよ",
        gimmickList: [
            { type: 'blackhole', name: 'BLACK HOLE (重力特異点)', desc: '強力な重力場を展開し、光子の軌道を湾曲させる。コアに接触した光子は消滅する。' },
            { type: 'mirror', name: 'MIRROR (鏡)', desc: '重力による湾曲を計算し、軌道を微調整するための鏡を引け。' },
            { type: 'wormhole', name: 'PRISM (結晶)', desc: '重力圏（点線）を巧みに迂回するルート上に配置されている。' }
        ],
        emitter: { x: 80, y: 400, angle: 0 },
        prism: { x: 520, y: 400, radius: 20 },
        blackholes: [{ x: 300, y: 400, mass: 75, radius: 140 }],
        portals: [], blocks: [],
        parMirrorLength: 420, inkCapacity: 680,
        hints: ["⚠ 点線の重力圏の外側を通るよう鏡を配置しよう", "光は引力圏に近づくと曲がる。迂回ルートを作れ"]
    },
    {
        id: 3,
        name: "PORTAL_JUMP",
        displayName: "TUNING_04: PORTAL_JUMP",
        gimmicks: "ワームホール",
        story: "空間に亀裂が生じた——ワームホールだ。青い入口へ光を当てよ。次の瞬間、それはオレンジの出口から同じ角度で飛び出す。",
        objective: "ポータル（青→橙）を経由させて、右下の結晶へ届けよ",
        gimmickList: [
            { type: 'wormhole', name: 'WORMHOLE (ワームホール)', desc: '青（IN）に進入した光子は、角度・速度を維持したまま即座に橙（OUT）より再射出される。' },
            { type: 'mirror', name: 'MIRROR (鏡)', desc: 'ポータルの入口へ光を正しく導くための反射経路を作成する。' },
            { type: 'blackhole', name: 'EMITTER (発射台)', desc: '直接ポータルに届かない角度で配置されている。鏡による中継が必要。' }
        ],
        emitter: { x: 80, y: 150, angle: Math.PI * 0.15 },
        prism: { x: 520, y: 650, radius: 20 },
        blackholes: [],
        portals: [{ inX: 300, inY: 280, outX: 180, outY: 580 }],
        blocks: [],
        parMirrorLength: 350, inkCapacity: 620,
        hints: ["青いポータル(PORT_IN)に光を当てよ", "光はオレンジ(PORT_OUT)から同じ角度で飛び出す"]
    },
    {
        id: 4,
        name: "CELESTIAL_DESIGNS",
        displayName: "TUNING_05: CELESTIAL_DESIGNS",
        gimmicks: "BH + WH + 遮光ブロック",
        story: "重力の井戸、次元の裂け目、そして光を吸い込む絶対障壁。すべての障害を解き明かし、唯一の調律経路を見出せ。",
        objective: "絶対障壁を避けつつ、重力を迂回し、ポータルを活用して結晶へ届けよ",
        gimmickList: [
            { type: 'block', name: 'BLOCK (遮光障壁) [NEW]', desc: '漆黒の幾何学ブロック。重力による歪みを発生させず、接触した光子を即座に遮断・消滅させる絶対障壁。' },
            { type: 'blackhole', name: 'BLACK HOLE (重力特異点)', desc: '引力圏を完全に迂回するか、あるいはギリギリをかすめて重力スイングバイに利用せよ。' },
            { type: 'wormhole', name: 'WORMHOLE (ワームホール)', desc: '絶対障壁を突破するために、戦略的にポータルを経由させよ。' },
            { type: 'mirror', name: 'MIRROR (鏡)', desc: '狭い安全地帯に鏡を引き、極めて精密な軌道制御を試みよ。' }
        ],
        emitter: { x: 80, y: 120, angle: 0 },
        prism: { x: 520, y: 700, radius: 20 },
        blackholes: [{ x: 250, y: 550, mass: 90, radius: 150 }],
        portals: [{ inX: 520, inY: 180, outX: 120, outY: 420 }],
        blocks: [
            { x: 360, y: 300, radius: 18 },
            { x: 150, y: 680, radius: 18 }
        ],
        parMirrorLength: 500, inkCapacity: 820,
        hints: ["遮光ブロック（赤い障壁）に当たると光は消滅する。慎重に避けて進もう"]
    },
    {
        id: 5,
        name: "MIRROR_MAZE",
        displayName: "TUNING_06: MIRROR_MAZE",
        gimmicks: "精密多重反射 + 障壁迷路",
        story: "絶対障壁によって幾何学空間が分断されている。複雑な反射経路を組み上げ、目に見えない光の迷路を照らし出せ。",
        objective: "複数の遮光ブロックで形成された迷路を抜け、ポータルを繋いで右上の結晶へ届けよ",
        gimmickList: [
            { type: 'block', name: 'BLOCK (遮光障壁)', desc: '迷路の壁として機能する絶対障壁。僅かな隙間を通す精密な角度設計が求められる。' },
            { type: 'mirror', name: 'MIRROR (鏡)', desc: '複数の鏡を精密に配置して、迷路の角を直角または鋭角に曲がる光路を構築する。' },
            { type: 'wormhole', name: 'WORMHOLE (ワームホール)', desc: '絶対障壁で遮られた対角のエリアへ光子を転送するキーデバイス。' }
        ],
        emitter: { x: 80, y: 700, angle: -Math.PI * 0.35 },
        prism: { x: 520, y: 100, radius: 20 },
        blackholes: [],
        portals: [{ inX: 480, inY: 500, outX: 120, outY: 250 }],
        blocks: [
            { x: 300, y: 380, radius: 20 },
            { x: 320, y: 150, radius: 20 },
            { x: 180, y: 550, radius: 16 }
        ],
        parMirrorLength: 480, inkCapacity: 750,
        hints: ["遮光障壁の間には、光子が通り抜けられる微小な隙間が存在する"]
    },
    {
        id: 6,
        name: "SINGULARITY",
        displayName: "TUNING_07: SINGULARITY",
        gimmicks: "極大重力 + 絶対障壁の崩壊",
        story: "最終試練——二つの特異点と絶対障壁が、空間の安定性を崩壊させようとしている。幾何学調律の極致を示し、終着点へ導け。",
        objective: "二つの重力特異点と遮光障壁をすべて攻略し、次元転送を駆使してクリアせよ",
        gimmickList: [
            { type: 'blackhole', name: 'BLACK HOLE (重力特異点)', desc: '二つの強力な重力場が干渉し合う。スイングバイの湾曲軌道を計算せよ。' },
            { type: 'block', name: 'BLOCK (遮光障壁)', desc: '重力で曲げられた光線が最も衝突しやすい位置に配置された絶対障壁。' },
            { type: 'wormhole', name: 'WORMHOLE (ワームホール)', desc: '重力井戸を飛び越え、最終エリアに光子を送り出すための次元の裂け目。' },
            { type: 'mirror', name: 'MIRROR (鏡)', desc: 'インクの残り具合（鏡の全長）がシビア。最も効率的な経路を構築せよ。' }
        ],
        emitter: { x: 80, y: 400, angle: -Math.PI * 0.2 },
        prism: { x: 520, y: 650, radius: 20 },
        blackholes: [
            { x: 200, y: 250, mass: 60, radius: 120 },
            { x: 420, y: 500, mass: 70, radius: 130 }
        ],
        portals: [{ inX: 300, inY: 180, outX: 480, outY: 300 }],
        blocks: [
            { x: 300, y: 350, radius: 18 },
            { x: 250, y: 580, radius: 18 }
        ],
        parMirrorLength: 600, inkCapacity: 900,
        hints: ["重力による湾曲と、遮光ブロックの位置関係を見極めよ"]
    },
    {
        id: 7,
        name: "COLOR_SYMPHONY",
        displayName: "TUNING_08: COLOR_SYMPHONY",
        gimmicks: "カラーフィルター (新ギミック)",
        story: "幾何学空間の波長が遷移した。終着点（PRISM）は特定の色彩波長（赤）のみを受け入れる。光子を赤色に調律し、共鳴させよ。",
        objective: "光子をカラーフィルターに通して『赤』に変化させ、赤色の結晶へ届けよ",
        gimmickList: [
            { type: 'colorfilter', name: 'COLOR FILTER (カラーフィルター) [NEW]', desc: '波長同調環。通過した光子の色（波長）をフィルターと同じ色へ強制変化させる。' },
            { type: 'mirror', name: 'MIRROR (鏡)', desc: 'カラーフィルターを通過させ、さらに結晶へ導く精密な折り返し経路を描け。' },
            { type: 'wormhole', name: 'PRISM (結晶)', desc: '今回は「赤」に調律された光のみを受け入れる。異なる色の光はすり抜ける。' }
        ],
        emitter: { x: 80, y: 150, angle: Math.PI * 0.1 },
        prism: { x: 520, y: 650, radius: 20, targetColor: '#ff003c' },
        blackholes: [],
        portals: [{ inX: 450, inY: 200, outX: 150, outY: 550 }],
        blocks: [{ x: 300, y: 400, radius: 22 }],
        colorFilters: [{ x: 300, y: 220, color: '#ff003c', radius: 18 }],
        parMirrorLength: 420, inkCapacity: 720,
        hints: ["結晶（PRISM）は、ターゲットと同じ色（赤）の光しか受け入れない", "光をまず右上のポータルから左下のエリアへワープさせ、そこから鏡で反射させて中央上の赤いカラーフィルターを通し、結晶へ導こう"]
    },
    {
        id: 8,
        name: "DYNAMIC_INTERFERENCE",
        displayName: "TUNING_09: DYNAMIC_INTERFERENCE",
        gimmicks: "動的障壁 + カラーフィルター",
        story: "防衛機構が作動。動的遮光ブロック『PATROL』が領域を巡回し、光の経路を遮断しようとしている。予測軌道がリアルタイムに変化するのを見極め、巡回ルートを回避せよ。",
        objective: "動く障害物（黄色）の軌道を完全に避け、緑のカラーフィルターを経由して結晶へ届けよ",
        gimmickList: [
            { type: 'patrol', name: 'PATROL BLOCK (動的遮光障壁) [NEW]', desc: '領域を巡回（往復）する黄色のブロック。予測レーザー軌道は障害物の動きに連動してリアルタイムに変化する。' },
            { type: 'colorfilter', name: 'COLOR FILTER (カラーフィルター)', desc: '今回は光子を「緑」に同調させて結晶へ導く必要がある。' },
            { type: 'wormhole', name: 'PRISM (結晶)', desc: '緑色に調律された光のみを受け入れるため、必ず緑のフィルターを通過させよ。' }
        ],
        emitter: { x: 80, y: 450, angle: -Math.PI * 0.15 },
        prism: { x: 520, y: 420, radius: 20, targetColor: '#00ff3c' },
        blackholes: [],
        portals: [{ inX: 280, inY: 180, outX: 180, outY: 620 }],
        blocks: [
            { x: 280, y: 350, radius: 18, moveOptions: { targetX: 280, targetY: 520, speed: 70 } },
            { x: 450, y: 600, radius: 18, moveOptions: { targetX: 220, targetY: 600, speed: 90 } }
        ],
        colorFilters: [{ x: 460, y: 220, color: '#00ff3c', radius: 18 }],
        parMirrorLength: 500, inkCapacity: 850,
        hints: ["黄色のパトロールブロックは一定速度で往復運動している", "予測線がうねうねと変化して遮断されるのを見ながら、常に遮断されない安全な反射経路を引こう", "まずは右上の緑のカラーフィルターを通し、そこから結晶へ導く軌道を描け"]
    }
];

// ============================================================
// MAIN GAME CONTROLLER
// ============================================================
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
        this.portals = [];
        this.blocks = [];
        this.colorFilters = [];

        this.isDrawing = false;
        this.drawStart = { x: 0, y: 0 };
        this.drawEnd = { x: 0, y: 0 };
        this.inkLeft = 0;
        this.maxInkForStage = 0;

        this.photonPosition = { x: 0, y: 0 };
        this.currentSegmentIdx = 0;
        this.segmentProgress = 0;

        this.particles = new ParticleSystem();

        this.hoveredMirrorIdx = -1;
        this.lastMousePos = { x: 0, y: 0 };

        this.laserCache = [];
        this.reflectionPoints = [];
        this.hasHitPrism = false;

        // Chain flash animation state
        this.chainFlashQueue = [];
        this.chainFlashTimer = 0;

        // Stage Editor States
        this.editorActiveGimmick = 'emitter';
        this.editorSelectedObject = null;
        this.editorTool = 'select'; // 'select', 'place', 'erase'
        this.editorHasCleared = false;
        this.customStageData = null;
        this.editorDraggingObject = null;
        this.editorDragPart = null;
        this.editorDraggingPatrolTarget = false;
        this.editorDragOffset = { x: 0, y: 0 };
        this.editorDragChanged = false;
        this.editorKeyboardCursor = { x: CONFIG.WIDTH / 2, y: CONFIG.HEIGHT / 2 };
        this.editorHistory = [];
        this.editorFuture = [];
        this.editorDraftKey = 'lumen_mirror_editor_draft_v1';
        this.lastFocusedElement = null;
        this.modalMode = 'import';

        this.initCanvas();
        this.bindEvents();
        this.initEditorEvents();
        this._showTitleScreen();

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
        if (w / h > aspect) w = h * aspect; else h = w / aspect;
        this.canvas.style.width = `${w}px`;
        this.canvas.style.height = `${h}px`;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CONFIG.WIDTH * dpr;
        this.canvas.height = CONFIG.HEIGHT * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---- UI Helpers ----
    _unlock() {
        audio.init();
        if (audio.ctx && audio.ctx.state === 'suspended') audio.ctx.resume();
    }

    _showTitleScreen() {
        this.state = STATE.TITLE;
        document.getElementById('start-screen').classList.remove('hidden');
        document.getElementById('stage-select').classList.add('hidden');
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('hud').style.opacity = '0.3';
        document.getElementById('controls').style.opacity = '0.3';
    }

    _showStageSelect() {
        this.state = STATE.STAGE_SELECT;
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('stage-select').classList.remove('hidden');
        document.getElementById('overlay').classList.add('hidden');
        document.getElementById('hud').style.opacity = '0.3';
        document.getElementById('controls').style.opacity = '0.3';
        this._buildStageCards();
    }

    _buildStageCards() {
        const container = document.getElementById('stage-cards-container');
        container.innerHTML = '';
        STAGE_TEMPLATES.forEach((tmpl, idx) => {
            const unlocked = scoreManager.isUnlocked(idx);
            const best = scoreManager.getBest(idx);
            const card = document.createElement('button');
            card.className = 'stage-card' + (unlocked ? '' : ' locked');
            card.setAttribute('aria-label', `ステージ${idx + 1}: ${tmpl.name}`);

            const rankHtml = best
                ? `<span class="card-rank rank-${best.rank.toLowerCase()}">${best.rank}</span>`
                : `<span class="card-rank rank-none">—</span>`;

            const rightHtml = unlocked
                ? rankHtml
                : `<span class="card-lock-icon">🔒</span>`;

            card.innerHTML = `
                <span class="card-num">STG_0${idx + 1}</span>
                <div class="card-info">
                    <div class="card-name">${tmpl.name}</div>
                    <div class="card-gimmicks">${tmpl.gimmicks}</div>
                </div>
                ${rightHtml}
            `;

            if (unlocked) {
                card.addEventListener('click', () => {
                    this._unlock();
                    this._startStage(idx);
                });
            }
            container.appendChild(card);
        });
    }

    _startStage(idx) {
        this.state = STATE.PLAYING;
        document.getElementById('stage-select').classList.add('hidden');
        document.getElementById('overlay').classList.add('hidden');
        this._closeInfoPanel();
        // Restore HUD and controls visibility
        document.getElementById('hud').style.opacity = '1';
        document.getElementById('controls').style.opacity = '1';
        this.loadStage(idx);
    }

    // ---- Info Panel ----
    _openInfoPanel() {
        if (this.state === STATE.TITLE || this.state === STATE.STAGE_SELECT || !this.emitter) {
            this.showToast('ステージ選択後に使用できます');
            return;
        }
        this._populateInfoPanel();
        this.lastFocusedElement = document.activeElement;
        document.getElementById('info-panel').classList.remove('hidden');
        document.getElementById('info-close').focus();
    }

    _closeInfoPanel() {
        document.getElementById('info-panel').classList.add('hidden');
        if (this.lastFocusedElement && document.contains(this.lastFocusedElement)) {
            this.lastFocusedElement.focus();
        }
    }

    _populateInfoPanel() {
        const isCustomStage = this.currentStageIdx === -1;
        const tmpl = isCustomStage ? {
            name: this._sanitizeStageTitle(document.getElementById('prop-title')?.value || this.customStageData?.title),
            objective: '——',
            story: '——',
            gimmickList: []
        } : STAGE_TEMPLATES[this.currentStageIdx];
        document.getElementById('info-editor-guide').classList.toggle('hidden', !isCustomStage);
        ['info-mission-section', 'info-story-section', 'info-gimmicks-section'].forEach(id => {
            document.getElementById(id).classList.toggle('hidden', isCustomStage);
        });
        document.getElementById('info-stg-num').textContent = isCustomStage ? 'CUSTOM_STG' : `STG_0${this.currentStageIdx + 1}`;
        document.getElementById('info-stg-name').textContent = tmpl.name;
        document.getElementById('info-objective').textContent = tmpl.objective || '——';
        document.getElementById('info-story').textContent = tmpl.story || '——';

        const container = document.getElementById('info-gimmicks');
        container.innerHTML = '';
        (tmpl.gimmickList || []).forEach(g => {
            const item = document.createElement('div');
            item.className = 'info-gimmick-item';
            const visual = document.createElement('div');
            visual.className = `gimmick-visual ${g.type}`;
            const info = document.createElement('div');
            info.className = 'gimmick-info';
            info.innerHTML = `
                <div class="gimmick-name">${g.name}</div>
                <div class="gimmick-desc">${g.desc}</div>
            `;
            item.appendChild(visual);
            item.appendChild(info);
            container.appendChild(item);
        });
    }

    // ---- Event Binding ----
    bindEvents() {
        const getPos = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            return {
                x: ((e.clientX - rect.left) / rect.width) * CONFIG.WIDTH,
                y: ((e.clientY - rect.top) / rect.height) * CONFIG.HEIGHT
            };
        };

        const handleDown = (e) => {
            this._unlock();
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            const pos = getPos(e);

            if (this.state === STATE.PLAYING || this.state === STATE.EDIT_PLAYING) {
                const eraseIdx = this.findMirrorAt(pos, CONFIG.ERASE_THRESHOLD_DRAW);
                if (eraseIdx !== -1) {
                    const erased = this.mirrors.splice(eraseIdx, 1)[0];
                    this.inkLeft = Math.min(this.maxInkForStage, this.inkLeft + erased.length);
                    this.updateHUD();
                    audio.playCrystalClang(pos.x);
                    this.particles.spawnMirrorDissolve(erased);
                    this.hoveredMirrorIdx = -1;
                    this.calculateLaserPath();
                    return;
                }
                if (this.inkLeft > CONFIG.MIN_INK_DRAW) {
                    this.isDrawing = true;
                    this.drawStart = pos; this.drawEnd = pos;
                    this.lastMousePos = pos;
                    audio.startIceScratch(pos.x);
                }
            } else if (this.state === STATE.EDITING) {
                this.handleEditorPointerDown(pos, e);
            }
        };

        const handleMove = (e) => {
            e.preventDefault();
            const pos = getPos(e);

            if (this.state === STATE.PLAYING || this.state === STATE.EDIT_PLAYING) {
                if (this.isDrawing) {
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
                    audio.updateIceScratch(dist(this.lastMousePos, pos) / 0.016, pos.x);
                    this.lastMousePos = pos;
                    this.calculateLaserPath();
                } else {
                    const prev = this.hoveredMirrorIdx;
                    this.hoveredMirrorIdx = this.findMirrorAt(pos, CONFIG.ERASE_THRESHOLD_IDLE);
                    if (prev !== this.hoveredMirrorIdx) this._updateModeIndicator();
                }
            } else if (this.state === STATE.EDITING) {
                this.handleEditorPointerMove(pos, e);
            }
        };

        const handleUp = (e) => {
            if (this.state === STATE.PLAYING || this.state === STATE.EDIT_PLAYING) {
                if (this.isDrawing) {
                    this.isDrawing = false;
                    audio.stopIceScratch();
                    const len = dist(this.drawStart, this.drawEnd);
                    if (len > CONFIG.MIN_DRAW_LENGTH) {
                        this.mirrors.push(new Mirror(this.drawStart.x, this.drawStart.y, this.drawEnd.x, this.drawEnd.y));
                        this.inkLeft -= len;
                        this.updateHUD();
                        this.calculateLaserPath();
                    }
                    this._updateModeIndicator();
                }
            } else if (this.state === STATE.EDITING) {
                this.handleEditorPointerUp();
            }
        };

        this.canvas.addEventListener('pointerdown', handleDown);
        this.canvas.addEventListener('pointermove', handleMove);
        this.canvas.addEventListener('keydown', (e) => {
            if (this.state === STATE.EDITING) this.handleEditorKeyboard(e);
        });
        window.addEventListener('pointerup', handleUp);

        // Button wiring
        document.getElementById('start-btn').addEventListener('click', () => {
            this._unlock();
            this._showStageSelect();
        });
        document.getElementById('menu-back-btn').addEventListener('click', () => {
            window.location.href = '/minigames.html';
        });
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.href = '/minigames.html';
        });
        const overlayPlazaBtn = document.getElementById('overlay-plaza-btn');
        if (overlayPlazaBtn) {
            overlayPlazaBtn.addEventListener('click', () => {
                window.location.href = '/minigames.html';
            });
        }

        const muteToggle = document.getElementById('sound-mute-toggle');
        const muteLabel = document.getElementById('sound-mute-label');
        if (muteToggle) {
            muteToggle.checked = audio.isMuted;
            if (muteLabel) {
                muteLabel.textContent = audio.isMuted ? 'SOUND: OFF 🔇' : 'SOUND: ON 🔊';
                if (audio.isMuted) {
                    muteLabel.style.borderColor = 'rgba(255, 0, 127, 0.6)';
                    muteLabel.style.color = '#ff007f';
                }
            }
            muteToggle.addEventListener('change', (e) => {
                const isMuted = e.target.checked;
                audio.setMuted(isMuted);
                if (muteLabel) {
                    muteLabel.textContent = isMuted ? 'SOUND: OFF 🔇' : 'SOUND: ON 🔊';
                    if (isMuted) {
                        muteLabel.style.borderColor = 'rgba(255, 0, 127, 0.6)';
                        muteLabel.style.color = '#ff007f';
                    } else {
                        muteLabel.style.borderColor = 'rgba(0, 243, 255, 0.4)';
                        muteLabel.style.color = '#00f3ff';
                    }
                }
            });
            if (muteLabel) {
                muteLabel.addEventListener('click', (e) => {
                    e.preventDefault();
                    muteToggle.checked = !muteToggle.checked;
                    const isMuted = muteToggle.checked;
                    audio.setMuted(isMuted);
                    muteLabel.textContent = isMuted ? 'SOUND: OFF 🔇' : 'SOUND: ON 🔊';
                    if (isMuted) {
                        muteLabel.style.borderColor = 'rgba(255, 0, 127, 0.6)';
                        muteLabel.style.color = '#ff007f';
                    } else {
                        muteLabel.style.borderColor = 'rgba(0, 243, 255, 0.4)';
                        muteLabel.style.color = '#00f3ff';
                    }
                });
            }
        }
        document.getElementById('emit-btn').addEventListener('click', () => {
            this._unlock(); this.emitPhoton();
        });
        document.getElementById('reset-btn').addEventListener('click', () => {
            this._unlock(); this.resetStage();
        });
        document.getElementById('next-btn').addEventListener('click', () => {
            this._unlock(); this.nextStage();
        });
        document.getElementById('select-btn').addEventListener('click', () => {
            this._unlock(); this._showStageSelect();
        });
        document.getElementById('select-back-btn').addEventListener('click', () => {
            this._showTitleScreen();
        });
        // Info chip
        document.getElementById('info-chip').addEventListener('click', () => {
            this._unlock();
            this._openInfoPanel();
        });
        document.getElementById('info-close').addEventListener('click', () => {
            this._closeInfoPanel();
        });
        document.addEventListener('keydown', (e) => {
            const modal = document.getElementById('editor-modal');
            const infoPanel = document.getElementById('info-panel');
            const openDialog = !modal.classList.contains('hidden')
                ? modal
                : (!infoPanel.classList.contains('hidden') ? infoPanel : null);
            if (openDialog && e.key === 'Tab') {
                this._trapDialogFocus(e, openDialog);
                return;
            }
            if (e.key === 'Escape') {
                if (!modal.classList.contains('hidden')) {
                    this._closeEditorModal();
                    return;
                }
                if (!infoPanel.classList.contains('hidden')) {
                    this._closeInfoPanel();
                    return;
                }
            }
            const editsText = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
            if (!editsText && this.state === STATE.EDITING && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                if (e.shiftKey) this.redoEditorAction(); else this.undoEditorAction();
            } else if (!editsText && this.state === STATE.EDITING && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
                e.preventDefault();
                this.redoEditorAction();
            }
        });
    }

    _updateModeIndicator() {
        const indicator = document.getElementById('mode-indicator');
        const label = document.getElementById('mode-label');
        if (this.hoveredMirrorIdx !== -1) {
            indicator.className = 'mode-indicator erase-mode';
            label.textContent = 'ERASE';
        } else {
            indicator.className = 'mode-indicator draw-mode';
            label.textContent = 'DRAW';
        }
    }

    findMirrorAt(pos, threshold = CONFIG.ERASE_THRESHOLD_DEFAULT) {
        for (let i = 0; i < this.mirrors.length; i++) {
            if (this.mirrors[i].distanceToPoint(pos) <= threshold) return i;
        }
        return -1;
    }

    // ---- Stage Loading ----
    loadStage(idx, isCustom = false, customTmpl = null) {
        let tmpl;
        if (isCustom) {
            tmpl = customTmpl;
            this.currentStageIdx = -1; // special value for custom stages
        } else {
            this.currentStageIdx = idx;
            tmpl = STAGE_TEMPLATES[idx];
        }

        this.emitter = new Emitter(tmpl.emitter.x, tmpl.emitter.y, tmpl.emitter.angle);
        this.prism = new Prism(tmpl.prism.x, tmpl.prism.y, tmpl.prism.radius, tmpl.prism.targetColor || null);
        this.blackholes = (tmpl.blackholes || []).map(b => new BlackHole(b.x, b.y, b.mass, b.radius));
        this.portals = (tmpl.portals || []).map(p => new Wormhole(p.inX, p.inY, p.outX, p.outY));
        this.blocks = (tmpl.blocks || []).map(b => new Block(b.x, b.y, b.radius || 18, b.moveOptions || null));
        this.colorFilters = (tmpl.colorFilters || []).map(f => new ColorFilter(f.x, f.y, f.color, f.radius || 18));

        this.mirrors = [];
        this.maxInkForStage = tmpl.inkCapacity || 500;
        this.inkLeft = this.maxInkForStage;
        if (isCustom) {
            const inkInput = document.getElementById('prop-ink');
            const inkValue = document.getElementById('prop-ink-val');
            const titleInput = document.getElementById('prop-title');
            if (inkInput) inkInput.value = this.maxInkForStage;
            if (inkValue) inkValue.textContent = this.maxInkForStage;
            if (titleInput) titleInput.value = this._sanitizeStageTitle(tmpl.title);
        }
        this.hasHitPrism = false;
        this.hoveredMirrorIdx = -1;
        this.chainFlashQueue = [];
        this.chainFlashTimer = 0;

        this.updateHUD();
        this.calculateLaserPath();
        this._updateModeIndicator();

        if (!isCustom) {
            this.showToast(`STG_0${idx + 1}: ${tmpl.name}`, false);
            // Show stage-specific hints
            if (tmpl.hints && tmpl.hints.length > 0) {
                tmpl.hints.forEach((hint, i) => {
                    setTimeout(() => this.showToast(hint, true), 1200 + i * 2000);
                });
            }
        }
    }

    updateHUD() {
        if (this.currentStageIdx === -1) {
            document.getElementById('stage-name').innerText = `CUSTOM_STG`;
        } else {
            document.getElementById('stage-name').innerText = `STG_0${this.currentStageIdx + 1}`;
        }
        const inkPercent = (this.inkLeft / this.maxInkForStage) * 100;
        document.getElementById('ink-bar').style.width = `${inkPercent}%`;
        const inkBar = document.getElementById('ink-bar');
        if (inkPercent < 20) inkBar.classList.add('low'); else inkBar.classList.remove('low');
        document.getElementById('stability-value').innerText = `${inkPercent.toFixed(1)}%`;

        const emitBtn = document.getElementById('emit-btn');
        const resetBtn = document.getElementById('reset-btn');
        if (this.state === STATE.PLAYING) {
            emitBtn.disabled = false;
            resetBtn.disabled = this.mirrors.length === 0;
        } else {
            if (emitBtn) emitBtn.disabled = true;
            if (resetBtn) resetBtn.disabled = true;
        }

        const editorTestBtn = document.getElementById('editor-test-btn');
        const editorClearBtn = document.getElementById('editor-clear-btn');
        if (this.state === STATE.EDIT_PLAYING) {
            if (editorTestBtn) editorTestBtn.disabled = false;
            if (editorClearBtn) editorClearBtn.disabled = this.mirrors.length === 0;
        } else if (this.state === STATE.EMITTING) {
            if (editorTestBtn) editorTestBtn.disabled = true;
            if (editorClearBtn) editorClearBtn.disabled = true;
        }

        const exportBtn = document.getElementById('editor-export-btn');
        if (exportBtn) {
            exportBtn.disabled = !this.editorHasCleared;
        }

        this._updateEditorWorkflowUI();
        this._syncPCSidebar();
    }

    _syncPCSidebar() {
        const tmpl = STAGE_TEMPLATES[this.currentStageIdx];
        if (!tmpl) return;

        // タイトルの同期
        const stgBadge = document.getElementById('pc-stg-info');
        if (stgBadge) stgBadge.textContent = `STG_0${this.currentStageIdx + 1}: ${tmpl.name}`;

        // ミッションの同期
        const missionText = document.getElementById('pc-mission-text');
        if (missionText) missionText.textContent = tmpl.objective || '結晶へ光子を届けよ';

        // ストーリーの同期
        const storyText = document.getElementById('pc-story-text');
        if (storyText) storyText.textContent = tmpl.story || '';

        // ヒントの同期
        const hintText = document.getElementById('pc-hint-text');
        if (hintText) {
            hintText.innerHTML = (tmpl.hints && tmpl.hints.length > 0)
                ? tmpl.hints.map(h => `<div class="hint-item">▸ ${h}</div>`).join('')
                : '——';
        }

        // ギミックリストの同期
        const container = document.getElementById('pc-gimmick-list');
        if (container) {
            container.innerHTML = '';
            (tmpl.gimmickList || []).forEach(g => {
                const item = document.createElement('div');
                item.className = 'sidebar-gimmick-item';
                item.innerHTML = `
                    <div class="sidebar-gimmick-header">
                        <div class="gimmick-visual-mini ${g.type}"></div>
                        <span class="sidebar-gimmick-name">${g.name}</span>
                    </div>
                    <p class="sidebar-gimmick-desc">${g.desc}</p>
                `;
                container.appendChild(item);
            });
        }
    }

    resetStage() {
        if (this.state !== STATE.PLAYING) return;
        audio.playCrystalClang(300);
        this.loadStage(this.currentStageIdx);
    }

    nextStage() {
        document.getElementById('overlay').classList.add('hidden');
        if (this.currentStageIdx === -1) {
            this.stopTestPlayAndReturnToEditor();
            return;
        }
        if (this.currentStageIdx + 1 < STAGE_TEMPLATES.length) {
            this._startStage(this.currentStageIdx + 1);
        } else {
            this.showToast("幾何学アーカイブをすべてクリアしました！");
            setTimeout(() => this._showStageSelect(), 2000);
        }
    }

    showToast(message, isHint = false) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast' + (isHint ? ' hint-toast' : '');
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, isHint ? 4000 : 2800);
    }

    // ---- Physics ----
    calculateLaserPath() {
        const rayStart = { x: this.emitter.x, y: this.emitter.y };
        let currentColor = '#00f3ff'; // Default neon cyan
        this.laserCache = [{ ...rayStart, color: currentColor }];
        this.reflectionPoints = [];
        this.hasHitPrism = false;

        let pt = { ...rayStart };
        let vel = { x: Math.cos(this.emitter.angle), y: Math.sin(this.emitter.angle) };
        let steps = 0;
        const maxSteps = 1600;
        const stepSize = 1.35;
        let lastBouncedMirror = null;
        let lastPortalStep = -999;
        const drawLine = this.isDrawing
            ? new Mirror(this.drawStart.x, this.drawStart.y, this.drawEnd.x, this.drawEnd.y)
            : null;

        while (steps < maxSteps) {
            const next = { x: pt.x + vel.x * stepSize, y: pt.y + vel.y * stepSize };

            // Color filter check
            if (this.colorFilters) {
                for (const filter of this.colorFilters) {
                    if (filter.containsPoint(pt)) {
                        if (currentColor !== filter.color) {
                            currentColor = filter.color;
                            // Register color change event
                            const alreadyRegistered = this.reflectionPoints.some(rp => rp.type === 'colorfilter' && dist(rp, pt) < 6.0);
                            if (!alreadyRegistered) {
                                this.reflectionPoints.push({ x: pt.x, y: pt.y, type: 'colorfilter', color: filter.color });
                            }
                        }
                    }
                }
            }

            // Portal check
            if (steps - lastPortalStep > CONFIG.PORTAL_COOLDOWN_STEPS) {
                for (const portal of this.portals) {
                    if (portal.containsEntrance(pt)) {
                        this.laserCache.push({ x: portal.inPort.x, y: portal.inPort.y, color: currentColor });
                        this.reflectionPoints.push({ x: portal.inPort.x, y: portal.inPort.y, type: 'portal', exitX: portal.outPort.x, exitY: portal.outPort.y });
                        pt = { x: portal.outPort.x, y: portal.outPort.y };
                        this.laserCache.push({ ...pt, color: currentColor });
                        lastPortalStep = steps;
                        break;
                    }
                }
            }

            // Black hole gravity
            for (const bh of this.blackholes) {
                const d = dist(pt, bh);
                if (d < bh.pullRadius) {
                    if (bh.containsPoint(pt)) {
                        let angle = Math.atan2(pt.y - bh.y, pt.x - bh.x);
                        for (let j = 0; j < 45; j++) {
                            angle += 0.22;
                            this.laserCache.push({ 
                                x: bh.x + Math.cos(angle) * d * (45 - j) / 45, 
                                y: bh.y + Math.sin(angle) * d * (45 - j) / 45,
                                color: currentColor
                            });
                        }
                        this.reflectionPoints.push({ x: pt.x, y: pt.y, type: 'blackhole' });
                        return;
                    }
                    const force = (bh.mass / (d * d)) * stepSize * 0.18;
                    vel.x += (bh.x - pt.x) / d * force;
                    vel.y += (bh.y - pt.y) / d * force;
                    const spd = Math.hypot(vel.x, vel.y);
                    vel.x /= spd; vel.y /= spd;
                }
            }

            // Block collisions (Laser Obstacle)
            let hitBlock = false;
            for (const b of this.blocks) {
                if (b.containsPoint(pt)) {
                    this.reflectionPoints.push({ x: pt.x, y: pt.y, type: 'block' });
                    hitBlock = true;
                    break;
                }
            }
            if (hitBlock) {
                this.laserCache.push({ ...pt, color: currentColor });
                break;
            }

            // Boundary
            if (next.x < -15 || next.x > CONFIG.WIDTH + 15 || next.y < -15 || next.y > CONFIG.HEIGHT + 15) {
                this.laserCache.push({ ...next, color: currentColor }); break;
            }

            // Prism
            if (this.prism.containsPoint(next)) {
                if (!this.prism.targetColor || currentColor === this.prism.targetColor) {
                    this.laserCache.push({ ...next, color: currentColor });
                    this.hasHitPrism = true;
                    this.reflectionPoints.push({ x: next.x, y: next.y, type: 'prism' });
                    break;
                }
            }

            // Mirror collisions
            const allMirrors = [...this.mirrors];
            if (drawLine) allMirrors.push(drawLine);
            let colMirror = null, hitInfo = null;
            for (const m of allMirrors) {
                if (m === lastBouncedMirror) continue;
                const hit = getIntersection(pt, next, m.p1, m.p2);
                if (hit) { colMirror = m; hitInfo = hit; break; }
            }

            if (colMirror && hitInfo) {
                const mx = colMirror.p2.x - colMirror.p1.x;
                const my = colMirror.p2.y - colMirror.p1.y;
                const mLen = colMirror.length;
                const nx = -my / mLen; const ny = mx / mLen;
                const dot = vel.x * nx + vel.y * ny;
                vel.x -= 2 * dot * nx; vel.y -= 2 * dot * ny;
                pt = { x: hitInfo.x + vel.x * 1.5, y: hitInfo.y + vel.y * 1.5 };
                this.laserCache.push({ ...hitInfo, color: currentColor });
                this.reflectionPoints.push({ x: hitInfo.x, y: hitInfo.y, type: 'mirror', mirrorRef: colMirror });
                lastBouncedMirror = colMirror;
                if (this.reflectionPoints.filter(p => p.type === 'mirror').length > CONFIG.MAX_REFLECTIONS) break;
            } else {
                pt = next;
            }

            this.laserCache.push({ ...pt, color: currentColor });
            steps++;
        }
    }

    emitPhoton() {
        if (this.state !== STATE.PLAYING && this.state !== STATE.EDIT_PLAYING) return;
        this.state = STATE.EMITTING;
        this.updateHUD();
        this.calculateLaserPath();
        this.currentSegmentIdx = 0;
        this.segmentProgress = 0;
        this.photonPosition = { ...this.laserCache[0] };
        audio.playCrystalClang(this.emitter.x);
    }

    triggerClear() {
        this.state = STATE.CLEAR;
        this.prism.isTuned = true;
        this.prism.spawnClearRipple();
        this.particles.spawn(this.prism.x, this.prism.y, '#ff007f', 50);
        audio.playClearChord();

        // Chain flash: queue all mirrors in reverse order
        this.chainFlashQueue = [...this.mirrors].reverse();
        this.chainFlashTimer = 0;

        const reflectCount = this.reflectionPoints.filter(p => p.type === 'mirror').length;
        const inkUsed = this.maxInkForStage - this.inkLeft;

        const banner = document.getElementById('best-banner');
        const nextBtn = document.getElementById('next-btn');
        const selectBtn = document.getElementById('select-btn');

        if (this.currentStageIdx === -1) {
            this.editorHasCleared = true;

            document.getElementById('overlay-title').textContent = "TEST_CLEAR";
            document.getElementById('overlay-subtitle').textContent = "ステージのクリア検証に成功しました！";
            banner.textContent = "✦ CODE UNLOCKED ✦";
            banner.classList.remove('hidden');

            document.getElementById('stat-reflect').innerText = reflectCount;
            const rankEl = document.getElementById('stat-rank');
            rankEl.innerText = "PASS";
            rankEl.className = "stat-val rank-s";

            const bestEl = document.getElementById('stat-best');
            bestEl.innerText = "CUSTOM";

            nextBtn.textContent = "エディタに戻る";
            nextBtn.style.display = 'block';

            selectBtn.style.display = 'none';

            setTimeout(() => {
                document.getElementById('overlay').classList.remove('hidden');
                this.updateHUD();
            }, CONFIG.CLEAR_OVERLAY_DELAY);
            return;
        }

        // Reset overlay to standard
        document.getElementById('overlay-title').textContent = "SYSTEM_TUNED";
        document.getElementById('overlay-subtitle').textContent = "幾何学の調律に成功しました";
        banner.textContent = "✦ NEW BEST RANK ✦";
        
        nextBtn.textContent = "NEXT_STAGE";
        
        selectBtn.style.display = 'block';

        const tmpl = STAGE_TEMPLATES[this.currentStageIdx];
        let rank = 'S';
        if (inkUsed > tmpl.parMirrorLength * 0.9) rank = 'A';
        if (inkUsed > tmpl.parMirrorLength * 1.2) rank = 'B';
        if (inkUsed > tmpl.parMirrorLength * 1.5) rank = 'C';

        const isNewBest = scoreManager.update(this.currentStageIdx, rank, reflectCount);
        const prevBest = scoreManager.getBest(this.currentStageIdx);

        document.getElementById('stat-reflect').innerText = reflectCount;
        const rankEl = document.getElementById('stat-rank');
        rankEl.innerText = rank;
        rankEl.className = `stat-val rank-${rank.toLowerCase()}`;

        const bestEl = document.getElementById('stat-best');
        bestEl.innerText = prevBest ? prevBest.rank : rank;

        if (isNewBest) banner.classList.remove('hidden'); else banner.classList.add('hidden');

        // Show NEXT_STAGE or hide it on last stage
        nextBtn.style.display = this.currentStageIdx + 1 < STAGE_TEMPLATES.length ? 'block' : 'none';

        setTimeout(() => {
            document.getElementById('overlay').classList.remove('hidden');
            this.updateHUD();
        }, CONFIG.CLEAR_OVERLAY_DELAY);
    }

    // ---- Main Loop ----
    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;
        this.update(dt);
        this.draw();
        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        if (this.prism) this.prism.update(dt);
        this.particles.update(dt);
        if (this.portals) this.portals.forEach(p => p.update(dt));
        if (this.blocks) {
            this.blocks.forEach(b => {
                if (this.state !== STATE.EDITING || !b.moveOptions) b.update(dt);
            });
        }
        if (this.colorFilters) this.colorFilters.forEach(f => f.update(dt));

        // Dynamically recalculate laser path if there are moving patrol blocks
        const hasMovingBlocks = this.blocks && this.blocks.some(b => b.moveOptions !== null);
        if ((this.state === STATE.PLAYING || this.state === STATE.EDIT_PLAYING) && hasMovingBlocks) {
            this.calculateLaserPath();
        }

        // Chain flash update
        if (this.chainFlashQueue.length > 0) {
            this.chainFlashTimer += dt;
            if (this.chainFlashTimer > CONFIG.CHAIN_FLASH_INTERVAL) {
                this.chainFlashTimer = 0;
                const m = this.chainFlashQueue.shift();
                if (m) m.flashTimer = CONFIG.CHAIN_FLASH_DURATION;
            }
        }
        // Tick mirror flash timers
        for (const m of this.mirrors) {
            if (m.flashTimer > 0) m.flashTimer = Math.max(0, m.flashTimer - dt);
        }

        // Photon animation (Refactored: resolution-independent multi-segment leap logic)
        if (this.state === STATE.EMITTING) {
            let timeLeft = dt;
            const maxSubSteps = CONFIG.MAX_SUBSTEPS; // Safeguard against infinite loops
            let subSteps = 0;

            while (timeLeft > 0 && this.currentSegmentIdx < this.laserCache.length - 1 && subSteps < maxSubSteps) {
                subSteps++;
                const p1 = this.laserCache[this.currentSegmentIdx];
                const p2 = this.laserCache[this.currentSegmentIdx + 1];
                const segLen = dist(p1, p2);
                const segTime = segLen / CONFIG.LASER_SPEED;

                if (segTime <= 0) {
                    // Skip invalid zero-length segments safely
                    this.currentSegmentIdx++;
                    this.segmentProgress = 0;
                    continue;
                }

                // Calculate time needed to finish current segment
                const currentSegTimeLeft = segTime * (1 - this.segmentProgress);

                if (timeLeft >= currentSegTimeLeft) {
                    // Leap completely through the current segment
                    timeLeft -= currentSegTimeLeft;
                    this.photonPosition = { ...p2 };
                    this.currentSegmentIdx++;
                    this.segmentProgress = 0;

                    // Evaluate midpoint/node events (reflection, portal warp, prisms, blackholes, blocks, colorfilters)
                    const next = this.laserCache[this.currentSegmentIdx];
                    if (next) {
                        const evt = this.reflectionPoints.find(rp => dist(rp, next) < 2.0);
                        if (evt) {
                            if (evt.type === 'mirror') {
                                audio.playCrystalClang(next.x);
                                this.particles.spawn(next.x, next.y, next.color || '#00f3ff', 20);
                            } else if (evt.type === 'portal') {
                                audio.playPortalWarp(evt.x, evt.exitX);
                                this.particles.spawn(evt.x, evt.y, '#00bfff', 15);
                                this.particles.spawn(evt.exitX, evt.exitY, '#ff8c00', 15);
                            } else if (evt.type === 'prism' && this.hasHitPrism) {
                                this.triggerClear();
                                return; // Stop executing update immediately on level clear
                            } else if (evt.type === 'blackhole') {
                                this.state = (this.currentStageIdx === -1) ? STATE.EDIT_PLAYING : STATE.PLAYING;
                                this.particles.spawn(next.x, next.y, next.color || '#00f3ff', 20);
                                this.showToast("光は幾何学から外れ、深淵に消えた");
                                setTimeout(() => {
                                    this.calculateLaserPath();
                                    this.updateHUD();
                                }, 800);
                                return;
                            } else if (evt.type === 'block') {
                                this.state = (this.currentStageIdx === -1) ? STATE.EDIT_PLAYING : STATE.PLAYING;
                                this.particles.spawn(next.x, next.y, '#ff003c', 25);
                                audio.playCrystalClang(next.x);
                                this.showToast("障壁に衝突。光子は消滅しました");
                                setTimeout(() => {
                                    this.calculateLaserPath();
                                    this.updateHUD();
                                }, 800);
                                return;
                            } else if (evt.type === 'colorfilter') {
                                audio.playCrystalClang(next.x);
                                this.particles.spawn(next.x, next.y, evt.color, 25);
                            }
                        }
                    }
                } else {
                    // Consume remaining frametime inside the current segment
                    this.segmentProgress += timeLeft / segTime;
                    this.photonPosition.x = p1.x + (p2.x - p1.x) * this.segmentProgress;
                    this.photonPosition.y = p1.y + (p2.y - p1.y) * this.segmentProgress;
                    this.photonPosition.color = p1.color || '#00f3ff';
                    timeLeft = 0;
                }
            }

            // If the photon reaches the end of the calculated laser path without level clear
            if (this.currentSegmentIdx >= this.laserCache.length - 1) {
                if (!this.hasHitPrism && this.state === STATE.EMITTING) {
                    this.state = (this.currentStageIdx === -1) ? STATE.EDIT_PLAYING : STATE.PLAYING;
                    this.showToast("光は幾何学から外れ、深淵に消えた");
                    setTimeout(() => {
                        this.calculateLaserPath();
                        this.updateHUD();
                    }, 800);
                }
            }
        }
    }

    // ---- Rendering ----
    draw() {
        this.ctx.clearRect(0, 0, CONFIG.WIDTH, CONFIG.HEIGHT);
        if (this.state === STATE.EDITING) {
            this.drawGrid();
        }

        if (!this.emitter) return; // Not yet initialized

        this.emitter.draw(this.ctx);
        this.prism.draw(this.ctx);
        this.blackholes.forEach(bh => bh.draw(this.ctx));
        this.portals.forEach(p => p.draw(this.ctx));
        if (this.colorFilters) this.colorFilters.forEach(f => f.draw(this.ctx));
        this.blocks.forEach(b => b.draw(this.ctx));

        // Tutorial overlay (only STG1 with no mirrors)
        if (this.currentStageIdx === 0 && this.state === STATE.PLAYING && this.mirrors.length === 0 && !this.isDrawing) {
            this._drawTutorialOverlay();
        }

        // Mirrors
        for (let i = 0; i < this.mirrors.length; i++) {
            this.mirrors[i].draw(this.ctx, i === this.hoveredMirrorIdx);
        }

        // Active draw line with cyber HUD
        if (this.isDrawing) this._drawTuningLine();

        // Laser
        if (this.state === STATE.PLAYING || this.state === STATE.EDITING) {
            this._drawLaserPath(this.laserCache, 'rgba(0, 243, 255, 0.45)', 1.2, true);
        } else if (this.state === STATE.EDIT_PLAYING) {
            this._drawLaserPath(this.laserCache, 'rgba(0, 243, 255, 0.45)', 1.2, true);
        } else if (this.state === STATE.EMITTING) {
            const segs = this.laserCache.slice(0, this.currentSegmentIdx + 1);
            if (this.segmentProgress > 0 && this.currentSegmentIdx < this.laserCache.length - 1) {
                segs.push({ ...this.photonPosition });
            }
            this._drawLaserPath(segs, '#00f3ff', 2.2, false);
            // Photon core
            this.ctx.save();
            const photonColor = this.photonPosition.color || '#00f3ff';
            this.ctx.shadowBlur = 20; this.ctx.shadowColor = photonColor;
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath(); this.ctx.arc(this.photonPosition.x, this.photonPosition.y, 4.5, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.restore();
        } else if (this.state === STATE.CLEAR) {
            this._drawLaserPath(this.laserCache, '#00f3ff', 3.2, false);
        }

        this.particles.draw(this.ctx);
        if (this.state === STATE.EDITING) {
            this.drawEditorSelection();
        }
    }

    _drawTutorialOverlay() {
        const ctx = this.ctx;
        ctx.save();
        const t = Date.now() * 0.004;
        const pulse = Math.sin(t) * 0.15;
        const fadeAlpha = 0.85 + pulse;

        // ============================================================
        // PANEL: Upper-center hint box
        // Placed at y=180 to avoid overlapping emitter at (80,150)
        // ============================================================
        const panelW = 370, panelH = 104;
        const panelX = (CONFIG.WIDTH - panelW) / 2; // centered
        const panelY = 185;

        // Panel BG
        ctx.fillStyle = 'rgba(3, 3, 8, 0.82)';
        this._drawRoundRect(panelX, panelY, panelW, panelH, 8);
        ctx.fill();

        // Panel border (animated glow)
        ctx.strokeStyle = `rgba(0, 243, 255, ${0.2 + pulse * 0.6})`;
        ctx.lineWidth = 1.5;
        this._drawRoundRect(panelX, panelY, panelW, panelH, 8);
        ctx.stroke();

        // Top accent line
        ctx.strokeStyle = `rgba(0, 243, 255, ${0.5 + pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(panelX + 12, panelY);
        ctx.lineTo(panelX + panelW - 12, panelY);
        ctx.stroke();

        // TUTORIAL label
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(0, 243, 255, 0.7)';
        ctx.fillStyle = `rgba(0, 243, 255, ${0.8 + pulse})`;
        ctx.font = "bold 9px 'Inter', monospace";
        ctx.textAlign = 'center';
        ctx.letterSpacing = '0.15em';
        ctx.fillText('▸ TUTORIAL: STAGE 1', CONFIG.WIDTH / 2, panelY + 20);

        // Main hint Japanese
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.fillStyle = `rgba(255, 255, 255, ${fadeAlpha})`;
        ctx.font = "14px 'Noto Sans JP', sans-serif";
        ctx.fillText('斜めに鏡を引いて、光を結晶へ導け', CONFIG.WIDTH / 2, panelY + 48);

        // Sub hint English
        ctx.shadowBlur = 0;
        ctx.fillStyle = `rgba(180, 180, 200, 0.6)`;
        ctx.font = "9px 'Inter', monospace";
        ctx.fillText('Drag diagonally across the laser path to place a mirror', CONFIG.WIDTH / 2, panelY + 68);

        // Operation hint
        ctx.fillStyle = `rgba(0, 243, 255, 0.5)`;
        ctx.font = "9px 'Inter', monospace";
        ctx.fillText('[ Drag = Draw Mirror ]   [ Tap Mirror = Erase ]   [ EMIT = Fire ]', CONFIG.WIDTH / 2, panelY + 87);

        // ============================================================
        // GUIDE: Show the laser beam path and where a mirror goes
        // Emitter at (80,150) angle=0 → laser travels RIGHT at y=150
        // We hint: place a mirror crossing the laser path around x=300-400
        // A 45° mirror crossing y=150 at x=370 will redirect beam toward prism
        // ============================================================

        // Laser trace hint (show where the laser will travel)
        ctx.save();
        ctx.strokeStyle = `rgba(0, 243, 255, ${0.12 + pulse * 0.1})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(this.emitter.x + 18, this.emitter.y);
        ctx.lineTo(560, this.emitter.y); // horizontal laser at y=150
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        // Mirror guide line: 45° crossing the laser at approx (370, 150)
        // Goes from (300, 80) to (440, 220) - crossing the laser at y=150
        const mx1 = 300, my1 = 80, mx2 = 440, my2 = 220;
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = `rgba(192, 192, 216, ${0.5 + pulse})`;
        ctx.strokeStyle = `rgba(192, 192, 216, ${0.35 + pulse})`;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.moveTo(mx1, my1);
        ctx.lineTo(mx2, my2);
        ctx.stroke();
        ctx.setLineDash([]);

        // Endpoint circles
        ctx.fillStyle = `rgba(192, 192, 216, ${0.5 + pulse})`;
        ctx.shadowBlur = 6;
        ctx.beginPath(); ctx.arc(mx1, my1, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(mx2, my2, 5, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // Label "← ここに鏡を引く"
        ctx.save();
        ctx.fillStyle = `rgba(192, 192, 216, ${0.7 + pulse})`;
        ctx.font = "11px 'Noto Sans JP', sans-serif";
        ctx.textAlign = 'left';
        ctx.shadowBlur = 4;
        ctx.shadowColor = 'rgba(192, 192, 216, 0.5)';
        ctx.fillText('← ここに鏡を引く', mx2 + 8, (my1 + my2) / 2 + 4);
        ctx.restore();

        // Arrow: from emitter → toward mirror guide
        this._drawArrow(
            { x: this.emitter.x + 22, y: this.emitter.y - 2 },
            { x: mx1 - 8, y: (my1 + my2) / 2 + 2 },
            `rgba(0, 243, 255, ${0.4 + pulse})`);

        // Arrow: from prism → upward hint
        this._drawArrow(
            { x: this.prism.x, y: this.prism.y - 28 },
            { x: this.prism.x - 10, y: this.prism.y - 60 },
            `rgba(255, 0, 127, ${0.4 + pulse})`);

        // Prism label
        ctx.save();
        ctx.fillStyle = `rgba(255, 0, 127, ${0.55 + pulse})`;
        ctx.font = "9px 'Inter', monospace";
        ctx.textAlign = 'center';
        ctx.fillText('TARGET', this.prism.x, this.prism.y - 66);
        ctx.restore();

        ctx.restore();
    }

    _drawTuningLine() {
        const p1 = this.drawStart; const p2 = this.drawEnd;
        const len = dist(p1, p2);
        const ang = (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI).toFixed(1);
        this.ctx.save();
        this.ctx.shadowBlur = 10; this.ctx.shadowColor = 'rgba(255,255,255,0.6)';
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)'; this.ctx.lineWidth = 2.0; this.ctx.setLineDash([6, 6]);
        this.ctx.beginPath(); this.ctx.moveTo(p1.x, p1.y); this.ctx.lineTo(p2.x, p2.y); this.ctx.stroke();
        this.ctx.setLineDash([]); this.ctx.shadowBlur = 0;
        this.ctx.strokeStyle = 'rgba(0, 243, 255, 0.6)'; this.ctx.fillStyle = 'rgba(0, 243, 255, 0.9)'; this.ctx.lineWidth = 1;
        const cross = (p) => {
            this.ctx.beginPath(); this.ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.beginPath(); this.ctx.moveTo(p.x-12, p.y); this.ctx.lineTo(p.x+12, p.y); this.ctx.moveTo(p.x, p.y-12); this.ctx.lineTo(p.x, p.y+12); this.ctx.stroke();
        };
        cross(p1); cross(p2);
        this.ctx.fillStyle = 'rgba(0, 243, 255, 0.7)'; this.ctx.font = "9px 'Inter', monospace"; this.ctx.textAlign = 'left';
        this.ctx.fillText(`X:${p1.x.toFixed(0)} Y:${p1.y.toFixed(0)}`, p1.x+14, p1.y-7);
        this.ctx.fillText(`LEN:${len.toFixed(0)}px ANG:${ang}°`, p2.x+14, p2.y-7);
        this.ctx.restore();
    }

    _drawLaserPath(path, defaultColor, width, isDashed) {
        if (path.length < 2) return;
        this.ctx.save();
        this.ctx.lineWidth = width;
        this.ctx.shadowBlur = width > 1.5 ? 15 : 6;
        if (isDashed) this.ctx.setLineDash([8, 12]);

        const getStrokeColor = (col) => {
            if (isDashed) {
                // 予測線（点線）は少し透明にして美しくなじませる
                if (col.startsWith('#')) {
                    return col + '73'; // 透明度 約45%
                }
                return col;
            }
            return col;
        };

        const getShadowColor = (col) => {
            if (col.startsWith('#')) {
                return col + 'cc'; // ネオングロー用の強めの半透明
            }
            return col;
        };

        let currentSegmentColor = path[0].color || defaultColor;
        this.ctx.strokeStyle = getStrokeColor(currentSegmentColor);
        this.ctx.shadowColor = getShadowColor(currentSegmentColor);

        this.ctx.beginPath();
        this.ctx.moveTo(path[0].x, path[0].y);

        for (let i = 1; i < path.length; i++) {
            const nextColor = path[i].color || defaultColor;
            if (nextColor !== currentSegmentColor) {
                // 現在の色で線を描画してパスをストローク
                this.ctx.lineTo(path[i].x, path[i].y);
                this.ctx.stroke();

                // 新しい色に切り替えて、新たなパスを開始する
                currentSegmentColor = nextColor;
                this.ctx.strokeStyle = getStrokeColor(currentSegmentColor);
                this.ctx.shadowColor = getShadowColor(currentSegmentColor);
                this.ctx.beginPath();
                this.ctx.moveTo(path[i].x, path[i].y);
            } else {
                this.ctx.lineTo(path[i].x, path[i].y);
            }
        }
        this.ctx.stroke();
        this.ctx.restore();
    }

    _drawRoundRect(x, y, w, h, r) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.arcTo(x + w, y, x + w, y + r, r);
        ctx.lineTo(x + w, y + h - r);
        ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
        ctx.lineTo(x + r, y + h);
        ctx.arcTo(x, y + h, x, y + h - r, r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y, x + r, y, r);
        ctx.closePath();
    }

    _drawArrow(from, to, color) {
        const ctx = this.ctx;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const hLen = 8;
        ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(to.x - hLen * Math.cos(angle - Math.PI/6), to.y - hLen * Math.sin(angle - Math.PI/6));
        ctx.lineTo(to.x - hLen * Math.cos(angle + Math.PI/6), to.y - hLen * Math.sin(angle + Math.PI/6));
        ctx.closePath(); ctx.fill(); ctx.restore();
    }

    // ============================================================
    // STAGE EDITOR (CREATIVE MODE) METHODS
    // ============================================================
    _sanitizeStageTitle(title) {
        const sanitized = String(title || '')
            .replace(/[<>]/g, '')
            .replace(/[\u0000-\u001f\u007f]/g, '')
            .trim()
            .slice(0, 24);
        return sanitized || 'MY_STAGE';
    }

    _defaultCustomStage() {
        return {
            v: 4,
            title: 'MY_STAGE',
            emitter: { x: 80, y: 150, angle: 0 },
            prism: { x: 520, y: 650, radius: 20, targetColor: null },
            blackholes: [], portals: [], blocks: [], colorFilters: [],
            inkCapacity: 500
        };
    }

    _loadEditorDraft() {
        try {
            const stored = localStorage.getItem(this.editorDraftKey);
            return stored ? this.normalizeCustomStageData(JSON.parse(stored)) : null;
        } catch (error) {
            localStorage.removeItem(this.editorDraftKey);
            return null;
        }
    }

    _persistEditorDraft() {
        if (this.state !== STATE.EDITING || !this.emitter || !this.prism) return;
        try {
            localStorage.setItem(this.editorDraftKey, JSON.stringify(this.serializeStage()));
            const status = document.getElementById('draft-status');
            if (status) status.textContent = '保存済み';
        } catch (error) {
            const status = document.getElementById('draft-status');
            if (status) status.textContent = '保存不可';
        }
    }

    _resetEditorHistory() {
        this.editorHistory = [JSON.stringify(this.serializeStage())];
        this.editorFuture = [];
        this._persistEditorDraft();
        this._updateEditorWorkflowUI();
    }

    _recordEditorState() {
        if (this.state !== STATE.EDITING) return;
        const snapshot = JSON.stringify(this.serializeStage());
        if (this.editorHistory[this.editorHistory.length - 1] !== snapshot) {
            this.editorHistory.push(snapshot);
            if (this.editorHistory.length > 50) this.editorHistory.shift();
            this.editorFuture = [];
        }
        this._persistEditorDraft();
        this._updateEditorWorkflowUI();
    }

    _restoreEditorSnapshot(snapshot) {
        const data = this.normalizeCustomStageData(JSON.parse(snapshot));
        if (!data) return;
        this.customStageData = data;
        this.editorHasCleared = false;
        this.loadStage(-1, true, data);
        this.editorSelectedObject = null;
        this.updateInspector();
        this.calculateLaserPath();
        this.updateHUD();
        this._persistEditorDraft();
    }

    undoEditorAction() {
        if (this.editorHistory.length <= 1) return;
        this.editorFuture.push(this.editorHistory.pop());
        this._restoreEditorSnapshot(this.editorHistory[this.editorHistory.length - 1]);
        this._updateEditorWorkflowUI();
    }

    redoEditorAction() {
        if (!this.editorFuture.length) return;
        const snapshot = this.editorFuture.pop();
        this.editorHistory.push(snapshot);
        this._restoreEditorSnapshot(snapshot);
        this._updateEditorWorkflowUI();
    }

    _updateEditorWorkflowUI() {
        if (this.currentStageIdx !== -1 || !this.emitter || !this.prism) return;
        const title = this._sanitizeStageTitle(document.getElementById('prop-title')?.value || this.customStageData?.title);
        const previewTitle = document.getElementById('preview-title');
        const previewSummary = document.getElementById('preview-summary');
        if (previewTitle) previewTitle.textContent = title;
        if (previewSummary) {
            const stationaryBlocks = this.blocks.filter(block => !block.moveOptions).length;
            const patrols = this.blocks.length - stationaryBlocks;
            previewSummary.textContent = `BLACKHOLE ${this.blackholes.length} / BLOCK ${stationaryBlocks} / PATROL ${patrols} / PORTAL ${this.portals.length} / FILTER ${this.colorFilters.length}`;
        }

        const status = document.getElementById('editor-share-status');
        const exportBtn = document.getElementById('editor-export-btn');
        if (exportBtn) exportBtn.disabled = !this.editorHasCleared;
        if (status) {
            status.classList.toggle('ready', this.editorHasCleared);
            status.classList.toggle('pending', !this.editorHasCleared);
            status.querySelector('strong').textContent = this.editorHasCleared ? 'READY_TO_SHARE' : 'TEST_REQUIRED';
            document.getElementById('export-warning').textContent = this.editorHasCleared
                ? '検証済み。共有テキストを出力できます'
                : 'テストクリアで共有コードが解放されます';
        }

        const undo = document.getElementById('editor-undo-btn');
        const redo = document.getElementById('editor-redo-btn');
        if (undo) undo.disabled = this.editorHistory.length <= 1;
        if (redo) redo.disabled = this.editorFuture.length === 0;
    }

    _openEditorModal(focusTarget = 'modal-textarea') {
        this.lastFocusedElement = document.activeElement;
        document.getElementById('app-layout').inert = true;
        document.getElementById('editor-modal').classList.remove('hidden');
        document.getElementById(focusTarget).focus();
    }

    _closeEditorModal() {
        document.getElementById('editor-modal').classList.add('hidden');
        document.getElementById('app-layout').inert = false;
        if (this.lastFocusedElement && document.contains(this.lastFocusedElement)) {
            this.lastFocusedElement.focus();
        }
    }

    _trapDialogFocus(event, dialog) {
        const focusable = [...dialog.querySelectorAll('button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
            .filter(element => element.getClientRects().length);
        if (!focusable.length) {
            event.preventDefault();
            dialog.focus();
            return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        } else if (!dialog.contains(document.activeElement)) {
            event.preventDefault();
            first.focus();
        }
    }

    _clearEditorObjects() {
        this.blackholes = [];
        this.portals = [];
        this.blocks = [];
        this.colorFilters = [];
        this.editorSelectedObject = null;
        this.editorHasCleared = false;
        this.updateInspector();
        this.calculateLaserPath();
        this.updateHUD();
        this._recordEditorState();
        this.showToast("すべての配置オブジェクトをクリアしました");
    }

    initEditorEvents() {
        const editorBtn = document.getElementById('editor-btn');
        if (editorBtn) {
            editorBtn.addEventListener('click', () => {
                this._unlock();
                this.enterEditorMode();
            });
        }

        const editorBackBtn = document.getElementById('editor-back-btn');
        if (editorBackBtn) {
            editorBackBtn.addEventListener('click', () => {
                this._unlock();
                if (this.state === STATE.EDIT_PLAYING) {
                    this.stopTestPlayAndReturnToEditor();
                } else {
                    this.exitEditorMode();
                }
            });
        }

        const tools = ['select', 'place', 'erase'];
        tools.forEach(t => {
            const btn = document.getElementById(`tool-${t}`);
            if (btn) {
                btn.addEventListener('click', () => {
                    this._unlock();
                    this.editorTool = t;
                    this.syncEditorToolUI();
                });
            }
        });

        const paletteItems = document.querySelectorAll('.palette-item');
        paletteItems.forEach(item => {
            item.addEventListener('click', () => {
                this._unlock();
                const type = item.getAttribute('data-type');
                this.editorActiveGimmick = type;
                this.editorTool = 'place';
                this.syncEditorToolUI();
                this.syncPaletteUI();
            });
        });

        const clearBtn = document.getElementById('editor-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this._unlock();
                if (this.state === STATE.EDIT_PLAYING) {
                    this.loadStage(-1, true, this.customStageData);
                } else {
                    this.modalMode = 'confirm-clear';
                    document.getElementById('modal-title').textContent = "CLEAR_ALL (全消去)";
                    document.getElementById('modal-desc').textContent = "配置したギミックをすべて消去します。UNDOで復元できます。";
                    document.getElementById('modal-textarea').classList.add('hidden');
                    document.getElementById('modal-error').classList.add('hidden');
                    document.getElementById('modal-action-btn').textContent = "消去する";
                    this._openEditorModal('modal-action-btn');
                }
            });
        }

        const testBtn = document.getElementById('editor-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this._unlock();
                if (this.state === STATE.EDITING) {
                    this.startTestPlay();
                } else if (this.state === STATE.EDIT_PLAYING) {
                    this.emitPhoton();
                }
            });
        }

        const angleInput = document.getElementById('prop-angle');
        if (angleInput) {
            angleInput.addEventListener('input', (e) => {
                if (this.editorSelectedObject === this.emitter) {
                    const deg = parseInt(e.target.value);
                    this.emitter.angle = deg * Math.PI / 180;
                    document.getElementById('prop-angle-val').textContent = deg;
                    this.editorHasCleared = false;
                    this.calculateLaserPath();
                }
            });
            angleInput.addEventListener('change', () => this._recordEditorState());
        }

        const speedInput = document.getElementById('prop-speed');
        if (speedInput) {
            speedInput.addEventListener('input', (e) => {
                const obj = this.editorSelectedObject;
                if (obj && obj instanceof Block && obj.moveOptions) {
                    const speed = parseInt(e.target.value);
                    obj.moveOptions.speed = speed;
                    document.getElementById('prop-speed-val').textContent = speed;
                    this.editorHasCleared = false;
                    this.calculateLaserPath();
                }
            });
            speedInput.addEventListener('change', () => this._recordEditorState());
        }

        const inkInput = document.getElementById('prop-ink');
        if (inkInput) {
            inkInput.addEventListener('input', (e) => {
                const ink = parseInt(e.target.value);
                this.maxInkForStage = ink;
                this.inkLeft = ink;
                document.getElementById('prop-ink-val').textContent = ink;
                this.editorHasCleared = false;
                this.updateHUD();
            });
            inkInput.addEventListener('change', () => this._recordEditorState());
        }

        const titleInput = document.getElementById('prop-title');
        if (titleInput) {
            titleInput.addEventListener('input', () => this._updateEditorWorkflowUI());
            titleInput.addEventListener('change', () => {
                titleInput.value = this._sanitizeStageTitle(titleInput.value);
                this.editorHasCleared = false;
                this._recordEditorState();
                this.updateHUD();
            });
        }

        const colorButtons = document.querySelectorAll('.color-picker-btn');
        colorButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this._unlock();
                const color = btn.getAttribute('data-color');
                const obj = this.editorSelectedObject;
                if (obj) {
                    if (obj === this.prism) {
                        obj.targetColor = (color === '#00f3ff') ? null : color;
                    } else if (obj instanceof ColorFilter) {
                        obj.color = color;
                    }
                    this.syncColorPickerButtons(color);
                    this.editorHasCleared = false;
                    this.calculateLaserPath();
                    this._recordEditorState();
                }
            });
        });

        const propDeleteBtn = document.getElementById('prop-delete-btn');
        if (propDeleteBtn) {
            propDeleteBtn.addEventListener('click', () => {
                this._unlock();
                this.deleteSelectedObject();
            });
        }

        document.getElementById('editor-undo-btn').addEventListener('click', () => this.undoEditorAction());
        document.getElementById('editor-redo-btn').addEventListener('click', () => this.redoEditorAction());

        const importBtn = document.getElementById('editor-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this._unlock();
                this.modalMode = 'import';
                document.getElementById('modal-title').textContent = "STAGE_CODE_IMPORT (インポート)";
                document.getElementById('modal-desc').textContent = "共有された調律コード（LMN-から始まる文字列）を貼り付けてください。";
                document.getElementById('modal-textarea').value = "";
                document.getElementById('modal-textarea').placeholder = "ここにLMN-から始まる調律コードを貼り付け、適用ボタンを押してください...";
                document.getElementById('modal-textarea').readOnly = false;
                document.getElementById('modal-textarea').classList.remove('hidden');
                document.getElementById('modal-error').classList.add('hidden');
                document.getElementById('modal-action-btn').textContent = "適用する";
                this._openEditorModal();
            });
        }

        const exportBtn = document.getElementById('editor-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this._unlock();
                this.modalMode = 'export';
                const code = "LMN-" + btoa(unescape(encodeURIComponent(JSON.stringify(this.serializeStage()))));
                const title = this._sanitizeStageTitle(document.getElementById('prop-title').value);
                const summary = document.getElementById('preview-summary').textContent;
                document.getElementById('modal-title').textContent = "STAGE_CODE_EXPORT (エクスポート)";
                document.getElementById('modal-desc').textContent = "説明付きの共有テキストです。そのまま送信できます。";
                document.getElementById('modal-textarea').value = `LUMEN_MIRROR | ${title}\n${summary}\n${code}`;
                document.getElementById('modal-textarea').readOnly = true;
                document.getElementById('modal-textarea').classList.remove('hidden');
                document.getElementById('modal-error').classList.add('hidden');
                document.getElementById('modal-action-btn').textContent = "コピーする";
                this._openEditorModal();
                
                setTimeout(() => {
                    document.getElementById('modal-textarea').select();
                }, 100);
            });
        }

        const modalClose = document.getElementById('modal-close');
        if (modalClose) {
            modalClose.addEventListener('click', () => {
                this._closeEditorModal();
            });
        }

        const modalCancel = document.getElementById('modal-cancel-btn');
        if (modalCancel) {
            modalCancel.addEventListener('click', () => {
                this._closeEditorModal();
            });
        }

        const modalAction = document.getElementById('modal-action-btn');
        if (modalAction) {
            modalAction.addEventListener('click', () => {
                this._unlock();
                if (this.modalMode === 'import') {
                    const val = document.getElementById('modal-textarea').value.trim();
                    const data = this.deserializeStage(val);
                    if (data) {
                        this.customStageData = data;
                        this.editorHasCleared = false;
                        this.loadStage(-1, true, this.customStageData);
                        this._closeEditorModal();
                        this.showToast("調律コードをインポートしました！");
                        this.editorSelectedObject = null;
                        this.updateInspector();
                        this.calculateLaserPath();
                        this.updateHUD();
                        this._resetEditorHistory();
                    } else {
                        document.getElementById('modal-error').classList.remove('hidden');
                    }
                } else if (this.modalMode === 'confirm-clear') {
                    this._clearEditorObjects();
                    this._closeEditorModal();
                } else if (this.modalMode === 'export') {
                    const val = document.getElementById('modal-textarea').value;
                    navigator.clipboard.writeText(val).then(() => {
                        this.showToast("クリップボードにコピーしました！");
                        this._closeEditorModal();
                    }).catch(() => {
                        document.getElementById('modal-textarea').select();
                        document.execCommand('copy');
                        this.showToast("コードを選択しました。Ctrl+Cでコピーしてください");
                        this._closeEditorModal();
                    });
                }
            });
        }
    }

    enterEditorMode() {
        this.state = STATE.EDITING;
        this.customStageData = this._loadEditorDraft() || this.customStageData || this._defaultCustomStage();
        
        this.loadStage(-1, true, this.customStageData);
        this.editorSelectedObject = null;
        this.editorTool = 'select';
        this.editorHasCleared = false;
        
        document.getElementById('app-layout').classList.add('editing-mode');
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('hud').style.opacity = '1';
        
        document.getElementById('editor-sidebar-left').classList.remove('hidden');
        document.getElementById('editor-sidebar-right').classList.remove('hidden');
        document.getElementById('editor-controls').classList.remove('hidden');
        
        this.updateInspector();
        this.syncEditorToolUI();
        this.syncPaletteUI();
        this.updateHUD();
        this.calculateLaserPath();
        this._resetEditorHistory();
    }

    exitEditorMode() {
        document.getElementById('app-layout').classList.remove('editing-mode');
        document.getElementById('editor-sidebar-left').classList.add('hidden');
        document.getElementById('editor-sidebar-right').classList.add('hidden');
        document.getElementById('editor-controls').classList.add('hidden');
        this._showTitleScreen();
    }

    syncEditorToolUI() {
        const tools = ['select', 'place', 'erase'];
        tools.forEach(t => {
            const btn = document.getElementById(`tool-${t}`);
            if (btn) {
                const active = t === this.editorTool;
                btn.classList.toggle('active', active);
                btn.setAttribute('aria-pressed', String(active));
            }
        });
    }

    syncPaletteUI() {
        const items = document.querySelectorAll('.palette-item');
        items.forEach(item => {
            const type = item.getAttribute('data-type');
            const active = type === this.editorActiveGimmick;
            item.classList.toggle('active', active);
            item.setAttribute('aria-pressed', String(active));
        });
    }

    startTestPlay() {
        this.customStageData = this.serializeStage();
        this.state = STATE.EDIT_PLAYING;

        document.getElementById('editor-back-btn').querySelector('span').textContent = "STOP";
        document.getElementById('editor-clear-btn').querySelector('span').textContent = "RESET";
        document.getElementById('editor-test-btn').querySelector('span').textContent = "EMIT";
        document.getElementById('tool-select').parentElement.classList.add('hidden');

        document.getElementById('editor-sidebar-left').style.opacity = '0.35';
        document.getElementById('editor-sidebar-right').style.opacity = '0.35';
        document.getElementById('editor-sidebar-left').style.pointerEvents = 'none';
        document.getElementById('editor-sidebar-right').style.pointerEvents = 'none';

        this.loadStage(-1, true, this.customStageData);
        this.showToast("テストプレイ開始！鏡を引き結晶へ光を導こう", false);
    }

    stopTestPlayAndReturnToEditor() {
        this.state = STATE.EDITING;

        document.getElementById('editor-back-btn').querySelector('span').textContent = "MENU";
        document.getElementById('editor-clear-btn').querySelector('span').textContent = "CLEAR_ALL";
        document.getElementById('editor-test-btn').querySelector('span').textContent = "TEST_PLAY";
        document.getElementById('tool-select').parentElement.classList.remove('hidden');

        document.getElementById('editor-sidebar-left').style.opacity = '1';
        document.getElementById('editor-sidebar-right').style.opacity = '1';
        document.getElementById('editor-sidebar-left').style.pointerEvents = 'auto';
        document.getElementById('editor-sidebar-right').style.pointerEvents = 'auto';

        this.loadStage(-1, true, this.customStageData);
        this.editorSelectedObject = null;
        this.updateInspector();
        this.calculateLaserPath();
        this.updateHUD();
        this.showToast("編集モードに戻りました", false);
    }

    handleEditorKeyboard(event) {
        if ((event.key === 'Enter' || event.key === ' ') && this.editorTool === 'place') {
            event.preventDefault();
            this.placeGimmick(this.editorActiveGimmick, this.editorKeyboardCursor);
            this.showToast("キャンバス中央に配置しました。矢印キーで位置を調整できます");
            return;
        }
        if ((event.key === 'Delete' || event.key === 'Backspace') && this.editorSelectedObject) {
            event.preventDefault();
            this.deleteSelectedObject();
            return;
        }
        const movement = {
            ArrowLeft: { x: -10, y: 0 },
            ArrowRight: { x: 10, y: 0 },
            ArrowUp: { x: 0, y: -10 },
            ArrowDown: { x: 0, y: 10 }
        }[event.key];
        if (!movement || !this.editorSelectedObject) return;
        event.preventDefault();
        const step = event.shiftKey ? 1 : 10;
        this._moveEditorObjectBy(movement.x / 10 * step, movement.y / 10 * step);
    }

    _moveEditorObjectBy(dx, dy) {
        const obj = this.editorSelectedObject;
        if (!obj) return;
        const clampX = value => Math.max(15, Math.min(CONFIG.WIDTH - 15, value));
        const clampY = value => Math.max(15, Math.min(CONFIG.HEIGHT - 15, value));
        if (obj instanceof Wormhole) {
            obj.inPort.x = clampX(obj.inPort.x + dx);
            obj.inPort.y = clampY(obj.inPort.y + dy);
            obj.outPort.x = clampX(obj.outPort.x + dx);
            obj.outPort.y = clampY(obj.outPort.y + dy);
        } else if (obj instanceof Block) {
            obj.startX = clampX(obj.startX + dx);
            obj.startY = clampY(obj.startY + dy);
            obj.x = obj.startX;
            obj.y = obj.startY;
            if (obj.moveOptions) {
                obj.moveOptions.targetX = clampX(obj.moveOptions.targetX + dx);
                obj.moveOptions.targetY = clampY(obj.moveOptions.targetY + dy);
            }
        } else {
            obj.x = clampX(obj.x + dx);
            obj.y = clampY(obj.y + dy);
        }
        this.editorHasCleared = false;
        this.calculateLaserPath();
        this.updateInspector();
        this.updateHUD();
        this._recordEditorState();
    }

    handleEditorPointerDown(pos, e) {
        if (e.shiftKey && this.editorSelectedObject instanceof Block && this.editorSelectedObject.moveOptions) {
            this.editorSelectedObject.moveOptions.targetX = Math.max(15, Math.min(CONFIG.WIDTH - 15, Math.round(pos.x)));
            this.editorSelectedObject.moveOptions.targetY = Math.max(15, Math.min(CONFIG.HEIGHT - 15, Math.round(pos.y)));
            this.editorHasCleared = false;
            this.calculateLaserPath();
            this.updateInspector();
            this.updateHUD();
            this._recordEditorState();
            return;
        }
        const hit = this.findObjectAt(pos);

        if (this.editorTool === 'erase') {
            if (hit) {
                if (hit.ref === this.emitter || hit.ref === this.prism) {
                    this.showToast("発射台とゴール結晶は削除できません");
                } else {
                    this.removeObject(hit.ref);
                    this.editorSelectedObject = null;
                    this.editorHasCleared = false;
                    this.updateInspector();
                    this.calculateLaserPath();
                    this.updateHUD();
                    this._recordEditorState();
                }
            }
        } else if (this.editorTool === 'place') {
            if (hit) {
                this.editorSelectedObject = hit.ref;
                this.editorTool = 'select';
                this.syncEditorToolUI();
                this.updateInspector();
                this.startDragging(hit, pos);
            } else {
                this.placeGimmick(this.editorActiveGimmick, pos);
            }
        } else if (this.editorTool === 'select') {
            if (hit) {
                this.editorSelectedObject = hit.ref;
                this.updateInspector();
                this.startDragging(hit, pos);
            } else {
                this.editorSelectedObject = null;
                this.updateInspector();
            }
        }
    }

    handleEditorPointerMove(pos, e) {
        if (this.editorDraggingObject) {
            const obj = this.editorDraggingObject;
            let newX = Math.round(pos.x - this.editorDragOffset.x);
            let newY = Math.round(pos.y - this.editorDragOffset.y);

            newX = Math.max(15, Math.min(CONFIG.WIDTH - 15, newX));
            newY = Math.max(15, Math.min(CONFIG.HEIGHT - 15, newY));

            if (obj === this.emitter || obj === this.prism || obj instanceof BlackHole || obj instanceof ColorFilter) {
                obj.x = newX;
                obj.y = newY;
            } else if (obj instanceof Wormhole) {
                obj[this.editorDragPart].x = newX;
                obj[this.editorDragPart].y = newY;
            } else if (obj instanceof Block) {
                if (obj.moveOptions) {
                    const dx = newX - obj.startX;
                    const dy = newY - obj.startY;
                    obj.startX = newX;
                    obj.startY = newY;
                    obj.x = newX;
                    obj.y = newY;
                    obj.moveOptions.targetX += dx;
                    obj.moveOptions.targetY += dy;
                } else {
                    obj.startX = newX;
                    obj.startY = newY;
                    obj.x = newX;
                    obj.y = newY;
                }
            }

            this.editorHasCleared = false;
            this.editorDragChanged = true;
            this.calculateLaserPath();
            this.updateInspector();
        } else if (this.editorDraggingPatrolTarget) {
            const obj = this.editorSelectedObject;
            let newX = Math.round(pos.x);
            let newY = Math.round(pos.y);

            newX = Math.max(15, Math.min(CONFIG.WIDTH - 15, newX));
            newY = Math.max(15, Math.min(CONFIG.HEIGHT - 15, newY));

            obj.moveOptions.targetX = newX;
            obj.moveOptions.targetY = newY;

            this.editorHasCleared = false;
            this.editorDragChanged = true;
            this.calculateLaserPath();
            this.updateInspector();
        }
    }

    handleEditorPointerUp() {
        this.editorDraggingObject = null;
        this.editorDragPart = null;
        this.editorDraggingPatrolTarget = false;
        this.updateHUD();
        if (this.editorDragChanged) {
            this._recordEditorState();
            this.editorDragChanged = false;
        }
    }

    findObjectAt(pos) {
        for (const p of this.portals) {
            if (dist(pos, p.inPort) <= p.radius + 6) return { type: 'portal', ref: p, part: 'inPort' };
            if (dist(pos, p.outPort) <= p.radius + 6) return { type: 'portal', ref: p, part: 'outPort' };
        }

        if (this.editorSelectedObject && this.editorSelectedObject instanceof Block && this.editorSelectedObject.moveOptions) {
            const targetPos = { x: this.editorSelectedObject.moveOptions.targetX, y: this.editorSelectedObject.moveOptions.targetY };
            if (dist(pos, targetPos) <= 15) {
                return { type: 'patrol-target', ref: this.editorSelectedObject };
            }
        }

        for (const b of this.blocks) {
            if (dist(pos, b) <= b.radius + 6) return { type: 'block', ref: b };
        }

        for (const bh of this.blackholes) {
            if (dist(pos, bh) <= bh.radius + 6) return { type: 'blackhole', ref: bh };
        }

        for (const f of this.colorFilters) {
            if (dist(pos, f) <= f.radius + 6) return { type: 'colorfilter', ref: f };
        }

        if (dist(pos, this.prism) <= this.prism.radius + 6) return { type: 'prism', ref: this.prism };
        if (dist(pos, this.emitter) <= 20) return { type: 'emitter', ref: this.emitter };

        return null;
    }

    startDragging(hit, pos) {
        if (hit.type === 'patrol-target') {
            this.editorDraggingPatrolTarget = true;
        } else {
            this.editorDraggingObject = hit.ref;
            this.editorDragPart = hit.part || null;
            
            let tx = 0, ty = 0;
            if (hit.ref === this.emitter || hit.ref === this.prism || hit.ref instanceof BlackHole || hit.ref instanceof Block || hit.ref instanceof ColorFilter) {
                tx = hit.ref.x; ty = hit.ref.y;
            } else if (hit.ref instanceof Wormhole) {
                tx = hit.ref[hit.part].x; ty = hit.ref[hit.part].y;
            }
            
            this.editorDragOffset = {
                x: pos.x - tx,
                y: pos.y - ty
            };
        }
    }

    placeGimmick(type, pos) {
        const x = Math.round(pos.x);
        const y = Math.round(pos.y);
        let newObj = null;

        if (type === 'emitter') {
            this.emitter.x = x;
            this.emitter.y = y;
            newObj = this.emitter;
        } else if (type === 'prism') {
            this.prism.x = x;
            this.prism.y = y;
            newObj = this.prism;
        } else if (type === 'blackhole') {
            newObj = new BlackHole(x, y, 60, 140);
            this.blackholes.push(newObj);
        } else if (type === 'portal') {
            newObj = new Wormhole(x, y, Math.min(CONFIG.WIDTH - 40, x + 80), y);
            this.portals.push(newObj);
        } else if (type === 'block') {
            newObj = new Block(x, y, 18, null);
            this.blocks.push(newObj);
        } else if (type === 'patrol') {
            newObj = new Block(x, y, 18, {
                targetX: Math.min(CONFIG.WIDTH - 40, x + 100),
                targetY: y,
                speed: 70
            });
            this.blocks.push(newObj);
        } else if (type === 'colorfilter') {
            newObj = new ColorFilter(x, y, '#ff003c', 18);
            this.colorFilters.push(newObj);
        }

        if (newObj) {
            this.editorSelectedObject = newObj;
            this.editorHasCleared = false;
            this.editorTool = 'select';
            this.syncEditorToolUI();
            this.updateInspector();
            this.calculateLaserPath();
            this.updateHUD();
            this._recordEditorState();
            audio.playCrystalClang(x);
        }
    }

    removeObject(obj) {
        if (this.blackholes.includes(obj)) {
            this.blackholes = this.blackholes.filter(item => item !== obj);
        } else if (this.portals.includes(obj)) {
            this.portals = this.portals.filter(item => item !== obj);
        } else if (this.blocks.includes(obj)) {
            this.blocks = this.blocks.filter(item => item !== obj);
        } else if (this.colorFilters.includes(obj)) {
            this.colorFilters = this.colorFilters.filter(item => item !== obj);
        }
    }

    deleteSelectedObject() {
        const obj = this.editorSelectedObject;
        if (!obj) return;
        if (obj === this.emitter || obj === this.prism) {
            this.showToast("発射台とゴール結晶は削除できません");
            return;
        }

        this.removeObject(obj);
        this.editorSelectedObject = null;
        this.editorHasCleared = false;
        this.updateInspector();
        this.calculateLaserPath();
        this.updateHUD();
        this._recordEditorState();
    }

    updateInspector() {
        const panelEl = document.getElementById('inspector-panel');
        const emptyEl = document.getElementById('inspector-empty');
        const detailsEl = document.getElementById('inspector-details');
        const typeEl = document.getElementById('prop-type');
        const angleGroup = document.getElementById('prop-angle-group');
        const angleInput = document.getElementById('prop-angle');
        const angleVal = document.getElementById('prop-angle-val');
        const colorGroup = document.getElementById('prop-color-group');
        const speedGroup = document.getElementById('prop-speed-group');
        const speedInput = document.getElementById('prop-speed');
        const speedVal = document.getElementById('prop-speed-val');

        const obj = this.editorSelectedObject;

        if (!obj) {
            emptyEl.classList.remove('hidden');
            detailsEl.classList.add('hidden');
            if (panelEl) panelEl.classList.remove('active-panel');
            return;
        }

        emptyEl.classList.add('hidden');
        detailsEl.classList.remove('hidden');
        if (panelEl) panelEl.classList.add('active-panel');

        angleGroup.classList.add('hidden');
        colorGroup.classList.add('hidden');
        speedGroup.classList.add('hidden');

        if (obj === this.emitter) {
            typeEl.textContent = "EMITTER (発射台)";
            angleGroup.classList.remove('hidden');
            const deg = Math.round((obj.angle * 180 / Math.PI) % 360);
            angleInput.value = deg;
            angleVal.textContent = deg;
        } else if (obj === this.prism) {
            typeEl.textContent = "PRISM (結晶ゴール)";
            colorGroup.classList.remove('hidden');
            this.syncColorPickerButtons(obj.targetColor || '#00f3ff');
        } else if (obj instanceof BlackHole) {
            typeEl.textContent = "BLACK HOLE (ブラックホール)";
        } else if (obj instanceof Wormhole) {
            typeEl.textContent = "PORTAL (ワームホール)";
        } else if (obj instanceof Block) {
            if (obj.moveOptions) {
                typeEl.textContent = "PATROL (巡回ブロック)";
                speedGroup.classList.remove('hidden');
                speedInput.value = obj.moveOptions.speed;
                speedVal.textContent = obj.moveOptions.speed;
            } else {
                typeEl.textContent = "BLOCK (遮光ブロック)";
            }
        } else if (obj instanceof ColorFilter) {
            typeEl.textContent = "FILTER (カラーフィルター)";
            colorGroup.classList.remove('hidden');
            this.syncColorPickerButtons(obj.color);
        }
    }

    syncColorPickerButtons(activeColor) {
        const buttons = document.querySelectorAll('.color-picker-btn');
        buttons.forEach(btn => {
            const color = btn.getAttribute('data-color');
            const active = color === activeColor;
            btn.setAttribute('aria-pressed', String(active));
            if (active) {
                btn.classList.add('active');
                btn.style.borderColor = '#ffffff';
            } else {
                btn.classList.remove('active');
                btn.style.borderColor = 'transparent';
            }
        });
    }

    serializeStage() {
        return {
            v: 4,
            title: this._sanitizeStageTitle(document.getElementById('prop-title')?.value || this.customStageData?.title),
            inkCapacity: this.maxInkForStage,
            emitter: {
                x: Math.round(this.emitter.x),
                y: Math.round(this.emitter.y),
                angle: Number(this.emitter.angle.toFixed(4))
            },
            prism: {
                x: Math.round(this.prism.x),
                y: Math.round(this.prism.y),
                radius: Math.round(this.prism.radius),
                targetColor: this.prism.targetColor
            },
            blackholes: this.blackholes.map(b => ({
                x: Math.round(b.x),
                y: Math.round(b.y),
                mass: Math.round(b.mass),
                radius: Math.round(b.pullRadius)
            })),
            portals: this.portals.map(p => ({
                inX: Math.round(p.inPort.x),
                inY: Math.round(p.inPort.y),
                outX: Math.round(p.outPort.x),
                outY: Math.round(p.outPort.y)
            })),
            blocks: this.blocks.map(b => ({
                x: Math.round(b.startX),
                y: Math.round(b.startY),
                radius: Math.round(b.radius),
                moveOptions: b.moveOptions ? {
                    targetX: Math.round(b.moveOptions.targetX),
                    targetY: Math.round(b.moveOptions.targetY),
                    speed: Math.round(b.moveOptions.speed)
                } : null
            })),
            colorFilters: this.colorFilters.map(f => ({
                x: Math.round(f.x),
                y: Math.round(f.y),
                color: f.color,
                radius: Math.round(f.radius)
            }))
        };
    }

    normalizeCustomStageData(data) {
        if (!data || typeof data !== 'object' || !data.emitter || !data.prism) return null;
        if (data.v != null && data.v !== 2 && data.v !== 3 && data.v !== 4) return null;

        const validNumber = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
        const validPoint = (point) => point
            && validNumber(point.x, 0, CONFIG.WIDTH)
            && validNumber(point.y, 0, CONFIG.HEIGHT);
        const validColor = (color) => color === null || ['#00f3ff', '#ff003c', '#00ff3c'].includes(color);
        const arrays = ['blackholes', 'portals', 'blocks', 'colorFilters'];
        if (arrays.some(key => data[key] != null && !Array.isArray(data[key]))) return null;

        const inkCapacity = data.inkCapacity ?? data.ink;
        const targetColor = data.prism.targetColor ?? data.prism.color ?? null;
        if (!validNumber(inkCapacity, 150, 1500)
            || !validPoint(data.emitter)
            || !Number.isFinite(data.emitter.angle)
            || !validPoint(data.prism)
            || !validNumber(data.prism.radius, 1, 100)
            || !validColor(targetColor)) {
            return null;
        }

        const blackholes = data.blackholes || [];
        const portals = data.portals || [];
        const blocks = data.blocks || [];
        const colorFilters = data.colorFilters || [];
        if (!blackholes.every(item => validPoint(item)
            && validNumber(item.mass, 1, 500)
            && validNumber(item.radius, 1, 500))) return null;
        if (!portals.every(item => validNumber(item.inX, 0, CONFIG.WIDTH)
            && validNumber(item.inY, 0, CONFIG.HEIGHT)
            && validNumber(item.outX, 0, CONFIG.WIDTH)
            && validNumber(item.outY, 0, CONFIG.HEIGHT))) return null;
        if (!blocks.every(item => validPoint(item)
            && validNumber(item.radius, 1, 100)
            && (item.moveOptions == null || (
                validNumber(item.moveOptions.targetX, 0, CONFIG.WIDTH)
                && validNumber(item.moveOptions.targetY, 0, CONFIG.HEIGHT)
                && validNumber(item.moveOptions.speed, 20, 220)
            )))) return null;
        if (!colorFilters.every(item => validPoint(item)
            && validNumber(item.radius, 1, 100)
            && validColor(item.color))) return null;

        // 旧共有コードを現行スキーマへ変換し、内部状態は一形式で扱う。
        return {
            v: 4,
            title: this._sanitizeStageTitle(data.title),
            inkCapacity,
            emitter: { ...data.emitter },
            prism: { x: data.prism.x, y: data.prism.y, radius: data.prism.radius, targetColor },
            blackholes: blackholes.map(item => ({ ...item })),
            portals: portals.map(item => ({ ...item })),
            blocks: blocks.map(item => ({
                ...item,
                moveOptions: item.moveOptions ? { ...item.moveOptions } : null
            })),
            colorFilters: colorFilters.map(item => ({ ...item }))
        };
    }

    deserializeStage(code) {
        const matchedCode = String(code).match(/LMN-[A-Za-z0-9+/=]+/);
        if (!matchedCode) return null;
        const base64 = matchedCode[0].substring(4);
        try {
            const json = decodeURIComponent(escape(atob(base64)));
            const data = JSON.parse(json);
            return this.normalizeCustomStageData(data);
        } catch (e) {
            console.error("Failed to decode stage code", e);
        }
        return null;
    }

    drawGrid() {
        const ctx = this.ctx;
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.04)';
        ctx.lineWidth = 0.8;
        
        const step = 40;
        for (let x = step; x < CONFIG.WIDTH; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, CONFIG.HEIGHT);
            ctx.stroke();
        }
        for (let y = step; y < CONFIG.HEIGHT; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(CONFIG.WIDTH, y);
            ctx.stroke();
        }
        ctx.restore();
    }

    drawEditorSelection() {
        if (this.state !== STATE.EDITING || !this.editorSelectedObject) return;
        const ctx = this.ctx;
        const obj = this.editorSelectedObject;

        ctx.save();
        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1.5;
        ctx.shadowBlur = 10;
        ctx.shadowColor = 'rgba(0, 243, 255, 0.7)';
        ctx.setLineDash([4, 4]);

        let cx = 0, cy = 0, r = 22;
        
        if (obj === this.emitter) {
            cx = obj.x; cy = obj.y; r = 18;
        } else if (obj === this.prism) {
            cx = obj.x; cy = obj.y; r = 24;
        } else if (obj instanceof BlackHole) {
            cx = obj.x; cy = obj.y; r = 22;
            
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
            ctx.beginPath();
            ctx.arc(cx, cy, obj.pullRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        } else if (obj instanceof Wormhole) {
            ctx.save();
            ctx.strokeStyle = 'rgba(0, 191, 255, 0.3)';
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(obj.inPort.x, obj.inPort.y);
            ctx.lineTo(obj.outPort.x, obj.outPort.y);
            ctx.stroke();
            ctx.restore();

            ctx.beginPath();
            ctx.arc(obj.inPort.x, obj.inPort.y, obj.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(obj.outPort.x, obj.outPort.y, obj.radius + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
            return;
        } else if (obj instanceof Block) {
            cx = obj.x; cy = obj.y; r = obj.radius + 4;
            if (obj.moveOptions) {
                ctx.save();
                ctx.strokeStyle = 'rgba(255, 170, 0, 0.4)';
                ctx.setLineDash([3, 5]);
                ctx.beginPath();
                ctx.moveTo(obj.startX, obj.startY);
                ctx.lineTo(obj.moveOptions.targetX, obj.moveOptions.targetY);
                ctx.stroke();

                ctx.fillStyle = 'rgba(255, 170, 0, 0.15)';
                ctx.strokeStyle = '#ffaa00';
                ctx.setLineDash([]);
                ctx.beginPath();
                ctx.arc(obj.moveOptions.targetX, obj.moveOptions.targetY, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = '#ffaa00';
                ctx.font = "8px 'Inter', sans-serif";
                ctx.textAlign = 'center';
                ctx.fillText("TARGET", obj.moveOptions.targetX, obj.moveOptions.targetY - 16);
                ctx.restore();
            }
        } else if (obj instanceof ColorFilter) {
            cx = obj.x; cy = obj.y; r = obj.radius + 4;
        }

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => { new GameController(); });
