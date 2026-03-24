import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCheck, faCommentSms, faPhone, faRobot,
    faCircleCheck, faShield, faCreditCard, faHeadset,
    faChevronRight, faBolt, faChartLine, faUsers,
    faArrowRight, faCalendarCheck,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export const metadata: Metadata = {
    title: 'Pricing — Meetora',
    description: 'Transparent USD pricing for attendance automation. Starter $19/mo, Growth $49/mo, Pro $99/mo. 14-day free trial on all plans.',
    openGraph: {
        title: 'Pricing — Meetora',
        description: 'Transparent USD pricing for attendance automation. Prevent 3–5 no-shows and Meetora pays for itself.',
    },
};

const PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        price: '$19',
        period: '/month',
        desc: 'For small businesses automating their first event reminders.',
        icon: faCommentSms,
        iconColor: '#3b82f6',
        iconRgb: '59, 130, 246',
        badge: null,
        features: [
            'SMS reminders & confirmations',
            'Up to 1,000 contacts',
            'Basic automation rules',
            'Two-way SMS replies',
            'Calendar integration',
            'Email support',
        ],
        cta: 'Start Free Trial',
        popular: false,
    },
    {
        id: 'growth',
        name: 'Growth',
        price: '$49',
        period: '/month',
        desc: 'For growing teams that need multi-channel reach and audience segmentation.',
        icon: faChartLine,
        iconColor: '#00a99d',
        iconRgb: '0, 169, 157',
        badge: 'Most Popular',
        features: [
            'Everything in Starter',
            'SMS + WhatsApp reminders',
            'Audience segments & campaigns',
            'Multi-step automation sequences',
            'Basic analytics dashboard',
            'Priority support',
        ],
        cta: 'Start Free Trial',
        popular: true,
    },
    {
        id: 'pro',
        name: 'Pro',
        price: '$99',
        period: '/month',
        desc: 'Full-stack attendance automation with AI, voice, and review management.',
        icon: faRobot,
        iconColor: '#8b5cf6',
        iconRgb: '139, 92, 246',
        badge: null,
        features: [
            'Everything in Growth',
            'Voice call reminders (IVR)',
            'AI message generation',
            'Smart message suggestions',
            'Google Review automation',
            'Priority delivery & uptime SLA',
            'Dedicated account support',
        ],
        cta: 'Start Free Trial',
        popular: false,
    },
];

const USAGE_RATES = [
    { icon: faCommentSms, channel: 'SMS', rate: '$0.02 – $0.05', unit: 'per message', color: '#3b82f6', note: 'Varies by destination country' },
    { icon: faPhone, channel: 'Voice', rate: '$0.013', unit: 'per minute', color: '#8b5cf6', note: 'IVR confirmation included' },
    { icon: faWhatsapp, channel: 'WhatsApp', rate: '$0.005 – $0.08', unit: 'per conversation', color: '#22c55e', note: 'Meta Business API pricing' },
    { icon: faRobot, channel: 'AI Tokens', rate: 'Token-based', unit: 'GPT-4 rate', color: '#f59e0b', note: '50 requests/mo included on Pro' },
];

