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
    plan: string;
    subscriptionStatus: string;
    trialActive: boolean;
    trialDaysRemaining: number;
    usage: UsageInfo;
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
        plan: 'SMS',
        subscriptionStatus: 'TRIALING',
        trialActive: false,
        trialDaysRemaining: 0,
        usage: DEFAULT_USAGE,
    });

    const isMounted = useRef(true);

    const fetchProfile = useCallback(async () => {
        if (!isMounted.current) return;
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                if (isMounted.current) setState((s) => ({ ...s, loading: false, user: null }));
                return;
            }

            const [userRes, billingRes] = await Promise.all([
                api.get('/users/me').catch(() => null),
                api.get('/billing').catch(() => null),
            ]);

            const user = userRes?.data;
            const billing = billingRes?.data;

            if (isMounted.current) {
                setState((s) => ({
                    ...s,
                    loading: false,
                    user: user || null,
                    plan: billing?.plan || 'SMS',
                    subscriptionStatus: billing?.status || 'TRIALING',
                    trialActive: billing?.trial?.active ?? false,
                    trialDaysRemaining: billing?.trial?.daysRemaining ?? 0,
                    usage: billing?.usage || s.usage,
                }));
            }
        } catch {
            if (isMounted.current) {
                setState((s) => ({ ...s, loading: false, user: null }));
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
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Fetch billing to decide where to redirect
        const billing = await api.get('/billing').catch(() => null);
        await fetchProfile();

        const status = billing?.data?.status;
        const active = billing?.data?.trial?.active;

        // If no active trial and not a paying subscriber → send to checkout
        if (status === 'TRIALING' && !active) {
            router.push('/onboarding/plan');
        } else {
            router.push('/dashboard');
        }
    };

    const register = async (regData: { tenantName: string; email: string; password: string; firstName?: string; lastName?: string }) => {
        const { data } = await api.post('/auth/register', regData);
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        // New users always start at plan selection — trial begins only after card
        fetchProfile().catch(() => { });
        router.push('/onboarding/plan');
    };

    const logout = () => {
        api.post('/auth/logout').catch(() => { });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setState((s) => ({ ...s, user: null, loading: false }));
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
        } catch { }
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
