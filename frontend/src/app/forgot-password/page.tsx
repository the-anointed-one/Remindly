'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Navbar from '@/components/marketing/Navbar';
import styles from '../login/auth.module.css';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');
    const [details, setDetails] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setDetails('');
        setLoading(true);
        try {
            await api.post('/auth/forgot-password', { email });
            setSent(true);
        } catch (err: any) {
            console.error('[Forgot Password] Error:', err);
            const msg = err?.response?.data?.message || 'Something went wrong. Please try again.';
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
                    {sent ? (
                        <div style={{ textAlign: 'center' }}>
                             <div style={{ fontSize: 36, marginBottom: 16, color: 'var(--primary)' }}>
                                <FontAwesomeIcon icon={faEnvelope} />
                            </div>
                            <h1 className={styles.title} style={{ fontSize: 22 }}>Check your email</h1>
                            <p className={styles.subtitle}>
                                If <strong style={{ color: 'var(--text-secondary)' }}>{email}</strong> is registered,
                                you'll receive a reset link within a few minutes.
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
                                Didn't get it? Check your spam folder or{' '}
                                <button
                                    onClick={() => setSent(false)}
                                    style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 13, padding: 0, fontWeight: 500 }}
                                >
                                    try again
                                </button>.
                            </p>
                            <Link href="/login" className="btn btn-ghost" style={{ width: '100%', display: 'flex' }}>
                                Back to Login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h1 className={styles.title}>Forgot password?</h1>
                            <p className={styles.subtitle}>Enter your email and we'll send you a reset link.</p>

                            {error && (
                                <div className={styles.error} style={{ marginBottom: 16 }}>
                                    <div style={{ fontWeight: 800, marginBottom: 4 }}>Error</div>
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

                            <form onSubmit={handleSubmit} className={styles.form}>
                                <div className="input-group">
                                    <label className="input-label">Email address</label>
                                    <input
                                        type="email"
                                        className="input"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    disabled={loading || !email}
                                >
                                    {loading ? 'Sending...' : 'Send Reset Link'}
                                </button>
                            </form>

                            <p className={styles.footer}>
                                Remember it? <Link href="/login">Back to login</Link>
                            </p>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}
