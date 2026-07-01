'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
    faCalendarDays, faCheckCircle, faClock, faExclamationTriangle,
    faPhone, faCommentDots, faPlus, faUsers, faBolt, faArrowRight,
    faCircleCheck, faCircleXmark, faCircle, faHourglass,
    faLocationDot, faChevronRight
} from '@fortawesome/free-solid-svg-icons';

// ── Types ───────────────────────────────────────────────────────────────────

interface Customer {
    id: string;
    firstName: string;
    lastName: string;
    phone?: string;
    email?: string;
}

interface Reminder {
    id: string;
    status: string;   // PENDING | SENT | DELIVERED | FAILED
    channel: string;  // SMS | WHATSAPP | VOICE
    scheduledSendTime: string;
    sentAt?: string;
    messageContent?: string;
}

interface Appointment {
    id: string;
    title: string;
    status: string;   // SCHEDULED | CONFIRMED | COMPLETED | CANCELLED | NO_SHOW
    scheduledAt: string;
    customer?: Customer;
    location?: { name: string };
    reminders: Reminder[];
}

interface Pipeline {
    appointment?: {
        id: string;
        title: string;
        status: string;
        scheduledAt: string;
        customer?: Customer;
        location?: { name: string };
        reminders: Reminder[];
    };
    reminders?: { pending: any[]; sent: any[]; failed: any[] };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function statusChip(status: string) {
    const map: Record<string, { label: string; color: string; icon: any }> = {
        CONFIRMED:  { label: 'Confirmed',    color: 'var(--success)', icon: faCheckCircle },
        SCHEDULED:  { label: 'Reminder sent', color: 'var(--warning)', icon: faClock },
        NO_SHOW:    { label: 'At risk',       color: '#f97316',        icon: faExclamationTriangle },
        CANCELLED:  { label: 'Cancelled',     color: 'var(--error)',   icon: faCircleXmark },
        COMPLETED:  { label: 'Completed',     color: 'var(--success)', icon: faCircleCheck },
    };
    return map[status] ?? { label: status, color: 'var(--text-muted)', icon: faCircle };
}

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function reminderIcon(status: string) {
    if (status === 'SENT' || status === 'DELIVERED') return { icon: faCircleCheck, color: 'var(--success)' };
    if (status === 'FAILED') return { icon: faCircleXmark, color: 'var(--error)' };
    if (status === 'PENDING') return { icon: faClock, color: 'var(--warning)' };
    return { icon: faCircle, color: 'var(--text-muted)' };
}

function patientName(customer?: Customer) {
    if (!customer) return 'Unknown';
    return `${customer.firstName} ${customer.lastName}`.trim();
}

// ── Follow-up Timeline ───────────────────────────────────────────────────────

function FollowUpTimeline({ appt, pipeline, loading }: {
    appt: Appointment;
    pipeline: Pipeline | null;
    loading: boolean;
}) {
    const chip = statusChip(appt.status);

    const reminders: Reminder[] = pipeline?.appointment?.reminders ?? appt.reminders ?? [];
    const apptTime = new Date(appt.scheduledAt);
    const now = new Date();
    const isPast = apptTime < now;

    // sort by scheduled time
    const sorted = [...reminders].sort(
        (a, b) => new Date(a.scheduledSendTime).getTime() - new Date(b.scheduledSendTime).getTime()
    );

    const quickActions = [
        { label: 'Call now',       icon: faPhone,      href: `tel:${appt.customer?.phone ?? ''}` },
        { label: 'Send message',   icon: faCommentDots, href: `/dashboard/campaigns` },
        { label: 'Mark confirmed', icon: faCheckCircle, action: 'confirm' },
    ];

    return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Patient header */}
            <div style={{ padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                            {patientName(appt.customer)}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon icon={faCalendarDays} style={{ fontSize: 11 }} />
                            {fmtDate(appt.scheduledAt)} at {fmtTime(appt.scheduledAt)}
                            {appt.location && (
                                <>
                                    <span style={{ color: 'var(--border)' }}>·</span>
                                    <Icon icon={faLocationDot} style={{ fontSize: 11 }} />
                                    {appt.location.name}
                                </>
                            )}
                        </div>
                    </div>
                    <span style={{
                        display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
                        padding: '4px 10px', borderRadius: 100,
                        background: `${chip.color}18`, color: chip.color,
                    }}>
                        <Icon icon={chip.icon} style={{ fontSize: 10 }} />
                        {chip.label}
                    </span>
                </div>

                {/* Quick action buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {appt.customer?.phone && (
                        <a href={`tel:${appt.customer.phone}`} className="btn btn-sm"
                            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 12, gap: 6 }}>
                            <Icon icon={faPhone} style={{ fontSize: 11 }} /> Call now
                        </a>
                    )}
                    <Link href="/dashboard/campaigns" className="btn btn-sm"
                        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 12, gap: 6 }}>
                        <Icon icon={faCommentDots} style={{ fontSize: 11 }} /> Send message
                    </Link>
                    {appt.status !== 'CONFIRMED' && !isPast && (
                        <MarkConfirmedBtn appointmentId={appt.id} />
                    )}
                </div>
            </div>

            {/* Follow-up timeline */}
            <div style={{ flex: 1, padding: '20px 24px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 20 }}>
                    Follow-up timeline
                </div>

                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {[1,2,3].map(i => (
                            <div key={i} style={{ height: 48, background: 'var(--bg-secondary)', borderRadius: 10, opacity: 0.5 }} />
                        ))}
                    </div>
                )}

                {!loading && sorted.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                        No follow-up messages scheduled yet.
                        <br />
                        <Link href="/dashboard/automations" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none', fontSize: 13, display: 'inline-block', marginTop: 8 }}>
                            Set up Follow-ups <Icon icon={faArrowRight} style={{ fontSize: 11 }} />
                        </Link>
                    </div>
                )}

                {!loading && sorted.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        {/* Vertical spine */}
                        <div style={{
                            position: 'absolute', left: 10, top: 16, bottom: 16,
                            width: 2, background: 'var(--border)', zIndex: 0,
                        }} />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {sorted.map((r, idx) => {
                                const ri = reminderIcon(r.status);
                                const isNext = r.status === 'PENDING' && sorted.slice(0, idx).every(x => x.status !== 'PENDING');
                                return (
                                    <div key={r.id} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative', zIndex: 1 }}>
                                        {/* Node */}
                                        <div style={{
                                            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                            background: isNext ? ri.color : 'var(--bg-card)',
                                            border: `2px solid ${ri.color}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            marginTop: 2,
                                        }}>
                                            {(r.status === 'SENT' || r.status === 'DELIVERED') && (
                                                <Icon icon={faCircleCheck} style={{ fontSize: 12, color: ri.color }} />
                                            )}
                                            {r.status === 'FAILED' && (
                                                <Icon icon={faCircleXmark} style={{ fontSize: 12, color: ri.color }} />
                                            )}
                                        </div>

                                        {/* Content */}
                                        <div style={{
                                            flex: 1, padding: '8px 12px', borderRadius: 10,
                                            background: isNext ? `${ri.color}10` : 'var(--bg-secondary)',
                                            border: `1px solid ${isNext ? ri.color + '40' : 'transparent'}`,
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                                <span style={{ fontSize: 12, fontWeight: 700, color: ri.color }}>
                                                    {r.channel} · {r.sentAt ? `Sent ${fmtTime(r.sentAt)}` : fmtTime(r.scheduledSendTime)}
                                                </span>
                                                <span style={{
                                                    fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                                                    background: `${ri.color}18`, color: ri.color,
                                                }}>
                                                    {r.status === 'DELIVERED' ? 'Delivered' : r.status === 'SENT' ? 'Sent' : r.status === 'FAILED' ? 'Failed' : isNext ? 'Up next' : 'Scheduled'}
                                                </span>
                                            </div>
                                            {r.messageContent && (
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
                                                    {r.messageContent.length > 120 ? r.messageContent.slice(0, 120) + '…' : r.messageContent}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Appointment marker at the end */}
                            <div style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                                <div style={{
                                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                                    background: isPast ? 'var(--success)' : 'var(--primary)',
                                    border: `2px solid ${isPast ? 'var(--success)' : 'var(--primary)'}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginTop: 2,
                                }}>
                                    <Icon icon={faCalendarDays} style={{ fontSize: 10, color: '#fff' }} />
                                </div>
                                <div style={{ flex: 1, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-secondary)' }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isPast ? 'var(--success)' : 'var(--primary)' }}>
                                        Appointment · {fmtDate(appt.scheduledAt)} {fmtTime(appt.scheduledAt)}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                                        {appt.title}
                                        {isPast && <span style={{ color: 'var(--text-muted)' }}> — completed</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Mark Confirmed Button ────────────────────────────────────────────────────

function MarkConfirmedBtn({ appointmentId }: { appointmentId: string }) {
    const [done, setDone] = useState(false);
    const [busy, setBusy] = useState(false);

    const confirm = async () => {
        setBusy(true);
        try {
            await api.put(`/appointments/${appointmentId}`, { status: 'CONFIRMED' });
            setDone(true);
        } catch {
            // silently fail — user can refresh
        } finally {
            setBusy(false);
        }
    };

    if (done) return (
        <span className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.1)', color: 'var(--success)', border: '1px solid var(--success)', fontSize: 12, gap: 6, cursor: 'default' }}>
            <Icon icon={faCheckCircle} style={{ fontSize: 11 }} /> Confirmed
        </span>
    );

    return (
        <button onClick={confirm} disabled={busy} className="btn btn-sm btn-primary"
            style={{ fontSize: 12, gap: 6, opacity: busy ? 0.6 : 1 }}>
            <Icon icon={faCheckCircle} style={{ fontSize: 11 }} />
            {busy ? 'Saving…' : 'Mark confirmed'}
        </button>
    );
}

// ── Appointment Row ──────────────────────────────────────────────────────────

function AppointmentRow({ appt, active, onClick }: { appt: Appointment; active: boolean; onClick: () => void }) {
    const chip = statusChip(appt.status);
    const sent = appt.reminders.filter(r => r.status === 'SENT' || r.status === 'DELIVERED').length;
    const pending = appt.reminders.filter(r => r.status === 'PENDING').length;

    return (
        <button onClick={onClick} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
            borderRadius: 'var(--radius-md)', border: active ? '1px solid var(--primary)' : '1px solid transparent',
            background: active ? 'rgba(107,62,46,0.06)' : 'transparent',
            cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.15s',
        }}>
            {/* Status dot */}
            <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: chip.color,
            }} />

            {/* Name + time */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {patientName(appt.customer)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 1 }}>
                    {fmtTime(appt.scheduledAt)}
                    {pending > 0 && <span style={{ color: 'var(--warning)', marginLeft: 8 }}>{pending} pending</span>}
                    {sent > 0 && <span style={{ color: 'var(--success)', marginLeft: 8 }}>{sent} sent</span>}
                </div>
            </div>

            <Icon icon={faChevronRight} style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }} />
        </button>
    );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
    const { user } = useAuth();
    const [todayAppts, setTodayAppts] = useState<Appointment[]>([]);
    const [atRisk, setAtRisk] = useState<Appointment[]>([]);
    const [selected, setSelected] = useState<Appointment | null>(null);
    const [pipeline, setPipeline] = useState<Pipeline | null>(null);
    const [pipelineLoading, setPipelineLoading] = useState(false);
    const [loading, setLoading] = useState(true);

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    useEffect(() => {
        async function load() {
            try {
                const [todayRes, atRiskRes] = await Promise.all([
                    api.get('/appointments/today').catch(() => ({ data: [] })),
                    api.get('/appointments/needs-attention').catch(() => ({ data: [] })),
                ]);
                const todayData: Appointment[] = Array.isArray(todayRes.data) ? todayRes.data : [];
                const atRiskData: Appointment[] = Array.isArray(atRiskRes.data) ? atRiskRes.data : [];
                setTodayAppts(todayData);
                setAtRisk(atRiskData);
                // Auto-select first appointment
                if (todayData.length > 0) setSelected(todayData[0]);
                else if (atRiskData.length > 0) setSelected(atRiskData[0]);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const loadPipeline = useCallback(async (appt: Appointment) => {
        setSelected(appt);
        setPipeline(null);
        setPipelineLoading(true);
        try {
            const res = await api.get(`/appointments/${appt.id}/pipeline`);
            setPipeline(res.data);
        } catch {
            setPipeline(null);
        } finally {
            setPipelineLoading(false);
        }
    }, []);

    // Auto-load pipeline for first selection
    useEffect(() => {
        if (selected) loadPipeline(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // only on mount — selection handled by loadPipeline directly

    const greeting = () => {
        const h = new Date().getHours();
        if (h < 12) return 'Good morning';
        if (h < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const isEmpty = !loading && todayAppts.length === 0 && atRisk.length === 0;

    return (
        <div style={{ paddingBottom: 60 }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, marginBottom: 2 }}>
                    {greeting()}, {user?.firstName || 'there'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{today}</p>
            </div>

            {isEmpty && (
                <EmptyHome />
            )}

            {!isEmpty && (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.6fr)', gap: 20, alignItems: 'start' }}>
                    {/* Left: Appointment list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {/* Today's Schedule */}
                        {(loading || todayAppts.length > 0) && (
                            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        Today's Schedule
                                        {!loading && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>{todayAppts.length}</span>}
                                    </span>
                                    <Link href="/dashboard/appointments" style={{ fontSize: 12, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                                        View all
                                    </Link>
                                </div>
                                <div style={{ padding: '8px 0' }}>
                                    {loading ? (
                                        [1,2,3].map(i => (
                                            <div key={i} style={{ margin: '6px 16px', height: 52, background: 'var(--bg-secondary)', borderRadius: 10, opacity: 0.5 }} />
                                        ))
                                    ) : (
                                        todayAppts.map(appt => (
                                            <AppointmentRow
                                                key={appt.id}
                                                appt={appt}
                                                active={selected?.id === appt.id}
                                                onClick={() => loadPipeline(appt)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Needs Attention */}
                        {(loading || atRisk.length > 0) && (
                            <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        <Icon icon={faExclamationTriangle} style={{ fontSize: 11, color: 'var(--warning)', marginRight: 6 }} />
                                        Needs Attention
                                        {!loading && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--warning)' }}>{atRisk.length}</span>}
                                    </span>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Next 48 h</span>
                                </div>
                                <div style={{ padding: '8px 0' }}>
                                    {loading ? (
                                        [1,2].map(i => (
                                            <div key={i} style={{ margin: '6px 16px', height: 52, background: 'var(--bg-secondary)', borderRadius: 10, opacity: 0.5 }} />
                                        ))
                                    ) : (
                                        atRisk.map(appt => (
                                            <AppointmentRow
                                                key={appt.id}
                                                appt={appt}
                                                active={selected?.id === appt.id}
                                                onClick={() => loadPipeline(appt)}
                                            />
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right: Follow-up timeline */}
                    <div style={{ position: 'sticky', top: 24 }}>
                        <ErrorBoundary key="timeline">
                            {selected ? (
                                <FollowUpTimeline appt={selected} pipeline={pipeline} loading={pipelineLoading} />
                            ) : (
                                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' }}>
                                    Select an appointment to see the follow-up timeline.
                                </div>
                            )}
                        </ErrorBoundary>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyHome() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Hero empty state */}
            <div style={{
                padding: 40, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)', textAlign: 'center',
            }}>
                <div style={{
                    width: 64, height: 64, borderRadius: '50%', background: 'rgba(107,62,46,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px', fontSize: 28, color: 'var(--primary)',
                }}>
                    <Icon icon={faCalendarDays} />
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>No appointments today</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
                    Create your first appointment and Meetora will automatically send follow-up messages to prevent no-shows.
                </p>
                <Link href="/dashboard/appointments" className="btn btn-primary" style={{ fontWeight: 700 }}>
                    <Icon icon={faPlus} style={{ marginRight: 8 }} /> Create appointment
                </Link>
            </div>

            {/* Quick links */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                {[
                    { icon: faUsers, label: 'Add clients', href: '/dashboard/contacts', desc: 'Import or add your patient list' },
                    { icon: faBolt, label: 'Set up follow-ups', href: '/dashboard/automations', desc: 'Configure reminder rules' },
                    { icon: faCalendarDays, label: 'View appointments', href: '/dashboard/appointments', desc: 'See all scheduled appointments' },
                ].map(item => (
                    <Link key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{
                            padding: 20, background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
                            border: '1px solid var(--border)', transition: 'border-color 0.15s',
                        }} className="hover:border-primary">
                            <div style={{ color: 'var(--primary)', fontSize: 20, marginBottom: 10 }}>
                                <Icon icon={item.icon} />
                            </div>
                            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{item.label}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.desc}</div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}
