'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';

import SearchableSelect from '@/components/ui/SearchableSelect';
import EmptyState from '@/components/EmptyState';
import Icon from '@/components/ui/Icon';
import {
    faCalendar, faPlus, faUsers, faMapMarkerAlt,
    faChevronRight, faChevronLeft, faClock, faTag, faLayerGroup, faTrophy, faCheck, faTimes, faCopy
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
    sourceType: 'event' | 'appointment';
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

interface CalendarEntry {
    id: string;
    type: 'event' | 'appointment';
    title: string;
    startTime: string;
    endTime: string | null;
    status: string;
    eventType?: string;
    location?: string | null;
    participantCount?: number;
}

const STATUS_DOT: Record<string, string> = {
    DRAFT: '#6b7280',
    PUBLISHED: '#3b82f6',
    ACTIVE: '#22c55e',
    SCHEDULED: '#f59e0b',
    CONFIRMED: '#22c55e',
    COMPLETED: '#8b5cf6',
    CANCELLED: '#ef4444',
    NO_SHOW: '#ec4899',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

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
    const toast = useToast();
    const [view, setView] = useState<'list' | 'calendar'>('list');
    const [showForm, setShowForm] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
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
    const [eventsData, setEventsData] = useState<any[]>([]);
    const [isLoadingEvents, setIsLoadingEvents] = useState(true);
    const [eventsError, setEventsError] = useState(false);
    
    // Stats map
    const [eventsStats, setEventsStats] = useState<Record<string, { confirmed: number, pending: number, cancelled: number }>>({});

    const fetchEvents = async () => {
        setIsLoadingEvents(true);
        try {
            const res = await api.get('/events');
            const data = res.data.data || res.data || [];
            setEventsData(data);
            
            // Fetch stats for each event
            const statsMap: Record<string, any> = {};
            await Promise.all(data.map(async (ev: any) => {
                try {
                    const statRes = await api.get(`/events/${ev.id}/stats`);
                    statsMap[ev.id] = statRes.data;
                } catch (e) {}
            }));
            setEventsStats(statsMap);
        } catch (err) {
            setEventsError(true);
        } finally {
            setIsLoadingEvents(false);
        }
    };

    useEffect(() => { if (tenantId) fetchEvents(); }, [tenantId]);

    // ── Calendar view state ──────────────────────────────────────
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [entries, setEntries] = useState<CalendarEntry[]>([]);
    const [calendarLoading, setCalendarLoading] = useState(true);

    useEffect(() => {
        const from = new Date(viewYear, viewMonth, 1).toISOString();
        const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
        setCalendarLoading(true);
        api.get(`/events/calendar?from=${from}&to=${to}`)
            .then(({ data }) => {
                const combined: CalendarEntry[] = [
                    ...(data.events ?? []),
                    ...(data.appointments ?? []),
                ];
                setEntries(combined);
            })
            .catch(() => setEntries([]))
            .finally(() => setCalendarLoading(false));
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    const events = eventsData.map((appt: any) => {
        const sourceType = appt.type === 'appointment' ? 'appointment' : 'event';
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
            sourceType,
        } as EventItem;
    });

    // Invite Modal State
    const [inviteEventId, setInviteEventId] = useState<string | null>(null);
    const [contactsRaw, setContactsRaw] = useState<any[]>([]);
    const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
    const [inviting, setInviting] = useState(false);

    useEffect(() => {
        api.get('/contacts').then(res => setContactsRaw(res.data.data || res.data || []));
    }, []);

    const handleInvite = async () => {
        if (!inviteEventId || selectedContactIds.size === 0) return;
        setInviting(true);
        try {
            await api.post(`/events/${inviteEventId}/invite`, { contactIds: Array.from(selectedContactIds) });
            setInviteEventId(null);
            setSelectedContactIds(new Set());
            fetchEvents();
        } catch (e: any) {
            alert(e.response?.data?.message || 'Failed to invite contacts');
        } finally {
            setInviting(false);
        }
    };

    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const visibleEvents = events;

    const openEditModal = (event: EventItem) => {
        setEditingEventId(event.id);
        setForm({
            title: event.title,
            description: event.description || '',
            location: event.location || '',
            startTime: event.startTime,
            endTime: event.endTime || '',
            eventType: event.eventType || 'APPOINTMENT',
            automations: {
                remindUnconfirmed: false,
                sendLocationConfirmed: false,
                sendFollowUp: false,
            },
        });
        setShowForm(true);
    };

    const handleDelete = async (eventId: string) => {
        setDeletingId(eventId);

        // Optimistic removal backup
        const previousEventsData = [...eventsData];
        setEventsData((prev) => prev.filter((ev) => ev.id !== eventId));

        try {
            await api.delete(`/events/${eventId}`);
            toast.success("Event deleted");
            // Fetch silently to ensure multi-client sync
            fetchEvents().catch(() => {});
        } catch (err: unknown) {
            console.error('Delete error:', err);
            
            // Revert on failure
            setEventsData(previousEventsData);
            toast.error("Delete failed, try again");
        } finally {
            setDeletingId(null);
            setDeleteTarget(null);
        }
    };

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production') {
            console.log('Events Data:', eventsData);
            console.log('Mapped Events:', events);
        }
    }, [eventsData, events]);

    const loading = isLoadingEvents || authLoading;
    const hasError = !!eventsError;


    if (!tenantId) return <div style={{ padding: 40, textAlign: 'center' }}>Initializing...</div>;
    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;
    if (hasError) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--danger)' }}>Error loading events</div>;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.title || !form.startTime) return;
        setSaving(true);

        const appointmentPayload: Record<string, unknown> = {
            title: form.title,
            description: form.description || undefined,
            startTime: form.startTime ? new Date(form.startTime).toISOString() : null,
            endTime: form.endTime ? new Date(form.endTime).toISOString() : null,
            location: form.location || undefined,
            eventType: form.eventType,
        };

        const sanitizePayload = (payload: Record<string, unknown>) => {
            const { metadata: _metadata, ...rest } = payload as { metadata?: unknown };
            return rest;
        };

        try {
            if (editingEventId) {
                await api.patch(`/events/${editingEventId}`, sanitizePayload(appointmentPayload));
            } else {
                await api.post('/events', sanitizePayload(appointmentPayload));
            }

            setEditingEventId(null);
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

            fetchEvents();
        } catch (err: unknown) {
            const message = err && typeof err === 'object' && 'response' in err && (err as { response?: { data?: { message?: string } } }).response?.data?.message
                ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
                : 'Failed to save event';
            alert(message);
        } finally {
            setSaving(false);
        }
    };

    // Build calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const entriesByDay = new Map<number, CalendarEntry[]>();
    for (const entry of entries) {
        const d = new Date(entry.startTime);
        if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
            const day = d.getDate();
            if (!entriesByDay.has(day)) entriesByDay.set(day, []);
            entriesByDay.get(day)!.push(entry);
        }
    }

    const isToday = (day: number) =>
        day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Events</h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Appointments, meetings, webinars, and more</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => setView('list')} className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-outline'}`}>List</button>
                        <button onClick={() => setView('calendar')} className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-outline'}`}>Calendar</button>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Icon icon={faPlus} /> New Event
                    </button>
                </div>
            </div>

            {/* Create form */}
            {showForm && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>{editingEventId ? 'Edit Event' : 'Create Event'}</h3>
                    <form onSubmit={handleSave}>
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
                            <button type="button" onClick={() => { setShowForm(false); setEditingEventId(null); }} className="btn btn-outline btn-sm">Cancel</button>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">{saving ? (editingEventId ? 'Saving…' : 'Creating…') : (editingEventId ? 'Save Changes' : 'Create Event')}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                }}>
                    <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 16, padding: '28px 32px', maxWidth: 400, width: '100%',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                    }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Delete Event?</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                            This action cannot be undone. The event and its associated data will be permanently deleted.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setDeleteTarget(null)}
                                disabled={deletingId !== null}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={() => handleDelete(deleteTarget)}
                                disabled={deletingId !== null}
                            >
                                {deletingId ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {view === 'list' && (loading ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
            ) : visibleEvents.length === 0 ? (
                <EmptyState
                    title="No events yet"
                    description="Create your first event to start managing attendance."
                    icon={faCalendar}
                    ctaLabel="Create Event"
                    ctaAction={() => setShowForm(true)}
                />
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {visibleEvents.map((ev) => (
                        <div key={ev.id} className="glass-card" style={{ padding: '18px 20px', transition: 'border-color 0.15s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                        <Link href={`/dashboard/events/${ev.id}`} style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', textDecoration: 'none' }}>{ev.title}</Link>
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
                                <div style={{ display: 'flex', height: 72, gap: 8 }}>
                                    <button
                                        type="button"
                                        className="btn btn-outline"
                                        style={{ height: '32px', fontSize: 13, flex: 1 }}
                                        onClick={() => openEditModal(ev)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-primary"
                                        style={{ height: '32px', fontSize: 13, flex: 1 }}
                                        onClick={() => setInviteEventId(ev.id)}
                                    >
                                        Invite
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-danger"
                                        style={{ height: '32px', fontSize: 13, flex: 1 }}
                                        onClick={() => setDeleteTarget(ev.id)}
                                        disabled={deletingId === ev.id}
                                    >
                                        {deletingId === ev.id ? 'Deleting…' : 'Delete'}
                                    </button>
                                </div>
                                {/* RSVP Stats */}
                                {eventsStats[ev.id] && (
                                    <div style={{ display: 'flex', gap: 6, fontSize: 12, marginTop: 8, flexWrap: 'wrap' }}>
                                        <Badge label={`${eventsStats[ev.id].confirmed || 0} Confirmed`} color="#22c55e" />
                                        <Badge label={`${eventsStats[ev.id].pending || 0} Pending`} color="#f59e0b" />
                                        <Badge label={`${eventsStats[ev.id].cancelled || 0} Cancelled`} color="#ef4444" />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {/* Calendar View */}
            {view === 'calendar' && (
                <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <button onClick={prevMonth} className="btn btn-outline btn-sm" style={{ padding: '6px 12px' }}>
                            <Icon icon={faChevronLeft} />
                        </button>
                        <span style={{ fontSize: 18, fontWeight: 700 }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
                        <button onClick={nextMonth} className="btn btn-outline btn-sm" style={{ padding: '6px 12px' }}>
                            <Icon icon={faChevronRight} />
                        </button>
                    </div>

                    {/* Day headers */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {DAY_NAMES.map(d => (
                            <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {d}
                            </div>
                        ))}
                    </div>

                    {/* Calendar cells */}
                    {calendarLoading ? (
                        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                            {cells.map((day, idx) => {
                                const dayEntries = day ? (entriesByDay.get(day) ?? []) : [];
                                const todayDay = day ? isToday(day) : false;
                                return (
                                    <div
                                        key={idx}
                                        style={{
                                            minHeight: 90,
                                            padding: '8px 6px',
                                            borderRight: (idx + 1) % 7 !== 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                            borderBottom: idx < cells.length - 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                            background: todayDay ? 'rgba(99,102,241,0.06)' : 'transparent',
                                        }}
                                    >
                                        {day && (
                                            <>
                                                <div style={{
                                                    fontSize: 13, fontWeight: 600, marginBottom: 4,
                                                    width: 22, height: 22, borderRadius: '50%', marginLeft: 'auto',
                                                    background: todayDay ? 'var(--accent)' : 'transparent',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    color: todayDay ? '#fff' : 'var(--text-secondary)',
                                                }}>
                                                    {day}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {dayEntries.slice(0, 3).map((entry) => (
                                                        <Link
                                                            key={entry.id}
                                                            href={`/dashboard/events/${entry.id}`}
                                                            style={{ textDecoration: 'none' }}
                                                        >
                                                            <div style={{
                                                                fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 3,
                                                                background: `${STATUS_DOT[entry.status] ?? '#6b7280'}22`,
                                                                borderLeft: `2px solid ${STATUS_DOT[entry.status] ?? '#6b7280'}`,
                                                                color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                                            }}>
                                                                {entry.title}
                                                            </div>
                                                        </Link>
                                                    ))}
                                                    {dayEntries.length > 3 && (
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 5 }}>
                                                            +{dayEntries.length - 3} more
                                                        </div>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Invite Modal */}
            {inviteEventId && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 1000,
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                }}>
                    <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: 16, padding: '28px 32px', maxWidth: 400, width: '100%',
                        maxHeight: '80vh', display: 'flex', flexDirection: 'column'
                    }}>
                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Invite Contacts</h3>
                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
                            {contactsRaw.map(c => (
                                <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedContactIds.has(c.id)} 
                                        onChange={(e) => {
                                            const next = new Set(selectedContactIds);
                                            if (e.target.checked) next.add(c.id);
                                            else next.delete(c.id);
                                            setSelectedContactIds(next);
                                        }} 
                                        title={`Select to invite ${c.name}`}
                                    />
                                    <span style={{ fontSize: 14 }}>{c.name}</span>
                                </label>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button className="btn btn-outline" onClick={() => setInviteEventId(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleInvite} disabled={inviting || selectedContactIds.size === 0}>
                                {inviting ? 'Inviting...' : `Invite ${selectedContactIds.size}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
