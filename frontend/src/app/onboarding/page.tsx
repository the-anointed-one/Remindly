'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { faUsers, faCalendar, faPaperPlane, faCheck, faRocket } from '@fortawesome/free-solid-svg-icons';

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingSteps {
    addContacts: boolean;
    createEvent: boolean;
    sendBroadcast: boolean;
}

interface OnboardingState {
    steps: OnboardingSteps;
    completedAt: string | null;
}

const STORAGE_KEY = 'meetora_onboarding';

const defaultState: OnboardingState = {
    steps: {
        addContacts: false,
        createEvent: false,
        sendBroadcast: false,
    },
    completedAt: null,
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
    const router = useRouter();
    const [state, setStateRaw] = useState<OnboardingState>(defaultState);
    const [loading, setLoading] = useState(true);

    // 1. Load state from localStorage on mount
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                setStateRaw(JSON.parse(raw));
            }
        } catch (e) {
            console.warn('Failed to load onboarding state', e);
        } finally {
            setLoading(false);
        }
    }, []);

    // Helper to update state and persist
    const setState = (updater: (prev: OnboardingState) => OnboardingState) => {
        setStateRaw((prev) => {
            const next = updater(prev);
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            } catch (e) {
                console.warn('Failed to save onboarding state', e);
            }
            return next;
        });
    };

    // 2. Auto-detect completion for Contacts and Events
    useEffect(() => {
        async function autoDetect() {
            try {
                const [contactsRes, eventsRes] = await Promise.all([
                    api.get('/contacts?limit=1').catch(() => ({ data: [] })),
                    api.get('/events?limit=1').catch(() => ({ data: [] })),
                ]);

                // Handle both array directly or paginated { data: [] } response structure
                const contacts = Array.isArray(contactsRes.data) ? contactsRes.data : (contactsRes.data?.data || []);
                const events = Array.isArray(eventsRes.data) ? eventsRes.data : (eventsRes.data?.data || []);

                const hasContacts = contacts.length > 0;
                const hasEvents = events.length > 0;

                if (hasContacts || hasEvents) {
                    setState((prev) => ({
                        ...prev,
                        steps: {
                            ...prev.steps,
                            addContacts: prev.steps.addContacts || hasContacts,
                            createEvent: prev.steps.createEvent || hasEvents,
                        },
                    }));
                }
            } catch (err) {
                console.error('Failed to auto-detect onboarding progress', err);
            }
        }

        autoDetect();
    }, []);

    // 3. Redirect on completion (Case C)
    useEffect(() => {
        const allDone = Object.values(state.steps).every(Boolean);
        if (allDone) {
            if (!state.completedAt) {
                setState((prev) => ({ ...prev, completedAt: new Date().toISOString() }));
            }
            // Delay redirect to let user see the 100% state
            const timer = setTimeout(() => router.push('/dashboard'), 1500);
            return () => clearTimeout(timer);
        }
    }, [state.steps, state.completedAt, router]);

    // Calculate progress for Bar
    const completedCount = Object.values(state.steps).filter(Boolean).length;
    const totalSteps = 3;
    const progressPct = Math.round((completedCount / totalSteps) * 100);

    if (loading) return null;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border)', padding: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), var(--accent-cta))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28, color: '#fff' }}>
                        <Icon icon={faRocket} />
                    </div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Welcome to Meetora</h1>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        Complete these 3 steps to set up your automated attendance system.
                    </p>
                </div>

                {/* Progress Bar (Case B) */}
                <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                        <span>Progress</span>
                        <span style={{ color: 'var(--primary)' }}>{progressPct}%</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--bg-secondary)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ 
                            width: `${progressPct}%`, 
                            height: '100%', 
                            background: 'linear-gradient(90deg, var(--primary), var(--accent-cta))',
                            transition: 'width 0.5s ease' 
                        }} />
                    </div>
                </div>

                {/* Steps List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    {/* Step 1: Add Contacts */}
                    <div className={`card ${state.steps.addContacts ? 'completed' : ''}`} style={stepCardStyle(state.steps.addContacts)}>
                        <div style={iconStyle(state.steps.addContacts)}>
                            <Icon icon={state.steps.addContacts ? faCheck : faUsers} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={labelStyle(state.steps.addContacts)}>Import or create contacts</div>
                            {!state.steps.addContacts && (
                                <Link href="/dashboard/contacts" className="text-sm text-primary hover:underline">
                                    Go to Contacts →
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Create Event */}
                    <div className={`card ${state.steps.createEvent ? 'completed' : ''}`} style={stepCardStyle(state.steps.createEvent)}>
                        <div style={iconStyle(state.steps.createEvent)}>
                            <Icon icon={state.steps.createEvent ? faCheck : faCalendar} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={labelStyle(state.steps.createEvent)}>Create your first event</div>
                            {!state.steps.createEvent && (
                                <Link href="/dashboard/events" className="text-sm text-primary hover:underline">
                                    Go to Events →
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* Step 3: Send Broadcast (Manual trigger per Rule 6) */}
                    <div className={`card ${state.steps.sendBroadcast ? 'completed' : ''}`} style={stepCardStyle(state.steps.sendBroadcast)}>
                        <div style={iconStyle(state.steps.sendBroadcast)}>
                            <Icon icon={state.steps.sendBroadcast ? faCheck : faPaperPlane} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={labelStyle(state.steps.sendBroadcast)}>Send your first broadcast</div>
                            {!state.steps.sendBroadcast && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
                                    <Link href="/dashboard/messaging" className="text-sm text-primary hover:underline">
                                        Go to Messaging
                                    </Link>
                                    <button 
                                        onClick={() => setState(prev => ({ ...prev, steps: { ...prev.steps, sendBroadcast: true } }))}
                                        style={{ fontSize: 12, padding: '4px 10px', borderRadius: 6, background: 'var(--bg-secondary)', border: '1px solid var(--border)', cursor: 'pointer' }}
                                    >
                                        Mark Done
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                </div>

                {progressPct === 100 && (
                    <div style={{ textAlign: 'center', marginTop: 24, padding: 12, background: 'rgba(34,197,94,0.1)', color: 'var(--success)', borderRadius: 12, fontSize: 14, fontWeight: 600 }}>
                        <Icon icon={faCheck} style={{ marginRight: 8 }} />
                        All set! Redirecting to dashboard...
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const stepCardStyle = (completed: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    background: completed ? 'rgba(34,197,94,0.05)' : 'var(--bg-secondary)',
    border: `1px solid ${completed ? 'rgba(34,197,94,0.2)' : 'transparent'}`,
    transition: 'all 0.2s ease',
    opacity: completed ? 0.8 : 1,
});

const iconStyle = (completed: boolean): React.CSSProperties => ({
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: completed ? 'var(--success)' : 'var(--bg-card)',
    color: completed ? '#fff' : 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    flexShrink: 0,
});

const labelStyle = (completed: boolean): React.CSSProperties => ({
    fontSize: 15,
    fontWeight: 600,
    color: completed ? 'var(--text-secondary)' : 'var(--text-primary)',
    textDecoration: completed ? 'line-through' : 'none',
    marginBottom: completed ? 0 : 4,
});
