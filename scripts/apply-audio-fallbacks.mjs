import { readFileSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  const source = readFileSync(path, 'utf8');
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${path}: expected audio init snippet not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${path}: expected audio init snippet is not unique`);
  }
  const updated = source.slice(0, first) + after + source.slice(first + before.length);
  writeFileSync(path, updated, 'utf8');
}

replaceOnce(
  'blackhole-sweeper/script.js',
`    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.ctx.destination);
        this.initialized = true;
    }`,
`    init() {
        if (this.initialized) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
            const ctx = new AudioContext();
            const masterGain = ctx.createGain();
            masterGain.gain.value = 0.3;
            masterGain.connect(ctx.destination);
            this.ctx = ctx;
            this.masterGain = masterGain;
            this.initialized = true;
        } catch (_) {
            this.ctx = null;
            this.masterGain = null;
            this.initialized = false;
        }
    }`
);

const managedAudioBefore = `    init() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.audioCtx = new AudioContextClass();
                this.masterGain = this.audioCtx.createGain();
                this.masterGain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
                this.masterGain.connect(this.audioCtx.destination);
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
    }`;

const managedAudioAfter = `    init() {
        if (!this.audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                try {
                    const audioCtx = new AudioContextClass();
                    const masterGain = audioCtx.createGain();
                    masterGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
                    masterGain.connect(audioCtx.destination);
                    this.audioCtx = audioCtx;
                    this.masterGain = masterGain;
                } catch (_) {
                    this.audioCtx = null;
                    this.masterGain = null;
                    return;
                }
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            try {
                const resumeResult = this.audioCtx.resume();
                if (resumeResult && typeof resumeResult.catch === 'function') {
                    resumeResult.catch(() => {});
                }
            } catch (_) {
                // Audio is optional; keep the game playable when resume is blocked.
            }
        }
    }`;

replaceOnce('sorting-factory/script.js', managedAudioBefore, managedAudioAfter);
replaceOnce('stealth-slacker/script.js', managedAudioBefore, managedAudioAfter);

replaceOnce(
  'kanji-slicer/game.js',
`    init() {
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
    }`,
`    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        try {
            const ctx = new AudioContext();
            const compressor = ctx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-15, ctx.currentTime);
            compressor.knee.setValueAtTime(30, ctx.currentTime);
            compressor.ratio.setValueAtTime(12, ctx.currentTime);
            compressor.attack.setValueAtTime(0.003, ctx.currentTime);
            compressor.release.setValueAtTime(0.25, ctx.currentTime);
            compressor.connect(ctx.destination);
            this.ctx = ctx;
            this.compressor = compressor;
        } catch (_) {
            this.ctx = null;
            this.compressor = null;
        }
    }`
);

replaceOnce(
  'lumen-mirror/core.js',
`    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this._setupIceSynth();
    }`,
`    init() {
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
    }`
);

console.log('Applied AudioContext constructor fallbacks to 5 diagnosed minigames.');
