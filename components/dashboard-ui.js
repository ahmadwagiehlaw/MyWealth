// ==========================================
// Dashboard UI - Executive Summary
// ==========================================

import { registerView } from '../core/router.js';
import { getState } from '../core/state.js';
import {
    getPortfolios,
    getPortfolioHistory,
    getTotalMarketValue,
    getTotalInvestedCapital,
    getPortfolioDistribution,
    getTotalPortfolioEvolutionSeries
} from '../modules/portfolios.js';
import {
    getProfits,
    getTotalPartnerShare,
    getUndistributedPartnerShare,
    getTotalDistributedToPartner,
    getRemainingProfitsAfterDistribution,
    compareToBankBenchmark
} from '../modules/profits.js';
import { formatCurrency, formatCompact, formatPercent } from '../utils/formatters.js';
import { showLoading, hideLoading } from '../utils/ui-helpers.js';

let distributionChart = null;
let totalEvolutionChart = null;
let activeEvolutionRange = 'month';

/**
 * Render the dashboard view
 */
export async function renderDashboard() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    showLoading();

    try {
        await Promise.all([getPortfolios(), getPortfolioHistory(), getProfits()]);

        const { portfolios, profits, settings } = getState();

        const totalMarketValue = getTotalMarketValue();
        const totalInvested = getTotalInvestedCapital();
        const expectedPartnerShare = getTotalPartnerShare();
        const paidToPartner = getTotalDistributedToPartner();
        const pendingToPartner = getUndistributedPartnerShare();
        const remainingAfterPaid = getRemainingProfitsAfterDistribution();

        const months = profits.length > 0 ? getMonthsSpan(profits) : 1;
        const bankComparison = compareToBankBenchmark(months);

        container.innerHTML = `
            ${renderHeroCard(remainingAfterPaid, pendingToPartner, paidToPartner)}
            ${renderStatCards(totalMarketValue, totalInvested, expectedPartnerShare)}
            ${renderEvolutionChart()}
            ${renderBeatBankGauge(bankComparison, settings.bankBenchmark, months)}
            ${renderDistributionChart(portfolios)}
            ${renderQuickActions()}
        `;

        bindEvolutionFilters();
        initTotalEvolutionChart();
        initDistributionChart();
    } catch (error) {
        console.error('Dashboard Error:', error);
        container.innerHTML = `
            <div class="glass-card" style="text-align:center; padding:2.5rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size:2rem; color:var(--red); margin-bottom:0.75rem;"></i>
                <p>حدث خطأ في تحميل البيانات</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top:0.75rem;">إعادة المحاولة</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// ==========================================
// Component Renderers
// ==========================================

function renderHeroCard(remainingAfterPaid, pendingToPartner, paidToPartner) {
    return `
        <div class="glass-card hero-card dashboard-hero">
            <div class="dashboard-hero-label">
                <i class="fa-solid fa-sack-dollar"></i>
                الأرباح المتبقية بعد التوزيع الفعلي
            </div>
            <div class="dashboard-hero-value">${formatCurrency(remainingAfterPaid)}</div>
            <div class="dashboard-hero-meta">
                <span><i class="fa-solid fa-clock"></i> متبقي للشريك ${formatCurrency(pendingToPartner)}</span>
                <span><i class="fa-solid fa-circle-check"></i> المدفوع فعليا ${formatCurrency(paidToPartner)}</span>
            </div>
        </div>
    `;
}

function renderStatCards(marketValue, invested, partnerShare) {
    const unrealized = marketValue - invested;
    const unrealizedPercent = invested > 0 ? (unrealized / invested * 100) : 0;

    return `
        <div class="dashboard-stats-row dashboard-stats-row-tight">
            <div class="glass-card dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background: var(--blue-bg); color: var(--blue);">
                    <i class="fa-solid fa-chart-pie"></i>
                </div>
                <div class="dashboard-stat-value">${formatCompact(marketValue)}</div>
                <div class="dashboard-stat-label">القيمة السوقية</div>
            </div>

            <div class="glass-card dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background: ${unrealized >= 0 ? 'var(--green-bg)' : 'var(--red-bg)'}; color: ${unrealized >= 0 ? 'var(--green)' : 'var(--red)'};">
                    <i class="fa-solid fa-${unrealized >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'}"></i>
                </div>
                <div class="dashboard-stat-value" style="color:${unrealized >= 0 ? 'var(--green)' : 'var(--red)'};">${formatPercent(unrealizedPercent)}</div>
                <div class="dashboard-stat-label">غير محقق</div>
            </div>

            <div class="glass-card dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background: var(--purple-bg); color: var(--purple);">
                    <i class="fa-solid fa-handshake"></i>
                </div>
                <div class="dashboard-stat-value" style="color:var(--purple);">${formatCompact(partnerShare)}</div>
                <div class="dashboard-stat-label">نصيب الشريك</div>
            </div>
        </div>
    `;
}

function renderEvolutionChart() {
    return `
        <div class="glass-card dashboard-evolution-card">
            <div class="dashboard-evolution-head">
                <div class="dashboard-evolution-title">
                    <i class="fa-solid fa-chart-line"></i>
                    تطور إجمالي المحافظ
                </div>
                <div class="profits-chart-filters">
                    <button class="profits-chart-filter ${activeEvolutionRange === 'week' ? 'active' : ''}" data-evo-range="week">أسبوعي</button>
                    <button class="profits-chart-filter ${activeEvolutionRange === 'month' ? 'active' : ''}" data-evo-range="month">شهري</button>
                    <button class="profits-chart-filter ${activeEvolutionRange === 'year' ? 'active' : ''}" data-evo-range="year">سنوي</button>
                </div>
            </div>
            <div class="dashboard-evolution-sub">الخط الأخضر: قيمة المحافظ | الخط الذهبي: نسبة التغير</div>
            <div class="dashboard-evolution-body">
                <canvas id="totalEvolutionChart"></canvas>
                <div id="total-evolution-empty" class="profits-chart-empty hidden">لا توجد بيانات كافية لعرض الشارت</div>
            </div>
        </div>
    `;
}

function renderBeatBankGauge(comparison, bankRate, months) {
    const { myProfit, bankProfit, beatBank, percentageBetter, capitalBase } = comparison;
    const gaugePercent = Math.min(100, Math.max(0, (myProfit / (bankProfit || 1)) * 50));

    return `
        <div class="glass-card dashboard-beat-bank">
            <div class="dashboard-beat-bank-head">
                <div style="font-size: var(--font-size-md); font-weight: 600;">
                    <i class="fa-solid fa-trophy" style="color:${beatBank ? 'var(--gold)' : 'var(--text-muted)'}; margin-left: var(--space-sm);"></i>
                    Beat the Bank
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">معيار البنك: ${bankRate}% شهريا</div>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: 0.55rem;">
                رأس المال المرجعي: ${formatCurrency(capitalBase)} خلال ${months} شهر
            </div>

            <div style="height: 10px; background: var(--bg-card); border-radius: 6px; overflow: hidden; position: relative; margin-bottom: 0.6rem;">
                <div style="position:absolute; left:50%; top:0; bottom:0; width:2px; background: var(--text-muted);"></div>
                <div style="height:100%; width:${gaugePercent}%; background:${beatBank ? 'linear-gradient(90deg, var(--green), var(--gold))' : 'linear-gradient(90deg, var(--red), var(--orange))'}; border-radius:6px;"></div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size: var(--font-size-xs);">
                <div><span style="color: var(--text-muted);">أنت:</span> <span style="color:${beatBank ? 'var(--green)' : 'var(--red)'}; font-weight:700;">${formatCurrency(myProfit)}</span></div>
                <div><span style="color: var(--text-muted);">البنك:</span> <span style="font-weight:700;">${formatCurrency(bankProfit)}</span></div>
            </div>

            ${beatBank ? `
                <div class="dashboard-beat-bank-win">أداؤك أفضل من البنك بنسبة ${percentageBetter.toFixed(0)}%</div>
            ` : ''}
        </div>
    `;
}

function renderDistributionChart(portfolios) {
    if (portfolios.length === 0) {
        return `
            <div class="glass-card" style="text-align:center; padding:1.5rem; margin-bottom: var(--space-lg);">
                <i class="fa-solid fa-vault" style="font-size:2rem; color:var(--text-muted); margin-bottom:0.6rem;"></i>
                <p style="color: var(--text-secondary);">لم تقم بإضافة أي محفظة بعد</p>
                <button class="btn btn-primary" style="margin-top:0.6rem;" onclick="navigateToPortfolios()">
                    <i class="fa-solid fa-plus"></i> إضافة محفظة
                </button>
            </div>
        `;
    }

    return `
        <div class="glass-card" style="padding: var(--space-md); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 700; margin-bottom: 0.5rem;">
                <i class="fa-solid fa-chart-pie" style="color: var(--gold); margin-left: var(--space-sm);"></i>
                توزيع الثروة
            </div>
            <div style="height: 190px; position: relative;">
                <canvas id="distributionChart"></canvas>
            </div>
        </div>
    `;
}

function renderQuickActions() {
    return `
        <div class="glass-card" style="padding: var(--space-md);">
            <div style="font-size: var(--font-size-md); font-weight: 700; margin-bottom: 0.55rem;">
                <i class="fa-solid fa-bolt" style="color: var(--gold); margin-left: var(--space-sm);"></i>
                إجراءات سريعة
            </div>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                <button class="btn" style="background: var(--green-bg); color: var(--green); justify-content: center;" onclick="openAddProfitModal()">
                    <i class="fa-solid fa-plus"></i>
                    تسجيل ربح
                </button>
                <button class="btn" style="background: var(--blue-bg); color: var(--blue); justify-content: center;" onclick="navigateToCalculator()">
                    <i class="fa-solid fa-calculator"></i>
                    ماذا لو؟
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// Chart Initialization
// ==========================================

function bindEvolutionFilters() {
    const buttons = document.querySelectorAll('[data-evo-range]');
    buttons.forEach(button => {
        button.addEventListener('click', () => {
            const nextRange = button.dataset.evoRange;
            if (!nextRange || nextRange === activeEvolutionRange) return;

            activeEvolutionRange = nextRange;
            buttons.forEach(item => item.classList.toggle('active', item.dataset.evoRange === activeEvolutionRange));
            initTotalEvolutionChart();
        });
    });
}

function initTotalEvolutionChart() {
    const canvas = document.getElementById('totalEvolutionChart');
    if (!canvas) return;

    const empty = document.getElementById('total-evolution-empty');
    const points = getTotalPortfolioEvolutionSeries(activeEvolutionRange);

    if (totalEvolutionChart) totalEvolutionChart.destroy();

    if (points.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    const ctx = canvas.getContext('2d');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    const tickColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

    totalEvolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map(p => p.label),
            datasets: [{
                label: 'إجمالي القيمة (ج.م)',
                data: points.map(p => p.value),
                yAxisID: 'y',
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
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
                backgroundColor: 'rgba(245, 158, 11, 0.18)',
                tension: 0.35,
                borderDash: [5, 4],
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

function initDistributionChart() {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;

    const distribution = getPortfolioDistribution();
    if (distribution.length === 0) return;

    const ctx = canvas.getContext('2d');

    if (distributionChart) distributionChart.destroy();

    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

    distributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: distribution.map(d => d.name),
            datasets: [{
                data: distribution.map(d => d.value),
                backgroundColor: colors.slice(0, distribution.length),
                borderWidth: 0,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255,255,255,0.7)',
                        font: { size: 11 },
                        padding: 12
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : '0.0';
                            return ` ${formatCurrency(ctx.raw)} (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}

// ==========================================
// Helper Functions
// ==========================================

function getMonthsSpan(profits) {
    if (profits.length === 0) return 1;

    const dates = profits
        .map(item => item.date?.toDate ? item.date.toDate() : new Date(item.date))
        .filter(d => !Number.isNaN(d.getTime()))
        .map(d => d.getTime());

    if (dates.length === 0) return 1;

    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    const months = (maxDate.getFullYear() - minDate.getFullYear()) * 12
        + (maxDate.getMonth() - minDate.getMonth()) + 1;

    return Math.max(1, months);
}

// Global navigation helpers
window.navigateToPortfolios = () => {
    import('../core/router.js').then(m => m.navigate('portfolios'));
};

window.navigateToCalculator = () => {
    import('../core/router.js').then(m => m.navigate('calculator'));
};

window.openAddProfitModal = async () => {
    const profitsUI = await import('./profits-ui.js');
    profitsUI.openAddProfitModalFromDashboard();
};

registerView('dashboard', renderDashboard);

console.log('Dashboard UI loaded');
