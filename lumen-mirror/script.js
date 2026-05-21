/* ==========================================================================
   LUMEN_MIRROR - MAXIMUM QUALITY ENGINE v2.0
   ========================================================================== */

// --- Constants & Config ---
const CONFIG = {
    WIDTH: 600,
    HEIGHT: 800,
    MAX_REFLECTIONS: 14,
    LASER_SPEED: 3600,   // doubled from 1800
    PARTICLE_COUNT: 30,
};

const STATE = {
    TITLE: 0,
    STAGE_SELECT: 1,
    PLAYING: 2,
    EMITTING: 3,
    CLEAR: 4,
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
    constructor(x, y, radius = 20) {
        this.x = x; this.y = y; this.radius = radius;
        this.angle = 0; this.isTuned = false;
        this.clearRipples = []; // radial ripple animation on clear
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
        // Draw ripples first (behind the prism)
        for (const rp of this.clearRipples) {
            if (rp.alpha <= 0) continue;
            ctx.save();
            ctx.strokeStyle = `rgba(0, 243, 255, ${rp.alpha})`;
            ctx.lineWidth = 1.5;
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'rgba(0, 243, 255, 0.5)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, rp.r, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        ctx.save();
        ctx.translate(this.x, this.y); ctx.rotate(this.angle);
        ctx.shadowBlur = this.isTuned ? 35 : 12;
        ctx.shadowColor = this.isTuned ? 'rgba(255, 0, 127, 0.95)' : 'rgba(255, 0, 127, 0.45)';
        ctx.strokeStyle = '#ff007f';
        ctx.lineWidth = this.isTuned ? 3.0 : 1.8;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius); ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius); ctx.lineTo(-this.radius, 0);
        ctx.closePath(); ctx.stroke();
        ctx.strokeStyle = this.isTuned ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 0, 127, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = this.isTuned ? '#ffffff' : 'rgba(255, 0, 127, 0.15)';
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
            { type: 'mirror', name: 'MIRROR', desc: 'ドラッグで鏡を引く。光は鏡面で角度の法則に従い完全反射する。インクを節約するほど高ランクが狙える。' }
        ],
        emitter: { x: 80, y: 150, angle: 0 },
        prism: { x: 520, y: 650, radius: 20 },
        blackholes: [], portals: [],
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
            { type: 'mirror', name: 'MIRROR ×2', desc: '二枚の鏡を使って光を誘導する。鏡を置く順番と角度で、届く先が決まる。' }
        ],
        emitter: { x: 80, y: 150, angle: Math.PI * 0.25 },
        prism: { x: 500, y: 150, radius: 20 },
        blackholes: [], portals: [],
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
            { type: 'mirror', name: 'MIRROR', desc: '迂回路を作る鏡を配置せよ。' },
            { type: 'blackhole', name: 'BLACK HOLE', desc: '引力圏（点線）内に入った光は軌道が歪む。中心に触れた光は消滅する。⚠ GRAVITY FIELD を迂回せよ。' }
        ],
        emitter: { x: 80, y: 400, angle: 0 },
        prism: { x: 520, y: 400, radius: 20 },
        blackholes: [{ x: 300, y: 400, mass: 75, radius: 140 }],
        portals: [],
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
            { type: 'mirror', name: 'MIRROR', desc: 'ポータルへ光を向けるための鏡を引け。' },
            { type: 'wormhole', name: 'WORMHOLE', desc: 'PORT_IN（青）へ入った光はPORT_OUT（橙）から同じ速度・同じ角度で出現する。方向転換はしない。' }
        ],
        emitter: { x: 80, y: 150, angle: Math.PI * 0.15 },
        prism: { x: 520, y: 650, radius: 20 },
        blackholes: [],
        portals: [{ inX: 300, inY: 280, outX: 180, outY: 580 }],
        parMirrorLength: 350, inkCapacity: 620,
        hints: ["青いポータル(PORT_IN)に光を当てよ", "光はオレンジ(PORT_OUT)から同じ角度で飛び出す"]
    },
    {
        id: 4,
        name: "CELESTIAL_DESIGNS",
        displayName: "TUNING_05: CELESTIAL_DESIGNS",
        gimmicks: "BH + ワームホール",
        story: "重力の井戸と次元の裂け目が同時に存在する。すべての障害を利用、あるいは回避して、光を目的地へ運べ。",
        objective: "ブラックホールを避けつつ、ポータルを活用して結晶へ届けよ",
        gimmickList: [
            { type: 'blackhole', name: 'BLACK HOLE', desc: '引力圏を迂回するか、ギリギリを掠めて方向転換に利用せよ。' },
            { type: 'wormhole', name: 'WORMHOLE', desc: '戦略的にポータルを通過させ、最短経路を構築せよ。' }
        ],
        emitter: { x: 80, y: 120, angle: 0 },
        prism: { x: 520, y: 700, radius: 20 },
        blackholes: [{ x: 250, y: 550, mass: 90, radius: 150 }],
        portals: [{ inX: 520, inY: 180, outX: 120, outY: 420 }],
        parMirrorLength: 500, inkCapacity: 820,
        hints: []
    },
    {
        id: 5,
        name: "MIRROR_MAZE",
        displayName: "TUNING_06: MIRROR_MAZE",
        gimmicks: "精密多重反射",
        story: "精密さだけが生き残る。複雑な反射経路を組み上げ、見えない迷路を光で照らし出せ。",
        objective: "多重反射とポータルを組み合わせて、右上の結晶へ届けよ",
        gimmickList: [
            { type: 'mirror', name: 'MIRROR（多重）', desc: '複数の鏡を精密に配置して経路を構築せよ。インクの使い方が鍵。' },
            { type: 'wormhole', name: 'WORMHOLE', desc: '空間転送を組み合わせることで、短い経路が見えてくる。' }
        ],
        emitter: { x: 80, y: 700, angle: -Math.PI * 0.35 },
        prism: { x: 520, y: 100, radius: 20 },
        blackholes: [],
        portals: [{ inX: 480, inY: 500, outX: 120, outY: 250 }],
        parMirrorLength: 480, inkCapacity: 750,
        hints: []
    },
    {
        id: 6,
        name: "SINGULARITY",
        displayName: "TUNING_07: SINGULARITY",
        gimmicks: "BH×2 + ワームホール",
        story: "最終試練——二つの特異点が空間を掌握している。ワームホールを制し、二つの重力場を乗り越えよ。残存する光だけが、終着点に辿り着く。",
        objective: "二つのブラックホールとワームホールをすべて攻略して、右下の結晶へ届けよ",
        gimmickList: [
            { type: 'blackhole', name: 'BLACK HOLE ×2', desc: '二つの重力場が互いに干渉する。慎重に経路を選べ。重力を方向転換に活用する高度な攻略も存在する。' },
            { type: 'wormhole', name: 'WORMHOLE', desc: '次元転送を活用しなければ突破は難しい。ポータルの出口位置を意識して設計せよ。' }
        ],
        emitter: { x: 80, y: 400, angle: -Math.PI * 0.2 },
        prism: { x: 520, y: 650, radius: 20 },
        blackholes: [
            { x: 200, y: 250, mass: 60, radius: 120 },
            { x: 420, y: 500, mass: 70, radius: 130 }
        ],
        portals: [{ inX: 300, inY: 180, outX: 480, outY: 300 }],
        parMirrorLength: 600, inkCapacity: 900,
        hints: []
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

        this.initCanvas();
        this.bindEvents();
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
        document.getElementById('info-panel').classList.remove('hidden');
    }

    _closeInfoPanel() {
        document.getElementById('info-panel').classList.add('hidden');
    }

    _populateInfoPanel() {
        const tmpl = STAGE_TEMPLATES[this.currentStageIdx];
        document.getElementById('info-stg-num').textContent = `STG_0${this.currentStageIdx + 1}`;
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
            const cx = e.touches ? e.touches[0].clientX : e.clientX;
            const cy = e.touches ? e.touches[0].clientY : e.clientY;
            return {
                x: ((cx - rect.left) / rect.width) * CONFIG.WIDTH,
                y: ((cy - rect.top) / rect.height) * CONFIG.HEIGHT
            };
        };

        const handleDown = (e) => {
            this._unlock();
            if (this.state !== STATE.PLAYING) return;
            if (e.target.tagName === 'BUTTON') return;
            e.preventDefault();
            const pos = getPos(e);
            const eraseIdx = this.findMirrorAt(pos, 30);
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
            if (this.inkLeft > 10) {
                this.isDrawing = true;
                this.drawStart = pos; this.drawEnd = pos;
                this.lastMousePos = pos;
                audio.startIceScratch(pos.x);
            }
        };

        const handleMove = (e) => {
            if (this.state !== STATE.PLAYING) return;
            e.preventDefault();
            const pos = getPos(e);
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
                this.hoveredMirrorIdx = this.findMirrorAt(pos, 30);
                if (prev !== this.hoveredMirrorIdx) this._updateModeIndicator();
            }
        };

        const handleUp = () => {
            if (this.isDrawing) {
                this.isDrawing = false;
                audio.stopIceScratch();
                const len = dist(this.drawStart, this.drawEnd);
                if (len > 8) {
                    this.mirrors.push(new Mirror(this.drawStart.x, this.drawStart.y, this.drawEnd.x, this.drawEnd.y));
                    this.inkLeft -= len;
                    this.updateHUD();
                    this.calculateLaserPath();
                }
                this._updateModeIndicator();
            }
        };

        this.canvas.addEventListener('mousedown', handleDown);
        this.canvas.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        this.canvas.addEventListener('touchstart', handleDown, { passive: false });
        this.canvas.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp, { passive: false });

        // Button wiring
        document.getElementById('start-btn').addEventListener('click', () => {
            this._unlock();
            this._showStageSelect();
        });
        document.getElementById('menu-back-btn').addEventListener('click', () => {
            window.location.href = '../minigames.html';
        });
        document.getElementById('back-btn').addEventListener('click', () => {
            window.location.href = '../minigames.html';
        });
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

    findMirrorAt(pos, threshold = 22) {
        for (let i = 0; i < this.mirrors.length; i++) {
            if (this.mirrors[i].distanceToPoint(pos) <= threshold) return i;
        }
        return -1;
    }

    // ---- Stage Loading ----
    loadStage(idx) {
        this.currentStageIdx = idx;
        const tmpl = STAGE_TEMPLATES[idx];

        this.emitter = new Emitter(tmpl.emitter.x, tmpl.emitter.y, tmpl.emitter.angle);
        this.prism = new Prism(tmpl.prism.x, tmpl.prism.y, tmpl.prism.radius);
        this.blackholes = (tmpl.blackholes || []).map(b => new BlackHole(b.x, b.y, b.mass, b.radius));
        this.portals = (tmpl.portals || []).map(p => new Wormhole(p.inX, p.inY, p.outX, p.outY));

        this.mirrors = [];
        this.maxInkForStage = tmpl.inkCapacity || 500;
        this.inkLeft = this.maxInkForStage;
        this.hasHitPrism = false;
        this.hoveredMirrorIdx = -1;
        this.chainFlashQueue = [];
        this.chainFlashTimer = 0;

        this.updateHUD();
        this.calculateLaserPath();
        this._updateModeIndicator();

        this.showToast(`STG_0${idx + 1}: ${tmpl.name}`, false);
        // Show stage-specific hints
        if (tmpl.hints && tmpl.hints.length > 0) {
            tmpl.hints.forEach((hint, i) => {
                setTimeout(() => this.showToast(hint, true), 1200 + i * 2000);
            });
        }
    }

    updateHUD() {
        document.getElementById('stage-name').innerText = `STG_0${this.currentStageIdx + 1}`;
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
            emitBtn.disabled = true;
            resetBtn.disabled = true;
        }
    }

    resetStage() {
        if (this.state !== STATE.PLAYING) return;
        audio.playCrystalClang(300);
        this.loadStage(this.currentStageIdx);
    }

    nextStage() {
        document.getElementById('overlay').classList.add('hidden');
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
        this.laserCache = [{ ...rayStart }];
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

            // Portal check
            if (steps - lastPortalStep > 15) {
                for (const portal of this.portals) {
                    if (portal.containsEntrance(pt)) {
                        this.laserCache.push({ x: portal.inPort.x, y: portal.inPort.y });
                        this.reflectionPoints.push({ x: portal.inPort.x, y: portal.inPort.y, type: 'portal', exitX: portal.outPort.x, exitY: portal.outPort.y });
                        pt = { x: portal.outPort.x, y: portal.outPort.y };
                        this.laserCache.push({ ...pt });
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
                            this.laserCache.push({ x: bh.x + Math.cos(angle) * d * (45 - j) / 45, y: bh.y + Math.sin(angle) * d * (45 - j) / 45 });
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

            // Boundary
            if (next.x < -15 || next.x > CONFIG.WIDTH + 15 || next.y < -15 || next.y > CONFIG.HEIGHT + 15) {
                this.laserCache.push(next); break;
            }

            // Prism
            if (this.prism.containsPoint(next)) {
                this.laserCache.push(next);
                this.hasHitPrism = true;
                this.reflectionPoints.push({ x: next.x, y: next.y, type: 'prism' });
                break;
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
                this.laserCache.push(hitInfo);
                this.reflectionPoints.push({ x: hitInfo.x, y: hitInfo.y, type: 'mirror', mirrorRef: colMirror });
                lastBouncedMirror = colMirror;
                if (this.reflectionPoints.filter(p => p.type === 'mirror').length > CONFIG.MAX_REFLECTIONS) break;
            } else {
                pt = next;
            }

            this.laserCache.push({ ...pt });
            steps++;
        }
    }

    emitPhoton() {
        if (this.state !== STATE.PLAYING) return;
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

        const banner = document.getElementById('best-banner');
        if (isNewBest) banner.classList.remove('hidden'); else banner.classList.add('hidden');

        // Show NEXT_STAGE or hide it on last stage
        const nextBtn = document.getElementById('next-btn');
        nextBtn.style.display = this.currentStageIdx + 1 < STAGE_TEMPLATES.length ? 'block' : 'none';

        setTimeout(() => {
            document.getElementById('overlay').classList.remove('hidden');
            this.updateHUD();
        }, 1400);
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

        // Chain flash update
        if (this.chainFlashQueue.length > 0) {
            this.chainFlashTimer += dt;
            if (this.chainFlashTimer > 0.12) {
                this.chainFlashTimer = 0;
                const m = this.chainFlashQueue.shift();
                if (m) m.flashTimer = 0.5;
            }
        }
        // Tick mirror flash timers
        for (const m of this.mirrors) {
            if (m.flashTimer > 0) m.flashTimer = Math.max(0, m.flashTimer - dt);
        }

        // Photon animation
        if (this.state === STATE.EMITTING) {
            if (this.currentSegmentIdx < this.laserCache.length - 1) {
                const p1 = this.laserCache[this.currentSegmentIdx];
                const p2 = this.laserCache[this.currentSegmentIdx + 1];
                const segLen = dist(p1, p2);
                const segTime = segLen / CONFIG.LASER_SPEED;
                this.segmentProgress += segTime > 0 ? dt / segTime : 1;

                if (this.segmentProgress >= 1) {
                    this.photonPosition = { ...p2 };
                    this.currentSegmentIdx++;
                    this.segmentProgress = 0;

                    const next = this.laserCache[this.currentSegmentIdx];
                    if (next) {
                        const evt = this.reflectionPoints.find(rp => dist(rp, next) < 2.0);
                        if (evt) {
                            if (evt.type === 'mirror') {
                                audio.playCrystalClang(next.x);
                                this.particles.spawn(next.x, next.y, '#00f3ff', 20);
                            } else if (evt.type === 'portal') {
                                audio.playPortalWarp(evt.x, evt.exitX);
                                this.particles.spawn(evt.x, evt.y, '#00bfff', 15);
                                this.particles.spawn(evt.exitX, evt.exitY, '#ff8c00', 15);
                            } else if (evt.type === 'prism' && this.hasHitPrism) {
                                this.triggerClear();
                            } else if (evt.type === 'blackhole') {
                                // Immediately change state to prevent re-firing every frame
                                this.state = STATE.PLAYING;
                                this.particles.spawn(next.x, next.y, '#00f3ff', 20);
                                this.showToast("光は幾何学から外れ、深淵に消えた");
                                setTimeout(() => {
                                    this.calculateLaserPath();
                                    this.updateHUD();
                                }, 800);
                            }
                        }
                    }
                } else {
                    this.photonPosition.x = p1.x + (p2.x - p1.x) * this.segmentProgress;
                    this.photonPosition.y = p1.y + (p2.y - p1.y) * this.segmentProgress;
                }
            } else {
                if (!this.hasHitPrism && this.state === STATE.EMITTING) {
                    // Immediately change state to prevent showToast firing every frame
                    this.state = STATE.PLAYING;
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

        if (!this.emitter) return; // Not yet initialized

        this.emitter.draw(this.ctx);
        this.prism.draw(this.ctx);
        this.blackholes.forEach(bh => bh.draw(this.ctx));
        this.portals.forEach(p => p.draw(this.ctx));

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
        if (this.state === STATE.PLAYING) {
            this._drawLaserPath(this.laserCache, 'rgba(0, 243, 255, 0.45)', 1.2, true);
        } else if (this.state === STATE.EMITTING) {
            const segs = this.laserCache.slice(0, this.currentSegmentIdx + 1);
            if (this.segmentProgress > 0 && this.currentSegmentIdx < this.laserCache.length - 1) {
                segs.push({ ...this.photonPosition });
            }
            this._drawLaserPath(segs, '#00f3ff', 2.2, false);
            // Photon core
            this.ctx.save();
            this.ctx.shadowBlur = 20; this.ctx.shadowColor = '#00f3ff';
            this.ctx.fillStyle = '#ffffff';
            this.ctx.beginPath(); this.ctx.arc(this.photonPosition.x, this.photonPosition.y, 4.5, 0, Math.PI * 2); this.ctx.fill();
            this.ctx.restore();
        } else if (this.state === STATE.CLEAR) {
            this._drawLaserPath(this.laserCache, '#00f3ff', 3.2, false);
        }

        this.particles.draw(this.ctx);
    }

    _drawTutorialOverlay() {
        const ctx = this.ctx;
        ctx.save();
        const t = Date.now() * 0.004;
        const pulse = Math.sin(t) * 0.15;
        const fadeAlpha = 0.85 + pulse;

        // ---- Helper: rounded rect (iOS Safari compatible) ----
        const roundRect = (x, y, w, h, r) => {
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
        };

        // ============================================================
        // PANEL: Upper-center hint box
        // Placed at y=180 to avoid overlapping emitter at (80,150)
        // ============================================================
        const panelW = 370, panelH = 104;
        const panelX = (CONFIG.WIDTH - panelW) / 2; // centered
        const panelY = 185;

        // Panel BG
        ctx.fillStyle = 'rgba(3, 3, 8, 0.82)';
        roundRect(panelX, panelY, panelW, panelH, 8);
        ctx.fill();

        // Panel border (animated glow)
        ctx.strokeStyle = `rgba(0, 243, 255, ${0.2 + pulse * 0.6})`;
        ctx.lineWidth = 1.5;
        roundRect(panelX, panelY, panelW, panelH, 8);
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
        _ctxArrow(ctx,
            { x: this.emitter.x + 22, y: this.emitter.y - 2 },
            { x: mx1 - 8, y: (my1 + my2) / 2 + 2 },
            `rgba(0, 243, 255, ${0.4 + pulse})`);

        // Arrow: from prism → upward hint
        _ctxArrow(ctx,
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

    _drawLaserPath(path, color, width, isDashed) {
        if (path.length < 2) return;
        this.ctx.save();
        this.ctx.strokeStyle = color; this.ctx.lineWidth = width;
        this.ctx.shadowBlur = width > 1.5 ? 15 : 6;
        this.ctx.shadowColor = 'rgba(0, 243, 255, 0.8)';
        if (isDashed) this.ctx.setLineDash([8, 12]);
        this.ctx.beginPath(); this.ctx.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) this.ctx.lineTo(path[i].x, path[i].y);
        this.ctx.stroke(); this.ctx.restore();
    }
}

// ============================================================
// STANDALONE HELPERS
// ============================================================
function _ctxArrow(ctx, from, to, color) {
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
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => { new GameController(); });
