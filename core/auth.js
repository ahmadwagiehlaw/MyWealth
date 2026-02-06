// ==========================================
// Core Auth - Firebase Authentication
// ==========================================

import { auth, onAuthStateChanged, signInWithPopup, googleProvider, signOut } from '../firebase-config.js';
import { setState } from './state.js';

let currentUser = null;

/**
 * Get current authenticated user
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Get user ID for Firestore paths
 */
export function getUserId() {
    // Use auth.currentUser directly to always get the latest state
    return auth.currentUser?.uid || currentUser?.uid || null;
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        currentUser = result.user;
        setState({ user: currentUser });
        return currentUser;
    } catch (error) {
        console.error('❌ Sign In Error:', error);
        throw error;
    }
}

/**
 * Sign out
 */
export async function logOut() {
    try {
        await signOut(auth);
        currentUser = null;
        setState({ user: null });
    } catch (error) {
        console.error('❌ Sign Out Error:', error);
        throw error;
    }
}

/**
 * Subscribe to auth state changes
 * @param {Function} callback - Callback with user or null
 */
export function onAuthChange(callback) {
    return onAuthStateChanged(auth, (user) => {
        currentUser = user;
        callback(user);
    });
}

console.log('🔐 Auth module loaded');
