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
        try {
            this.ctx = new AC();
            this._setupIceSynth();
        } catch (_) {
            this.ctx = null;
            this.iceGain = null;
            this.iceFilter = null;
            this.icePanner = null;
            this.isPlayingIce = false;
        }
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
