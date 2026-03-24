import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { faLightbulb } from '@fortawesome/free-solid-svg-icons';
import type { ROIStat } from '@/lib/industry-data';

interface IndustryROIProps {
    headline: string;
    stats: ROIStat[];
    example: string;
    color: string;
    rgbVar: string;
}

export default function IndustryROI({ headline, stats, example, color, rgbVar }: IndustryROIProps) {
    return (
        <section style={{ padding: '96px 0', background: 'var(--bg-secondary)' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{
                        fontSize: 'clamp(26px, 3.5vw, 38px)',
                        fontWeight: 800,
                        letterSpacing: -1,
                        marginBottom: 12,
                    }}>
                        {headline}
                    </h2>
                </div>

                {/* Stats grid */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: 20,
                    marginBottom: 40,
                }}>
                    {stats.map((stat, i) => (
                        <div key={i} className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
                            <div style={{
                                fontSize: 'clamp(28px, 4vw, 42px)',
                                fontWeight: 900,
                                color,
                                marginBottom: 8,
                                lineHeight: 1,
                            }}>
                                {stat.value}
                            </div>
                            <div style={{
                                fontSize: 13,
                                color: 'var(--text-muted)',
                                lineHeight: 1.5,
                            }}>
                                {stat.label}
                            </div>
                        </div>
                    ))}
                </div>

                {/* ROI example */}
                <div style={{
                    background: `linear-gradient(135deg, rgba(var(${rgbVar}), 0.08), rgba(var(${rgbVar}), 0.04))`,
                    border: `1px solid rgba(var(${rgbVar}), 0.15)`,
                    borderRadius: 16,
                    padding: '32px 36px',
                    display: 'flex',
                    gap: 20,
                    alignItems: 'flex-start',
                }}>
                    <div style={{
                        fontSize: 28,
                        flexShrink: 0,
                        marginTop: 2,
                        color: color,
                    }}>
                        <Icon icon={faLightbulb} />
                    </div>
                    <div>
                        <p style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            color: 'var(--text-muted)',
                            marginBottom: 8,
                            textTransform: 'uppercase',
                        }}>
                            ROI EXAMPLE
                        </p>
                        <p style={{
                            fontSize: 16,
                            color: 'var(--text-secondary)',
                            lineHeight: 1.7,
                        }}>
                            {example}
                        </p>
                    </div>
                </div>

                {/* Bottom CTA */}
                <div style={{ textAlign: 'center', marginTop: 56 }}>
                    <Link href="/register" className="btn btn-primary btn-lg">
                        Start Your Free Trial →
                    </Link>
                    <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                        14 days free · Card required to activate · Cancel anytime
                    </p>
                </div>
            </div>
        </section>
    );
}
