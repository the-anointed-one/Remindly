import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Pricing — Attendlyx',
    description: 'Simple, transparent pricing. Start free, upgrade when you need more.',
};

const plans = [
    {
        name: 'SMS',
        price: '₦5,000',
        period: '/month',
        desc: 'Perfect for small businesses starting out.',
        features: ['SMS reminders', 'Up to 500 SMS/month', 'Smart scheduling', 'Basic analytics', 'Email support'],
        cta: 'Start Free Trial',
        popular: false,
    },
    {
        name: 'SMS + Voice',
        price: '₦12,000',
        period: '/month',
        desc: 'For growing businesses that need voice calls.',
        features: ['Everything in SMS', 'Voice call reminders', 'IVR confirmation (press 1/2)', 'Up to 1,000 SMS/month', 'Priority support'],
        cta: 'Start Free Trial',
        popular: true,
    },
    {
        name: 'SMS + Voice + AI',
        price: '₦25,000',
        period: '/month',
        desc: 'Full power with AI template optimization.',
        features: ['Everything in SMS + Voice', 'AI template generation', 'AI tone & optimization', 'Confirmation rate optimization', 'Unlimited SMS', '50 AI requests/month', 'Dedicated support'],
        cta: 'Start Free Trial',
        popular: false,
    },
];

export default function PricingPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 120 }}>
                <section className="section">
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 64 }}>
                            <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, marginBottom: 16 }}>
                                Simple, <span className="text-gradient">Transparent</span> Pricing
                            </h1>
                            <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
                                Start with a 14-day free trial. No credit card required. Upgrade when you&apos;re ready.
                            </p>
                        </div>

                        <div className="grid-3">
                            {plans.map((plan) => (
                                <div
                                    key={plan.name}
                                    className="card"
                                    style={{
                                        position: 'relative',
                                        border: plan.popular ? '2px solid var(--accent-primary)' : undefined,
                                        boxShadow: plan.popular ? 'var(--shadow-glow)' : undefined,
                                    }}
                                >
                                    {plan.popular && (
                                        <div style={{
                                            position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                                            background: 'var(--accent-gradient)', padding: '4px 16px', borderRadius: 100,
                                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'white',
                                        }}>
                                            Most Popular
                                        </div>
                                    )}
                                    <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{plan.name}</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>{plan.desc}</p>
                                    <div style={{ marginBottom: 24 }}>
                                        <span style={{ fontSize: 42, fontWeight: 900 }}>{plan.price}</span>
                                        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>{plan.period}</span>
                                    </div>
                                    <ul style={{ listStyle: 'none', marginBottom: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {plan.features.map((f) => (
                                            <li key={f} style={{ fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span> {f}
                                            </li>
                                        ))}
                                    </ul>
                                    <Link
                                        href="/register"
                                        className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ width: '100%' }}
                                    >
                                        {plan.cta}
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
