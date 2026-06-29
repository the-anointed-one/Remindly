'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Navbar from '@/components/marketing/Navbar';
import styles from '../login/auth.module.css';

function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token') || '';

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const [details, setDetails] = useState('');

    useEffect(() => {
        if (!token) setError('Invalid reset link. Please request a new one.');
    }, [token]);

    const passwordsMatch = password && confirm && password === confirm;
    const passwordValid = password.length >= 8;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passwordsMatch || !passwordValid) return;
        setError('');
        setDetails('');
        setLoading(true);
        try {
            await api.post('/auth/reset-password', { token, newPassword: password });
            setSuccess(true);
            setTimeout(() => router.push('/login'), 3000);
        } catch (err: any) {
            console.error('[Reset Password] Error:', err);
            const msg = err?.response?.data?.message || 'Reset failed. The link may have expired.';
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
                    {success ? (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 36, marginBottom: 16, color: 'var(--success)' }}>
                                <FontAwesomeIcon icon={faCheck} />
                            </div>
                            <h1 className={styles.title} style={{ fontSize: 22 }}>Password updated!</h1>
                            <p className={styles.subtitle}>Your password has been changed. Redirecting to login...</p>
                            <Link href="/login" className="btn btn-primary" style={{ width: '100%', display: 'flex' }}>
                                Go to Login →
                            </Link>
                        </div>
                    ) : (
                        <>
                            <h1 className={styles.title}>Set new password</h1>
                            <p className={styles.subtitle}>Choose a strong password for your account.</p>

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
                                    {error.includes('expired') && (
                                        <div style={{ marginTop: 8 }}>
                                            <Link href="/forgot-password" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                                                Request a new link →
                                            </Link>
                                        </div>
                                    )}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className={styles.form}>
                                <div className="input-group">
                                    <label className="input-label">New password</label>
                                    <input
                                        type="password"
                                        className="input"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="Min. 8 characters"
                                        required
                                        autoFocus
                                        style={{
                                            borderColor: password && !passwordValid ? 'rgba(239,68,68,0.5)' : password && passwordValid ? 'rgba(34,197,94,0.4)' : undefined
                                        }}
                                    />
                                    <p style={{
                                        fontSize: 12,
                                        color: 'var(--text-muted)',
                                        marginTop: 4,
                                        lineHeight: 1.5,
                                    }}>
                                        Min 8 characters &mdash; must include uppercase, lowercase,
                                        number, and special character (@$!%*?&._-#).
                                    </p>
                                    {password && !passwordValid && (
                                        <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 2 }}>Must be at least 8 characters</p>
                                    )}
                                </div>

                                <div className="input-group">
                                    <label className="input-label">Confirm password</label>
                                    <input
                                        type="password"
                                        className="input"
                                        value={confirm}
                                        onChange={e => setConfirm(e.target.value)}
                                        placeholder="Repeat your password"
                                        required
                                        style={{
                                            borderColor: confirm && !passwordsMatch ? 'rgba(239,68,68,0.5)' : passwordsMatch ? 'rgba(34,197,94,0.4)' : undefined
                                        }}
                                    />
                                    {confirm && !passwordsMatch && (
                                        <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 2 }}>Passwords don&apos;t match</p>
                                    )}
                                    {passwordsMatch && (
                                        <p style={{ color: 'var(--success)', fontSize: 12, marginTop: 2 }}>✓ Passwords match</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                    style={{ width: '100%' }}
                                    disabled={loading || !passwordsMatch || !passwordValid || !token}
                                >
                                    {loading ? 'Updating...' : 'Update Password'}
                                </button>
                            </form>

                            <p className={styles.footer}>
                                <Link href="/login">Back to login</Link>
                            </p>
                        </>
                    )}
                </div>
            </main>
        </>
    );
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Loading...
            </div>
        }>
            <ResetPasswordForm />
        </Suspense>
    );
}
