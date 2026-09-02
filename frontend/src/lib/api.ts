import axios from 'axios';

if (!process.env.NEXT_PUBLIC_API_URL && process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_API_URL is required in production builds.');
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000/api' : '');

// Areas that require a signed-in user. Everything else — marketing pages,
// public form links — must stay reachable when the session check fails.
const PROTECTED_PREFIXES = ['/dashboard', '/onboarding'];

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
    // Required for HttpOnly cookies to be sent cross-origin
    withCredentials: true,
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

// Handle 401 — try silent token refresh, else redirect to login
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;

        if (original?.url?.includes('/auth/')) {
            // Don't try to refresh if the error happened on an auth endpoint itself
            return Promise.reject(error);
        }

        if (error.response?.status === 401 && !original?._retry) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(() => api(original)).catch((err) => Promise.reject(err));
            }

            original._retry = true;
            isRefreshing = true;

            return new Promise(async (resolve, reject) => {
                try {
                    // The refreshToken HttpOnly cookie is sent automatically via withCredentials
                    await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true });
                    // New accessToken cookie is now set by the server — retry the original request
                    processQueue(null);
                    resolve(api(original));
                } catch (refreshError) {
                    processQueue(refreshError);
                    // Only bounce to /login from areas that actually require a
                    // session. The previous rule redirected from *every* path
                    // except /login and /register — and because AuthProvider
                    // sits in the root layout and calls /users/me on every page,
                    // that meant any logged-out visitor to a public page
                    // (marketing pages, and shareable /forms/:slug links) was
                    // thrown to the login screen before the page could render.
                    if (
                        typeof window !== 'undefined' &&
                        PROTECTED_PREFIXES.some((p) =>
                            window.location.pathname.startsWith(p),
                        )
                    ) {
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

export const updateAppointment = (id: string, payload: Record<string, unknown>) => api.put(`/appointments/${id}`, payload);
export const deleteAppointment = (id: string) => api.delete(`/appointments/${id}`);
export const deleteEvent = (id: string) => api.delete(`/events/${id}`);

export default api;
