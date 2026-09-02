'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Navbar from '@/components/marketing/Navbar';
import { detectBrowserTimezone } from '@/lib/timezones';
import styles from '../login/auth.module.css';

export default function RegisterPage() {
    const router = useRouter();
    const [form, setForm] = useState({ tenantName: '', email: '', password: '', firstName: '', lastName: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Seed the tenant's business timezone from the browser's zone at
            // signup (stored server-side, not re-detected each session).
            const { data } = await api.post('/auth/register', { ...form, timezone: detectBrowserTimezone() });
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            router.push('/onboarding/plan');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Registration failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Navbar />
            <main className={styles.page}>
                <div className={styles.formCard}>
                    <h1 className={styles.title}>Start Your Free Trial</h1>
                    <p className={styles.subtitle}>14-day free trial • Card required to start</p>

                    {error && <div className={styles.error}>{error}</div>}

                    <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/auth/google`} className="btn btn-outline" style={{ width: '100%', marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                        Sign up with Google
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="input-group">
                            <label className="input-label">Business Name</label>
                            <input className="input" value={form.tenantName} onChange={(e) => update('tenantName', e.target.value)} placeholder="Your Business" required />
                        </div>
                        <div className={styles.nameGrid}>
                            <div className="input-group">
                                <label className="input-label">First Name</label>
                                <input className="input" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} placeholder="John" />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Last Name</label>
                                <input className="input" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} placeholder="Doe" />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Email</label>
                            <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@business.com" required />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Password</label>
                            <input className="input" type="password" value={form.password} onChange={(e) => update('password', e.target.value)} placeholder="Min 8 characters" required minLength={8} />
                            <p style={{
                                fontSize: 12,
                                color: 'var(--text-muted)',
                                marginTop: 4,
                                lineHeight: 1.5,
                            }}>
                                Min 8 characters &mdash; must include uppercase, lowercase,
                                number, and special character (@$!%*?&._-#).
                            </p>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                            {loading ? 'Creating account...' : 'Create Account'}
                        </button>
                    </form>

                    <p className={styles.footer}>
                        Already have an account? <Link href="/login">Sign in</Link>
                    </p>
                </div>
            </main>
        </>
    );
}
