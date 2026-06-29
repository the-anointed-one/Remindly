'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/Toast';
import Link from 'next/link';

// ── Responsive hook ───────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < breakpoint);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [breakpoint]);
    return isMobile;
}

import api from '@/lib/api';
import FeatureBanner from '@/components/FeatureBanner';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/EmptyState';
import { Tooltip, HelpTip } from '@/components/ui/Tooltip';
import TooltipField from '@/components/ui/TooltipField';
import {
    faCalendar, faCalendarCheck, faClock, faPlus, faCheck, faTrash, faTimes, faChevronRight, faLayerGroup,
    faTag, faUser, faUsers, faBell, faTriangleExclamation
} from '@fortawesome/free-solid-svg-icons';
import SearchableSelect from '@/components/ui/SearchableSelect';

import ContactSearchDropdown, { ContactSlim } from '@/components/messaging/ContactSearchDropdown';
import ChannelSelector, { Channel } from '@/components/messaging/ChannelSelector';
import MessageEditor from '@/components/messaging/MessageEditor';

interface Appointment {
    id: string;
    title: string;
    scheduledAt: string;
    status: string;
    customerId: string;
    durationMinutes: number;
    notes?: string;
    isDemoData?: boolean;
    location?: { id: string; name: string; address?: string };
}

interface LocationSlim { id: string; name: string; timezone: string; phone?: string }
interface Tag { id: string; name: string }
interface Group { id: string; name: string; _count: { members: number } }
interface Campaign { id: string; name: string; segments: { id: string; name: string }[] }

type TargetType = 'contact' | 'tag' | 'group' | 'segment';

