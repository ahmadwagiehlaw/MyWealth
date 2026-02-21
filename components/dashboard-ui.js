// ==========================================
// Dashboard UI - Executive Summary (V5 Premium)
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

        // Generate smart insight
        const smartInsight = generateSmartInsight(totalMarketValue, totalInvested, remainingAfterPaid, profits, portfolios, bankComparison);

        container.innerHTML = `
            ${renderSmartInsight(smartInsight)}
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
// Smart Insights
// ==========================================

function generateSmartInsight(marketValue, invested, remaining, profits, portfolios, bank) {
    if (portfolios.length === 0) return { icon: 'fa-rocket', text: 'ابدأ رحلتك المالية — أضف محفظتك الأولى الآن!', color: 'var(--blue)' };

    const unrealized = marketValue - invested;
    const unrealizedPct = invested > 0 ? (unrealized / invested * 100) : 0;

    if (bank.beatBank && bank.percentageBetter > 50) {
        return { icon: 'fa-crown', text: `أداء استثنائي! تفوقت على البنك بـ ${bank.percentageBetter.toFixed(0)}%`, color: 'var(--gold)' };
    }
    if (unrealizedPct > 10) {
        return { icon: 'fa-chart-line', text: `محفظتك تنمو — ربح غير محقق ${unrealizedPct.toFixed(1)}% فوق رأس المال`, color: 'var(--green)' };
    }
    if (unrealizedPct < -5) {
        return { icon: 'fa-shield-halved', text: `تراجع مؤقت ${unrealizedPct.toFixed(1)}% — ركز على التنويع والصبر`, color: 'var(--orange)' };
    }
    if (remaining > 0) {
        return { icon: 'fa-sack-dollar', text: `لديك ${formatCurrency(remaining)} أرباح صافية متاحة`, color: 'var(--green)' };
    }
    return { icon: 'fa-gem', text: 'تابع استثماراتك بانتظام لتحقيق أفضل النتائج', color: 'var(--purple)' };
}

function renderSmartInsight(insight) {
    return `
        <div class="glass-card dashboard-insight" style="
            display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem;
            margin-bottom: 0.85rem;
            border: 1px solid color-mix(in srgb, ${insight.color} 30%, transparent);
            background: linear-gradient(135deg, color-mix(in srgb, ${insight.color} 12%, transparent), transparent);
        ">
            <div style="
                width: 36px; height: 36px; border-radius: 50%;
                background: color-mix(in srgb, ${insight.color} 20%, transparent);
                color: ${insight.color};
                display: flex; align-items: center; justify-content: center;
                font-size: 1rem; flex-shrink: 0;
            "><i class="fa-solid ${insight.icon}"></i></div>
            <span style="font-size: var(--font-size-sm); font-weight: 600; color: var(--text-secondary); line-height: 1.4;">${insight.text}</span>
        </div>
    `;
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
            <div class="dashboard-hero-value num">${formatCurrency(remainingAfterPaid)}</div>
            <div class="dashboard-hero-meta">
                <span><i class="fa-solid fa-clock"></i> متبقي للشريك <span class="num">${formatCurrency(pendingToPartner)}</span></span>
                <span><i class="fa-solid fa-circle-check"></i> المدفوع فعليا <span class="num">${formatCurrency(paidToPartner)}</span></span>
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
                <div class="dashboard-stat-value num">${formatCompact(marketValue)}</div>
                <div class="dashboard-stat-label">القيمة السوقية</div>
            </div>

            <div class="glass-card dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background: ${unrealized >= 0 ? 'var(--green-bg)' : 'var(--red-bg)'}; color: ${unrealized >= 0 ? 'var(--green)' : 'var(--red)'};">
                    <i class="fa-solid fa-${unrealized >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'}"></i>
                </div>
                <div class="dashboard-stat-value num" style="color:${unrealized >= 0 ? 'var(--green)' : 'var(--red)'};">${formatPercent(unrealizedPercent)}</div>
                <div class="dashboard-stat-label">غير محقق</div>
            </div>

            <div class="glass-card dashboard-stat-card">
                <div class="dashboard-stat-icon" style="background: var(--purple-bg); color: var(--purple);">
                    <i class="fa-solid fa-handshake"></i>
                </div>
                <div class="dashboard-stat-value num" style="color:var(--purple);">${formatCompact(partnerShare)}</div>
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
        <div class="glass-card dashboard-beat-bank" style="border: 1px solid ${beatBank ? 'rgba(245,179,1,0.25)' : 'var(--border-color)'};">
            <div class="dashboard-beat-bank-head">
                <div style="display:flex; align-items:center; gap: 0.5rem;">
                    <div style="
                        width: 32px; height: 32px; border-radius: 50%;
                        background: ${beatBank ? 'rgba(245,179,1,0.2)' : 'rgba(255,255,255,0.05)'};
                        display: flex; align-items: center; justify-content: center;
                    ">
                        <i class="fa-solid fa-trophy" style="color:${beatBank ? 'var(--gold)' : 'var(--text-muted)'}; font-size: 0.9rem;"></i>
                    </div>
                    <div>
                        <div style="font-size: var(--font-size-md); font-weight: 700;">Beat the Bank</div>
                        <div style="font-size: var(--font-size-xs); color: var(--text-muted);">معيار البنك: <span class="num">${bankRate}%</span> شهريا</div>
                    </div>
                </div>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: 0.65rem;">
                رأس المال المرجعي: <span class="num">${formatCurrency(capitalBase)}</span> خلال <span class="num">${months}</span> شهر
            </div>

            <div style="height: 12px; background: rgba(255,255,255,0.06); border-radius: 8px; overflow: hidden; position: relative; margin-bottom: 0.7rem; border: 1px solid var(--border-color);">
                <div style="position:absolute; left:50%; top:0; bottom:0; width:2px; background: var(--text-muted); opacity:0.5; z-index:1;"></div>
                <div style="height:100%; width:${gaugePercent}%; background:${beatBank ? 'linear-gradient(90deg, var(--green), var(--gold))' : 'linear-gradient(90deg, var(--red), var(--orange))'}; border-radius:8px; transition: width 0.8s ease; box-shadow: ${beatBank ? '0 0 10px var(--green-glow)' : '0 0 10px var(--red-glow)'};"></div>
            </div>

            <div style="display:flex; justify-content:space-between; font-size: var(--font-size-xs);">
                <div><span style="color: var(--text-muted);">أنت:</span> <span class="num" style="color:${beatBank ? 'var(--green)' : 'var(--red)'}; font-weight:700;">${formatCurrency(myProfit)}</span></div>
                <div><span style="color: var(--text-muted);">البنك:</span> <span class="num" style="font-weight:700;">${formatCurrency(bankProfit)}</span></div>
            </div>

            ${beatBank ? `
                <div class="dashboard-beat-bank-win">
                    <i class="fa-solid fa-fire" style="margin-left: 0.3rem;"></i>
                    أداؤك أفضل من البنك بنسبة <span class="num">${percentageBetter.toFixed(0)}%</span>
                </div>
            ` : ''}
        </div>
    `;
}

