import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

if (process.env.NODE_ENV !== 'production') {
    api.interceptors.request.use((config) => {
        console.debug('[API] Request:', config.method?.toUpperCase(), config.url, config.params || '', config.data || '');
        return config;
    });
    api.interceptors.response.use(
        (response) => {
            console.debug('[API] Response:', response.config.url, response.status, response.data);
            return response;
        },
        (error) => {
            console.warn('[API] Error:', error.config?.url, error.response?.status, error.response?.data);
            return Promise.reject(error);
        }
    );
}

// Attach JWT token to every request
api.interceptors.request.use((config) => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('accessToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// Handle 401 — try refresh, else redirect to login
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (original?.url?.includes('/auth/refresh')) {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            if (typeof window !== 'undefined') window.location.href = '/login';
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !original?._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    original.headers.Authorization = `Bearer ${token}`;
                    return api(original);
                }).catch((err) => Promise.reject(err));
            }

            original._retry = true;
            isRefreshing = true;

            return new Promise(async (resolve, reject) => {
                try {
                    const refreshToken = localStorage.getItem('refreshToken');
                    if (!refreshToken) throw new Error('No refresh token');

                    const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken });
                    localStorage.setItem('accessToken', data.accessToken);
                    localStorage.setItem('refreshToken', data.refreshToken);
                    api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
                    processQueue(null, data.accessToken);
                    resolve(api(original));
                } catch (refreshError) {
                    processQueue(refreshError, null);
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                    if (typeof window !== 'undefined') {
                        window.location.href = '/login';
                    }
                    reject(refreshError);
                } finally {
                    isRefreshing = false;
                }
            });
        }

        return Promise.reject(error);
    }
);

export default api;
