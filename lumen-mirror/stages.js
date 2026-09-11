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
