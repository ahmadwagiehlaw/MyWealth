// ==========================================
// Calculator UI - Enhanced Strategic Calculator
// ==========================================

import { registerView } from '../core/router.js';
import { getState } from '../core/state.js';
import { formatCurrency, formatPercent } from '../utils/formatters.js';
import { showToast } from '../utils/ui-helpers.js';

// Current active tab
let activeTab = 'profit';

/**
 * Render the calculator view
 */
export async function renderCalculator() {
    const container = document.getElementById('calculator-container');
    if (!container) return;

    container.innerHTML = `
        <!-- Calculator Tabs -->
        <div class="calc-tabs" style="
            display: flex;
            gap: 0.5rem;
            overflow-x: auto;
            padding-bottom: 0.5rem;
            margin-bottom: 1.5rem;
            scrollbar-width: none;
        ">
            <button class="calc-tab ${activeTab === 'profit' ? 'active' : ''}" data-tab="profit" style="--tab-color: #10b981;">
                <i class="fa-solid fa-calculator"></i> الربح
            </button>
            <button class="calc-tab ${activeTab === 'position' ? 'active' : ''}" data-tab="position" style="--tab-color: #f59e0b;">
                <i class="fa-solid fa-scale-balanced"></i> حجم الصفقة
            </button>
            <button class="calc-tab ${activeTab === 'averaging' ? 'active' : ''}" data-tab="averaging" style="--tab-color: #3b82f6;">
                <i class="fa-solid fa-chart-line"></i> التبريد
            </button>
            <button class="calc-tab ${activeTab === 'risk' ? 'active' : ''}" data-tab="risk" style="--tab-color: #8b5cf6;">
                <i class="fa-solid fa-balance-scale"></i> R:R
            </button>
            <button class="calc-tab ${activeTab === 'compound' ? 'active' : ''}" data-tab="compound" style="--tab-color: #ec4899;">
                <i class="fa-solid fa-piggy-bank"></i> فائدة مركبة
            </button>
        </div>
        
        <!-- Calculator Content -->
        <div id="calc-content"></div>
    `;

    // Tab switching
    container.querySelectorAll('.calc-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            activeTab = tab.dataset.tab;
            container.querySelectorAll('.calc-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderActiveCalculator();
        });
    });

    // Render active calculator
    renderActiveCalculator();
}

function renderActiveCalculator() {
    const content = document.getElementById('calc-content');
    if (!content) return;

    switch (activeTab) {
        case 'profit': renderProfitCalc(content); break;
        case 'position': renderPositionCalc(content); break;
        case 'averaging': renderAveragingCalc(content); break;
        case 'risk': renderRiskRewardCalc(content); break;
        case 'compound': renderCompoundCalc(content); break;
    }
}

// ==========================================
// 1. Profit Calculator
// ==========================================

