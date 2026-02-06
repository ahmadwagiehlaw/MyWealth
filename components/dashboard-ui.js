// ==========================================
// Dashboard UI - Executive Summary
// ==========================================

import { registerView } from '../core/router.js';
import { getState } from '../core/state.js';
import { getPortfolios, getTotalMarketValue, getTotalInvestedCapital, getPortfolioDistribution } from '../modules/portfolios.js';
import { getProfits, getTotalNetProfits, getTotalPartnerShare, getMyTotalShare, getUndistributedPartnerShare, getAverageROCE, compareToBankBenchmark } from '../modules/profits.js';
import { formatCurrency, formatCompact, formatPercent } from '../utils/formatters.js';
import { showLoading, hideLoading, showToast } from '../utils/ui-helpers.js';

let distributionChart = null;

/**
 * Render the dashboard view
 */
export async function renderDashboard() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    showLoading();

    try {
        // Load data
        await Promise.all([getPortfolios(), getProfits()]);

        const { portfolios, profits, settings } = getState();

        // Calculate stats
        const totalMarketValue = getTotalMarketValue();
        const totalInvested = getTotalInvestedCapital();
        const totalNetProfits = getTotalNetProfits();
        const partnerShare = getTotalPartnerShare();
        const myShare = getMyTotalShare();
        const undistributed = getUndistributedPartnerShare();
        const avgROCE = getAverageROCE();

        // Beat the Bank comparison
        const months = profits.length > 0 ? getMonthsSpan(profits) : 1;
        const bankComparison = compareToBankBenchmark(totalInvested, months);

        container.innerHTML = `
            ${renderHeroCard(myShare, undistributed)}
            ${renderStatCards(totalMarketValue, totalInvested, partnerShare)}
            ${renderBeatBankGauge(bankComparison, settings.bankBenchmark)}
            ${renderDistributionChart(portfolios)}
            ${renderQuickActions()}
        `;

        // Initialize chart
        initDistributionChart();

    } catch (error) {
        console.error('❌ Dashboard Error:', error);
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--red); margin-bottom: 1rem;"></i>
                <p>حدث خطأ في تحميل البيانات</p>
                <button class="btn btn-primary" onclick="location.reload()" style="margin-top: 1rem;">إعادة المحاولة</button>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// ==========================================
// Component Renderers
// ==========================================

function renderHeroCard(myShare, undistributed) {
    return `
        <div class="glass-card hero-card" style="
            background: linear-gradient(135deg, rgba(255,215,0,0.1), rgba(245,158,11,0.05));
            border: 1px solid rgba(255,215,0,0.2);
            text-align: center;
            padding: var(--space-xl);
            margin-bottom: var(--space-lg);
        ">
            <div style="font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-sm);">
                <i class="fa-solid fa-sack-dollar"></i>
                إجمالي أرباحي القابلة للسحب
            </div>
            <div style="font-size: var(--font-size-3xl); font-weight: 800; color: var(--gold); margin-bottom: var(--space-sm);">
                ${formatCurrency(myShare)}
            </div>
            ${undistributed > 0 ? `
                <div style="font-size: var(--font-size-xs); color: var(--orange);">
                    <i class="fa-solid fa-clock"></i>
                    ${formatCurrency(undistributed)} في انتظار التوزيع للشريك
                </div>
            ` : ''}
        </div>
    `;
}

function renderStatCards(marketValue, invested, partnerShare) {
    const unrealized = marketValue - invested;
    const unrealizedPercent = invested > 0 ? (unrealized / invested * 100) : 0;

    return `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg);">
            <!-- Market Value -->
            <div class="glass-card" style="text-align: center; padding: var(--space-lg);">
                <div style="
                    width: 48px; height: 48px;
                    background: var(--blue-bg);
                    color: var(--blue);
                    border-radius: var(--radius-full);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto var(--space-sm);
                    font-size: 1.25rem;
                ">
                    <i class="fa-solid fa-chart-pie"></i>
                </div>
                <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--text-primary);">
                    ${formatCompact(marketValue)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    القيمة السوقية
                </div>
            </div>
            
            <!-- Unrealized P&L -->
            <div class="glass-card" style="text-align: center; padding: var(--space-lg);">
                <div style="
                    width: 48px; height: 48px;
                    background: ${unrealized >= 0 ? 'var(--green-bg)' : 'var(--red-bg)'};
                    color: ${unrealized >= 0 ? 'var(--green)' : 'var(--red)'};
                    border-radius: var(--radius-full);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto var(--space-sm);
                    font-size: 1.25rem;
                ">
                    <i class="fa-solid fa-${unrealized >= 0 ? 'arrow-trend-up' : 'arrow-trend-down'}"></i>
                </div>
                <div style="font-size: var(--font-size-xl); font-weight: 700; color: ${unrealized >= 0 ? 'var(--green)' : 'var(--red)'};">
                    ${formatPercent(unrealizedPercent)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    غير محقق
                </div>
            </div>
            
            <!-- Partner Share -->
            <div class="glass-card" style="text-align: center; padding: var(--space-lg);">
                <div style="
                    width: 48px; height: 48px;
                    background: var(--purple-bg);
                    color: var(--purple);
                    border-radius: var(--radius-full);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto var(--space-sm);
                    font-size: 1.25rem;
                ">
                    <i class="fa-solid fa-handshake"></i>
                </div>
                <div style="font-size: var(--font-size-xl); font-weight: 700; color: var(--purple);">
                    ${formatCompact(partnerShare)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    نصيب الشريك
                </div>
            </div>
        </div>
    `;
}

