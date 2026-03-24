'use client';

import { useState } from 'react';

interface FeatureBannerProps {
    src: string;
    title: string;
    description: string;
    accent?: string;
}

/**
 * Compact feature showcase banner — fully responsive.
 * Uses a graceful onError fallback to a gradient placeholder so that
 * missing images never cause layout-shift shaking.
 */
export default function FeatureBanner({ src, title, description, accent = '#6366f1' }: FeatureBannerProps) {
    const [imgFailed, setImgFailed] = useState(false);

    return (
        <div style={{
            position: 'relative',
            borderRadius: 14,
            overflow: 'hidden',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            minHeight: 100,
        }}>
            {/* Accent bar */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: accent, flexShrink: 0 }} />

            {/* Text — always visible */}
            <div style={{ flex: 1, padding: '18px 20px 18px 28px', zIndex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                    color: accent, textTransform: 'uppercase' as const, marginBottom: 5,
                }}>
                    Feature Preview
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 5 }}>{title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                    {description}
                </div>
            </div>

            {/* Image panel — fixed fixed size, gradient placeholder on error */}
            <style>{`
                .feature-banner-img {
                    flex-shrink: 0;
                    width: 220px;
                    height: 110px;
                    overflow: hidden;
                    position: relative;
                }
                @media (max-width: 600px) {
                    .feature-banner-img { display: none; }
                }
            `}</style>
            <div className="feature-banner-img">
                {/* Left fade overlay */}
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 1,
                    background: 'linear-gradient(to right, rgba(10,14,26,1) 0%, rgba(10,14,26,0.2) 40%, transparent 100%)',
                }} />
                {!imgFailed ? (
                    // plain <img> with onError — no layout shift, no next/image issues
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={src}
                        alt={title}
                        onError={() => setImgFailed(true)}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
                    />
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, ${accent}25 0%, ${accent}05 100%)`,
                    }} />
                )}
            </div>
        </div>
    );
}
