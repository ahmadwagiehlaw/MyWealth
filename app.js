// ==========================================
// Wealth Commander V4 - Main Entry Point
// ==========================================

import { auth, onAuthStateChanged, signInWithPopup, googleProvider, signOut } from './firebase-config.js';
import { initRouter, navigate } from './core/router.js';
import { initState, getState, setState } from './core/state.js';
import { showToast, showLoading, hideLoading } from './utils/ui-helpers.js';

// Import UI Components (registers views with router)
import './components/dashboard-ui.js';
import './components/portfolios-ui.js';
import './components/profits-ui.js';
import './components/calculator-ui.js';
import './components/settings-ui.js';

console.log('🚀 Wealth Commander V4 Starting...');

// ==========================================
// PWA Install Logic
// ==========================================
let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    console.log('📱 PWA Install Available');

    // Show install banner
    const banner = document.getElementById('pwa-install-banner');
    if (banner && !localStorage.getItem('pwa-dismissed')) {
        banner.classList.remove('hidden');
    }
});

// Install button click
document.getElementById('pwa-install-btn')?.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('📱 PWA Install:', outcome);

        if (outcome === 'accepted') {
            showToast('تم تثبيت التطبيق بنجاح!', 'success');
        }

        deferredPrompt = null;
        document.getElementById('pwa-install-banner').classList.add('hidden');
    }
});

// Dismiss button click
document.getElementById('pwa-dismiss-btn')?.addEventListener('click', () => {
    document.getElementById('pwa-install-banner').classList.add('hidden');
    localStorage.setItem('pwa-dismissed', 'true');
});

// iOS Install Detection
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

if (isIOS && !isStandalone && !localStorage.getItem('pwa-dismissed')) {
    // Show iOS-specific install instructions
    setTimeout(() => {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.querySelector('.pwa-banner-text span').textContent =
                'اضغط على مشاركة ثم "إضافة للشاشة الرئيسية"';
            banner.classList.remove('hidden');
        }
    }, 3000);
}

// ==========================================
// Theme Toggle
// ==========================================
const THEME_SEQUENCE = ['dark', 'diamond', 'light'];
const THEME_META_COLORS = {
    dark: '#0a0a0a',
    diamond: '#0a1220',
    light: '#f5f5f5'
};

function applyTheme(theme) {
    const safeTheme = THEME_SEQUENCE.includes(theme) ? theme : 'dark';
    document.documentElement.setAttribute('data-theme', safeTheme);
    localStorage.setItem('theme', safeTheme);
    updateThemeIcon(safeTheme);
    updateThemeMetaColor(safeTheme);
}

function initTheme() {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const fallback = prefersDark ? 'dark' : 'light';
    const theme = THEME_SEQUENCE.includes(saved) ? saved : fallback;
    applyTheme(theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const index = THEME_SEQUENCE.indexOf(current);
    const next = THEME_SEQUENCE[(index + 1 + THEME_SEQUENCE.length) % THEME_SEQUENCE.length];

    applyTheme(next);
    if (next === 'diamond') {
        showToast('Diamond Theme', 'success');
        return;
    }

    showToast(next === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح', 'success');
}

function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    if (theme === 'dark') {
        icon.className = 'fa-solid fa-moon';
        return;
    }
    if (theme === 'light') {
        icon.className = 'fa-solid fa-sun';
        return;
    }
    icon.className = 'fa-solid fa-gem';
}

function updateThemeMetaColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute('content', THEME_META_COLORS[theme] || THEME_META_COLORS.dark);
    }
}

document.getElementById('theme-toggle')?.addEventListener('click', toggleTheme);

// ==========================================
// Authentication
// ==========================================
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInAnonymously,
    updateProfile
} from './firebase-config.js';

function showAuthScreen() {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('app').classList.add('hidden');
}

