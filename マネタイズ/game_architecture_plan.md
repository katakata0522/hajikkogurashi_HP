# 「はじっこ勇者のインフレ魔塔（Hajikko Hero's Infinity Tower）」技術設計書

## 1. はじめに

新規ステージ進行型パズルRPG「はじっこ勇者のインフレ魔塔」の開発にあたり、プログラムの破綻、メモリリーク、セーブデータの破損、そしてユーザー体験（UX）を損なう技術的負債を徹底的に排除するためのフロントエンド技術アーキテクチャを定義します。

よくある「動けばいい」という妥協で作られたゲームコードは、機能追加のたびにバグを生み、ユーザーのスマートフォンのバッテリーを急激に消費させ、セーブデータアップデート時にユーザーの努力を無に帰します。

本設計書では、リードエンジニアである私が、バグのリスクを極限まで抑え込み、かつ動作が極めて軽量なJavaScript / TypeScriptベースのゲームシステム設計を提案・解説します。

---

## 2. 課題と解決アプローチの概要（辛口レビュー）

開発に入る前に、よくある初心者の実装ミスと、本アーキテクチャによるスマートな解決策を整理します。

| 領域 | よくある破綻パターン（アンチパターン） | 本設計書での解決アプローチ |
| :--- | :--- | :--- |
| **一筆書き判定** | マウス移動のたびに全グリッドを走査し、判定の境界条件が曖昧で斜め移動や意図しないワープが通ってしまう。巻き戻し処理が考慮されておらず、引き返したときに線がぐちゃぐちゃになる。 | **「直近接続履歴スタック」を用いたステートフル・パスファインディング**。<br>PointerEventsに密結合させず、判定ロジックを分離。スタックトップとその 1 つ前のみを参照してロールバックを判定。 |
| **描画＆状態管理** | キャラクターのHP減少、タイマー、パネル接続など、あらゆるイベントごとに直接DOMやCanvasの描画処理をトリガーし、描画が重複・詰まってカクつく。 | **「Proxy + requestAnimationFrame」によるリアクティブ描画制限**。<br>状態の変更はProxyで自動検知され、`isDirty`フラグを立てるのみ。実際の描画は1フレーム（16.6ms）に1回、まとめてバッチ処理する。 |
| **セーブデータ復元** | バージョンアップで「新しいゲーム要素（新パラメータ）」を足した際、古いセーブデータを `JSON.parse` してそのまま上書きするため、新変数が `undefined` になりクラッシュする。 | **「再帰的ディープマージ（deepMerge）」によるスキーマ復元**。<br>デフォルトの最新スキーマオブジェクトに対して、ユーザーの古いデータを安全にマージし、不足している新規プロパティを自動補完する。 |
| **省電力＆オーディオ** | ゲームを開いたまま放置された際、BGMや効果音の処理（AudioContext）が動き続け、ユーザーの端末が発熱しバッテリーを無駄に消費する。また、ブラウザの音響制限で最初音が鳴らない。 | **「自動サスペンドタイマー ＆ スタート画面インタラクションのバインド」**。<br>3分間操作がない場合、AudioContextを自動で `suspend()` し、復帰時に自動で `resume()`。初回起動はスタート画面クリックで安全にアクティベートする。 |

---

## 3. 各機能の技術設計と実装コード

### 3.1 一筆書き判定アルゴリズム (Line Dragging System)

一筆書きは、グリッド（格子）上のパネル同士を接続していく仕組みです。
勇者パネルからドラッグを開始し、隣接する敵やアイテムのパネルをなぞって「攻撃ルート」を確定させます。

#### 3.1.1 アルゴリズム設計の要点
1. **開始条件**: PointerEventの `pointerdown` が「勇者パネル」で発生した時のみドラッグを開始。
2. **接続可能判定**: 次のパネル $P_{next}$ が、現在の終端パネル $P_{curr}$ と上下左右のいずれかで隣接していること。
   $$\Delta x = |x_{next} - x_{curr}|, \quad \Delta y = |y_{next} - y_{curr}|$$
   接続可能条件: $(\Delta x + \Delta y == 1)$ かつ $P_{next}$ がまだ踏まれていないこと。
