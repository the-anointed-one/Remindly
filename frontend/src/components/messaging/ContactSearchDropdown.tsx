import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { faSearch, faUser, faPhone, faEnvelope, faPlus } from '@fortawesome/free-solid-svg-icons';

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

    // Inline "create new contact" — rendered only in the zero-results state,
    // so a brand-new tenant with no contacts can still create their first one.
    const [creating, setCreating] = useState(false);
    const [createName, setCreateName] = useState('');
    const [createPhone, setCreatePhone] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [createError, setCreateError] = useState('');
    const [createSubmitting, setCreateSubmitting] = useState(false);

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
            setCreating(false);
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
        setCreating(false);
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

    // Heuristic: does the typed query look like a phone number? (digits, optional
    // +, spaces, dashes, parens — roughly 7–15 digits). Used to prefill the right
    // field so the user only fills in what's missing.
    const looksLikePhone = (s: string) => {
        const digits = s.replace(/[^\d]/g, '');
        return /^[+]?[\d\s\-()]+$/.test(s.trim()) && digits.length >= 7 && digits.length <= 15;
    };

    const openCreateForm = (q: string) => {
        const trimmed = q.trim();
        const isPhone = looksLikePhone(trimmed);
        const isEmail = trimmed.includes('@');
        setCreateName(isPhone || isEmail ? '' : trimmed);
        setCreatePhone(isPhone ? trimmed : '');
        setCreateEmail(isEmail ? trimmed : '');
        setCreateError('');
        setCreating(true);
    };

    const handleCreate = async () => {
        const name = createName.trim();
        if (!name) {
            setCreateError('Name is required');
            return;
        }
        setCreateSubmitting(true);
        setCreateError('');
        try {
            const payload: { name: string; phone?: string; email?: string } = { name };
            if (createPhone.trim()) payload.phone = createPhone.trim();
            if (createEmail.trim()) payload.email = createEmail.trim();
            const { data } = await api.post('/contacts', payload);
            // Mirror handleSelect: select the freshly created contact and close.
            handleSelect({ id: data.id, name: data.name, phone: data.phone, email: data.email });
        } catch (err: any) {
            const raw = err?.response?.data?.message;
            setCreateError(
                Array.isArray(raw)
                    ? raw.join(', ')
                    : raw || 'Could not create contact. Please try again.',
            );
        } finally {
            setCreateSubmitting(false);
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
                        <div style={{ padding: 12 }}>
                            {!creating ? (
                                <>
                                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, marginBottom: 10 }}>
                                        No contacts found
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => openCreateForm(query)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                            padding: '10px 12px', background: 'rgba(0,169,157,0.08)',
                                            border: '1px solid rgba(0,169,157,0.25)', borderRadius: 8,
                                            cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)', fontSize: 13,
                                        }}
                                    >
                                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Icon icon={faPlus} />
                                        </span>
                                        <span>Create &ldquo;<strong>{query.trim()}</strong>&rdquo; as a new contact</span>
                                    </button>
                                </>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                                        NEW CONTACT
                                    </div>
                                    <input
                                        className="input"
                                        autoFocus
                                        value={createName}
                                        onChange={(e) => setCreateName(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                                        placeholder="Name (required)"
                                    />
                                    <input
                                        className="input"
                                        value={createPhone}
                                        onChange={(e) => setCreatePhone(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                                        placeholder="Phone (SMS / WhatsApp / Voice)"
                                    />
                                    <input
                                        className="input"
                                        value={createEmail}
                                        onChange={(e) => setCreateEmail(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
                                        placeholder="Email (optional)"
                                    />
                                    {createError && (
                                        <div style={{ color: '#ef4444', fontSize: 12 }}>{createError}</div>
                                    )}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            type="button"
                                            onClick={handleCreate}
                                            disabled={createSubmitting || !createName.trim()}
                                            className="btn btn-primary"
                                            style={{ fontSize: 13, flex: 1, opacity: (createSubmitting || !createName.trim()) ? 0.6 : 1 }}
                                        >
                                            {createSubmitting ? 'Creating…' : 'Create & select'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setCreating(false); setCreateError(''); }}
                                            className="btn btn-ghost"
                                            style={{ fontSize: 13 }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
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
