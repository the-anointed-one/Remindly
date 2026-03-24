import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCalendarPlus, faUserGroup, faThumbsUp, faBolt, faChartLine,
    faCommentSms, faPhone, faEnvelope, faCheck, faMobileScreen,
    faTag, faLayerGroup, faUsers, faRobot, faStar, faShieldHalved,
    faArrowRight, faCircle,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export const metadata: Metadata = {
    title: 'Features — Meetora',
    description: 'Stop no-shows. Automate attendance. Meetora handles event invitations, RSVP tracking, automated follow-ups and real-time attendance analytics.',
    openGraph: {
        title: 'Features — Meetora',
        description: 'Stop no-shows. Automate attendance. Meetora handles event invitations, RSVP tracking, automated follow-ups and real-time attendance analytics.',
    },
};

const WORKFLOW_STEPS = [
    {
        number: '01',
        icon: faCalendarPlus,
        title: 'Create Event',
        desc: 'Set up an event or appointment in seconds. Add title, time, location, and audience in one flow.',
        color: '#00a99d',
    },
    {
        number: '02',
        icon: faUserGroup,
        title: 'Invite Audience',
        desc: 'Target contacts by tag, group, or segment. Bulk invite hundreds of people with a single click.',
        color: '#f7941d',
    },
    {
        number: '03',
        icon: faThumbsUp,
        title: 'Capture RSVP',
        desc: 'Guests confirm, decline or reschedule via SMS, WhatsApp, or voice — no app download required.',
        color: '#6366f1',
    },
    {
        number: '04',
        icon: faBolt,
        title: 'Automate Follow-ups',
        desc: 'Rule-based reminders fire automatically. 48h before, 24h before, 1h before — you decide the cadence.',
        color: '#ec4899',
    },
    {
        number: '05',
        icon: faChartLine,
        title: 'Track Attendance',
        desc: 'Live dashboard shows confirmed, pending, and cancelled counts. Export reports in one click.',
        color: '#22c55e',
    },
];

const CHANNELS = [
    { icon: faCommentSms, label: 'SMS', desc: 'Instant delivery to any phone, no data needed', color: '#3b82f6' },
    { icon: faWhatsapp, label: 'WhatsApp', desc: 'Rich messages with buttons to any WhatsApp number', color: '#22c55e' },
    { icon: faPhone, label: 'Voice Calls', desc: 'Automated calls that read reminders aloud via IVR', color: '#8b5cf6' },
    { icon: faEnvelope, label: 'Email', desc: 'Branded emails for formal invitations & confirmations', color: '#f59e0b' },
];

const AUDIENCE_FEATURES = [
    { icon: faTag, title: 'Tags', desc: 'Label contacts with any tag — "VIP", "returning", "dental" — and target them instantly.' },
    { icon: faLayerGroup, title: 'Segments', desc: 'Dynamic groups defined by behavior, tags, or engagement. Always up-to-date automatically.' },
    { icon: faUsers, title: 'Groups', desc: 'Static lists you curate manually. Perfect for recurring cohorts like weekly members.' },
];

const PREMIUM_FEATURES = [
    { icon: faRobot, title: 'AI Message Generation', desc: 'GPT-powered drafting that writes reminder templates from a brief prompt. Adjust tone, length, and channel in one click.' },
    { icon: faChartLine, title: 'Smart Suggestions', desc: 'Meetora analyses your confirmation rates and surfaces higher-performing message alternatives automatically.' },
    { icon: faStar, title: 'Google Review Automation', desc: 'After confirmed attendance, automatically request a review at the perfect moment — when the experience is fresh.' },
    { icon: faShieldHalved, title: 'Insights & Analytics', desc: 'Full-funnel visibility: invites sent → RSVPs received → attendance rate → no-show correlation.' },
];