function renderProfitCalc(container) {
    container.innerHTML = `
        <div class="calc-card" style="--accent: #10b981;">
            <div class="calc-header">
                <div class="calc-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                    <i class="fa-solid fa-calculator"></i>
                </div>
                <div>
                    <h3>حاسبة الربح والخسارة</h3>
                    <p>احسب أرباحك وخسائرك بدقة</p>
                </div>
            </div>
            
            <div class="calc-form">
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-cart-shopping"></i> سعر الشراء</label>
                        <input type="number" id="p-buy" placeholder="100" step="0.01">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-hand-holding-dollar"></i> سعر البيع</label>
                        <input type="number" id="p-sell" placeholder="120" step="0.01">
                    </div>
                </div>
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-layer-group"></i> الكمية</label>
                        <input type="number" id="p-qty" placeholder="100" value="100">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-percent"></i> العمولة %</label>
                        <input type="number" id="p-fee" placeholder="0.5" value="0.5" step="0.1">
                    </div>
                </div>
            </div>
            
            <div id="profit-results" class="calc-results" style="display: none;">
                <div class="calc-result-grid">
                    <div class="result-card">
                        <span class="result-label">إجمالي الشراء</span>
                        <span id="pr-buy-total" class="result-value" style="color: #3b82f6;">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">إجمالي البيع</span>
                        <span id="pr-sell-total" class="result-value" style="color: #8b5cf6;">--</span>
                    </div>
                    <div class="result-card featured">
                        <span class="result-label">صافي الربح</span>
                        <span id="pr-net" class="result-value big">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">نسبة الربح</span>
                        <span id="pr-pct" class="result-value">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">نصيب الشريك</span>
                        <span id="pr-partner" class="result-value" style="color: #f59e0b;">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">نصيبي</span>
                        <span id="pr-mine" class="result-value" style="color: var(--gold);">--</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Auto calculate on input
    ['p-buy', 'p-sell', 'p-qty', 'p-fee'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calcProfit);
    });
}

function calcProfit() {
    const buy = parseFloat(document.getElementById('p-buy')?.value) || 0;
    const sell = parseFloat(document.getElementById('p-sell')?.value) || 0;
    const qty = parseFloat(document.getElementById('p-qty')?.value) || 0;
    const fee = parseFloat(document.getElementById('p-fee')?.value) || 0;

    if (!buy || !sell || !qty) {
        document.getElementById('profit-results').style.display = 'none';
        return;
    }

    const { settings } = getState();
    const partnerRatio = settings?.partnerSplitRatio || 0.5;

    const buyTotal = buy * qty;
    const sellTotal = sell * qty;
    const fees = (buyTotal + sellTotal) * (fee / 100);
    const net = sellTotal - buyTotal - fees;
    const pct = buyTotal > 0 ? (net / buyTotal * 100) : 0;
    const partner = net > 0 ? net * partnerRatio : 0;
    const mine = net - partner;

    document.getElementById('profit-results').style.display = 'block';
    document.getElementById('pr-buy-total').textContent = formatCurrency(buyTotal);
    document.getElementById('pr-sell-total').textContent = formatCurrency(sellTotal);

    const netEl = document.getElementById('pr-net');
    netEl.textContent = (net >= 0 ? '+' : '') + formatCurrency(net);
    netEl.style.color = net >= 0 ? 'var(--green)' : 'var(--red)';

    const pctEl = document.getElementById('pr-pct');
    pctEl.textContent = formatPercent(pct);
    pctEl.style.color = pct >= 0 ? 'var(--green)' : 'var(--red)';

    document.getElementById('pr-partner').textContent = formatCurrency(partner);
    document.getElementById('pr-mine').textContent = formatCurrency(mine);
}

// ==========================================
// 2. Position Size Calculator
// ==========================================

function renderPositionCalc(container) {
    container.innerHTML = `
        <div class="calc-card" style="--accent: #f59e0b;">
            <div class="calc-header">
                <div class="calc-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                    <i class="fa-solid fa-scale-balanced"></i>
                </div>
                <div>
                    <h3>حاسبة حجم المركز</h3>
                    <p>حدد عدد الأسهم بناءً على المخاطرة</p>
                </div>
            </div>
            
            <div class="calc-form">
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-sack-dollar"></i> رأس المال</label>
                        <input type="number" id="pos-capital" placeholder="100000">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-percent"></i> نسبة المخاطرة %</label>
                        <input type="number" id="pos-risk" value="2" min="0.1" max="10" step="0.1">
                    </div>
                </div>
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-right-to-bracket"></i> سعر الدخول</label>
                        <input type="number" id="pos-entry" placeholder="50" step="0.01">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-shield-halved"></i> وقف الخسارة</label>
                        <input type="number" id="pos-stop" placeholder="47" step="0.01">
                    </div>
                </div>
            </div>
            
            <div id="position-results" class="calc-results" style="display: none;">
                <div class="calc-result-grid">
                    <div class="result-card featured">
                        <span class="result-label">عدد الأسهم</span>
                        <span id="psr-shares" class="result-value big" style="color: var(--gold);">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">قيمة المركز</span>
                        <span id="psr-value" class="result-value" style="color: #3b82f6;">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">أقصى خسارة</span>
                        <span id="psr-loss" class="result-value" style="color: var(--red);">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">نسبة من رأس المال</span>
                        <span id="psr-pct" class="result-value" style="color: #8b5cf6;">--</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    ['pos-capital', 'pos-risk', 'pos-entry', 'pos-stop'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calcPosition);
    });
}

