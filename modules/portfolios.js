// ==========================================
// Portfolios Module - Multi-Currency Vaults
// ==========================================

import {
    db, collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, getDoc, query, where, Timestamp
} from '../firebase-config.js';
import { getUserId } from '../core/auth.js';
import { getState, setState } from '../core/state.js';
import { toEGP } from '../utils/formatters.js';

const COLLECTION = 'portfolios';
const HISTORY_COLLECTION = 'portfolio_history';
const EPSILON = 0.0001;

function toNumber(value, fallback = 0) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
}

function toDateObject(value) {
    if (!value) return null;
    if (value?.toDate) return value.toDate();

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toTimestamp(value = null) {
    const date = value ? toDateObject(value) : null;
    return date ? Timestamp.fromDate(date) : Timestamp.now();
}

function isPermissionDenied(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return code.includes('permission-denied') || message.includes('insufficient permissions');
}

async function recordPortfolioHistory({ userId, portfolioId, value, currency = 'EGP', date = null, source = 'manual' }) {
    const numericValue = toNumber(value, NaN);
    if (!userId || !portfolioId || !Number.isFinite(numericValue)) return;

    await addDoc(collection(db, HISTORY_COLLECTION), {
        userId,
        portfolioId,
        value: numericValue,
        currency: currency || 'EGP',
        source,
        date: toTimestamp(date),
        createdAt: Timestamp.now()
    });
}

async function tryRecordPortfolioHistory(payload) {
    try {
        await recordPortfolioHistory(payload);
    } catch (error) {
        if (isPermissionDenied(error)) {
            console.warn('Portfolio history write skipped (permission denied).');
            return;
        }
        throw error;
    }
}

// ==========================================
// CRUD Operations
// ==========================================

/**
 * Get all portfolios for current user
 */
export async function getPortfolios() {
    const userId = getUserId();
    if (!userId) return [];

    try {
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const portfolios = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        portfolios.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
        });

        setState({ portfolios });
        return portfolios;
    } catch (error) {
        console.error('Error fetching portfolios:', error);
        throw error;
    }
}

/**
 * Get all portfolio history records for current user
 */
