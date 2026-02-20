// ==========================================
// Profits Module - Net Profits & Partner Split
// ==========================================

import {
    db, collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, query, where, Timestamp
} from '../firebase-config.js';
import { getUserId } from '../core/auth.js';
import { getState, setState } from '../core/state.js';
import { toEGP, fromEGP } from '../utils/formatters.js';

const COLLECTION = 'profits';
const DISTRIBUTIONS_COLLECTION = 'partner_distributions';
const EPSILON = 0.0001;
const LOCAL_DIST_KEY_PREFIX = 'wc4-partner-distributions';

function getPartnerRatio() {
    const { settings } = getState();
    const ratio = Number(settings?.partnerSplitRatio);
    if (!Number.isFinite(ratio)) return 0.5;
    return Math.min(1, Math.max(0, ratio));
}

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

function isPermissionDenied(error) {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || '').toLowerCase();
    return code.includes('permission-denied') || message.includes('insufficient permissions');
}

function getLocalKey(userId) {
    return `${LOCAL_DIST_KEY_PREFIX}:${userId || 'guest'}`;
}

function loadLocalDistributions(userId) {
    try {
        const raw = localStorage.getItem(getLocalKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed;
    } catch {
        return [];
    }
}

function saveLocalDistributions(userId, rows) {
    try {
        localStorage.setItem(getLocalKey(userId), JSON.stringify(Array.isArray(rows) ? rows : []));
    } catch {
        // ignore storage issues
    }
}

function sortByDateDesc(rows) {
    return [...rows].sort((a, b) => {
        const aTime = toDateObject(a.date)?.getTime() || 0;
        const bTime = toDateObject(b.date)?.getTime() || 0;
        return bTime - aTime;
    });
}

function normalizeDistRecord(record) {
    return {
        id: record.id,
        userId: record.userId,
        amountEGP: toNumber(record.amountEGP),
        appliedEGP: toNumber(record.appliedEGP),
        unappliedEGP: toNumber(record.unappliedEGP),
        affectedRecords: toNumber(record.affectedRecords),
        note: (record.note || '').toString(),
        date: record.date || new Date().toISOString(),
        createdAt: record.createdAt || new Date().toISOString(),
        source: record.source || 'remote'
    };
}

function mergeDistributions(remoteRows, localRows) {
    const map = new Map();
    [...remoteRows, ...localRows].forEach(item => {
        map.set(item.id, item);
    });
    return sortByDateDesc(Array.from(map.values()));
}

function setDistributionsState(rows) {
    setState({ partnerDistributions: sortByDateDesc(rows) });
}

function getExpectedPartnerShareRaw(profit, ratio = getPartnerRatio()) {
    const net = Math.max(0, toNumber(profit?.netProfit));
    return net * ratio;
}

function getLegacyPaidRaw(profit, expectedPartnerShare) {
    if (profit?.distributed) {
        const legacyPartner = toNumber(profit?.partnerSplit, expectedPartnerShare);
        return Math.max(0, legacyPartner);
    }
    return 0;
}

function getPartnerPaidRaw(profit, expectedPartnerShare) {
    const explicitPaid = toNumber(profit?.partnerPaid, NaN);
    if (Number.isFinite(explicitPaid)) {
        return Math.max(0, explicitPaid);
    }
    return getLegacyPaidRaw(profit, expectedPartnerShare);
}

function getShareDetailsRaw(profit, ratio = getPartnerRatio()) {
    const netProfit = toNumber(profit?.netProfit);
    const expectedPartnerShare = getExpectedPartnerShareRaw(profit, ratio);
    const partnerPaid = getPartnerPaidRaw(profit, expectedPartnerShare);
    const partnerPending = Math.max(0, expectedPartnerShare - partnerPaid);
    const myExpectedShare = netProfit - expectedPartnerShare;
    const remainingAfterDistribution = netProfit - partnerPaid;

    return {
        netProfit,
        expectedPartnerShare,
        partnerPaid,
        partnerPending,
        myExpectedShare,
        remainingAfterDistribution
    };
}

/**
 * Profit share details in original record currency
 * @param {Object} profit - Profit record
 */
export function getProfitShareDetails(profit) {
    return getShareDetailsRaw(profit);
}

// ==========================================
// CRUD Operations
// ==========================================

/**
 * Get all profits for current user
 */
export async function getProfits() {
    const userId = getUserId();
    if (!userId) return [];

    try {
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const profits = snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));

        profits.sort((a, b) => {
            const aTime = a.date?.seconds || 0;
            const bTime = b.date?.seconds || 0;
            return bTime - aTime;
        });

        setState({ profits });
        return profits;
    } catch (error) {
        console.error('Error fetching profits:', error);
        throw error;
    }
}

/**
 * Create a new profit record
 * @param {Object} data - Profit data
 */