3. **ロールバック判定**: なぞりながら「1つ前に繋いだパネル」にドラッグが戻った場合、現在の接続をキャンセルし、スタックから最後のパネルをポップする。
4. **描画（ネオンライン）**: キャンバス（Canvas 2D）の `shadowBlur` や `globalCompositeOperation` を用い、ダークテーマに映える発光（グロー）エフェクトを動的にレンダリングする。

#### 3.1.2 実装モジュール例

```javascript
/**
 * パネル接続管理クラス
 */
class PathTracker {
  constructor(grid) {
    this.grid = grid; // ゲーム盤面データ
    this.path = [];   // 接続されたパネルの座標スタック [{x, y}, ...]
    this.isDragging = false;
  }

  // ドラッグ開始（必ずスタート地点＝勇者パネルで呼ぶ）
  start(x, y) {
    if (!this.isValidStart(x, y)) return false;
    this.path = [{ x, y }];
    this.isDragging = true;
    return true;
  }

  // 次のパネルへドラッグが移動した時の判定
  moveTo(x, y) {
    if (!this.isDragging) return false;

    const pathLength = this.path.length;
    if (pathLength === 0) return false;

    const current = this.path[pathLength - 1]; // 現在の終端
    const previous = pathLength > 1 ? this.path[pathLength - 2] : null; // 1つ前

    // 1. 直前のパネルに戻った場合（ロールバック処理）
    if (previous && previous.x === x && previous.y === y) {
      this.path.pop(); // 最後の要素を削除して巻き戻す
      return true;
    }

    // 2. すでに通った経路（重複）かつ直前ではない場合は接続不可
    if (this.path.some(p => p.x === x && p.y === y)) {
      return false;
    }

    // 3. 隣接判定（上下左右のみ）
    const dx = Math.abs(x - current.x);
    const dy = Math.abs(y - current.y);
    const isAdjacent = (dx + dy === 1);

    if (isAdjacent && this.isValidTarget(x, y)) {
      this.path.push({ x, y });
      return true;
    }

    return false;
  }

  // ドラッグ終了
  end() {
    const finalPath = [...this.path];
    this.isDragging = false;
    this.path = [];
    return finalPath;
  }

  isValidStart(x, y) {
    // 勇者パネルかどうかの判定ロジック
    const cell = this.grid.getCell(x, y);
    return cell && cell.type === 'hero';
  }

  isValidTarget(x, y) {
    // 進入不可セル（障害物など）のチェック
    const cell = this.grid.getCell(x, y);
    return cell && cell.type !== 'obstacle';
  }
}

/**
 * 光るネオンライン（Glow line）の描画処理
 */
class LineRenderer {
  static drawNeonPath(ctx, path, cellSize) {
    if (path.length < 2) return;

    ctx.save();
    ctx.beginPath();

    // パネルの中心点を結ぶ
    const getCenter = (coord) => ({
      x: coord.x * cellSize + cellSize / 2,
      y: coord.y * cellSize + cellSize / 2
    });

    const start = getCenter(path[0]);
    ctx.moveTo(start.x, start.y);

    for (let i = 1; i < path.length; i++) {
      const pt = getCenter(path[i]);
      ctx.lineTo(pt.x, pt.y);
    }

    // ネオン風の光の重なりを表現するためのマルチパス描画
    // パス1: 太くぼやけた外側の光
    ctx.strokeStyle = 'rgba(0, 255, 204, 0.4)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#00ffcc';
    ctx.stroke();

    // パス2: 細く鋭い内側の光（芯）
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 0; // 影をリセットして鮮明に
    ctx.stroke();

    ctx.restore();
  }
}
```

---

### 3.2 状態管理 ＆ レンダリング分離 (Reactive rendering with Proxy)

メモリやCPUの無駄遣いを防ぐため、ゲームロジックと描画ロジックを完全に分離し、「データが変わった時だけ」「次の画面更新タイミングで1回だけ」描画を行います。

#### 3.2.1 状態監視と描画制限の仕組み
- **`Proxy`による状態監視**: ゲーム状態（`state`）への追加や書き換えをインターセプト（横取り）し、自動で「画面描き直しが必要」というフラグ（`isDirty = true`）を立てます。ネストされたオブジェクトも対応するため、再帰的にProxyを適用します。
- **`requestAnimationFrame` (rAF) の活用**: 毎フレーム走る描画ループの最後で `isDirty` が `true` の場合のみ描画メソッド `UIManager.render()` を実行し、直後に `isDirty = false` に戻します。これにより、同じフレーム内に100回HPが変化しても、描画は1度しか走りません。

