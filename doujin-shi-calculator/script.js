/* ==========================================================================
   同人誌の発行部数＆黒字化シミュレーター JavaScript (script.js)
   Highly Interactive Calculation Logic with Predictive AI-like Interpolation
   ========================================================================== */

// 印刷価格データベース (2026年現在の相場目安)
const PRINT_PRICE_DB = {
    A5: {
        pages: [24, 32, 40, 48, 64, 80, 100],
        volumes: [20, 50, 100, 200, 300],
        prices: {
            24: [3500, 6000, 9500, 15000, 20000],
            32: [4000, 7000, 11000, 17500, 23000],
            40: [4500, 8000, 12500, 20000, 26000],
            48: [5000, 9000, 14000, 22500, 29000],
            64: [6000, 11000, 17000, 27500, 35000],
            80: [7000, 13000, 20000, 32500, 41000],
            100: [8500, 15500, 24000, 38500, 48000]
        }
    },
    B5: {
        pages: [24, 32, 40, 48, 64, 80, 100],
        volumes: [20, 50, 100, 200, 300],
        prices: {
            24: [4500, 8000, 12000, 18500, 25000],
            32: [5200, 9200, 14000, 21500, 29000],
            40: [6000, 10500, 16000, 24500, 33000],
            48: [6800, 11800, 18000, 27500, 37000],
            64: [8200, 14200, 22000, 33500, 45000],
            80: [9600, 16600, 26000, 39500, 53000],
            100: [11500, 19500, 31000, 47000, 63000]
        }
    },
    B6: {
        pages: [24, 32, 40, 48, 64, 80, 100],
        volumes: [20, 50, 100, 200, 300],
        prices: {
            24: [3200, 5500, 8500, 13500, 18000],
            32: [3700, 6400, 10000, 15500, 21000],
            40: [4200, 7300, 11500, 18000, 24000],
            48: [4700, 8200, 13000, 20500, 27000],
            64: [5600, 10000, 15500, 25000, 32000],
            80: [6500, 11800, 18500, 29500, 37500],
            100: [7800, 14000, 22000, 35000, 44000]
        }
    },
    A6: { // 文庫サイズ
        pages: [40, 64, 80, 100, 150, 200],
        volumes: [20, 50, 100, 200, 300],
        prices: {
            40: [3200, 5500, 8000, 12500, 17000],
            64: [4000, 7000, 10500, 16500, 22000],
            80: [4600, 8000, 12000, 19000, 25000],
            100: [5200, 9200, 14000, 22000, 29500],
            150: [7000, 12000, 18500, 29500, 39500],
            200: [8800, 15000, 23000, 37000, 49500]
        }
    },
    shinsho: { // 新書サイズ
        pages: [40, 64, 80, 100, 150, 200],
        volumes: [20, 50, 100, 200, 300],
        prices: {
            40: [3500, 6000, 8800, 14000, 19000],
            64: [4400, 7700, 11500, 18000, 24500],
            80: [5000, 8800, 13200, 21000, 28000],
            100: [5700, 10000, 15500, 24000, 32500],
            150: [7700, 13200, 20500, 32500, 43500],
            200: [9700, 16500, 25500, 41000, 54500]
        }
    }
};

// DOM Elements
const bookSizeEl = document.getElementById('book-size');
const printTypeEl = document.getElementById('print-type');
const bookPagesEl = document.getElementById('book-pages');
const printVolumeEl = document.getElementById('print-volume');
const printCostEl = document.getElementById('print-cost');
const costAutoBadgeEl = document.getElementById('cost-auto-badge');
const btnResetCostEl = document.getElementById('btn-reset-cost');

const snsFollowersEl = document.getElementById('sns-followers');
const snsLikesEl = document.getElementById('sns-likes');
const pixivBookmarksEl = document.getElementById('pixiv-bookmarks');
const eventScaleEl = document.getElementById('event-scale');
const pastSalesEl = document.getElementById('past-sales');

const eventFeeEl = document.getElementById('event-fee');
const otherExpensesEl = document.getElementById('other-expenses');
const sellingPriceEl = document.getElementById('selling-price');
const useConsignmentEl = document.getElementById('use-consignment');