function renderBeatBankGauge(comparison, bankRate) {
    const { myProfit, bankProfit, beatBank, percentageBetter } = comparison;
    const gaugePercent = Math.min(100, Math.max(0, (myProfit / (bankProfit || 1)) * 50));

    return `
        <div class="glass-card" style="margin-bottom: var(--space-lg); padding: var(--space-lg);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-md);">
                <div style="font-size: var(--font-size-md); font-weight: 600;">
                    <i class="fa-solid fa-trophy" style="color: ${beatBank ? 'var(--gold)' : 'var(--text-muted)'}; margin-left: var(--space-sm);"></i>
                    Beat the Bank
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    معيار البنك: ${bankRate}% شهرياً
                </div>
            </div>
            
            <!-- Gauge Bar -->
            <div style="
                height: 12px;
                background: var(--bg-card);
                border-radius: 6px;
                overflow: hidden;
                position: relative;
                margin-bottom: var(--space-md);
            ">
                <!-- Bank benchmark line at 50% -->
                <div style="
                    position: absolute;
                    left: 50%;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: var(--text-muted);
                    z-index: 1;
                "></div>
                
                <!-- Progress bar -->
                <div style="
                    height: 100%;
                    width: ${gaugePercent}%;
                    background: ${beatBank
            ? 'linear-gradient(90deg, var(--green), var(--gold))'
            : 'linear-gradient(90deg, var(--red), var(--orange))'};
                    border-radius: 6px;
                    transition: width 0.5s ease;
                    ${beatBank ? 'box-shadow: 0 0 10px var(--gold-glow);' : ''}
                "></div>
            </div>
            
            <!-- Labels -->
            <div style="display: flex; justify-content: space-between; font-size: var(--font-size-xs);">
                <div>
                    <span style="color: var(--text-muted);">أنت:</span>
                    <span style="color: ${beatBank ? 'var(--green)' : 'var(--red)'}; font-weight: 600;">
                        ${formatCurrency(myProfit)}
                    </span>
                </div>
                <div>
                    <span style="color: var(--text-muted);">البنك:</span>
                    <span style="color: var(--text-secondary); font-weight: 600;">
                        ${formatCurrency(bankProfit)}
                    </span>
                </div>
            </div>
            
            ${beatBank ? `
                <div style="
                    margin-top: var(--space-md);
                    padding: var(--space-sm) var(--space-md);
                    background: rgba(255,215,0,0.1);
                    border-radius: var(--radius-sm);
                    text-align: center;
                    font-size: var(--font-size-sm);
                    color: var(--gold);
                ">
                    🎉 أداؤك أفضل من البنك بنسبة <strong>${percentageBetter.toFixed(0)}%</strong>!
                </div>
            ` : ''}
        </div>
    `;
}

function renderDistributionChart(portfolios) {
    if (portfolios.length === 0) {
        return `
            <div class="glass-card" style="text-align: center; padding: var(--space-xl); margin-bottom: var(--space-lg);">
                <i class="fa-solid fa-vault" style="font-size: 3rem; color: var(--text-muted); margin-bottom: var(--space-md);"></i>
                <p style="color: var(--text-secondary);">لم تقم بإضافة أي محفظة بعد</p>
                <button class="btn btn-primary" style="margin-top: var(--space-md);" onclick="navigateToPortfolios()">
                    <i class="fa-solid fa-plus"></i> إضافة محفظة
                </button>
            </div>
        `;
    }

    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-md);">
                <i class="fa-solid fa-chart-pie" style="color: var(--gold); margin-left: var(--space-sm);"></i>
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
        <div class="glass-card" style="padding: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-md);">
                <i class="fa-solid fa-bolt" style="color: var(--gold); margin-left: var(--space-sm);"></i>
                إجراءات سريعة
            </div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md);">
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

function initDistributionChart() {
    const canvas = document.getElementById('distributionChart');
    if (!canvas) return;

    const distribution = getPortfolioDistribution();
    if (distribution.length === 0) return;

    const ctx = canvas.getContext('2d');

    // Destroy existing chart
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
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: 'rgba(255,255,255,0.7)',
                        font: { size: 11 },
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    callbacks: {
                        label: (ctx) => {
                            const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const percent = ((ctx.raw / total) * 100).toFixed(1);
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

    const dates = profits.map(p => {
        const d = p.date?.toDate ? p.date.toDate() : new Date(p.date);
        return d.getTime();
    });

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
    // Import and use the modal from profits-ui
    const profitsUI = await import('./profits-ui.js');
    profitsUI.openAddProfitModalFromDashboard();
};

// Register view
registerView('dashboard', renderDashboard);

console.log('📊 Dashboard UI loaded');
