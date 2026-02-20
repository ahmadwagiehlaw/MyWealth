// ==========================================
// Profits UI - Alpha Dashboard
// ==========================================

import { registerView } from '../core/router.js';
import { getState } from '../core/state.js';
import { getPortfolios } from '../modules/portfolios.js';
import {
    getProfits,
    getPartnerDistributions,
    createProfit,
    updateProfit,
    deleteProfit,
    distributePartnerMonthly,
    updatePartnerDistributionRecord,
    deletePartnerDistributionRecord,
    getProfitShareDetails,
    getTotalNetProfits,
    getUndistributedPartnerShare,
    getTotalDistributedToPartner,
    getRemainingProfitsAfterDistribution,
    getAverageROCE
} from '../modules/profits.js';
import { formatCurrency, formatPercent, formatDate, toEGP } from '../utils/formatters.js';
import { showLoading, hideLoading, showToast, openModal, closeModal, confirm } from '../utils/ui-helpers.js';

let profitsChart = null;
let activeProfitRange = 'month';
let activeRecordsTab = 'profits';

// ==========================================
// Main Render
// ==========================================

export async function renderProfits() {
    const container = document.getElementById('profits-container');
    if (!container) return;

    showLoading();

    try {
        await Promise.all([getPortfolios(), getProfits(), getPartnerDistributions()]);

        const { profits, portfolios, partnerDistributions } = getState();

        const totalNet = getTotalNetProfits();
        const remainingAfterPaid = getRemainingProfitsAfterDistribution();
        const distributedToPartner = getTotalDistributedToPartner();
        const undistributed = getUndistributedPartnerShare();
        const avgROCE = getAverageROCE();

        container.innerHTML = `
            ${renderStatsCards(totalNet, remainingAfterPaid, distributedToPartner, undistributed, avgROCE)}
            ${renderProfitsChart()}
            ${renderRecordsPanel(profits, portfolios, partnerDistributions || [])}
        `;

        bindProfitChartFilters();
        bindRecordsTabs();
        setTimeout(() => initProfitsChart(), 40);
    } catch (error) {
        console.error('Profits Error:', error);
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 2rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 2rem; color: var(--red); margin-bottom: 0.8rem;"></i>
                <p>حدث خطأ في تحميل صفحة الأرباح</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

// ==========================================
// Stat Cards
// ==========================================

function renderCompactStatCard({ icon, iconColor, iconBg, value, valueColor, label, meta }) {
    return `
        <div class="glass-card profits-stat-card">
            <div class="profits-stat-icon" style="color:${iconColor}; background:${iconBg};">
                <i class="fa-solid ${icon}"></i>
            </div>
            <div class="profits-stat-value" style="color:${valueColor};">${value}</div>
            <div class="profits-stat-label">${label}</div>
            ${meta ? `<div class="profits-stat-meta">${meta}</div>` : ''}
        </div>
    `;
}

function formatStatNumber(value) {
    return new Intl.NumberFormat('ar-EG', {
        maximumFractionDigits: 0,
        useGrouping: false
    }).format(Math.round(Number(value) || 0));
}

function toRatioText(value, base, prefix = 'نسبة') {
    const safeBase = Math.abs(Number(base) || 0);
    if (safeBase <= 0.0001) return `${prefix}: 0%`;
    const pct = ((Number(value) || 0) / safeBase) * 100;
    return `${prefix}: ${formatPercent(pct, false)}`;
}

function renderROCECard(avgROCE) {
    const normalized = Math.max(0, Math.min(100, ((avgROCE + 10) / 30) * 100));
    const tone = avgROCE >= 8 ? 'var(--green)' : avgROCE >= 3 ? 'var(--gold)' : avgROCE >= 0 ? 'var(--orange)' : 'var(--red)';
    const note = avgROCE >= 8 ? 'ممتاز' : avgROCE >= 3 ? 'جيد' : avgROCE >= 0 ? 'مقبول' : 'ضعيف';

    return `
        <div class="glass-card profits-stat-card profits-roce-card">
            <div class="profits-roce-top">
                <div class="profits-stat-icon" style="color:var(--gold); background:var(--gold-glow);">
                    <i class="fa-solid fa-bullseye"></i>
                </div>
                <div class="profits-roce-value-wrap">
                    <div class="profits-stat-value" style="color:${tone};">${formatPercent(avgROCE, false)}</div>
                    <div class="profits-roce-note" style="color:${tone};">${note}</div>
                </div>
            </div>
            <div class="profits-roce-meter">
                <div class="profits-roce-fill" style="width:${normalized.toFixed(1)}%; background:${tone};"></div>
            </div>
            <div class="profits-stat-label">متوسط ROCE (العائد على رأس المال المستخدم)</div>
        </div>
    `;
}

function renderStatsCards(totalNet, remainingAfterPaid, distributedToPartner, undistributed, avgROCE) {
    const expectedPartnerTotal = distributedToPartner + undistributed;

    return `
        <div class="profits-stats-grid">
            ${renderCompactStatCard({
        icon: 'fa-sack-dollar',
        iconColor: 'var(--green)',
        iconBg: 'var(--green-bg)',
        value: formatStatNumber(totalNet),
        valueColor: 'var(--green)',
        label: 'صافي الأرباح',
        meta: toRatioText(totalNet, totalNet, 'الوزن')
    })}
            ${renderCompactStatCard({
        icon: 'fa-wallet',
        iconColor: 'var(--blue)',
        iconBg: 'var(--blue-bg)',
        value: formatStatNumber(remainingAfterPaid),
        valueColor: 'var(--blue)',
        label: 'الأرباح المتبقية',
        meta: toRatioText(remainingAfterPaid, totalNet, 'من صافي الأرباح')
    })}
            ${renderCompactStatCard({
        icon: 'fa-clock',
        iconColor: 'var(--orange)',
        iconBg: 'var(--orange-bg)',
        value: formatStatNumber(undistributed),
        valueColor: 'var(--orange)',
        label: 'متبقي للشريك',
        meta: toRatioText(undistributed, expectedPartnerTotal, 'غير مدفوع')
    })}
            ${renderCompactStatCard({
        icon: 'fa-hand-holding-dollar',
        iconColor: 'var(--purple)',
        iconBg: 'var(--purple-bg)',
        value: formatStatNumber(distributedToPartner),
        valueColor: 'var(--purple)',
        label: 'تم توزيعه للشريك',
        meta: toRatioText(distributedToPartner, expectedPartnerTotal, 'تم سداده')
    })}
            ${renderROCECard(avgROCE)}
        </div>
    `;
}

// ==========================================
// Profit Chart
// ==========================================

function renderProfitsChart() {
    return `
        <div class="glass-card profits-chart-card">
            <div class="profits-chart-header">
                <div style="font-size: var(--font-size-md); font-weight: 700;">
                    <i class="fa-solid fa-chart-column" style="color: var(--gold); margin-left: var(--space-sm);"></i>
                    <span id="profits-chart-title">الأرباح ${getRangeLabel(activeProfitRange)}</span>
                </div>
                <div class="profits-chart-filters">
                    <button class="profits-chart-filter ${activeProfitRange === 'week' ? 'active' : ''}" data-range="week">أسبوعي</button>
                    <button class="profits-chart-filter ${activeProfitRange === 'month' ? 'active' : ''}" data-range="month">شهري</button>
                    <button class="profits-chart-filter ${activeProfitRange === 'year' ? 'active' : ''}" data-range="year">سنوي</button>
                </div>
            </div>
            <div class="profits-chart-subtitle">الأعمدة: صافي الربح | الخط: نسبة التغير عن الفترة السابقة</div>
            <div class="profits-chart-body">
                <canvas id="profitsChart"></canvas>
                <div id="profits-chart-empty" class="profits-chart-empty hidden">لا توجد بيانات كافية لعرض الشارت</div>
            </div>
        </div>
    `;
}

// ==========================================
// Records Panel
// ==========================================

function renderRecordsPanel(profits, portfolios, distributions) {
    const action = activeRecordsTab === 'profits'
        ? `
            <button class="btn btn-primary" style="padding: var(--space-xs) var(--space-md);" onclick="openAddProfitModal()">
                <i class="fa-solid fa-plus"></i>
            </button>
        `
        : `
            <button class="btn" style="padding: var(--space-xs) var(--space-md); background: var(--purple-bg); color: var(--purple);" onclick="openMonthlyDistributionModal()">
                <i class="fa-solid fa-plus"></i>
                إضافة توزيع
            </button>
        `;

    return `
        <div class="glass-card records-panel-card">
            <div class="records-panel-head">
                <div class="records-tabs">
                    <button class="records-tab ${activeRecordsTab === 'profits' ? 'active' : ''}" data-record-tab="profits">سجل الأرباح</button>
                    <button class="records-tab ${activeRecordsTab === 'distributions' ? 'active' : ''}" data-record-tab="distributions">سجل التوزيعات</button>
                </div>
                <div>${action}</div>
            </div>
            ${activeRecordsTab === 'profits' ? renderProfitsTable(profits, portfolios) : renderDistributionHistory(distributions)}
        </div>
    `;
}

function getProfitChange(profits, index) {
    const current = profits[index];
    const previous = profits[index + 1];
    if (!current || !previous) return null;

    const currentValue = toEGP(Number(current.netProfit) || 0, current.currency);
    const previousValue = toEGP(Number(previous.netProfit) || 0, previous.currency);
    const delta = currentValue - previousValue;

    if (Math.abs(previousValue) < 0.0001) return { delta, pct: null };
    return { delta, pct: (delta / Math.abs(previousValue)) * 100 };
}

function renderProfitChangeLine(change) {
    if (!change) return `<div class="profit-row-change muted">لا يوجد مقارنة سابقة</div>`;

    const signClass = change.delta >= 0 ? 'up' : 'down';
    const pctText = change.pct === null ? '—' : formatPercent(change.pct, true);

    return `
        <div class="profit-row-change ${signClass}">
            <span>تغير القيمة: ${formatCurrency(change.delta, 'EGP', true)}</span>
            <span>${pctText}</span>
        </div>
    `;
}

function renderProfitsTable(profits, portfolios) {
    if (profits.length === 0) {
        return `
            <div class="records-empty-state">
                <i class="fa-solid fa-receipt"></i>
                <p>لم تسجل أي أرباح بعد</p>
                <button class="btn btn-primary" onclick="openAddProfitModal()">
                    <i class="fa-solid fa-plus"></i> تسجيل ربح
                </button>
            </div>
        `;
    }

    const rows = profits.map((p, index) => {
        const date = p.date?.toDate ? p.date.toDate() : new Date(p.date);
        const portfolio = portfolios.find(pf => pf.id === p.portfolioId);
        const share = getProfitShareDetails(p);
        const isFullyDistributed = share.partnerPending <= 0.0001;
        const change = getProfitChange(profits, index);

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: var(--space-md);">
                    <div style="font-weight: 600;">${formatDate(date)}</div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-muted);">${p.ticker || portfolio?.name || '-'}</div>
                </td>
                <td style="padding: var(--space-md);">
                    <div style="font-weight: 800; color: var(--green);">+${formatCurrency(p.netProfit, p.currency)}</div>
                    ${renderProfitChangeLine(change)}
                    ${p.workingCapital > 0 ? `<div style="font-size: var(--font-size-xs); color: var(--purple);">ROCE: ${formatPercent(p.netProfit / p.workingCapital * 100, false)}</div>` : ''}
                </td>
                <td style="padding: var(--space-md);">
                    <span style="
                        padding: 4px 8px;
                        background: ${isFullyDistributed ? 'var(--green-bg)' : 'var(--orange-bg)'};
                        color: ${isFullyDistributed ? 'var(--green)' : 'var(--orange)'};
                        border-radius: var(--radius-sm);
                        font-size: var(--font-size-xs);
                    ">
                        ${isFullyDistributed ? 'تم السداد كاملًا' : `متبقي ${formatCurrency(share.partnerPending, p.currency)}`}
                    </span>
                </td>
                <td style="padding: var(--space-md); text-align: left;">
                    <button class="btn-icon" onclick="openEditProfitModal('${p.id}')" title="تعديل">
                        <i class="fa-solid fa-pen-to-square" style="color: var(--blue);"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteProfitRecord('${p.id}')" title="حذف">
                        <i class="fa-solid fa-trash" style="color: var(--red);"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
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
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderDistributionHistory(distributions) {
    if (!Array.isArray(distributions) || distributions.length === 0) {
        return `
            <div class="records-empty-state">
                <i class="fa-solid fa-calendar-check"></i>
                <p>لا توجد توزيعات شهرية مسجلة بعد</p>
                <button class="btn" style="background: var(--purple-bg); color: var(--purple);" onclick="openMonthlyDistributionModal()">
                    <i class="fa-solid fa-plus"></i>
                    إضافة توزيع
                </button>
            </div>
        `;
    }

    const rows = distributions.map(item => {
        const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
        const dateLabel = Number.isNaN(date.getTime()) ? '-' : formatDate(date);
        const note = (item.note || '').toString().trim();

        return `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: var(--space-md);">${dateLabel}</td>
                <td style="padding: var(--space-md); font-weight: 700;">${formatCurrency(item.amountEGP || 0)}</td>
                <td style="padding: var(--space-md); color: var(--green);">${formatCurrency(item.appliedEGP || 0)}</td>
                <td style="padding: var(--space-md); color: var(--orange);">${formatCurrency(item.unappliedEGP || 0)}</td>
                <td style="padding: var(--space-md);">${item.affectedRecords || 0}</td>
                <td style="padding: var(--space-md);">${note || '-'}</td>
                <td style="padding: var(--space-md); text-align:left;">
                    <button class="btn-icon" onclick="openEditDistributionModal('${item.id}')" title="تعديل">
                        <i class="fa-solid fa-pen-to-square" style="color: var(--blue);"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteDistributionRecord('${item.id}')" title="حذف">
                        <i class="fa-solid fa-trash" style="color: var(--red);"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    return `
        <div style="overflow-x: auto;">
            <table class="distributions-history-table">
                <thead>
                    <tr>
                        <th>التاريخ</th>
                        <th>الإجمالي</th>
                        <th>المطبق</th>
                        <th>غير مستخدم</th>
                        <th>سجلات</th>
                        <th>ملاحظة</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

// ==========================================
// Chart Logic
// ==========================================

function bindProfitChartFilters() {
    const buttons = document.querySelectorAll('.profits-chart-filter[data-range]');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const nextRange = btn.dataset.range;
            if (!nextRange || nextRange === activeProfitRange) return;

            activeProfitRange = nextRange;
            buttons.forEach(b => b.classList.toggle('active', b.dataset.range === activeProfitRange));

            const title = document.getElementById('profits-chart-title');
            if (title) title.textContent = `الأرباح ${getRangeLabel(activeProfitRange)}`;

            initProfitsChart();
        });
    });
}

function bindRecordsTabs() {
    const buttons = document.querySelectorAll('[data-record-tab]');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.recordTab;
            if (!tab || tab === activeRecordsTab) return;
            activeRecordsTab = tab;
            renderProfits();
        });
    });
}

