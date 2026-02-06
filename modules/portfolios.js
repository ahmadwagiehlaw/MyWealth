// ==========================================
// Portfolios Module - Multi-Currency Vaults
// ==========================================

import {
    db, collection, doc, addDoc, updateDoc, deleteDoc,
    getDocs, getDoc, query, where, orderBy, Timestamp
} from '../firebase-config.js';
import { getUserId } from '../core/auth.js';
import { getState, setState } from '../core/state.js';
import { toEGP } from '../utils/formatters.js';

const COLLECTION = 'portfolios';

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
        // Simple query without orderBy to avoid needing composite index
        const q = query(
            collection(db, COLLECTION),
            where('userId', '==', userId)
        );

        const snapshot = await getDocs(q);
        const portfolios = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort in JS instead of Firestore
        portfolios.sort((a, b) => {
            const aTime = a.createdAt?.seconds || 0;
            const bTime = b.createdAt?.seconds || 0;
            return bTime - aTime;
        });

        setState({ portfolios });
        return portfolios;
    } catch (error) {
        console.error('❌ Error fetching portfolios:', error);
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
        console.error('❌ Error fetching portfolio:', error);
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
        const portfolio = {
            userId,
            name: data.name,
            currency: data.currency || 'EGP',
            type: data.type || 'BROKERAGE', // BROKERAGE | FUND | BANK
            initialCapital: parseFloat(data.initialCapital) || 0,
            totalDeposits: 0,
            totalWithdrawals: 0,
            currentValue: parseFloat(data.initialCapital) || 0,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now()
        };

        const docRef = await addDoc(collection(db, COLLECTION), portfolio);
        console.log('✅ Portfolio created:', docRef.id);

        // Refresh portfolios list
        await getPortfolios();

        return { id: docRef.id, ...portfolio };
    } catch (error) {
        console.error('❌ Error creating portfolio:', error);
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
        const docRef = doc(db, COLLECTION, id);
        await updateDoc(docRef, {
            ...data,
            updatedAt: Timestamp.now()
        });

        console.log('✅ Portfolio updated:', id);
        await getPortfolios();
    } catch (error) {
        console.error('❌ Error updating portfolio:', error);
        throw error;
    }
}

/**
 * Delete a portfolio
 * @param {string} id - Portfolio ID
 */
export async function deletePortfolio(id) {
    try {
        await deleteDoc(doc(db, COLLECTION, id));
        console.log('✅ Portfolio deleted:', id);
        await getPortfolios();
    } catch (error) {
        console.error('❌ Error deleting portfolio:', error);
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
    return portfolios.reduce((sum, p) => sum + toEGP(p.currentValue, p.currency), 0);
}

/**
 * Calculate total invested capital across all portfolios (in EGP)
 */
export function getTotalInvestedCapital() {
    const { portfolios } = getState();
    return portfolios.reduce((sum, p) => {
        const invested = (p.initialCapital || 0) + (p.totalDeposits || 0) - (p.totalWithdrawals || 0);
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
    return portfolios.map(p => ({
        name: p.name,
        value: toEGP(p.currentValue, p.currency),
        currency: p.currency,
        type: p.type
    }));
}

console.log('📦 Portfolios module loaded');