export default function AppointmentsPage() {
    const router = useRouter();
    const toast = useToast();
    const [apts, setApts] = useState<Appointment[]>([]);
    const [locations, setLocations] = useState<LocationSlim[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        title: '', scheduledAt: '',
        durationMinutes: 30, notes: '', locationId: '',
    });
    const [contact, setContact] = useState<ContactSlim | null>(null);
    const [enableReminders, setEnableReminders] = useState(false);
    const [reminderChannel, setReminderChannel] = useState<Channel>('SMS');
    const [reminderTemplate, setReminderTemplate] = useState('');
    const [saving, setSaving] = useState(false);
    const [targetType, setTargetType] = useState<TargetType>('contact');
    const [targetId, setTargetId] = useState('');
    const [allTags, setAllTags] = useState<Tag[]>([]);
    const [allGroups, setAllGroups] = useState<Group[]>([]);
    const [allCampaigns, setAllCampaigns] = useState<Campaign[]>([]);
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const isMobile = useIsMobile();

    useEffect(() => {
        router.replace('/dashboard/events');
    }, [router]);

    const fetchApts = useCallback(async () => {
        if (process.env.NODE_ENV !== 'production') console.debug('[AppointmentsPage] fetchApts');
        try {
            const { data } = await api.get('/appointments');
            setApts(Array.isArray(data) ? data : data.data || []);
        } catch {
            try {
                const { data } = await api.get('/events?eventType=APPOINTMENT');
                setApts(Array.isArray(data) ? data : data.data || []);
            } catch (err) {
                console.warn('fetchApts fallback failed', err);
                setApts([]);
            }
        } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchApts();
        api.get('/locations/slim').then(({ data }) => setLocations(data)).catch(() => { });
        api.get('/tags').then(({ data }) => setAllTags(data)).catch(() => { });
        api.get('/contacts/groups').then(({ data }) => setAllGroups(data)).catch(() => { });
        api.get('/campaigns').then(({ data }) => setAllCampaigns(data)).catch(() => { });
    }, [fetchApts]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload: Record<string, unknown> = {
                title: form.title,
                scheduledAt: new Date(form.scheduledAt).toISOString(),
                durationMinutes: Number(form.durationMinutes),
                notes: form.notes || undefined,
                targetType,
            };

            if (targetType === 'contact') {
                payload.customerId = contact?.id;
                payload.targetId = contact?.id;
            } else {
                payload.targetId = targetId;
            }

            if (form.locationId) payload.locationId = form.locationId;
            if (enableReminders && reminderTemplate.trim()) {
                payload.reminderConfig = {
                    channel: reminderChannel,
                    template: reminderTemplate,
                };
            }
            try {
                await api.post('/appointments', payload);
            } catch (_err) {
                // Safe migration: if /appointments is deprecated, write through /events with appointment mapping.
                const fallbackPayload = {
                    title: payload.title,
                    description: payload.notes,
                    startTime: payload.scheduledAt,
                    eventType: 'APPOINTMENT',
                    // Avoid sending metadata to keep strict server whitelist happy
                };
                await api.post('/events', fallbackPayload);
            }
            setShowForm(false);
            setForm({ title: '', scheduledAt: '', durationMinutes: 30, notes: '', locationId: '' });
            setContact(null);
            setTargetId('');
            setEnableReminders(false);
            setReminderTemplate('');
            fetchApts();
        } catch (err: unknown) {
            type ApiError = { response?: { data?: { message?: string } } };
            const apiErr = err as ApiError;
            const message = apiErr?.response?.data?.message || 'Failed to create appointment';
            alert(message);
        } finally { setSaving(false); }
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        const id = confirmDeleteId;
        // Optimistic removal
        const previous = apts;
        setApts((prev) => prev.filter((a) => a.id !== id));
        setConfirmDeleteId(null);
        setDeleting(true);
        try {
            await api.delete(`/appointments/${id}`);
            toast.success('Appointment deleted successfully');
        } catch (err: unknown) {
            // Revert on failure
            setApts(previous);
            type ApiError = { response?: { data?: { message?: string } } };
            const apiErr = err as ApiError;
            const message = apiErr?.response?.data?.message || 'Failed to delete appointment';
            toast.error(message);
        } finally {
            setDeleting(false);
        }
    };

    const statusColor = (s: string) => {
        if (s === 'CONFIRMED') return 'badge-success';
        if (s === 'CANCELLED') return 'badge-danger';
        if (s === 'COMPLETED') return 'badge-info';
        return 'badge-warning';
    };

    return (
        <div>
            {/* Confirmation Modal */}
            {confirmDeleteId && (
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
                        <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Delete Appointment?</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24, lineHeight: 1.6 }}>
                            This action cannot be undone. The appointment and its associated reminders will be permanently deleted.
                        </p>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                            <button
                                className="btn btn-outline"
                                onClick={() => setConfirmDeleteId(null)}
                                disabled={deleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-danger"
                                onClick={handleDelete}
                                disabled={deleting}
                            >
                                {deleting ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>Appointments</h1>
                <Tooltip
                    content="Appointments are sessions scheduled with your customers. Reminders will automatically be sent before each appointment based on your reminder rules."
                    placement="bottom-end"
                    maxWidth={280}
                >
                    <button className="btn btn-primary w-full md:w-auto" onClick={() => setShowForm(!showForm)}>
                        {showForm ? 'Cancel' : '+ New Appointment'}
                    </button>
                </Tooltip>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="grid-2">
                            <TooltipField label="Target Type" tooltip="Choose who this appointment is for. 'Single Contact' creates one appointment. Tag/Group/Segment creates one appointment for EACH contact in that group." className="input-group">
                                <select className="input" value={targetType} onChange={(e) => { setTargetType(e.target.value as TargetType); setTargetId(''); setContact(null); }}>
                                    <option value="contact">Single Contact</option>
                                    <option value="tag">By Tag</option>
                                    <option value="group">By Group</option>
                                    <option value="segment">By Audience Segment</option>
                                </select>
                            </TooltipField>

                            {targetType === 'contact' ? (
                                <TooltipField label="Customer" tooltip="Search and select a contact." className="input-group" style={{ zIndex: 10 }}>
                                    <ContactSearchDropdown
                                        value={contact}
                                        onChange={(c) => setContact(c as ContactSlim)}
                                        placeholder="Search by name, email, or phone..."
                                    />
                                </TooltipField>
                            ) : targetType === 'tag' ? (
                                <TooltipField label="Select Tag" tooltip="All contacts with this tag will receive an individual appointment." className="input-group">
                                    <SearchableSelect
                                        options={allTags.map(t => ({ id: t.id, name: t.name, icon: faTag }))}
                                        value={targetId}
                                        onChange={setTargetId}
                                        placeholder="Search or select tag..."
                                    />
                                </TooltipField>
                            ) : targetType === 'group' ? (
                                <TooltipField label="Select Group" tooltip="All members of this group will receive an individual appointment." className="input-group">
                                    <SearchableSelect
                                        options={allGroups.map(g => ({ 
                                            id: g.id, 
                                            name: g.name, 
                                            subtext: `${g._count.members} members`,
                                            icon: faUsers 
                                        }))}
                                        value={targetId}
                                        onChange={setTargetId}
                                        placeholder="Search or select group..."
                                    />
                                </TooltipField>
                            ) : (
                                <TooltipField label="Select Segment" tooltip="All contacts in this campaign segment will receive an individual appointment." className="input-group">
                                    <SearchableSelect
                                        options={allCampaigns.flatMap(c => c.segments.map(s => ({
                                            id: s.id,
                                            name: s.name,
                                            subtext: `Campaign: ${c.name}`,
                                            icon: faLayerGroup
                                        })))}
                                        value={targetId}
                                        onChange={setTargetId}
                                        placeholder="Search or select segment..."
                                    />
                                </TooltipField>
                            )}
                        </div>
                        <div className="grid-2">
                            <TooltipField label="Date & Time" tooltip="The date and start time of the appointment." className="input-group">
                                <input className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required />
                            </TooltipField>
                            <TooltipField label="Duration (min)" tooltip="Length of the appointment in minutes." className="input-group">
                                <input className="input" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} min={5} />
                            </TooltipField>
                        </div>
                        <div className="grid-2">
                            <TooltipField label="Location (optional)" tooltip="Select the business location for this appointment." className="input-group">
                                <select className="input" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
                                    <option value="">— No location —</option>
                                    {locations.map((l) => (
                                        <option key={l.id} value={l.id}>{l.name}</option>
                                    ))}
                                </select>
                            </TooltipField>
                            <TooltipField label="Title" tooltip="Brief title for the appointment (e.g. Consultation)." className="input-group">
                                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Dental Checkup" required />
                                <p className="text-xs text-muted mt-1">Name used internally to identify this appointment.</p>
                            </TooltipField>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Notes</label>
                            <textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." rows={2} />
                            <p className="text-xs text-muted mt-1">Add any extra details or context for the staff members.</p>
                        </div>

                        {/* Reminders Toggle Section */}
                        <div style={{ background: 'var(--bg-layer-2)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', marginTop: 8 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontWeight: 600 }}>
                                <input type="checkbox" checked={enableReminders} onChange={e => setEnableReminders(e.target.checked)} style={{ width: 18, height: 18 }} />
                                Enable Custom Inline Reminder
                            </label>
                            {enableReminders && (
                                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
                                    <ChannelSelector value={reminderChannel} onChange={setReminderChannel} />
                                    <MessageEditor value={reminderTemplate} onChange={setReminderTemplate} channel={reminderChannel} />
                                </div>
                            )}
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={saving || (targetType === 'contact' ? !contact : !targetId)}>
                            {saving ? 'Creating...' : targetType === 'contact' ? 'Create Appointment' : 'Schedule Bulk Appointments'}
                        </button>
                    </form>
                </div>
            )}

            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : apts.length === 0 ? (
                <EmptyState
                    title="No appointments yet"
                    description="Your upcoming appointments will appear here. Create your first appointment or sync with your calendar to get started."
                    icon={faCalendarCheck}
                    ctaLabel="New Appointment"
                    ctaAction={() => setShowForm(true)}
                />
            ) : (
                <>
                    {!isMobile ? (
                        <div className="table-container">
                            <table>
                                <thead><tr><th>Title</th><th>Date</th><th>Duration</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {apts.map((a) => (
                                        <tr key={a.id}>
                                            <td style={{ fontWeight: 600 }}>
                                                <Link href={`/dashboard/events/${a.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                                                    onMouseEnter={(e) => (e.currentTarget.style.color = '#f97316')}
                                                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                                                >
                                                    {a.title}
                                                </Link>
                                                {a.isDemoData && (
                                                    <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--warning)', background: 'rgba(247, 148, 29, 0.12)', border: '1px solid rgba(247, 148, 29, 0.3)', borderRadius: 4, padding: '1px 6px', verticalAlign: 'middle' }}>
                                                        DEMO
                                                    </span>
                                                )}
                                            </td>
                                            <td>{new Date(a.scheduledAt).toLocaleString()}</td>
                                            <td>{a.durationMinutes} min</td>
                                            <td style={{ color: a.location ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 13 }}>
                                                {a.location ? a.location.name : '—'}
                                            </td>
                                            <td><span className={`badge ${statusColor(a.status)}`}>{a.status}</span></td>
                                            <td><button className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteId(a.id)}>Delete</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {apts.map((a) => (
                                <div key={a.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ fontWeight: 700, fontSize: 15 }}>
                                            <Link href={`/dashboard/events/${a.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}>
                                                {a.title}
                                            </Link>
                                            {a.isDemoData && (
                                                <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px', verticalAlign: 'middle' }}>
                                                    DEMO
                                                </span>
                                            )}
                                        </div>
                                        <span className={`badge ${statusColor(a.status)}`}>{a.status}</span>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                        <div style={{ marginBottom: 4 }}><Icon icon={faCalendar} className="mr-2" /> {new Date(a.scheduledAt).toLocaleString()}</div>
                                        <div>Duration: {a.durationMinutes} min</div>
                                        {a.location && <div>Location: {a.location.name}</div>}
                                    </div>
                                    <div style={{ marginTop: 4, display: 'flex', justifyContent: 'flex-end' }}>
                                        <button className="btn btn-danger btn-sm" onClick={() => setConfirmDeleteId(a.id)}>Delete</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
