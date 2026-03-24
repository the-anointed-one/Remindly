'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useAppointments, AppointmentRaw } from '@/hooks/useAppointments';

import Icon from '@/components/ui/Icon';
import {
    faCalendar, faPlus, faUsers, faMapMarkerAlt,
    faChevronRight, faClock,
} from '@fortawesome/free-solid-svg-icons';

interface EventItem {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: string;
    endTime: string | null;
    status: string;
    eventType: string;
    isDemoData: boolean;
    _count: { participants: number; responses: number };
}

const EVENT_TYPE_LABELS: Record<string, string> = {
    APPOINTMENT: 'Appointment',
    MEETING: 'Meeting',
    WEBINAR: 'Webinar',
    TRAINING: 'Training',
    CONSULTATION: 'Consultation',
    OTHER: 'Other',
};

const STATUS_COLOR: Record<string, string> = {
    DRAFT: '#6b7280',
    PUBLISHED: '#3b82f6',
    ACTIVE: '#22c55e',
    COMPLETED: '#8b5cf6',
    CANCELLED: '#ef4444',
};

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
            background: `${color}1a`, border: `1px solid ${color}40`, color,
            textTransform: 'uppercase' as const, letterSpacing: '0.04em',
        }}>
            {label}
        </span>
    );
}

