/* ==========================================================================
   SubscCut 2026 - Calculation & Audit Engine
   Step-Flow Architecture & High Jump-Rate Price Formatting Integration
   ========================================================================== */

const fmtJPY = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 });
const fmtNum = new Intl.NumberFormat('ja-JP');

const PRESET_SUBSCRIPTIONS = [
  { id: 'chatgpt', name: 'ChatGPT Plus', price: 3000, category: 'ai', cancelUrl: 'https://chatgpt.com/#settings/Subscription' },
  { id: 'claude-pro', name: 'Claude Pro', price: 3000, category: 'ai', cancelUrl: 'https://claude.ai/settings/billing' },
  { id: 'cursor-pro', name: 'Cursor Pro', price: 3000, category: 'ai', cancelUrl: 'https://www.cursor.com/settings' },
  { id: 'perplexity-pro', name: 'Perplexity Pro', price: 3000, category: 'ai', cancelUrl: 'https://www.perplexity.ai/settings/account' },
  { id: 'v0-pro', name: 'v0 / Bolt Pro', price: 3000, category: 'ai', cancelUrl: 'https://v0.dev/chat' },
  { id: 'github-copilot', name: 'GitHub Copilot', price: 1500, category: 'ai', cancelUrl: 'https://github.com/settings/billing' },
  { id: 'midjourney', name: 'Midjourney Basic', price: 1500, category: 'ai', cancelUrl: 'https://www.midjourney.com/account' },
  { id: 'youtube-premium', name: 'YouTube Premium', price: 1380, category: 'video', cancelUrl: 'https://www.youtube.com/paid_memberships' },
  { id: 'netflix', name: 'Netflix (スタンダード)', price: 1590, category: 'video', cancelUrl: 'https://www.netflix.com/youraccount' },
  { id: 'amazon-prime', name: 'Amazon Prime', price: 600, category: 'video', cancelUrl: 'https://www.amazon.co.jp/mc/manage' },
  { id: 'disney-plus', name: 'Disney+', price: 990, category: 'video', cancelUrl: 'https://www.disneyplus.com/account' },
  { id: 'u-next', name: 'U-NEXT', price: 2189, category: 'video', cancelUrl: 'https://account.unext.jp/' },
  { id: 'spotify', name: 'Spotify Premium', price: 980, category: 'music', cancelUrl: 'https://www.spotify.com/account/subscription/' },
  { id: 'apple-music', name: 'Apple Music', price: 1080, category: 'music', cancelUrl: 'https://support.apple.com/HT202039' },
  { id: 'kindle-unlimited', name: 'Kindle Unlimited', price: 980, category: 'music', cancelUrl: 'https://www.amazon.co.jp/kindle-dbs/ku/ku-central' },
  { id: 'audible', name: 'Audible', price: 1500, category: 'music', cancelUrl: 'https://www.audible.co.jp/account-details' },
  { id: 'icloud-200gb', name: 'iCloud+ (200GB)', price: 400, category: 'cloud', cancelUrl: 'https://support.apple.com/HT207594' },
  { id: 'google-one-100gb', name: 'Google One (100GB)', price: 250, category: 'cloud', cancelUrl: 'https://one.google.com/settings' },
  { id: 'notion-plus', name: 'Notion Plus', price: 1500, category: 'cloud', cancelUrl: 'https://www.notion.so/settings/billing' },
  { id: 'adobe-cc', name: 'Adobe CC コンプリート', price: 7780, category: 'cloud', cancelUrl: 'https://account.adobe.com/plans' },
  { id: 'gym', name: 'フィットネスジム', price: 8000, category: 'other', cancelUrl: '#' }
];

let selectedServices = [
  { id: 'chatgpt', name: 'ChatGPT Plus', price: 3000, category: 'ai' },
  { id: 'netflix', name: 'Netflix (スタンダード)', price: 1590, category: 'video' },
  { id: 'spotify', name: 'Spotify Premium', price: 980, category: 'music' }
];

const presetGrid = document.getElementById('preset-grid');
const selectedListBody = document.getElementById('selected-list-body');
const categoryBars = document.getElementById('category-bars');

const rankBadge = document.getElementById('rank-badge');
const totalMonthlyVal = document.getElementById('total-monthly-val');
const totalYearlyVal = document.getElementById('total-yearly-val');
const rankDesc = document.getElementById('rank-desc');
const statCount = document.getElementById('stat-count');
const statPerDay = document.getElementById('stat-per-day');

