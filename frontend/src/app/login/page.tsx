'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import Navbar from '@/components/marketing/Navbar';
import styles from './auth.module.css';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [details, setDetails] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setDetails('');
        setLoading(true);
        try {
            await login(email, password);
            // Redirection is handled inside useAuth().login
        } catch (err: any) {
            console.error('[Login] Error:', err);
            const msg = err.response?.data?.message || err.message || 'Invalid credentials';
            setError(msg);
            if (err.response?.data) {
                setDetails(JSON.stringify(err.response.data, null, 2));
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Navbar />
            <main className={styles.page}>
                <div className={styles.formCard}>
                    <h1 className={styles.title}>Welcome Back</h1>
                    <p className={styles.subtitle}>Log in to your Meetora dashboard</p>

                    {error && (
                        <div className={styles.error} style={{ marginBottom: 16 }}>
                            <div style={{ fontWeight: 800, marginBottom: 4 }}>Login Failed</div>
                            <div>{error}</div>
                            {details && (
                                <pre style={{ 
                                    marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.2)', 
                                    borderRadius: 4, fontSize: 10, overflowX: 'auto',
                                    textAlign: 'left', whiteSpace: 'pre-wrap'
                                }}>
                                    {details}
                                </pre>
                            )}
                        </div>
                    )}

                    <a href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api'}/auth/google`} className="btn btn-outline" style={{ width: '100%', marginBottom: 16, display: 'flex', justifyContent: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', textDecoration: 'none' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                        Sign in with Google
                    </a>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>OR</span>
                        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    </div>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="input-group">
                            <label className="input-label">Email</label>
                            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" required />
                        </div>
                        <div className="input-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label className="input-label">Password</label>
                                <Link href="/forgot-password" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none' }}>Forgot password?</Link>
                            </div>
                            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 8 }} disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className={styles.footer}>
                        Don&apos;t have an account? <Link href="/register">Start free trial</Link>
                    </p>
                </div>
            </main>
        </>
    );
}