function getRangeLabel(range) {
    if (range === 'week') return 'الأسبوعية';
    if (range === 'year') return 'السنوية';
    return 'الشهرية';
}

function getPeriodStart(date, range) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    if (range === 'week') {
        const day = (d.getDay() + 6) % 7;
        d.setDate(d.getDate() - day);
        return d;
    }

    if (range === 'year') {
        return new Date(d.getFullYear(), 0, 1);
    }

    return new Date(d.getFullYear(), d.getMonth(), 1);
}

function getPeriodKey(startDate, range) {
    if (range === 'week') {
        return `week-${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
    }

    if (range === 'year') {
        return `year-${startDate.getFullYear()}`;
    }

    return `month-${startDate.getFullYear()}-${startDate.getMonth()}`;
}

function getPeriodLabel(startDate, range) {
    if (range === 'week') {
        return `أسبوع ${startDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}`;
    }

    if (range === 'year') {
        return startDate.getFullYear().toString();
    }

    return startDate.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
}

function getProfitSeries(range) {
    const { profits } = getState();
    const grouped = new Map();

    profits.forEach(item => {
        const date = item.date?.toDate ? item.date.toDate() : new Date(item.date);
        if (!date || Number.isNaN(date.getTime())) return;

        const startDate = getPeriodStart(date, range);
        const key = getPeriodKey(startDate, range);
        const current = grouped.get(key) || {
            start: startDate.getTime(),
            label: getPeriodLabel(startDate, range),
            value: 0
        };

        current.value += toEGP(Number(item.netProfit) || 0, item.currency);
        grouped.set(key, current);
    });

    const sorted = Array.from(grouped.values()).sort((a, b) => a.start - b.start);
    const maxPoints = range === 'week' ? 16 : (range === 'month' ? 18 : 10);
    const sliced = sorted.length > maxPoints ? sorted.slice(-maxPoints) : sorted;

    return sliced.map((point, idx) => {
        if (idx === 0) return { ...point, changePct: null };

        const prev = sliced[idx - 1].value;
        if (Math.abs(prev) < 0.0001) return { ...point, changePct: null };

        return {
            ...point,
            changePct: ((point.value - prev) / Math.abs(prev)) * 100
        };
    });
}

function initProfitsChart() {
    const canvas = document.getElementById('profitsChart');
    if (!canvas) return;

    const empty = document.getElementById('profits-chart-empty');
    const points = getProfitSeries(activeProfitRange);

    if (profitsChart) profitsChart.destroy();

    if (points.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    const ctx = canvas.getContext('2d');
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)';
    const tickColor = isLight ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)';

    profitsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: points.map(p => p.label),
            datasets: [{
                type: 'bar',
                label: 'صافي الربح',
                data: points.map(p => p.value),
                yAxisID: 'y',
                backgroundColor: '#10b981',
                borderRadius: 8,
                maxBarThickness: 26
            }, {
                type: 'line',
                label: 'نسبة التغير %',
                data: points.map(p => p.changePct),
                yAxisID: 'y1',
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.22)',
                tension: 0.35,
                borderWidth: 2,
                pointRadius: 3,
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
                        label: (ctxItem) => {
                            if (ctxItem.dataset.yAxisID === 'y1') {
                                if (ctxItem.raw === null || Number.isNaN(ctxItem.raw)) return ' نسبة التغير: —';
                                return ` نسبة التغير: ${formatPercent(ctxItem.raw, true)}`;
                            }
                            return ` صافي الربح: ${formatCurrency(ctxItem.raw)}`;
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
                        maxRotation: 0,
                        autoSkip: true
                    }
                }
            }
        }
    });
}

function escapeAttr(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// ==========================================
// Modals & Actions
// ==========================================

window.openAddProfitModal = () => {
    const { portfolios } = getState();

    if (portfolios.length === 0) {
        showToast('أضف محفظة أولاً', 'error');
        return;
    }

    const portfolioOptions = portfolios
        .map(p => `<option value="${p.id}">${p.name} (${p.currency})</option>`)
        .join('');

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
        grossProfit: formData.get('netProfit'),
        fees: 0,
        workingCapital: formData.get('workingCapital'),
        description: formData.get('description'),
        currency: portfolio?.currency || 'EGP'
    };

    if (!data.netProfit || Number(data.netProfit) <= 0) {
        showToast('الرجاء إدخال صافي الربح', 'error');
        return;
    }

    try {
        showLoading();
        await createProfit(data);
        closeModal();
        showToast('تم تسجيل الربح بنجاح', 'success');
        renderProfits();
    } catch {
        showToast('فشل في تسجيل الربح', 'error');
    } finally {
        hideLoading();
    }
};

window.openMonthlyDistributionModal = () => {
    const pendingEGP = getUndistributedPartnerShare();
    if (pendingEGP <= 0.0001) {
        showToast('لا يوجد مستحقات معلقة للشريك', 'info');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const content = `
        <form id="monthly-distribution-form">
            <div class="form-group">
                <label class="form-label">إجمالي المتبقي للشريك (ج.م)</label>
                <input type="text" class="form-input" value="${formatCurrency(pendingEGP)}" disabled>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">المبلغ الموزع هذا الشهر (ج.م)</label>
                    <input type="number" class="form-input" name="amountEGP" min="0.01" step="0.01" value="${pendingEGP.toFixed(2)}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">تاريخ التوزيع</label>
                    <input type="date" class="form-input" name="date" value="${today}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">ملاحظة (اختياري)</label>
                <input type="text" class="form-input" name="note" placeholder="توزيع شهر فبراير">
            </div>
        </form>
    `;

    const footer = `
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="submitMonthlyDistribution()">
            <i class="fa-solid fa-check"></i> حفظ التوزيع
        </button>
    `;

    openModal('توزيع شهري للشريك', content, { footer });
};

window.submitMonthlyDistribution = async () => {
    const form = document.getElementById('monthly-distribution-form');
    if (!form) return;

    const formData = new FormData(form);
    const amountEGP = Number(formData.get('amountEGP')) || 0;
    const date = formData.get('date');
    const note = (formData.get('note') || '').toString().trim();

    if (amountEGP <= 0) {
        showToast('أدخل مبلغ توزيع صحيح', 'error');
        return;
    }

    try {
        showLoading();
        const summary = await distributePartnerMonthly(amountEGP, date || null, note);
        closeModal();
        activeRecordsTab = 'distributions';

        const unapplied = summary.unappliedEGP > 0.0001
            ? ` | غير مستخدم: ${formatCurrency(summary.unappliedEGP)}`
            : '';

        showToast(`تم تسجيل توزيع ${formatCurrency(summary.appliedEGP)}${unapplied}`, 'success');
        renderProfits();
    } catch (error) {
        showToast(error?.message || 'فشل في التوزيع الشهري', 'error');
    } finally {
        hideLoading();
    }
};

window.openEditDistributionModal = (id) => {
    const { partnerDistributions } = getState();
    const row = (partnerDistributions || []).find(item => item.id === id);
    if (!row) return;

    const date = row.date?.toDate ? row.date.toDate() : new Date(row.date);
    const dateValue = Number.isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];

    const content = `
        <form id="edit-distribution-form">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">الإجمالي (ج.م)</label>
                    <input type="number" class="form-input" name="amountEGP" min="0.01" step="0.01" value="${Number(row.amountEGP) || 0}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">التاريخ</label>
                    <input type="date" class="form-input" name="date" value="${dateValue}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">ملاحظة</label>
                <input type="text" class="form-input" name="note" value="${escapeAttr(row.note || '')}">
            </div>

            <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                تعديل هذا السجل يؤثر على سجل التوزيع فقط، وليس إعادة احتساب التوزيع السابق.
            </div>
        </form>
    `;

    const footer = `
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="submitEditDistribution('${id}')">
            <i class="fa-solid fa-check"></i> حفظ
        </button>
    `;

    openModal('تعديل سجل توزيع', content, { footer });
};

window.submitEditDistribution = async (id) => {
    const form = document.getElementById('edit-distribution-form');
    if (!form) return;

    const { partnerDistributions } = getState();
    const row = (partnerDistributions || []).find(item => item.id === id);
    if (!row) return;

    const formData = new FormData(form);
    const amount = Number(formData.get('amountEGP')) || 0;
    if (amount <= 0) {
        showToast('أدخل مبلغ صحيح', 'error');
        return;
    }

    const applied = Math.min(amount, Number(row.appliedEGP) || 0);
    const unapplied = Math.max(0, amount - applied);

    try {
        showLoading();
        await updatePartnerDistributionRecord(id, {
            amountEGP: amount,
            appliedEGP: applied,
            unappliedEGP: unapplied,
            affectedRecords: Number(row.affectedRecords) || 0,
            date: formData.get('date'),
            note: (formData.get('note') || '').toString().trim()
        });

        closeModal();
        showToast('تم تعديل سجل التوزيع', 'success');
        renderProfits();
    } catch (error) {
        showToast(error?.message || 'فشل في تعديل السجل', 'error');
    } finally {
        hideLoading();
    }
};

window.deleteDistributionRecord = async (id) => {
    const confirmed = await confirm('هل تريد حذف سجل التوزيع؟');
    if (!confirmed) return;

    try {
        showLoading();
        await deletePartnerDistributionRecord(id);
        showToast('تم حذف سجل التوزيع', 'success');
        renderProfits();
    } catch (error) {
        showToast(error?.message || 'فشل في الحذف', 'error');
    } finally {
        hideLoading();
    }
};

window.openEditProfitModal = (id) => {
    const { profits } = getState();
    const profit = profits.find(p => p.id === id);
    if (!profit) return;

    const date = profit.date?.toDate ? profit.date.toDate() : new Date(profit.date);
    const dateValue = Number.isNaN(date.getTime()) ? new Date().toISOString().split('T')[0] : date.toISOString().split('T')[0];

    const content = `
        <form id="edit-profit-form">
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">رمز السهم (اختياري)</label>
                    <input type="text" class="form-input" name="ticker" value="${escapeAttr(profit.ticker || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">التاريخ</label>
                    <input type="date" class="form-input" name="date" value="${dateValue}">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">صافي الربح</label>
                    <input type="number" class="form-input" name="netProfit" min="0" step="0.01" value="${Number(profit.netProfit) || 0}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">رأس المال المستخدم</label>
                    <input type="number" class="form-input" name="workingCapital" min="0" step="0.01" value="${Number(profit.workingCapital) || 0}">
                </div>
            </div>

            <div class="form-group">
                <label class="form-label">ملاحظات</label>
                <input type="text" class="form-input" name="description" value="${escapeAttr(profit.description || '')}">
            </div>
        </form>
    `;

    const footer = `
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="submitEditProfit('${id}')">
            <i class="fa-solid fa-check"></i> حفظ التعديل
        </button>
    `;

    openModal('تعديل سجل الربح', content, { footer });
};

window.submitEditProfit = async (id) => {
    const form = document.getElementById('edit-profit-form');
    if (!form) return;

    const formData = new FormData(form);
    const { settings, profits } = getState();
    const profit = profits.find(p => p.id === id);
    if (!profit) return;

    const netProfit = Number(formData.get('netProfit')) || 0;
    if (netProfit <= 0) {
        showToast('الرجاء إدخال صافي ربح صحيح', 'error');
        return;
    }

    const partnerRatio = Number(settings?.partnerSplitRatio) || 0.5;
    const expectedPartnerShare = Math.max(0, netProfit * partnerRatio);
    const currentPaid = Math.max(0, Number(profit.partnerPaid) || 0);
    const nextPaid = Math.min(currentPaid, expectedPartnerShare);

    const updates = {
        ticker: (formData.get('ticker') || '').toString().trim(),
        description: (formData.get('description') || '').toString().trim(),
        netProfit,
        grossProfit: netProfit,
        workingCapital: Number(formData.get('workingCapital')) || 0,
        date: formData.get('date') ? new Date(formData.get('date')) : profit.date,
        partnerSplit: expectedPartnerShare,
        myShare: netProfit - expectedPartnerShare,
        partnerPaid: nextPaid,
        distributed: (expectedPartnerShare - nextPaid) <= 0.0001
    };

    updates.distributedAt = updates.distributed
        ? (profit.distributedAt || new Date())
        : null;

    try {
        showLoading();
        await updateProfit(id, updates);
        closeModal();
        showToast('تم تحديث السجل', 'success');
        renderProfits();
    } catch {
        showToast('فشل في تحديث السجل', 'error');
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
    } catch {
        showToast('فشل في الحذف', 'error');
    } finally {
        hideLoading();
    }
};

export function openAddProfitModalFromDashboard() {
    window.openAddProfitModal();
}

document.getElementById('add-profit-btn')?.addEventListener('click', window.openAddProfitModal);

registerView('profits', renderProfits);

console.log('Profits UI loaded');
