'use client';

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import {
    faArrowLeft, faReply, faFilter, faXmark,
    faTag, faUsers, faCheck, faTimes, faClock, faSearch,
} from '@fortawesome/free-solid-svg-icons';

// ── Types ──────────────────────────────────────────────────────────────────────

type ResponseStatus = 'confirmed' | 'cancelled' | 'pending';

interface TagRef  { id: string; name: string; }
interface GroupRef { id: string; name: string; }

interface DashboardRow {
    id: string;
    responseStatus: ResponseStatus;
    responseText: string;
    timestamp: string;
    contact: {
        id: string;
        name: string;
        phone: string | null;
        email: string | null;
        tags: TagRef[];
        groups: GroupRef[];
    } | null;
}

interface Campaign {
    id: string;
    name: string;
    segments: { id: string; name: string; tag: TagRef | null }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<ResponseStatus, { label: string; color: string; bg: string; icon: any }> = {
    confirmed: { label: 'Confirmed', color: '#22c55e', bg: 'rgba(34,197,94,0.12)', icon: faCheck },
    cancelled:  { label: 'Cancelled', color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  icon: faTimes },
    pending:    { label: 'Pending',   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', icon: faClock },
};

function StatusBadge({ status }: { status: ResponseStatus }) {
    const m = STATUS_META[status];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 100,
            background: m.bg, border: `1px solid ${m.color}40`, color: m.color,
        }}>
            <Icon icon={m.icon} style={{ fontSize: 9 }} />
            {m.label}
        </span>
    );
}

function Pill({ label, onRemove, color }: { label: string; onRemove?: () => void; color?: string }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 100,
            background: color ? `${color}18` : 'rgba(255,255,255,0.08)',
            border: `1px solid ${color ? color + '35' : 'var(--border)'}`,
            color: color ?? 'var(--text-secondary)',
            whiteSpace: 'nowrap',
        }}>
            {label}
            {onRemove && (
                <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'inherit', opacity: 0.6, lineHeight: 1 }}>
                    <Icon icon={faXmark} style={{ fontSize: 9 }} />
                </button>
            )}
        </span>
    );
}

