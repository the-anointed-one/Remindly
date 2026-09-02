'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { mapAppointmentDetailToEventDetail, AppointmentDetailDTO } from '@/adapters/event.adapter';
import Icon from '@/components/ui/Icon';
import { EventRsvpTracker } from '@/components/EventRsvpTracker';
import {
    faMapMarkerAlt,
    faChevronRight, faClock, faTrash,
} from '@fortawesome/free-solid-svg-icons';

interface EventDetail {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: string;
    endTime: string | null;
    status: string;
    eventType: string;
    isDemoData: boolean;
    participants: {
        id: string;
        status: string;
        response: string | null;
        contact: { 
            id: string; 
            name: string; 
            phone: string | null; 
            email: string | null;
            tags: string[];
            groupMemberships: { group: { name: string } }[];
        } | null;
        reminders?: { id: string; status: string; scheduledSendTime: string; sentAt: string | null }[];
    }[];
    responses: {
        id: string;
        response: string;
        responseStatus: string;
        timestamp: string;
        contact: { id: string; name: string } | null;
    }[];
    appointments: {
        id: string;
        title: string;
        scheduledAt: string;
        status: string;
    }[];
}

const STATUS_COLOR: Record<string, string> = {
    DRAFT: '#6b7280',
    PUBLISHED: '#3b82f6',
    ACTIVE: '#22c55e',
    COMPLETED: '#8b5cf6',
    CANCELLED: '#ef4444',
};

const PARTICIPANT_STATUS_COLOR: Record<string, string> = {
    invited: '#6b7280',
    confirmed: '#22c55e',
    cancelled: '#ef4444',
    pending: '#f59e0b',
};

function Badge({ label, color }: { label: string; color: string }) {
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 100,
            background: `${color}1a`, border: `1px solid ${color}40`, color,
            textTransform: 'uppercase' as const, letterSpacing: '0.04em',
        }}>
            {label}
        </span>
    );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div className="glass-card" style={{ padding: '16px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>{label}</div>
        </div>
    );
}

