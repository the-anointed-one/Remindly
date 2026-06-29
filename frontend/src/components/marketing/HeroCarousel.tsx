'use client';

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

// ── Slide data ────────────────────────────────────────────────────────────────

interface Slide {
    headline: string | ReactNode;
    subtext: string;
    cta: { label: string; href: string };
    ctaSecondary?: { label: string; href: string };
    image: string;
    accent: string;
}

const SLIDES: Slide[] = [
    {
        headline: <>Stop No-Shows. <span style={{ color: 'var(--primary)' }}>Automate Attendance.</span></>,
        subtext: 'Send reminders via SMS, WhatsApp, Voice, and Email. Capture RSVPs automatically. Trigger follow-ups. All in one place.',
        cta: { label: 'Get started free', href: '/register' },
        ctaSecondary: { label: 'See How It Works →', href: '/features' },
        image: '/images/hero/slide-1.jpg',
        accent: 'var(--primary)',
    },
    {
        headline: 'Confirm Appointments Automatically via SMS & WhatsApp',
        subtext: 'Clients receive reminders at exactly the right time and reply YES to confirm — no manual follow-up needed from your team.',
        cta: { label: 'Start Free Trial', href: '/register' },
        ctaSecondary: { label: 'View Features →', href: '/features' },
        image: '/images/hero/slide-2.jpg',
        accent: '#FFA500',
    },
    {
        headline: 'AI Writes and Optimises Your Reminder Messages',
        subtext: 'Generate, improve and personalise reminder templates in seconds. Higher confirmation rates with zero extra effort.',
        cta: { label: 'Try AI Free', href: '/register' },
        ctaSecondary: { label: 'Learn More →', href: '/features' },
        image: '/images/hero/slide-3.jpg',
        accent: 'var(--accent-cta)',
    },
];

const AUTOPLAY_MS = 6000;

// ── Animation variants ────────────────────────────────────────────────────────

const CONTENT_VARIANTS = {
    enter: (dir: number) => ({
        x: dir > 0 ? 60 : -60,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
        transition: {
            duration: 0.55,
            ease: [0.4, 0, 0.2, 1] as const,
            staggerChildren: 0.08,
        },
    },
    exit: (dir: number) => ({
        x: dir > 0 ? -40 : 40,
        opacity: 0,
        transition: { duration: 0.3, ease: [0.4, 0, 1, 1] as const },
    }),
};

const ITEM_VARIANTS = {
    enter: { opacity: 0, y: 16 },
    center: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] as const },
    },
    exit: { opacity: 0, y: -8 },
};

