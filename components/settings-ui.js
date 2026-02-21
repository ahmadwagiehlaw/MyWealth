// ==========================================
// Settings UI - App Configuration
// ==========================================

import { registerView } from '../core/router.js';
import { getState, updateSetting, saveSettings } from '../core/state.js';
import { logOut } from '../core/auth.js';
import { auth, updateProfile } from '../firebase-config.js';
import { formatCurrency } from '../utils/formatters.js';
import { showToast, confirm, openModal, closeModal } from '../utils/ui-helpers.js';

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
    const photoURL = user?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.displayName || 'U')}&background=ffd700&color=000&bold=true`;
    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="display: flex; align-items: center; gap: var(--space-lg);">
                <div style="position: relative;">
                    <div style="
                        width: 64px; height: 64px;
                        border-radius: var(--radius-full);
                        overflow: hidden;
                        border: 2px solid var(--gold);
                    ">
                        <img src="${photoURL}" alt="User" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </div>
                <div style="flex: 1;">
                    <div style="font-size: var(--font-size-lg); font-weight: 700; color: var(--text-primary);">
                        ${user?.displayName || 'مستخدم'}
                    </div>
                    <div style="font-size: var(--font-size-sm); color: var(--text-muted);">
                        ${user?.email || ''}
                    </div>
                </div>
                <button class="btn" style="background: var(--bg-card); padding: 0.5rem;" onclick="openEditProfileModal()" title="تعديل الملف الشخصي">
                    <i class="fa-solid fa-pen" style="font-size: 0.8rem;"></i>
                </button>
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
    const enabled = settings.partnerEnabled || false;
    const ratio = (settings.partnerSplitRatio || 0.5) * 100;

    return `
        <div class="glass-card" style="padding: var(--space-lg); margin-bottom: var(--space-lg);">
            <div style="font-size: var(--font-size-md); font-weight: 600; margin-bottom: var(--space-lg); display: flex; align-items: center; gap: var(--space-sm);">
                <i class="fa-solid fa-handshake" style="color: var(--purple);"></i>
                إعدادات الشراكة
            </div>

            <div class="form-group" style="margin-bottom: var(--space-md);">
                <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; font-size: var(--font-size-sm); color: var(--text-secondary);">
                    <input type="checkbox" id="setting-partner-enabled" ${enabled ? 'checked' : ''} style="width: 18px; height: 18px; accent-color: var(--gold);">
                    تفعيل وضع الشراكة
                </label>
                <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: 4px;">
                    عند التفعيل، سيتم حساب نصيب الشريك من كل ربح تلقائياً
                </div>
            </div>
            
            <div id="partner-ratio-group" style="${enabled ? '' : 'opacity: 0.4; pointer-events: none;'}">
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
                    <span style="color: var(--gold);">V4.1.0</span>
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

    // Partner Enabled Toggle
    document.getElementById('setting-partner-enabled')?.addEventListener('change', (e) => {
        const enabled = e.target.checked;
        updateSetting('partnerEnabled', enabled);
        const ratioGroup = document.getElementById('partner-ratio-group');
        if (ratioGroup) {
            ratioGroup.style.opacity = enabled ? '1' : '0.4';
            ratioGroup.style.pointerEvents = enabled ? 'auto' : 'none';
        }
        showToast(enabled ? 'تم تفعيل وضع الشراكة' : 'تم إلغاء وضع الشراكة', 'success');
    });

    // Partner Ratio
    document.getElementById('setting-partner-ratio')?.addEventListener('change', (e) => {
        const ratio = (parseFloat(e.target.value) || 50) / 100;
        updateSetting('partnerSplitRatio', ratio);
        showToast('تم تحديث نسبة الشريك', 'success');
    });
}

// ==========================================
// Profile Editing
// ==========================================

window.openEditProfileModal = () => {
    const { user } = getState();

    const content = `
        <form id="edit-profile-form">
            <div class="form-group">
                <label class="form-label">الاسم</label>
                <input type="text" class="form-input" name="displayName" value="${user?.displayName || ''}" required>
            </div>
            <div style="font-size: var(--font-size-xs); color: var(--text-muted); margin-top: var(--space-sm); padding: var(--space-sm); background: var(--bg-card); border-radius: var(--radius-sm);">
                <i class="fa-solid fa-circle-info" style="color: var(--blue);"></i>
                الصورة يتم تحديثها من حساب Google المرتبط
            </div>
        </form>
    `;

    const footer = `
        <button class="btn" style="background: var(--bg-card);" onclick="closeModal()">إلغاء</button>
        <button class="btn btn-primary" onclick="submitEditProfile()">
            <i class="fa-solid fa-check"></i> حفظ
        </button>
    `;

    openModal('تعديل الملف الشخصي', content, { footer });
};

window.submitEditProfile = async () => {
    const form = document.getElementById('edit-profile-form');
    if (!form) return;

    const formData = new FormData(form);
    const displayName = formData.get('displayName')?.trim();

    if (!displayName) {
        showToast('الرجاء إدخال الاسم', 'error');
        return;
    }

    try {
        await updateProfile(auth.currentUser, { displayName });

        // Update header avatar
        const headerName = document.querySelector('.user-avatar');
        if (headerName) {
            // Refresh will update it
        }

        closeModal();
        showToast('تم تحديث الملف الشخصي', 'success');
        renderSettings(); // Re-render to show updated name
    } catch (error) {
        console.error('Profile update error:', error);
        showToast('فشل في التحديث', 'error');
    }
};

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
