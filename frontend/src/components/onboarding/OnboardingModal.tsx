'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

interface Props {
    onComplete: () => Promise<void>;
    onSkip: () => Promise<void>;
}

const TOTAL_STEPS = 7;

// ── Shared styles ─────────────────────────────────────────────────────────────

const infoBox: React.CSSProperties = {
    background: 'rgba(0, 169, 157, 0.06)',
    border: '1px solid rgba(0, 169, 157, 0.18)',
    borderRadius: 12,
    padding: '14px 18px',
};

const examplePill: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 12px',
    borderRadius: 100,
    background: 'rgba(0, 169, 157, 0.12)',
    border: '1px solid rgba(0, 169, 157, 0.25)',
    color: 'var(--primary)',
    display: 'inline-block',
};

const flowRow: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
    color: 'var(--text-secondary)',
    fontWeight: 600,
};

// ── Step 0 — Welcome ─────────────────────────────────────────────────────────

function StepWelcome() {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>👋</div>
            <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12, color: 'var(--text-primary)' }}>
                Welcome to Meetora
            </h2>
            <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 380, margin: '0 auto 28px' }}>
                Set up your automated reminder system in a few steps. No coding. No complexity.
            </p>
            <div style={{ ...infoBox, textAlign: 'left', marginBottom: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.05em' }}>
                    THE FLOW
                </div>
                {[
                    { icon: '👥', label: 'Contacts', desc: 'People who receive reminders' },
                    { icon: '🏷️', label: 'Tags', desc: 'Groups contacts by demographics' },
                    { icon: '📣', label: 'Campaign', desc: 'Organizes reminder workflows' },
                    { icon: '🎯', label: 'Audience Segment', desc: 'Targets groups within a campaign' },
                    { icon: '📅', label: 'Appointment', desc: 'Triggers reminders automatically' },
                    { icon: '🔔', label: 'Reminder', desc: 'Sends SMS, WhatsApp, or Voice' },
                ].map((item, i, arr) => (
                    <div key={item.label}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{item.label}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>— {item.desc}</span>
                        </div>
                        {i < arr.length - 1 && (
                            <div style={{ paddingLeft: 10, margin: '1px 0', color: 'var(--text-muted)', fontSize: 12 }}>↓</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Step 1 — Contacts ────────────────────────────────────────────────────────

function StepContacts({ onGoCreate }: { onGoCreate: () => void }) {
    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Create Contacts
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
                    Contacts are the people who receive reminders — your clients, patients, or customers.
                </p>
            </div>

            <div style={{ ...infoBox, marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.05em' }}>
                    EACH CONTACT HAS
                </div>
                {['Name', 'Phone number (for SMS / WhatsApp)', 'Email (optional)', 'Tags (for grouping)'].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: 12 }}>✓</span>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{item}</span>
                    </div>
                ))}
            </div>

            <button onClick={onGoCreate} className="btn btn-primary w-full" style={{ fontSize: 14 }}>
                Add First Contact →
            </button>
        </div>
    );
}

// ── Step 2 — Tags ─────────────────────────────────────────────────────────────

function StepTags() {
    const [tagInput, setTagInput] = useState('');
    const [created, setCreated] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    const handleCreate = useCallback(async () => {
        const name = tagInput.trim();
        if (!name || saving) return;
        setSaving(true);
        try {
            await api.post('/tags', { name });
            setCreated((prev) => [...prev, name.toLowerCase()]);
            setTagInput('');
        } catch {
            // silently fail — user can try again or skip
        } finally {
            setSaving(false);
        }
    }, [tagInput, saving]);

    const examples = ['VIP', 'Webinar Attendees', 'Patients', 'Customers', 'Masterclass'];

    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🏷️</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Organize with Tags
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
                    Tags group contacts by demographics or campaign categories — making it easy to target the right people.
                </p>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                {examples.map((ex) => <span key={ex} style={examplePill}>{ex}</span>)}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                    placeholder="e.g. masterclass_vip"
                    style={{
                        flex: 1, padding: '9px 12px', borderRadius: 8,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', fontSize: 15, outline: 'none',
                    }}
                />
                <button
                    onClick={handleCreate}
                    disabled={!tagInput.trim() || saving}
                    className="btn btn-primary"
                    style={{ fontSize: 13, whiteSpace: 'nowrap' }}
                >
                    {saving ? 'Creating…' : 'Create Tag'}
                </button>
            </div>

            {created.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {created.map((t) => (
                        <span key={t} style={{
                            ...examplePill,
                            background: 'rgba(46, 204, 143, 0.1)',
                            border: '1px solid rgba(46, 204, 143, 0.25)',
                            color: 'var(--success)',
                        }}>
                            ✓ {t}
                        </span>
                    ))}
                </div>
            )}
            {created.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    You can also create tags later from the Contacts page.
                </p>
            )}
        </div>
    );
}

// ── Step 3 — Campaign ─────────────────────────────────────────────────────────

function StepCampaign({ onGoCreate }: { onGoCreate: () => void }) {
    const campaigns = [
        { icon: '🦷', name: 'Dental Recall', desc: 'Recall patients every 6 months' },
        { icon: '🚀', name: 'Startup Masterclass', desc: 'Remind registrants before each session' },
        { icon: '🎉', name: 'Customer Follow-up', desc: 'Check in after a purchase or visit' },
    ];

    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📣</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Create a Campaign
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
                    Campaigns organize your reminder workflows into themed groups. Each campaign can have multiple audience segments.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {campaigns.map((c) => (
                    <div key={c.name} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '11px 14px', borderRadius: 10,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    }}>
                        <span style={{ fontSize: 20, flexShrink: 0 }}>{c.icon}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)' }}>{c.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.desc}</div>
                        </div>
                    </div>
                ))}
            </div>

            <button onClick={onGoCreate} className="btn btn-primary w-full" style={{ fontSize: 14 }}>
                Create First Campaign →
            </button>
        </div>
    );
}

