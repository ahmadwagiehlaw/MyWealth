// ==========================================
// Portfolios UI - Multi-Currency Vaults
// ==========================================

import { registerView } from '../core/router.js';
import { getState } from '../core/state.js';
import { getPortfolios, createPortfolio, updatePortfolio, deletePortfolio } from '../modules/portfolios.js';
import { formatCurrency, formatCompact, formatPercent } from '../utils/formatters.js';
import { showLoading, hideLoading, showToast, openModal, closeModal, confirm } from '../utils/ui-helpers.js';
import { toEGP } from '../utils/formatters.js';

/**
 * Render the portfolios view
 */
export async function renderPortfolios() {
    const container = document.getElementById('portfolios-container');
    if (!container) return;

    showLoading();

    try {
        const portfolios = await getPortfolios();

        if (portfolios.length === 0) {
            container.innerHTML = renderEmptyState();
        } else {
            container.innerHTML = `
                ${renderSummaryBar(portfolios)}
                ${renderPortfolioCards(portfolios)}
            `;
        }

    } catch (error) {
        console.error('❌ Portfolios Error:', error);
        container.innerHTML = `
            <div class="glass-card" style="text-align: center; padding: 3rem;">
                <i class="fa-solid fa-exclamation-triangle" style="font-size: 3rem; color: var(--red); margin-bottom: 1rem;"></i>
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
        <div class="glass-card" style="text-align: center; padding: 4rem 2rem;">
            <i class="fa-solid fa-vault" style="font-size: 4rem; color: var(--gold); margin-bottom: var(--space-lg);"></i>
            <h3 style="margin-bottom: var(--space-sm); color: var(--text-primary);">لا توجد محافظ</h3>
            <p style="color: var(--text-secondary); margin-bottom: var(--space-lg);">أضف محفظتك الأولى لبدء تتبع ثروتك</p>
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
        <div class="glass-card" style="
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: var(--space-lg); 
            margin-bottom: var(--space-lg);
            background: linear-gradient(135deg, rgba(255,215,0,0.05), transparent);
            border: 1px solid rgba(255,215,0,0.1);
        ">
            <div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: 4px;">
                    إجمالي القيمة السوقية
                </div>
                <div style="font-size: var(--font-size-2xl); font-weight: 800; color: var(--gold);">
                    ${formatCurrency(totalEGP)}
                </div>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                    ${portfolios.length} محفظة • ${currencies.join(' + ')}
                </div>
            </div>
            <button class="btn btn-primary" onclick="openAddPortfolioModal()">
                <i class="fa-solid fa-plus"></i>
            </button>
        </div>
    `;
}

function renderPortfolioCards(portfolios) {
    return `
        <div style="display: flex; flex-direction: column; gap: var(--space-md);">
            ${portfolios.map(p => renderPortfolioCard(p)).join('')}
        </div>
    `;
}

function renderPortfolioCard(portfolio) {
    const invested = (portfolio.initialCapital || 0) + (portfolio.totalDeposits || 0) - (portfolio.totalWithdrawals || 0);
    const pnl = portfolio.currentValue - invested;
    const pnlPercent = invested > 0 ? (pnl / invested * 100) : 0;

    const currencyBadge = portfolio.currency === 'USD'
        ? '<span style="background: var(--green-bg); color: var(--green); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">$</span>'
        : '<span style="background: var(--blue-bg); color: var(--blue); padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">ج.م</span>';

    const typeIcon = portfolio.type === 'BROKERAGE' ? 'fa-chart-line'
        : portfolio.type === 'FUND' ? 'fa-piggy-bank'
            : portfolio.type === 'FITNESS' ? 'fa-dumbbell'
                : 'fa-building-columns';

    return `
        <div class="glass-card portfolio-card" style="padding: var(--space-lg); cursor: pointer;" onclick="openPortfolioDetails('${portfolio.id}')">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-md);">
                <div style="display: flex; align-items: center; gap: var(--space-sm);">
                    <div style="
                        width: 44px; height: 44px;
                        background: var(--bg-card);
                        border-radius: var(--radius-md);
                        display: flex; align-items: center; justify-content: center;
                        color: var(--gold);
                    ">
                        <i class="fa-solid ${typeIcon}"></i>
                    </div>
                    <div>
                        <div style="font-weight: 600; color: var(--text-primary); display: flex; align-items: center; gap: var(--space-sm);">
                            ${portfolio.name}
                            ${currencyBadge}
                        </div>
                        <div style="font-size: var(--font-size-xs); color: var(--text-muted);">
                            ${portfolio.type === 'BROKERAGE' ? 'وسيط' : portfolio.type === 'FUND' ? 'صندوق' : portfolio.type === 'FITNESS' ? 'تحدي رياضي' : 'بنك'}
                        </div>
                    </div>
                </div>
                <button class="btn-icon" onclick="event.stopPropagation(); openPortfolioMenu('${portfolio.id}')">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                </button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-md); text-align: center;">
                <div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-muted);">القيمة السوقية</div>
                    <div style="font-size: var(--font-size-lg); font-weight: 700; color: var(--text-primary);">
                        ${formatCompact(portfolio.currentValue)}
                    </div>
                </div>
                <div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-muted);">المستثمر</div>
                    <div style="font-size: var(--font-size-lg); font-weight: 700; color: var(--text-secondary);">
                        ${formatCompact(invested)}
                    </div>
                </div>
                <div>
                    <div style="font-size: var(--font-size-xs); color: var(--text-muted);">الربح/الخسارة</div>
                    <div style="font-size: var(--font-size-lg); font-weight: 700; color: ${pnl >= 0 ? 'var(--green)' : 'var(--red)'};">
                        ${formatPercent(pnlPercent)}
                    </div>
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
                        <option value="FITNESS">تحديات رياضية 🏃</option>
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
        <div style="text-align: center; margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-2xl); font-weight: 800; color: var(--gold);">
                ${formatCurrency(portfolio.currentValue, portfolio.currency)}
            </div>
            <div style="font-size: var(--font-size-sm); color: ${pnl >= 0 ? 'var(--green)' : 'var(--red)'};">
                ${pnl >= 0 ? '+' : ''}${formatCurrency(pnl, portfolio.currency)} (${formatPercent(pnlPercent)})
            </div>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); margin-bottom: var(--space-lg);">
            <div class="glass-card" style="padding: var(--space-md); text-align: center;">
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">المستثمر</div>
                <div style="font-weight: 600;">${formatCurrency(invested, portfolio.currency)}</div>
            </div>
            <div class="glass-card" style="padding: var(--space-md); text-align: center;">
                <div style="font-size: var(--font-size-xs); color: var(--text-muted);">الإيداعات</div>
                <div style="font-weight: 600;">${formatCurrency(portfolio.totalDeposits || 0, portfolio.currency)}</div>
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

window.openPortfolioMenu = (id) => {
    openPortfolioDetails(id);
};

// Set up add button
document.getElementById('add-portfolio-btn')?.addEventListener('click', window.openAddPortfolioModal);

// Register view
registerView('portfolios', renderPortfolios);

console.log('🏦 Portfolios UI loaded');
