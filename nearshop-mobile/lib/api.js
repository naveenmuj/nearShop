import axios from 'axios';
import AuthService from './authService';

// Hosted API base for emulator/device testing against the deployed backend.
export const API_BASE = 'http://165.232.182.130';

const client = axios.create({
  baseURL: API_BASE + '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Re-export for backward compatibility
export const getStoredAccessToken = AuthService.getAccessToken;

export async function buildAuthConfig(config = {}) {
  const token = await AuthService.getAccessToken();
  const headers = { ...(config.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
    if (__DEV__) {
      console.log('[API] Token found for request:', token.slice(0, 20) + '...');
    }
  } else {
    if (__DEV__) {
      console.warn('[API] No token available for authenticated request!');
    }
  }
  return { ...config, headers };
}

export async function authGet(url, config = {}) {
  return client.get(url, await buildAuthConfig(config));
}

export async function authPost(url, data = null, config = {}) {
  return client.post(url, data, await buildAuthConfig(config));
}

export async function authDelete(url, config = {}) {
  return client.delete(url, await buildAuthConfig(config));
}

export async function authPut(url, data = null, config = {}) {
  return client.put(url, data, await buildAuthConfig(config));
}

export async function authPatch(url, data = null, config = {}) {
  return client.patch(url, data, await buildAuthConfig(config));
}

// Refresh lock to prevent concurrent refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor - adds token if available
client.interceptors.request.use(
  async (config) => {
    // Skip token for unauthenticated endpoints
    const publicEndpoints = ['/auth/send-otp', '/auth/verify-otp', '/auth/firebase-signin', '/auth/refresh'];
    const isPublic = publicEndpoints.some(ep => config.url?.includes(ep));
    
    if (!isPublic) {
      try {
        const token = await AuthService.getAccessToken();
        config.headers = config.headers || {};
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[API] Error getting token:', e.message);
        }
      }
    }
    
    if (__DEV__) {
      const auth = config.headers?.Authorization ? '🔑 authed' : '🔓 anon';
      console.log(`[API →] ${config.method?.toUpperCase()} ${config.baseURL}${config.url} ${auth}`, config.params || '');
    }
    config._startTime = Date.now();
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      const ms = Date.now() - (response.config._startTime || 0);
      console.log(`[API ✅] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url} (${ms}ms)`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Handle 401 errors with token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return client(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const newToken = await AuthService.refreshAccessToken();
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (__DEV__) {
          console.error('[API] Token refresh failed:', refreshError.message);
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Enhance error with type information
    const enhancedError = {
      ...error,
      errorType: getErrorType(error),
      userMessage: getUserFriendlyMessage(error),
    };

    if (__DEV__) {
      const ms = Date.now() - (error.config?._startTime || 0);
      console.log(`[API ❌] ${error.response?.status ?? 'ERR'} ${error.config?.method?.toUpperCase()} ${error.config?.url} (${ms}ms)`, error.response?.data || error.message);
    }
    return Promise.reject(enhancedError);
  }
);

// Helper functions for error categorization
function getErrorType(error) {
  if (!error.response) {
    // Network error (no response received)
    return 'network';
  }
  
  const status = error.response.status;
  if (status >= 400 && status < 500) {
    if (status === 400 || status === 422) {
      return 'validation';
    }
    if (status === 404) {
      return 'not_found';
    }
    return 'client';
  }
  
  if (status >= 500) {
    return 'server';
  }
  
  return 'unknown';
}

function getUserFriendlyMessage(error) {
  const errorType = getErrorType(error);
  
  // Try to extract backend message first
  const backendMessage = error.response?.data?.detail || error.response?.data?.message;
  
  switch (errorType) {
    case 'network':
      return 'No internet connection. Please check your network and try again.';
    case 'validation':
      return backendMessage || 'Please check your input and try again.';
    case 'not_found':
      return backendMessage || 'The requested item was not found.';
    case 'server':
      return 'Server error. Please try again later.';
    case 'client':
      return backendMessage || 'Request failed. Please try again.';
    default:
      return backendMessage || 'Something went wrong. Please try again.';
  }
}

export default client;
