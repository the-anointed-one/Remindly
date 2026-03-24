import { HTMLAttributes } from 'react';

type CardVariant = 'default' | 'glass' | 'brand' | 'accent';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    hover?: boolean;
    accent?: string;
    accentPosition?: 'top' | 'left';
}

const variantStyle: Record<CardVariant, React.CSSProperties> = {
    default: {
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
    },
    glass: {
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
    },
    brand: {
        background: 'var(--bg-card)',
        border: '1px solid rgba(6,147,227,0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        boxShadow: '0 0 20px rgba(6,147,227,0.08)',
    },
    accent: {
        background: 'var(--bg-card)',
        border: '1px solid rgba(255,105,0,0.25)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        boxShadow: '0 0 20px rgba(255,105,0,0.08)',
    },
};

export default function Card({
    variant = 'default',
    hover = false,
    accent,
    accentPosition = 'top',
    children,
    style,
    className = '',
    ...rest
}: CardProps) {
    const base = variantStyle[variant];

    const hoverStyle = hover ? {
        transition: 'border-color 0.25s ease, box-shadow 0.25s ease',
    } : {};

    const accentBar: React.CSSProperties = accent ? (
        accentPosition === 'top'
            ? { position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }
            : { position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: accent, borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)' }
    ) : {};

    return (
        <div
            className={className}
            style={{ ...base, ...hoverStyle, position: accent ? 'relative' : undefined, overflow: accent ? 'hidden' : undefined, ...style }}
            {...rest}
        >
            {accent && <div style={accentBar} />}
            {children}
        </div>
    );
}