export async function getPortfolioHistory() {
    const userId = getUserId();
    if (!userId) return [];

    try {
        const q = query(
            collection(db, HISTORY_COLLECTION),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const history = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        history.sort((a, b) => {
            const aTime = toDateObject(a.date)?.getTime() || 0;
            const bTime = toDateObject(b.date)?.getTime() || 0;
            return aTime - bTime;
        });

        setState({ portfolioHistory: history });
        return history;
    } catch (error) {
        if (isPermissionDenied(error)) {
            console.warn('Portfolio history read skipped (permission denied).');
            setState({ portfolioHistory: [] });
            return [];
        }
        console.error('Error fetching portfolio history:', error);
        throw error;
    }
}

/**
 * Get single portfolio by ID
 * @param {string} id - Portfolio ID
 */
export async function getPortfolio(id) {
    try {
        const docRef = doc(db, COLLECTION, id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        throw error;
    }
}

/**
 * Create a new portfolio
 * @param {Object} data - Portfolio data
 */
export async function createPortfolio(data) {
    const userId = getUserId();
    if (!userId) throw new Error('Not authenticated');

    try {
        const initialCapital = parseFloat(data.initialCapital) || 0;
        const now = Timestamp.now();

        const portfolio = {
            userId,
            name: data.name,
            currency: data.currency || 'EGP',
            type: data.type || 'BROKERAGE',
            initialCapital,
            totalDeposits: 0,
            totalWithdrawals: 0,
            currentValue: initialCapital,
            excludeFromTotal: data.excludeFromTotal || false,
            createdAt: now,
            updatedAt: now
        };

        const docRef = await addDoc(collection(db, COLLECTION), portfolio);

        await tryRecordPortfolioHistory({
            userId,
            portfolioId: docRef.id,
            value: initialCapital,
            currency: portfolio.currency,
            date: now,
            source: 'create'
        });

        await Promise.all([getPortfolios(), getPortfolioHistory()]);
        return { id: docRef.id, ...portfolio };
    } catch (error) {
        console.error('Error creating portfolio:', error);
        throw error;
    }
}

/**
 * Update a portfolio
 * @param {string} id - Portfolio ID
 * @param {Object} data - Updated data
 */
export async function updatePortfolio(id, data) {
    try {
        const userId = getUserId();
        const now = Timestamp.now();
        const docRef = doc(db, COLLECTION, id);

        // Extract snapshotDate so it doesn't persist to the portfolio document
        const { snapshotDate, ...docData } = data;

        await updateDoc(docRef, {
            ...docData,
            updatedAt: now
        });

        const nextValue = toNumber(data?.currentValue, NaN);
        if (userId && Number.isFinite(nextValue)) {
            const { portfolios } = getState();
            const existing = portfolios.find(p => p.id === id);

            await tryRecordPortfolioHistory({
                userId,
                portfolioId: id,
                value: nextValue,
                currency: data.currency || existing?.currency || 'EGP',
                date: snapshotDate || now,
                source: 'update'
            });
        }

        await Promise.all([getPortfolios(), getPortfolioHistory()]);
    } catch (error) {
        console.error('Error updating portfolio:', error);
        throw error;
    }
}

/**
 * Delete a portfolio
 * @param {string} id - Portfolio ID
 */
export async function deletePortfolio(id) {
    try {
        const userId = getUserId();

        await deleteDoc(doc(db, COLLECTION, id));

        if (userId) {
            try {
                const q = query(
                    collection(db, HISTORY_COLLECTION),
                    where('userId', '==', userId)
                );
                const snapshot = await getDocs(q);

                const deletions = snapshot.docs
                    .filter(item => item.data()?.portfolioId === id)
                    .map(item => deleteDoc(doc(db, HISTORY_COLLECTION, item.id)));

                if (deletions.length > 0) {
                    await Promise.all(deletions);
                }
            } catch (error) {
                if (!isPermissionDenied(error)) {
                    throw error;
                }
                console.warn('Portfolio history cleanup skipped (permission denied).');
            }
        }

        await Promise.all([getPortfolios(), getPortfolioHistory()]);
    } catch (error) {
        console.error('Error deleting portfolio:', error);
        throw error;
    }
}

// ==========================================
// Calculations
// ==========================================

/**
 * Calculate total market value across all portfolios (in EGP)
 */
export function getTotalMarketValue() {
    const { portfolios } = getState();
    return portfolios
        .filter(p => !p.excludeFromTotal)
        .reduce((sum, p) => sum + toEGP(toNumber(p.currentValue), p.currency), 0);
}

/**
 * Calculate total invested capital across all portfolios (in EGP)
 */
export function getTotalInvestedCapital() {
    const { portfolios } = getState();
    return portfolios
        .filter(p => !p.excludeFromTotal)
        .reduce((sum, p) => {
            const invested = toNumber(p.initialCapital) + toNumber(p.totalDeposits) - toNumber(p.totalWithdrawals);
            return sum + toEGP(invested, p.currency);
        }, 0);
}

/**
 * Calculate unrealized P&L across all portfolios
 */
export function getUnrealizedPL() {
    return getTotalMarketValue() - getTotalInvestedCapital();
}

/**
 * Get portfolio distribution for pie chart
 */
export function getPortfolioDistribution() {
    const { portfolios } = getState();
    return portfolios
        .filter(p => !p.excludeFromTotal)
        .map(p => ({
            name: p.name,
            value: toEGP(toNumber(p.currentValue), p.currency),
            currency: p.currency,
            type: p.type
        }));
}

function getRangeStart(date, range) {
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

function getRangeKey(startDate, range) {
    if (range === 'week') {
        return `week-${startDate.getFullYear()}-${startDate.getMonth()}-${startDate.getDate()}`;
    }
    if (range === 'year') {
        return `year-${startDate.getFullYear()}`;
    }
    return `month-${startDate.getFullYear()}-${startDate.getMonth()}`;
}

function getRangeLabel(startDate, range) {
    if (range === 'week') {
        return `أسبوع ${startDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}`;
    }
    if (range === 'year') {
        return startDate.getFullYear().toString();
    }
    return startDate.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
}

function buildChanges(points) {
    return points.map((point, index) => {
        if (index === 0) return { ...point, changePct: null };

        const prev = points[index - 1].value;
        if (Math.abs(prev) <= EPSILON) {
            return { ...point, changePct: null };
        }

        return {
            ...point,
            changePct: ((point.value - prev) / Math.abs(prev)) * 100
        };
    });
}

function getEffectiveHistory(portfolioId = null) {
    const { portfolios, portfolioHistory } = getState();
    const history = Array.isArray(portfolioHistory) ? [...portfolioHistory] : [];
    const existingPortfolioIds = new Set(history.map(h => h.portfolioId));
    const now = Timestamp.now();

    // Backward compatibility for users with old data before history tracking.
    portfolios.forEach(p => {
        if (!existingPortfolioIds.has(p.id)) {
            history.push({
                id: `synthetic-${p.id}`,
                portfolioId: p.id,
                value: toNumber(p.currentValue),
                currency: p.currency || 'EGP',
                date: now
            });
        }
    });

    const filtered = portfolioId ? history.filter(h => h.portfolioId === portfolioId) : history;

    return filtered
        .map(h => ({
            ...h,
            ts: toDateObject(h.date)?.getTime() || 0,
            egpValue: toEGP(toNumber(h.value), h.currency || 'EGP')
        }))
        .filter(h => h.ts > 0)
        .sort((a, b) => a.ts - b.ts);
}

function buildSeriesFromHistory(range = 'month', portfolioId = null) {
    const history = getEffectiveHistory(portfolioId);
    if (history.length === 0) return [];

    if (portfolioId) {
        const grouped = new Map();

        history.forEach(point => {
            const startDate = getRangeStart(point.ts, range);
            const key = getRangeKey(startDate, range);
            const current = grouped.get(key);

            if (!current || point.ts >= current.ts) {
                grouped.set(key, {
                    start: startDate.getTime(),
                    label: getRangeLabel(startDate, range),
                    ts: point.ts,
                    value: point.egpValue
                });
            }
        });

        const points = Array.from(grouped.values())
            .sort((a, b) => a.start - b.start)
            .map(({ start, label, value }) => ({ start, label, value }));

        const maxPoints = range === 'week' ? 18 : (range === 'month' ? 24 : 12);
        const sliced = points.length > maxPoints ? points.slice(-maxPoints) : points;
        return buildChanges(sliced);
    }

    const events = history
        .map(point => ({
            ts: point.ts,
            portfolioId: point.portfolioId,
            value: point.egpValue
        }))
        .sort((a, b) => a.ts - b.ts);

    const timelineMap = new Map();
    const latestByPortfolio = new Map();

    events.forEach(event => {
        latestByPortfolio.set(event.portfolioId, event.value);

        const total = Array.from(latestByPortfolio.values()).reduce((sum, v) => sum + v, 0);
        const startDate = getRangeStart(event.ts, range);
        const key = getRangeKey(startDate, range);
        const current = timelineMap.get(key);

        if (!current || event.ts >= current.ts) {
            timelineMap.set(key, {
                start: startDate.getTime(),
                label: getRangeLabel(startDate, range),
                ts: event.ts,
                value: total
            });
        }
    });

    const points = Array.from(timelineMap.values())
        .sort((a, b) => a.start - b.start)
        .map(({ start, label, value }) => ({ start, label, value }));

    const maxPoints = range === 'week' ? 18 : (range === 'month' ? 24 : 12);
    const sliced = points.length > maxPoints ? points.slice(-maxPoints) : points;

    return buildChanges(sliced);
}

/**
 * Get EGP-value evolution series for all portfolios
 * @param {'week'|'month'|'year'} range
 */
export function getTotalPortfolioEvolutionSeries(range = 'month') {
    return buildSeriesFromHistory(range, null);
}

/**
 * Get EGP-value evolution series for one portfolio
 * @param {string} portfolioId
 * @param {'week'|'month'|'year'} range
 */
export function getPortfolioEvolutionSeries(portfolioId, range = 'month') {
    if (!portfolioId) return [];
    return buildSeriesFromHistory(range, portfolioId);
}

console.log('Portfolios module loaded');