function calcPosition() {
    const capital = parseFloat(document.getElementById('pos-capital')?.value) || 0;
    const riskPct = parseFloat(document.getElementById('pos-risk')?.value) || 0;
    const entry = parseFloat(document.getElementById('pos-entry')?.value) || 0;
    const stop = parseFloat(document.getElementById('pos-stop')?.value) || 0;

    if (!capital || !riskPct || !entry || !stop || entry <= stop) {
        document.getElementById('position-results').style.display = 'none';
        return;
    }

    const maxRisk = capital * (riskPct / 100);
    const riskPerShare = entry - stop;
    const shares = Math.floor(maxRisk / riskPerShare);
    const value = shares * entry;
    const pctOfCapital = (value / capital) * 100;

    document.getElementById('position-results').style.display = 'block';
    document.getElementById('psr-shares').textContent = shares.toLocaleString();
    document.getElementById('psr-value').textContent = formatCurrency(value);
    document.getElementById('psr-loss').textContent = formatCurrency(maxRisk);
    document.getElementById('psr-pct').textContent = formatPercent(pctOfCapital, false);
}

// ==========================================
// 3. Averaging Down Calculator
// ==========================================

function renderAveragingCalc(container) {
    container.innerHTML = `
        <div class="calc-card" style="--accent: #3b82f6;">
            <div class="calc-header">
                <div class="calc-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
                    <i class="fa-solid fa-chart-line"></i>
                </div>
                <div>
                    <h3>حاسبة التبريد (Averaging)</h3>
                    <p>احسب متوسط التكلفة الجديد</p>
                </div>
            </div>
            
            <div class="calc-form">
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-layer-group"></i> الكمية الحالية</label>
                        <input type="number" id="avg-qty1" placeholder="100">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-tag"></i> المتوسط الحالي</label>
                        <input type="number" id="avg-price1" placeholder="50" step="0.01">
                    </div>
                </div>
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-plus"></i> الكمية الجديدة</label>
                        <input type="number" id="avg-qty2" placeholder="50">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-arrow-down"></i> السعر الجديد</label>
                        <input type="number" id="avg-price2" placeholder="40" step="0.01">
                    </div>
                </div>
            </div>
            
            <div id="avg-results" class="calc-results" style="display: none;">
                <div class="calc-result-grid">
                    <div class="result-card featured">
                        <span class="result-label">المتوسط الجديد</span>
                        <span id="avgr-new" class="result-value big" style="color: #3b82f6;">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">التغيير</span>
                        <span id="avgr-change" class="result-value">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">إجمالي الكمية</span>
                        <span id="avgr-total-qty" class="result-value">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">إجمالي التكلفة</span>
                        <span id="avgr-total-cost" class="result-value">--</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    ['avg-qty1', 'avg-price1', 'avg-qty2', 'avg-price2'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calcAveraging);
    });
}

function calcAveraging() {
    const qty1 = parseFloat(document.getElementById('avg-qty1')?.value) || 0;
    const price1 = parseFloat(document.getElementById('avg-price1')?.value) || 0;
    const qty2 = parseFloat(document.getElementById('avg-qty2')?.value) || 0;
    const price2 = parseFloat(document.getElementById('avg-price2')?.value) || 0;

    if (!qty1 || !price1 || !qty2 || !price2) {
        document.getElementById('avg-results').style.display = 'none';
        return;
    }

    const totalQty = qty1 + qty2;
    const totalCost = (qty1 * price1) + (qty2 * price2);
    const newAvg = totalCost / totalQty;
    const change = ((newAvg - price1) / price1) * 100;

    document.getElementById('avg-results').style.display = 'block';
    document.getElementById('avgr-new').textContent = newAvg.toFixed(2);

    const changeEl = document.getElementById('avgr-change');
    changeEl.textContent = formatPercent(change);
    changeEl.style.color = change < 0 ? 'var(--green)' : 'var(--red)';

    document.getElementById('avgr-total-qty').textContent = totalQty.toLocaleString();
    document.getElementById('avgr-total-cost').textContent = formatCurrency(totalCost);
}

// ==========================================
// 4. Risk/Reward Calculator
// ==========================================

function renderRiskRewardCalc(container) {
    container.innerHTML = `
        <div class="calc-card" style="--accent: #8b5cf6;">
            <div class="calc-header">
                <div class="calc-icon" style="background: linear-gradient(135deg, #8b5cf6, #6366f1);">
                    <i class="fa-solid fa-balance-scale"></i>
                </div>
                <div>
                    <h3>حاسبة العائد للمخاطرة</h3>
                    <p>احسب نسبة R:R للصفقة</p>
                </div>
            </div>
            
            <div class="calc-form">
                <div class="calc-field">
                    <label><i class="fa-solid fa-right-to-bracket"></i> سعر الدخول</label>
                    <input type="number" id="rr-entry" placeholder="100" step="0.01">
                </div>
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-shield-halved"></i> وقف الخسارة</label>
                        <input type="number" id="rr-stop" placeholder="95" step="0.01">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-trophy"></i> الهدف</label>
                        <input type="number" id="rr-target" placeholder="115" step="0.01">
                    </div>
                </div>
            </div>
            
            <div id="rr-results" class="calc-results" style="display: none;">
                <div class="calc-result-grid">
                    <div class="result-card featured" style="grid-column: span 2;">
                        <span class="result-label">نسبة R:R</span>
                        <span id="rrr-ratio" class="result-value big">--</span>
                        <span id="rrr-verdict" class="result-badge">--</span>
                    </div>
                    <div class="result-card" style="border-right: 3px solid var(--red);">
                        <span class="result-label">المخاطرة</span>
                        <span id="rrr-risk" class="result-value" style="color: var(--red);">--</span>
                        <span id="rrr-risk-pct" class="result-sub">--</span>
                    </div>
                    <div class="result-card" style="border-right: 3px solid var(--green);">
                        <span class="result-label">العائد</span>
                        <span id="rrr-reward" class="result-value" style="color: var(--green);">--</span>
                        <span id="rrr-reward-pct" class="result-sub">--</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    ['rr-entry', 'rr-stop', 'rr-target'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calcRiskReward);
    });
}