const btnQuick500El = document.getElementById('btn-quick-500');
const btnQuick1000El = document.getElementById('btn-quick-1000');
const btnQuickAutoEl = document.getElementById('btn-quick-auto');

const customCircleEl = document.getElementById('custom-circle');
const customTitleEl = document.getElementById('custom-title');

const predSafeValueEl = document.getElementById('pred-safe-value');
const predStandardValueEl = document.getElementById('pred-standard-value');
const predAggressiveValueEl = document.getElementById('pred-aggressive-value');
const snsWarningBoxEl = document.getElementById('sns-warning-box');

const totalExpensesDisplayEl = document.getElementById('total-expenses-display');
const unitCostDisplayEl = document.getElementById('unit-cost-display');

const salesSliderEl = document.getElementById('sales-slider');
const sliderValDisplayEl = document.getElementById('slider-val-display');
const sliderHalfTickEl = document.getElementById('slider-half-tick');
const sliderMaxTickEl = document.getElementById('slider-max-tick');

const profitStatusCardEl = document.getElementById('profit-status-card');
const profitStatusTextEl = document.getElementById('profit-status-text');
const profitAmountDisplayEl = document.getElementById('profit-amount-display');
const profitProgressBarEl = document.getElementById('profit-progress-bar');
const breakevenLineEl = document.getElementById('breakeven-line');
const breakevenSalesDisplayEl = document.getElementById('breakeven-sales-display');
const profitAdviceTextEl = document.getElementById('profit-advice-text');

const btnExportEl = document.getElementById('btn-export');
const exportCanvasEl = document.getElementById('export-canvas');

// Modal Elements
const exportModalEl = document.getElementById('export-modal');
const modalOverlayEl = document.getElementById('modal-overlay');
const btnCloseModalEl = document.getElementById('btn-close-modal');
const modalPreviewImageEl = document.getElementById('modal-preview-image');
const btnDownloadFallbackEl = document.getElementById('btn-download-fallback');

// アフィリエイト商品データベース (かたかた個人のアソシエイトIDを想定したリンク)
const AFFILIATE_PRODUCTS = {
    copybook: {
        title: "📚 コピー本づくりのおすすめ製本グッズ",
        desc: "コピー本（折本・小冊子）の自宅・コンビニ製本に圧倒的に便利なアイテムです。",
        items: [
            {
                name: "マックス 中とじホッチキス ホッチくる",
                url: "https://www.amazon.co.jp/dp/B000FHPDFQ?tag=katakata-22",
                icon: "📌",
                price: "参考価格: 約800円",
                reason: "ヘッドが90度回転し、A4用紙の中央に簡単にホッチキスが打てるコピー本作家の必須装備です。"
            },
            {
                name: "コクヨ 上質紙 特厚口 A4 50枚",
                url: "https://www.amazon.co.jp/dp/B000FL7GZ2?tag=katakata-22",
                icon: "📄",
                price: "参考価格: 約600円",
                reason: "コピー本の表紙や、少しリッチな本文用紙に最適なコシのある特厚口の上質紙です。"
            }
        ]
    },
    event: {
        title: "🎪 即売会サークル参加の必須・便利設営グッズ",
        desc: "コミケやオンリーイベントなどのスペース設営で大活躍するド定番アイテムです。",
        items: [
            {
                name: "折りたたみ式ポスタースタンド（卓上）",
                url: "https://www.amazon.co.jp/dp/B0BD4XYQ6D?tag=katakata-22",
                icon: "🚩",
                price: "参考価格: 約2,500円",
                reason: "A4やA3のお品書き・ポスターを机の上に自立させてアピール力を激変させる軽量スタンド。"
            },
            {
                name: "ヘッズ クリップ式 値札ホルダー 5個",
                url: "https://www.amazon.co.jp/dp/B07BLVNDN9?tag=katakata-22",
                icon: "🏷️",
                price: "参考価格: 約700円",
                reason: "新刊の前に値札を挟んで立たせるための透明で見えやすいポップスタンドです。"
            }
        ]
    },
    shipping: {
        title: "📦 自家通販・BOOTH梱包用の資材セット",
        desc: "BOOTHや匿名配送（あんしんBOOTHパック、レターパック等）で本を安全に送るための梱包資材です。",
        items: [
            {
                name: "OPP袋 B5用 テープ付 100枚",
                url: "https://www.amazon.co.jp/dp/B004GBA9AS?tag=katakata-22",
                icon: "✉️",
                price: "参考価格: 約900円",
                reason: "雨濡れを防ぐための透明OPP袋です。本を美しく包装し、傷から守ります。"
            },
            {
                name: "クッション封筒 B5対応 25枚",
                url: "https://www.amazon.co.jp/dp/B08CSCW7FF?tag=katakata-22",
                icon: "📦",
                price: "参考価格: 約1,200円",
                reason: "内側にぷちぷちが入っており、封筒に入れるだけでそのまま発送可能な衝撃吸収封筒。"
            }
        ]
    }
};

