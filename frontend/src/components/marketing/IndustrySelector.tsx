'use client';

import Image from 'next/image';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faStethoscope, faScissors, faBullseye,
    faDesktop, faDumbbell, faBuilding, faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { FadeIn, StaggerGrid, StaggerItem } from '@/components/motion';

interface Industry {
    slug: string;
    icon: React.ReactNode;
    title: string;
    description: string;
    image: string;
    color: string;
    rgb: string;
    href: string;
}

const INDUSTRIES: Industry[] = [
    {
        slug: 'medical',
        icon: <FontAwesomeIcon icon={faStethoscope} />,
        title: 'Medical Clinics',
        description: 'Reduce patient no-shows and keep your clinic running at full capacity with automated appointment reminders.',
        image: '/images/industries/industry-dentist.jpg',
        color: 'var(--primary)',
        rgb: 'var(--primary-rgb)',
        href: '/industries/dentists',
    },
    {
        slug: 'salons',
        icon: <FontAwesomeIcon icon={faScissors} />,
        title: 'Salons & Beauty',
        description: 'Keep stylists fully booked. Send on-brand reminders that clients actually read and respond to.',
        image: '/images/industries/industry-salon.jpg',
        color: '#6B3E2E',
        rgb: '107, 62, 46',
        href: '/industries/salons',
    },
    {
        slug: 'coaches',
        icon: <FontAwesomeIcon icon={faBullseye} />,
        title: 'Coaches & Consultants',
        description: 'Never lose a session to a no-show. Remind clients of calls, workshops, and follow-up sessions automatically.',
        image: '/images/industries/industry-coach.jpg',
        color: 'var(--primary)',
        rgb: '247, 148, 29',
        href: '/industries/coaches',
    },
    {
        slug: 'webinars',
        icon: <FontAwesomeIcon icon={faDesktop} />,
        title: 'Webinars & Events',
        description: 'Turn registrations into real attendees. Timed SMS and WhatsApp reminders double your live attendance.',
        image: '/images/industries/industry-webinar.jpg',
        color: 'var(--primary)',
        rgb: 'var(--primary-rgb)',
        href: '/industries/webinars',
    },
    {
        slug: 'fitness',
        icon: <FontAwesomeIcon icon={faDumbbell} />,
        title: 'Fitness Studios',
        description: 'Keep classes full and members engaged. Automated session reminders reduce last-minute cancellations.',
        image: '/images/industries/industry-event.jpg',
        color: 'var(--accent-cta)',
        rgb: 'var(--accent-cta-rgb)',
        href: '/register',
    },
    {
        slug: 'other',
        icon: <FontAwesomeIcon icon={faBuilding} />,
        title: 'Other Businesses',
        description: 'Any business that runs on appointments can eliminate no-shows with fully customisable reminder workflows.',
        image: '/images/industries/industry-dentist.jpg',
        color: 'var(--primary)',
        rgb: 'var(--primary-rgb)',
        href: '/register',
    },
];