function renderDistributionChart(portfolios) {
    if (portfolios.length === 0) {
        return `
            <div class="glass-card" style="text-align:center; padding:2rem; margin-bottom: var(--space-lg);">
                <div style="width:60px; height:60px; margin: 0 auto 0.8rem; border-radius:50%; background: var(--blue-bg); display:flex; align-items:center; justify-content:center;">
                    <i class="fa-solid fa-vault" style="font-size:1.5rem; color:var(--blue);"></i>
                </div>
                <p style="color: var(--text-secondary); font-weight: 600; margin-bottom: 0.5rem;">لم تقم بإضافة أي محفظة بعد</p>
                <p style="color: var(--text-muted); font-size: var(--font-size-xs); margin-bottom: 0.8rem;">أضف محفظتك الأولى لبدء التتبع</p>
                <button class="btn btn-primary" onclick="navigateToPortfolios()">
                    <i class="fa-solid fa-plus"></i> إضافة محفظة
                </button>
            </div>
        `;
    }

    return `
        <div class="glass-card" style="padding: var(--space-md); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 700; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-chart-pie" style="color: var(--gold);"></i>
                توزيع الثروة
            </div>
            <div style="height: 200px; position: relative;">
                <canvas id="distributionChart"></canvas>
            </div>
        </div>
    `;
}