export default function EventDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [event, setEvent] = useState<EventDetail | null>(null);
    const [stats, setStats] = useState<{ total: number; confirmed: number; cancelled: number; pending: number; invited: number; arrived?: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [statusChanging, setStatusChanging] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Response Table state
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
    const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
    const [followUpMessage, setFollowUpMessage] = useState('');
    const [sendingFollowUp, setSendingFollowUp] = useState(false);
    
    // Replacement Logic States
    const [replaceModalOpen, setReplaceModalOpen] = useState(false);
    const [replacingParticipantId, setReplacingParticipantId] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestionsError, setSuggestionsError] = useState(false);
    const [performingReplacement, setPerformingReplacement] = useState(false);

    const filteredParticipants = useMemo(() => {
        if (!event) return [];
        return event.participants.filter(p => {
            if (statusFilter !== 'all' && p.status !== statusFilter) return false;
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const name = p.contact?.name?.toLowerCase() || '';
                const email = p.contact?.email?.toLowerCase() || '';
                const phone = p.contact?.phone?.toLowerCase() || '';
                const tags = p.contact?.tags?.join(' ').toLowerCase() || '';
                const groups = p.contact?.groupMemberships?.map(g => g.group.name).join(' ').toLowerCase() || '';
                
                if (!name.includes(q) && !email.includes(q) && !phone.includes(q) && !tags.includes(q) && !groups.includes(q)) {
                    return false;
                }
            }
            return true;
        });
    }, [event, statusFilter, searchQuery]);

    const toggleParticipantSelection = (id: string) => {
        const next = new Set(selectedParticipants);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedParticipants(next);
    };

    const selectAllFiltered = () => {
        if (selectedParticipants.size === filteredParticipants.length) {
            setSelectedParticipants(new Set());
        } else {
            setSelectedParticipants(new Set(filteredParticipants.map(p => p.id)));
        }
    };

    const handleSendFollowUp = async () => {
        if (!followUpMessage.trim() || selectedParticipants.size === 0) return;
        setSendingFollowUp(true);
        try {
            await api.post(`/events/${id}/broadcast`, {
                participantIds: Array.from(selectedParticipants),
                message: followUpMessage,
            });
            alert('Messages submitted successfully!');
            setFollowUpModalOpen(false);
            setFollowUpMessage('');
            setSelectedParticipants(new Set());
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to send messages');
        } finally {
            setSendingFollowUp(false);
        }
    };

    const openReplaceModal = async (participantId: string) => {
        setReplacingParticipantId(participantId);
        setReplaceModalOpen(true);
        fetchSuggestions();
    };

    const fetchSuggestions = async () => {
        setLoadingSuggestions(true);
        setSuggestionsError(false);
        try {
            const res = await api.get(`/events/${id}/suggest-replacements?limit=5`);
            setSuggestions(res.data);
        } catch (err) {
            console.error('Failed to fetch suggestions', err);
            setSuggestions([]);
            setSuggestionsError(true);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const handleReplace = async (newContactId: string) => {
        if (!replacingParticipantId) return;
        setPerformingReplacement(true);
        try {
            await api.post(`/events/${id}/replace`, {
                oldParticipantId: replacingParticipantId,
                newContactId: newContactId
            });
            alert('Replacement invited successfully!');
            setReplaceModalOpen(false);
            load(); // Refetch event data to show new participant
        } catch (err: any) {
            alert(err.response?.data?.message || 'Replacement failed');
        } finally {
            setPerformingReplacement(false);
        }
    };

    const load = async () => {
        try {
            const [evRes, statsRes] = await Promise.allSettled([
                api.get(`/events/${id}`),
                api.get(`/events/${id}/stats`),
            ]);
            if (evRes.status === 'fulfilled') {
                setEvent(evRes.value.data);
            } else {
                // Fallback to appointments endpoint when events endpoint is not available
                try {
                    const aptRes = await api.get(`/appointments/${id}`);
                    setEvent(mapAppointmentDetailToEventDetail(aptRes.data as AppointmentDetailDTO));
                } catch (aptErr) {
                    setError('Event not found.');
                }
            }

            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value.data);
            } else {
                setStats(null);
            }
        } catch (err) {
            console.warn('Event load error', err);
            setError('Event not found.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [id]);

    const handleStatusChange = async (newStatus: string) => {
        if (!event || newStatus === event.status) return;
        setStatusChanging(true);
        try {
            const { data } = await api.put(`/events/${id}`, { status: newStatus });
            setEvent(prev => prev ? { ...prev, status: data.status } : prev);
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to update status');
        } finally { setStatusChanging(false); }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this event? This cannot be undone.')) return;
        setDeleting(true);
        try {
            await api.delete(`/events/${id}`);
            router.push('/dashboard/events');
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete');
            setDeleting(false);
        }
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
    if (error || !event) return (
        <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{error || 'Not found'}</p>
            <Link href="/dashboard/events" className="btn btn-outline">← Back to Events</Link>
        </div>
    );

    return (
        <div style={{ maxWidth: 1024 }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, fontSize: 13, color: 'var(--text-muted)' }}>
                <Link href="/dashboard/events" style={{ color: 'var(--text-muted)' }}>Events</Link>
                <Icon icon={faChevronRight} className="text-xs" />
                <span style={{ color: 'var(--text-primary)' }}>{event.title}</span>
            </div>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
                        <h1 style={{ fontSize: 26, fontWeight: 800 }}>{event.title}</h1>
                        {event.isDemoData && <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '2px 8px' }}>DEMO</span>}
                        <Badge label={event.status} color={STATUS_COLOR[event.status] ?? '#6b7280'} />
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                        <span><Icon icon={faClock} className="mr-1" />{new Date(event.startTime).toLocaleString()}</span>
                        {event.endTime && <span>→ {new Date(event.endTime).toLocaleString()}</span>}
                        {event.location && <span><Icon icon={faMapMarkerAlt} className="mr-1" />{event.location}</span>}
                    </div>
                    {event.description && <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 8, maxWidth: 540 }}>{event.description}</p>}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Link
                        href={`/dashboard/events/${id}/scanner`}
                        title="Scan attendee QR codes to check them in at the venue."
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 20px',
                            borderRadius: 8,
                            background: 'var(--primary)',
                            color: '#fff',
                            textDecoration: 'none',
                            fontSize: 14,
                            fontWeight: 500,
                        }}
                    >
                        📷 Open Check-In Scanner
                    </Link>
                    <select
                        value={event.status}
                        disabled={statusChanging}
                        onChange={e => handleStatusChange(e.target.value)}
                        className="input"
                        title="Change the publication status of this event."
                        style={{ fontSize: 13, padding: '6px 10px', cursor: 'pointer', minWidth: 130 }}
                    >
                        <option value="DRAFT">Draft</option>
                        <option value="PUBLISHED">Published</option>
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                    <button onClick={handleDelete} disabled={deleting} className="btn btn-danger btn-sm"
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon icon={faTrash} /> {deleting ? 'Deleting…' : 'Delete'}
                    </button>
                </div>
            </div>

            {/* Attendance stats */}
            {stats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
                    <StatCard label="INVITED" value={stats.total} color="var(--text-primary)" />
                    <StatCard label="CONFIRMED" value={stats.confirmed} color="#22c55e" />
                    <StatCard label="ARRIVED" value={stats.arrived ?? 0} color="#0F6E56" />
                    <StatCard label="PENDING" value={stats.pending} color="#f59e0b" />
                    <StatCard label="CANCELLED" value={stats.cancelled} color="#ef4444" />
                </div>
            )}

            {/* Live RSVP Tracker */}
            <EventRsvpTracker eventId={id} />

            {/* Attendance pipeline */}
            <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                    Attendance Pipeline
                </h3>
                <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
                    {[
                        { label: 'Created', value: '✓', color: '#22c55e', done: true },
                        { label: 'Invites Sent', value: stats ? `${stats.total}` : '—', color: '#3b82f6', done: (stats?.total ?? 0) > 0 },
                        { label: 'Confirmed', value: stats ? `${stats.confirmed}` : '—', color: '#22c55e', done: (stats?.confirmed ?? 0) > 0 },
                        { label: 'Pending', value: stats ? `${stats.pending}` : '—', color: '#f59e0b', done: false },
                        { label: 'Completed', value: event.status === 'COMPLETED' ? '✓' : '—', color: '#8b5cf6', done: event.status === 'COMPLETED' },
                    ].map((stage, idx, arr) => (
                        <div key={stage.label} style={{ display: 'flex', alignItems: 'flex-start', flex: 1, minWidth: 100 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: 10 }}>
                                    {idx > 0 && <div style={{ flex: 1, height: 2, background: stage.done ? stage.color : 'rgba(255,255,255,0.08)' }} />}
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                        background: stage.done ? `${stage.color}22` : 'rgba(255,255,255,0.05)',
                                        border: `2px solid ${stage.done ? stage.color : 'rgba(255,255,255,0.1)'}`,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: 13, fontWeight: 700, color: stage.done ? stage.color : 'var(--text-muted)',
                                    }}>
                                        {stage.value}
                                    </div>
                                    {idx < arr.length - 1 && <div style={{ flex: 1, height: 2, background: arr[idx + 1].done ? arr[idx + 1].color : 'rgba(255,255,255,0.08)' }} />}
                                </div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: stage.done ? 'var(--text-primary)' : 'var(--text-muted)', textAlign: 'center' }}>
                                    {stage.label}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 20 }}>
                {/* Advanced Response Table */}
                <div className="glass-card" style={{ padding: 24, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Response Table
                            </h3>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', borderRadius: 100, padding: '2px 9px', fontWeight: 600 }}>
                                {event.participants.length} Participants
                            </span>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <input 
                                type="text"
                                placeholder="Search Name, Phone, Email, Tag..."
                                className="input"
                                title="Filter the participant list."
                                style={{ fontSize: 13, padding: '6px 12px', minWidth: 200 }}
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <select 
                                className="input"
                                style={{ fontSize: 13, padding: '6px 10px', minWidth: 120 }}
                                value={statusFilter}
                                title="Filter participants by their RSVP status."
                                onChange={e => setStatusFilter(e.target.value)}
                            >
                                <option value="all">All Status</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="pending">Pending</option>
                                <option value="cancelled">Cancelled</option>
                            </select>
                            <button 
                                className="btn btn-primary btn-sm"
                                disabled={selectedParticipants.size === 0}
                                onClick={() => setFollowUpModalOpen(true)}
                            >
                                Smart Follow-Up ({selectedParticipants.size})
                            </button>
                        </div>
                    </div>
                    
                    {filteredParticipants.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            No participants match the filter
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto', margin: '0 -24px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-muted)', backgroundColor: 'transparent' }}>
                                        <th style={{ padding: '12px 24px', width: 40 }}>
                                            <input 
                                                type="checkbox" 
                                                checked={selectedParticipants.size === filteredParticipants.length && filteredParticipants.length > 0}
                                                onChange={selectAllFiltered}
                                                style={{ cursor: 'pointer' }}
                                            />
                                        </th>
                                        <th style={{ padding: '12px 10px' }}>Participant</th>
                                        <th style={{ padding: '12px 10px' }}>Contact Details</th>
                                        <th style={{ padding: '12px 10px' }}>Tags / Groups</th>
                                        <th style={{ padding: '12px 10px' }}>Reminders</th>
                                        <th style={{ padding: '12px 24px', textAlign: 'right' }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredParticipants.map(p => (
                                        <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                            <td style={{ padding: '12px 24px' }}>
                                                <input 
                                                    type="checkbox"
                                                    checked={selectedParticipants.has(p.id)}
                                                    onChange={() => toggleParticipantSelection(p.id)}
                                                    style={{ cursor: 'pointer' }}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 10px' }}>
                                                {p.contact ? (
                                                    <Link href={`/dashboard/contacts/${p.contact.id}`}
                                                        style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        {p.contact.name}
                                                    </Link>
                                                ) : (
                                                    <span style={{ color: 'var(--text-muted)' }}>Unknown</span>
                                                )}
                                                {p.response && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>"{p.response}"</div>}
                                            </td>
                                            <td style={{ padding: '12px 10px', color: 'var(--text-secondary)' }}>
                                                <div style={{ marginBottom: 2 }}>{p.contact?.phone || '-'}</div>
                                                <div style={{ fontSize: 12, opacity: 0.8 }}>{p.contact?.email || '-'}</div>
                                            </td>
                                            <td style={{ padding: '12px 10px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                                    {p.contact?.tags?.map(t => (
                                                        <span key={t} style={{ fontSize: 10, background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>{t}</span>
                                                    ))}
                                                    {p.contact?.groupMemberships?.map(g => (
                                                        <span key={g.group.name} style={{ fontSize: 10, background: 'var(--brand-primary)', color: 'white', padding: '2px 6px', borderRadius: 4 }}>{g.group.name}</span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 10px' }}>
                                                {p.reminders && p.reminders.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        {p.reminders.map(rem => (
                                                            <div key={rem.id} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                                                                <span style={{ 
                                                                    width: 6, height: 6, borderRadius: '50%', 
                                                                    background: rem.status === 'SENT' ? '#22c55e' : (rem.status === 'CANCELLED' ? '#ef4444' : '#f59e0b') 
                                                                }} />
                                                                <span style={{ color: 'var(--text-secondary)' }}>
                                                                    {rem.status === 'PENDING' ? `Scheduled: ${new Date(rem.scheduledSendTime).toLocaleDateString()}` : rem.status}
                                                                </span>
                                                                {rem.sentAt && <span style={{ opacity: 0.6 }}>({new Date(rem.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</span>}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>None</span>
                                                )}
                                            </td>
                                             <td style={{ padding: '12px 24px', textAlign: 'right' }}>
                                                 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                                                     <Badge label={p.status} color={PARTICIPANT_STATUS_COLOR[p.status] ?? '#6b7280'} />
                                                     {p.status === 'cancelled' && (
                                                         <button 
                                                             className="btn-link" 
                                                             style={{ fontSize: 11, color: 'var(--brand-primary)' }}
                                                             onClick={() => openReplaceModal(p.id)}
                                                         >
                                                             Replace...
                                                         </button>
                                                     )}
                                                 </div>
                                             </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Responses */}
                <div className="glass-card" style={{ padding: 24 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Responses
                        </h3>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.07)', borderRadius: 100, padding: '2px 9px', fontWeight: 600 }}>
                            {event.responses.length}
                        </span>
                    </div>
                    {event.responses.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            No responses yet
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {event.responses.slice(0, 10).map((r) => (
                                <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <span style={{ fontSize: 13, fontWeight: 600 }}>{r.contact?.name ?? 'Unknown'}</span>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>"{r.response}"</div>
                                    </div>
                                    <Badge
                                        label={r.responseStatus}
                                        color={r.responseStatus === 'confirmed' ? '#22c55e' : r.responseStatus === 'cancelled' ? '#ef4444' : '#f59e0b'}
                                    />
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Linked appointments */}
                {event.appointments.length > 0 && (
                    <div className="glass-card" style={{ padding: 24, gridColumn: '1 / -1' }}>
                        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 16 }}>
                            Linked Appointments
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {event.appointments.map((apt) => (
                                <div key={apt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
                                    <div>
                                        <Link href={`/dashboard/events/${apt.id}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {apt.title}
                                        </Link>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(apt.scheduledAt).toLocaleString()}</div>
                                    </div>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{apt.status}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Smart Follow-Up Modal */}
            {followUpModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass-card" style={{ padding: 24, width: '100%', maxWidth: 500 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Smart Follow-Up</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                            Send a targeted message to {selectedParticipants.size} participant(s).
                        </p>
                        <textarea
                            className="input"
                            style={{ minHeight: 120, fontSize: 14, marginBottom: 20, width: '100%', padding: '12px' }}
                            placeholder="Type your message here..."
                            title="Message content for the smart follow-up."
                            value={followUpMessage}
                            onChange={(e) => setFollowUpMessage(e.target.value)}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setFollowUpModalOpen(false)}
                                disabled={sendingFollowUp}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSendFollowUp}
                                disabled={sendingFollowUp || !followUpMessage.trim()}
                            >
                                {sendingFollowUp ? 'Sending...' : 'Send Messages'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Replacement Modal */}
            {replaceModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="glass-card" style={{ padding: 24, width: '100%', maxWidth: 500 }}>
                        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Suggest Replacement</h2>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
                            A participant has cancelled. Invite someone fresh from your contacts.
                        </p>

                        {loadingSuggestions ? (
                            <div style={{ padding: 20, textAlign: 'center' }}>Loading suggestions...</div>
                        ) : suggestionsError ? (
                            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                                AI suggestions unavailable.
                                <button disabled={loadingSuggestions} onClick={fetchSuggestions} className="btn-link" style={{ marginLeft: 8, color: 'var(--brand-primary)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}>Retry</button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                                {suggestions.length === 0 ? (
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>No available contacts found to suggest.</div>
                                ) : (
                                    suggestions.map(s => (
                                        <div key={s.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.phone || s.email || 'No contact info'}</div>
                                            </div>
                                            <button 
                                                className="btn btn-primary btn-sm"
                                                disabled={performingReplacement}
                                                onClick={() => handleReplace(s.id)}
                                            >
                                                Invite
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setReplaceModalOpen(false)}
                                disabled={performingReplacement}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
