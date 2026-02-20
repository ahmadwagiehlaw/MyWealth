// ==========================================
// Portfolios UI - Multi-Currency Vaults
// ==========================================

import { registerView } from '../core/router.js';
import { getState } from '../core/state.js';
import {
    getPortfolios,
    getPortfolioHistory,
    getPortfolioEvolutionSeries,
    createPortfolio,
    updatePortfolio,
    deletePortfolio
} from '../modules/portfolios.js';
import { formatCurrency, formatCompact, formatPercent, toEGP } from '../utils/formatters.js';
import { showLoading, hideLoading, showToast, openModal, closeModal, confirm } from '../utils/ui-helpers.js';

let singlePortfolioChart = null;
let activePortfolioRange = 'month';
let activePortfolioId = null;

/**
 * Render the portfolios view
 */
export async function renderPortfolios() {
    const container = document.getElementById('portfolios-container');
    if (!container) return;

    showLoading();

    try {
        const [portfolios] = await Promise.all([getPortfolios(), getPortfolioHistory()]);

        if (portfolios.length === 0) {
            container.innerHTML = renderEmptyState();
        } else {
            container.innerHTML = `
                ${renderSummaryBar(portfolios)}
                ${renderPortfolioCards(portfolios)}
            `;
        }
    } catch (error) {
        console.error('Portfolios Error:', error);
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 2.5rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 2rem; color: var(--red); margin-bottom: 0.7rem;"></i>
                <p>حدث خطأ في تحميل المحافظ</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// ==========================================
// Component Renderers
// ==========================================

function renderEmptyState() {
    return `
        <div class="glass-card" style="text-align: center; padding: 3rem 1.25rem;">
            <i class="fa-solid fa-vault" style="font-size: 3rem; color: var(--gold); margin-bottom: var(--space-md);"></i>
            <h3 style="margin-bottom: 0.35rem; color: var(--text-primary);">لا توجد محافظ</h3>
            <p style="color: var(--text-secondary); margin-bottom: 0.75rem;">أضف محفظتك الأولى لبدء التتبع</p>
            <button class="btn btn-primary" onclick="openAddPortfolioModal()">
                <i class="fa-solid fa-plus"></i>
                إضافة محفظة
            </button>
        </div>
    `;
}

function renderSummaryBar(portfolios) {
    const totalEGP = portfolios.reduce((sum, p) => sum + toEGP(p.currentValue, p.currency), 0);
    const currencies = [...new Set(portfolios.map(p => p.currency))];

    return `
        <div class="glass-card portfolio-summary-bar">
            <div>
                <div class="portfolio-summary-label">إجمالي القيمة السوقية</div>
                <div class="portfolio-summary-value">${formatCurrency(totalEGP)}</div>
                <div class="portfolio-summary-meta">${portfolios.length} محفظة • ${currencies.join(' + ')}</div>
            </div>
            <button class="btn btn-primary" onclick="openAddPortfolioModal()">
                <i class="fa-solid fa-plus"></i>
            </button>
        </div>
    `;
}

function renderPortfolioCards(portfolios) {
    return `
        <div class="portfolio-cards-wrap">
            ${portfolios.map(p => renderPortfolioCard(p)).join('')}
        </div>
    `;
}

function renderPortfolioCard(portfolio) {
    const invested = (portfolio.initialCapital || 0) + (portfolio.totalDeposits || 0) - (portfolio.totalWithdrawals || 0);
    const pnl = portfolio.currentValue - invested;
    const pnlPercent = invested > 0 ? (pnl / invested * 100) : 0;

    const currencyBadge = portfolio.currency === 'USD'
        ? '<span class="portfolio-currency-badge usd">$</span>'
        : '<span class="portfolio-currency-badge egp">ج.م</span>';

    const typeIcon = portfolio.type === 'BROKERAGE' ? 'fa-chart-line'
        : portfolio.type === 'FUND' ? 'fa-piggy-bank'
            : portfolio.type === 'FITNESS' ? 'fa-dumbbell'
                : 'fa-building-columns';

    const typeLabel = portfolio.type === 'BROKERAGE' ? 'وسيط'
        : portfolio.type === 'FUND' ? 'صندوق'
            : portfolio.type === 'FITNESS' ? 'تحدي رياضي'
                : 'بنك';

    return `
        <div class="glass-card portfolio-card" onclick="openPortfolioDetails('${portfolio.id}')">
            <div class="portfolio-card-head">
                <div style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
                    <div class="portfolio-type-icon">
                        <i class="fa-solid ${typeIcon}"></i>
                    </div>
                    <div class="portfolio-main-info">
                        <div class="portfolio-name-row">
                            <div class="portfolio-name">${portfolio.name}</div>
                            ${currencyBadge}
                        </div>
                        <div class="portfolio-type">${typeLabel}</div>
                    </div>
                </div>
                <div class="portfolio-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); openPortfolioChart('${portfolio.id}')" title="شارت المحفظة">
                        <i class="fa-solid fa-chart-line" style="color: var(--green);"></i>
                    </button>
                    <button class="btn-icon" onclick="event.stopPropagation(); openPortfolioMenu('${portfolio.id}')">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                </div>
            </div>

            <div class="portfolio-card-stats">
                <div>
                    <div class="portfolio-stat-label">القيمة</div>
                    <div class="portfolio-stat-value">${formatCompact(portfolio.currentValue)}</div>
                </div>
                <div>
                    <div class="portfolio-stat-label">المستثمر</div>
                    <div class="portfolio-stat-value" style="color:var(--text-secondary);">${formatCompact(invested)}</div>
                </div>
                <div>
                    <div class="portfolio-stat-label">العائد</div>
                    <div class="portfolio-stat-value" style="color:${pnl >= 0 ? 'var(--green)' : 'var(--red)'};">${formatPercent(pnlPercent)}</div>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// Modal Functions
// ==========================================

window.openAddPortfolioModal = () => {
    const content = `
        <form id="add-portfolio-form">
            <div class="form-group">
                <label class="form-label">اسم المحفظة</label>
                <input type="text" class="form-input" name="name" placeholder="مثال: هيرميس" required>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">العملة</label>
                    <select class="form-select" name="currency">
                        <option value="EGP">جنيه مصري (ج.م)</option>
                        <option value="USD">دولار ($)</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">النوع</label>
                    <select class="form-select" name="type">
                        <option value="BROKERAGE">وسيط</option>
                        <option value="FUND">صندوق استثماري</option>
                        <option value="FITNESS">تحدي رياضي</option>
                        <option value="BANK">بنك</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">رأس المال المبدئي</label>
                <input type="number" class="form-input" name="initialCapital" placeholder="0" min="0" step="0.01">
            </div>
        </form>
    `;

    const footer = `
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="submitAddPortfolio()">
            <i class="fa-solid fa-plus"></i> إضافة
        </button>
    `;

    openModal('إضافة محفظة جديدة', content, { footer });
};

window.submitAddPortfolio = async () => {
    const form = document.getElementById('add-portfolio-form');
    if (!form) return;

    const formData = new FormData(form);
    const data = {
        name: formData.get('name'),
        currency: formData.get('currency'),
        type: formData.get('type'),
        initialCapital: formData.get('initialCapital')
    };

    if (!data.name) {
        showToast('الرجاء إدخال اسم المحفظة', 'error');
        return;
    }

    try {
        showLoading();
        await createPortfolio(data);
        closeModal();
        showToast('تم إضافة المحفظة بنجاح', 'success');
        renderPortfolios();
    } catch (error) {
        showToast('فشل في إضافة المحفظة', 'error');
    } finally {
        hideLoading();
    }
};

window.openPortfolioDetails = async (id) => {
    const { portfolios } = getState();
    const portfolio = portfolios.find(p => p.id === id);
    if (!portfolio) return;

    const invested = (portfolio.initialCapital || 0) + (portfolio.totalDeposits || 0) - (portfolio.totalWithdrawals || 0);
    const pnl = portfolio.currentValue - invested;
    const pnlPercent = invested > 0 ? (pnl / invested * 100) : 0;

    const content = `
        <div style="text-align: center; margin-bottom: var(--space-md);">
            <div style="font-size: var(--font-size-2xl); font-weight: 800; color: var(--gold);">
                ${formatCurrency(portfolio.currentValue, portfolio.currency)}
            </div>
            <div style="font-size: var(--font-size-sm); color: ${pnl >= 0 ? 'var(--green)' : 'var(--red)'};">
                ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl, portfolio.currency)} (${formatPercent(pnlPercent)})
            </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-sm); margin-bottom: var(--space-md);">
            <div class="glass-card" style="padding: var(--space-sm); text-align: center;">
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">المستثمر</div>
                <div style="font-weight: 700;">${formatCurrency(invested, portfolio.currency)}</div>
            </div>
            <div class="glass-card" style="padding: var(--space-sm); text-align: center;">
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">الإيداعات</div>
                <div style="font-weight: 700;">${formatCurrency(portfolio.totalDeposits || 0, portfolio.currency)}</div>
            </div>
        </div>

        <form id="update-portfolio-form">
            <div class="form-group">
                <label class="form-label">تحديث القيمة السوقية</label>
                <input type="number" class="form-input" name="currentValue" value="${portfolio.currentValue}" step="0.01">
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">إيداع</label>
                    <input type="number" class="form-input" name="deposit" placeholder="0" min="0" step="0.01">
                </div>
                <div class="form-group">
                    <label class="form-label">سحب</label>
                    <input type="number" class="form-input" name="withdrawal" placeholder="0" min="0" step="0.01">
                </div>
            </div>
        </form>
    `;

    const footer = `
        <button class="btn" style="background: var(--red-bg); color: var(--red);" onclick="confirmDeletePortfolio('${id}')">
            <i class="fa-solid fa-trash"></i>
        </button>
        <button class="btn" style="background: var(--green-bg); color: var(--green);" onclick="openPortfolioChart('${id}')">
            <i class="fa-solid fa-chart-line"></i>
        </button>
        <div style="flex: 1;"></div>
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="submitUpdatePortfolio('${id}')">
            <i class="fa-solid fa-check"></i> تحديث
        </button>
    `;

    openModal(portfolio.name, content, { footer });
};

window.submitUpdatePortfolio = async (id) => {
    const form = document.getElementById('update-portfolio-form');
    if (!form) return;

    const formData = new FormData(form);
    const { portfolios } = getState();
    const portfolio = portfolios.find(p => p.id === id);
    if (!portfolio) return;

    const newValue = parseFloat(formData.get('currentValue')) || portfolio.currentValue;
    const deposit = parseFloat(formData.get('deposit')) || 0;
    const withdrawal = parseFloat(formData.get('withdrawal')) || 0;

    const updates = {
        currentValue: newValue + deposit - withdrawal,
        totalDeposits: (portfolio.totalDeposits || 0) + deposit,
        totalWithdrawals: (portfolio.totalWithdrawals || 0) + withdrawal
    };

    try {
        showLoading();
        await updatePortfolio(id, updates);
        closeModal();
        showToast('تم التحديث', 'success');
        renderPortfolios();
    } catch (error) {
        showToast('فشل في التحديث', 'error');
    } finally {
        hideLoading();
    }
};

window.confirmDeletePortfolio = async (id) => {
    const confirmed = await confirm('هل أنت متأكد من حذف هذه المحفظة؟');
    if (!confirmed) return;

    try {
        showLoading();
        await deletePortfolio(id);
        closeModal();
        showToast('تم الحذف', 'success');
        renderPortfolios();
    } catch (error) {
        showToast('فشل في الحذف', 'error');
    } finally {
        hideLoading();
    }
};

window.openPortfolioChart = (id) => {
    const { portfolios } = getState();
    const portfolio = portfolios.find(p => p.id === id);
    if (!portfolio) return;

    activePortfolioId = id;
    activePortfolioRange = 'month';

    const content = `
        <div style="margin-bottom: var(--space-sm); display:flex; justify-content:space-between; align-items:center; gap:0.5rem;">
            <div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">القيمة الحالية</div>
                <div style="font-size: var(--font-size-lg); font-weight: 800; color: var(--gold);">${formatCurrency(portfolio.currentValue, portfolio.currency)}</div>
            </div>
            <div class="profits-chart-filters" id="portfolio-range-filters">
                <button class="profits-chart-filter active" data-portfolio-range="month">شهري</button>
                <button class="profits-chart-filter" data-portfolio-range="week">أسبوعي</button>
                <button class="profits-chart-filter" data-portfolio-range="year">سنوي</button>
            </div>
        </div>
        <div class="portfolio-chart-wrap">
            <canvas id="singlePortfolioChart"></canvas>
            <div id="single-portfolio-empty" class="profits-chart-empty hidden">لا توجد بيانات كافية لعرض تطور المحفظة</div>
        </div>
    `;

    const footer = `
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إغلاق</button>
    `;

    openModal(`تطور ${portfolio.name}`, content, { footer });
    bindSinglePortfolioFilters();
    setTimeout(() => initSinglePortfolioChart(), 30);
};

function bindSinglePortfolioFilters() {
    const buttons = document.querySelectorAll('[data-portfolio-range]');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextRange = btn.dataset.portfolioRange;
            if (!nextRange || nextRange === activePortfolioRange) return;
            activePortfolioRange = nextRange;
            buttons.forEach(b => b.classList.toggle('active', b.dataset.portfolioRange === activePortfolioRange));
            initSinglePortfolioChart();
        });
    });
}

function initSinglePortfolioChart() {
    const canvas = document.getElementById('singlePortfolioChart');
    const empty = document.getElementById('single-portfolio-empty');
    if (!canvas || !activePortfolioId) return;

    const points = getPortfolioEvolutionSeries(activePortfolioId, activePortfolioRange);

    if (singlePortfolioChart) {
        singlePortfolioChart.destroy();
        singlePortfolioChart = null;
    }

    if (points.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    const tickColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

    singlePortfolioChart = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels: points.map(p => p.label),
            datasets: [{
                label: 'قيمة المحفظة (ج.م)',
                data: points.map(p => p.value),
                yAxisID: 'y',
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59,130,246,0.16)',
                fill: true,
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 4
            }, {
                label: 'التغير %',
                data: points.map(p => p.changePct),
                yAxisID: 'y1',
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245,158,11,0.14)',
                borderDash: [5, 4],
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 2.5,
                pointHoverRadius: 4,
                spanGaps: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: {
                        color: tickColor,
                        boxWidth: 10,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    callbacks: {
                        label: (ctx) => {
                            if (ctx.dataset.yAxisID === 'y1') {
                                if (ctx.raw === null || Number.isNaN(ctx.raw)) return ' التغير: —';
                                return ` التغير: ${formatPercent(ctx.raw, true)}`;
                            }
                            return ` القيمة: ${formatCurrency(ctx.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    position: 'left',
                    grid: { color: gridColor },
                    ticks: {
                        color: tickColor,
                        callback: (value) => formatCurrency(value)
                    }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#f59e0b',
                        callback: (value) => `${value}%`
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: tickColor,
                        autoSkip: true,
                        maxRotation: 0
                    }
                }
            }
        }
    });
}

window.openPortfolioMenu = (id) => {
    openPortfolioDetails(id);
};

document.getElementById('add-portfolio-btn')?.addEventListener('click', window.openAddPortfolioModal);

registerView('portfolios', renderPortfolios);

console.log('Portfolios UI loaded');
