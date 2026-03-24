'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faLocationDot, faMapPin, faPhone, faClock, faCalendar } from '@fortawesome/free-solid-svg-icons';

interface Location {
    id: string;
    name: string;
    address?: string;
    timezone: string;
    phone?: string;
    isActive: boolean;
    createdAt: string;
    _count?: { appointments: number };
}

const TIMEZONES = [
    'UTC', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Johannesburg', 'Africa/Cairo',
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Dubai', 'Asia/Kolkata',
    'Asia/Singapore', 'Asia/Tokyo', 'Australia/Sydney',
];

const EMPTY_FORM = { name: '', address: '', timezone: 'UTC', phone: '', isActive: true };

export default function LocationsPage() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);
    const [form, setForm] = useState({ ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchLocations = useCallback(async () => {
        if (process.env.NODE_ENV !== 'production') console.debug('[LocationsPage] fetchLocations');
        setLoading(true);
        try {
            const { data } = await api.get('/locations');
            if (!isMounted.current) return;
            setLocations(data);
        } catch { } finally {
            if (isMounted.current) setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLocations(); }, [fetchLocations]);

    const openCreate = () => {
        setEditId(null);
        setForm({ ...EMPTY_FORM });
        setError('');
        setShowForm(true);
    };

    const openEdit = (loc: Location) => {
        setEditId(loc.id);
        setForm({
            name: loc.name,
            address: loc.address || '',
            timezone: loc.timezone,
            phone: loc.phone || '',
            isActive: loc.isActive,
        });
        setError('');
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            const payload = {
                name: form.name,
                address: form.address || undefined,
                timezone: form.timezone,
                phone: form.phone || undefined,
                isActive: form.isActive,
            };
            if (editId) {
                await api.patch(`/locations/${editId}`, payload);
            } else {
                await api.post('/locations', payload);
            }
            setShowForm(false);
            setEditId(null);
            setForm({ ...EMPTY_FORM });
            fetchLocations();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to save location');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? Existing appointments will keep their data but lose the location link.`)) return;
        try {
            await api.delete(`/locations/${id}`);
            fetchLocations();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to delete location');
        }
    };

    const handleToggleActive = async (loc: Location) => {
        try {
            await api.patch(`/locations/${loc.id}`, { isActive: !loc.isActive });
            fetchLocations();
        } catch { }
    };

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800 }}>Locations</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                        Manage your business locations and assign them to appointments.
                    </p>
                </div>
                <button className="btn btn-primary w-full md:w-auto" onClick={openCreate}>+ Add Location</button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="card" style={{ marginBottom: 24, borderColor: 'rgba(99,102,241,0.3)' }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>
                        {editId ? 'Edit Location' : 'New Location'}
                    </h3>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="grid-2">
                            <div className="input-group">
                                <label className="input-label">Location Name *</label>
                                <input
                                    className="input"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="Main Branch"
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Phone</label>
                                <input
                                    className="input"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+1 555 000 0000"
                                />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Address</label>
                            <input
                                className="input"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="123 Main St, City, State"
                            />
                        </div>
                        <div className="grid-2">
                            <div className="input-group">
                                <label className="input-label">Timezone</label>
                                <select
                                    className="input"
                                    value={form.timezone}
                                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                                >
                                    {TIMEZONES.map((tz) => (
                                        <option key={tz} value={tz}>{tz}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Status</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 8 }}>
                                    <button
                                        type="button"
                                        onClick={() => setForm({ ...form, isActive: !form.isActive })}
                                        style={{
                                            width: 44, height: 24, borderRadius: 12,
                                            background: form.isActive ? 'var(--primary)' : 'rgba(255,255,255,0.1)',
                                            border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                                        }}
                                    >
                                        <span style={{
                                            position: 'absolute', top: 3, left: form.isActive ? 23 : 3,
                                            width: 18, height: 18, borderRadius: '50%', background: '#fff',
                                            transition: 'left 0.2s',
                                        }} />
                                    </button>
                                    <span style={{ fontSize: 14, color: form.isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        {form.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        {error && (
                            <div style={{ color: '#f87171', fontSize: 13, background: 'rgba(239,68,68,0.1)', padding: '8px 12px', borderRadius: 8 }}>
                                {error}
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 12 }}>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                                {saving ? 'Saving...' : (editId ? 'Save Changes' : 'Create Location')}
                            </button>
                            <button
                                type="button"
                                className="btn"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                onClick={() => { setShowForm(false); setEditId(null); }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* List */}
            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : locations.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 'clamp(20px, 4vw, 48px)' }}>
                    <div style={{ fontSize: 36, marginBottom: 16, color: 'var(--accent-primary)' }}><FontAwesomeIcon icon={faLocationDot} /></div>
                    <h3 style={{ fontSize: 18, marginBottom: 8 }}>No Locations Yet</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
                        Add your first location to assign it to appointments.
                    </p>
                    <button className="btn btn-primary" onClick={openCreate}>+ Add Location</button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {locations.map((loc) => (
                        <div
                            key={loc.id}
                            className="card"
                            style={{
                                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                                padding: '16px 20px',
                                opacity: loc.isActive ? 1 : 0.6,
                                borderColor: loc.isActive ? 'var(--border)' : 'rgba(255,255,255,0.05)',
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                                background: loc.isActive ? 'rgba(99,102,241,0.15)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${loc.isActive ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 18,
                                color: loc.isActive ? 'rgba(99,102,241,0.9)' : 'var(--text-muted)',
                            }}>
                                <FontAwesomeIcon icon={faLocationDot} />
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                                    <span style={{ fontWeight: 700, fontSize: 15 }}>{loc.name}</span>
                                    {!loc.isActive && (
                                        <span style={{
                                            fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
                                            color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)',
                                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 6px',
                                        }}>
                                            INACTIVE
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                    {loc.address && (
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><FontAwesomeIcon icon={faMapPin} /> {loc.address}</span>
                                    )}
                                    {loc.phone && (
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><FontAwesomeIcon icon={faPhone} /> {loc.phone}</span>
                                    )}
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}><FontAwesomeIcon icon={faClock} /> {loc.timezone}</span>
                                    {loc._count !== undefined && (
                                        <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <FontAwesomeIcon icon={faCalendar} /> {loc._count.appointments} appointment{loc._count.appointments !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                <button
                                    className="btn btn-sm"
                                    style={{
                                        background: loc.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)',
                                        border: `1px solid ${loc.isActive ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.1)'}`,
                                        color: loc.isActive ? '#4ade80' : 'var(--text-muted)',
                                    }}
                                    onClick={() => handleToggleActive(loc)}
                                    title={loc.isActive ? 'Deactivate' : 'Activate'}
                                >
                                    {loc.isActive ? 'Active' : 'Inactive'}
                                </button>
                                <button
                                    className="btn btn-sm"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    onClick={() => openEdit(loc)}
                                >
                                    Edit
                                </button>
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDelete(loc.id, loc.name)}
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