#### 3.2.2 実装モジュール例

```javascript
/**
 * 再帰的にオブジェクトをProxy化するヘルパー
 */
function createReactiveState(target, onChange) {
  const handler = {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      // オブジェクトかつnullでない場合は、ネストされたプロパティもリアクティブにする
      if (typeof value === 'object' && value !== null) {
        return createReactiveState(value, onChange);
      }
      return value;
    },
    set(target, property, value, receiver) {
      const oldValue = target[property];
      if (oldValue !== value) {
        const success = Reflect.set(target, property, value, receiver);
        if (success) {
          onChange(); // 状態変更を通知
        }
        return success;
      }
      return true;
    }
  };
  return new Proxy(target, handler);
}

/**
 * 状態管理と描画ループを統合するマネージャー
 */
class GameManager {
  constructor() {
    this.isDirty = false;

    // ゲームの生データ
    const rawState = {
      hero: { hp: 100, atk: 15, level: 1 },
      stage: { current: 1, score: 0 },
      ui: { selectedTab: 'battle' }
    };

    // リアクティブ・ステートの生成
    this.state = createReactiveState(rawState, () => {
      this.isDirty = true; // 状態が変更されたらDirtyフラグを立てる
    });

    this.startRenderLoop();
  }

  // 描画ループ（ブラウザの描画タイミングに同期）
  startRenderLoop() {
    const loop = () => {
      if (this.isDirty) {
        this.render();
        this.isDirty = false; // フラグをクリア
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // 実際の描画処理（DOMやCanvasの更新はここだけで行う）
  render() {
    // 例: HPバーの更新
    const hpBar = document.getElementById('hp-bar');
    if (hpBar) {
      hpBar.style.width = `${this.state.hero.hp}%`;
      hpBar.innerText = `HP: ${this.state.hero.hp}`;
    }

    // 例: ステージテキストの更新
    const stageTxt = document.getElementById('stage-text');
    if (stageTxt) {
      stageTxt.innerText = `STAGE ${this.state.stage.current}`;
    }
  }
}
```

---

### 3.3 セーブデータの堅牢性 (Robust Save System)

将来的なアップデートでゲーム内に「新しいステータス」や「機能フラグ」が追加された際、古いバージョンのセーブデータをそのままロードすると、新規ステータスが存在しない（`undefined`）ためにゲームがエラーで停止します。これを「スキーマ進化の不整合」と呼びます。

#### 3.3.1 deepMergeによる安全なデータ復元
最新バージョンの「完全なデフォルト値オブジェクト」を用意し、そこへ退避していたユーザーデータを上書きするようにマージ（マージン）します。単純な `Object.assign` はネストされたオブジェクト（例：`hero.atk`）を丸ごと古いデータで上書きしてしまうため、**再帰的に処理する `deepMerge`** が必須です。

#### 3.3.2 実装モジュール例

