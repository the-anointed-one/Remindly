import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { faSearch, faUser, faPhone, faEnvelope } from '@fortawesome/free-solid-svg-icons';

export interface ContactSlim {
    id: string;
    name: string;
    phone?: string | null;
    email?: string | null;
}

interface Props {
    value?: ContactSlim | ContactSlim[] | null; // null if clearing, array if multi
    onChange: (contact: any) => void;
    multi?: boolean;
    placeholder?: string;
    className?: string;
}

export default function ContactSearchDropdown({ value, onChange, multi = false, placeholder = 'Search contacts...', className = '' }: Props) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<ContactSlim[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [open, setOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Click outside to close
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Debounced search
    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            setLoading(false);
            setError(false);
            return;
        }

        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setLoading(true);
            setError(false);
            try {
                const { data } = await api.get(`/contacts`, {
                    params: { search: query, limit: 10 },
                    signal: controller.signal
                });
                setResults(data.data || []);
            } catch (err: any) {
                if (err.name === 'CanceledError' || err.name === 'AbortError') return;
                console.error('Contact search error', err);
                setError(true);
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query]);

    const handleSelect = (contact: ContactSlim) => {
        if (multi) {
            const current = (value as ContactSlim[]) || [];
            if (!current.find((c) => c.id === contact.id)) {
                onChange([...current, contact]);
            }
        } else {
            onChange(contact);
            setOpen(false);
            setQuery('');
        }
    };

    const handleRemove = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (multi) {
            onChange(((value as ContactSlim[]) || []).filter((c) => c.id !== id));
        } else {
            onChange(null);
        }
    };

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {/* Display Multi-select Pills */}
            {multi && Array.isArray(value) && value.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {value.map((c) => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, fontSize: 13 }}>
                            <span>{c.name}</span>
                            <button type="button" onClick={(e) => handleRemove(c.id, e)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none' }}>&times;</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Display Single Select Value OR Input */}
            {!multi && value && !Array.isArray(value) ? (
                <div className="input" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setOpen(true)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: 12 }}>
                            {value.name.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 14, fontWeight: 500 }}>{value.name}</span>
                            {value.phone && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{value.phone}</span>}
                        </div>
                    </div>
                    <button type="button" onClick={(e) => handleRemove(value.id, e)} style={{ color: 'var(--text-muted)', cursor: 'pointer', background: 'none', border: 'none', fontSize: 18 }}>&times;</button>
                </div>
            ) : (
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                        <Icon icon={faSearch} />
                    </div>
                    <input
                        className="input"
                        style={{ paddingLeft: 40 }}
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                        onFocus={() => setOpen(true)}
                        placeholder={placeholder}
                    />
                </div>
            )}

            {/* Dropdown Menu */}
            {open && query.trim() && (
                <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4,
                    background: '#1e1e28', border: '1px solid #2a2a35', borderRadius: 8,
                    maxHeight: 280, overflowY: 'auto', zIndex: 50,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
                }}>
                    {loading ? (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <div className="animate-spin" style={{ width: 14, height: 14, border: '2px solid var(--brand-primary)', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
                            Searching...
                        </div>
                    ) : error ? (
                        <div style={{ padding: 16, textAlign: 'center', color: '#ef4444', fontSize: 13 }}>
                            Search unavailable
                        </div>
                    ) : results.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No contacts found
                        </div>
                    ) : (
                        results.map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelect(c)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    width: '100%', padding: '12px 16px', background: 'none', border: 'none',
                                    borderBottom: '1px solid #2a2a35', cursor: 'pointer', textAlign: 'left',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Icon icon={faUser} className="text-muted" />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{c.name}</span>
                                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {c.phone && <span style={{ display: 'flex', alignItems: 'center' }}><span style={{ width: 10, marginRight: 4, display: 'inline-block' }}><Icon icon={faPhone} /></span> {c.phone}</span>}
                                        {c.email && <span style={{ display: 'flex', alignItems: 'center' }}><span style={{ width: 10, marginRight: 4, display: 'inline-block' }}><Icon icon={faEnvelope} /></span> {c.email}</span>}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