// 入力状態に応じてアフィリエイトエリアを書き換える関数
function updateAffiliateBox() {
    const affiliateBox = document.getElementById('dynamic-affiliate-box');
    if (!affiliateBox) return;

    const printType = printTypeEl.value;
    const isEvent = (eventScaleEl.value === 'large' || eventScaleEl.value === 'medium');
    
    let key = 'shipping';
    if (printType === 'copybook') {
        key = 'copybook';
    } else if (isEvent) {
        key = 'event';
    }
    
    const db = AFFILIATE_PRODUCTS[key];
    if (!db) return;
    
    let html = `
        <h4 class="affiliate-title">${db.title}</h4>
        <p class="affiliate-desc">${db.desc}</p>
        <div class="affiliate-items-grid">
    `;
    
    db.items.forEach(item => {
        html += `
            <a href="${item.url}" target="_blank" rel="noopener" class="affiliate-card">
                <div class="affiliate-card-img-placeholder">${item.icon}</div>
                <div class="affiliate-card-info">
                    <span class="affiliate-card-name">${item.name}</span>
                    <span class="affiliate-card-price">${item.price}</span>
                    <p class="affiliate-card-reason">${item.reason}</p>
                    <span class="affiliate-card-btn">Amazonで見る ➔</span>
                </div>
            </a>
        `;
    });
    
    html += `</div>`;
    affiliateBox.innerHTML = html;
}

// 線形補間関数 (1次元)
function interpolate1D(x, xArr, yArr) {
    if (x <= xArr[0]) return yArr[0];
    if (x >= xArr[xArr.length - 1]) return yArr[yArr.length - 1];
    
    for (let i = 0; i < xArr.length - 1; i++) {
        if (x >= xArr[i] && x <= xArr[i+1]) {
            const t = (x - xArr[i]) / (xArr[i+1] - xArr[i]);
            return yArr[i] + t * (yArr[i+1] - yArr[i]);
        }
    }
    return yArr[0];
}

// 印刷価格の相場を予測計算する関数
function estimatePrintCost(size, pageCount, volume) {
    const db = PRINT_PRICE_DB[size];
    if (!db) return 0;
    
    // ページ数・部数の範囲外補正
    const safePage = Math.max(db.pages[0], Math.min(db.pages[db.pages.length - 1], pageCount));
    const safeVolume = Math.max(db.volumes[0], Math.min(db.volumes[db.volumes.length - 1], volume));
    
    const targetPages = db.pages;
    const volumes = db.volumes;
    
    // ページごとの補間価格リストを作成
    const pricesAtVolume = [];
    targetPages.forEach(p => {
        const rowPrices = db.prices[p];
        const val = interpolate1D(safeVolume, volumes, rowPrices);
        pricesAtVolume.push(val);
    });
    
    // 目的のページ数での価格を最終補間
    return Math.round(interpolate1D(safePage, targetPages, pricesAtVolume));
}

// 印刷代の自動補正フラグ
let isAutoCostEnabled = true;