function showApp(user) {
    document.getElementById('loading-screen').classList.add('hidden');
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    // Update user avatar
    const photo = document.getElementById('user-photo');
    if (photo) {
        if (user.photoURL) {
            photo.src = user.photoURL;
        } else {
            // Default avatar for email/anonymous users
            photo.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=ffd700&color=000&bold=true`;
        }
    }

    console.log('👤 User:', user.displayName || user.email || 'Anonymous');
}

function showAuthError(message) {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('hidden');
    }
}

function hideAuthError() {
    const errorDiv = document.getElementById('auth-error');
    if (errorDiv) {
        errorDiv.classList.add('hidden');
    }
}

function getFirebaseErrorMessage(code) {
    const messages = {
        'auth/invalid-email': 'البريد الإلكتروني غير صحيح',
        'auth/user-disabled': 'هذا الحساب معطل',
        'auth/user-not-found': 'لا يوجد حساب بهذا البريد',
        'auth/wrong-password': 'كلمة المرور غير صحيحة',
        'auth/email-already-in-use': 'البريد الإلكتروني مستخدم بالفعل',
        'auth/weak-password': 'كلمة المرور ضعيفة (6 أحرف على الأقل)',
        'auth/popup-closed-by-user': 'تم إغلاق نافذة تسجيل الدخول',
        'auth/popup-blocked': 'تم حظر النافذة المنبثقة - فعّل Pop-ups',
        'auth/network-request-failed': 'خطأ في الاتصال بالشبكة',
        'auth/too-many-requests': 'محاولات كثيرة جداً - حاول لاحقاً',
        'auth/operation-not-allowed': 'طريقة تسجيل الدخول هذه غير مفعّلة'
    };
    return messages[code] || 'حدث خطأ في تسجيل الدخول';
}

// Auth Tabs
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;

        // Update tabs
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update forms
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        document.getElementById(`${targetTab}-form`)?.classList.add('active');

        hideAuthError();
    });
});

// Email Login
document.getElementById('email-login-btn')?.addEventListener('click', async () => {
    const email = document.getElementById('login-email')?.value?.trim();
    const password = document.getElementById('login-password')?.value;

    if (!email || !password) {
        showAuthError('الرجاء إدخال البريد وكلمة المرور');
        return;
    }

    try {
        hideAuthError();
        showLoading();
        await signInWithEmailAndPassword(auth, email, password);
        showToast('تم تسجيل الدخول بنجاح', 'success');
    } catch (error) {
        console.error('Email Login Error:', error);
        showAuthError(getFirebaseErrorMessage(error.code));
    } finally {
        hideLoading();
    }
});

// Register
document.getElementById('register-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('register-name')?.value?.trim();
    const email = document.getElementById('register-email')?.value?.trim();
    const password = document.getElementById('register-password')?.value;

    if (!name || !email || !password) {
        showAuthError('الرجاء ملء جميع الحقول');
        return;
    }

    try {
        hideAuthError();
        showLoading();
        const result = await createUserWithEmailAndPassword(auth, email, password);

        // Update profile with name
        await updateProfile(result.user, { displayName: name });

        showToast('تم إنشاء الحساب بنجاح', 'success');
    } catch (error) {
        console.error('Register Error:', error);
        showAuthError(getFirebaseErrorMessage(error.code));
    } finally {
        hideLoading();
    }
});

// Google Login
document.getElementById('google-login-btn')?.addEventListener('click', async () => {
    try {
        hideAuthError();
        showLoading();
        await signInWithPopup(auth, googleProvider);
        showToast('تم تسجيل الدخول بنجاح', 'success');
    } catch (error) {
        console.error('Google Login Error:', error);
        showAuthError(getFirebaseErrorMessage(error.code));
    } finally {
        hideLoading();
    }
});

// Guest Login (Anonymous)
document.getElementById('guest-login-btn')?.addEventListener('click', async () => {
    try {
        hideAuthError();
        showLoading();
        const result = await signInAnonymously(auth);

        // Set a guest name
        await updateProfile(result.user, { displayName: 'زائر' });

        showToast('مرحباً بك كزائر', 'success');
    } catch (error) {
        console.error('Guest Login Error:', error);
        showAuthError(getFirebaseErrorMessage(error.code));
    } finally {
        hideLoading();
    }
});

// Auth State Observer
let authResolved = false;
const AUTH_TIMEOUT_MS = 10000;

onAuthStateChanged(auth, async (user) => {
    authResolved = true;
    if (user) {
        setState({ user });
        showApp(user);
        await initApp();
    } else {
        setState({ user: null });
        showAuthScreen();
    }
});

// Failsafe: if Firebase never responds, show auth screen anyway
setTimeout(() => {
    if (!authResolved) {
        console.warn('⚠️ Firebase auth timeout — showing auth screen');
        document.getElementById('loading-screen')?.classList.add('hidden');
        showAuthScreen();
        showToast('تحقق من اتصالك بالإنترنت', 'error');
    }
}, AUTH_TIMEOUT_MS);

// ==========================================
// Bottom Navigation
// ==========================================
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            navigate(view);

            // Update active state
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// ==========================================
// App Initialization
// ==========================================
async function initApp() {
    console.log('⚡ Initializing App...');

    // Initialize state
    initState();

    // Initialize router
    initRouter();

    // Initialize navigation
    initNavigation();

    // Initialize theme
    initTheme();

    // Load initial view (Dashboard)
    navigate('dashboard');

    console.log('✅ App Initialized Successfully');
}

// ==========================================
// Service Worker Registration
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('📦 Service Worker Registered:', registration.scope);
        } catch (error) {
            console.warn('📦 Service Worker Registration Failed:', error);
        }
    });
}

// ==========================================
// Global Error Handler
// ==========================================
window.addEventListener('error', (event) => {
    console.error('❌ Global Error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('❌ Unhandled Promise:', event.reason);
});

console.log('🚀 Wealth Commander V4 Loaded');