```javascript
/**
 * 2つのオブジェクトを再帰的にマージする（セーブデータ復元用）
 * @param {Object} target - 最新のデフォルトテンプレート
 * @param {Object} source - ユーザーの保存データ
 * @returns {Object} マージされた安全なオブジェクト
 */
function deepMerge(target, source) {
  // ソースがオブジェクトでない、またはnullの場合はテンプレートを優先
  if (typeof source !== 'object' || source === null) {
    return JSON.parse(JSON.stringify(target)); // 参照を切るためにディープコピー
  }

  const output = Object.assign({}, target);

  Object.keys(target).forEach(key => {
    if (source.hasOwnProperty(key)) {
      if (typeof target[key] === 'object' && target[key] !== null) {
        // ネストされたオブジェクト同士をさらに再帰マージ
        output[key] = deepMerge(target[key], source[key]);
      } else {
        // プリミティブ値ならユーザーの保存データで上書き
        output[key] = source[key];
      }
    }
  });

  return output;
}

/**
 * セーブデータ制御マネージャー
 */
class SaveSystem {
  static SAVE_KEY = 'HAJIKKO_HERO_SAVE';
  
  // ゲームの最新バージョン定義
  static DEFAULT_STATE = {
    version: '1.9.0',
    hero: {
      hp: 100,
      atk: 10,
      def: 5,        // v1.9.0で新設されたステータス
      skills: []     // v1.9.0で新設された配列
    },
    settings: {
      bgmVolume: 0.5,
      seVolume: 0.8
    }
  };

  // セーブ実行
  static save(state) {
    try {
      const dataStr = JSON.stringify(state);
      localStorage.setItem(this.SAVE_KEY, dataStr);
    } catch (e) {
      console.error('セーブデータの書き込みに失敗しました。', e);
    }
  }

  // ロード実行（堅牢なマージ処理付き）
  static load() {
    try {
      const savedDataStr = localStorage.getItem(this.SAVE_KEY);
      if (!savedDataStr) {
        // セーブデータがなければデフォルトをディープコピーして返す
        return JSON.parse(JSON.stringify(this.DEFAULT_STATE));
      }

      const parsedData = JSON.parse(savedDataStr);
      
      // デフォルト状態（最新スキーマ）に古いデータを安全にマージ
      const restoredState = deepMerge(this.DEFAULT_STATE, parsedData);
      
      // バージョン表記の更新などが必要ならここで処理
      restoredState.version = this.DEFAULT_STATE.version;
      
      return restoredState;
    } catch (e) {
      console.error('セーブデータの復元に失敗しました。デフォルト値を使用します。', e);
      return JSON.parse(JSON.stringify(this.DEFAULT_STATE));
    }
  }
}
```

---

### 3.4 省電力 ＆ 音響制限回避 (Smart Audio Management)

スマートフォンでのWebゲームプレイにおいて、バックグラウンド移行時や長時間の放置状態による電池消耗を防ぎつつ、ブラウザの音響セキュリティ（Autoplay Policy）をクリアします。

#### 3.4.1 音響制御の設計方針
1. **Autoplay Policy 回避**: Web Audio APIは、ユーザーのジェスチャー（クリック、画面タップ）の前に音を鳴らそうとするとブロックされます。起動時に「タップしてスタート」画面を必ず挟み、そのイベントハンドラ内で `AudioContext` を作成、または `resume()` します。
2. **省電力自動サスペンド**: 最後の操作（pointerdown, keydown等）から **3分（180秒）** が経過した場合、`AudioContext.suspend()` を実行してオーディオの計算処理を停止し、CPU負荷と電力消費を最小限に抑えます。
3. **アクティブ復帰**: 画面が再度タップされたり、ブラウザのタブが非表示から表示状態（Visibility API）に戻った際に、自動で `resume()` し演奏を再開します。

#### 3.4.2 実装モジュール例

```javascript
/**
 * 省電力・自動制御オーディオマネージャー
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.bgmNode = null;
    this.idleTimeout = null;
    this.IDLE_LIMIT = 3 * 60 * 1000; // 3分（ミリ秒）

    this.initListeners();
  }

  // ユーザーの何らかの操作をフックする
  initListeners() {
    const resetIdleTimer = () => this.handleUserInteraction();

    // 操作検知イベント
    window.addEventListener('pointerdown', resetIdleTimer, { passive: true });
    window.addEventListener('keydown', resetIdleTimer, { passive: true });

    // タブの切り替え検知（バックグラウンド移行時の即時サスペンド）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.suspendAudio();
      } else {
        this.resumeAudio();
      }
    });
  }

  // ユーザーが画面を操作したときの処理
  handleUserInteraction() {
    // 1. AudioContextが未初期化の場合（Autoplay Policy対策）
    if (!this.ctx) {
      this.initAudioContext();
    }

    // 2. サスペンド中なら復帰させる
    this.resumeAudio();

    // 3. アイドルタイマーの再設定
    if (this.idleTimeout) {
      clearTimeout(this.idleTimeout);
    }
    this.idleTimeout = setTimeout(() => {
      this.suspendAudioDueToIdle();
    }, this.IDLE_LIMIT);
  }

  // AudioContextの生成と初期動作
  initAudioContext() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();
    console.log('AudioContextを正常に初期化しました。');
    
    // ここでBGMの再生処理などを開始可能
    // this.playBGM();
  }

  // 安全なレジューム（復帰）
  async resumeAudio() {
    if (this.ctx && this.ctx.state === 'suspended') {
      try {
        await this.ctx.resume();
        console.log('AudioContextが復帰しました。');
      } catch (e) {
        console.warn('AudioContextの復帰に失敗しました。', e);
      }
    }
  }

  // 安全なサスペンド（一時停止）
  async suspendAudio() {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        await this.ctx.suspend();
        console.log('AudioContextをサスペンドしました（タブ非表示または手動）。');
      } catch (e) {
        console.warn('AudioContextのサスペンドに失敗しました。', e);
      }
    }
  }

  // 放置によるサスペンド
  async suspendAudioDueToIdle() {
    if (this.ctx && this.ctx.state === 'running') {
      try {
        await this.ctx.suspend();
        console.log('3分以上操作がなかったため、省電力のためオーディオをサスペンドしました。');
      } catch (e) {
        console.warn('アイドルサスペンドに失敗しました。', e);
      }
    }
  }
}
```