function renderQuickActions() {
    return `
        <div class="glass-card" style="padding: var(--space-md);">
            <div style="font-size: var(--font-size-md); font-weight: 700; margin-bottom: 0.65rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-bolt" style="color: var(--gold);"></i>
                إجراءات سريعة
            </div>
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem;">
                <button class="btn" style="
                    background: var(--green-bg); color: var(--green); justify-content: center;
                    border: 1px solid color-mix(in srgb, var(--green) 25%, transparent);
                    padding: 0.75rem;
                " onclick="openAddProfitModal()">
                    <i class="fa-solid fa-plus"></i>
                    تسجيل ربح
                </button>
                <button class="btn" style="
                    background: var(--blue-bg); color: var(--blue); justify-content: center;
                    border: 1px solid color-mix(in srgb, var(--blue) 25%, transparent);
                    padding: 0.75rem;
                " onclick="navigateToCalculator()">
                    <i class="fa-solid fa-calculator"></i>
                    ماذا لو؟
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// Chart Initialization (Premium Glowing Charts)
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
    const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    const tickColor = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)';

    // Create gradient fills for glowing effect
    const greenGrad = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.offsetHeight || 200);
    greenGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
    greenGrad.addColorStop(0.5, 'rgba(16, 185, 129, 0.1)');
    greenGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

    totalEvolutionChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: points.map(p => p.label),
            datasets: [{
                label: 'إجمالي القيمة (ج.م)',
                data: points.map(p => p.value),
                yAxisID: 'y',
                borderColor: '#10b981',
                backgroundColor: greenGrad,
                fill: true,
                tension: 0.4,
                borderWidth: 2.5,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#10b981',
                pointBorderColor: '#10b981',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#10b981',
                pointHoverBorderWidth: 3,
            }, {
                label: 'التغير %',
                data: points.map(p => p.changePct),
                yAxisID: 'y1',
                borderColor: '#f5b301',
                backgroundColor: 'transparent',
                tension: 0.4,
                borderDash: [6, 4],
                borderWidth: 2,
                pointRadius: 3,
                pointHoverRadius: 6,
                pointBackgroundColor: '#f5b301',
                pointBorderColor: '#f5b301',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#f5b301',
                pointHoverBorderWidth: 3,
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
                        usePointStyle: true,
                        font: { family: "'Cairo', sans-serif", size: 11 }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 11, 20, 0.95)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleFont: { family: "'Cairo', sans-serif", size: 12, weight: '600' },
                    bodyFont: { family: "'Outfit', sans-serif", size: 12 },
                    padding: 12,
                    cornerRadius: 12,
                    displayColors: true,
                    boxPadding: 4,
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
                    grid: { color: gridColor, lineWidth: 1 },
                    ticks: {
                        color: tickColor,
                        font: { family: "'Outfit', sans-serif", size: 10 },
                        callback: (value) => formatCompact(value)
                    }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: {
                        color: '#f5b301',
                        font: { family: "'Outfit', sans-serif", size: 10 },
                        callback: (value) => `${value}%`
                    }
                },
                x: {
                    grid: { display: false },
                    ticks: {
                        color: tickColor,
                        font: { family: "'Cairo', sans-serif", size: 10 },
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

    const colors = ['#10b981', '#3b82f6', '#8b5cf6', '#f5b301', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

    distributionChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: distribution.map(d => d.name),
            datasets: [{
                data: distribution.map(d => d.value),
                backgroundColor: colors.slice(0, distribution.length),
                borderWidth: 0,
                hoverOffset: 10,
                borderRadius: 4,
                spacing: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: 'rgba(255,255,255,0.7)',
                        font: { family: "'Cairo', sans-serif", size: 11 },
                        padding: 14,
                        usePointStyle: true,
                        pointStyleWidth: 10
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(5, 11, 20, 0.95)',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    titleFont: { family: "'Cairo', sans-serif", size: 12, weight: '600' },
                    bodyFont: { family: "'Outfit', sans-serif", size: 12 },
                    padding: 12,
                    cornerRadius: 12,
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

console.log('Dashboard UI loaded (V5 Premium)');