function updateAutoPrintCost() {
    if (!isAutoCostEnabled) return;
    
    const size = bookSizeEl.value;
    const printType = printTypeEl.value;
    const pageCount = Math.max(1, parseInt(bookPagesEl.value) || 0);
    const volume = Math.max(1, parseInt(printVolumeEl.value) || 0);
    
    let estCost = 0;
    if (printType === 'copybook') {
        // コピー本: 1ページあたり約6円 × ページ数 × 部数
        estCost = Math.round(6 * pageCount * volume);
    } else {
        estCost = estimatePrintCost(size, pageCount, volume);
        if (printType === 'color') {
            // フルカラーはモノクロの2.5倍
            estCost = Math.round(estCost * 2.5);
        }
    }
    
    printCostEl.value = estCost;
    
    // UIバッジ更新
    costAutoBadgeEl.className = 'cost-badge auto';
    costAutoBadgeEl.textContent = '自動計算中';
    btnResetCostEl.style.display = 'none';
}

// 自動計算へのリセット処理
function resetToAutoPrintCost() {
    isAutoCostEnabled = true;
    updateAutoPrintCost();
    calculateAll();
}

// 計算メイン処理
function calculateAll() {
    // 1. 印刷相場の更新（手動変更されていない場合）
    updateAutoPrintCost();
    
// 安全に入力値を取得・サニタイズ（極端な値をクランプ）
    const size = bookSizeEl.value;
    const pages = Math.min(500, Math.max(4, parseInt(bookPagesEl.value) || 4));
    const volume = Math.min(50000, Math.max(1, parseInt(printVolumeEl.value) || 1));
    const printCost = Math.min(5000000, Math.max(0, parseInt(printCostEl.value) || 0));
    
    const followers = Math.min(1000000, Math.max(0, parseInt(snsFollowersEl.value) || 0));
    const likes = Math.min(100000, Math.max(0, parseInt(snsLikesEl.value) || 0));
    const bookmarks = Math.min(100000, Math.max(0, parseInt(pixivBookmarksEl.value) || 0));
    const scale = eventScaleEl.value;
    const pastSales = Math.min(50000, Math.max(0, parseInt(pastSalesEl.value) || 0));
    
    const eventFee = Math.min(1000000, Math.max(0, parseInt(eventFeeEl.value) || 0));
    const otherExpenses = Math.min(1000000, Math.max(0, parseInt(otherExpensesEl.value) || 0));
    const sellingPrice = Math.min(100000, Math.max(0, parseInt(sellingPriceEl.value) || 0));

    // インプットの値が極端に補正された場合に備え、画面上の入力値を正規化（表示崩れ対策）
    if (parseInt(bookPagesEl.value) > 500) bookPagesEl.value = 500;
    if (parseInt(printVolumeEl.value) > 50000) printVolumeEl.value = 50000;
    if (parseInt(printCostEl.value) > 5000000) printCostEl.value = 5000000;
    if (parseInt(snsFollowersEl.value) > 1000000) snsFollowersEl.value = 1000000;
    if (parseInt(snsLikesEl.value) > 100000) snsLikesEl.value = 100000;
    if (parseInt(pixivBookmarksEl.value) > 100000) pixivBookmarksEl.value = 100000;
    if (parseInt(pastSalesEl.value) > 50000) pastSalesEl.value = 50000;
    if (parseInt(eventFeeEl.value) > 1000000) eventFeeEl.value = 1000000;
    if (parseInt(otherExpensesEl.value) > 1000000) otherExpensesEl.value = 1000000;
    if (parseInt(sellingPriceEl.value) > 100000) sellingPriceEl.value = 100000;

    // 矛盾検知警告
    let warningMessages = [];
    if (likes > followers && followers > 0) {
        warningMessages.push("⚠️ いいね数がフォロワー数を上回っています。");
    }
    if (bookmarks > followers * 10 && followers > 0) {
        warningMessages.push("⚠️ pixivブクマ数がフォロワー数に対して極端に高密度です。");
    }
    if (warningMessages.length > 0) {
        snsWarningBoxEl.innerHTML = warningMessages.join("<br>") + "<br><small>※SNSの反応値のバランスが不自然なため、予測部数がぶれる可能性があります。</small>";
        snsWarningBoxEl.style.display = 'block';
    } else {
        snsWarningBoxEl.style.display = 'none';
    }
    
    // ================= A. 部数予測 =================
    let scaleFactor = (scale === 'large') ? 1.25 : 0.85;
    
    // 予測モデル式
    let basePredict = (bookmarks * 0.15) + (likes * 0.08) + (followers * 0.008);
    
    // 過去実績ブレンド
    if (pastSales > 0) {
        basePredict = (basePredict * 0.3) + (pastSales * 0.7);
    }
    
    // 推奨部数の計算
    let safeVal = Math.round((basePredict * 0.7 + 8) * scaleFactor);
    let standardVal = Math.round((basePredict * 1.0 + 15) * scaleFactor);
    let aggressiveVal = Math.round((basePredict * 1.4 + 25) * scaleFactor);
    
    // 丸め処理 (5部単位)
    const roundTo5 = (val) => Math.max(10, Math.round(val / 5) * 5);
    
    safeVal = roundTo5(safeVal);
    standardVal = roundTo5(standardVal);
    aggressiveVal = roundTo5(aggressiveVal);
    
    // 推奨値の画面表示
    predSafeValueEl.textContent = safeVal.toLocaleString();
    predStandardValueEl.textContent = standardVal.toLocaleString();
    predAggressiveValueEl.textContent = aggressiveVal.toLocaleString();
    
    // ================= B. 経費と原価計算 =================
    const totalExpenses = printCost + eventFee + otherExpenses;
    const unitCost = Math.round(totalExpenses / volume); // volumeは1以上が保証されている
    
    totalExpensesDisplayEl.textContent = `¥${totalExpenses.toLocaleString()}`;
    unitCostDisplayEl.textContent = `¥${unitCost.toLocaleString()}`;
    
    // ================= C. 黒字化スライダーとシミュレーター =================
    salesSliderEl.max = volume;
    salesSliderEl.setAttribute('aria-valuemin', '0');
    salesSliderEl.setAttribute('aria-valuemax', volume.toString());
    
    sliderHalfTickEl.textContent = `${Math.round(volume / 2)}部`;
    sliderMaxTickEl.textContent = `${volume}部`;
    
    // スライダー値の上限チェック
    if (parseInt(salesSliderEl.value) > volume) {
        salesSliderEl.value = volume;
    }
    
    const salesCount = Math.max(0, parseInt(salesSliderEl.value) || 0);
    salesSliderEl.setAttribute('aria-valuenow', salesCount.toString());
    sliderValDisplayEl.textContent = salesCount;
    
    // 収支計算
    const isConsignment = useConsignmentEl.checked;
    const revenueRate = isConsignment ? 0.7 : 1.0;
    const salesRevenue = Math.round(salesCount * sellingPrice * revenueRate);
    const netProfit = salesRevenue - totalExpenses;
    
    // 損益分岐点 (必要部数)
    let breakevenSales = 0;
    if (sellingPrice > 0) {
        breakevenSales = Math.ceil(totalExpenses / (sellingPrice * revenueRate));
    }
    
    const isPossibleBreakeven = sellingPrice > 0 && breakevenSales <= volume;
    breakevenSalesDisplayEl.textContent = isPossibleBreakeven ? breakevenSales : '達成不可';
    
    // 損益分岐点マーカー表示制御
    if (isPossibleBreakeven && volume > 0) {
        const markerPos = (breakevenSales / volume) * 100;
        breakevenLineEl.style.left = `${markerPos}%`;
        breakevenLineEl.style.display = 'block';
    } else {
        breakevenLineEl.style.display = 'none';
    }
    
    // 進捗バー
    const progressPercent = volume > 0 ? (salesCount / volume) * 100 : 0;
    profitProgressBarEl.style.width = `${progressPercent}%`;
    
    // 利益表示エリア装飾
    if (netProfit >= 0) {
        profitStatusCardEl.className = 'profit-status-card gain';
        profitStatusTextEl.textContent = '黒字化達成！';
        profitAmountDisplayEl.textContent = `+¥${netProfit.toLocaleString()}`;
        profitAdviceTextEl.textContent = `おめでとうございます！損益分岐点（${breakevenSales}部）を超え、利益が出ています。イベント活動のステップアップが期待できます！`;
    } else {
        profitStatusCardEl.className = 'profit-status-card loss';
        profitStatusTextEl.textContent = '赤字ゾーン';
        profitAmountDisplayEl.textContent = `-¥${Math.abs(netProfit).toLocaleString()}`;
        
        if (sellingPrice === 0) {
            profitAdviceTextEl.textContent = `警告：本の頒布価格が「0円（無料配布）」になっています。無料配布本の場合、印刷経費を回収することはできません。`;
        } else if (!isPossibleBreakeven) {
            profitAdviceTextEl.textContent = `警告：本の価格設定（${sellingPrice}円）が低すぎるか、経費が高すぎます。完売しても黒字になりません。1冊あたり最低でも ${Math.ceil(totalExpenses / volume)} 円以上に設定することをお勧めします。`;
        } else {
            const remaining = breakevenSales - salesCount;
            profitAdviceTextEl.textContent = `あと ${remaining} 部の頒布で黒字に達します。価格を少し上げるか、お品書きのデザインを工夫してアピールしてみましょう！`;
        }
    }
    
    // アフィリエイト情報の動的更新
    updateAffiliateBox();
}