export default function IndustrySelector() {
    return (
        <section className="industry-selector">
            <div className="container">

                {/* ── Header ── */}
                <FadeIn className="industry-header">
                    <p className="industry-eyebrow">BUILT FOR YOUR BUSINESS</p>
                    <h2 className="industry-title">
                        What Type of Business <span className="text-gradient">Are You?</span>
                    </h2>
                    <p className="industry-subtitle">
                        Meetora adapts to your industry. Pick your category to see tailored features, pricing, and ROI examples.
                    </p>
                </FadeIn>

                {/* ── Grid — Tailwind responsive columns ── */}
                <StaggerGrid className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {INDUSTRIES.map((ind) => (
                        <StaggerItem key={ind.slug} style={{ display: 'flex' }}>
                            <Link
                                href={ind.href}
                                className="industry-card"
                                style={{ '--card-color': ind.color } as React.CSSProperties}
                            >
                                {/* ── Image placeholder ── */}
                                <div className="industry-card-img">
                                    {/* Colour-tinted fallback sits behind the image */}
                                    <div
                                        className="industry-card-img-bg"
                                        style={{ background: `rgba(${(ind as any).rgb}, 0.12)` }}
                                        aria-hidden
                                    />
                                    <Image
                                        src={ind.image}
                                        alt={ind.title}
                                        fill
                                        sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 25vw"
                                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                                    />
                                    {/* Accent stripe at the top of the image */}
                                    <div
                                        className="industry-card-stripe"
                                        style={{ background: ind.color }}
                                        aria-hidden
                                    />
                                </div>

                                {/* ── Card content ── */}
                                <div className="industry-card-body">
                                    {/* Icon badge */}
                                    <div
                                        className="industry-card-icon"
                                        style={{
                                            background: `rgba(${(ind as any).rgb}, 0.12)`,
                                            color: ind.color,
                                            border: `1px solid rgba(${(ind as any).rgb}, 0.25)`,
                                        }}
                                    >
                                        {ind.icon}
                                    </div>

                                    <h3 className="industry-card-title">{ind.title}</h3>
                                    <p className="industry-card-desc">{ind.description}</p>

                                    <span className="industry-card-cta">
                                        Learn more
                                        <FontAwesomeIcon
                                            icon={faArrowRight}
                                            style={{ marginLeft: 6, fontSize: 11 }}
                                        />
                                    </span>
                                </div>
                            </Link>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>

            <style>{`
                .industry-selector {
                    padding: 100px 0;
                    background: var(--bg-app);
                }

                /* ── Section header ── */
                .industry-header {
                    text-align: center;
                    max-width: 600px;
                    margin: 0 auto 56px;
                }
                .industry-eyebrow {
                    font-size: 11px;
                    font-weight: 700;
                    letter-spacing: 0.12em;
                    color: var(--text-muted);
                    margin-bottom: 12px;
                }
                .industry-title {
                    font-size: clamp(28px, 4vw, 42px);
                    font-weight: 800;
                    letter-spacing: -1px;
                    line-height: 1.15;
                    margin-bottom: 14px;
                }
                .industry-subtitle {
                    font-size: 16px;
                    color: var(--text-secondary);
                    line-height: 1.65;
                }

                /* ── Card shell ── */
                .industry-card {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    background: var(--bg-card); /* bg-surface */
                    border: 1px solid var(--border);
                    border-radius: var(--radius-xl);
                    overflow: hidden;
                    text-decoration: none;
                    transition: transform 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease;
                }
                .industry-card:hover {
                    transform: translateY(-4px);
                    border-color: var(--card-color, #6366f1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
                }

                /* ── Image area ── */
                .industry-card-img {
                    position: relative;
                    height: 160px;
                    overflow: hidden;
                    flex-shrink: 0;
                    background: var(--bg-app);
                }
                .industry-card-img-bg {
                    position: absolute;
                    inset: 0;
                }
                .industry-card-stripe {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 3px;
                    z-index: 1;
                }

                /* ── Content area ── */
                .industry-card-body {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    padding: 20px;
                }

                /* Icon badge */
                .industry-card-icon {
                    width: 38px;
                    height: 38px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: var(--radius-md);
                    font-size: 15px;
                    margin-bottom: 14px;
                    flex-shrink: 0;
                }

                .industry-card-title {
                    font-size: 15px;
                    font-weight: 700;
                    color: var(--text-primary);
                    margin-bottom: 8px;
                    line-height: 1.3;
                }
                .industry-card-desc {
                    font-size: 13px;
                    color: var(--text-secondary);
                    line-height: 1.65;
                    flex: 1;
                    margin-bottom: 16px;
                }

                /* CTA link */
                .industry-card-cta {
                    display: inline-flex;
                    align-items: center;
                    font-size: 12px;
                    font-weight: 600;
                    color: var(--card-color, #6366f1);
                    opacity: 0;
                    transform: translateY(4px);
                    transition: opacity 0.18s ease, transform 0.18s ease;
                }
                .industry-card:hover .industry-card-cta {
                    opacity: 1;
                    transform: translateY(0);
                }

                /* ── Responsive tweaks ── */
                @media (max-width: 640px) {
                    .industry-selector { padding: 64px 0; }
                    .industry-card-img { height: 180px; }
                }
            `}</style>
        </section>
    );
}