export async function createProfit(data) {
    const userId = getUserId();
    if (!userId) throw new Error('Not authenticated');

    const ratio = getPartnerRatio();
    const netProfit = parseFloat(data.netProfit) || 0;
    const partnerSplit = Math.max(0, netProfit) * ratio;

    try {
        const profit = {
            userId,
            portfolioId: data.portfolioId,
            ticker: data.ticker || '',
            description: data.description || '',
            grossProfit: parseFloat(data.grossProfit) || 0,
            fees: parseFloat(data.fees) || 0,
            netProfit,
            workingCapital: parseFloat(data.workingCapital) || 0,
            partnerSplit,
            myShare: netProfit - partnerSplit,
            partnerRatioSnapshot: ratio,
            partnerPaid: 0,
            currency: data.currency || 'EGP',
            date: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.now(),
            distributed: false,
            createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, COLLECTION), profit);
        await getProfits();
        return { id: docRef.id, ...profit };
    } catch (error) {
        console.error('Error creating profit:', error);
        throw error;
    }
}

/**
 * Update a profit record
 * @param {string} id - Profit ID
 * @param {Object} data - Updated data
 */
export async function updateProfit(id, data) {
    try {
        const docRef = doc(db, COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        });

        await getProfits();
    } catch (error) {
        console.error('Error updating profit:', error);
        throw error;
    }
}

/**
 * Delete a profit record
 * @param {string} id - Profit ID
 */
export async function deleteProfit(id) {
    try {
        await deleteDoc(doc(db, COLLECTION, id));
        await getProfits();
    } catch (error) {
        console.error('Error deleting profit:', error);
        throw error;
    }
}

/**
 * Mark profit as fully distributed to partner
 * @param {string} id - Profit ID
 */
export async function markAsDistributed(id) {
    const { profits } = getState();
    const profit = profits.find(p => p.id === id);
    if (!profit) throw new Error('Profit not found');

    const details = getShareDetailsRaw(profit);
    await updateProfit(id, {
        partnerPaid: details.partnerPaid + details.partnerPending,
        distributed: true,
        distributedAt: Timestamp.now()
    });
}

/**
 * Get monthly aggregate partner distributions
 */
