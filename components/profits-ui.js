// ==========================================
// Profits UI - Alpha Dashboard
// ==========================================

import { registerView } from '../core/router.js';
import { getState } from '../core/state.js';
import { getPortfolios } from '../modules/portfolios.js';
import { getProfits, createProfit, deleteProfit, markAsDistributed, getTotalNetProfits, getMyTotalShare, getUndistributedPartnerShare, getAverageROCE, getProfitsByMonth } from '../modules/profits.js';
import { formatCurrency, formatPercent, formatDate } from '../utils/formatters.js';
import { showLoading, hideLoading, showToast, openModal, closeModal, confirm } from '../utils/ui-helpers.js';

let profitsChart = null;

/**
 * Render the profits view (Alpha Dashboard)
 */
export async function renderProfits() {
    const container = document.getElementById('profits-container');
    if (!container) return;

    showLoading();

    try {
        await Promise.all([getPortfolios(), getProfits()]);

        const { profits, portfolios } = getState();

        // Stats
        const totalNet = getTotalNetProfits();
        const myShare = getMyTotalShare();
        const undistributed = getUndistributedPartnerShare();
        const avgROCE = getAverageROCE();

        container.innerHTML = `
            ${renderStatsCards(totalNet, myShare, undistributed, avgROCE)}
            ${renderProfitsChart()}
            ${renderProfitsTable(profits, portfolios)}
        `;

        // Init chart
        setTimeout(() => initProfitsChart(), 100);

    } catch (error) {
        console.error('❌ Profits Error:', error);
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--red); margin-bottom: 1rem;"></i>
                <p>حدث خطأ في تحميل الأرباح</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// ==========================================
// Component Renderers
// ==========================================

function renderStatsCards(totalNet, myShare, undistributed, avgROCE) {
    return `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-md); margin-bottom: var(--space-lg);">
            <!-- Total Net Profits -->
            <div class="glass-card" style="padding: var(--space-lg); text-align: center;">
                <div style="
                    width: 48px; height: 48px;
                    background: var(--green-bg);
                    color: var(--green);
                    border-radius: var(--radius-full);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto var(--space-sm);
                    font-size: 1.25rem;
                ">
                    <i class="fa-solid fa-sack-dollar"></i>
                </div>
                <div style="font-size: var(--font-size-xl); font-weight: 800; color: var(--green);">
                    ${formatCurrency(totalNet)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    صافي الأرباح
                </div>
            </div>
            
            <!-- My Share -->
            <div class="glass-card" style="padding: var(--space-lg); text-align: center;">
                <div style="
                    width: 48px; height: 48px;
                    background: var(--gold-glow);
                    color: var(--gold);
                    border-radius: var(--radius-full);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto var(--space-sm);
                    font-size: 1.25rem;
                ">
                    <i class="fa-solid fa-crown"></i>
                </div>
                <div style="font-size: var(--font-size-xl); font-weight: 800; color: var(--gold);">
                    ${formatCurrency(myShare)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    نصيبي
                </div>
            </div>
            
            <!-- Undistributed -->
            <div class="glass-card" style="padding: var(--space-lg); text-align: center;">
                <div style="
                    width: 48px; height: 48px;
                    background: var(--orange-bg);
                    color: var(--orange);
                    border-radius: var(--radius-full);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto var(--space-sm);
                    font-size: 1.25rem;
                ">
                    <i class="fa-solid fa-clock"></i>
                </div>
                <div style="font-size: var(--font-size-xl); font-weight: 800; color: var(--orange);">
                    ${formatCurrency(undistributed)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    في انتظار التوزيع
                </div>
            </div>
            
            <!-- Average ROCE -->
            <div class="glass-card" style="padding: var(--space-lg); text-align: center;">
                <div style="
                    width: 48px; height: 48px;
                    background: var(--purple-bg);
                    color: var(--purple);
                    border-radius: var(--radius-full);
                    display: flex; align-items: center; justify-content: center;
                    margin: 0 auto var(--space-sm);
                    font-size: 1.25rem;
                ">
                    <i class="fa-solid fa-bullseye"></i>
                </div>
                <div style="font-size: var(--font-size-xl); font-weight: 800; color: var(--purple);">
                    ${formatPercent(avgROCE, false)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    متوسط ROCE
                </div>
            </div>
        </div>
    `;
}

function renderProfitsChart() {
    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-md);">
                <i class="fa-solid fa-chart-column" style="color: var(--gold); margin-left: var(--space-sm);"></i>
                الأرباح الشهرية
            </div>
            <div style="height: 200px;">
                <canvas id="profitsChart"></canvas>
            </div>
        </div>
    `;
}

function renderProfitsTable(profits, portfolios) {
    if (profits.length === 0) {
        return `
            <div class="glass-card" style="text-align: center; padding: var(--space-xl);">
                <i class="fa-solid fa-receipt" style="font-size: 3rem; color: var(--text-muted); margin-bottom: var(--space-md);"></i>
                <p style="color: var(--text-secondary);">لم تسجل أي أرباح بعد</p>
                <button class="btn btn-primary" style="margin-top: var(--space-md);" onclick="openAddProfitModal()">
                    <i class="fa-solid fa-plus"></i> تسجيل ربح
                </button>
            </div>
        `;
    }

    const rows = profits.map(p => {
        const portfolio = portfolios.find(pf => pf.id === p.portfolioId);
        const date = p.date?.toDate ? p.date.toDate() : new Date(p.date);

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: var(--space-md);">
                    <div style="font-weight: 600;">${formatDate(date)}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-muted);">${p.ticker || '-'}</div>
                </td>
                <td style="padding: var(--space-md);">
                    <div style="font-weight: 700; color: var(--green);">+${formatCurrency(p.netProfit, p.currency)}</div>
                    ${p.workingCapital > 0 ? `
                        <div style="font-size: var(--font-size-xs); color: var(--purple);">
                            ROCE: ${formatPercent(p.netProfit / p.workingCapital * 100, false)}
                        </div>
                    ` : ''}
                </td>
                <td style="padding: var(--space-md);">
                    <span style="
                        padding: 4px 8px;
                        background: ${p.distributed ? 'var(--green-bg)' : 'var(--orange-bg)'};
                        color: ${p.distributed ? 'var(--green)' : 'var(--orange)'};
                        border-radius: var(--radius-sm);
                        font-size: var(--font-size-xs);
                    ">
                        ${p.distributed ? 'تم التوزيع' : 'في الانتظار'}
                    </span>
                </td>
                <td style="padding: var(--space-md); text-align: left;">
                    ${!p.distributed ? `
                        <button class="btn-icon" onclick="markProfitDistributed('${p.id}')" title="تم التوزيع">
                            <i class="fa-solid fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn-icon" onclick="deleteProfitRecord('${p.id}')" title="حذف">
                        <i class="fa-solid fa-trash" style="color: var(--red);"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div class="glass-card" style="padding: 0; overflow: hidden;">
            <div style="padding: var(--space-md) var(--space-lg); border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600;">سجل الأرباح</span>
                <button class="btn btn-primary" style="padding: var(--space-xs) var(--space-md);" onclick="openAddProfitModal()">
                    <i class="fa-solid fa-plus"></i>
                </button>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: var(--bg-card);">
                            <th style="padding: var(--space-md); text-align: right; font-size: var(--font-size-sm); color: var(--text-muted);">التاريخ</th>
                            <th style="padding: var(--space-md); text-align: right; font-size: var(--font-size-sm); color: var(--text-muted);">المبلغ</th>
                            <th style="padding: var(--space-md); text-align: right; font-size: var(--font-size-sm); color: var(--text-muted);">الحالة</th>
                            <th style="padding: var(--space-md);"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// ==========================================
// Chart
// ==========================================

function initProfitsChart() {
    const canvas = document.getElementById('profitsChart');
    if (!canvas) return;

    const monthlyData = getProfitsByMonth();
    if (monthlyData.length === 0) return;

    const ctx = canvas.getContext('2d');

    if (profitsChart) profitsChart.destroy();

    profitsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthlyData.map(d => {
                const [y, m] = d.month.split('-');
                return new Date(y, parseInt(m) - 1).toLocaleDateString('ar-EG', { month: 'short' });
            }),
            datasets: [{
                label: 'صافي الربح',
                data: monthlyData.map(d => d.value),
                backgroundColor: '#10b981',
                borderRadius: 6,
                barThickness: 20
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    callbacks: {
                        label: (ctx) => formatCurrency(ctx.raw)
                    }
                }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: 'rgba(255,255,255,0.5)' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: 'rgba(255,255,255,0.5)' }
                }
            }
        }
    });
}

