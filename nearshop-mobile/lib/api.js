import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Hosted API base for emulator/device testing against the deployed backend.
const API_BASE = 'http://165.232.182.130';

const client = axios.create({
  baseURL: API_BASE + '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export async function getStoredAccessToken() {
  try {
    return await SecureStore.getItemAsync('access_token');
  } catch {
    return null;
  }
}

export async function buildAuthConfig(config = {}) {
  const token = await getStoredAccessToken();
  const headers = { ...(config.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
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

client.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    config.headers = config.headers || {};
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
    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Prevent infinite retry loop - max 1 retry per request
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest._alreadyRefreshed) {
      originalRequest._retry = true;
      originalRequest._alreadyRefreshed = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refresh_token');
        if (!refreshToken) {
          // Some sessions only persist access tokens. Reject without wiping the current session.
          return Promise.reject(error);
        }

        const { data } = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });

        if (!data || !data.access_token) {
          // Refresh endpoint did not produce a replacement token.
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
