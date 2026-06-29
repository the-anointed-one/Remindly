'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { faComment, faPhone, faRobot } from '@fortawesome/free-solid-svg-icons';
import { useCurrency } from '@/hooks/useCurrency';

interface BillingInfo {
    plan: string;
    status: string;
    hasPaymentMethod: boolean;
    trial: { active: boolean; daysRemaining: number; endsAt: string };
    renewalDate: string | null;
    usage: { sms: { used: number; limit: number }; voice: { used: number }; ai: { used: number; limit: number } };
    recentSubscriptions: any[];
}

export default function BillingPage() {
    const { plan: currentPlan, trialActive, trialDaysRemaining, subscriptionStatus } = useAuth();
    const currency = useCurrency();
    const plans = [
        { code: 'SMS', name: 'Starter', price: `${currency.plans.SMS.price}/mo`, features: ['100 SMS reminders/month', 'Appointment management', 'Custom templates'] },
        { code: 'SMS_VOICE', name: 'Growth', price: `${currency.plans.SMS_VOICE.price}/mo`, features: ['500 SMS reminders/month', 'Voice call reminders', 'WhatsApp messaging'] },
        { code: 'SMS_VOICE_AI', name: 'Pro', price: `${currency.plans.SMS_VOICE_AI.price}/mo`, features: ['Unlimited SMS reminders', 'Voice + WhatsApp', 'AI template generation'] },
    ];
    const [billing, setBilling] = useState<BillingInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const fetch = useCallback(async () => {
        try { const { data } = await api.get('/billing'); setBilling(data); } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const handleUpgrade = async (planCode: string) => {
        try {
            const { data: profileData } = await api.get('/auth/profile');
            const email = profileData?.email;
            if (!email) return;
            const { data } = await api.post('/billing/subscribe', { planCode, email });
            if (data.authorizationUrl) {
                window.open(data.authorizationUrl, '_blank');
            }
        } catch (err: any) {
            alert(err.response?.data?.message || 'Upgrade failed');
        }
    };

    if (loading) return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>;

    return (
        <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Billing & Plans</h1>

            {/* Current Status */}
            <div className="card" style={{ marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Current Plan</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24, fontWeight: 800 }}>{currentPlan.replace(/_/g, ' + ')}</span>
                        <span className={`badge ${subscriptionStatus === 'ACTIVE' ? 'badge-success' : subscriptionStatus === 'TRIALING' ? 'badge-warning' : 'badge-danger'}`}>
                            {subscriptionStatus}
                        </span>
                    </div>
                    {trialActive && <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{trialDaysRemaining} days remaining in trial</p>}
                </div>
                {billing?.renewalDate && (
                    <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Renews on</span>
                        <div style={{ fontWeight: 600 }}>{new Date(billing.renewalDate).toLocaleDateString()}</div>
                    </div>
                )}
            </div>

            {/* Usage */}
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Usage This Period</h2>
            <div className="grid-3" style={{ marginBottom: 32 }}>
                {[
                    { label: 'SMS', used: billing?.usage?.sms?.used || 0, limit: billing?.usage?.sms?.limit || 100, icon: <Icon icon={faComment} className="text-primary" /> },
                    { label: 'Voice Calls', used: billing?.usage?.voice?.used || 0, limit: null, icon: <Icon icon={faPhone} className="text-accent-cta" /> },
                    { label: 'AI Requests', used: billing?.usage?.ai?.used || 0, limit: billing?.usage?.ai?.limit || 5, icon: <Icon icon={faRobot} className="text-primary" /> },
                ].map((u) => {
                    const pct = u.limit ? Math.min(100, (u.used / u.limit) * 100) : 0;
                    return (
                        <div key={u.label} className="card">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 20 }}>{u.icon}</span>
                                <span style={{ fontWeight: 600 }}>{u.label}</span>
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>{u.used}{u.limit ? <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}> / {u.limit}</span> : null}</div>
                            {u.limit && (
                                <div className="progress-bar">
                                    <div className={`progress-fill ${pct > 80 ? 'warning' : ''} ${pct > 95 ? 'danger' : ''}`} style={{ width: `${pct}%` }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Plan Upgrade */}
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Available Plans</h2>
            <div className="grid-3">
                {plans.map((p) => {
                    const isCurrent = p.code === currentPlan;
                    return (
                        <div key={p.code} className="card" style={{ border: isCurrent ? '2px solid var(--primary)' : undefined }}>
                            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{p.name}</h3>
                            <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>{p.price}</div>
                            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                                {p.features.map((f) => (
                                    <li key={f} style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <span style={{ color: 'var(--success)' }}>✓</span> {f}
                                    </li>
                                ))}
                            </ul>
                            {isCurrent ? (
                                <button className="btn btn-ghost" style={{ width: '100%' }} disabled>Current Plan</button>
                            ) : (
                                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleUpgrade(p.code)}>Upgrade →</button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
