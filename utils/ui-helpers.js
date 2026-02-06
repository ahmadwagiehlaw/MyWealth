// ==========================================
// UI Helpers - Toast, Loading, Modals
// ==========================================

let loadingCount = 0;

// ==========================================
// Toast Notifications
// ==========================================

/**
 * Show a toast notification
 * @param {string} message - Toast message
 * @param {string} type - 'success' | 'error' | 'info'
 * @param {number} duration - Duration in ms
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icon = type === 'success' ? 'fa-check-circle'
        : type === 'error' ? 'fa-exclamation-circle'
            : 'fa-info-circle';

    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ==========================================
// Loading Overlay
// ==========================================

/**
 * Show loading overlay
 */
export function showLoading() {
    loadingCount++;

    let overlay = document.getElementById('loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
            </div>
        `;

        // Add styles if not already present
        if (!document.getElementById('loading-overlay-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-overlay-styles';
            style.textContent = `
                .loading-overlay {
                    position: fixed;
                    inset: 0;
                    z-index: 9999;
                    background: rgba(0, 0, 0, 0.5);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    backdrop-filter: blur(4px);
                }
                .loading-spinner-container {
                    width: 60px;
                    height: 60px;
                    background: var(--bg-card);
                    border-radius: var(--radius-lg);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: var(--shadow-lg);
                }
                @keyframes toastOut {
                    to { opacity: 0; transform: translateY(20px); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);
    }

    overlay.style.display = 'flex';
}

/**
 * Hide loading overlay
 */
export function hideLoading() {
    loadingCount = Math.max(0, loadingCount - 1);

    if (loadingCount === 0) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
}

// ==========================================
// Modal System
// ==========================================

/**
 * Open a modal
 * @param {string} title - Modal title
 * @param {string} content - Modal HTML content
 * @param {Object} options - Modal options
 */
export function openModal(title, content, options = {}) {
    closeModal(); // Close any existing modal

    const modal = document.createElement('div');
    modal.id = 'modal-overlay';
    modal.className = 'modal-overlay';

    modal.innerHTML = `
        <div class="modal-container">
            <div class="modal-header">
                <h3 class="modal-title">${title}</h3>
                <button class="btn-icon modal-close" onclick="closeModal()">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <div class="modal-content">
                ${content}
            </div>
            ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
        </div>
    `;

    // Add modal styles if not present
    if (!document.getElementById('modal-styles')) {
        const style = document.createElement('style');
        style.id = 'modal-styles';
        style.textContent = `
            .modal-overlay {
                position: fixed;
                inset: 0;
                z-index: 9998;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: var(--space-md);
                animation: fadeIn 0.2s ease;
            }
            .modal-container {
                background: var(--bg-secondary);
                border-radius: var(--radius-lg);
                width: 100%;
                max-width: 500px;
                max-height: 90vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                box-shadow: var(--shadow-lg);
                animation: modalIn 0.3s ease;
            }
            @keyframes modalIn {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
            }
            .modal-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: var(--space-lg);
                border-bottom: 1px solid var(--border-color);
            }
            .modal-title {
                font-size: var(--font-size-lg);
                font-weight: 700;
                color: var(--text-primary);
            }
            .modal-content {
                padding: var(--space-lg);
                overflow-y: auto;
                flex: 1;
            }
            .modal-footer {
                padding: var(--space-lg);
                border-top: 1px solid var(--border-color);
                display: flex;
                gap: var(--space-sm);
                justify-content: flex-end;
            }
            .form-group {
                margin-bottom: var(--space-md);
            }
            .form-label {
                display: block;
                font-size: var(--font-size-sm);
                font-weight: 600;
                color: var(--text-secondary);
                margin-bottom: var(--space-xs);
            }
            .form-input {
                width: 100%;
                padding: var(--space-sm) var(--space-md);
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                color: var(--text-primary);
                font-family: inherit;
                font-size: var(--font-size-md);
                transition: border-color var(--transition-fast);
            }
            .form-input:focus {
                outline: none;
                border-color: var(--gold);
            }
            .form-input::placeholder {
                color: var(--text-muted);
            }
            .form-select {
                width: 100%;
                padding: var(--space-sm) var(--space-md);
                background: var(--bg-card);
                border: 1px solid var(--border-color);
                border-radius: var(--radius-sm);
                color: var(--text-primary);
                font-family: inherit;
                font-size: var(--font-size-md);
                cursor: pointer;
            }
            .form-row {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--space-md);
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(modal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Close on escape
    document.addEventListener('keydown', handleEscape);
}

function handleEscape(e) {
    if (e.key === 'Escape') closeModal();
}

/**
 * Close the current modal
 */
export function closeModal() {
    const modal = document.getElementById('modal-overlay');
    if (modal) {
        modal.remove();
    }
    document.removeEventListener('keydown', handleEscape);
}

// Make closeModal globally available
window.closeModal = closeModal;

// ==========================================
// Confirmation Dialog
// ==========================================

/**
 * Show a confirmation dialog
 * @param {string} message - Confirmation message
 * @returns {Promise<boolean>}
 */
export function confirm(message) {
    return new Promise((resolve) => {
        const content = `
            <p style="text-align: center; color: var(--text-secondary); margin-bottom: var(--space-lg);">
                ${message}
            </p>
            <div style="display: flex; gap: var(--space-md); justify-content: center;">
                <button class="btn" style="background: var(--bg-card); color: var(--text-primary);" onclick="window.__confirmResolve(false)">
                    إلغاء
                </button>
                <button class="btn btn-primary" onclick="window.__confirmResolve(true)">
                    تأكيد
                </button>
            </div>
        `;

        openModal('تأكيد', content);

        window.__confirmResolve = (result) => {
            closeModal();
            resolve(result);
        };
    });
}

console.log('🎨 UI Helpers loaded');
