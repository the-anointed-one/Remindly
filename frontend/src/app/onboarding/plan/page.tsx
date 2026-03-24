'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faLock, faShield, faTimes, faEnvelope, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PLANS = [
    {
        id: 'SMS',
        name: 'Starter',
        price: '₦5,000',
        period: '/month',
        description: 'Perfect for small businesses',
        color: 'var(--primary)',
        rgbVar: '--primary-rgb',
        features: [
            { label: '100 SMS reminders/month', included: true },
            { label: 'Appointment management', included: true },
            { label: 'Custom templates', included: true },
            { label: 'Voice calls', included: false },
            { label: 'WhatsApp messaging', included: false },
            { label: 'AI template generation', included: false },
        ],
    },
    {
        id: 'SMS_VOICE',
        name: 'Growth',
        price: '₦10,000',
        period: '/month',
        description: 'For growing teams',
        color: 'var(--success)',
        rgbVar: '--color-success-rgb',
        badge: 'POPULAR',
        features: [
            { label: '500 SMS reminders/month', included: true },
            { label: 'Appointment management', included: true },
            { label: 'Custom templates', included: true },
            { label: 'Voice call reminders', included: true },
            { label: 'WhatsApp messaging', included: true },
            { label: 'AI template generation', included: false },
        ],
    },
    {
        id: 'SMS_VOICE_AI',
        name: 'Pro',
        price: '₦18,000',
        period: '/month',
        description: 'Full power, maximum results',
        color: 'var(--accent-cta)',
        rgbVar: '--accent-cta-rgb',
        features: [
            { label: 'Unlimited SMS reminders', included: true },
            { label: 'Appointment management', included: true },
            { label: 'Custom templates', included: true },
            { label: 'Voice call reminders', included: true },
            { label: 'WhatsApp messaging', included: true },
            { label: 'AI template generation', included: true },
        ],
    },
];

export default function PlanSelectionPage() {
    const router = useRouter();
    const [selected, setSelected] = useState('SMS_VOICE');

    const handleContinue = () => {
        sessionStorage.setItem('selectedPlan', selected);
        router.push('/onboarding/checkout');
    };

    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '40px 20px' }}>
            <div style={{ maxWidth: 960, margin: '0 auto' }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 48 }}>
                    <Link href="/" style={{ textDecoration: 'none', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
                        <FontAwesomeIcon icon={faBolt} style={{ marginRight: 8, color: 'var(--accent-cta)' }} /><span className="text-gradient">Meetora</span>
                    </Link>
                    <h1 style={{ fontSize: 32, fontWeight: 800, marginTop: 32, marginBottom: 12 }}>
                        Choose your plan
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
                        All plans include a <strong style={{ color: 'var(--text-secondary)' }}>14-day free trial</strong>. No charges until your trial ends.
                    </p>
                </div>

                {/* Plan Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, marginBottom: 40 }}>
                    {PLANS.map(plan => {
                        const isSelected = selected === plan.id;
                        return (
                            <div
                                key={plan.id}
                                onClick={() => setSelected(plan.id)}
                                style={{
                                    background: isSelected ? `linear-gradient(135deg, rgba(var(${plan.rgbVar}), 0.08), rgba(var(${plan.rgbVar}), 0.04))` : 'var(--bg-elevated)',
                                    border: isSelected ? `2px solid ${plan.color}` : '1px solid #1e1e24',
                                    borderRadius: 16,
                                    padding: '28px 24px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    position: 'relative',
                                    transform: isSelected ? 'translateY(-4px)' : 'none',
                                    boxShadow: isSelected ? `0 12px 40px ${plan.color}20` : 'none',
                                }}
                            >
                                {plan.badge && (
                                    <div style={{
                                        position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                        background: plan.color, color: 'var(--bg-app)', fontSize: 11, fontWeight: 700,
                                        padding: '4px 12px', borderRadius: 20, letterSpacing: 1,
                                    }}>{plan.badge}</div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <div>
                                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{plan.name}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{plan.description}</div>
                                    </div>
                                    <div style={{
                                        width: 22, height: 22, borderRadius: '50%',
                                        border: isSelected ? `2px solid ${plan.color}` : '2px solid var(--border)',
                                        background: isSelected ? plan.color : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        {isSelected && <FontAwesomeIcon icon={faCheck} style={{ color: '#fff', fontSize: 10 }} />}
                                    </div>
                                </div>

                                <div style={{ marginBottom: 20 }}>
                                    <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)' }}>{plan.price}</span>
                                    <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{plan.period}</span>
                                </div>

                                <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 16 }}>
                                    {plan.features.map((f, i) => (
                                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                            <FontAwesomeIcon icon={f.included ? faCheck : faTimes} style={{ color: f.included ? 'var(--success)' : 'var(--text-muted)', fontSize: 12 }} />
                                            <span style={{ fontSize: 14, color: f.included ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                                                {f.label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* CTA */}
                <div style={{ textAlign: 'center' }}>
                    <button
                        onClick={handleContinue}
                        className="btn btn-primary"
                        style={{ fontSize: 16, padding: '14px 48px', minWidth: 240 }}
                    >
                        Continue with {PLANS.find(p => p.id === selected)?.name} →
                    </button>
                    <p style={{ marginTop: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                        <FontAwesomeIcon icon={faLock} style={{ marginRight: 6 }} />No charge for 14 days · Cancel anytime · Secure checkout via Paystack
                    </p>
                </div>
            </div>
        </main>
    );
}