const inputStyle: React.CSSProperties = {
    padding: '8px 12px', borderRadius: 8,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', minWidth: 140 };

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ResponseDashboardPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: campaignId } = use(params);

    const [campaign, setCampaign]     = useState<Campaign | null>(null);
    const [rows, setRows]             = useState<DashboardRow[]>([]);
    const [allTags, setAllTags]       = useState<TagRef[]>([]);
    const [allGroups, setAllGroups]   = useState<GroupRef[]>([]);
    const [loading, setLoading]       = useState(true);

    // Filters
    const [statusFilter, setStatusFilter]   = useState<ResponseStatus | ''>('');
    const [tagFilter, setTagFilter]         = useState('');
    const [groupFilter, setGroupFilter]     = useState('');
    const [segmentFilter, setSegmentFilter] = useState('');
    const [search, setSearch]               = useState('');

    // Load static data once
    useEffect(() => {
        Promise.all([
            api.get(`/campaigns/${campaignId}`),
            api.get('/contacts/tags'),
            api.get('/contacts/groups'),
        ]).then(([camp, tags, groups]) => {
            setCampaign(camp.data);
            setAllTags(Array.isArray(tags.data) ? tags.data : []);
            setAllGroups(Array.isArray(groups.data) ? groups.data : []);
        }).catch(() => {});
    }, [campaignId]);

    // Fetch responses whenever any filter changes
    const loadRows = useCallback(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (statusFilter)  params.set('status',    statusFilter);
        if (tagFilter)     params.set('tagId',     tagFilter);
        if (groupFilter)   params.set('groupId',   groupFilter);
        if (segmentFilter) params.set('segmentId', segmentFilter);

        api.get(`/campaigns/${campaignId}/responses/dashboard?${params}`)
            .then(({ data }) => setRows(Array.isArray(data) ? data : []))
            .catch(() => setRows([]))
            .finally(() => setLoading(false));
    }, [campaignId, statusFilter, tagFilter, groupFilter, segmentFilter]);

    useEffect(() => { loadRows(); }, [loadRows]);

    // Client-side name/phone/email search on top of server-filtered results
    const visible = rows.filter(r => {
        if (!search.trim()) return true;
        const q = search.toLowerCase();
        const c = r.contact;
        return (
            c?.name.toLowerCase().includes(q) ||
            c?.phone?.toLowerCase().includes(q) ||
            c?.email?.toLowerCase().includes(q) ||
            r.responseText.toLowerCase().includes(q)
        );
    });

    const activeFilterCount = [statusFilter, tagFilter, groupFilter, segmentFilter].filter(Boolean).length;

    const clearAllFilters = () => {
        setStatusFilter('');
        setTagFilter('');
        setGroupFilter('');
        setSegmentFilter('');
        setSearch('');
    };

    return (
        <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
                <Link href="/dashboard/campaigns" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: 36, height: 36, borderRadius: 9,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', textDecoration: 'none', flexShrink: 0, marginTop: 2,
                }}>
                    <Icon icon={faArrowLeft} />
                </Link>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <Icon icon={faReply} style={{ color: 'var(--primary)', fontSize: 18 }} />
                        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
                            Response Dashboard
                        </h1>
                        {campaign && (
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
                                — {campaign.name}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
                        Track every contact&apos;s response status across this campaign.
                    </p>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', flexShrink: 0, marginTop: 6 }}>
                    {!loading && <strong style={{ color: 'var(--text-primary)' }}>{visible.length}</strong>} {!loading ? 'results' : ''}
                </div>
            </div>

            {/* Filter bar */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 20px', marginBottom: 20,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Icon icon={faFilter} style={{ color: 'var(--text-muted)', fontSize: 13 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Filters
                    </span>
                    {activeFilterCount > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 100, background: 'rgba(0,169,157,0.15)', border: '1px solid rgba(0,169,157,0.3)', color: 'var(--primary)' }}>
                            {activeFilterCount} active
                        </span>
                    )}
                    {activeFilterCount > 0 && (
                        <button onClick={clearAllFilters} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, marginLeft: 'auto' }}>
                            Clear all
                        </button>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Search */}
                    <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 280 }}>
                        <Icon icon={faSearch} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: 12, pointerEvents: 'none' }} />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search name, phone, email…"
                            style={{ ...inputStyle, width: '100%', paddingLeft: 30, boxSizing: 'border-box' }}
                        />
                    </div>

                    {/* Status filter */}
                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={selectStyle}>
                        <option value="">All statuses</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="pending">Pending</option>
                    </select>

                    {/* Tag filter */}
                    <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={selectStyle}>
                        <option value="">All tags</option>
                        {allTags.map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                    </select>

                    {/* Group filter */}
                    <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={selectStyle}>
                        <option value="">All groups</option>
                        {allGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>

                    {/* Segment filter (from campaign segments) */}
                    {campaign && campaign.segments.length > 0 && (
                        <select value={segmentFilter} onChange={e => setSegmentFilter(e.target.value)} style={selectStyle}>
                            <option value="">All segments</option>
                            {campaign.segments.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Active filter chips */}
                {activeFilterCount > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                        {statusFilter && (
                            <Pill
                                label={`Status: ${STATUS_META[statusFilter].label}`}
                                color={STATUS_META[statusFilter].color}
                                onRemove={() => setStatusFilter('')}
                            />
                        )}
                        {tagFilter && (
                            <Pill
                                label={`Tag: ${allTags.find(t => t.id === tagFilter)?.name ?? tagFilter}`}
                                color="var(--primary)"
                                onRemove={() => setTagFilter('')}
                            />
                        )}
                        {groupFilter && (
                            <Pill
                                label={`Group: ${allGroups.find(g => g.id === groupFilter)?.name ?? groupFilter}`}
                                color="#6366f1"
                                onRemove={() => setGroupFilter('')}
                            />
                        )}
                        {segmentFilter && campaign && (
                            <Pill
                                label={`Segment: ${campaign.segments.find(s => s.id === segmentFilter)?.name ?? segmentFilter}`}
                                color="#f97316"
                                onRemove={() => setSegmentFilter('')}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Status summary pills */}
            {!loading && rows.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {(['confirmed', 'cancelled', 'pending'] as ResponseStatus[]).map(s => {
                        const count = rows.filter(r => r.responseStatus === s).length;
                        if (count === 0) return null;
                        const m = STATUS_META[s];
                        return (
                            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? '' : s)} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '6px 14px', borderRadius: 100, cursor: 'pointer',
                                background: statusFilter === s ? m.bg : 'var(--bg-secondary)',
                                border: `1px solid ${statusFilter === s ? m.color + '60' : 'var(--border)'}`,
                                color: statusFilter === s ? m.color : 'var(--text-muted)',
                                fontSize: 12, fontWeight: 700, transition: 'all 0.15s',
                            }}>
                                <Icon icon={m.icon} style={{ fontSize: 10 }} />
                                {m.label}: {count}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Response table */}
            <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, overflow: 'hidden',
            }}>
                {loading ? (
                    <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                        Loading responses…
                    </div>
                ) : visible.length === 0 ? (
                    <div style={{ padding: '60px 32px', textAlign: 'center' }}>
                        <Icon icon={faReply} style={{ fontSize: 36, color: 'var(--text-muted)', opacity: 0.3, marginBottom: 12, display: 'block' }} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
                            {activeFilterCount > 0 || search ? 'No responses match these filters' : 'No responses yet'}
                        </div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            {activeFilterCount > 0 || search
                                ? 'Try adjusting or clearing your filters.'
                                : 'Dispatch this campaign to start collecting responses.'}
                        </div>
                        {(activeFilterCount > 0 || search) && (
                            <button onClick={clearAllFilters} style={{
                                marginTop: 16, padding: '8px 20px', borderRadius: 8,
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
                            }}>
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    {['Name', 'Phone', 'Email', 'Group', 'Tag', 'Status', 'Last Response'].map(h => (
                                        <th key={h} style={{
                                            padding: '12px 16px', textAlign: 'left',
                                            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                                            textTransform: 'uppercase', letterSpacing: '0.05em',
                                            background: 'var(--bg-secondary)',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((row, idx) => (
                                    <tr key={row.id} style={{
                                        borderBottom: idx < visible.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        transition: 'background 0.1s',
                                    }}
                                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                    >
                                        {/* Name */}
                                        <td style={{ padding: '12px 16px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {row.contact ? (
                                                <Link href={`/dashboard/contacts/${row.contact.id}`} style={{ color: 'var(--text-primary)', textDecoration: 'none' }}
                                                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
                                                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-primary)')}>
                                                    {row.contact.name}
                                                </Link>
                                            ) : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unknown</span>}
                                        </td>

                                        {/* Phone */}
                                        <td style={{ padding: '12px 16px', color: row.contact?.phone ? 'var(--text-secondary)' : 'var(--text-muted)', fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>
                                            {row.contact?.phone ?? '—'}
                                        </td>

                                        {/* Email */}
                                        <td style={{ padding: '12px 16px', color: row.contact?.email ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 12, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {row.contact?.email ?? '—'}
                                        </td>

                                        {/* Group */}
                                        <td style={{ padding: '12px 16px' }}>
                                            {row.contact?.groups && row.contact.groups.length > 0 ? (
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {row.contact.groups.map(g => (
                                                        <Pill key={g.id} label={g.name} color="#6366f1" />
                                                    ))}
                                                </div>
                                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>

                                        {/* Tag */}
                                        <td style={{ padding: '12px 16px' }}>
                                            {row.contact?.tags && row.contact.tags.length > 0 ? (
                                                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                                    {row.contact.tags.map(t => (
                                                        <Pill key={t.id} label={t.name} color="var(--primary)" />
                                                    ))}
                                                </div>
                                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                        </td>

                                        {/* Status */}
                                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                                            <StatusBadge status={row.responseStatus} />
                                        </td>

                                        {/* Last Response */}
                                        <td style={{ padding: '12px 16px' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 }}>
                                                {row.responseText}
                                            </div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {new Date(row.timestamp).toLocaleString()}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