// ── Step 4 — Audience Segment ─────────────────────────────────────────────────

function StepSegment() {
    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🎯</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Define Audience Segments
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
                    Segments target specific groups within a campaign. Link a tag to reach exactly the right contacts.
                </p>
            </div>

            <div style={{ ...infoBox, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12, letterSpacing: '0.05em' }}>
                    EXAMPLE
                </div>
                <div style={{ ...flowRow, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>📣</span>
                    <span>Campaign: <span style={{ color: 'var(--text-primary)' }}>Startup Masterclass</span></span>
                </div>
                <div style={{ paddingLeft: 24, color: 'var(--text-muted)', fontSize: 12, marginBottom: 6 }}>↓ segments</div>
                {[
                    { segment: 'Early Bird', tag: 'masterclass_early' },
                    { segment: 'General Admission', tag: 'masterclass_general' },
                    { segment: 'VIP', tag: 'masterclass_vip' },
                ].map((s) => (
                    <div key={s.segment} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, paddingLeft: 16 }}>
                        <span style={{ color: 'var(--primary)', fontSize: 12 }}>•</span>
                        <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.segment}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>→ tag:</span>
                        <span style={examplePill}>{s.tag}</span>
                    </div>
                ))}
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
                Create segments inside your campaign from the Campaigns page.
            </p>
        </div>
    );
}

// ── Step 5 — Appointment ─────────────────────────────────────────────────────

