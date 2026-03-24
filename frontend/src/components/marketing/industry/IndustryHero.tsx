import Image from 'next/image';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface IndustryHeroProps {
    icon: IconDefinition;
    headline: string;
    subheading: string;
    ctaLabel?: string;
    ctaHref?: string;
}

export default function IndustryHero({
    icon,
    headline,
    subheading,
    ctaLabel = 'Start Free Trial →',
    ctaHref = '/register',
}: IndustryHeroProps) {
    return (
        <section style={{ position: 'relative', minHeight: 560, display: 'flex', alignItems: 'center' }}>
            {/* Background image */}
            <Image
                src="/images/industries/industry-hero.jpg"
                alt=""
                fill
                priority
                sizes="100vw"
                style={{ objectFit: 'cover', objectPosition: 'center' }}
            />

            {/* Overlay */}
            <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.45) 100%)',
            }} />

            {/* Content */}
            <div className="container" style={{ position: 'relative', zIndex: 1, padding: '120px 32px 80px' }}>
                <div style={{ maxWidth: 680 }}>
                    <div style={{
                        width: 64, height: 64, borderRadius: 12,
                        background: 'rgba(var(--primary-rgb), 0.15)',
                        border: '1px solid rgba(var(--primary-rgb), 0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 28, color: 'var(--primary)',
                        marginBottom: 24,
                    }}>
                        <FontAwesomeIcon icon={icon} />
                    </div>
                    <h1 style={{
                        fontSize: 'clamp(32px, 5vw, 58px)',
                        fontWeight: 900,
                        letterSpacing: '-1.5px',
                        lineHeight: 1.1,
                        color: '#ffffff',
                        marginBottom: 20,
                        textShadow: '0 2px 20px rgba(0,0,0,0.4)',
                    }}>
                        {headline}
                    </h1>
                    <p style={{
                        fontSize: 'clamp(15px, 2vw, 19px)',
                        color: 'rgba(255,255,255,0.82)',
                        lineHeight: 1.65,
                        marginBottom: 36,
                        maxWidth: 560,
                    }}>
                        {subheading}
                    </p>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        <Link href={ctaHref} className="btn btn-primary btn-lg">
                            {ctaLabel}
                        </Link>
                        <Link
                            href="/pricing"
                            className="btn btn-ghost btn-lg"
                            style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                        >
                            View Pricing →
                        </Link>
                    </div>
                    <p style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                        14-day free trial · No setup fees · Cancel anytime
                    </p>
                </div>
            </div>
        </section>
    );
}