function calcRiskReward() {
    const entry = parseFloat(document.getElementById('rr-entry')?.value) || 0;
    const stop = parseFloat(document.getElementById('rr-stop')?.value) || 0;
    const target = parseFloat(document.getElementById('rr-target')?.value) || 0;

    if (!entry || !stop || !target) {
        document.getElementById('rr-results').style.display = 'none';
        return;
    }

    const isLong = target > entry;
    let risk, reward;

    if (isLong) {
        if (stop >= entry) return;
        risk = entry - stop;
        reward = target - entry;
    } else {
        if (stop <= entry) return;
        risk = stop - entry;
        reward = entry - target;
    }

    if (risk <= 0) return;

    const ratio = reward / risk;
    const riskPct = (risk / entry) * 100;
    const rewardPct = (reward / entry) * 100;

    document.getElementById('rr-results').style.display = 'block';
    document.getElementById('rrr-ratio').textContent = `1 : ${ratio.toFixed(2)}`;

    const verdict = document.getElementById('rrr-verdict');
    if (ratio >= 3) {
        verdict.textContent = 'ممتازة ✨';
        verdict.style.background = 'var(--green-bg)';
        verdict.style.color = 'var(--green)';
    } else if (ratio >= 2) {
        verdict.textContent = 'جيدة 👍';
        verdict.style.background = 'var(--orange-bg)';
        verdict.style.color = 'var(--orange)';
    } else if (ratio >= 1) {
        verdict.textContent = 'مقبولة';
        verdict.style.background = 'var(--blue-bg)';
        verdict.style.color = 'var(--blue)';
    } else {
        verdict.textContent = 'ضعيفة ⚠️';
        verdict.style.background = 'var(--red-bg)';
        verdict.style.color = 'var(--red)';
    }

    document.getElementById('rrr-risk').textContent = risk.toFixed(2);
    document.getElementById('rrr-risk-pct').textContent = `-${riskPct.toFixed(2)}%`;
    document.getElementById('rrr-reward').textContent = reward.toFixed(2);
    document.getElementById('rrr-reward-pct').textContent = `+${rewardPct.toFixed(2)}%`;
}

// ==========================================
// 5. Compound Interest Calculator
// ==========================================