const FAQS = [
    {
        q: 'Why is there usage-based pricing on top of the subscription?',
        a: 'Meetora uses real carrier networks (Twilio for SMS/Voice, Meta for WhatsApp) whose costs vary by country and volume. The subscription covers the platform; usage charges reflect actual carrier costs passed through transparently at near-wholesale rates. You always see a full usage breakdown in your billing dashboard.',
    },
    {
        q: 'How does billing transparency work?',
        a: 'Every SMS, voice minute, and WhatsApp conversation is logged and visible in your billing dashboard in real time. You receive an itemised invoice at the end of each billing cycle. There are no surprise charges — you can set spend caps per channel.',
    },
    {
        q: 'How does the free trial work? Do I need a card?',
        a: 'You get 14 days free on any plan. A card is required to start the trial — it will not be charged until the trial ends unless your usage exceeds a nominal threshold. You can cancel any time before the trial ends with no charge.',
    },
    {
        q: 'Can I change plans mid-cycle?',
        a: 'Yes. Upgrades take effect immediately and are prorated for the remainder of the billing cycle. Downgrades take effect at the start of the next cycle.',
    },
    {
        q: 'What happens when I exceed my contact limit on Starter?',
        a: 'You\'ll receive an in-app notification as you approach the limit. Event creation continues but new invitations will be paused until you upgrade or remove inactive contacts.',
    },
    {
        q: 'Is Meetora suitable for large enterprises?',
        a: 'Get in touch for custom volume pricing, dedicated infrastructure, SSO, and SLA guarantees. We support teams managing 50,000+ contacts and hundreds of events per month.',
    },
];

