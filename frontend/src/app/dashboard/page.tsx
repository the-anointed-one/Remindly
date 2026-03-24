'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { OnboardingChecklist } from '@/components/OnboardingChecklist';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useToast } from '@/components/Toast';
import {
    faCalendar, faCheck, faShieldHalved, faComment, faClock,
    faArrowTrendUp, faPlus, faUsers, faMessage, faPaperPlane, faCheckCircle,
    faChartLine, faBolt, faFileImport, faChevronRight, faCircleDot
} from '@fortawesome/free-solid-svg-icons';

// ── Types ───────────────────────────────────

interface EventStats {
    confirmed: number;
    cancelled: number;
    pending: number;
    invited: number;
}

interface Event {
    id: string;
    title: string;
    startTime: string;
    status: string;
    stats: EventStats;
}

interface AttendanceOverview {
    events_this_week: number;
    messages_sent: number;
    confirmed_attendees: number;
    pending_responses: number;
}

// ── Components ──────────────────────────────

function WorkflowGuide() {
    const steps = [
        { label: 'Invite Audience', icon: faUsers, href: '/dashboard/contacts', color: 'var(--primary)' },
        { label: 'Send Message', icon: faMessage, href: '/dashboard/messaging', color: 'var(--accent-cta)' },
        { label: 'Track Responses', icon: faCheckCircle, href: '/dashboard/events', color: 'var(--success)' },
        { label: 'Follow Up', icon: faPaperPlane, href: '/dashboard/messaging', color: '#6B3E2E' },
    ];

    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 32 }}>
            {steps.map((step, i) => (
                <Link key={step.label} href={step.href} style={{ 
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                    padding: '16px', background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-lg)', textDecoration: 'none', color: 'inherit',
                    transition: 'all 0.2s ease', position: 'relative'
                }} className="hover:border-primary">
                    <div style={{ 
                        width: 48, height: 48, borderRadius: '50%', background: `${step.color}15`, 
                        color: step.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20
                    }}>
                        <Icon icon={step.icon} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{i + 1} {step.label}</span>
                    </div>
                </Link>
            ))}
        </div>
    );
}

