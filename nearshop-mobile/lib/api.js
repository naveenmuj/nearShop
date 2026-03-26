import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Hosted API base for emulator/device testing against the deployed backend.
const API_BASE = 'http://165.232.182.130';

const client = axios.create({
  baseURL: API_BASE + '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // SecureStore may not be available
  }
  if (__DEV__) {
    const auth = config.headers.Authorization ? '🔑 authed' : '🔓 anon';
    console.log(`[API →] ${config.method?.toUpperCase()} ${config.baseURL}${config.url} ${auth}`, config.params || '');
  }
  config._startTime = Date.now();
  return config;
});

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

    // Prevent infinite retry loop - max 1 retry per request
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._alreadyRefreshed) {
      originalRequest._retry = true;
      originalRequest._alreadyRefreshed = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) {
          // No refresh token, clear auth and reject
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
          return Promise.reject(error);
        }

        const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        if (!data || !data.access_token) {
          // Refresh failed - clear tokens and reject
          await SecureStore.deleteItemAsync('access_token');
          await SecureStore.deleteItemAsync('refresh_token');
          return Promise.reject(error);
        }

        await SecureStore.setItemAsync('access_token', String(data.access_token));
        if (data.refresh_token) {
          await SecureStore.setItemAsync('refresh_token', String(data.refresh_token));
        }
        originalRequest.headers.Authorization = `Bearer ${data.access_token}`;
        return client(originalRequest);
      } catch (refreshError) {
        if (__DEV__) {
          console.error('[API] Token refresh failed:', refreshError.message);
        }
        await SecureStore.deleteItemAsync('access_token');
        await SecureStore.deleteItemAsync('refresh_token');
        return Promise.reject(refreshError);
      }
    }

    if (__DEV__) {
      const ms = Date.now() - (error.config?._startTime || 0);
      console.log(`[API ❌] ${error.response?.status ?? 'ERR'} ${error.config?.method?.toUpperCase()} ${error.config?.url} (${ms}ms)`, error.response?.data || error.message);
    }
    return Promise.reject(error);
  }
);

export default client;
