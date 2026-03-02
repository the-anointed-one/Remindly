'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface Appointment { id: string; title: string; scheduledAt: string; status: string; customerId: string; durationMinutes: number; notes?: string; }

export default function AppointmentsPage() {
    const [apts, setApts] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: '', customerId: '', scheduledAt: '', durationMinutes: 30, notes: '' });
    const [saving, setSaving] = useState(false);

    const fetchApts = useCallback(async () => {
        try {
            const { data } = await api.get('/appointments');
            setApts(Array.isArray(data) ? data : data.data || []);
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchApts(); }, [fetchApts]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/appointments', { ...form, durationMinutes: Number(form.durationMinutes) });
            setShowForm(false);
            setForm({ title: '', customerId: '', scheduledAt: '', durationMinutes: 30, notes: '' });
            fetchApts();
        } catch (err: any) {
            alert(err.response?.data?.message || 'Failed to create appointment');
        } finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this appointment?')) return;
        try { await api.delete(`/appointments/${id}`); fetchApts(); } catch { }
    };

    const statusColor = (s: string) => {
        if (s === 'CONFIRMED') return 'badge-success';
        if (s === 'CANCELLED') return 'badge-danger';
        if (s === 'COMPLETED') return 'badge-info';
        return 'badge-warning';
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>Appointments</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : '+ New Appointment'}
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="grid-2">
                            <div className="input-group">
                                <label className="input-label">Title</label>
                                <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Dental Checkup" required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Customer ID</label>
                                <input className="input" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} placeholder="UUID" required />
                            </div>
                        </div>
                        <div className="grid-2">
                            <div className="input-group">
                                <label className="input-label">Date & Time</label>
                                <input className="input" type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Duration (min)</label>
                                <input className="input" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} min={5} />
                            </div>
                        </div>
                        <div className="input-group">
                            <label className="input-label">Notes</label>
                            <textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes..." />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Appointment'}</button>
                    </form>
                </div>
            )}

            {loading ? (
                <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
            ) : apts.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📅</div>
                    <h3 style={{ fontSize: 18, marginBottom: 8 }}>No Appointments Yet</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Create your first appointment to get started.</p>
                </div>
            ) : (
                <div className="table-container">
                    <table>
                        <thead><tr><th>Title</th><th>Date</th><th>Duration</th><th>Status</th><th>Actions</th></tr></thead>
                        <tbody>
                            {apts.map((a) => (
                                <tr key={a.id}>
                                    <td style={{ fontWeight: 600 }}>{a.title}</td>
                                    <td>{new Date(a.scheduledAt).toLocaleString()}</td>
                                    <td>{a.durationMinutes} min</td>
                                    <td><span className={`badge ${statusColor(a.status)}`}>{a.status}</span></td>
                                    <td><button className="btn btn-danger btn-sm" onClick={() => handleDelete(a.id)}>Delete</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