export async function getPartnerDistributions() {
    const userId = getUserId();
    if (!userId) return [];

    const localRows = loadLocalDistributions(userId).map(normalizeDistRecord);

    try {
        const q = query(
            collection(db, DISTRIBUTIONS_COLLECTION),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const remoteRows = snapshot.docs.map(item => normalizeDistRecord({
            id: item.id,
            ...item.data(),
            source: 'remote'
        }));

        const merged = mergeDistributions(remoteRows, localRows);
        setDistributionsState(merged);
        return merged;
    } catch (error) {
        if (isPermissionDenied(error)) {
            console.warn('Partner distributions read skipped (permission denied). Using local cache only.');
            setDistributionsState(localRows);
            return localRows;
        }
        console.error('Error fetching partner distributions:', error);
        throw error;
    }
}

/**
 * Record actual partner payment (partial or full)
 * @param {string} id - Profit ID
 * @param {number} amount - Paid amount in profit currency
 */
export async function addPartnerDistribution(id, amount) {
    const paidAmount = toNumber(amount);
    if (paidAmount <= 0) throw new Error('Paid amount must be greater than zero');

    const { profits } = getState();
    const profit = profits.find(p => p.id === id);
    if (!profit) throw new Error('Profit not found');

    const details = getShareDetailsRaw(profit);
    if (details.partnerPending <= EPSILON) throw new Error('No pending partner share');

    const nextPaid = Math.min(details.expectedPartnerShare, details.partnerPaid + paidAmount);
    const distributed = (details.expectedPartnerShare - nextPaid) <= EPSILON;

    await updateProfit(id, {
        partnerPaid: nextPaid,
        distributed,
        distributedAt: distributed ? Timestamp.now() : null
    });
}

/**
 * Distribute partner payment once (monthly aggregate)
 * The amount is entered in EGP and applied oldest-to-newest.
 * @param {number} amountEGP - Aggregate paid amount in EGP
 * @param {string|null} distributionDate - Optional date (YYYY-MM-DD)
 * @param {string} note - Optional note
 */
export async function distributePartnerMonthly(amountEGP, distributionDate = null, note = '') {
    const userId = getUserId();
    if (!userId) throw new Error('Not authenticated');

    const budgetEGP = toNumber(amountEGP);
    if (budgetEGP <= 0) throw new Error('Amount must be greater than zero');

    const { profits } = getState();
    if (!profits?.length) throw new Error('No profits found');

    const sorted = [...profits].sort((a, b) => {
        const aTime = a.date?.seconds ? a.date.seconds : new Date(a.date).getTime() / 1000;
        const bTime = b.date?.seconds ? b.date.seconds : new Date(b.date).getTime() / 1000;
        return (aTime || 0) - (bTime || 0);
    });

    let remainingEGP = budgetEGP;
    const updates = [];

    for (const profit of sorted) {
        if (remainingEGP <= EPSILON) break;

        const details = getShareDetailsRaw(profit);
        if (details.partnerPending <= EPSILON) continue;

        const pendingEGP = toEGP(details.partnerPending, profit.currency);
        if (pendingEGP <= EPSILON) continue;

        const payEGP = Math.min(remainingEGP, pendingEGP);
        const payRaw = fromEGP(payEGP, profit.currency);

        let nextPaid = details.partnerPaid + payRaw;
        nextPaid = Math.min(details.expectedPartnerShare, nextPaid);

        const appliedRaw = Math.max(0, nextPaid - details.partnerPaid);
        const appliedEGP = toEGP(appliedRaw, profit.currency);
        if (appliedEGP <= EPSILON) continue;

        const distributed = (details.expectedPartnerShare - nextPaid) <= EPSILON;
        updates.push({
            id: profit.id,
            partnerPaid: nextPaid,
            distributed,
            distributedAt: distributed ? Timestamp.now() : null
        });

        remainingEGP -= appliedEGP;
    }

    if (updates.length === 0) {
        throw new Error('No pending partner share to distribute');
    }

    await Promise.all(updates.map(item => updateDoc(doc(db, COLLECTION, item.id), {
        partnerPaid: item.partnerPaid,
        distributed: item.distributed,
        distributedAt: item.distributedAt,
        updatedAt: Timestamp.now()
    })));

    const appliedEGP = Math.max(0, budgetEGP - Math.max(0, remainingEGP));
    const unappliedEGP = Math.max(0, remainingEGP);

    const recordDate = distributionDate ? new Date(distributionDate) : new Date();
    const recordPayload = {
        userId,
        amountEGP: budgetEGP,
        appliedEGP,
        unappliedEGP,
        affectedRecords: updates.length,
        note: note || '',
        date: recordDate,
        createdAt: new Date()
    };

    let createdRecord = null;
    try {
        const docRef = await addDoc(collection(db, DISTRIBUTIONS_COLLECTION), {
            ...recordPayload,
            date: Timestamp.fromDate(recordDate),
            createdAt: Timestamp.now()
        });
        createdRecord = normalizeDistRecord({ id: docRef.id, ...recordPayload, source: 'remote' });
    } catch (error) {
        if (!isPermissionDenied(error)) {
            throw error;
        }

        const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        createdRecord = normalizeDistRecord({ id: localId, ...recordPayload, source: 'local' });

        const localRows = loadLocalDistributions(userId);
        localRows.unshift(createdRecord);
        saveLocalDistributions(userId, localRows);
    }

    await getProfits();
    const currentDist = await getPartnerDistributions();

    if (createdRecord && !currentDist.some(item => item.id === createdRecord.id)) {
        const merged = sortByDateDesc([createdRecord, ...currentDist]);
        setDistributionsState(merged);
    }

    return {
        amountEGP: budgetEGP,
        appliedEGP,
        unappliedEGP,
        affectedRecords: updates.length,
        recordId: createdRecord?.id || null
    };
}

/**
 * Update a distribution record (date, note, amount)
 * Amount update affects audit row only, not already-applied partnerPaid.
 */
export async function updatePartnerDistributionRecord(id, updates) {
    const userId = getUserId();
    if (!userId) throw new Error('Not authenticated');

    const patch = {
        note: (updates.note || '').toString(),
        amountEGP: toNumber(updates.amountEGP),
        appliedEGP: toNumber(updates.appliedEGP),
        unappliedEGP: toNumber(updates.unappliedEGP),
        affectedRecords: toNumber(updates.affectedRecords),
        date: updates.date ? new Date(updates.date) : new Date()
    };

    const isLocal = String(id).startsWith('local-');

    if (!isLocal) {
        try {
            await updateDoc(doc(db, DISTRIBUTIONS_COLLECTION, id), {
                note: patch.note,
                amountEGP: patch.amountEGP,
                appliedEGP: patch.appliedEGP,
                unappliedEGP: patch.unappliedEGP,
                affectedRecords: patch.affectedRecords,
                date: Timestamp.fromDate(patch.date),
                updatedAt: Timestamp.now()
            });

            await getPartnerDistributions();
            return;
        } catch (error) {
            if (!isPermissionDenied(error)) throw error;
        }
    }

    const rows = loadLocalDistributions(userId).map(normalizeDistRecord);
    const index = rows.findIndex(item => item.id === id);
    if (index < 0) throw new Error('Distribution record not found');

    rows[index] = normalizeDistRecord({
        ...rows[index],
        ...patch,
        date: patch.date,
        source: 'local'
    });

    saveLocalDistributions(userId, rows);
    setDistributionsState(rows);
}

/**
 * Delete one distribution record
 */
export async function deletePartnerDistributionRecord(id) {
    const userId = getUserId();
    if (!userId) throw new Error('Not authenticated');

    const isLocal = String(id).startsWith('local-');

    if (!isLocal) {
        try {
            await deleteDoc(doc(db, DISTRIBUTIONS_COLLECTION, id));
            await getPartnerDistributions();
            return;
        } catch (error) {
            if (!isPermissionDenied(error)) throw error;
        }
    }

    const rows = loadLocalDistributions(userId).map(normalizeDistRecord);
    const next = rows.filter(item => item.id !== id);

    saveLocalDistributions(userId, next);
    setDistributionsState(next);
}

// ==========================================
// Calculations
// ==========================================

/**
 * Calculate total net profits (in EGP)
 */
export function getTotalNetProfits() {
    const { profits } = getState();
    return profits.reduce((sum, p) => sum + toEGP(toNumber(p.netProfit), p.currency), 0);
}

/**
 * Calculate total partner share (in EGP)
 */
export function getTotalPartnerShare() {
    const { profits } = getState();
    return profits.reduce((sum, p) => {
        const details = getShareDetailsRaw(p);
        return sum + toEGP(details.expectedPartnerShare, p.currency);
    }, 0);
}

/**
 * Calculate my total share (in EGP)
 */
export function getMyTotalShare() {
    const { profits } = getState();
    return profits.reduce((sum, p) => {
        const details = getShareDetailsRaw(p);
        return sum + toEGP(details.myExpectedShare, p.currency);
    }, 0);
}

/**
 * Calculate actually distributed amount to partner (in EGP)
 */
export function getTotalDistributedToPartner() {
    const { profits } = getState();
    return profits.reduce((sum, p) => {
        const details = getShareDetailsRaw(p);
        return sum + toEGP(details.partnerPaid, p.currency);
    }, 0);
}

/**
 * Calculate profits remaining after actual partner distributions (in EGP)
 */
export function getRemainingProfitsAfterDistribution() {
    const { profits } = getState();
    return profits.reduce((sum, p) => {
        const details = getShareDetailsRaw(p);
        return sum + toEGP(details.remainingAfterDistribution, p.currency);
    }, 0);
}

/**
 * Calculate pending partner share (not yet distributed) (in EGP)
 */
export function getUndistributedPartnerShare() {
    const { profits } = getState();
    return profits.reduce((sum, p) => {
        const details = getShareDetailsRaw(p);
        return sum + toEGP(details.partnerPending, p.currency);
    }, 0);
}

/**
 * Calculate average ROCE (Return on Capital Employed)
 */
export function getAverageROCE() {
    const { profits } = getState();
    const valid = profits.filter(p => toNumber(p.workingCapital) > 0);
    if (valid.length === 0) return 0;

    const total = valid.reduce((sum, p) => sum + (toNumber(p.netProfit) / toNumber(p.workingCapital) * 100), 0);
    return total / valid.length;
}

/**
 * Calculate profits by month for chart
 */
export function getProfitsByMonth() {
    const { profits } = getState();
    const grouped = {};

    profits.forEach(p => {
        const date = p.date?.toDate ? p.date.toDate() : new Date(p.date);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!grouped[key]) grouped[key] = 0;
        grouped[key] += toEGP(toNumber(p.netProfit), p.currency);
    });

    return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, value }));
}