export default function FeaturesPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 72, background: 'var(--bg-primary)', fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif" }}>

                {/* ── Hero ──────────────────────────────────── */}
                <section style={{
                    padding: '96px 0 80px',
                    textAlign: 'center',
                    background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(0,169,157,0.12) 0%, transparent 70%)',
                    borderBottom: '1px solid var(--border)',
                }}>
                    <div className="container" style={{ maxWidth: 760 }}>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '6px 16px', borderRadius: 100,
                            background: 'rgba(0,169,157,0.1)', border: '1px solid rgba(0,169,157,0.25)',
                            fontSize: 12, fontWeight: 700, letterSpacing: '0.08em',
                            color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 24,
                        }}>
                            <FontAwesomeIcon icon={faCircle} style={{ fontSize: 8 }} />
                            Attendance Automation Platform
                        </div>
                        <h1 style={{
                            fontSize: 'clamp(36px, 6vw, 64px)',
                            fontWeight: 900,
                            letterSpacing: '-2.5px',
                            lineHeight: 1.04,
                            marginBottom: 20,
                        }}>
                            Stop No-Shows.<br />
                            <span className="text-gradient">Automate Attendance.</span>
                        </h1>
                        <p style={{
                            fontSize: 18, color: 'var(--text-secondary)',
                            lineHeight: 1.7, marginBottom: 40, maxWidth: 580, margin: '0 auto 40px',
                        }}>
                            Meetora handles everything after you create an event — invitations, RSVP capture,
                            reminder sequences, and real-time attendance tracking. Automatically.
                        </p>
                        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href="/register" className="btn btn-primary btn-lg">
                                Start Free Trial <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 8 }} />
                            </Link>
                            <Link href="/pricing" className="btn btn-ghost btn-lg">
                                View Pricing
                            </Link>
                        </div>
                    </div>
                </section>

                {/* ── Core Workflow ─────────────────────────── */}
                <section style={{ padding: '96px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 64 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                                HOW IT WORKS
                            </p>
                            <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 16 }}>
                                The Full Attendance Loop
                            </h2>
                            <p style={{ fontSize: 16, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
                                Five steps. Fully automated. From event creation to post-attendance follow-up.
                            </p>
                        </div>

                        {/* Stepper */}
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: 0,
                            position: 'relative',
                        }}>
                            <style>{`
                                @media (max-width: 900px) {
                                    .workflow-connector { display: none !important; }
                                    .workflow-stepper { grid-template-columns: 1fr !important; max-width: 420px; margin: 0 auto; }
                                }
                            `}</style>
                            {WORKFLOW_STEPS.map((step, i) => (
                                <div key={step.number} className="workflow-stepper" style={{ position: 'relative' }}>
                                    {/* Connector line */}
                                    {i < WORKFLOW_STEPS.length - 1 && (
                                        <div className="workflow-connector" style={{
                                            position: 'absolute', top: 36, left: '60%', right: '-40%',
                                            height: 2, background: `linear-gradient(90deg, ${step.color}60, transparent)`,
                                            zIndex: 0,
                                        }} />
                                    )}
                                    <div style={{
                                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                                        borderRadius: 20, padding: '28px 24px', margin: '0 8px',
                                        position: 'relative', zIndex: 1, height: '100%',
                                        transition: 'border-color 0.2s',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                                            <div style={{
                                                width: 48, height: 48, borderRadius: 14,
                                                background: `${step.color}18`,
                                                border: `1px solid ${step.color}35`,
                                                color: step.color, fontSize: 20,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <FontAwesomeIcon icon={step.icon} />
                                            </div>
                                            <span style={{
                                                fontSize: 11, fontWeight: 800, letterSpacing: '0.1em',
                                                color: step.color, opacity: 0.6,
                                            }}>
                                                STEP {step.number}
                                            </span>
                                        </div>
                                        <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 10, letterSpacing: '-0.3px' }}>
                                            {step.title}
                                        </h3>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                            {step.desc}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Auto-RSVP Highlight ───────────────────── */}
                <section style={{
                    padding: '96px 0',
                    background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(0,169,157,0.06) 0%, transparent 70%)',
                    borderBottom: '1px solid var(--border)',
                }}>
                    <div className="container">
                        <div style={{
                            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
                            gap: 64, alignItems: 'center',
                        }}>
                            <style>{`
                                @media (max-width: 768px) { .rsvp-grid { grid-template-columns: 1fr !important; } }
                            `}</style>
                            <div className="rsvp-grid">
                                <div style={{
                                    display: 'inline-flex', alignItems: 'center', gap: 8,
                                    padding: '5px 14px', borderRadius: 100,
                                    background: 'rgba(0,169,157,0.1)', border: '1px solid rgba(0,169,157,0.3)',
                                    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                                    color: 'var(--primary)', textTransform: 'uppercase', marginBottom: 20,
                                }}>
                                    ⚡ SIGNATURE FEATURE
                                </div>
                                <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 20, lineHeight: 1.1 }}>
                                    Auto-RSVP That<br />
                                    <span className="text-gradient">Actually Works</span>
                                </h2>
                                <p style={{ fontSize: 16, color: 'var(--text-secondary)', lineHeight: 1.75, marginBottom: 32 }}>
                                    Guests reply directly to SMS, WhatsApp, or a voice prompt — no links, no apps,
                                    no friction. Meetora instantly captures their response and updates your attendance
                                    dashboard in real time.
                                </p>
                                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
                                    {[
                                        'Reply YES / NO / MAYBE to SMS or WhatsApp',
                                        'Press 1 to confirm, 2 to cancel on voice calls',
                                        'System auto-updates attendance status instantly',
                                        'Late starters get automatic follow-up nudges',
                                    ].map(item => (
                                        <li key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: 'var(--text-secondary)' }}>
                                            <FontAwesomeIcon icon={faCheck} style={{ color: 'var(--primary)', fontSize: 12, marginTop: 3, flexShrink: 0 }} />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Visual mock */}
                            <div style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: 24, padding: 32,
                                boxShadow: '0 24px 80px rgba(0,0,0,0.12)',
                            }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 20 }}>
                                    Live RSVP Status
                                </div>
                                {[
                                    { name: 'Sarah K.', status: 'Confirmed', color: '#22c55e', time: 'Just now' },
                                    { name: 'Michael T.', status: 'Confirmed', color: '#22c55e', time: '2 min ago' },
                                    { name: 'Amara O.', status: 'Declined', color: '#ef4444', time: '5 min ago' },
                                    { name: 'James L.', status: 'Pending', color: '#f59e0b', time: '8 min ago' },
                                    { name: 'Fatima S.', status: 'Confirmed', color: '#22c55e', time: '12 min ago' },
                                ].map((row) => (
                                    <div key={row.name} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '12px 0', borderBottom: '1px solid var(--border)',
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '50%',
                                                background: 'rgba(0,169,157,0.15)', color: 'var(--primary)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 12, fontWeight: 800,
                                            }}>
                                                {row.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <span style={{ fontSize: 14, fontWeight: 600 }}>{row.name}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <span style={{
                                                fontSize: 11, fontWeight: 700, padding: '3px 10px',
                                                borderRadius: 100, color: row.color,
                                                background: `${row.color}18`, border: `1px solid ${row.color}35`,
                                            }}>
                                                {row.status}
                                            </span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.time}</span>
                                        </div>
                                    </div>
                                ))}
                                <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                                    {[
                                        { label: 'Confirmed', value: '3', color: '#22c55e' },
                                        { label: 'Pending', value: '1', color: '#f59e0b' },
                                        { label: 'Declined', value: '1', color: '#ef4444' },
                                    ].map(stat => (
                                        <div key={stat.label} style={{
                                            textAlign: 'center', padding: '12px 8px',
                                            background: 'var(--bg-secondary)', borderRadius: 10,
                                            border: '1px solid var(--border)',
                                        }}>
                                            <div style={{ fontSize: 22, fontWeight: 900, color: stat.color }}>{stat.value}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ── Channels ──────────────────────────────── */}
                <section style={{ padding: '96px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 56 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                                MESSAGING CHANNELS
                            </p>
                            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.2px', marginBottom: 14 }}>
                                Reach Guests Wherever They Are
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
                                Set up multi-channel reminder sequences so no guest is left behind.
                            </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
                            {CHANNELS.map(ch => (
                                <div key={ch.label} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: 20, padding: '28px 24px',
                                    borderTop: `3px solid ${ch.color}`,
                                }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14,
                                        background: `${ch.color}15`, color: ch.color, fontSize: 22,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 16,
                                    }}>
                                        <FontAwesomeIcon icon={ch.icon} />
                                    </div>
                                    <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{ch.label}</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{ch.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── Audience Targeting ───────────────────── */}
                <section style={{ padding: '96px 0', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 56 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
                                AUDIENCE TARGETING
                            </p>
                            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.2px', marginBottom: 14 }}>
                                Invite the Right People, Every Time
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 480, margin: '0 auto' }}>
                                Precision targeting with tags, dynamic segments, and curated groups.
                            </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24 }}>
                            {AUDIENCE_FEATURES.map(f => (
                                <div key={f.title} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: 20, padding: '32px 28px',
                                }}>
                                    <div style={{
                                        width: 52, height: 52, borderRadius: 14,
                                        background: 'rgba(0,169,157,0.1)', color: 'var(--primary)', fontSize: 22,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 20,
                                    }}>
                                        <FontAwesomeIcon icon={f.icon} />
                                    </div>
                                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>{f.title}</h3>
                                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.75 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── AI Messaging ─────────────────────────── */}
                <section style={{ padding: '96px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 56 }}>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: '5px 14px', borderRadius: 100,
                                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                                fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                                color: '#818cf8', textTransform: 'uppercase', marginBottom: 20,
                            }}>
                                ✦ PREMIUM FEATURES
                            </div>
                            <h2 style={{ fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 900, letterSpacing: '-1.2px', marginBottom: 14 }}>
                                AI-Powered Intelligence
                            </h2>
                            <p style={{ fontSize: 15, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto' }}>
                                Meetora Pro includes GPT-powered message generation, smart suggestions, and
                                review automation built straight into your workflow.
                            </p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
                            {PREMIUM_FEATURES.map(f => (
                                <div key={f.title} style={{
                                    background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(99,102,241,0.04) 100%)',
                                    border: '1px solid rgba(99,102,241,0.2)',
                                    borderRadius: 20, padding: '28px 24px',
                                }}>
                                    <div style={{
                                        width: 48, height: 48, borderRadius: 14,
                                        background: 'rgba(99,102,241,0.12)', color: '#818cf8', fontSize: 20,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        marginBottom: 16,
                                    }}>
                                        <FontAwesomeIcon icon={f.icon} />
                                    </div>
                                    <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>{f.title}</h3>
                                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ── CTA ──────────────────────────────────── */}
                <section style={{ padding: '96px 0', textAlign: 'center' }}>
                    <div className="container" style={{ maxWidth: 600 }}>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, letterSpacing: '-1.5px', marginBottom: 16 }}>
                            Ready to Eliminate No-Shows?
                        </h2>
                        <p style={{ fontSize: 16, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.7 }}>
                            Start your 14-day free trial. No credit card required to explore.
                            Set up your first event in under 5 minutes.
                        </p>
                        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                            <Link href="/register" className="btn btn-primary btn-lg">
                                Start Free Trial <FontAwesomeIcon icon={faArrowRight} style={{ marginLeft: 8 }} />
                            </Link>
                            <Link href="/pricing" className="btn btn-ghost btn-lg">
                                See Pricing
                            </Link>
                        </div>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    );
}
