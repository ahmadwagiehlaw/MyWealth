// ==========================================
// Formatters - Currency, Date, Numbers
// ==========================================

import { getState } from '../core/state.js';

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (EGP, USD)
 * @param {boolean} showSign - Show + for positive
 */
export function formatCurrency(amount, currency = 'EGP', showSign = false) {
    const formatted = new Intl.NumberFormat('ar-EG', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(Math.abs(amount));

    const sign = showSign && amount > 0 ? '+' : (amount < 0 ? '-' : '');
    const currencySymbol = currency === 'USD' ? '$' : 'ج.م';

    return `${sign}${formatted} ${currencySymbol}`;
}

/**
 * Format large numbers with K/M suffix
 * @param {number} num - Number to format
 */
export function formatCompact(num) {
    if (Math.abs(num) >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (Math.abs(num) >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toFixed(0);
}

/**
 * Format percentage
 * @param {number} value - Percentage value
 * @param {boolean} showSign - Show + for positive
 */
export function formatPercent(value, showSign = true) {
    const sign = showSign && value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
}

/**
 * Format date
 * @param {Date|string|number} date - Date to format
 * @param {string} format - 'short' | 'long' | 'relative'
 */
export function formatDate(date, format = 'short') {
    const d = new Date(date);

    if (format === 'relative') {
        return formatRelativeDate(d);
    }

    const options = format === 'long'
        ? { year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };

    return d.toLocaleDateString('ar-EG', options);
}

/**
 * Format relative date (e.g., "منذ 3 أيام")
 * @param {Date} date - Date to format
 */
function formatRelativeDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'اليوم';
    if (days === 1) return 'أمس';
    if (days < 7) return `منذ ${days} أيام`;
    if (days < 30) return `منذ ${Math.floor(days / 7)} أسابيع`;
    if (days < 365) return `منذ ${Math.floor(days / 30)} أشهر`;
    return `منذ ${Math.floor(days / 365)} سنوات`;
}

/**
 * Convert amount to base currency (EGP)
 * @param {number} amount - Amount
 * @param {string} fromCurrency - Source currency
 */
export function toEGP(amount, fromCurrency = 'EGP') {
    if (fromCurrency === 'EGP') return amount;

    const { settings } = getState();
    const rate = settings.exchangeRates[fromCurrency] || 1;
    return amount * rate;
}

/**
 * Convert amount from base currency
 * @param {number} egpAmount - Amount in EGP
 * @param {string} toCurrency - Target currency
 */
export function fromEGP(egpAmount, toCurrency = 'EGP') {
    if (toCurrency === 'EGP') return egpAmount;

    const { settings } = getState();
    const rate = settings.exchangeRates[toCurrency] || 1;
    return egpAmount / rate;
}

/**
 * Get color class based on value
 * @param {number} value - Value to check
 */
export function getValueColor(value) {
    if (value > 0) return 'text-green';
    if (value < 0) return 'text-red';
    return 'text-muted';
}

/**
 * Get color hex based on value
 * @param {number} value - Value to check
 */
export function getValueColorHex(value) {
    if (value > 0) return '#10b981';
    if (value < 0) return '#ef4444';
    return '#888888';
}

console.log('📐 Formatters loaded');
