// ==========================================
// Profits Module - Net Profits & Partner Split
// ==========================================

import {
    db, collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, query, where, orderBy, Timestamp
} from '../firebase-config.js';
import { getUserId } from '../core/auth.js';
import { getState, setState } from '../core/state.js';
import { toEGP } from '../utils/formatters.js';

const COLLECTION = 'profits';

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
        // Simple query without orderBy to avoid needing composite index
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const profits = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort in JS instead of Firestore
        profits.sort((a, b) => {
            const aTime = a.date?.seconds || 0;
            const bTime = b.date?.seconds || 0;
            return bTime - aTime;
        });

        setState({ profits });
        return profits;
    } catch (error) {
        console.error('❌ Error fetching profits:', error);
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

    const { settings } = getState();
    const partnerSplit = (parseFloat(data.netProfit) || 0) * settings.partnerSplitRatio;

    try {
        const profit = {
            userId,
            portfolioId: data.portfolioId,
            ticker: data.ticker || '',
            description: data.description || '',
            grossProfit: parseFloat(data.grossProfit) || 0,
            fees: parseFloat(data.fees) || 0,
            netProfit: parseFloat(data.netProfit) || 0,
            workingCapital: parseFloat(data.workingCapital) || 0,
            partnerSplit: partnerSplit,
            myShare: (parseFloat(data.netProfit) || 0) - partnerSplit,
            currency: data.currency || 'EGP',
            date: data.date ? Timestamp.fromDate(new Date(data.date)) : Timestamp.now(),
            distributed: false,
            createdAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, COLLECTION), profit);
        console.log('✅ Profit recorded:', docRef.id);

        await getProfits();
        return { id: docRef.id, ...profit };
    } catch (error) {
        console.error('❌ Error creating profit:', error);
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

        console.log('✅ Profit updated:', id);
        await getProfits();
    } catch (error) {
        console.error('❌ Error updating profit:', error);
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
        console.log('✅ Profit deleted:', id);
        await getProfits();
    } catch (error) {
        console.error('❌ Error deleting profit:', error);
        throw error;
    }
}

/**
 * Mark profit as distributed to partner
 * @param {string} id - Profit ID
 */
export async function markAsDistributed(id) {
    await updateProfit(id, { distributed: true, distributedAt: Timestamp.now() });
}

// ==========================================
// Calculations
// ==========================================

/**
 * Calculate total net profits (in EGP)
 */
export function getTotalNetProfits() {
    const { profits } = getState();
    return profits.reduce((sum, p) => sum + toEGP(p.netProfit, p.currency), 0);
}

/**
 * Calculate total partner share (in EGP)
 */
export function getTotalPartnerShare() {
    const { profits } = getState();
    return profits.reduce((sum, p) => sum + toEGP(p.partnerSplit, p.currency), 0);
}

/**
 * Calculate my total share (in EGP)
 */
export function getMyTotalShare() {
    const { profits } = getState();
    return profits.reduce((sum, p) => sum + toEGP(p.myShare, p.currency), 0);
}

/**
 * Calculate undistributed partner share (in EGP)
 */
export function getUndistributedPartnerShare() {
    const { profits } = getState();
    return profits
        .filter(p => !p.distributed)
        .reduce((sum, p) => sum + toEGP(p.partnerSplit, p.currency), 0);
}

/**
 * Calculate average ROCE (Return on Capital Employed)
 */
export function getAverageROCE() {
    const { profits } = getState();
    const validProfits = profits.filter(p => p.workingCapital > 0);

    if (validProfits.length === 0) return 0;

    const totalROCE = validProfits.reduce((sum, p) => {
        return sum + (p.netProfit / p.workingCapital * 100);
    }, 0);

    return totalROCE / validProfits.length;
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
        grouped[key] += toEGP(p.netProfit, p.currency);
    });

    return Object.entries(grouped)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, value }));
}

/**
 * Compare profits with bank benchmark
 * @param {number} capital - Capital amount
 * @param {number} months - Number of months
 */
export function compareToBankBenchmark(capital, months) {
    const { settings } = getState();
    const monthlyRate = settings.bankBenchmark / 100;
    const bankProfit = capital * monthlyRate * months;
    const myProfit = getTotalNetProfits();

    return {
        bankProfit,
        myProfit,
        difference: myProfit - bankProfit,
        beatBank: myProfit > bankProfit,
        percentageBetter: bankProfit > 0 ? ((myProfit - bankProfit) / bankProfit * 100) : 0
    };
}

console.log('💰 Profits module loaded');
