// ==========================================
// Core Router - SPA Navigation
// ==========================================

let currentView = 'dashboard';
const viewHandlers = {};

/**
 * Register a view handler
 * @param {string} viewName - View name
 * @param {Function} handler - Async function to render the view
 */
export function registerView(viewName, handler) {
    viewHandlers[viewName] = handler;
    console.log(`📍 Registered view: ${viewName}`);
}

/**
 * Navigate to a view
 * @param {string} viewName - Target view name
 */
export async function navigate(viewName) {
    if (!viewName) return;

    console.log(`📍 Navigating to: ${viewName}`);

    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    // Show target view
    const targetView = document.getElementById(`${viewName}-view`);
    if (targetView) {
        targetView.classList.add('active');
    }

    // Update navigation
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.toggle('active', nav.dataset.view === viewName);
    });

    // Execute view handler if registered
    if (viewHandlers[viewName]) {
        try {
            await viewHandlers[viewName]();
        } catch (error) {
            console.error(`❌ Error loading view ${viewName}:`, error);
        }
    }

    currentView = viewName;

    // Update URL hash (for browser back/forward)
    window.location.hash = viewName;
}

/**
 * Get current view name
 */
export function getCurrentView() {
    return currentView;
}

/**
 * Initialize router
 */
export function initRouter() {
    // Handle back/forward navigation
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.replace('#', '') || 'dashboard';
        if (hash !== currentView) {
            navigate(hash);
        }
    });

    // Check initial hash
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && initialHash !== 'dashboard') {
        navigate(initialHash);
    }

    console.log('📍 Router initialized');
}