function ActiveEventCard({ event }: { event: Event }) {
    return (
        <Link href={`/dashboard/events/${event.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className="card hover:border-primary transition-all" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                        <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{event.title}</h4>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon icon={faCalendar} style={{ fontSize: 12 }} />
                            {new Date(event.startTime).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                        </div>
                    </div>
                    <span className={`badge ${event.status === 'ACTIVE' ? 'badge-primary' : 'badge-secondary'}`} style={{ height: 'fit-content' }}>
                        {event.status}
                    </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {[
                        { label: 'Invited', value: (event.stats?.invited || 0) + (event.stats?.confirmed || 0) + (event.stats?.cancelled || 0) + (event.stats?.pending || 0), color: 'var(--text-primary)' },
                        { label: 'Confirmed', value: event.stats?.confirmed || 0, color: 'var(--success)' },
                        { label: 'Pending', value: event.stats?.pending || 0, color: 'var(--warning)' },
                        { label: 'Cancelled', value: event.stats?.cancelled || 0, color: 'var(--error)' },
                    ].map(stat => (
                        <div key={stat.label} style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 2 }}>{stat.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                        </div>
                    ))}
                </div>
            </div>
        </Link>
    );
}

// ── Main Page ───────────────────────────────

export default function DashboardOverview() {
    const { user, usage } = useAuth();
    const toast = useToast();
    const [attendance, setAttendance] = useState<AttendanceOverview | null>(null);
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const { showOnboarding } = useOnboarding(!loading && !!user);
    const [onboardingProgress, setOnboardingProgress] = useState({
        hasContacts: false,
        hasEvent: false,
        hasSentInvite: false,
        hasTrackedResponses: false,
    });
    // Use ref to guard the one-time "Aha Moment" toast — avoids adding toast/showOnboarding
    // to useEffect deps which would cause an infinite re-render loop.
    const ahaShownRef = useRef(false);

    useEffect(() => {
        // Capture refs for closure — safe because we only run once on mount
        const toastRef = toast;
        const showOnboardingRef = showOnboarding;

        async function loadDashboard() {
            const attendancePromise = api.get('/analytics/attendance-overview');
            const contactsPromise = api.get('/contacts').catch(() => ({ data: [] }));
            const onboardingPromise = api.get('/analytics/onboarding-progress').catch(() => ({ data: null }));

            let eventsData: any = [];
            try {
                const eventsActiveRes = await api.get('/events/active');
                eventsData = eventsActiveRes.data;
            } catch (eventErr) {
                console.warn('Fallback to /appointments for active events', eventErr);
                try {
                    const apptsRes = await api.get('/appointments');
                    eventsData = apptsRes.data;
                } catch (aptErr) {
                    console.warn('Failed to load appointments fallback', aptErr);
                    eventsData = [];
                }
            }

            const [aRes, cRes, oRes] = await Promise.all([attendancePromise, contactsPromise, onboardingPromise]);

            setAttendance(aRes.data);
            setEvents(eventsData);

            // Check onboarding progress
            const contacts = cRes.data || [];
            const hasContacts = contacts.length > 0;
            const hasEvent = (eventsData?.length ?? 0) > 0;
            const hasSentInvite = oRes.data?.hasSentInvite || false;
            const hasTrackedResponses = oRes.data?.hasTrackedResponses || (aRes.data?.confirmed_attendees > 0);

            setOnboardingProgress({
                hasContacts,
                hasEvent,
                hasSentInvite,
                hasTrackedResponses,
            });

            // Trigger "Aha Moment" toast exactly once on first confirmation
            if (hasTrackedResponses && showOnboardingRef && !ahaShownRef.current) {
                ahaShownRef.current = true;
                toastRef.success("Great! Your first attendee confirmed. Meetora will now help you manage the rest automatically.");
            }
        }

        loadDashboard()
            .catch(err => {
                console.error("Dashboard init error:", err);
            })
            .finally(() => {
                setLoading(false);
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once on mount — toast and showOnboarding are captured via closure + ref guard

    const getGreeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good Morning';
        if (h < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const smsLimit = usage?.sms?.limit ?? 0;
    const smsUsed = usage?.sms?.used ?? 0;
    const aiLimit = usage?.ai?.limit ?? 0;
    const aiUsed = usage?.ai?.used ?? 0;

    return (
        <div style={{ paddingBottom: 60, maxWidth: 1200, margin: '0 auto' }}>
            
            {/* Header Area */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ padding: '4px 10px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: 100, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Command Center Live</span>
                    </div>
                </div>
                <h1 style={{ fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 900, letterSpacing: -1.5, marginBottom: 4 }}>
                    {getGreeting()}, {user?.firstName || 'User'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 16 }}>Your attendance automation is running smoothly.</p>
            </div>

            {/* 1. Primary Action Section */}
            <div className="card" style={{ 
                padding: '40px', background: 'linear-gradient(135deg, var(--bg-card), rgba(107, 62, 46, 0.05))',
                border: '1px solid var(--border)', borderRadius: 24, marginBottom: 24,
                display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center'
            }}>
                <div style={{ maxWidth: 600 }}>
                    <h2 style={{ fontSize: 32, fontWeight: 900, marginBottom: 12, letterSpacing: -0.5 }}>Meetora Attendance Command Center</h2>
                    <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
                        Organize meetings, events, or appointments. <br/>
                        Invite participants and track confirmations automatically.
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
                        <Link href="/dashboard/events" className="btn btn-primary" style={{ padding: '16px 32px', fontSize: 18, fontWeight: 800, borderRadius: 14 }}>
                            <Icon icon={faPlus} className="mr-2" /> Create Event
                        </Link>
                    </div>
                </div>
                
                {/* 5. Quick Action Buttons (Under main card) */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 40, paddingTop: 32, borderTop: '1px solid var(--border)', width: '100%', justifyContent: 'center' }}>
                    {[
                        { label: 'Create Event', icon: faPlus, href: '/dashboard/events' },
                        { label: 'Send Broadcast', icon: faMessage, href: '/dashboard/messaging' },
                        { label: 'View Calendar', icon: faCalendar, href: '/dashboard/calendar' },
                        { label: 'Import Contacts', icon: faFileImport, href: '/dashboard/contacts' },
                    ].map(btn => (
                        <Link key={btn.label} href={btn.href} className="btn btn-sm" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', padding: '8px 16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon icon={btn.icon} style={{ fontSize: 12 }} /> {btn.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* 2. Visual Workflow Guide */}
            <WorkflowGuide />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 32 }}>
                
                {/* Left Column: Active Events */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Icon icon={faCircleDot} className="text-primary" style={{ fontSize: 14 }} /> Active Events
                        </h3>
                        <Link href="/dashboard/events" style={{ fontSize: 14, fontWeight: 700, color: 'var(--primary)', textDecoration: 'none' }}>View All Events</Link>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                        {loading ? (
                            [1, 2].map(i => <div key={i} className="card" style={{ height: 180, background: 'var(--bg-card)', borderRadius: 20, animation: 'pulse 1.5s infinite' }} />)
                        ) : events.length === 0 ? (
                            <div className="card" style={{ gridColumn: '1 / -1', padding: '60px 48px', textAlign: 'center', background: 'var(--bg-secondary)', border: '2px dashed var(--border)', borderRadius: 24 }}>
                                <div style={{ 
                                    width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                                }}>
                                    <Icon icon={faCalendar} style={{ fontSize: 32, color: 'var(--primary)' }} />
                                </div>
                                <h4 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>You haven’t created any events yet.</h4>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: 32, maxWidth: 400, margin: '0 auto 32px', lineHeight: 1.6 }}>
                                    Start by creating your first event to invite people and track confirmations automatically.
                                </p>
                                <Link href="/dashboard/events" className="btn btn-primary" style={{ padding: '12px 24px', fontWeight: 800, borderRadius: 12 }}>
                                    Create First Event
                                </Link>
                            </div>
                        ) : (
                            events.map(event => <ActiveEventCard key={event.id} event={event} />)
                        )}
                    </div>
                </div>

                {/* Right Column: Attendance Intelligence Snapshot */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <h3 style={{ fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon icon={faChartLine} className="text-accent" style={{ fontSize: 16 }} /> Attendance Overview
                    </h3>
                    
                    <div className="card" style={{ padding: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {[
                                { label: 'Events This Week', value: attendance?.events_this_week ?? 0, icon: faCalendar, color: 'var(--primary)' },
                                { label: 'Invitations Sent', value: attendance?.messages_sent ?? 0, icon: faPaperPlane, color: 'var(--accent-cta)' },
                                { label: 'Confirmed Participants', value: attendance?.confirmed_attendees ?? 0, icon: faCheckCircle, color: 'var(--success)' },
                                { label: 'Pending Responses', value: attendance?.pending_responses ?? 0, icon: faClock, color: 'var(--warning)' },
                            ].map(m => (
                                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: `${m.color}15`, color: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Icon icon={m.icon} />
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{m.label}</div>
                                        <div style={{ fontSize: 22, fontWeight: 900 }}>{m.value}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
                                <span style={{ fontWeight: 700 }}>Confirmation Rate</span>
                                <span style={{ fontWeight: 900, color: 'var(--success)' }}>
                                    {attendance && (attendance.confirmed_attendees + attendance.pending_responses) > 0 
                                        ? Math.round((attendance.confirmed_attendees / (attendance.confirmed_attendees + attendance.pending_responses)) * 100) 
                                        : 0}%
                                </span>
                            </div>
                            <div className="progress-bar" style={{ height: 6 }}>
                                <div className="progress-fill" style={{ 
                                    width: `${attendance && (attendance.confirmed_attendees + attendance.pending_responses) > 0 
                                        ? Math.round((attendance.confirmed_attendees / (attendance.confirmed_attendees + attendance.pending_responses)) * 100) 
                                        : 0}%`, 
                                    background: 'var(--success)' 
                                }} />
                            </div>
                        </div>
                    </div>

                    {/* Fuel Card */}
                    <div className="card" style={{ padding: 20, borderRadius: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <Icon icon={faBolt} style={{ color: 'var(--warning)' }} />
                            <span style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' }}>Account Fuel</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 700 }}>SMS Credits</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{smsUsed}/{smsLimit}</span>
                                </div>
                                <div className="progress-bar" style={{ height: 4 }}><div className="progress-fill" style={{ width: `${smsLimit > 0 ? (smsUsed/smsLimit)*100 : 0}%` }} /></div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 700 }}>AI Tokens</span>
                                    <span style={{ color: 'var(--text-muted)' }}>{aiUsed}/{aiLimit}</span>
                                </div>
                                <div className="progress-bar" style={{ height: 4 }}><div className="progress-fill" style={{ width: `${aiLimit > 0 ? (aiUsed/aiLimit)*100 : 0}%`, background: '#f97316' }} /></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <style jsx global>{`
                @keyframes pulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.05); }
                    100% { opacity: 1; transform: scale(1); }
                }
                .hover\\:border-primary:hover {
                    border-color: var(--primary) !important;
                    box-shadow: 0 0 20px rgba(107, 62, 46, 0.1);
                }
            `}</style>
        </div>
    );
}
