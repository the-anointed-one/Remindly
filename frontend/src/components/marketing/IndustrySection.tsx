'use client';

import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faStethoscope,
    faScissors,
    faWrench,
    faArrowRight,
} from '@fortawesome/free-solid-svg-icons';
import { FadeIn, StaggerGrid, StaggerItem } from '@/components/motion';

const INDUSTRIES = [
    {
        name: 'Dentists',
        href: '/industries/dentists',
        icon: faStethoscope,
        color: 'var(--primary)',
        desc: 'Reduce patient no-shows and keep your clinic running at full capacity with automated reminders.',
    },
    {
        name: 'Auto Repair',
        href: '/industries/auto-repair',
        icon: faWrench,
        color: '#F7941D',
        desc: 'Keep your bays full. Automated service reminders for garages and independent mechanics.',
    },
    {
        name: 'Salons',
        href: '/industries/salons',
        icon: faScissors,
        color: '#6B3E2E',
        desc: 'Keep stylists fully booked. Send on-brand reminders that clients actually read and respond to.',
    },
];

export default function IndustrySection() {
    return (
        <section style={{ padding: '80px 0', background: 'var(--bg-app)' }}>
            <div className="container">
                <FadeIn style={{ textAlign: 'center', marginBottom: 56 }}>
                    <p style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        marginBottom: 12
                    }}>
                        BUILT FOR YOUR BUSINESS
                    </p>
                    <h2 style={{
                        fontSize: 'clamp(28px, 4vw, 42px)',
                        fontWeight: 800,
                        letterSpacing: '-1px',
                        marginBottom: 16
                    }}>
                        Tailored for <span className="text-gradient">Your Industry</span>
                    </h2>
                    <p style={{
                        fontSize: 16,
                        color: 'var(--text-secondary)',
                        maxWidth: 600,
                        margin: '0 auto',
                        lineHeight: 1.6
                    }}>
                        Meetora adapts to your specific workflow. Click your industry to see how we help you eliminate no-shows.
                    </p>
                </FadeIn>

                <StaggerGrid className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {INDUSTRIES.map((industry) => (
                        <StaggerItem key={industry.name} style={{ display: 'flex' }}>
                            <Link
                                href={industry.href}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    padding: '32px',
                                    borderRadius: 'var(--radius-xl)',
                                    background: 'var(--bg-card)',
                                    border: '1px solid var(--border)',
                                    textDecoration: 'none',
                                    width: '100%',
                                    transition: 'all 0.3s ease',
                                    position: 'relative',
                                    overflow: 'hidden',
                                }}
                                className="industry-hover-card"
                            >
                                <div style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 'var(--radius-md)',
                                    background: `${industry.color}15`,
                                    color: industry.color,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 20,
                                    marginBottom: 24,
                                    border: `1px solid ${industry.color}25`
                                }}>
                                    <FontAwesomeIcon icon={industry.icon} />
                                </div>
                                <h3 style={{
                                    fontSize: 20,
                                    fontWeight: 700,
                                    marginBottom: 12,
                                    color: 'var(--text-primary)'
                                }}>
                                    {industry.name}
                                </h3>
                                <p style={{
                                    fontSize: 14,
                                    color: 'var(--text-secondary)',
                                    lineHeight: 1.6,
                                    marginBottom: 24,
                                    flex: 1
                                }}>
                                    {industry.desc}
                                </p>
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: industry.color
                                }}>
                                    Learn more <FontAwesomeIcon icon={faArrowRight} style={{ fontSize: 11 }} />
                                </div>

                                <style jsx>{`
                                    .industry-hover-card:hover {
                                        transform: translateY(-5px);
                                        border-color: ${industry.color}50;
                                        box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.5);
                                    }
                                `}</style>
                            </Link>
                        </StaggerItem>
                    ))}
                </StaggerGrid>
            </div>
        </section>
    );
}
