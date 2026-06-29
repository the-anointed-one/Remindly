'use client';

import { useEffect, useState, useRef, useCallback } from 'react';

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

import Link from 'next/link';
import api from '@/lib/api';
import FeatureBanner from '@/components/FeatureBanner';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/EmptyState';
import {
    faUsers, faUserPlus, faFileImport, faSearch, faFilter, faHistory,
    faChevronRight, faChevronLeft, faEllipsisV, faPhone, faEnvelope, faMapMarkerAlt, faClock, faTag, faPlus, faFolderOpen
} from '@fortawesome/free-solid-svg-icons';
import { HelpTip } from '@/components/ui/Tooltip';
import TooltipField from '@/components/ui/TooltipField';

// ── Types ────────────────────────────────────

interface Contact {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    tags: string[];
    unsubscribed: boolean;
    lastAppointment: string | null;
    createdAt: string;
}

interface ContactStats {
    total: number;
    active: number;
    unsubscribed: number;
    withPhone: number;
    withEmail: number;
}

interface TagItem {
    id: string;
    name: string;
    tenantId?: string;
    createdAt?: string;
    _count?: { contactTags?: number };
}

interface PageResult {
    data: Contact[];
    total: number;
    page: number;
    totalPages: number;
}

// ── Helpers ──────────────────────────────────

