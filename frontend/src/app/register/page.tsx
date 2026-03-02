'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import Navbar from '@/components/marketing/Navbar';
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
            const { data } = await api.post('/auth/register', form);
            localStorage.setItem('accessToken', data.accessToken);
            localStorage.setItem('refreshToken', data.refreshToken);
            router.push('/dashboard');
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
                    <p className={styles.subtitle}>14 days free • No credit card required</p>

                    {error && <div className={styles.error}>{error}</div>}

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className="input-group">
                            <label className="input-label">Business Name</label>
                            <input className="input" value={form.tenantName} onChange={(e) => update('tenantName', e.target.value)} placeholder="Your Business" required />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
