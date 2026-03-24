interface IndustryTestimonialProps {
    quote: string;
    name: string;
    title: string;
    result: string;
    color: string;
    rgbVar: string;
}

export default function IndustryTestimonial({
    quote,
    name,
    title,
    result,
    color,
    rgbVar,
}: IndustryTestimonialProps) {
    return (
        <section style={{ padding: '96px 0', background: 'var(--bg-base)' }}>
            <div className="container">
                <div style={{ maxWidth: 800, margin: '0 auto' }}>
                    <div style={{
                        background: `linear-gradient(135deg, rgba(var(${rgbVar}), 0.08), rgba(var(${rgbVar}), 0.04))`,
                        border: `1px solid rgba(var(${rgbVar}), 0.15)`,
                        borderLeft: `4px solid ${color}`,
                        borderRadius: 16,
                        padding: '48px 48px 40px',
                        position: 'relative',
                        overflow: 'hidden',
                    }}>
                        {/* Large quote mark */}
                        <div style={{
                            position: 'absolute',
                            top: -16,
                            left: 36,
                            fontSize: 120,
                            lineHeight: 1,
                            color: `rgba(var(${rgbVar}), 0.12)`,
                            fontFamily: 'Georgia, serif',
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}>
                            "
                        </div>

                        {/* Result badge */}
                        <div style={{ marginBottom: 24 }}>
                            <span style={{
                                display: 'inline-block',
                                background: `rgba(var(${rgbVar}), 0.12)`,
                                color,
                                fontSize: 12,
                                fontWeight: 700,
                                padding: '4px 12px',
                                borderRadius: 100,
                                letterSpacing: '0.05em',
                            }}>
                                ✓ {result}
                            </span>
                        </div>

                        <p style={{
                            fontSize: 'clamp(17px, 2.2vw, 22px)',
                            lineHeight: 1.65,
                            color: 'var(--text-primary)',
                            fontStyle: 'italic',
                            marginBottom: 32,
                            position: 'relative',
                            zIndex: 1,
                        }}>
                            "{quote}"
                        </p>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {/* Avatar placeholder */}
                            <div style={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                background: `rgba(var(${rgbVar}), 0.12)`,
                                border: `2px solid rgba(var(${rgbVar}), 0.25)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                flexShrink: 0,
                            }}>
                                {name.charAt(0)}
                            </div>
                            <div>
                                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>
                                    {name}
                                </p>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{title}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