export default function PricingPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 72, background: 'var(--bg-primary)', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>

                {/* ── Hero ──────────────────────────────────── */}
                <section style={{
                    padding: '88px 0 72px', textAlign: 'center',
                    background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,169,157,0.10) 0%, transparent 70%)',
                    borderBottom: '1px solid var(--border)',
                }}>
                    <div className="container" style={{ maxWidth: 680 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
                            PRICING
                        </p>
                        <h1 style={{ fontSize: 'clamp(34px, 5vw, 56px)', fontWeight: 900, letterSpacing: '-2px', lineHeight: 1.06, marginBottom: 18 }}>
                            Invest in Attendance.<br />
                            <span className="text-gradient">Recover It Instantly.</span>
                        </h1>
                        <p style={{ fontSize: 17, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 36 }}>
                            Prevent just 3–5 no-shows and Meetora pays for itself.
                            14-day free trial on every plan. No setup fees, no contracts.
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                            {[
                                { icon: faCircleCheck, text: '14-day free trial' },
                                { icon: faShield, text: 'No setup fees' },
                                { icon: faCreditCard, text: 'Cancel anytime' },
                            ].map((t) => (
                                <span key={t.text} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    <FontAwesomeIcon icon={t.icon} style={{ color: 'var(--primary)', fontSize: 14 }} />
                                    {t.text}
                                </span>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Plans ──────────────────────────────────── */}
                <section style={{ padding: '80px 0' }}>
                    <div className="container">
                        <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, alignItems: 'start' }}>
                            {PLANS.map((plan) => (
                                <div
                                    key={plan.id}
                                    style={{
                                        position: 'relative',
                                        background: plan.popular
                                            ? 'linear-gradient(160deg, var(--bg-card) 0%, rgba(0,169,157,0.04) 100%)'
                                            : 'var(--bg-card)',
                                        border: plan.popular ? '2px solid var(--primary)' : '1px solid var(--border)',
                                        borderRadius: 20,
                                        padding: plan.popular ? '36px 28px 28px' : '28px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        boxShadow: plan.popular ? '0 12px 40px rgba(0,169,157,0.12)' : 'none',
                                    }}
                                >
                                    {plan.badge && (
                                        <div style={{
                                            position: 'absolute', top: -14, left: '50%',
                                            transform: 'translateX(-50%)',
                                            background: 'var(--accent-gradient)',
                                            padding: '4px 18px', borderRadius: 100,
                                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                                            letterSpacing: '0.08em', color: 'white', whiteSpace: 'nowrap',
                                        }}>
                                            {plan.badge}
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                        <div style={{
                                            width: 44, height: 44, borderRadius: 12,
                                            background: `rgba(${plan.iconRgb}, 0.12)`,
                                            border: `1px solid rgba(${plan.iconRgb}, 0.25)`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: plan.iconColor, fontSize: 18,
                                        }}>
                                            <FontAwesomeIcon icon={plan.icon} />
                                        </div>
                                        <h3 style={{ fontSize: 17, fontWeight: 800 }}>{plan.name}</h3>
                                    </div>

                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 20 }}>
                                        {plan.desc}
                                    </p>

                                    <div style={{ marginBottom: 24 }}>
                                        <span style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1 }}>
                                            {plan.price}
                                        </span>
                                        <span style={{ fontSize: 14, color: 'var(--text-muted)', marginLeft: 4 }}>
                                            {plan.period}
                                        </span>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                            + usage charges (see below)
                                        </div>
                                    </div>

                                    <ul style={{ listStyle: 'none', marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 11, flex: 1 }}>
                                        {plan.features.map((f) => (
                                            <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                                                <FontAwesomeIcon icon={faCheck} style={{ color: 'var(--primary)', fontSize: 12, marginTop: 3, flexShrink: 0 }} />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>

                                    <Link
                                        href="/register"
                                        className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ width: '100%', justifyContent: 'center' }}
                                    >
                                        {plan.cta}
                                    </Link>
                                </div>
                            ))}
                        </div>

                        <style>{`
                            @media (max-width: 920px) { .pricing-grid { grid-template-columns: 1fr !important; max-width: 440px; margin: 0 auto; } }
                        `}</style>
                    </div>
                </section>

                {/* ── Usage Pricing ─────────────────────────── */}
                <section style={{ padding: '72px 0', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 48 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                                USAGE PRICING
                            </p>
                            <h2 style={{ fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 900, letterSpacing: '-1px', marginBottom: 14 }}>
                                Pay Only for What You Send
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
                                Carrier costs are passed through at near-wholesale rates with complete transparency.
                                No bundled credits, no surprises.
                            </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20, maxWidth: 900, margin: '0 auto' }}>
                            {USAGE_RATES.map(r => (
                                <div key={r.channel} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: 16, padding: '24px 20px',
                                    borderLeft: `4px solid ${r.color}`,
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                                        <FontAwesomeIcon icon={r.icon} style={{ color: r.color, fontSize: 18 }} />
                                        <span style={{ fontWeight: 800, fontSize: 15 }}>{r.channel}</span>
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 4, color: 'var(--text-primary)' }}>
                                        {r.rate}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{r.unit}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: 6 }}>
                                        {r.note}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── ROI Section ───────────────────────────── */}
                <section style={{ padding: '88px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="container" style={{ maxWidth: 860 }}>
                        <div style={{ textAlign: 'center', marginBottom: 56 }}>
                            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.2px', marginBottom: 14 }}>
                                Meetora Pays for Itself
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 520, margin: '0 auto' }}>
                                Prevent just 3–5 no-shows per month and your subscription is covered — with margin to spare.
                            </p>
                        </div>

                        <div style={{
                            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20,
                        }}>
                            {[
                                { icon: faCalendarCheck, stat: '3–5', label: 'No-shows prevented', sub: 'covers your monthly plan cost', color: '#22c55e' },
                                { icon: faUsers, stat: '68%', label: 'Higher confirmation rate', sub: 'vs. manual follow-ups', color: '#00a99d' },
                                { icon: faBolt, stat: '< 5min', label: 'Setup to first invite', sub: 'zero technical knowledge required', color: '#f59e0b' },
                                { icon: faChartLine, stat: '10×', label: 'Average ROI', sub: 'across service businesses globally', color: '#8b5cf6' },
                            ].map(item => (
                                <div key={item.label} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: 20, padding: '28px 24px', textAlign: 'center',
                                }}>
                                    <div style={{
                                        width: 52, height: 52, borderRadius: 14,
                                        background: `${item.color}15`, color: item.color, fontSize: 22,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        margin: '0 auto 16px',
                                    }}>
                                        <FontAwesomeIcon icon={item.icon} />
                                    </div>
                                    <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-1px', color: item.color, marginBottom: 4 }}>
                                        {item.stat}
                                    </div>
                                    <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{item.label}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{item.sub}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── FAQ ───────────────────────────────────── */}
                <section style={{ padding: '88px 0', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                    <div className="container" style={{ maxWidth: 740 }}>
                        <div style={{ textAlign: 'center', marginBottom: 48 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>
                                FAQ
                            </p>
                            <h2 style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 900, letterSpacing: '-0.75px' }}>
                                Common Questions
                            </h2>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {FAQS.map((faq, i) => (
                                <div
                                    key={i}
                                    style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                                        borderRadius: 16, padding: '22px 24px',
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10 }}>
                                        <h3 style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: 'var(--text-primary)' }}>
                                            {faq.q}
                                        </h3>
                                        <FontAwesomeIcon icon={faChevronRight} style={{ fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} />
                                    </div>
                                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75, margin: 0 }}>
                                        {faq.a}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Feature Comparison ────────────────────── */}
                <section style={{ padding: '80px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 40 }}>
                            <h2 style={{ fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 900, letterSpacing: '-0.75px' }}>
                                Compare Plans
                            </h2>
                        </div>
                        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                            <div style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 20, overflow: 'hidden', minWidth: 560,
                            }}>
                                {/* Header */}
                                <div style={{ padding: '18px 28px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr', gap: 12, alignItems: 'center', background: 'var(--bg-secondary)' }}>
                                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Feature</span>
                                    {PLANS.map(p => (
                                        <span key={p.id} style={{ fontSize: 13, fontWeight: 800, color: p.popular ? 'var(--primary)' : 'var(--text-primary)', textAlign: 'center' }}>
                                            {p.name}
                                        </span>
                                    ))}
                                </div>
                                {[
                                    { label: 'SMS reminders', values: [true, true, true] },
                                    { label: 'Two-way RSVP replies', values: [true, true, true] },
                                    { label: 'WhatsApp messaging', values: [false, true, true] },
                                    { label: 'Audience segments', values: [false, true, true] },
                                    { label: 'Campaign analytics', values: [false, true, true] },
                                    { label: 'Voice call reminders (IVR)', values: [false, false, true] },
                                    { label: 'AI message generation', values: [false, false, true] },
                                    { label: 'Google Review automation', values: [false, false, true] },
                                    { label: 'Priority delivery SLA', values: [false, false, true] },
                                ].map((row, i) => (
                                    <div
                                        key={row.label}
                                        style={{
                                            padding: '13px 28px',
                                            borderBottom: i < 8 ? '1px solid var(--border)' : undefined,
                                            display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
                                            gap: 12, alignItems: 'center',
                                            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                                        }}
                                    >
                                        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{row.label}</span>
                                        {row.values.map((v, j) => (
                                            <div key={j} style={{ display: 'flex', justifyContent: 'center' }}>
                                                {v ? (
                                                    <FontAwesomeIcon icon={faCheck} style={{ color: 'var(--primary)', fontSize: 14 }} />
                                                ) : (
                                                    <span style={{ width: 14, height: 2, background: 'var(--border)', display: 'block', borderRadius: 1 }} />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Bottom CTA ────────────────────────────── */}
                <section style={{ padding: '88px 0', textAlign: 'center' }}>
                    <div className="container" style={{ maxWidth: 600 }}>
                        <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.2px', marginBottom: 16 }}>
                            Start Automating Today
                        </h2>
                        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.7 }}>
                            14 days free. No credit card surprises. Set up your first event in under 5 minutes.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 24 }}>
                            <Link href="/register" className="btn btn-primary btn-lg">
                                Start Free Trial <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 8 }} />
                            </Link>
                            <Link href="/features" className="btn btn-ghost btn-lg">
                                Explore Features
                            </Link>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text-muted)', fontSize: 13 }}>
                            <FontAwesomeIcon icon={faHeadset} style={{ fontSize: 14 }} />
                            Questions? <a href="mailto:hello@meetora.app" style={{ color: 'var(--primary)', fontWeight: 600 }}>hello@meetora.app</a>
                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    );
}
