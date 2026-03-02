'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface Rule { id: string; name: string; channel: string; offsetMinutes: number; isActive: boolean; templateId?: string; }

export default function RemindersPage() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', channel: 'SMS', offsetMinutes: 1440, isActive: true });
    const [saving, setSaving] = useState(false);

    const fetch = useCallback(async () => {
        try { const { data } = await api.get('/reminder-rules'); setRules(Array.isArray(data) ? data : []); } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/reminder-rules', { ...form, offsetMinutes: Number(form.offsetMinutes) });
            setShowForm(false);
            setForm({ name: '', channel: 'SMS', offsetMinutes: 1440, isActive: true });
            fetch();
        } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this rule?')) return;
        try { await api.delete(`/reminder-rules/${id}`); fetch(); } catch { }
    };

    const formatOffset = (min: number) => {
        if (min >= 1440) return `${Math.floor(min / 1440)}d before`;
        if (min >= 60) return `${Math.floor(min / 60)}h before`;
        return `${min}m before`;
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>Reminder Rules</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Rule'}</button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="grid-2">
                            <div className="input-group">
                                <label className="input-label">Rule Name</label>
                                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="24h SMS Reminder" required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Channel</label>
                                <select className="input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
                                    <option value="SMS">SMS</option>
                                    <option value="VOICE">Voice</option>
                                    <option value="EMAIL">Email</option>
                                </select>
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Send Before Appointment (minutes)</label>
                            <input className="input" type="number" value={form.offsetMinutes} onChange={(e) => setForm({ ...form, offsetMinutes: Number(e.target.value) })} min={5} />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>1440 = 24h, 60 = 1h, 30 = 30min</span>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Rule'}</button>
                    </form>
                </div>
            )}

            {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : rules.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
                    <h3 style={{ fontSize: 18, marginBottom: 8 }}>No Reminder Rules</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Create rules like &quot;Send SMS 24h before appointment&quot;.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead><tr><th>Name</th><th>Channel</th><th>Timing</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>{rules.map((r) => (
                            <tr key={r.id}>
                                <td style={{ fontWeight: 600 }}>{r.name}</td>
                                <td><span className={`badge ${r.channel === 'SMS' ? 'badge-success' : r.channel === 'VOICE' ? 'badge-info' : 'badge-accent'}`}>{r.channel}</span></td>
                                <td>{formatOffset(r.offsetMinutes)}</td>
                                <td><span className={`badge ${r.isActive ? 'badge-success' : 'badge-danger'}`}>{r.isActive ? 'Active' : 'Inactive'}</span></td>
                                <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Delete</button></td>
                            </tr>
                        ))}</tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
