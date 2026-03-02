'use client';

import { useAuth } from '@/lib/auth';
import Link from 'next/link';

export default function DashboardOverview() {
    const { user, plan, trialActive, trialDaysRemaining, usage, subscriptionStatus } = useAuth();

    const stats = [
        { label: 'SMS Sent', value: usage.sms.used, icon: '💬', color: 'var(--accent-primary)' },
        { label: 'Voice Calls', value: usage.voice.used, icon: '📞', color: 'var(--info)' },
        { label: 'AI Requests', value: usage.ai.used, icon: '🤖', color: 'var(--accent-secondary)' },
        { label: 'Plan', value: plan.replace(/_/g, ' + '), icon: '📋', color: 'var(--success)' },
    ];

    return (
        <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>Dashboard</h1>

            {/* Stats Grid */}
            <div className="grid-4" style={{ marginBottom: 32 }}>
                {stats.map((s) => (
                    <div key={s.label} className="card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 28, marginBottom: 8 }}>{s.icon}</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* Trial Banner */}
            {trialActive && (
                <div className="card" style={{
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(59,130,246,0.1))',
                    border: '1px solid rgba(245,158,11,0.3)', marginBottom: 32, display: 'flex',
                    alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
                }}>
                    <div>
                        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                            ⏱ {trialDaysRemaining} Days Left in Your Trial
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                            {subscriptionStatus === 'TRIALING'
                                ? 'Upgrade now to unlock all features and continue uninterrupted.'
                                : 'Your subscription is active.'}
                        </p>
                    </div>
                    <Link href="/dashboard/billing" className="btn btn-primary">Upgrade Now →</Link>
                </div>
            )}

            {/* Quick Actions */}
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h2>
            <div className="grid-3">
                {[
                    { icon: '📅', title: 'New Appointment', desc: 'Schedule a new appointment', href: '/dashboard/appointments' },
                    { icon: '📝', title: 'Create Template', desc: 'Design a reminder template', href: '/dashboard/templates' },
                    { icon: '🤖', title: 'Generate with AI', desc: 'AI-powered template creation', href: '/dashboard/ai' },
                ].map((a) => (
                    <Link key={a.title} href={a.href} className="card" style={{ color: 'var(--text-primary)', cursor: 'pointer' }}>
                        <div style={{ fontSize: 28, marginBottom: 12 }}>{a.icon}</div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{a.title}</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{a.desc}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
}