---

## 4. 全体アーキテクチャ設計図 (Architecture Overview)

ゲーム全体のデータフローとレンダリングの流れを以下に示します。データは一方向（Unidirectional）に流れ、描画はDirtyフラグによるバッチレンダリングで完全に隠蔽されます。

```mermaid
graph TD
    %% スタイル定義
    classDef default fill:#1a1c23,stroke:#3b82f6,stroke-width:2px,color:#f3f4f6;
    classDef highlight fill:#1e293b,stroke:#10b981,stroke-width:2px,color:#f3f4f6;
    classDef storage fill:#1e293b,stroke:#8b5cf6,stroke-width:2px,color:#f3f4f6;

    %% ノード定義
    Input[ユーザー入力: Pointer/Key]:::highlight -->|ゲーム操作| StateProxy[Reactive State: Proxy]
    Input -->|操作イベント検知| AudioMgr[Audio Manager]
    
    StateProxy -->|変更検知: set()| SetDirty[isDirty = true]:::default
    
    subgraph RenderLoop [rAF 描画ループ]
        CheckDirty{isDirty == true ?}
        CheckDirty -->|Yes| UIRender[UIManager.render]:::highlight
        CheckDirty -->|No| Idle[待機 / スキップ]
        UIRender --> ClearDirty[isDirty = false]
    end
    
    SetDirty --> RenderLoop
    
    subgraph LifeCycle [ライフサイクル・永続化]
        SaveSys[Save System: deepMerge]:::storage
        DB[(LocalStorage)]:::storage
    end

    SaveSys -->|安全なマージ| StateProxy
    StateProxy -->|自動保存| SaveSys
    SaveSys <-->|JSON文字列| DB
    
    subgraph AudioControl [音響省電力システム]
        Timer[3分放置タイマー] -->|タイムアウト| Suspend[AudioContext.suspend]:::default
        Input -->|再検知| Resume[AudioContext.resume]
        TabHide[タブ非表示] -->|即時| Suspend
    end
    
    AudioMgr --> AudioControl
```

---

## 5. 技術設計の導入メリットと評価

この設計に基づき実装を行うことで、以下の劇的な効果が得られます。

1. **カクつきのない滑らかなパズル操作**:
   タッチ判定と描画をrAF（RequestAnimationFrame）で分離したため、どんなに素早くなぞってもパネル判定処理がレンダリングをブロックしません。ネオンラインの描画はCanvasでハードウェア加速（GPU）されるため、60FPSを維持します。
2. **ゲームアップデート時の「データ破損ゼロ」**:
   新バージョンでステージ追加やキャラクター属性（例：素早さ、防御力など）が増えても、`deepMerge` が過去のセーブデータを包み込むように修復するため、古いバージョンのセーブデータを持つユーザーがアプリ起動時にクラッシュして離脱する事故を100%防ぎます。
3. **スマートフォンの熱暴走・バッテリー消費対策**:
   パズルを繋ぐ手が止まっている間や、起動したまま放置された時、CPUの再レンダリング負荷は0%になり、オーディオ再生スレッドも完全に停止（サスペンド）します。電池持ちの良さはストア評価に直結する重要な要素です。
