/**
 * Centralized Authentication Service
 * 
 * Industry-standard token management with:
 * - Automatic token refresh before expiration
 * - Thread-safe refresh mechanism (prevents concurrent refreshes)
 * - Consistent token handling across the app
 * - Proper error handling and logout flow
 */

import * as SecureStore from 'expo-secure-store';
import axios from 'axios';

// Hosted API base
const API_BASE = 'http://165.232.182.130';

// Token keys in secure storage
const TOKEN_KEYS = {
  ACCESS: 'access_token',
  REFRESH: 'refresh_token',
  USER: 'user_data',
};

// Refresh lock to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];

/**
 * Subscribe to token refresh completion
 */
const subscribeToRefresh = (callback) => {
  refreshSubscribers.push(callback);
};

/**
 * Notify all subscribers when refresh completes
 */
const notifyRefreshComplete = (newToken) => {
  refreshSubscribers.forEach((callback) => callback(newToken));
  refreshSubscribers = [];
};

/**
 * Notify all subscribers when refresh fails
 */
const notifyRefreshFailed = (error) => {
  refreshSubscribers.forEach((callback) => callback(null, error));
  refreshSubscribers = [];
};

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN STORAGE OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get access token from secure storage
 */
export async function getAccessToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEYS.ACCESS);
  } catch (e) {
    console.warn('[AuthService] Failed to get access token:', e.message);
    return null;
  }
}

/**
 * Get refresh token from secure storage
 */
export async function getRefreshToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEYS.REFRESH);
  } catch (e) {
    console.warn('[AuthService] Failed to get refresh token:', e.message);
    return null;
  }
}

/**
 * Save tokens to secure storage
 */
export async function saveTokens({ access_token, refresh_token }) {
  try {
    if (access_token && typeof access_token === 'string') {
      await SecureStore.setItemAsync(TOKEN_KEYS.ACCESS, access_token);
    }
    if (refresh_token && typeof refresh_token === 'string') {
      await SecureStore.setItemAsync(TOKEN_KEYS.REFRESH, refresh_token);
    }
    if (__DEV__) {
      console.log('[AuthService] Tokens saved successfully');
    }
    return true;
  } catch (e) {
    console.error('[AuthService] Failed to save tokens:', e.message);
    return false;
  }
}

/**
 * Clear all auth tokens from storage
 */
export async function clearTokens() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEYS.ACCESS);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.REFRESH);
    await SecureStore.deleteItemAsync(TOKEN_KEYS.USER);
    if (__DEV__) {
      console.log('[AuthService] Tokens cleared');
    }
    return true;
  } catch (e) {
    console.error('[AuthService] Failed to clear tokens:', e.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN REFRESH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Refresh the access token using the refresh token
 * Thread-safe: prevents concurrent refresh attempts
 */
export async function refreshAccessToken() {
  // If already refreshing, wait for it to complete
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      subscribeToRefresh((newToken, error) => {
        if (error) reject(error);
        else resolve(newToken);
      });
    });
  }

  isRefreshing = true;

  try {
    const refreshToken = await getRefreshToken();
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    if (__DEV__) {
      console.log('[AuthService] Attempting token refresh...');
    }

    const response = await axios.post(
      `${API_BASE}/api/v1/auth/refresh`,
      { refresh_token: refreshToken },
      { timeout: 10000 }
    );

    const { access_token, refresh_token: newRefreshToken } = response.data || {};

    if (!access_token) {
      throw new Error('No access token in refresh response');
    }

    // Save new tokens
    await saveTokens({
      access_token,
      refresh_token: newRefreshToken || refreshToken,
    });

    if (__DEV__) {
      console.log('[AuthService] Token refresh successful');
    }

    notifyRefreshComplete(access_token);
    return access_token;

  } catch (error) {
    if (__DEV__) {
      console.error('[AuthService] Token refresh failed:', error.message);
    }
    notifyRefreshFailed(error);
    throw error;

  } finally {
    isRefreshing = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API REQUEST WITH AUTH
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Make an authenticated API request with automatic token refresh
 * 
 * @param {Function} requestFn - The API request function to execute
 * @param {Object} options - Options
 * @param {boolean} options.retry - Whether to retry on 401 (default: true)
 * @returns {Promise} - The API response
 */
export async function withAuth(requestFn, options = {}) {
  const { retry = true } = options;
  
  try {
    return await requestFn();
  } catch (error) {
    // If 401 and retry enabled, try refreshing token
    if (error.response?.status === 401 && retry) {
      try {
        await refreshAccessToken();
        // Retry the original request (without retry flag to prevent infinite loop)
        return await withAuth(requestFn, { retry: false });
      } catch (refreshError) {
        // Refresh failed - throw original error
        throw error;
      }
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROLE SWITCHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Switch user role and update tokens
 * This is a centralized handler for role switching that ensures tokens are properly saved
 * 
 * @param {string} role - The role to switch to ('customer' or 'business')
 * @param {Object} authStore - The auth store instance (for updating user state)
 * @returns {Promise<Object>} - The switch role response data
 */
export async function switchRoleWithTokens(role, authStore) {
  const accessToken = await getAccessToken();
  
  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  const response = await axios.post(
    `${API_BASE}/api/v1/auth/switch-role`,
    { role },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 10000,
    }
  );

  const data = response.data;

  // Save new tokens if provided by backend
  if (data?.access_token) {
    await saveTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (__DEV__) {
      console.log('[AuthService] New tokens saved after role switch');
    }
  }

  // Update user in auth store if provided
  if (data?.user && authStore?.updateUser) {
    await authStore.updateUser(data.user);
  } else if (authStore?.switchRole) {
    // Fallback to just updating the role locally
    await authStore.switchRole(role);
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGOUT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Complete logout - clears all tokens and user data
 * 
 * @param {Object} authStore - The auth store instance
 */
export async function logout(authStore) {
  await clearTokens();
  if (authStore?.logout) {
    await authStore.logout();
  }
  if (__DEV__) {
    console.log('[AuthService] User logged out');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if user has valid authentication
 */
export async function isAuthenticated() {
  const token = await getAccessToken();
  return !!token;
}

/**
 * Get stored user data
 */
export async function getStoredUser() {
  try {
    const userData = await SecureStore.getItemAsync(TOKEN_KEYS.USER);
    if (userData) {
      return JSON.parse(userData);
    }
    return null;
  } catch (e) {
    console.warn('[AuthService] Failed to get stored user:', e.message);
    return null;
  }
}

/**
 * Save user data to storage
 */
export async function saveUser(user) {
  try {
    if (user && typeof user === 'object') {
      await SecureStore.setItemAsync(TOKEN_KEYS.USER, JSON.stringify(user));
      return true;
    }
    return false;
  } catch (e) {
    console.error('[AuthService] Failed to save user:', e.message);
    return false;
  }
}

export default {
  getAccessToken,
  getRefreshToken,
  saveTokens,
  clearTokens,
  refreshAccessToken,
  withAuth,
  switchRoleWithTokens,
  logout,
  isAuthenticated,
  getStoredUser,
  saveUser,
};
