'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import DateTimePicker from '@/components/ui/DateTimePicker';
import {
    faCalendar, faUsers, faBell, faEdit, faTrash,
    faClock, faMapMarkerAlt, faChevronRight,
    faCheckCircle, faCircle, faHistory,
} from '@fortawesome/free-solid-svg-icons';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Participant {
    id: string;
    status: string;
    contact: { id: string; name: string; phone: string | null; email: string | null } | null;
}

interface Reminder {
    id: string;
    channel: string;
    sendTime: string;
    status: string;
    message: string | null;
}

interface AppointmentDetail {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes: number;
    status: string;
    notes: string | null;
    isDemoData?: boolean;
    customer: { id: string; firstName: string; lastName: string; phone: string | null; email: string | null } | null;
    location: { id: string; name: string; address: string | null } | null;
    reminders: Reminder[];
    participants: Participant[];
}

interface TimelineEvent {
    id: string;
    activityType: string;
    createdAt: string;
    metadata?: Record<string, any>;
}

interface Pipeline {
    appointment: AppointmentDetail;
    participants: Participant[];
    reminders: Reminder[];
    prediction: { riskScore: number; factors: string[] } | null;
    rsvpCampaign: { id: string; name: string; stats?: { confirmed: number; cancelled: number; pending: number } } | null;
    feedback: { sentiment: string } | null;
    timeline: TimelineEvent[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
    PENDING: '#f59e0b',
    CONFIRMED: '#22c55e',
    CANCELLED: '#ef4444',
    COMPLETED: '#3b82f6',
    NO_SHOW: '#8b5cf6',
};

const reminderStatusColor: Record<string, string> = {
    PENDING: '#f59e0b',
    SENT: '#22c55e',
    FAILED: '#ef4444',
    CANCELLED: '#6b7280',
};

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
            background: `${color}1a`, border: `1px solid ${color}40`, color,
            textTransform: 'uppercase' as const, letterSpacing: '0.04em',
        }}>
            {label}
        </span>
    );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
    contact_created: 'Contact created',
    appointment_created: 'Event scheduled',
    appointment_confirmed: 'Event confirmed',
    appointment_deleted: 'Event deleted',
    appointment_rescheduled: 'Event rescheduled',
    message_sent: 'Message sent',
    message_delivered: 'Message delivered',
    campaign_sent: 'Campaign sent',
    reminder_sent: 'Reminder sent',
    review_requested: 'Review requested',
    tag_added: 'Tag added',
    tag_removed: 'Tag removed',
    campaign_response_received: 'Campaign response received',
};

