import { HTMLAttributes } from 'react';

type SectionVariant = 'default' | 'brand' | 'dark' | 'light' | 'gradient';

interface SectionProps extends HTMLAttributes<HTMLElement> {
    variant?: SectionVariant;
    as?: 'section' | 'div' | 'article' | 'main';
    centered?: boolean;
    narrow?: boolean;
}

const variantStyle: Record<SectionVariant, React.CSSProperties> = {
    default: { background: 'var(--bg-primary)', color: 'var(--text-primary)' },
    brand:   { background: 'linear-gradient(135deg, rgba(6,147,227,0.08) 0%, rgba(0,208,132,0.06) 100%)', color: 'var(--text-primary)' },
    dark:    { background: 'var(--bg-secondary)', color: 'var(--text-primary)' },
    light:   { background: 'var(--brand-surface-2)', color: 'var(--brand-dark)' },
    gradient:{ background: 'var(--brand-gradient)', color: '#ffffff' },
};

export default function Section({
    variant = 'default',
    as: Tag = 'section',
    centered = false,
    narrow = false,
    children,
    style,
    className = '',
    ...rest
}: SectionProps) {
    return (
        <Tag
            className={className}
            style={{
                ...variantStyle[variant],
                padding: '64px 24px',
                textAlign: centered ? 'center' : undefined,
                maxWidth: narrow ? 800 : undefined,
                margin: narrow ? '0 auto' : undefined,
                ...style,
            }}
            {...rest}
        >
            {children}
        </Tag>
    );
}
