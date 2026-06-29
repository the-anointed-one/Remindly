'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/EmptyState';
import { faTag, faUsers, faSearch } from '@fortawesome/free-solid-svg-icons';

interface TagWithCount {
    name: string;
    count: number;
}

export default function TagsPage() {
    const [tags, setTags] = useState<TagWithCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const load = useCallback(async () => {
        try {
            const { data } = await api.get('/contacts/tags');
            // Backend returns object[], normalize to string[] for existing logic
            const rawTags = data?.data || data || [];
            const tagNames: string[] = Array.isArray(rawTags) ? rawTags.map((t: any) => typeof t === 'string' ? t : t.name) : [];

            // Fetch counts per tag
            const counted = await Promise.all(
                tagNames.map(async (name) => {
                    try {
                        const res = await api.get('/contacts', { params: { tag: name, limit: 1 } });
                        return { name, count: res.data?.total ?? 0 };
                    } catch {
                        return { name, count: 0 };
                    }
                })
            );
            setTags(counted.sort((a, b) => b.count - a.count));
        } catch {
            setTags([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = tags.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Tags</h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        Tags are added on contacts. Click any tag to view its contacts.
                    </p>
                </div>
                <Link href="/dashboard/contacts" className="btn btn-primary">
                    + Manage Contacts
                </Link>
            </div>

            {/* Search */}
            <div style={{ position: 'relative', maxWidth: 380, marginBottom: 24 }}>
                <Icon icon={faSearch} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--text-muted)', fontSize: 13, pointerEvents: 'none',
                }} />
                <input
                    className="input"
                    style={{ paddingLeft: 36 }}
                    placeholder="Search tags…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Tags Grid */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="card" style={{ height: 80, animation: 'pulse 1.5s infinite', borderRadius: 12 }} />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <EmptyState
                    title={search ? 'No tags match your search' : 'No tags yet'}
                    description="Tags are created when you add them to contacts. Go to Contacts to get started."
                    icon={faTag}
                    ctaLabel="Go to Contacts"
                    ctaHref="/dashboard/contacts"
                />
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                    {filtered.map(tag => (
                        <Link
                            key={tag.name}
                            href={`/dashboard/contacts?tag=${encodeURIComponent(tag.name)}`}
                            style={{ textDecoration: 'none' }}
                        >
                            <div className="card" style={{
                                padding: '18px 20px', borderRadius: 14,
                                display: 'flex', alignItems: 'center', gap: 14,
                                transition: 'all 0.15s ease', cursor: 'pointer',
                            }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = '')}
                            >
                                <div style={{
                                    width: 36, height: 36, borderRadius: 8,
                                    background: 'rgba(0, 169, 157, 0.1)', color: 'var(--primary)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <Icon icon={faTag} style={{ fontSize: 14 }} />
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-primary)' }}>
                                        {tag.name}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <Icon icon={faUsers} style={{ fontSize: 10 }} />
                                        {tag.count} contact{tag.count !== 1 ? 's' : ''}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
