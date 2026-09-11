// Stage templates are loaded from stages.js before the main runtime.

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
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => { new GameController(); });