const heroMockRank = document.getElementById('hero-mock-rank');
const heroMockTotal = document.getElementById('hero-mock-total');
const heroMockYearly = document.getElementById('hero-mock-yearly');
const heroMockChips = document.getElementById('hero-mock-chips');

const custName = document.getElementById('cust-name');
const custPrice = document.getElementById('cust-price');
const custCategory = document.getElementById('cust-category');
const btnAddCustom = document.getElementById('btn-add-custom');
const quickCounterVal = document.getElementById('quick-counter-val');

const chkAnnualPlan = document.getElementById('chk-annual-plan');
const annualSavingsBadge = document.getElementById('annual-savings-badge');

function init() {
  initThemeToggle();
  loadStateFromLocalStorage();
  renderPresetGrid();
  bindEvents();
  calculateAndRender();
}

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  const savedTheme = localStorage.getItem('app_theme') || 'light';
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  if (btn) {
    btn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      localStorage.setItem('app_theme', next);
    });
  }
}

function saveStateToLocalStorage() {
  try {
    const state = {
      selectedServices,
      isAnnual: chkAnnualPlan ? chkAnnualPlan.checked : false
    };
    localStorage.setItem('subsc_cut_state', JSON.stringify(state));
  } catch (e) {
    console.warn('LocalStorage save skipped:', e);
  }
}

function loadStateFromLocalStorage() {
  try {
    const saved = localStorage.getItem('subsc_cut_state');
    if (!saved) return;
    const state = JSON.parse(saved);
    if (state.selectedServices && Array.isArray(state.selectedServices)) {
      selectedServices = state.selectedServices;
    }
    if (chkAnnualPlan && state.isAnnual !== undefined) {
      chkAnnualPlan.checked = state.isAnnual;
    }
  } catch (e) {
    console.warn('LocalStorage restore skipped:', e);
  }
}