export default function EventsPage() {
    const { user, loading: authLoading } = useAuth();
    const [showForm, setShowForm] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);
    const [form, setForm] = useState({
        title: '',
        description: '',
        location: '',
        startTime: '',
        endTime: '',
        eventType: 'APPOINTMENT',
        automations: {
            remindUnconfirmed: false,
            sendLocationConfirmed: false,
            sendFollowUp: false,
        },
    });
    const [saving, setSaving] = useState(false);

    const tenantId = user?.tenantId || '';
    const {
        data: appointmentsData,
        isLoading: isLoadingAppointments,
        error: appointmentsError,
        refetch: refetchAppointments,
        queryKey,
    } = useAppointments(tenantId);

    const events = (appointmentsData ?? []).map((appt: AppointmentRaw) => {
        return {
            id: appt.id,
            title: appt.title,
            description: appt.description ?? null,
            location: appt.location ?? null,
            startTime: appt.scheduledAt || appt.scheduled_at || appt.startTime || '',
            endTime: appt.endTime || appt.end_time || null,
            status: appt.status || 'SCHEDULED',
            eventType: appt.eventType || appt.type || 'APPOINTMENT',
            isDemoData: !!appt.isDemoData,
            _count: {
                participants: appt._count?.participants ?? 0,
                responses: appt._count?.responses ?? 0,
            },
        } as EventItem;
    });

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('Appointments RAW:', appointmentsData);
            console.log('Mapped Events:', events);
            console.log('Appointments query key:', queryKey);
        }
    }, [appointmentsData, events, queryKey]);

    const loading = isLoadingAppointments || authLoading;

    const hasError = !!appointmentsError;

    useEffect(() => {
        // Ensure consistent data after create.
        if (!loading && !hasError && tenantId) {
            // Keep it idempotent: no extra calls needed.
        }
    }, [loading, hasError, tenantId]);

    if (!tenantId) return <div style={{ padding: 40, textAlign: 'center' }}>Initializing...</div>;
    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
    if (hasError) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Error loading events</div>;

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !form.startTime) return;
        setSaving(true);
        try {
            const appointmentPayload: Record<string, unknown> = {
                title: form.title,
                scheduledAt: new Date(form.startTime).toISOString(),
                durationMinutes: form.endTime
                    ? Math.max(5, Math.round((new Date(form.endTime).getTime() - new Date(form.startTime).getTime()) / 60000))
                    : undefined,
                notes: form.description || undefined,
            };

            const sanitizePayload = (payload: Record<string, unknown>) => {
                const { metadata: _metadata, ...rest } = payload as { metadata?: unknown };
                return rest;
            };

            try {
                await api.post('/appointments', sanitizePayload(appointmentPayload));
            } catch (appointmentsErr) {
                console.warn('[EventsPage] /appointments create failed, falling back to /events', appointmentsErr);

                const fallbackEventData = {
                    title: form.title,
                    description: form.description || undefined,
                    location: form.location || undefined,
                    startTime: new Date(form.startTime).toISOString(),
                    endTime: form.endTime ? new Date(form.endTime).toISOString() : undefined,
                    eventType: form.eventType,
                };

                await api.post('/events', sanitizePayload(fallbackEventData));
            }

            setShowForm(false);
            setForm({
                title: '',
                description: '',
                location: '',
                startTime: '',
                endTime: '',
                eventType: 'APPOINTMENT',
                automations: {
                    remindUnconfirmed: false,
                    sendLocationConfirmed: false,
                    sendFollowUp: false,
                },
            });
            await refetchAppointments();
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err && (err as { response?: { data?: { message?: string } } }).response?.data?.message
                ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                : 'Failed to create event';
            alert(message);
        } finally { setSaving(false); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Events</h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Appointments, meetings, webinars, and more</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon={faPlus} /> New Event
                </button>
            </div>

            {/* Create form */}
            {showForm && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Create Event</h3>
                    <form onSubmit={handleCreate}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="input-label">Title *</label>
                                <input className="input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="e.g. Team Onboarding Session" />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Event Type</label>
                                <select className="input" value={form.eventType} onChange={e => setForm(f => ({ ...f, eventType: e.target.value }))}>
                                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Location</label>
                                <input className="input" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Address or online link" />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Start Time *</label>
                                <input className="input" type="datetime-local" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">End Time</label>
                                <input className="input" type="datetime-local" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
                            </div>
                            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                                <label className="input-label">Description</label>
                                <textarea className="input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional event details" />
                            </div>
                        </div>

                        {/* Automation Settings */}
                        <div style={{ 
                            background: 'rgba(99,102,241,0.08)', 
                            border: '1px solid rgba(99,102,241,0.25)',
                            borderRadius: 8, 
                            padding: 14,
                            marginBottom: 14 
                        }}>
                            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                                🤖 Automation Settings
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                    <input 
                                        type="checkbox" 
                                        checked={form.automations.remindUnconfirmed}
                                        onChange={e => setForm(f => ({ 
                                            ...f, 
                                            automations: { ...f.automations, remindUnconfirmed: e.target.checked } 
                                        }))}
                                        style={{ cursor: 'pointer' }}
                                    />
                                      <span>Remind people who have not responded</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                    <input 
                                        type="checkbox"
                                        checked={form.automations.sendLocationConfirmed}
                                        onChange={e => setForm(f => ({ 
                                            ...f, 
                                            automations: { ...f.automations, sendLocationConfirmed: e.target.checked } 
                                        }))}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span>Send location to confirmed attendees</span>
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                                    <input 
                                        type="checkbox"
                                        checked={form.automations.sendFollowUp}
                                        onChange={e => setForm(f => ({ 
                                            ...f, 
                                            automations: { ...f.automations, sendFollowUp: e.target.checked } 
                                        }))}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span>Send follow-up after event</span>
                                </label>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline btn-sm">Cancel</button>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Creating…' : 'Create Event'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Events list */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
            ) : events.length === 0 ? (
                <div className="glass-card" style={{ padding: 48, textAlign: 'center' }}>
                    <Icon icon={faCalendar} className="text-4xl text-muted" />
                    <h3 style={{ fontWeight: 700, marginBottom: 8, marginTop: 16 }}>No events yet</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Create your first event to start managing attendance.</p>
                    <button className="btn btn-primary" onClick={() => setShowForm(true)}>Create Event</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {events.map((ev) => (
                        <Link key={ev.id} href={`/dashboard/events/${ev.id}`} style={{ textDecoration: 'none' }}>
                            <div className="glass-card" style={{ padding: '18px 20px', cursor: 'pointer', transition: 'border-color 0.15s' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{ev.title}</span>
                                            {ev.isDemoData && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px' }}>DEMO</span>}
                                            <Badge label={ev.status} color={STATUS_COLOR[ev.status] ?? '#6b7280'} />
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', borderRadius: 4, padding: '2px 7px' }}>
                                                {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                                            <span><Icon icon={faClock} className="mr-1" />{new Date(ev.startTime).toLocaleString()}</span>
                                            {ev.location && <span><Icon icon={faMapMarkerAlt} className="mr-1" />{ev.location}</span>}
                                            <span><Icon icon={faUsers} className="mr-1" />{ev._count.participants} invited</span>
                                        </div>
                                    </div>
                                    <Icon icon={faChevronRight} className="text-muted text-sm" />
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
