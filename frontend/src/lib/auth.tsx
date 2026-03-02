'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [state, setState] = useState<AuthState>({
        user: null,
        loading: true,
        plan: 'SMS',
        subscriptionStatus: 'TRIALING',
        trialActive: true,
        trialDaysRemaining: 14,
        usage: { sms: { used: 0, limit: 100 }, voice: { used: 0 }, ai: { used: 0, limit: 5 } },
    });

    const fetchProfile = useCallback(async () => {
        try {
            const token = localStorage.getItem('accessToken');
            if (!token) {
                setState((s) => ({ ...s, loading: false, user: null }));
                return;
            }

            const [userRes, billingRes] = await Promise.all([
                api.get('/users').catch(() => null),
                api.get('/billing').catch(() => null),
            ]);

            const users = userRes?.data;
            const billing = billingRes?.data;
            const user = Array.isArray(users) ? users[0] : users;

            setState((s) => ({
                ...s,
                loading: false,
                user: user || null,
                plan: billing?.plan || 'SMS',
                subscriptionStatus: billing?.status || 'TRIALING',
                trialActive: billing?.trial?.active ?? true,
                trialDaysRemaining: billing?.trial?.daysRemaining ?? 14,
                usage: billing?.usage || s.usage,
            }));
        } catch {
            setState((s) => ({ ...s, loading: false, user: null }));
        }
    }, []);

    useEffect(() => {
        fetchProfile();
    }, [fetchProfile]);

    const login = async (email: string, password: string) => {
        const { data } = await api.post('/auth/login', { email, password });
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        await fetchProfile();
        router.push('/dashboard');
    };

    const register = async (regData: { tenantName: string; email: string; password: string; firstName?: string; lastName?: string }) => {
        const { data } = await api.post('/auth/register', regData);
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        await fetchProfile();
        router.push('/dashboard');
    };

    const logout = () => {
        api.post('/auth/logout').catch(() => { });
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setState((s) => ({ ...s, user: null }));
        router.push('/login');
    };

    const refreshUsage = async () => {
        try {
            const { data } = await api.get('/billing');
            setState((s) => ({
                ...s,
                plan: data.plan,
                subscriptionStatus: data.status,
                trialActive: data.trial?.active ?? false,
                trialDaysRemaining: data.trial?.daysRemaining ?? 0,
                usage: data.usage || s.usage,
            }));
        } catch { }
    };

    return (
        <AuthContext.Provider value={{ ...state, login, register, logout, refreshUsage }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