/**
 * Compare profits with bank benchmark
 * @param {number} months - Number of months
 */
export function compareToBankBenchmark(months) {
    const { settings, profits, portfolios } = getState();
    const safeMonths = Math.max(1, toNumber(months, 1));
    const monthlyRate = settings.bankBenchmark / 100;

    const validCapitals = profits
        .filter(p => toNumber(p.workingCapital) > 0)
        .map(p => toEGP(toNumber(p.workingCapital), p.currency));

    let capitalBase = 0;
    if (validCapitals.length > 0) {
        capitalBase = validCapitals.reduce((sum, c) => sum + c, 0) / validCapitals.length;
    } else {
        capitalBase = portfolios.reduce((sum, p) => {
            const invested = (p.initialCapital || 0) + (p.totalDeposits || 0) - (p.totalWithdrawals || 0);
            return sum + toEGP(invested, p.currency);
        }, 0);
    }

    const bankProfit = capitalBase * monthlyRate * safeMonths;
    const myProfit = getTotalNetProfits();

    return {
        capitalBase,
        months: safeMonths,
        bankProfit,
        myProfit,
        difference: myProfit - bankProfit,
        beatBank: myProfit > bankProfit,
        percentageBetter: bankProfit > 0 ? ((myProfit - bankProfit) / bankProfit * 100) : 0
    };
}

console.log('Profits module loaded');
