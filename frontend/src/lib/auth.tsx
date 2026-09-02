'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import api from './api';

interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role: string;
    tenantId: string;
}

interface UsageInfo {
    sms: { used: number; limit: number };
    voice: { used: number };
    whatsapp: { used: number; limit: number };
    ai: { used: number; limit: number };
}

interface AuthState {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    plan: string;
    subscriptionStatus: string;
    trialActive: boolean;
    trialDaysRemaining: number;
    usage: UsageInfo;
    // Business timezone (tenant settings.timezone, from /users/me), used to
    // default the DateTimePicker instead of the browser's zone.
    tenantTimezone: string;
}

interface AuthContextType extends AuthState {
    login: (email: string, password: string) => Promise<void>;
    register: (data: { tenantName: string; email: string; password: string; firstName?: string; lastName?: string }) => Promise<void>;
    logout: () => void;
    refreshUsage: () => Promise<void>;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEFAULT_USAGE: UsageInfo = {
    sms: { used: 0, limit: 100 },
    voice: { used: 0 },
    whatsapp: { used: 0, limit: 100 },
    ai: { used: 0, limit: 5 },
};

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        isAuthenticated: false,
        plan: 'SMS',
        subscriptionStatus: 'TRIALING',
        trialActive: false,
        trialDaysRemaining: 0,
        usage: DEFAULT_USAGE,
        tenantTimezone: 'UTC',
    });

    const isMounted = useRef(true);

    const fetchProfile = useCallback(async () => {
        if (!isMounted.current) return;
        try {
            // Auth is handled by HttpOnly cookies — no token needed in JS
            const [userRes, billingRes] = await Promise.all([
                api.get('/users/me').catch((err) => {
                    if (process.env.NODE_ENV === 'development') console.error('[Auth] Fetch profile failed:', err);
                    return null;
                }),
                api.get('/billing').catch((err) => {
                    if (process.env.NODE_ENV === 'development') console.error('[Auth] Fetch billing failed:', err);
                    return null;
                }),
            ]);

            const user = userRes?.data;
            const billing = billingRes?.data;

            if (isMounted.current) {
                setState((s) => ({
                    ...s,
                    loading: false,
                    user: user || null,
                    isAuthenticated: !!user,
                    plan: billing?.plan || 'SMS',
                    subscriptionStatus: billing?.status || 'TRIALING',
                    trialActive: billing?.trial?.active ?? false,
                    trialDaysRemaining: billing?.trial?.daysRemaining ?? 0,
                    usage: billing?.usage || s.usage,
                    tenantTimezone: user?.tenantTimezone || s.tenantTimezone,
                }));
            }
        } catch {
            if (isMounted.current) {
                setState((s) => ({ ...s, loading: false, user: null, isAuthenticated: false }));
            }
        }
    }, []);

    useEffect(() => {
        isMounted.current = true;
        fetchProfile();

        return () => {
            isMounted.current = false;
        };
    }, [fetchProfile]);

    const login = async (email: string, password: string) => {
        // Backend sets HttpOnly cookies in the response — no token handling in JS
        await api.post('/auth/login', { email, password });

        const billing = await api.get('/billing').catch((err) => {
            if (process.env.NODE_ENV === 'development') console.error('[Auth] Login billing fetch failed:', err);
            return null;
        });
        await fetchProfile();

        const status = billing?.data?.status;
        const active = billing?.data?.trial?.active;

        if (status === 'TRIALING' && !active) {
            router.push('/onboarding/plan');
        } else {
            router.push('/dashboard');
        }
    };

    const register = async (regData: { tenantName: string; email: string; password: string; firstName?: string; lastName?: string }) => {
        // Backend sets HttpOnly cookies in the response — no token handling in JS.
        // Seed the tenant timezone from the browser's zone at signup.
        let timezone = 'UTC';
        try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch {}
        await api.post('/auth/register', { ...regData, timezone });
        fetchProfile().catch((err) => {
            if (process.env.NODE_ENV === 'development') console.error('[Auth] Post-registration profile fetch failed:', err);
        });
        router.push('/onboarding/plan');
    };

    const logout = () => {
        // Backend clears the HttpOnly cookies
        api.post('/auth/logout').catch((err) => {
            if (process.env.NODE_ENV === 'development') console.error('[Auth] Logout failed:', err);
        });
        setState((s) => ({ ...s, user: null, loading: false, isAuthenticated: false }));
        router.push('/login');
    };

    const refreshUsage = async () => {
        try {
            const { data } = await api.get('/billing');
            if (isMounted.current) {
                setState((s) => ({
                    ...s,
                    plan: data.plan,
                    subscriptionStatus: data.status,
                    trialActive: data.trial?.active ?? false,
                    trialDaysRemaining: data.trial?.daysRemaining ?? 0,
                    usage: data.usage || s.usage,
                }));
            }
        } catch (err) {
            if (process.env.NODE_ENV === 'development') {
                console.error('[Auth] Refresh usage failed:', err);
            }
        }
    };

    const refreshProfile = async () => {
        await fetchProfile();
    };

    return (
        <AuthContext.Provider value={{ ...state, login, register, logout, refreshUsage, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