function renderCompoundCalc(container) {
    container.innerHTML = `
        <div class="calc-card" style="--accent: #ec4899;">
            <div class="calc-header">
                <div class="calc-icon" style="background: linear-gradient(135deg, #ec4899, #db2777);">
                    <i class="fa-solid fa-piggy-bank"></i>
                </div>
                <div>
                    <h3>حاسبة الفائدة المركبة</h3>
                    <p>شاهد كيف تنمو ثروتك مع الوقت</p>
                </div>
            </div>
            
            <div class="calc-form">
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-sack-dollar"></i> المبلغ الأولي</label>
                        <input type="number" id="comp-principal" value="10000" placeholder="10000">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-hand-holding-dollar"></i> الإيداع الشهري</label>
                        <input type="number" id="comp-monthly" value="1000" placeholder="1000">
                    </div>
                </div>
                <div class="calc-row">
                    <div class="calc-field">
                        <label><i class="fa-solid fa-percent"></i> العائد السنوي %</label>
                        <input type="number" id="comp-rate" value="10" min="0" max="100" step="0.5">
                    </div>
                    <div class="calc-field">
                        <label><i class="fa-solid fa-calendar"></i> عدد السنوات</label>
                        <input type="number" id="comp-years" value="10" min="1" max="50">
                    </div>
                </div>
                <div class="calc-field">
                    <input type="range" id="comp-slider" min="1" max="50" value="10" style="width: 100%; accent-color: #ec4899;">
                </div>
            </div>
            
            <div id="comp-results" class="calc-results">
                <div class="calc-result-grid">
                    <div class="result-card featured" style="grid-column: span 2; background: linear-gradient(135deg, rgba(236, 72, 153, 0.1), rgba(219, 39, 119, 0.1)); border-color: rgba(236, 72, 153, 0.3);">
                        <span class="result-label">القيمة المستقبلية 🎯</span>
                        <span id="compr-fv" class="result-value big" style="color: #fff; font-size: 2rem;">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">إجمالي الإيداعات</span>
                        <span id="compr-deposits" class="result-value" style="color: #3b82f6;">--</span>
                    </div>
                    <div class="result-card">
                        <span class="result-label">الأرباح (الفوائد)</span>
                        <span id="compr-interest" class="result-value" style="color: var(--green);">--</span>
                    </div>
                </div>
                <p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; margin-top: 1rem;">
                    * محسوبة على أساس فائدة سنوية تُضاف شهرياً
                </p>
            </div>
        </div>
    `;

    const slider = document.getElementById('comp-slider');
    const yearsInput = document.getElementById('comp-years');

    slider?.addEventListener('input', () => {
        yearsInput.value = slider.value;
        calcCompound();
    });

    yearsInput?.addEventListener('input', () => {
        slider.value = yearsInput.value;
        calcCompound();
    });

    ['comp-principal', 'comp-monthly', 'comp-rate'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', calcCompound);
    });

    // Initial calc
    calcCompound();
}

function calcCompound() {
    const principal = parseFloat(document.getElementById('comp-principal')?.value) || 0;
    const monthly = parseFloat(document.getElementById('comp-monthly')?.value) || 0;
    const rate = parseFloat(document.getElementById('comp-rate')?.value) || 0;
    const years = parseFloat(document.getElementById('comp-years')?.value) || 0;

    if (years <= 0) return;

    const r = rate / 100;
    const n = 12;
    const t = years;

    // FV of principal: P(1 + r/n)^(nt)
    const fvPrincipal = principal * Math.pow(1 + r / n, n * t);

    // FV of monthly contributions: PMT * [((1 + r/n)^(nt) - 1) / (r/n)]
    const fvContributions = monthly > 0 && r > 0
        ? monthly * ((Math.pow(1 + r / n, n * t) - 1) / (r / n))
        : monthly * 12 * years;

    const totalFV = fvPrincipal + fvContributions;
    const totalDeposits = principal + (monthly * 12 * years);
    const totalInterest = totalFV - totalDeposits;

    document.getElementById('compr-fv').textContent = formatCurrency(totalFV);
    document.getElementById('compr-deposits').textContent = formatCurrency(totalDeposits);
    document.getElementById('compr-interest').textContent = formatCurrency(totalInterest);
}

// Register view
registerView('calculator', renderCalculator);

console.log('🧮 Enhanced Calculator UI loaded');