function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AppointmentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();

    useEffect(() => {
        if (!id) return;
        router.replace(`/dashboard/events/${id}`);
    }, [id, router]);

    const [apt, setApt] = useState<AppointmentDetail | null>(null);
    const [pipeline, setPipeline] = useState<Pipeline | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Edit mode state
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editScheduledAt, setEditScheduledAt] = useState('');
    const [editDuration, setEditDuration] = useState(30);
    const [editNotes, setEditNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [statusChanging, setStatusChanging] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const [aptRes, pipelineRes] = await Promise.allSettled([
                api.get(`/appointments/${id}`),
                api.get(`/appointments/${id}/pipeline`),
            ]);
            if (aptRes.status === 'fulfilled') {
                const data = aptRes.value.data;
                setApt(data);
                setEditTitle(data.title);
                // DateTimePicker's datetime value is a full UTC ISO instant; it
                // interprets/displays it in the business timezone itself, so
                // don't truncate to a bare wall-clock string here.
                setEditScheduledAt(new Date(data.scheduledAt).toISOString());
                setEditDuration(data.durationMinutes);
                setEditNotes(data.notes ?? '');
            } else {
                setError('Appointment not found.');
            }
            if (pipelineRes.status === 'fulfilled') {
                setPipeline(pipelineRes.value.data);
            }
        } catch {
            setError('Appointment not found.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); }, [id]);

    const handleStatusChange = async (newStatus: string) => {
        if (!apt || newStatus === apt.status) return;
        setStatusChanging(true);
        try {
            const { data } = await api.put(`/appointments/${id}`, { status: newStatus });
            setApt((prev) => prev ? { ...prev, status: data.status } : prev);
            // Reload pipeline to reflect new timeline events
            api.get(`/appointments/${id}/pipeline`).then(r => setPipeline(r.data)).catch(() => {});
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to update status');
        } finally {
            setStatusChanging(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data } = await api.put(`/appointments/${id}`, {
                title: editTitle,
                scheduledAt: new Date(editScheduledAt).toISOString(),
                durationMinutes: editDuration,
                notes: editNotes || undefined,
            });
            setApt((prev) => prev ? { ...prev, ...data } : prev);
            setEditing(false);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to save changes');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this appointment? This cannot be undone.')) return;
        setDeleting(true);
        try {
            await api.delete(`/appointments/${id}`);
            router.push('/dashboard/appointments');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete');
            setDeleting(false);
        }
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;

    if (error || !apt) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{error || 'Not found'}</p>
                <Link href="/dashboard/appointments" className="btn btn-outline">← Back to Appointments</Link>
            </div>
        );
    }

    const isCompleted = apt.status === 'COMPLETED';
    const isCancelled = apt.status === 'CANCELLED';

    return (
        <div style={{ maxWidth: 960 }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                <Link href="/dashboard/appointments" style={{ color: 'var(--text-muted)' }}>Appointments</Link>
                <Icon icon={faChevronRight} style={{ fontSize: 10 }} />
                <span style={{ color: 'var(--text-primary)' }}>{apt.title}</span>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <h1 style={{ fontSize: 26, fontWeight: 800 }}>{apt.title}</h1>
                        {apt.isDemoData && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 8px' }}>
                                DEMO
                            </span>
                        )}
                        <Badge label={apt.status} color={statusColor[apt.status] ?? '#6b7280'} />
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        <Icon icon={faCalendar} style={{ marginRight: 6 }} />
                        {new Date(apt.scheduledAt).toLocaleString()} · {apt.durationMinutes} min
                        {apt.location && <span style={{ marginLeft: 12 }}><Icon icon={faMapMarkerAlt} style={{ marginRight: 4 }} />{apt.location.name}</span>}
                    </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end', alignItems: 'center' }}>
                    {/* Status dropdown */}
                    <select
                        value={apt.status}
                        disabled={statusChanging}
                        onChange={(e) => handleStatusChange(e.target.value)}
                        className="input"
                        title="Change the current status of this appointment."
                        style={{ fontSize: 13, padding: '6px 10px', cursor: 'pointer', minWidth: 140 }}
                    >
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="NO_SHOW">No Show</option>
                    </select>
                    {!isCancelled && !isCompleted && (
                        <button
                            onClick={() => setEditing(!editing)}
                            className="btn btn-outline btn-sm"
                            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                        >
                            <Icon icon={faEdit} /> Edit
                        </button>
                    )}
                    <button
                        onClick={handleDelete}
                        disabled={deleting}
                        className="btn btn-danger btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        <Icon icon={faTrash} /> {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>

            {/* Edit Form */}
            {editing && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Edit Appointment</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div className="input-group">
                            <label className="input-label">Title</label>
                            <input className="input" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} 
                                title="The descriptive title for this appointment." />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Date & Time</label>
                            <DateTimePicker value={editScheduledAt} onChange={(v) => setEditScheduledAt(v)} />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Duration (min)</label>
                            <input className="input" type="number" value={editDuration} onChange={(e) => setEditDuration(Number(e.target.value))} min={5} 
                                title="How many minutes the appointment is expected to last." />
                        </div>
                    </div>
                    <div className="input-group" style={{ marginBottom: 14 }}>
                        <label className="input-label">Notes</label>
                        <textarea className="input" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} 
                            title="Any additional internal notes or customer requirements." />
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={() => setEditing(false)} className="btn btn-outline btn-sm">Cancel</button>
                        <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">{saving ? 'Saving…' : 'Save Changes'}</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

                {/* Appointment Details */}
                <div className="glass-card" style={{ padding: 24 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                        Appointment Details
                    </h3>
                    <div style={{ display: 'grid', gap: 14 }}>
                        <Row label="Title" value={apt.title} />
                        <Row label="Date & Time" value={new Date(apt.scheduledAt).toLocaleString()} />
                        <Row label="Duration" value={`${apt.durationMinutes} minutes`} />
                        <Row label="Status" value={<Badge label={apt.status} color={statusColor[apt.status] ?? '#6b7280'} />} />
                        {apt.location && <Row label="Location" value={apt.location.name} />}
                        {apt.customer && <Row label="Customer" value={`${apt.customer.firstName} ${apt.customer.lastName}`} />}
                        {apt.notes && (
                            <div>
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Notes</div>
                                <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: 8 }}>
                                    {apt.notes}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Audience / Participants */}
                <div className="glass-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Audience
                        </h3>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}>
                            {apt.participants.length}
                        </span>
                    </div>
                    {apt.participants.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            <Icon icon={faUsers} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
                            No participants recorded
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {apt.participants.slice(0, 8).map((p) => (
                                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        {p.contact ? (
                                            <Link href={`/dashboard/contacts/${p.contact.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {p.contact.name}
                                            </Link>
                                        ) : (
                                            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Unknown contact</span>
                                        )}
                                        {p.contact?.phone && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.contact.phone}</div>}
                                    </div>
                                    <Badge label={p.status} color={p.status === 'CONFIRMED' ? '#22c55e' : '#6b7280'} />
                                </div>
                            ))}
                            {apt.participants.length > 8 && (
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 4 }}>
                                    +{apt.participants.length - 8} more
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Reminder Schedule */}
                <div className="glass-card" style={{ padding: 24, gridColumn: '1 / -1' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Reminders
                        </h3>
                        <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.07)', color: 'var(--text-muted)' }}>
                            {apt.reminders.length}
                        </span>
                    </div>
                    {apt.reminders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            <Icon icon={faBell} style={{ fontSize: 28, marginBottom: 10, display: 'block' }} />
                            No reminders scheduled for this appointment
                        </div>
                    ) : (
                        <div className="table-container">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Send Time</th>
                                        <th>Channel</th>
                                        <th>Status</th>
                                        <th>Message Preview</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {apt.reminders.map((r) => (
                                        <tr key={r.id}>
                                            <td style={{ fontSize: 13 }}>
                                                <Icon icon={faClock} style={{ marginRight: 6, color: 'var(--text-muted)' }} />
                                                {new Date(r.sendTime).toLocaleString()}
                                            </td>
                                            <td>
                                                <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.07)', color: 'var(--text-secondary)' }}>
                                                    {r.channel}
                                                </span>
                                            </td>
                                            <td>
                                                <Badge
                                                    label={r.status}
                                                    color={reminderStatusColor[r.status] ?? '#6b7280'}
                                                />
                                            </td>
                                            <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {r.message ?? '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>

            {/* ── Event Pipeline ──────────────────────────────── */}
            <div className="glass-card" style={{ padding: 24, marginTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 20 }}>
                    Event Pipeline
                </h3>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, overflowX: 'auto' }}>
                    {[
                        {
                            label: 'Scheduled',
                            done: true,
                            detail: new Date(apt.scheduledAt).toLocaleDateString(),
                        },
                        {
                            label: 'Reminders',
                            done: apt.reminders.length > 0,
                            detail: apt.reminders.length === 0
                                ? 'None scheduled'
                                : (() => {
                                    const sent = apt.reminders.filter(r => r.status === 'SENT').length;
                                    const pending = apt.reminders.filter(r => r.status === 'PENDING').length;
                                    const failed = apt.reminders.filter(r => r.status === 'FAILED').length;
                                    return `${sent} sent · ${pending} pending${failed ? ` · ${failed} failed` : ''}`;
                                })(),
                        },
                        {
                            label: 'RSVP',
                            done: !!pipeline?.rsvpCampaign,
                            detail: pipeline?.rsvpCampaign
                                ? `${pipeline.rsvpCampaign.stats?.confirmed ?? 0} confirmed · ${pipeline.rsvpCampaign.stats?.pending ?? 0} pending`
                                : apt.participants.length === 1 ? 'Single contact' : 'No campaign',
                        },
                        {
                            label: 'Risk Score',
                            done: !!pipeline?.prediction,
                            detail: (() => {
                                const score = pipeline?.prediction?.riskScore;
                                if (score == null) return 'Pending analysis';
                                const color = score < 36 ? '#22c55e' : score < 61 ? '#f59e0b' : '#ef4444';
                                return <span style={{ color, fontWeight: 700 }}>{score} / 100</span>;
                            })(),
                        },
                        {
                            label: 'Post-Event',
                            done: apt.status === 'COMPLETED' && !!pipeline?.feedback,
                            detail: (() => {
                                if (apt.status !== 'COMPLETED') return '—';
                                const s = pipeline?.feedback?.sentiment;
                                if (!s) return 'Awaiting feedback';
                                const color = s === 'POSITIVE' ? '#22c55e' : s === 'NEGATIVE' ? '#ef4444' : '#f59e0b';
                                return <span style={{ color, fontWeight: 700 }}>{s}</span>;
                            })(),
                        },
                    ].map((stage, idx, arr) => (
                        <div key={stage.label} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 140 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                {/* connector line before */}
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                                    {idx > 0 && <div style={{ flex: 1, height: 2, background: stage.done ? 'var(--accent)' : 'rgba(255,255,255,0.1)' }} />}
                                    <span style={{ fontSize: idx === 0 ? 22 : 18, color: stage.done ? 'var(--accent)' : 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                                        <Icon icon={stage.done ? faCheckCircle : faCircle} />
                                    </span>
                                    {idx < arr.length - 1 && <div style={{ flex: 1, height: 2, background: arr[idx + 1].done ? 'var(--accent)' : 'rgba(255,255,255,0.1)' }} />}
                                </div>
                                <div style={{ textAlign: 'center', paddingBottom: 4, paddingInline: 4 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: stage.done ? 'var(--text-primary)' : 'var(--text-muted)', marginBottom: 4 }}>{stage.label}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{stage.detail}</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Activity Timeline ─────────────────────────── */}
            {pipeline && pipeline.timeline.length > 0 && (
                <div className="glass-card" style={{ padding: 24, marginTop: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Activity Timeline
                        </h3>
                        <Icon icon={faHistory} className="text-sm" />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                        {pipeline.timeline.map((event, idx) => (
                            <div key={event.id} style={{ display: 'flex', gap: 14, paddingBottom: idx < pipeline.timeline.length - 1 ? 16 : 0 }}>
                                {/* vertical line */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', marginTop: 3, flexShrink: 0 }} />
                                    {idx < pipeline.timeline.length - 1 && (
                                        <div style={{ flex: 1, width: 1, background: 'rgba(255,255,255,0.08)', marginTop: 4 }} />
                                    )}
                                </div>
                                <div style={{ paddingBottom: idx < pipeline.timeline.length - 1 ? 0 : 0 }}>
                                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                                        {ACTIVITY_LABELS[event.activityType] ?? event.activityType}
                                        {event.metadata?.tag && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 6px' }}>{event.metadata.tag}</span>}
                                        {event.metadata?.channel && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', borderRadius: 4, padding: '1px 6px' }}>{event.metadata.channel}</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{relativeTime(event.createdAt)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}

// ── Small helper ──────────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{value}</div>
        </div>
    );
}
