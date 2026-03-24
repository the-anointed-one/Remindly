import Image from 'next/image';
import type { WorkflowStep } from '@/lib/industry-data';

interface IndustryWorkflowProps {
    headline: string;
    steps: WorkflowStep[];
    color: string;
    rgbVar: string;
}

export default function IndustryWorkflow({ headline, steps, color, rgbVar }: IndustryWorkflowProps) {
    return (
        <section style={{ padding: '96px 0', background: 'var(--bg-secondary)' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: 56 }}>
                    <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 38px)', fontWeight: 800, letterSpacing: -1, marginBottom: 12 }}>
                        {headline}
                    </h2>
                </div>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                    gap: 24,
                    position: 'relative',
                }}>
                    {steps.map((step, i) => (
                        <div key={i} style={{ position: 'relative' }}>
                            {/* Connector line (not on last item) */}
                            {i < steps.length - 1 && (
                                <div style={{
                                    position: 'absolute',
                                    top: 28,
                                    right: -12,
                                    width: 24,
                                    height: 2,
                                    background: `linear-gradient(to right, rgba(var(${rgbVar}), 0.4), transparent)`,
                                    zIndex: 1,
                                    display: 'none', // hidden on mobile, visible on desktop via class
                                }} className="workflow-connector" />
                            )}

                            <div className="card" style={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
                                {/* Step number background */}
                                <div style={{
                                    position: 'absolute',
                                    top: -8,
                                    right: -4,
                                    fontSize: 72,
                                    fontWeight: 900,
                                    color: `rgba(var(${rgbVar}), 0.06)`,
                                    lineHeight: 1,
                                    pointerEvents: 'none',
                                    userSelect: 'none',
                                }}>
                                    {step.number}
                                </div>

                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: `rgba(var(${rgbVar}), 0.12)`,
                                    border: `1px solid rgba(var(${rgbVar}), 0.2)`,
                                    fontSize: 14,
                                    fontWeight: 800,
                                    color,
                                    marginBottom: 16,
                                    fontFamily: 'monospace',
                                }}>
                                    {step.number}
                                </div>

                                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, lineHeight: 1.3 }}>
                                    {step.title}
                                </h3>
                                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65 }}>
                                    {step.desc}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Workflow image */}
                <div style={{
                    marginTop: 56,
                    borderRadius: 16,
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    position: 'relative',
                    height: 320,
                }}>
                    <Image
                        src="/images/industries/industry-workflow.jpg"
                        alt="Workflow diagram"
                        fill
                        sizes="(max-width: 1200px) 100vw, 1200px"
                        style={{ objectFit: 'cover' }}
                    />
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.2) 100%)',
                        display: 'flex', alignItems: 'center', padding: '0 48px',
                    }}>
                        <div>
                            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
                                What you see in the dashboard
                            </p>
                            <p style={{ fontSize: 22, fontWeight: 700, color: '#fff', maxWidth: 480 }}>
                                Real-time confirmations. Zero manual work.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @media (min-width: 768px) {
                    .workflow-connector { display: block !important; }
                }
            `}</style>
        </section>
    );
}