const BG_VARIANTS = {
    enter: { opacity: 0, scale: 1.04 },
    center: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] as const },
    },
    exit: {
        opacity: 0,
        scale: 0.98,
        transition: { duration: 0.5, ease: [0.4, 0, 1, 1] as const },
    },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function HeroCarousel() {
    const [current, setCurrent] = useState(0);
    const [direction, setDirection] = useState(1);
    const [paused, setPaused] = useState(false);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const sectionRef = useRef<HTMLElement>(null);
    const reduced = useReducedMotion();

    // Parallax: background moves at ~40% scroll speed (desktop only)
    const { scrollY } = useScroll();
    const parallaxY = useTransform(
        scrollY,
        [0, 900],
        reduced ? [0, 0] : [0, 110],
    );

    const navigate = useCallback((index: number, dir: number) => {
        setDirection(dir);
        setCurrent(index);
    }, []);

    const prev = useCallback(() => {
        navigate((current - 1 + SLIDES.length) % SLIDES.length, -1);
    }, [current, navigate]);

    const next = useCallback(() => {
        navigate((current + 1) % SLIDES.length, 1);
    }, [current, navigate]);

    // Autoplay
    useEffect(() => {
        if (paused) return;
        timerRef.current = setInterval(() => {
            setDirection(1);
            setCurrent((c) => (c + 1) % SLIDES.length);
        }, AUTOPLAY_MS);
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [paused, current]);

    const slide = SLIDES[current];

    return (
        <section
            ref={sectionRef}
            className="hero-section"
            style={{
                position: 'relative',
                height: '100vh',
                minHeight: 600,
                maxHeight: 900,
                overflow: 'hidden',
                background: 'var(--bg-app)',
                contain: 'layout paint',
            }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            aria-label="Hero carousel"
        >
            {/* ── Desktop: full-bleed parallax background ── */}
            <AnimatePresence initial={false} custom={direction}>
                <motion.div
                    key={`bg-${current}`}
                    className="hero-bg-layer"
                    custom={direction}
                    variants={BG_VARIANTS}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    style={{
                        position: 'absolute',
                        inset: '-15% 0',
                        willChange: 'transform, opacity',
                        y: parallaxY,
                    }}
                    aria-hidden
                >
                    <Image
                        src={slide.image}
                        alt=""
                        fill
                        priority={current === 0}
                        unoptimized
                        sizes="100vw"
                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                    />
                </motion.div>
            </AnimatePresence>

            {/* ── Desktop: gradient overlay ── */}
            <div
                className="hero-overlay"
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'linear-gradient(to right, rgba(18,18,26,0.78) 0%, rgba(18,18,26,0.32) 65%, transparent 100%),' +
                        'linear-gradient(to top, rgba(18,18,26,0.55) 0%, transparent 45%)',
                    zIndex: 1,
                }}
            />

            {/* ── Accent line at top ── */}
            <motion.div
                key={`accent-${current}`}
                className="hero-accent-line"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: slide.accent.startsWith('#') ? `linear-gradient(to right, ${slide.accent}, transparent)` : `linear-gradient(to right, ${slide.accent}, transparent)`,
                    transformOrigin: 'left center',
                    zIndex: 2,
                }}
                aria-hidden
            />

            {/* ── Slide content ── */}
            <div
                className="hero-content-wrapper"
                style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'center',
                    pointerEvents: 'none',
                }}
            >
                <div
                    className="hero-content-inner"
                    style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}
                >
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                        <motion.div
                            key={`content-${current}`}
                            className="hero-text-block"
                            custom={direction}
                            variants={CONTENT_VARIANTS}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            style={{
                                maxWidth: 680,
                                pointerEvents: 'auto',
                                willChange: 'transform, opacity',
                            }}
                        >
                            {/* Slide counter badge */}
                            <motion.div variants={ITEM_VARIANTS} style={{ marginBottom: 20 }}>
                                <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: `${slide.accent}cc`,
                                    color: '#fff',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    letterSpacing: '0.07em',
                                    padding: '4px 12px',
                                    borderRadius: 100,
                                    textTransform: 'uppercase',
                                }}>
                                    <span style={{
                                        display: 'inline-block',
                                        width: 6,
                                        height: 6,
                                        borderRadius: '50%',
                                        background: '#fff',
                                        animation: 'heroBlip 1.4s ease-in-out infinite',
                                    }} />
                                    {current + 1} / {SLIDES.length}
                                </span>
                            </motion.div>

                            {/* Headline */}
                            <motion.h1
                                variants={ITEM_VARIANTS}
                                style={{
                                    fontSize: 'clamp(28px, 5vw, 62px)',
                                    fontWeight: 900,
                                    lineHeight: 1.1,
                                    letterSpacing: '-1.5px',
                                    color: '#ffffff',
                                    margin: '0 0 20px',
                                    textShadow: '0 2px 24px rgba(0,0,0,0.45)',
                                }}
                            >
                                {slide.headline}
                            </motion.h1>

                            {/* Subtext */}
                            <motion.p
                                className="hero-subtext"
                                variants={ITEM_VARIANTS}
                                style={{
                                    fontSize: 'clamp(14px, 2vw, 18px)',
                                    color: 'rgba(255,255,255,0.8)',
                                    lineHeight: 1.65,
                                    margin: '0 0 36px',
                                    maxWidth: 520,
                                    textShadow: '0 1px 8px rgba(0,0,0,0.3)',
                                }}
                            >
                                {slide.subtext}
                            </motion.p>

                            {/* CTA buttons */}
                            <motion.div
                                className="hero-cta-row"
                                variants={ITEM_VARIANTS}
                                style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}
                            >
                                <Link
                                    href={slide.cta.href}
                                    className="btn btn-lg hero-cta-primary"
                                    style={{
                                        background: 'var(--primary)',
                                        color: '#000',
                                        boxShadow: `0 4px 24px rgba(247, 148, 29, 0.3)`,
                                    }}
                                >
                                    {slide.cta.label}
                                </Link>
                                {slide.ctaSecondary && (
                                    <Link
                                        href={slide.ctaSecondary.href}
                                        className="btn btn-ghost btn-lg hero-cta-secondary"
                                        style={{ color: '#fff', borderColor: 'var(--primary)' }}
                                    >
                                        {slide.ctaSecondary.label}
                                    </Link>
                                )}
                            </motion.div>

                            {/* Social Proof */}
                            <motion.p
                                variants={ITEM_VARIANTS}
                                style={{
                                    fontSize: 13,
                                    color: 'var(--text-muted)',
                                    marginTop: 12,
                                }}
                            >
                                Trusted by clinics, coaches, and wellness studios. No credit card required.
                            </motion.p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </div>

            {/* ── Navigation arrows (desktop only) ── */}
            <ArrowButton direction="prev" onClick={prev} />
            <ArrowButton direction="next" onClick={next} />

            {/* ── Dot indicators ── */}
            <div
                className="hero-dots-container"
                role="tablist"
                aria-label="Slide indicators"
                style={{
                    position: 'absolute',
                    bottom: 36,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 3,
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                }}
            >
                {SLIDES.map((s, i) => (
                    <button
                        key={i}
                        role="tab"
                        aria-selected={i === current}
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => navigate(i, i > current ? 1 : -1)}
                        style={{ padding: 0, border: 'none', cursor: 'pointer', background: 'none' }}
                    >
                        <motion.span
                            animate={{
                                width: i === current ? 28 : 8,
                                background: i === current ? s.accent : 'rgba(255,255,255,0.35)',
                            }}
                            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                            style={{
                                display: 'block',
                                height: 8,
                                borderRadius: 4,
                                willChange: 'width, background',
                            }}
                        />
                    </button>
                ))}
            </div>

            {/* ── Progress bar (desktop only) ── */}
            {!paused && (
                <div
                    className="hero-progress-bar"
                    aria-hidden
                    style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: 'rgba(255,255,255,0.08)',
                        zIndex: 3,
                    }}
                >
                    <motion.div
                        key={`progress-${current}`}
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: AUTOPLAY_MS / 1000, ease: 'linear' }}
                        style={{
                            height: '100%',
                            background: slide.accent,
                            transformOrigin: 'left center',
                            willChange: 'transform',
                        }}
                    />
                </div>
            )}

            {/* ── Keyframes + responsive styles ── */}
            <style>{`
                @keyframes heroBlip {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.3; }
                }

                /* ── Mobile (≤768px): keep full-bleed background, fix content layout ── */
                @media (max-width: 768px) {

                    /* Hide nav arrows — bg, overlay, dots and progress bar stay */
                    .hero-arrow { display: none !important; }

                    /* Reduce side padding so text doesn't clip on narrow screens */
                    .hero-content-inner {
                        padding: 0 20px !important;
                    }

                    /* Allow text block to use full width */
                    .hero-text-block {
                        max-width: 100% !important;
                    }

                    .hero-subtext {
                        max-width: 100% !important;
                    }

                    /* Stack CTA buttons, each full-width */
                    .hero-cta-row {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 10px !important;
                    }

                    .hero-cta-primary,
                    .hero-cta-secondary {
                        width: 100% !important;
                        justify-content: center !important;
                        text-align: center !important;
                        display: flex !important;
                    }
                }

                /* ── Very small phones ── */
                @media (max-width: 375px) {
                    .hero-content-inner {
                        padding: 0 16px !important;
                    }
                }
            `}</style>
        </section>
    );
}

// ── Arrow button sub-component ────────────────────────────────────────────────

function ArrowButton({ direction, onClick }: { direction: 'prev' | 'next'; onClick: () => void }) {
    const isPrev = direction === 'prev';
    return (
        <motion.button
            className="hero-arrow"
            onClick={onClick}
            aria-label={isPrev ? 'Previous slide' : 'Next slide'}
            whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.22)' }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.15 }}
            style={{
                position: 'absolute',
                top: '50%',
                [isPrev ? 'left' : 'right']: 24,
                transform: 'translateY(-50%)',
                zIndex: 3,
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.18)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                willChange: 'transform',
            }}
        >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {isPrev
                    ? <polyline points="15 18 9 12 15 6" />
                    : <polyline points="9 18 15 12 9 6" />
                }
            </svg>
        </motion.button>
    );
}
