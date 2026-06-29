'use client';

import Link from 'next/link';
import Icon from './ui/Icon';
import { IconDefinition } from '@fortawesome/free-solid-svg-icons';

interface EmptyStateProps {
    title: string;
    description: string;
    icon?: IconDefinition;
    ctaLabel?: string;
    ctaHref?: string;
    ctaAction?: () => void;
    ctaLabel2?: string;
    ctaHref2?: string;
    ctaAction2?: () => void;
}

export default function EmptyState({
    title,
    description,
    icon,
    ctaLabel,
    ctaHref,
    ctaAction,
    ctaLabel2,
    ctaHref2,
    ctaAction2,
}: EmptyStateProps) {
    return (
        <div className="card" style={{
            textAlign: 'center',
            padding: 'clamp(40px, 8vw, 80px) 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
        }}>
            {icon && (
                <div style={{
                    fontSize: 48,
                    color: 'var(--text-muted)',
                    opacity: 0.5,
                    marginBottom: 8,
                }}>
                    <Icon icon={icon} />
                </div>
            )}
            <div style={{ maxWidth: 400 }}>
                <h3 style={{
                    fontSize: 20,
                    fontWeight: 800,
                    marginBottom: 8,
                    color: 'var(--text-primary)',
                }}>
                    {title}
                </h3>
                <p style={{
                    fontSize: 15,
                    color: 'var(--text-muted)',
                    lineHeight: 1.6,
                    marginBottom: (ctaLabel || ctaLabel2) ? 24 : 0,
                }}>
                    {description}
                </p>
                {(ctaLabel || ctaLabel2) && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {ctaLabel && (
                            ctaHref ? (
                                <Link href={ctaHref} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                                    {ctaLabel}
                                </Link>
                            ) : (
                                <button onClick={ctaAction} className="btn btn-primary" style={{ padding: '10px 24px' }}>
                                    {ctaLabel}
                                </button>
                            )
                        )}
                        {ctaLabel2 && (
                            ctaHref2 ? (
                                <Link href={ctaHref2} className="btn btn-outline" style={{ padding: '10px 24px' }}>
                                    {ctaLabel2}
                                </Link>
                            ) : (
                                <button onClick={ctaAction2} className="btn btn-outline" style={{ padding: '10px 24px' }}>
                                    {ctaLabel2}
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
