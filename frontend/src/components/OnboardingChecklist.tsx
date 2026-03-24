'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { faUsers, faCalendar, faPaperPlane, faChartLine, faRocket, faCheck } from '@fortawesome/free-solid-svg-icons';

interface OnboardingChecklistProps {
    hasContacts: boolean;
    hasEvent: boolean;
    hasSentInvite: boolean;
    hasTrackedResponses: boolean;
}

const steps = (d: OnboardingChecklistProps) => [
    { label: 'Import or create contacts', done: d.hasContacts, href: '/dashboard/contacts', icon: <Icon icon={faUsers} /> },
    { label: 'Create your first event', done: d.hasEvent, href: '/dashboard/events', icon: <Icon icon={faCalendar} /> },
    { label: 'Send your first invite', done: d.hasSentInvite, href: '/dashboard/events', icon: <Icon icon={faPaperPlane} /> },
    { label: 'Track responses', done: d.hasTrackedResponses, href: '/dashboard/events', icon: <Icon icon={faChartLine} /> },
];

export function OnboardingChecklist(props: OnboardingChecklistProps) {
    const [dismissed, setDismissed] = useState(false);
    const items = steps(props);
    const completed = items.filter(s => s.done).length;
    const allDone = completed === items.length;

    if (dismissed || allDone) return null;

    const pct = Math.round((completed / items.length) * 100);

    return (
        <div style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.06))',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 14, padding: '20px 24px', marginBottom: 24,
            position: 'relative',
        }}>
            <button
                onClick={() => setDismissed(true)}
                style={{ position: 'absolute', top: 12, right: 14, background: 'none', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: 18 }}
            >×</button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon icon={faRocket} className="text-primary" /> Get Started with Meetora
                    </h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0, marginBottom: 4 }}>
                        Organize your first event and track confirmations automatically.
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: 0 }}>
                        Progress: {completed} / {items.length} completed
                    </p>
                </div>
                <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `conic-gradient(#6366f1 ${pct * 3.6}deg, #1e1e28 0)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#0d0d10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                        {pct}%
                    </div>
                </div>
            </div>

            {/* Progress bar */}
            <div style={{ height: 4, background: '#1e1e28', borderRadius: 4, marginBottom: 16, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: 4, transition: 'width 0.4s ease' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((step, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                            background: step.done ? 'rgba(34,197,94,0.2)' : '#1e1e28',
                            border: `1px solid ${step.done ? 'rgba(34,197,94,0.5)' : '#2a2a35'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                        }}>
                            {step.done ? <Icon icon={faCheck} className="w-2.5 h-2.5 text-success" /> : <span style={{ color: '#4b5563', fontSize: 10 }}>{i + 1}</span>}
                        </div>
                        {step.done ? (
                            <span style={{ fontSize: 14, color: '#4b5563', textDecoration: 'line-through' }}>{step.label}</span>
                        ) : (
                            <Link href={step.href} style={{ fontSize: 14, color: 'var(--text-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
                                {step.icon} {step.label} →
                            </Link>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