// デバウンス関数 (パフォーマンス最適化用)
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}
const debouncedCalculateAll = debounce(calculateAll, 120);

// 印刷費の手動変更監視 (デバウンス処理)
printCostEl.addEventListener('input', debounce(() => {
    isAutoCostEnabled = false;
    costAutoBadgeEl.className = 'cost-badge manual';
    costAutoBadgeEl.textContent = '手動編集';
    btnResetCostEl.style.display = 'inline-block';
    calculateAll();
}, 120));

// リセットボタン登録
btnResetCostEl.addEventListener('click', resetToAutoPrintCost);

// 即時反映リスナー (セレクトボックス、スライダー等)
const immediateInputs = [bookSizeEl, printTypeEl, eventScaleEl, salesSliderEl, useConsignmentEl];
immediateInputs.forEach(el => {
    if (el) {
        el.addEventListener('change', calculateAll);
        el.addEventListener('input', calculateAll);
    }
});

// クイック価格ボタンイベント
if (btnQuick500El) {
    btnQuick500El.addEventListener('click', () => {
        sellingPriceEl.value = 500;
        calculateAll();
    });
}
if (btnQuick1000El) {
    btnQuick1000El.addEventListener('click', () => {
        sellingPriceEl.value = 1000;
        calculateAll();
    });
}
if (btnQuickAutoEl) {
    btnQuickAutoEl.addEventListener('click', () => {
        const eventFee = Math.max(0, parseInt(eventFeeEl.value) || 0);
        const otherExpenses = Math.max(0, parseInt(otherExpensesEl.value) || 0);
        const printCost = Math.max(0, parseInt(printCostEl.value) || 0);
        const volume = Math.max(1, parseInt(printVolumeEl.value) || 1);
        const totalExp = printCost + eventFee + otherExpenses;
        const rawUnit = totalExp / volume;
        
        // 原価の1.5倍にして、50円単位で切り上げる
        let recommendedPrice = Math.ceil((rawUnit * 1.5) / 50) * 50;
        recommendedPrice = Math.max(100, recommendedPrice);
        sellingPriceEl.value = recommendedPrice;
        calculateAll();
    });
}

