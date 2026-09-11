/* LUMEN_MIRROR Stage Editor extension. Loaded after GameController and before DOMContentLoaded. */
class LumenEditorMethods {
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

for (const methodName of Object.getOwnPropertyNames(LumenEditorMethods.prototype)) {
    if (methodName === 'constructor') continue;
    if (Object.prototype.hasOwnProperty.call(GameController.prototype, methodName)) {
        throw new Error(`LUMEN editor method collision: ${methodName}`);
    }
    Object.defineProperty(
        GameController.prototype,
        methodName,
        Object.getOwnPropertyDescriptor(LumenEditorMethods.prototype, methodName)
    );
}
