// ==========================================
// Settings UI - App Configuration
// ==========================================

import { registerView } from '../core/router.js';
import { getState, updateSetting, saveSettings } from '../core/state.js';
import { logOut } from '../core/auth.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast, confirm } from '../utils/ui-helpers.js';

/**
 * Render the settings view
 */
export async function renderSettings() {
    const container = document.getElementById('settings-container');
    if (!container) return;

    const { settings, user } = getState();

    container.innerHTML = `
        ${renderUserCard(user)}
        ${renderCurrencySettings(settings)}
        ${renderBenchmarkSettings(settings)}
        ${renderPartnerSettings(settings)}
        ${renderAppInfo()}
        ${renderDangerZone()}
    `;

    initSettingsListeners();
}

// ==========================================
// Component Renderers
// ==========================================

function renderUserCard(user) {
    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="display: flex; align-items: center; gap: var(--space-lg);">
                <div style="
                    width: 64px; height: 64px;
                    border-radius: var(--radius-full);
                    overflow: hidden;
                    border: 2px solid var(--gold);
                ">
                    <img src="${user?.photoURL || ''}" alt="User" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <div style="flex: 1;">
                    <div style="font-size: var(--font-size-lg); font-weight: 700; color: var(--text-primary);">
                        ${user?.displayName || 'مستخدم'}
                    </div>
                    <div style="font-size: var(--font-size-sm); color: var(--text-muted);">
                        ${user?.email || ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderCurrencySettings(settings) {
    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                <i class="fa-solid fa-coins" style="color: var(--gold);"></i>
                إعدادات العملات
            </div>
            
            <div class="form-group">
                <label class="form-label">سعر صرف الدولار (بالجنيه)</label>
                <input type="number" class="form-input" id="setting-usd-rate" 
                    value="${settings.exchangeRates?.USD || 50.5}" 
                    min="1" step="0.1">
                <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 4px;">
                    يُستخدم لتحويل قيمة المحافظ الدولارية
                </div>
            </div>
        </div>
    `;
}

function renderBenchmarkSettings(settings) {
    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                <i class="fa-solid fa-landmark" style="color: var(--blue);"></i>
                معيار المقارنة
            </div>
            
            <div class="form-group">
                <label class="form-label">عائد الشهادات البنكية الشهري %</label>
                <input type="number" class="form-input" id="setting-bank-rate" 
                    value="${settings.bankBenchmark || 2.0}" 
                    min="0" max="100" step="0.1">
                <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 4px;">
                    يُستخدم في مؤشر "Beat the Bank"
                </div>
            </div>
        </div>
    `;
}

function renderPartnerSettings(settings) {
    const ratio = (settings.partnerSplitRatio || 0.5) * 100;

    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                <i class="fa-solid fa-handshake" style="color: var(--purple);"></i>
                إعدادات الشراكة
            </div>
            
            <div class="form-group">
                <label class="form-label">نسبة الشريك من الأرباح %</label>
                <input type="number" class="form-input" id="setting-partner-ratio" 
                    value="${ratio}" 
                    min="0" max="100" step="5">
                <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 4px;">
                    نصيب الشريك يُحسم آلياً من كل ربح
                </div>
            </div>
        </div>
    `;
}

function renderAppInfo() {
    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-md); display: flex; align-items: center; gap: var(--space-sm);">
                <i class="fa-solid fa-info-circle" style="color: var(--text-muted);"></i>
                معلومات التطبيق
            </div>
            
            <div style="display: flex; flex-direction: column; gap: var(--space-sm); font-size: var(--font-size-sm); color: var(--text-secondary);">
                <div style="display: flex; justify-content: space-between;">
                    <span>الإصدار</span>
                    <span style="color: var(--gold);">V4.0.0</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>البناء</span>
                    <span>World-Class Edition</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>قاعدة البيانات</span>
                    <span style="color: var(--green);">mywealth-dca55</span>
                </div>
            </div>
        </div>
    `;
}

function renderDangerZone() {
    return `
        <div class="glass-card" style="padding: var(--space-lg); border-color: var(--red);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-lg); color: var(--red); display: flex; align-items: center; gap: var(--space-sm);">
                <i class="fa-solid fa-triangle-exclamation"></i>
                منطقة الخطر
            </div>
            
            <button class="btn" style="width: 100%; background: var(--red-bg); color: var(--red);" onclick="handleLogout()">
                <i class="fa-solid fa-right-from-bracket"></i>
                تسجيل الخروج
            </button>
        </div>
    `;
}

// ==========================================
// Event Handlers
// ==========================================

function initSettingsListeners() {
    // USD Rate
    document.getElementById('setting-usd-rate')?.addEventListener('change', (e) => {
        const rate = parseFloat(e.target.value) || 50.5;
        const { settings } = getState();
        updateSetting('exchangeRates', { ...settings.exchangeRates, USD: rate });
        showToast('تم تحديث سعر الصرف', 'success');
    });

    // Bank Benchmark
    document.getElementById('setting-bank-rate')?.addEventListener('change', (e) => {
        const rate = parseFloat(e.target.value) || 2.0;
        updateSetting('bankBenchmark', rate);
        showToast('تم تحديث معيار البنك', 'success');
    });

    // Partner Ratio
    document.getElementById('setting-partner-ratio')?.addEventListener('change', (e) => {
        const ratio = (parseFloat(e.target.value) || 50) / 100;
        updateSetting('partnerSplitRatio', ratio);
        showToast('تم تحديث نسبة الشريك', 'success');
    });
}

window.handleLogout = async () => {
    const confirmed = await confirm('هل أنت متأكد من تسجيل الخروج؟');
    if (!confirmed) return;

    try {
        await logOut();
        showToast('تم تسجيل الخروج', 'success');
        location.reload();
    } catch (error) {
        showToast('فشل في تسجيل الخروج', 'error');
    }
};

// Register view
registerView('settings', renderSettings);

console.log('⚙️ Settings UI loaded');
