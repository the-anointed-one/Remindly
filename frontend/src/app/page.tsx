'use client';
import { useState } from 'react';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import HeroCarousel from '@/components/marketing/HeroCarousel';
import IndustrySelector from '@/components/marketing/IndustrySelector';
import IndustryWorkflow from '@/components/marketing/IndustryWorkflow';
import IndustrySection from '@/components/marketing/IndustrySection';
import Link from 'next/link';
import Image from 'next/image';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faCommentSms,
    faPhone,
    faRobot,
    faCalendarCheck,
    faChartBar,
    faBrain,
    faArrowsRotate,
    faStar,
    faBell,
    faCheckCircle,
    faChevronDown,
    faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp, faGoogle } from '@fortawesome/free-brands-svg-icons';
import { FadeIn, StaggerGrid, StaggerItem, SlideIn } from '@/components/motion';
import styles from './page.module.css';

// ── Feature data ──────────────────────────────────────────────────────────────

const FEATURES = [
    {
        icon: faCommentSms,
        color: 'var(--primary)',
        title: 'Automated SMS Reminders',
        desc: 'Send personalised text reminders at exactly the right time — 24h, 1h, or any interval you choose. Clients reply YES to confirm instantly.',
        image: '/images/features/reminders.jpg',
    },
    {
        icon: faWhatsapp,
        color: '#F7941D',
        title: 'WhatsApp Messaging',
        desc: 'Reach clients on the channel they actually read. WhatsApp open rates exceed 90%, making it the most reliable reminder channel available.',
        image: '/images/features/whatsapp.jpg',
    },
    {
        icon: faPhone,
        color: 'var(--primary)',
        title: 'Voice Call Reminders',
        desc: 'For clients who miss texts, an automated voice call confirms the appointment. Press 1 to confirm, 2 to reschedule — no staff required.',
        image: '/images/features/voice.jpg',
    },
    {
        icon: faRobot,
        color: 'var(--accent-cta)',
        title: 'AI Message Generator',
        desc: 'AI writes, improves, and personalises your reminder templates in seconds. Higher confirmation rates without any extra effort from your team.',
        image: '/images/features/ai.jpg',
    },
    {
        icon: faCalendarCheck,
        color: 'var(--primary)',
        title: 'Appointment Confirmations',
        desc: 'Clients confirm with a single reply. Confirmations sync in real time so your team always knows who is coming before the day starts.',
        image: '/images/features/confirmations.jpg',
    },
    {
        icon: faBrain,
        color: 'var(--warning)',
        title: 'AI No-Show Prediction',
        desc: 'Machine learning analyses booking patterns to flag high-risk appointments before the day arrives — giving you time to act.',
        image: '/images/features/prediction.jpg',
    },
    {
        icon: faArrowsRotate,
        color: 'var(--accent-cta)',
        title: 'Smart Rescheduling',
        desc: 'Clients who cannot make it reply RESCHEDULE. An automated flow captures their preferred time and notifies your team immediately.',
        image: '/images/features/rescheduling.jpg',
    },
    {
        icon: faChartBar,
        color: 'var(--primary)',
        title: 'Analytics Dashboard',
        desc: 'Track delivery rates, confirmation rates, and no-show trends by channel, template, and time period. Know exactly what is working.',
        image: '/images/features/analytics.jpg',
    },
    {
        icon: faStar,
        color: 'var(--warning)',
        title: 'Google Review Responder',
        desc: 'Every new Google review gets a thoughtful, on-brand AI reply — protecting your reputation and improving local SEO automatically.',
        image: '/images/features/reviews.jpg',
    },
];

// ── Automation steps ──────────────────────────────────────────────────────────

const FLOW_STEPS = [
    {
        n: '01',
        label: 'Appointment Booked',
        desc: 'Client books in-person or via your booking widget. Meetora picks it up automatically.',
        color: 'var(--primary)',
        icon: faCalendarCheck,
    },
    {
        n: '02',
        label: 'Reminder Sent',
        desc: 'SMS, WhatsApp or Voice reminder fires at your preset interval — 24h and 1h before.',
        color: 'var(--primary)',
        icon: faBell,
    },
    {
        n: '03',
        label: 'Client Confirms',
        desc: 'Client replies YES. Confirmation is logged instantly. Your schedule stays accurate.',
        color: 'var(--primary)',
        icon: faCheckCircle,
    },
    {
        n: '04',
        label: 'No Reply → Escalation',
        desc: 'If no confirmation, an escalation reminder fires via the next channel in your strategy.',
        color: 'var(--warning)',
        icon: faArrowsRotate,
    },
];

