'use client';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBolt, faLock, faShield, faTimes, faEnvelope, faCheck } from '@fortawesome/free-solid-svg-icons';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';

const PLAN_DETAILS: Record<string, { name: string; features: string[] }> = {
    SMS: {
        name: 'Starter',
        features: ['100 SMS reminders/month', 'Appointment management', 'Custom templates'],
    },
    SMS_VOICE: {
        name: 'Growth',
        features: ['500 SMS reminders/month', 'Voice call reminders', 'WhatsApp messaging'],
    },
    SMS_VOICE_AI: {
        name: 'Pro',
        features: ['Unlimited SMS reminders', 'Voice + WhatsApp', 'AI template generation'],
    },
};

declare global {
    interface Window { PaystackPop: any; }
}

type Provider = 'PAYSTACK' | 'PAYPAL' | 'CRYPTO';

const PROVIDERS: { id: Provider; label: string; note: string }[] = [
    { id: 'PAYSTACK', label: 'Card (Paystack)', note: 'Card, bank transfer, USSD' },
    { id: 'PAYPAL', label: 'PayPal', note: 'Pay with your PayPal balance or card' },
    { id: 'CRYPTO', label: 'Crypto', note: 'BTC, ETH, USDC via Coinbase Commerce' },
];

export default function CheckoutPage() {
    const currency = useCurrency();
    const [plan, setPlan] = useState('SMS_VOICE');
    const [provider, setProvider] = useState<Provider>('PAYSTACK');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const stored = sessionStorage.getItem('selectedPlan');
        if (stored && PLAN_DETAILS[stored]) setPlan(stored);

        // Load Paystack inline script
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        document.head.appendChild(script);
        return () => { document.head.removeChild(script); };
    }, []);

    const planDetails = PLAN_DETAILS[plan];
    const planPrice = currency.plans[plan as keyof typeof currency.plans].monthlyPrice;

    const handleStartTrial = async () => {
        setError('');
        setLoading(true);
        try {
            // Auth is handled by HttpOnly cookies — api sends them automatically.
            const { data } = await api.post('/billing/initialize', { plan, provider });

            if (data.authorizationUrl) {
                // Redirect to the chosen provider's hosted checkout
                window.location.href = data.authorizationUrl;
            } else {
                setError('Could not initialize checkout. Please try again.');
            }
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Checkout initialization failed.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '96px 20px 48px', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 520 }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 40 }}>
                    <Link href="/" style={{ textDecoration: 'none', fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>
                        <FontAwesomeIcon icon={faBolt} style={{ marginRight: 8, color: 'var(--accent-cta)' }} /><span className="text-gradient">Meetora</span>
                    </Link>
                </div>

                <div className="glass-card">
                    {/* Trial callout */}
                    <div style={{
                        background: 'rgba(0, 169, 157, 0.08)',
                        border: '1px solid rgba(0, 169, 157, 0.3)',
                        borderRadius: 12, padding: '16px 20px', marginBottom: 32, textAlign: 'center',
                    }}>
                        <div style={{ fontSize: 18, marginBottom: 4, color: 'var(--primary)' }}><FontAwesomeIcon icon={faBolt} /></div>
                        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>14-Day Free Trial</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                            Your card is authorized today but <strong style={{ color: 'var(--text-secondary)' }}>not charged</strong> until your trial ends.
                        </div>
                    </div>

                    {/* Plan summary */}
                    <div style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                                {planDetails.name} Plan
                            </h2>
                            <Link href="/onboarding/plan" style={{ fontSize: 13, color: 'var(--primary)' }}>Change →</Link>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>After 14-day trial</span>
                            <span style={{ fontWeight: 700, fontSize: 16 }}>{planPrice}</span>
                        </div>
                        <div style={{ background: '#0d0d0f', borderRadius: 8, padding: '14px 16px' }}>
                            {planDetails.features.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: i < planDetails.features.length - 1 ? 8 : 0 }}>
                                    <span style={{ color: 'var(--success)', fontSize: 13 }}>✓</span>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{f}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* What happens after trial */}
                    <div style={{ borderTop: '1px solid #1e1e24', paddingTop: 20, marginBottom: 28 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>What happens next</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {[
                                { step: '1', text: 'Card authorized today — no charge' },
                                { step: '2', text: '14 days of full access begins immediately' },
                                { step: '3', text: `First charge of ${planPrice} on day 15` },
                                { step: '4', text: 'Cancel anytime from your billing dashboard' },
                            ].map(item => (
                                <div key={item.step} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1e1e28', border: '1px solid #2a2a35', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0 }}>{item.step}</div>
                                    <span style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.text}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Payment method picker */}
                    <div style={{ marginBottom: 24 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Payment method</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {PROVIDERS.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setProvider(p.id)}
                                    style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        width: '100%', textAlign: 'left', padding: '12px 16px', borderRadius: 8,
                                        border: provider === p.id ? '1px solid var(--primary)' : '1px solid #2a2a35',
                                        background: provider === p.id ? 'rgba(0, 169, 157, 0.08)' : '#0d0d0f',
                                        cursor: 'pointer', color: 'var(--text-primary)',
                                    }}
                                >
                                    <span style={{ fontWeight: 600, fontSize: 14 }}>{p.label}</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.note}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: 'var(--error)', fontSize: 14 }}>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleStartTrial}
                        className="btn btn-primary"
                        style={{ width: '100%', fontSize: 16, padding: '14px' }}
                        disabled={loading}
                    >
                        {loading ? (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <span className="spinner" />Initializing checkout...
                            </span>
                        ) : 'Start 14-Day Free Trial →'}
                    </button>

                    {/* Trust signals */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 16px', marginTop: 20, color: 'var(--text-muted)', fontSize: 12 }}>
                        <span><FontAwesomeIcon icon={faLock} style={{ marginRight: 5 }} />256-bit SSL</span>
                        <span><FontAwesomeIcon icon={faShield} style={{ marginRight: 5 }} />Secured by {provider === 'PAYSTACK' ? 'Paystack' : provider === 'PAYPAL' ? 'PayPal' : 'Coinbase Commerce'}</span>
                        <span><FontAwesomeIcon icon={faTimes} style={{ marginRight: 5 }} />Cancel anytime</span>
                    </div>
                </div>
            </div>
        </main>
    );
}