// ==========================================
// Modal & Actions
// ==========================================

window.openAddProfitModal = () => {
    const { portfolios } = getState();

    if (portfolios.length === 0) {
        showToast('أضف محفظة أولاً', 'error');
        return;
    }

    const portfolioOptions = portfolios.map(p =>
        `<option value="${p.id}">${p.name} (${p.currency})</option>`
    ).join('');

    const content = `
        <form id="add-profit-form">
            <div class="form-group">
                <label class="form-label">المحفظة</label>
                <select class="form-select" name="portfolioId" required>
                    ${portfolioOptions}
                </select>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">رمز السهم (اختياري)</label>
                    <input type="text" class="form-input" name="ticker" placeholder="MNHD">
                </div>
                <div class="form-group">
                    <label class="form-label">التاريخ</label>
                    <input type="date" class="form-input" name="date" value="${new Date().toISOString().split('T')[0]}">
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">صافي الربح</label>
                    <input type="number" class="form-input" name="netProfit" placeholder="0" min="0" step="0.01" required>
                </div>
                <div class="form-group">
                    <label class="form-label">رأس المال المستخدم</label>
                    <input type="number" class="form-input" name="workingCapital" placeholder="لحساب ROCE" min="0" step="0.01">
                </div>
            </div>
            
            <div class="form-group">
                <label class="form-label">ملاحظات (اختياري)</label>
                <input type="text" class="form-input" name="description" placeholder="وصف الصفقة">
            </div>
        </form>
    `;

    const footer = `
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="submitAddProfit()">
            <i class="fa-solid fa-plus"></i> تسجيل
        </button>
    `;

    openModal('تسجيل ربح جديد', content, { footer });
};