// ── Integrations ──────────────────────────────────────────────────────────────

const INTEGRATIONS = [
    {
        icon: faGoogle,
        label: 'Google Calendar',
        desc: 'Two-way sync keeps appointments aligned between Meetora and your calendar in real time.',
        color: '#4285f4', // Google brand color - keeping literal but could use muted if user wants. Actually keeping Google blue is standard.
        bg: 'rgba(66,133,244,0.1)',
    },
    {
        icon: faWhatsapp,
        label: 'WhatsApp Business',
        desc: 'Verified WhatsApp Business API for high-deliverability messaging with read receipts.',
        color: 'var(--success)', 
        bg: 'rgba(var(--color-success-rgb), 0.1)',
    },
    {
        icon: faCommentSms,
        label: 'SMS Gateways',
        desc: 'Multi-provider SMS routing via Twilio for maximum delivery reliability across all networks.',
        color: '#f97316',
        bg: 'rgba(249,115,22,0.1)',
    },
    {
        icon: faCalendarCheck,
        label: 'Paystack Billing',
        desc: 'Secure subscription management with automatic plan upgrades and webhook-verified payments.',
        color: 'var(--primary)',
        bg: 'rgba(var(--primary-rgb), 0.1)',
    },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Home() {
    const [selectedIndustry, setSelectedIndustry] = useState('clinics');

    return (
        <>
            <Navbar />
            <main>

                {/* ── 1. Hero Carousel (parallax lives inside the component) ── */}
                <HeroCarousel />

                {/* Industry selector */}
                <IndustrySelector
                    selected={selectedIndustry}
                    onSelect={setSelectedIndustry}
                />
                <IndustryWorkflow selected={selectedIndustry} />

                {/* ── 2. Industry Selection ─────────────────────── */}
                <IndustrySection />

                {/* ── 3. Features ───────────────────────────────── */}
                <section className={styles.featuresSection} id="features">
                    <div className="container">

                        {/* Section header fades in */}
                        <FadeIn className={styles.sectionHeader}>
                            <p className={styles.eyebrow}>EVERYTHING YOU NEED</p>
                            <h2>The Complete Toolkit for <span className="text-gradient">Eliminating No-Shows</span></h2>
                            <p>Every tool works together in one platform — no integrations to stitch, no manual workflows.</p>
                        </FadeIn>

                        {/* Staggered feature grid */}
                        <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8" stagger={0.06}>
                            {FEATURES.map((f) => (
                                <StaggerItem key={f.title} className={styles.featureCard}>
                                    {/* Image */}
                                    <div className={styles.featureCardImg}>
                                        <Image
                                            src={f.image}
                                            alt={f.title}
                                            fill
                                            sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
                                            style={{ objectFit: 'cover', objectPosition: 'center' }}
                                        />
                                        <div className={styles.featureCardImgOverlay} />
                                    </div>

                                    {/* Body */}
                                    <div className={styles.featureCardBody}>
                                        <div
                                            className={styles.featureCardIcon}
                                            style={{ background: `${f.color}18`, color: f.color }}
                                        >
                                            <FontAwesomeIcon icon={f.icon} />
                                        </div>
                                        <h3 className={styles.featureCardTitle}>{f.title}</h3>
                                        <p className={styles.featureCardDesc}>{f.desc}</p>
                                    </div>
                                </StaggerItem>
                            ))}
                        </StaggerGrid>
                    </div>
                </section>

                {/* ── 4. Automation Workflow ────────────────────── */}
                <section className={styles.automationSection} id="how-it-works">
                    <div className="container">

                        <FadeIn className={styles.sectionHeader}>
                            <p className={styles.eyebrow}>HOW IT WORKS</p>
                            <h2>One Booking. <span className="text-gradient">Fully Automated.</span></h2>
                            <p>Meetora runs your entire reminder workflow without any manual input from your team.</p>
                        </FadeIn>

                        {/* Flow steps — each slides in with a small delay offset */}
                        <div className={styles.flowDiagram}>
                            {FLOW_STEPS.map((step, i) => (
                                <div key={step.n} className={styles.flowItem}>
                                    <SlideIn
                                        direction="up"
                                        delay={i * 0.1}
                                        duration={0.5}
                                        amount={0.1}
                                        style={{ flex: 1, display: 'flex' }}
                                    >
                                        <div className={styles.flowCard} style={{ borderColor: `${step.color}35`, flex: 1 }}>
                                            <div className={styles.flowAccent} style={{ background: step.color }} />
                                            <div className={styles.flowNum} style={{ color: step.color, borderColor: `${step.color}35`, background: `${step.color}10` }}>
                                                {step.n}
                                            </div>
                                            <div className={styles.flowIcon} style={{ color: step.color }}>
                                                <FontAwesomeIcon icon={step.icon} />
                                            </div>
                                            <h3 className={styles.flowLabel}>{step.label}</h3>
                                            <p className={styles.flowDesc}>{step.desc}</p>
                                            {i === 3 && (
                                                <div className={styles.flowBranch}>
                                                    <FontAwesomeIcon icon={faChevronDown} style={{ fontSize: 10, marginRight: 5 }} />
                                                    Escalates via next channel in your strategy
                                                </div>
                                            )}
                                        </div>
                                    </SlideIn>

                                    {i < FLOW_STEPS.length - 1 && (
                                        <div className={styles.flowArrow} aria-hidden>
                                            <FontAwesomeIcon icon={faArrowRight} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        <FadeIn delay={0.3}>
                            <p className={styles.flowNote}>
                                All steps fire automatically based on the rules you configure once. No daily management needed.
                            </p>
                        </FadeIn>
                    </div>
                </section>

                {/* ── 5. Integrations ───────────────────────────── */}
                <section className={styles.integrationsSection}>
                    <div className="container">

                        <FadeIn className={styles.sectionHeader}>
                            <p className={styles.eyebrow}>INTEGRATIONS</p>
                            <h2>Connects to the Tools <span className="text-gradient">You Already Use</span></h2>
                            <p>No complex setup. Meetora connects to your existing calendar, messaging, and payment systems.</p>
                        </FadeIn>

                        <StaggerGrid className={styles.integrationsGrid} stagger={0.08}>
                            {INTEGRATIONS.map((ig) => (
                                <StaggerItem key={ig.label} className={styles.integrationCard}>
                                    <div
                                        className={styles.integrationIcon}
                                        style={{ background: ig.bg, color: ig.color }}
                                    >
                                        <FontAwesomeIcon icon={ig.icon} />
                                    </div>
                                    <h3 className={styles.integrationLabel}>{ig.label}</h3>
                                    <p className={styles.integrationDesc}>{ig.desc}</p>
                                </StaggerItem>
                            ))}
                        </StaggerGrid>
                    </div>
                </section>

                {/* ── 6. Final CTA ──────────────────────────────── */}
                <section className={styles.ctaSection}>
                    <div className="container">
                        <FadeIn y={40} amount={0.2}>
                            <div className={styles.ctaCard}>
                                <div className={styles.ctaGlow} aria-hidden />
                                <p className={styles.eyebrow} style={{ color: 'rgba(255,255,255,0.45)' }}>GET STARTED</p>
                                <h2 className={styles.ctaHeadline}>Start Reducing No-Shows Today</h2>
                                <p className={styles.ctaSubtext}>
                                    14-day free trial. No credit card required. Full access from day one.
                                </p>
                                <div className={styles.ctaButtons}>
                                    <Link href="/register" className="btn btn-primary btn-lg" style={{ background: 'var(--primary)', color: '#000' }}>
                                        Start Free Trial
                                    </Link>
                                    <Link href="/pricing" className="btn btn-ghost btn-lg" style={{ color: 'var(--text-body)', borderColor: 'var(--border)' }}>
                                        View Pricing →
                                    </Link>
                                </div>
                                <p className={styles.ctaTrust}>
                                    <FontAwesomeIcon icon={faCheckCircle} style={{ marginRight: 6, color: 'var(--success)' }} />
                                    No setup fees &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; Secure checkout via Paystack
                                </p>
                            </div>
                        </FadeIn>
                    </div>
                </section>

            </main>
            <Footer />
        </>
    );
}
