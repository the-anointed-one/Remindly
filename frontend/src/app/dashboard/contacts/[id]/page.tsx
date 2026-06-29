'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { faPlus, faComment, faCalendarPlus, faBell, faTimes, faUsers } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import ContactTimeline, { Activity } from '@/components/contacts/ContactTimeline';

// ── Types ────────────────────────────────────
interface ContactDetail {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    tags: string[];
    notes: string | null;
    unsubscribed: boolean;
    lastAppointment: string | null;
    createdAt: string;
    updatedAt: string;
}

interface ContactGroup { id: string; name: string }
interface AvailableGroup { id: string; name: string; _count: { members: number } }

// ── Helpers ──────────────────────────────────
function Avatar({ name, size = 56 }: { name: string; size?: number }) {
    const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
    const hue = name.charCodeAt(0) * 37 % 360;
    return (
        <div style={{
            width: size, height: size, borderRadius: '50%', flexShrink: 0,
            background: `hsl(${hue},55%,18%)`, border: `2px solid hsl(${hue},55%,35%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: size * 0.3, fontWeight: 700, color: `hsl(${hue},70%,70%)`,
        }}>
            {initials || '?'}
        </div>
    );
}

function EditField({ label, value, onChange, type = 'text', placeholder }: any) {
    return (
        <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }}>
                {label}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                title={`Enter ${label.toLowerCase()}`}
                style={{
                    width: '100%', padding: '8px 12px', borderRadius: 8,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', fontSize: 14,
                }}
            />
        </div>
    );
}

// ── Main Page ─────────────────────────────────
export default function ContactProfilePage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [contact, setContact] = useState<ContactDetail | null>(null);
    const [activities, setActivities] = useState<Activity[]>([]);
    const [activeTab, setActiveTab] = useState<'activity' | 'appointments' | 'messages' | 'campaigns' | 'reminders'>('activity');
    const [loading, setLoading] = useState(true);

    // Edit state
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [notes, setNotes] = useState('');

    // Groups state
    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [availableGroups, setAvailableGroups] = useState<AvailableGroup[]>([]);
    const [showGroupDropdown, setShowGroupDropdown] = useState(false);
    const [groupSearch, setGroupSearch] = useState('');
    const [groupLoading, setGroupLoading] = useState(false);
    const groupDropdownRef = useRef<HTMLDivElement>(null);

    const loadGroups = async () => {
        const [{ data: memberOf }, { data: allGroups }] = await Promise.all([
            api.get(`/contacts/${id}/groups`),
            api.get('/contacts/groups'),
        ]);
        setGroups((memberOf as any[]).map((m: any) => m.group));
        setAvailableGroups(allGroups);
    };

    const load = async () => {
        setLoading(true);
        try {
            const [{ data: contactData }, { data: activityData }] = await Promise.all([
                api.get(`/contacts/${id}`),
                api.get(`/contacts/${id}/activity`)
            ]);
            setContact(contactData);
            setActivities(activityData || []);

            // Populate form
            setName(contactData.name);
            setPhone(contactData.phone ?? '');
            setEmail(contactData.email ?? '');
            setTagInput(contactData.tags.join(', '));
            setNotes(contactData.notes ?? '');
        } catch {
            setError('Contact not found.');
        }
        setLoading(false);
    };

    useEffect(() => { load(); loadGroups(); }, [id]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (groupDropdownRef.current && !groupDropdownRef.current.contains(e.target as Node)) {
                setShowGroupDropdown(false);
                setGroupSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleAddToGroup = async (groupId?: string, groupName?: string) => {
        setGroupLoading(true);
        try {
            const { data } = await api.post(`/contacts/${id}/groups`, { groupId, groupName });
            setGroups((prev) => [...prev, { id: data.groupId, name: data.name }]);
            setShowGroupDropdown(false);
            setGroupSearch('');
            await loadGroups(); // refresh available groups (count updated)
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to add to group');
        } finally {
            setGroupLoading(false);
        }
    };

    const handleRemoveFromGroup = async (groupId: string) => {
        try {
            await api.delete(`/contacts/${id}/groups/${groupId}`);
            setGroups((prev) => prev.filter((g) => g.id !== groupId));
        } catch {
            alert('Failed to remove from group');
        }
    };

    const filteredGroups = availableGroups.filter(
        (g) =>
            !groups.some((m) => m.id === g.id) &&
            g.name.toLowerCase().includes(groupSearch.toLowerCase())
    );

    const handleSave = async () => {
        setSaving(true);
        setError('');
        try {
            const tags = tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
            const { data } = await api.patch(`/contacts/${id}`, {
                name: name.trim() || undefined,
                phone: phone || undefined,
                email: email || undefined,
                tags,
                notes: notes || undefined,
            });
            setContact((prev) => prev ? { ...prev, ...data } : prev);
            setEditing(false);
            api.get(`/contacts/${id}/activity`).then(res => setActivities(res.data)).catch(() => {});
        } catch (err: any) {
            setError(err.response?.data?.message || 'Save failed');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Delete this contact? This cannot be undone.')) return;
        setDeleting(true);
        try {
            await api.delete(`/contacts/${id}`);
            router.push('/dashboard/contacts');
        } catch {
            setError('Delete failed.');
            setDeleting(false);
        }
    };

    const toggleUnsubscribed = async () => {
        const next = !contact?.unsubscribed;
        await api.patch(`/contacts/${id}`, { unsubscribed: next });
        setContact((prev) => prev ? { ...prev, unsubscribed: next } : prev);
    };

    if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>;
    if (!contact) {
        return (
            <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Contact not found.</p>
                <Link href="/dashboard/contacts" className="btn btn-outline">← Back to Contacts</Link>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 1200 }}>
            {/* Breadcrumb */}
            <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Link href="/dashboard/contacts" style={{ color: 'var(--text-muted)', fontSize: 13 }}>← Back to Contacts</Link>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={handleDelete} disabled={deleting} style={{ fontSize: 13, color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.7 }}>
                        {deleting ? 'Deleting...' : 'Delete Contact'}
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', color: 'var(--error)', fontSize: 13 }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
                
                {/* ── Left Panel: Contact Information ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24, position: 'sticky', top: 24 }}>
                    <div className="glass-card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                            <Avatar name={contact.name} size={64} />
                            <div style={{ minWidth: 0 }}>
                                <h1 style={{ fontSize: 20, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{contact.name}</h1>
                                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                                    {contact.unsubscribed && (
                                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--error)', background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', borderRadius: 4, padding: '1px 6px' }}>
                                            OPT-OUT
                                        </span>
                                    )}
                                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                                        CRM
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                            {!editing ? (
                                <button onClick={() => setEditing(true)} className="btn btn-outline w-full" style={{ fontSize: 13 }}>Edit Details</button>
                            ) : (
                                <>
                                    <button onClick={() => { setEditing(false); setError(''); }} className="btn btn-outline" style={{ fontSize: 13 }}>Cancel</button>
                                    <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1" style={{ fontSize: 13 }}>
                                        {saving ? 'Saving…' : 'Save Changes'}
                                    </button>
                                </>
                            )}
                        </div>

                        {editing ? (
                            <div style={{ display: 'grid', gap: 14 }}>
                                <EditField label="Full Name" value={name} onChange={setName} />
                                <EditField label="Phone" value={phone} onChange={setPhone} />
                                <EditField label="Email" value={email} onChange={setEmail} type="email" />
                                <EditField label="Tags" value={tagInput} onChange={setTagInput} placeholder="comma-separated" />
                                <div>
                                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 5, display: 'block' }}>Notes</label>
                                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                                        title="Internal notes about this contact."
                                        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 14, resize: 'none' }} />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 gap-5">
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Phone</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{contact.phone || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Email</div>
                                        <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{contact.email || '—'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Tags</div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                            {contact.tags.length > 0
                                                ? contact.tags.map((t) => (
                                                    <span key={t} style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 100, background: 'rgba(249, 115, 22, 0.1)', border: '1px solid rgba(249, 115, 22, 0.25)', color: '#f97316' }}>
                                                        {t}
                                                    </span>
                                                ))
                                                : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tags applied</span>
                                            }
                                        </div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Groups</div>
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                            {groups.length > 0
                                                ? groups.map((g) => (
                                                    <span key={g.id} style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 5,
                                                        fontSize: 12, fontWeight: 600, padding: '3px 8px', borderRadius: 100,
                                                        background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.25)', color: '#818cf8',
                                                    }}>
                                                        {g.name}
                                                        <button onClick={() => handleRemoveFromGroup(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, display: 'flex', opacity: 0.7 }}>
                                                            <Icon icon={faTimes} style={{ fontSize: 10 }} />
                                                        </button>
                                                    </span>
                                                ))
                                                : <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>No groups assigned</span>
                                            }
                                        </div>
                                        <div ref={groupDropdownRef} style={{ position: 'relative' }}>
                                            <button
                                                onClick={() => setShowGroupDropdown((v) => !v)}
                                                disabled={groupLoading}
                                                style={{
                                                    fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 8,
                                                    background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                                                    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                                }}
                                            >
                                                <Icon icon={faUsers} style={{ fontSize: 11 }} /> Add to Group
                                            </button>
                                            {showGroupDropdown && (
                                                <div style={{
                                                    position: 'absolute', top: '100%', left: 0, zIndex: 50, marginTop: 4,
                                                    background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                                                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', minWidth: 220, overflow: 'hidden',
                                                }}>
                                                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                                                        <input
                                                            autoFocus
                                                            placeholder="Search or create group..."
                                                            value={groupSearch}
                                                            onChange={(e) => setGroupSearch(e.target.value)}
                                                            title="Search for an existing group or type to create a new one."
                                                            style={{
                                                                width: '100%', padding: '6px 10px', borderRadius: 7, fontSize: 13,
                                                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                                                color: 'var(--text-primary)',
                                                            }}
                                                        />
                                                    </div>
                                                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                                                        {filteredGroups.map((g) => (
                                                            <button key={g.id} onClick={() => handleAddToGroup(g.id)} style={{
                                                                width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13,
                                                                background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer',
                                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                            }}
                                                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                                            >
                                                                {g.name}
                                                                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g._count.members}</span>
                                                            </button>
                                                        ))}
                                                        {groupSearch.trim() && !filteredGroups.some((g) => g.name.toLowerCase() === groupSearch.trim().toLowerCase()) && (
                                                            <button onClick={() => handleAddToGroup(undefined, groupSearch.trim())} style={{
                                                                width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13,
                                                                background: 'none', border: 'none', color: '#f97316', cursor: 'pointer', fontWeight: 600,
                                                            }}
                                                                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(249,115,22,0.08)')}
                                                                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                                                            >
                                                                + Create &ldquo;{groupSearch.trim()}&rdquo;
                                                            </button>
                                                        )}
                                                        {filteredGroups.length === 0 && !groupSearch.trim() && (
                                                            <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                                                                No groups yet. Type a name to create one.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {contact.notes && (
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Internal Notes</div>
                                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{contact.notes}</div>
                                        </div>
                                    )}
                                </div>

                                <div style={{ paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                                    <button
                                        onClick={toggleUnsubscribed}
                                        style={{
                                            width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                                            background: contact.unsubscribed ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                            border: `1px solid ${contact.unsubscribed ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                                            color: contact.unsubscribed ? '#22c55e' : '#ef4444',
                                        }}
                                    >
                                        {contact.unsubscribed ? 'Re-subscribe to Notifications' : 'Deactivate Notifications'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Right Panel: Tabs for Details ── */}
                <div style={{ minWidth: 0 }}>
                    <div className="glass-card" style={{ minHeight: 600, display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border)' }}>
                            {[
                                { id: 'activity', label: 'Timeline' },
                                { id: 'appointments', label: 'Appointments' },
                                { id: 'messages', label: 'Messages' },
                                { id: 'campaigns', label: 'Campaigns' },
                                { id: 'reminders', label: 'Reminders' },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    style={{
                                        padding: '16px 12px',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: activeTab === tab.id ? '#f97316' : 'var(--text-muted)',
                                        borderBottom: `2px solid ${activeTab === tab.id ? '#f97316' : 'transparent'}`,
                                        marginRight: 16,
                                        transition: 'all 0.2s',
                                        background: 'none',
                                        borderTop: 'none',
                                        borderLeft: 'none',
                                        borderRight: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div style={{ padding: 32, flex: 1 }}>
                            {activeTab === 'activity' && (
                                <div className="space-y-6">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Activity History</h2>
                                        <button className="btn btn-sm btn-outline">+ Manual Log</button>
                                    </div>
                                    <ContactTimeline activities={activities} />
                                </div>
                            )}

                            {activeTab === 'appointments' && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 16 }}><Icon icon={faCalendarPlus} /></div>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No Appointments Found</h3>
                                    <p style={{ fontSize: 14, maxWidth: 300, margin: '0 auto' }}>This contact hasn't scheduled any sessions yet.</p>
                                    <button className="btn btn-primary mt-6">Schedule Session</button>
                                </div>
                            )}

                            {activeTab === 'messages' && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 16 }}><Icon icon={faComment} /></div>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Message History Is Empty</h3>
                                    <p style={{ fontSize: 14, maxWidth: 300, margin: '0 auto' }}>Outbound and inbound messaging logs will appear here.</p>
                                    <button className="btn btn-primary mt-6">Open Composer</button>
                                </div>
                            )}

                            {activeTab === 'campaigns' && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 16 }}><Icon icon={faPlus} /></div>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>No Active Campaigns</h3>
                                    <p style={{ fontSize: 14, maxWidth: 300, margin: '0 auto' }}>Enroll this contact in an automated sequence to see it here.</p>
                                </div>
                            )}

                            {activeTab === 'reminders' && (
                                <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                                    <div style={{ fontSize: 40, marginBottom: 16 }}><Icon icon={faBell} /></div>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Scheduled Reminders</h3>
                                    <p style={{ fontSize: 14, maxWidth: 300, margin: '0 auto' }}>Once an appointment is created, you'll see upcoming automated reminders here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