function bindEvents() {
  btnAddCustom.addEventListener('click', addCustomService);
  if (chkAnnualPlan) chkAnnualPlan.addEventListener('change', calculateAndRender);
  const btnGcal = document.getElementById('btn-gcal-direct');
  if (btnGcal) btnGcal.addEventListener('click', addGoogleCalendarDirect);
  // Persona Presets Click Handlers
  document.getElementById('preset-btn-dev')?.addEventListener('click', () => applyPersonaPreset(['chatgpt', 'cursor-pro', 'perplexity-pro']));
  document.getElementById('preset-btn-media')?.addEventListener('click', () => applyPersonaPreset(['youtube-premium', 'netflix', 'adobe-cc']));
  document.getElementById('preset-btn-family')?.addEventListener('click', () => applyPersonaPreset(['amazon-prime', 'spotify', 'icloud-200gb']));

  document.getElementById('btn-download-ics').addEventListener('click', downloadICS);
  document.getElementById('btn-share-x').addEventListener('click', shareToX);
  document.getElementById('btn-copy-summary').addEventListener('click', copySummary);
  document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);

  // Floating Nav Click Handlers
  const btnFloatStep1 = document.getElementById('btn-float-step1');
  const btnFloatStep2 = document.getElementById('btn-float-step2');
  const btnFloatTop = document.getElementById('btn-float-top');

  if (btnFloatStep1) {
    btnFloatStep1.addEventListener('click', () => {
      document.getElementById('step-1')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (btnFloatStep2) {
    btnFloatStep2.addEventListener('click', () => {
      document.getElementById('step-2')?.scrollIntoView({ behavior: 'smooth' });
    });
  }
  if (btnFloatTop) {
    btnFloatTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

function applyPersonaPreset(targetIds) {
  selectedServices = PRESET_SUBSCRIPTIONS.filter(s => targetIds.includes(s.id));
  renderPresetGrid();
  calculateAndRender();
}

function renderPresetGrid() {
  presetGrid.innerHTML = PRESET_SUBSCRIPTIONS.map(sub => {
    const isSel = selectedServices.some(s => s.id === sub.id);
    return `
      <div class="preset-chip ${isSel ? 'active' : ''}" data-id="${sub.id}">
        <span class="chip-name">${sub.name}</span>
        <span class="chip-price">¥${sub.price.toLocaleString()}/月</span>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.preset-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      const found = PRESET_SUBSCRIPTIONS.find(s => s.id === id);
      if (!found) return;

      const idx = selectedServices.findIndex(s => s.id === id);
      if (idx >= 0) {
        selectedServices.splice(idx, 1);
        chip.classList.remove('active');
      } else {
        selectedServices.push(found);
        chip.classList.add('active');
      }
      calculateAndRender();
    });
  });
}

function addCustomService() {
  let name = custName.value.trim();
  let priceStr = custPrice.value.trim();
  const category = custCategory.value;

  if (!name || !priceStr) {
    alert('サービス名と月額料金を入力してください。');
    return;
  }

  priceStr = priceStr.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  const price = parseInt(priceStr);

  if (isNaN(price) || price <= 0) {
    alert('正しい金額を入力してください。');
    return;
  }

  const customObj = {
    id: `custom_${Date.now()}`,
    name,
    price,
    category
  };

  selectedServices.push(customObj);
  custName.value = '';
  custPrice.value = '';
  calculateAndRender();
}

function calculateAndRender() {
  const isAnnual = chkAnnualPlan ? chkAnnualPlan.checked : false;
  const rawMonthly = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const totalMonthly = isAnnual ? Math.round(rawMonthly * 0.85) : rawMonthly;
  const totalYearly = totalMonthly * 12;
  const count = selectedServices.length;
  const perDay = Math.round(totalMonthly / 30);

  const potentialYearlySavings = Math.round(rawMonthly * 12 * 0.15);

  if (annualSavingsBadge) {
    annualSavingsBadge.textContent = isAnnual
      ? `年払い15%OFF適用中！ (年間 ¥${potentialYearlySavings.toLocaleString()} 節約中)`
      : `年払いに変更で年間 約¥${potentialYearlySavings.toLocaleString()} 節約可能！`;
  }

  let rank = 'S';
  let descText = '';

  if (totalMonthly === 0) {
    rank = 'S: サブスクゼロ（節約神）';
    descText = 'サブスク契約は0件です。無駄な固定費は一切発生していません！';
  } else if (totalMonthly < 3000) {
    rank = 'S: 超優良レベル';
    descText = '素晴らしい！月額3,000円以下の最小限に抑えられています。';
  } else if (totalMonthly < 8000) {
    rank = 'A: 健全レベル';
    descText = '平均的な支出範囲です。不要なサブスクがないか定期点検しましょう。';
  } else if (totalMonthly < 15000) {
    rank = 'B: 要注意レベル';
    descText = '月額1万円を超えています！重複している動画やAIサービスを見直すチャンス。';
  } else if (totalMonthly < 30000) {
    rank = 'C: 危険レベル';
    descText = '年間30万円以上の出費！解約し忘れているサービスがないか至急確認してください。';
  } else {
    rank = 'F: 警告！超浪費レベル';
    descText = '年間36万円超え！即刻、解約整理を行いましょう。';
  }

  rankBadge.textContent = rank;

  // High Jump-Rate Price Display
  totalMonthlyVal.innerHTML = `
    <span class="currency-unit">¥</span>
    <span class="price-num">${totalMonthly.toLocaleString()}</span>
    <span class="per-month">/ 月${isAnnual ? ' (年払い換算)' : ''}</span>
  `;

  totalYearlyVal.textContent = `年間想定: ¥ ${totalYearly.toLocaleString()}`;
  rankDesc.textContent = descText;
  statCount.textContent = `${count} 件`;
  statPerDay.textContent = `¥ ${perDay.toLocaleString()}`;

  if (quickCounterVal) {
    quickCounterVal.textContent = `月額 ¥ ${totalMonthly.toLocaleString()} (${count}件)`;
  }

  if (heroMockRank) heroMockRank.textContent = rank;
  if (heroMockTotal) heroMockTotal.textContent = `月額合計: ¥ ${totalMonthly.toLocaleString()} / 月`;
  if (heroMockYearly) heroMockYearly.textContent = `（年間想定: ¥ ${totalYearly.toLocaleString()}）`;
  if (heroMockChips) {
    if (selectedServices.length === 0) {
      heroMockChips.innerHTML = '<span class="mock-chip">選択なし</span>';
    } else {
      heroMockChips.innerHTML = selectedServices.slice(0, 3).map(s => `<span class="mock-chip">${s.name}</span>`).join('');
    }
  }

  const catTotals = { ai: 0, video: 0, music: 0, cloud: 0, other: 0 };
  selectedServices.forEach(s => {
    catTotals[s.category] = (catTotals[s.category] || 0) + s.price;
  });

  categoryBars.innerHTML = '';
  if (totalMonthly > 0) {
    Object.keys(catTotals).forEach(cat => {
      const amt = catTotals[cat];
      if (amt > 0) {
        const pct = (amt / totalMonthly) * 100;
        const seg = document.createElement('div');
        seg.className = `cat-segment ${cat}`;
        seg.style.width = `${pct}%`;
        seg.title = `${cat.toUpperCase()}: ${pct.toFixed(1)}%`;
        categoryBars.appendChild(seg);
      }
    });
  }

  renderSelectedTable();
  renderCategoryBreakdown(selectedServices, rawMonthly);
  saveStateToLocalStorage();
}

function renderCategoryBreakdown(services, totalSum) {
  const barContainer = document.getElementById('category-segmented-bar');
  const legendContainer = document.getElementById('category-legend-grid');
  if (!barContainer || !legendContainer) return;

  if (totalSum === 0 || services.length === 0) {
    barContainer.innerHTML = `<div style="width:100%; height:100%; background:#e2e8f0;"></div>`;
    legendContainer.innerHTML = `<span style="color:var(--text-muted);">選択中のサブスクはありません</span>`;
    return;
  }

  const catMap = {
    ai: { name: 'AI・ツール', color: '#6366f1', sum: 0 },
    video: { name: '動画・エンタメ', color: '#ef4444', sum: 0 },
    music: { name: '音楽・書籍', color: '#10b981', sum: 0 },
    cloud: { name: '仕事・クラウド', color: '#3b82f6', sum: 0 },
    other: { name: 'その他', color: '#8b5cf6', sum: 0 }
  };

  services.forEach(s => {
    const catKey = catMap[s.category] ? s.category : 'other';
    catMap[catKey].sum += s.price;
  });

  let barHtml = '';
  let legendHtml = '';

  Object.keys(catMap).forEach(key => {
    const item = catMap[key];
    if (item.sum > 0) {
      const pct = ((item.sum / totalSum) * 100).toFixed(1);
      barHtml += `<div style="width:${pct}%; height:100%; background:${item.color};" title="${item.name}: ${pct}%"></div>`;
      legendHtml += `
        <div style="display:flex; align-items:center; gap:0.4rem;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${item.color};"></span>
          <span>${item.name}: <strong style="color:var(--text-main);">¥${item.sum.toLocaleString()}</strong> (${pct}%)</span>
        </div>
      `;
    }
  });

  barContainer.innerHTML = barHtml;
  legendContainer.innerHTML = legendHtml;
}

function renderSelectedTable() {
  selectedListBody.innerHTML = '';

  if (selectedServices.length === 0) {
    selectedListBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--text-dim); padding:1.5rem;">契約サブスクが選択されていません。上のパネルからタップして追加してください。</td></tr>`;
    return;
  }

  selectedServices.forEach((sub, idx) => {
    const tr = document.createElement('tr');
    const cancelBtnHtml = (sub.cancelUrl && sub.cancelUrl !== '#')
      ? `<a href="${sub.cancelUrl}" target="_blank" rel="noopener noreferrer" style="font-size:0.75rem; background:#fee2e2; color:#dc2626; border:1px solid #fca5a5; padding:0.25rem 0.6rem; border-radius:4px; font-weight:800; text-decoration:none; margin-right:0.4rem; display:inline-block;">公式解約ページ ➔</a>`
      : '';

    tr.innerHTML = `
      <td><strong>${sub.name}</strong></td>
      <td><span style="font-size:0.78rem; background:#f1f5f9; padding:0.25rem 0.6rem; border-radius:4px; font-weight:700;">${sub.category.toUpperCase()}</span></td>
      <td style="font-family:'Plus Jakarta Sans',sans-serif; font-weight:800; color:var(--accent-emerald); font-size:1rem;">¥${sub.price.toLocaleString()}</td>
      <td style="font-family:'Plus Jakarta Sans',sans-serif;">¥${(sub.price * 12).toLocaleString()}</td>
      <td>
        ${cancelBtnHtml}
        <button class="action-btn" onclick="editService(${idx})" style="font-size:0.75rem; padding:0.25rem 0.5rem; margin-right:0.3rem;">金額編集</button>
        <button class="remove-btn" onclick="removeService(${idx})">削除</button>
      </td>
    `;
    selectedListBody.appendChild(tr);
  });
}

window.editService = function(index) {
  const target = selectedServices[index];
  if (!target) return;
  const newPriceStr = prompt(`『${target.name}』の新しい月額料金（半角数字）を入力してください:`, target.price);
  if (newPriceStr !== null) {
    const newPrice = parseInt(newPriceStr.replace(/[^0-9]/g, ''));
    if (!isNaN(newPrice) && newPrice >= 0) {
      target.price = newPrice;
      calculateAndRender();
      if (typeof showToast === 'function') showToast(`『${target.name}』の金額を ¥${newPrice.toLocaleString()} に変更しました`);
    } else {
      alert('正しい数字を入力してください。');
    }
  }
};

window.removeService = function(index) {
  const removed = selectedServices[index];
  selectedServices.splice(index, 1);

  document.querySelectorAll('.preset-chip').forEach(chip => {
    if (chip.dataset.id === removed.id) {
      chip.classList.remove('active');
    }
  });

  calculateAndRender();
};

function shareToX() {
  const totalMonthly = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const count = selectedServices.length;

  const text = `【SubscCut サブスク診断】\n私の毎月のサブスク固定費は『月額 ¥${totalMonthly.toLocaleString()}』（計${count}件）でした！\n\nあなたのサブスク・固定費を診断＆解約カレンダー(.ics)自動生成👇\n`;
  const url = encodeURIComponent(window.location.href);
  const hashtags = encodeURIComponent('SubscCut,サブスク見直し,節約,固定費診断');

  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${url}&hashtags=${hashtags}`, '_blank');
}

function addGoogleCalendarDirect() {
  if (selectedServices.length === 0) {
    alert('カレンダーを生成するサブスクが選択されていません。');
    return;
  }

  const now = new Date();
  const targetDate = new Date(now.setDate(now.getDate() + 14));
  const dateStr = targetDate.toISOString().replace(/-|:|\.\d\d\d/g, "").slice(0, 8);

  const totalMonthly = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const names = selectedServices.map(s => s.name).join(', ');

  const title = encodeURIComponent(`【SubscCut】サブスク契約・解約見直しリマインダー`);
  const details = encodeURIComponent(`SubscCutで診断されたサブスクの見直し通知です。\n対象サービス: ${names}\n月額合計: ¥${totalMonthly.toLocaleString()}\n\n不要なサブスクの解約手続きを行ってください。`);

  const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${details}`;
  window.open(gcalUrl, '_blank');
}

function downloadICS() {
  if (selectedServices.length === 0) {
    alert('カレンダーを生成するサブスクが選択されていません。');
    return;
  }

  let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SubscCut//Subscription Reminder//JA\n";

  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 25);
  const dateStr = nextMonth.toISOString().replace(/-|:|\.\d+/g, "").slice(0, 8);

  selectedServices.forEach(s => {
    icsContent += "BEGIN:VEVENT\n";
    icsContent += `SUMMARY:【解約点検】${s.name} (月額¥${s.price.toLocaleString()})\n`;
    icsContent += `DESCRIPTION:SubscCutからの解約リマインダーです。${s.name}の契約を継続するか点検してください。\\nhttps://katakatalab.com/\n`;
    icsContent += `DTSTART;VALUE=DATE:${dateStr}\n`;
    icsContent += `DTEND;VALUE=DATE:${dateStr}\n`;
    icsContent += "END:VEVENT\n";
  });

  icsContent += "END:VCALENDAR";

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SubscCut_Reminder_${dateStr}.ics`;
  a.click();
}

function copySummary() {
  const totalMonthly = selectedServices.reduce((sum, s) => sum + s.price, 0);
  let txt = `【SubscCut 診断結果】\n`;
  txt += `契約件数: ${selectedServices.length} 件\n`;
  txt += `月額合計: ¥${totalMonthly.toLocaleString()} / 年間想定: ¥${(totalMonthly * 12).toLocaleString()}\n\n`;
  txt += `[契約サービス一覧]\n`;
  selectedServices.forEach(s => {
    txt += `・${s.name} (¥${s.price.toLocaleString()}/月)\n`;
  });
  txt += `\n診断ツール: ${window.location.href}`;

  navigator.clipboard.writeText(txt).then(() => {
    alert('診断結果サマリーをコピーしました！');
  });
}

function exportCSV() {
  let csvContent = "\uFEFF";
  csvContent += "サービス名,カテゴリ,月額料金(円),年間料金(円)\n";

  selectedServices.forEach(s => {
    csvContent += `"${s.name}","${s.category}",${s.price},${s.price * 12}\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SubscCut_Report_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}

function exportJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedServices, null, 2));
  const a = document.createElement('a');
  a.href = dataStr;
  a.download = `SubscCut_Export_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
}

function showToast(message) {
  let toast = document.getElementById('global-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'global-toast';
    toast.style.cssText = 'position:fixed; bottom:24px; right:24px; z-index:9999; background:#047857; color:#ffffff; padding:0.75rem 1.25rem; border-radius:8px; font-weight:800; font-size:0.88rem; box-shadow:0 10px 25px rgba(0,0,0,0.25); transition:all 0.3s ease; opacity:0; transform:translateY(20px); pointer-events:none; border:1px solid #10b981;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
  }, 2500);
}

document.addEventListener('DOMContentLoaded', init);
