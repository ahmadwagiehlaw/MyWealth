// ==========================================
// Core State - Global State Management
// ==========================================

const state = {
    user: null,
    portfolios: [],
    portfolioHistory: [],
    assets: [],
    trades: [],
    profits: [],
    partnerDistributions: [],
    settings: {
        baseCurrency: 'EGP',
        exchangeRates: { USD: 50.5 },
        bankBenchmark: 2.0,
        partnerSplitRatio: 0.5,
        theme: 'dark'
    },
    isLoading: false,
    cache: {}
};

const listeners = new Set();

/**
 * Get current state or a specific key
 * @param {string} key - Optional state key
 */
export function getState(key = null) {
    if (key) {
        return state[key];
    }
    return { ...state };
}

/**
 * Update state and notify listeners
 * @param {Object} updates - State updates
 */
export function setState(updates) {
    Object.assign(state, updates);
    notifyListeners();
}

/**
 * Subscribe to state changes
 * @param {Function} listener - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
    listeners.forEach(listener => listener(state));
}

/**
 * Initialize state from localStorage cache
 */
export function initState() {
    // Load cached settings
    const cachedSettings = localStorage.getItem('wc4-settings');
    if (cachedSettings) {
        try {
            state.settings = { ...state.settings, ...JSON.parse(cachedSettings) };
        } catch (e) {
            console.warn('Failed to load cached settings');
        }
    }

    console.log('📊 State initialized');
}

/**
 * Save settings to localStorage
 */
export function saveSettings() {
    localStorage.setItem('wc4-settings', JSON.stringify(state.settings));
}

/**
 * Update a specific setting
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 */
export function updateSetting(key, value) {
    state.settings[key] = value;
    saveSettings();
    notifyListeners();
}

/**
 * Get a formatted value in base currency
 * @param {number} amount - Amount
 * @param {string} currency - Original currency
 */
export function toBaseCurrency(amount, currency = 'EGP') {
    if (currency === state.settings.baseCurrency) {
        return amount;
    }

    const rate = state.settings.exchangeRates[currency] || 1;
    return amount * rate;
}