function TagPill({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
    return (
        <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
            background: 'rgba(0, 169, 157, 0.12)', border: '1px solid rgba(0, 169, 157, 0.25)',
            color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
            {tag}
            {onRemove && (
                <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>
            )}
        </span>
    );
}

function Avatar({ name }: { name: string }) {
    const initials = name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
    const hue = name.charCodeAt(0) * 37 % 360;
    return (
        <div style={{
            width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
            background: `hsl(${hue},55%,22%)`, border: `1px solid hsl(${hue},55%,35%)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: `hsl(${hue},70%,70%)`,
        }}>
            {initials || '?'}
        </div>
    );
}

// ── Add Contact Modal ─────────────────────────

function AddContactModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setError('');
        try {
            const tags = tagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
            await api.post('/contacts', { name: name.trim(), phone: phone || undefined, email: email || undefined, tags, notes: notes || undefined });
            onCreated();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create contact');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 480, padding: '32px', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
                <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 24 }}>New Contact</h2>
                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', color: 'var(--error)', fontSize: 13 }}>{error}</div>
                )}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <TooltipField label="Name *" tooltip="The full name of the contact.">
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16 }} />
                    </TooltipField>
                    <div className="grid-2">
                        <TooltipField label="Phone" tooltip="Phone number with country code for SMS and WhatsApp.">
                            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890"
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16 }} />
                        </TooltipField>
                        <TooltipField label="Email" tooltip="Email address for email reminders.">
                            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" type="email"
                                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16 }} />
                        </TooltipField>
                    </div>
                    <TooltipField label="Tags (comma-separated)" tooltip="Used to group contacts for campaigns and audiences.">
                        <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="vip, returning, dental"
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16 }} />
                    </TooltipField>
                    <div>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Notes</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Any notes..."
                            title="Additional details about this contact."
                            style={{ width: '100%', padding: '9px 12px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16, resize: 'vertical' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
                        <button type="button" onClick={onClose} className="btn btn-outline" style={{ fontSize: 14 }}>Cancel</button>
                        <button type="submit" disabled={saving} className="btn btn-primary" style={{ fontSize: 14 }}>
                            {saving ? 'Saving...' : 'Create Contact'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ── Import Modal ──────────────────────────────

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<{ inserted: number; skipped: number; errors: string[] } | null>(null);
    const [error, setError] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async () => {
        if (!file) return;
        setUploading(true);
        setError('');
        setResult(null);
        try {
            const form = new FormData();
            form.append('file', file);
            const { data } = await api.post('/contacts/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            setResult(data);
            onImported();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Import failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: 480, padding: '32px', position: 'relative' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
                <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Import Contacts</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
                    Upload a CSV or Excel file. Required column: <code>name</code>. Optional: <code>phone</code>, <code>email</code>, <code>tags</code>, <code>notes</code>.
                </p>

                {error && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', color: 'var(--error)', fontSize: 13 }}>{error}</div>
                )}

                {result ? (
                    <div style={{ marginBottom: 20, padding: '16px', borderRadius: 10, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
                        <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 8 }}>Import complete</div>
                        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{result.inserted} contacts imported · {result.skipped} skipped</div>
                        {result.errors.length > 0 && (
                            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                                {result.errors.slice(0, 5).map((e, i) => <div key={i}>{e}</div>)}
                                {result.errors.length > 5 && <div>…and {result.errors.length - 5} more</div>}
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <div
                            onClick={() => inputRef.current?.click()}
                            style={{
                                border: '2px dashed var(--border)', borderRadius: 10, padding: '32px',
                                textAlign: 'center', cursor: 'pointer', marginBottom: 16,
                                background: file ? 'rgba(59,130,246,0.05)' : 'var(--bg-secondary)',
                                transition: 'border-color 200ms',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                            <div style={{ fontSize: 28, marginBottom: 8, color: 'var(--text-muted)' }}><Icon icon={faFolderOpen} /></div>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{file ? file.name : 'Click to select file'}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>CSV, XLSX, or XLS · Max 10 MB · Up to 5,000 rows</div>
                        </div>
                        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    </>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} className="btn btn-outline" style={{ fontSize: 14 }}>
                        {result ? 'Close' : 'Cancel'}
                    </button>
                    {!result && (
                        <button onClick={handleUpload} disabled={!file || uploading} className="btn btn-primary" style={{ fontSize: 14 }}>
                            {uploading ? 'Importing...' : 'Import'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Groups Tab ────────────────────────────────────────────────────────────

function GroupsTab() {
    const [groups, setGroups] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/contacts/groups').then(res => setGroups(res.data.data || res.data || [])).finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading groups...</div>;
    return (
        <div className="glass-card" style={{ padding: '16px', overflowX: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Groups</h3>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '8px 12px' }}>Name</th>
                        <th style={{ padding: '8px 12px' }}>Members</th>
                        <th style={{ padding: '8px 12px' }}>Created</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.map(g => (
                        <tr key={g.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <td style={{ padding: '12px', fontWeight: 600 }}>{g.name}</td>
                            <td style={{ padding: '12px' }}>{g._count?.members || 0}</td>
                            <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{new Date(g.createdAt).toLocaleDateString()}</td>
                        </tr>
                    ))}
                    {groups.length === 0 && <tr><td colSpan={3} style={{ padding: 20, textAlign: 'center' }}>No groups found</td></tr>}
                </tbody>
            </table>
        </div>
    );
}

// ── Tags Tab ──────────────────────────────────────────────────────────────

function TagsTab() {
    const [tags, setTags] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/contacts/tags').then(res => setTags(res.data.data || res.data || [])).finally(() => setLoading(false));
    }, []);

    if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading tags...</div>;
    return (
        <div className="glass-card" style={{ padding: '16px', overflowX: 'auto' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Tags</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {tags.map(t => (
                    <div key={t.id} style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(0,169,157,0.1)', border: '1px solid rgba(0,169,157,0.3)', color: 'var(--primary)', fontWeight: 600 }}>
                        {t.name} <span style={{ opacity: 0.6, fontSize: 12, marginLeft: 6 }}>{t._count?.contactTags || 0} contacts</span>
                    </div>
                ))}
            </div>
            {tags.length === 0 && <div style={{ padding: 20, textAlign: 'center' }}>No tags found</div>}
        </div>
    );
}

// ── Activity Side Panel ───────────────────────────────────────────────────

function ActivitySidePanel({ contactId, onClose }: { contactId: string, onClose: () => void }) {
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/contacts/${contactId}/activity`).then(res => setActivities(res.data.data || res.data || [])).finally(() => setLoading(false));
    }, [contactId]);

    return (
        <div style={{
            position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '90vw',
            background: 'var(--bg-card)', borderLeft: '1px solid var(--border)', zIndex: 2000,
            boxShadow: '-8px 0 24px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: 20, borderBottom: '1px solid var(--border)' }}>
                <h3 style={{ fontSize: 18, fontWeight: 700 }}>Activity Timeline</h3>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {loading ? <div style={{ textAlign: 'center' }}>Loading...</div> : activities.length === 0 ? <div style={{ textAlign: 'center' }}>No recent activity</div> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {activities.map((act) => (
                            <div key={act.id} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{new Date(act.createdAt).toLocaleString()}</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{act.type}</div>
                                {act.details && <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{JSON.stringify(act.details)}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────

export default function ContactsPage() {
    const [result, setResult] = useState<PageResult | null>(null);
    const [stats, setStats] = useState<ContactStats | null>(null);
    const [allTags, setAllTags] = useState<TagItem[]>([]);
    const [loading, setLoading] = useState(true);
    const isMobile = useIsMobile();
    const [search, setSearch] = useState('');
    const [tagFilter, setTagFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [bulkTagInput, setBulkTagInput] = useState('');
    const [bulkTagging, setBulkTagging] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [activeTab, setActiveTab] = useState<'contacts' | 'groups' | 'tags'>('contacts');
    const [sidebarContactId, setSidebarContactId] = useState<string | null>(null);
    const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const load = useCallback(async (s = search, t = tagFilter, p = page) => {
        setLoading(true);
        try {
            const params: Record<string, any> = { page: p, limit: 20 };
            if (s) params.search = s;
            if (t) params.tag = t;
            const [listRes, statsRes, tagsRes] = await Promise.all([
                api.get('/contacts', { params }),
                api.get('/contacts/stats'),
                api.get('/contacts/tags'),
            ]);
            setResult(listRes.data);
            setStats(statsRes.data);
            // tags API returns objects — normalise here so the rest of the page stays simple
            const rawTags = tagsRes.data?.data || tagsRes.data || [];
            setAllTags(Array.isArray(rawTags) ? rawTags.map((t: any) => typeof t === 'string' ? { id: t, name: t } : t) : []);
        } catch { /* ignore */ }
        setLoading(false);
    }, [search, tagFilter, page]);

    useEffect(() => { load(); }, []);

    const handleSearch = (val: string) => {
        setSearch(val);
        setPage(1);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => load(val, tagFilter, 1), 350);
    };

    const handleTagFilter = (tag: string) => {
        const next = tag === tagFilter ? '' : tag;
        setTagFilter(next);
        setPage(1);
        load(search, next, 1);
    };

    const handlePage = (p: number) => {
        setPage(p);
        load(search, tagFilter, p);
    };

    const toggleSelect = (id: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        if (!result) return;
        if (selected.size === result.data.length) {
            setSelected(new Set());
        } else {
            setSelected(new Set(result.data.map((c) => c.id)));
        }
    };

    const handleBulkTag = async () => {
        if (!bulkTagInput.trim() || selected.size === 0) return;
        setBulkTagging(true);
        const tags = bulkTagInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
        await api.post('/contacts/bulk/tag', { contactIds: Array.from(selected), tags });
        setBulkTagging(false);
        setBulkTagInput('');
        setSelected(new Set());
        load();
    };

    const handleBulkDelete = async () => {
        if (selected.size === 0) return;
        if (!confirm(`Delete ${selected.size} contact${selected.size !== 1 ? 's' : ''}?`)) return;
        setBulkDeleting(true);
        await api.post('/contacts/bulk/delete', { contactIds: Array.from(selected) });
        setBulkDeleting(false);
        setSelected(new Set());
        load();
    };

    const contacts = result?.data ?? [];

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Contacts
                        <HelpTip
                            text="Contacts are the people who will receive reminders. Add clients, patients, or customers here. Tag them to group by campaign or demographic."
                            placement="bottom"
                            maxWidth={280}
                        />
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        {stats ? `${stats.total.toLocaleString()} contacts · ${stats.active} active` : 'Your client database'}
                    </p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => setShowImport(true)} className="btn btn-outline flex-1 md:flex-none">
                        Import CSV/Excel
                    </button>
                    <button onClick={() => setShowAdd(true)} className="btn btn-primary flex-1 md:flex-none">
                        + New Contact
                    </button>
                </div>
            </div>

            <FeatureBanner
                src="/images/features/contact-management.jpg"
                title="Contact Management"
                description="Maintain a searchable client database with tags, opt-out tracking, and appointment history. Import from CSV, bulk-tag, and segment your audience."
                accent="var(--success)"
            />

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', marginBottom: 24, marginTop: 16 }}>
                {[
                    { id: 'contacts', label: 'All Contacts' },
                    { id: 'groups', label: 'Groups' },
                    { id: 'tags', label: 'Tags' },
                ].map(t => (
                    <button 
                        key={t.id} 
                        onClick={() => setActiveTab(t.id as any)}
                        style={{
                            padding: '10px 4px', background: 'none', border: 'none',
                            borderBottom: activeTab === t.id ? '2px solid var(--primary)' : '2px solid transparent',
                            color: activeTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                            fontWeight: activeTab === t.id ? 700 : 600,
                            cursor: 'pointer', fontSize: 14, marginBottom: -1
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {activeTab === 'groups' && <GroupsTab />}
            {activeTab === 'tags' && <TagsTab />}

            {activeTab === 'contacts' && (
                <>
                    {/* Stat cards */}
    {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            {[
                { label: 'Total', value: stats.total, color: 'var(--primary)' },
                { label: 'Active', value: stats.active, color: 'var(--success)' },
                { label: 'With Phone', value: stats.withPhone, color: '#06b6d4' },
                { label: 'With Email', value: stats.withEmail, color: '#8b5cf6' },
                { label: 'Unsubscribed', value: stats.unsubscribed, color: 'var(--error)' },
            ].map((s) => (
                <div key={s.label} className="card" style={{ padding: '16px 18px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{(s.value ?? 0).toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                </div>
            ))}
        </div>
    )}

            {/* Filters row */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                    value={search}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Search by name, email, or phone…"
                    title="Filter your contact list by name, phone, or email."
                    style={{
                        flex: 1, minWidth: 200, padding: '9px 14px', borderRadius: 8,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                        color: 'var(--text-primary)', fontSize: 16,
                    }}
                />
                {allTags.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {allTags.slice(0, 8).map((tag) => (
                            <button
                                key={tag.id}
                                onClick={() => handleTagFilter(tag.name)}
                                style={{
                                    padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    background: tagFilter === tag.name ? 'rgba(0, 169, 157, 0.2)' : 'rgba(0, 169, 157, 0.06)',
                                    border: `1px solid ${tagFilter === tag.name ? 'rgba(0, 169, 157, 0.5)' : 'rgba(0, 169, 157, 0.2)'}`,
                                    color: 'var(--primary)',
                                }}
                            >
                                {tag.name}
                            </button>
                        ))}
                        {tagFilter && (
                            <button onClick={() => handleTagFilter('')} style={{ padding: '5px 10px', borderRadius: 100, fontSize: 12, cursor: 'pointer', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                                Clear ×
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Bulk action bar */}
            {selected.size > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                    borderRadius: 10, background: 'rgba(0, 169, 157, 0.08)', border: '1px solid rgba(0, 169, 157, 0.25)',
                    marginBottom: 12, flexWrap: 'wrap',
                }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary)' }}>
                        {selected.size} selected
                    </span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
                        <input
                            value={bulkTagInput}
                            onChange={(e) => setBulkTagInput(e.target.value)}
                            placeholder="Add tags (comma-separated)…"
                            style={{ padding: '6px 10px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 16, flex: 1, minWidth: 0 }}
                        />
                        <button onClick={handleBulkTag} disabled={bulkTagging || !bulkTagInput.trim()} style={{ padding: '6px 12px', borderRadius: 7, background: 'rgba(0, 169, 157, 0.15)', border: '1px solid rgba(0, 169, 157, 0.3)', color: 'var(--primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                            {bulkTagging ? '...' : 'Tag'}
                        </button>
                    </div>
                    <button onClick={handleBulkDelete} disabled={bulkDeleting} style={{ padding: '6px 12px', borderRadius: 7, background: 'none', border: '1px solid rgba(224, 82, 82, 0.35)', color: 'var(--error)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                        {bulkDeleting ? '...' : 'Delete'}
                    </button>
                    <button onClick={() => setSelected(new Set())} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>
                        Deselect all
                    </button>
                </div>
            )}

            {/* Contact table */}
            <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
                {/* Table header */}
                {!isMobile && (
                    <div style={{
                        display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 140px 80px',
                        minWidth: 560,
                        padding: '10px 20px', borderBottom: '1px solid var(--border)',
                        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                    }}>
                        <div>
                            <input type="checkbox" checked={contacts.length > 0 && selected.size === contacts.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                        </div>
                        <div>Name</div>
                        <div>Contact</div>
                        <div>Tags</div>
                        <div>Last Appointment</div>
                        <div></div>
                    </div>
                )}

                {/* Mobile header (Select All) */}
                {isMobile && contacts.length > 0 && (
                    <div style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '12px 16px', borderBottom: '1px solid var(--border)',
                        background: 'rgba(255,255,255,0.02)'
                    }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {contacts.length} Contact{contacts.length !== 1 ? 's' : ''} on this page
                        </span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <input type="checkbox" checked={selected.size === contacts.length} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                            Select All
                        </label>
                    </div>
                )}

                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : contacts.length === 0 ? (
                    <EmptyState
                        title="No contacts yet"
                        description={search || tagFilter ? 'No contacts match your filters.' : 'Add your first contact or import from CSV/Excel.'}
                        icon={faUsers}
                        ctaLabel={!search && !tagFilter ? 'Add Contact' : undefined}
                        ctaAction={() => setShowAdd(true)}
                        ctaLabel2={!search && !tagFilter ? 'Import File' : undefined}
                        ctaAction2={() => setShowImport(true)}
                    />
                ) : (
                    <>
                        {!isMobile ? (
                            contacts.map((contact, i) => (
                                <div
                                    key={contact.id}
                                    style={{
                                        display: 'grid', gridTemplateColumns: '40px 1fr 1fr 1fr 140px 80px',
                                        minWidth: 560,
                                        padding: '12px 20px', alignItems: 'center',
                                        borderBottom: i < contacts.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        background: selected.has(contact.id) ? 'rgba(59,130,246,0.05)' : 'transparent',
                                        transition: 'background 150ms',
                                    }}
                                    onMouseEnter={(e) => { if (!selected.has(contact.id)) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                    onMouseLeave={(e) => { e.currentTarget.style.background = selected.has(contact.id) ? 'rgba(59,130,246,0.05)' : 'transparent'; }}
                                >
                                    <div>
                                        <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggleSelect(contact.id)} style={{ cursor: 'pointer' }} />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                                        <Avatar name={contact.name} />
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {contact.name}
                                                {contact.unsubscribed && (
                                                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 4, padding: '1px 5px' }}>OPT-OUT</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        {contact.phone && <div>{contact.phone}</div>}
                                        {contact.email && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{contact.email}</div>}
                                    </div>
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                        {contact.tags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
                                        {contact.tags.length > 3 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{contact.tags.length - 3}</span>}
                                    </div>
                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                        {contact.lastAppointment
                                            ? new Date(contact.lastAppointment).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                            : '—'}
                                    </div>
                                    <div style={{ cursor: 'pointer' }} onClick={() => setSidebarContactId(contact.id)}>
                                        <span style={{ fontSize: 13, color: 'var(--text-accent)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                            View Activity →
                                        </span>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>
                                {contacts.map((contact) => (
                                    <div key={contact.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggleSelect(contact.id)} style={{ cursor: 'pointer' }} />
                                                <Avatar name={contact.name} />
                                                <div style={{ fontWeight: 700, fontSize: 15 }}>
                                                    {contact.name}
                                                    {contact.unsubscribed && (
                                                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: 'var(--error)', background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', borderRadius: 4, padding: '1px 5px' }}>OPT-OUT</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {contact.phone && <div>{contact.phone}</div>}
                                            {contact.email && <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{contact.email}</div>}
                                        </div>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {contact.tags.slice(0, 3).map((t) => <TagPill key={t} tag={t} />)}
                                            {contact.tags.length > 3 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>+{contact.tags.length - 3}</span>}
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                                            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                                Last seen: {contact.lastAppointment
                                                    ? new Date(contact.lastAppointment).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                                    : '—'}
                                            </div>
                                            <button
                                                onClick={() => setSidebarContactId(contact.id)}
                                                className="btn btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
                                            >
                                                View Activity →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Pagination */}
            {result && result.totalPages > 1 && (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 20 }}>
                    {Array.from({ length: result.totalPages }, (_, i) => i + 1).map((p) => (
                        <button
                            key={p}
                            onClick={() => handlePage(p)}
                            style={{
                                width: 34, height: 34, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                background: p === page ? 'var(--accent)' : 'var(--bg-secondary)',
                                border: `1px solid ${p === page ? 'var(--accent)' : 'var(--border)'}`,
                                color: p === page ? '#fff' : 'var(--text-secondary)',
                            }}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            )}

            {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onCreated={() => load()} />}
            {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => load()} />}
            {sidebarContactId && <ActivitySidePanel contactId={sidebarContactId} onClose={() => setSidebarContactId(null)} />}
                </>
            )}
        </div>
    );
}