function StepAppointment() {
    const targets = [
        { icon: '👤', label: 'Specific Contact', desc: 'One customer — their phone/email gets the reminder' },
        { icon: '🏷️', label: 'Tag Group', desc: 'Everyone with a given tag — e.g. all VIPs' },
        { icon: '🎯', label: 'Audience Segment', desc: 'A full segment from a campaign' },
    ];

    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>📅</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Schedule Appointments
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
                    Appointments trigger reminders automatically. You can target a contact, a tag group, or an entire audience segment.
                </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {targets.map((t) => (
                    <div key={t.label} style={{
                        display: 'flex', alignItems: 'flex-start', gap: 12,
                        padding: '12px 14px', borderRadius: 10,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    }}>
                        <span style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>{t.icon}</span>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 2 }}>{t.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.desc}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Step 6 — Reminders ───────────────────────────────────────────────────────

function StepReminders({ onSetUp, onFinish }: { onSetUp: () => void; onFinish: () => void }) {
    const channels = [
        { icon: '💬', label: 'SMS', color: 'var(--primary)', desc: 'Works on any phone, no internet needed' },
        { icon: '📱', label: 'WhatsApp', color: 'var(--success)', desc: 'Rich messages with read receipts' },
        { icon: '📞', label: 'Voice', color: 'var(--accent-cta)', desc: 'Automated call reads the reminder aloud' },
    ];

    return (
        <div>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 44, marginBottom: 12 }}>🔔</div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>
                    Enable Reminders
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: 360, margin: '0 auto' }}>
                    Reminders fire automatically based on rules you define. Choose how they&apos;re delivered.
                </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {channels.map((ch) => (
                    <div key={ch.label} style={{
                        flex: 1, padding: '12px 8px', borderRadius: 10, textAlign: 'center',
                        background: ch.label === 'SMS' ? 'rgba(0, 169, 157, 0.1)' : ch.label === 'WhatsApp' ? 'rgba(46, 204, 143, 0.1)' : 'rgba(247, 148, 29, 0.1)', 
                        border: `1px solid ${ch.label === 'SMS' ? 'rgba(0, 169, 157, 0.3)' : ch.label === 'WhatsApp' ? 'rgba(46, 204, 143, 0.3)' : 'rgba(247, 148, 29, 0.3)'}`,
                    }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{ch.icon}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: ch.color, marginBottom: 3 }}>{ch.label}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>{ch.desc}</div>
                    </div>
                ))}
            </div>

            <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 20,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                fontFamily: 'monospace', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
                Hi Sarah, reminder: your &quot;Startup Masterclass&quot; is tomorrow at 2:00 PM.<br />
                Reply 1 to confirm · 2 to reschedule · 3 to cancel
            </div>

            <button onClick={onSetUp} className="btn btn-primary w-full" style={{ fontSize: 14, marginBottom: 8 }}>
                Set Up Reminders →
            </button>
            <button onClick={onFinish} className="btn btn-ghost w-full" style={{ fontSize: 13 }}>
                Go to Dashboard
            </button>
        </div>
    );
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            {Array.from({ length: total }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        width: i === current ? 18 : 6, height: 6, borderRadius: 100,
                        background: i === current
                            ? 'var(--primary)'
                            : i < current
                                ? 'rgba(0, 169, 157, 0.35)'
                                : 'var(--border)',
                        transition: 'all 0.22s ease',
                    }}
                />
            ))}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OnboardingModal({ onComplete, onSkip }: Props) {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [exiting, setExiting] = useState(false);

    const close = async (fn: () => Promise<void>) => {
        setExiting(true);
        await fn();
    };

    const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    const prev = () => setStep((s) => Math.max(s - 1, 0));

    const goAndComplete = async (path: string) => {
        await close(onComplete);
        router.push(path);
    };

    const isFirst = step === 0;
    const isLast = step === TOTAL_STEPS - 1;

    // Steps with their own primary action (not just "Next")
    const hasDedicatedAction = [1, 3, 6].includes(step);

    return (
        <>
            {/* Backdrop */}
            <div
                style={{
                    position: 'fixed', inset: 0, zIndex: 200,
                    background: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(4px)',
                    WebkitBackdropFilter: 'blur(4px)',
                    opacity: exiting ? 0 : 1,
                    transition: 'opacity 0.25s ease',
                }}
                onClick={() => close(onSkip)}
            />

            {/* Modal */}
            <div
                style={{
                    position: 'fixed', zIndex: 201,
                    top: '50%', left: '50%',
                    transform: `translate(-50%, ${exiting ? '-40%' : '-50%'})`,
                    opacity: exiting ? 0 : 1,
                    transition: 'transform 0.25s ease, opacity 0.25s ease',
                    width: 'min(500px, calc(100vw - 32px))',
                    maxHeight: 'calc(100dvh - 40px)',
                    overflowY: 'auto',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 20,
                    padding: 'clamp(20px, 5vw, 36px)',
                    boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Skip button */}
                <button
                    onClick={() => close(onSkip)}
                    aria-label="Skip onboarding"
                    style={{
                        position: 'absolute', top: 14, right: 14,
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: 12, fontWeight: 600,
                        padding: '6px 10px', borderRadius: 8,
                        transition: 'color 0.14s, background 0.14s',
                    }}
                    onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-secondary)';
                    }}
                    onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
                        (e.currentTarget as HTMLButtonElement).style.background = 'none';
                    }}
                >
                    Skip ✕
                </button>

                {/* Progress */}
                <ProgressDots current={step} total={TOTAL_STEPS} />

                {/* Step content */}
                <div style={{ minHeight: 280 }}>
                    {step === 0 && <StepWelcome />}
                    {step === 1 && <StepContacts onGoCreate={() => goAndComplete('/dashboard/contacts')} />}
                    {step === 2 && <StepTags />}
                    {step === 3 && <StepCampaign onGoCreate={() => goAndComplete('/dashboard/campaigns')} />}
                    {step === 4 && <StepSegment />}
                    {step === 5 && <StepAppointment />}
                    {step === 6 && (
                        <StepReminders
                            onSetUp={() => goAndComplete('/dashboard/reminders')}
                            onFinish={() => close(onComplete)}
                        />
                    )}
                </div>

                {/* Navigation — shown on all steps except last (which has its own buttons) */}
                {!isLast && (
                    <div style={{
                        display: 'flex', alignItems: 'center',
                        justifyContent: isFirst ? 'flex-end' : 'space-between',
                        marginTop: 24, gap: 10,
                    }}>
                        {!isFirst && (
                            <button onClick={prev} className="btn btn-ghost" style={{ fontSize: 14 }}>
                                ← Back
                            </button>
                        )}
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            {hasDedicatedAction && (
                                <button onClick={next} style={{
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    fontSize: 13, color: 'var(--text-muted)', padding: '6px 10px',
                                    borderRadius: 6, fontWeight: 600,
                                    transition: 'color 0.14s',
                                }}
                                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                                >
                                    Skip for now →
                                </button>
                            )}
                            {!hasDedicatedAction && (
                                <button onClick={next} className="btn btn-primary" style={{ fontSize: 14, minWidth: 110 }}>
                                    {step === 0 ? 'Start Setup →' : 'Next →'}
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}
