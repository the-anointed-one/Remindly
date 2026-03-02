'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface Template { id: string; name: string; channel: string; body: string; subject?: string; isActive: boolean; variables: string[]; }

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', channel: 'SMS', body: '', subject: '' });
    const [saving, setSaving] = useState(false);

    const fetch = useCallback(async () => {
        try { const { data } = await api.get('/templates'); setTemplates(Array.isArray(data) ? data : []); } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/templates', form);
            setShowForm(false);
            setForm({ name: '', channel: 'SMS', body: '', subject: '' });
            fetch();
        } catch (err: any) { alert(err.response?.data?.message || 'Failed'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this template?')) return;
        try { await api.delete(`/templates/${id}`); fetch(); } catch { }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>Templates</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Template'}</button>
            </div>

            {showForm && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="grid-2">
                            <div className="input-group">
                                <label className="input-label">Template Name</label>
                                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="24h Appointment Reminder" required />
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
                        {form.channel === 'EMAIL' && (
                            <div className="input-group">
                                <label className="input-label">Subject</label>
                                <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Appointment Reminder" />
                            </div>
                        )}
                        <div className="input-group">
                            <label className="input-label">Message Body</label>
                            <textarea className="input" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })}
                                placeholder="Hi {{customer_name}}, your {{appointment_title}} is on {{appointment_date}} at {{appointment_time}}. Reply YES to confirm." required />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Variables: {'{{customer_name}}, {{appointment_title}}, {{appointment_date}}, {{appointment_time}}'}</span>
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Template'}</button>
                    </form>
                </div>
            )}

            {loading ? <p style={{ color: 'var(--text-muted)' }}>Loading...</p> : templates.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: 48 }}>
                    <div style={{ fontSize: 48, marginBottom: 16 }}>📝</div>
                    <h3 style={{ fontSize: 18, marginBottom: 8 }}>No Templates Yet</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Create templates or use AI to generate them.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {templates.map((t) => (
                        <div key={t.id} className="card">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t.name}</h3>
                                    <span className={`badge ${t.channel === 'SMS' ? 'badge-success' : t.channel === 'VOICE' ? 'badge-info' : 'badge-accent'}`}>{t.channel}</span>
                                </div>
                                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id)}>Delete</button>
                            </div>
                            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 16, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                {t.body}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