// デバウンス反映リスナー (キーボード数値入力系)
const debouncedInputs = [
    bookPagesEl, printVolumeEl, snsFollowersEl, snsLikesEl, pixivBookmarksEl,
    pastSalesEl, eventFeeEl, otherExpensesEl, sellingPriceEl
];
debouncedInputs.forEach(el => {
    el.addEventListener('input', debouncedCalculateAll);
});

// モーダル制御関数
function openModal(imgSrc, fallbackUrl) {
    modalPreviewImageEl.src = imgSrc;
    btnDownloadFallbackEl.href = fallbackUrl;
    exportModalEl.classList.add('open');
    exportModalEl.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden'; // 背面のスクロールを無効化
}

function closeModal() {
    exportModalEl.classList.remove('open');
    exportModalEl.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
}

// モーダルイベントリスナー
btnCloseModalEl.addEventListener('click', closeModal);
modalOverlayEl.addEventListener('click', closeModal);

// エスケープキーで閉じる
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && exportModalEl.classList.contains('open')) {
        closeModal();
    }
});

// Canvasによるお品書き画像書き出しとモーダルポップアップ
function exportSummaryImage() {
    const ctx = exportCanvasEl.getContext('2d');
    if (!ctx) return;
    
    // 背景グラデーション (パステルバイオレット)
    const grad = ctx.createLinearGradient(0, 0, 800, 500);
    grad.addColorStop(0, '#f5f3ff');
    grad.addColorStop(1, '#fad0c4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 500);
    
    // 背景にかわいいドット柄をあしらう (芸術的装飾)
    ctx.fillStyle = 'rgba(139, 92, 246, 0.05)';
    for (let x = 10; x < 800; x += 25) {
        for (let y = 10; y < 500; y += 25) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // 白背景の角丸カード
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
    ctx.lineWidth = 2;
    
    function roundRect(x, y, w, h, r, fill = true, stroke = true) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        if (fill) ctx.fill();
        if (stroke) ctx.stroke();
    }
    roundRect(30, 30, 740, 440, 16);
    
    // タイトルの左側のデコレーション（本をかたどった縦の2本線）
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(60, 62, 6, 26);
    ctx.fillStyle = '#ec4899';
    ctx.fillRect(70, 62, 3, 26);
    
    // タイトル
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 24px "Noto Sans JP", sans-serif';
    ctx.fillText('同人誌 収支＆部数計画シート', 85, 82);
    
    // サブタイトル
    ctx.fillStyle = '#6b7280';
    ctx.font = '13px "Noto Sans JP", sans-serif';
    const dateStr = new Date().toLocaleDateString('ja-JP', {year: 'numeric', month: 'long', day: 'numeric'});
    ctx.fillText(`作成日: ${dateStr} | 創作支援シミュレーター`, 85, 107);

    // サークル名・新刊タイトルの取得と右上タグ描画
    const customCircle = customCircleEl.value.trim();
    const customTitle = customTitleEl.value.trim();
    
    if (customCircle || customTitle) {
        // 右上にスタイリッシュなタグ風に描画 (Aesthetic styling)
        ctx.fillStyle = 'rgba(139, 92, 246, 0.06)';
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.2)';
        ctx.lineWidth = 1;
        roundRect(460, 52, 280, 58, 8);
        
        ctx.textAlign = 'right';
        ctx.fillStyle = '#6d28d9';
        ctx.font = 'bold 12px "Noto Sans JP", sans-serif';
        ctx.fillText(customCircle || 'サークル名未設定', 720, 74);
        
        ctx.fillStyle = '#1f2937';
        ctx.font = 'bold 15px "Noto Sans JP", sans-serif';
        ctx.fillText(`📖 ${customTitle || '新刊計画'}`, 720, 96);
        ctx.textAlign = 'left'; // reset textAlign
    }
    
    // 分割線
    // 分割線 (グラデーションカラー)
    const lineGrad = ctx.createLinearGradient(60, 0, 740, 0);
    lineGrad.addColorStop(0, '#8b5cf6');
    lineGrad.addColorStop(0.5, '#ec4899');
    lineGrad.addColorStop(1, 'rgba(226, 232, 240, 0.5)');
    ctx.beginPath();
    ctx.moveTo(60, 125);
    ctx.lineTo(740, 125);
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // データ取得
    const size = bookSizeEl.options[bookSizeEl.selectedIndex].text.split('（')[0];
    const printType = printTypeEl.options[printTypeEl.selectedIndex].text.split('（')[0];
    const pages = bookPagesEl.value;
    const volume = printVolumeEl.value;
    const price = sellingPriceEl.value;
    
    // 左側：本の仕様
    ctx.fillStyle = '#4b5563';
    ctx.font = 'bold 16px "Noto Sans JP", sans-serif';
    ctx.fillText('📖 本の仕様と価格設定', 60, 170);
    
    ctx.font = '14px "Noto Sans JP", sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.fillText(`サイズ: ${size}`, 80, 200);
    ctx.fillText(`印刷仕様: ${printType}`, 80, 230);
    ctx.fillText(`総ページ数: ${pages} ページ`, 80, 260);
    ctx.fillText(`発行部数: ${volume} 部`, 80, 290);
    ctx.fillText(`頒布価格: ${price} 円 / 1冊`, 80, 320);
    
    // 損益分岐点 (少し目立つ枠で囲む)
    const totalExpenses = Math.max(0, parseInt(printCostEl.value) || 0) + (Math.max(0, parseInt(eventFeeEl.value) || 0)) + (Math.max(0, parseInt(otherExpensesEl.value) || 0));
    const breakeven = price > 0 ? Math.ceil(totalExpenses / price) : 0;
    
    ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)';
    ctx.lineWidth = 1;
    roundRect(70, 345, 300, 42, 6);
    
    ctx.fillStyle = '#b91c1c';
    ctx.font = 'bold 14px "Noto Sans JP", sans-serif';
    if (price > 0) {
        ctx.fillText(`⚠️ 損益分岐点: ${breakeven} 部 の頒布で黒字化`, 85, 371);
    } else {
        ctx.fillText(`⚠️ 損益分岐点: 達成不可 (無料配布本です)`, 85, 371);
    }
    
    // 右側：推奨部数
    ctx.fillStyle = '#4b5563';
    ctx.font = 'bold 16px "Noto Sans JP", sans-serif';
    ctx.fillText('📈 推奨発行部数', 440, 170);
    
    // 手堅い
    ctx.fillStyle = '#10b981';
    ctx.fillRect(440, 195, 10, 15);
    ctx.fillStyle = '#1f2937';
    ctx.font = '15px "Noto Sans JP", sans-serif';
    ctx.fillText(`手堅い部数: ${predSafeValueEl.textContent} 部`, 460, 210);
    
    // 標準
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(440, 245, 10, 15);
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 16px "Noto Sans JP", sans-serif';
    ctx.fillText(`おすすめ標準部数: ${predStandardValueEl.textContent} 部`, 460, 260);
    
    // 強気
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(440, 295, 10, 15);
    ctx.fillStyle = '#1f2937';
    ctx.font = '15px "Noto Sans JP", sans-serif';
    ctx.fillText(`強気な部数: ${predAggressiveValueEl.textContent} 部`, 460, 310);
    
    // 収支概要ボックス
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    roundRect(440, 345, 300, 80, 8);
    
    ctx.fillStyle = '#4b5563';
    ctx.font = '12px "Noto Sans JP", sans-serif';
    ctx.fillText('総経費 (印刷費＋イベント経費)', 458, 375);
    
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 22px "Outfit", sans-serif';
    ctx.fillText(`¥${totalExpenses.toLocaleString()}`, 458, 405);
    
    // 芸術的アクセス案内：検索窓グラフィックの描画 (SEO・認知向上)
    const sx = 65;
    const sy = 405;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#8b5cf6';
    ctx.lineWidth = 1.5;
    roundRect(sx, sy, 190, 28, 4);
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px "Noto Sans JP", sans-serif';
    ctx.fillText('かたかたの同人ツール', sx + 10, sy + 18);
    
    // 検索虫眼鏡マークの描画
    ctx.fillStyle = '#8b5cf6';
    ctx.fillRect(sx + 150, sy + 1, 39, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px "Noto Sans JP", sans-serif';
    ctx.fillText('検索', sx + 158, sy + 17);
    
    // コピーライト
    ctx.fillStyle = '#9ca3af';
    ctx.font = '11px "Noto Sans JP", sans-serif';
    ctx.fillText('Designed by かたかた (katakatalab.com)', 60, 452);
    
    // 画像URLの生成
    try {
        const dataUrl = exportCanvasEl.toDataURL('image/png');
        const filename = `doujin_plan_${new Date().toISOString().slice(0,10)}.png`;
        
        // モーダルを開いてユーザーに長押し保存を促す (スマホ・PC共通で最も安全なフロー)
        openModal(dataUrl, dataUrl);
    } catch (err) {
        console.error('画像生成に失敗しました: ', err);
        alert('画像の書き出しに失敗しました。お使いのブラウザがCanvas機能に対応しているかご確認ください。');
    }
}

// イベント設定
btnExportEl.addEventListener('click', exportSummaryImage);

// 初期計算の実行
calculateAll();