window.submitAddProfit = async () => {
    const form = document.getElementById('add-profit-form');
    if (!form) return;

    const formData = new FormData(form);
    const portfolio = getState().portfolios.find(p => p.id === formData.get('portfolioId'));

    const data = {
        portfolioId: formData.get('portfolioId'),
        ticker: formData.get('ticker'),
        date: formData.get('date'),
        netProfit: formData.get('netProfit'),
        grossProfit: formData.get('netProfit'), // Same for now
        fees: 0,
        workingCapital: formData.get('workingCapital'),
        description: formData.get('description'),
        currency: portfolio?.currency || 'EGP'
    };

    if (!data.netProfit || parseFloat(data.netProfit) <= 0) {
        showToast('الرجاء إدخال صافي الربح', 'error');
        return;
    }

    try {
        showLoading();
        await createProfit(data);
        closeModal();
        showToast('تم تسجيل الربح بنجاح', 'success');
        renderProfits();
    } catch (error) {
        showToast('فشل في تسجيل الربح', 'error');
    } finally {
        hideLoading();
    }
};

window.markProfitDistributed = async (id) => {
    const confirmed = await confirm('هل تم توزيع نصيب الشريك؟');
    if (!confirmed) return;

    try {
        showLoading();
        await markAsDistributed(id);
        showToast('تم التحديث', 'success');
        renderProfits();
    } catch (error) {
        showToast('فشل في التحديث', 'error');
    } finally {
        hideLoading();
    }
};

window.deleteProfitRecord = async (id) => {
    const confirmed = await confirm('هل أنت متأكد من حذف هذا السجل؟');
    if (!confirmed) return;

    try {
        showLoading();
        await deleteProfit(id);
        showToast('تم الحذف', 'success');
        renderProfits();
    } catch (error) {
        showToast('فشل في الحذف', 'error');
    } finally {
        hideLoading();
    }
};

// Export for dashboard to use
export function openAddProfitModalFromDashboard() {
    window.openAddProfitModal();
}

// Register view
registerView('profits', renderProfits);

console.log('💰 Profits UI loaded');
