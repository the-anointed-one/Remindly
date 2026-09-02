'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import Icon from '@/components/ui/Icon';
import { faTrash, faLink, faCode, faPlus } from '@fortawesome/free-solid-svg-icons';

interface ContactForm {
    id: string;
    title: string;
    description: string | null;
    slug: string;
    isActive: boolean;
    eventId: string | null;
    submissions: number;
    createdAt: string;
}

export default function FormsPage() {
    const { user, loading: authLoading } = useAuth();
    const toast = useToast();

    const [forms, setForms] = useState<ContactForm[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [eventId, setEventId] = useState('');
    const [events, setEvents] = useState<any[]>([]);
    const [origin, setOrigin] = useState('');

    // window is unavailable during SSR — read it once on the client.
    useEffect(() => setOrigin(window.location.origin), []);

    const tenantId = user?.tenantId || '';

    const fetchForms = async () => {
        setLoading(true);
        try {
            const res = await api.get('/forms');
            setForms(res.data?.data || res.data || []);
        } catch {
            toast.error('Could not load forms');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!tenantId) return;
        fetchForms();
        api.get('/events')
            .then((res) => setEvents(res.data?.data || res.data || []))
            .catch(() => setEvents([]));
    }, [tenantId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;
        setSaving(true);
        try {
            await api.post('/forms', {
                title: title.trim(),
                description: description.trim() || undefined,
                eventId: eventId || undefined,
            });
            toast.success('Form created');
            setTitle('');
            setDescription('');
            setEventId('');
            setShowForm(false);
            fetchForms();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Could not create form');
        } finally {
            setSaving(false);
        }
    };

    const handleDeactivate = async (id: string) => {
        try {
            await api.delete(`/forms/${id}`);
            toast.success('Form deactivated');
            fetchForms();
        } catch {
            toast.error('Could not deactivate form');
        }
    };

    const shareLinkFor = (form: ContactForm) => `${origin}/forms/${form.slug}`;

    const embedCodeFor = (form: ContactForm) =>
        `<div id="meetora-form"></div>\n` +
        `<script src="${origin}/embed.js" ` +
        `data-form="${form.slug}" ` +
        `data-container="meetora-form"></script>`;

    const copy = async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text);
            toast.success(`${label} copied!`);
        } catch {
            toast.error('Copy failed — your browser blocked clipboard access');
        }
    };

    if (!tenantId && !authLoading)
        return <div style={{ padding: 40, textAlign: 'center' }}>Initializing…</div>;
    if (loading || authLoading)
        return <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>Forms</h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        Shareable and embeddable forms for collecting contacts
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon={faPlus} /> New Form
                </button>
            </div>

            {showForm && (
                <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Create Form</h3>
                    <form onSubmit={handleCreate}>
                        <div className="input-group" style={{ marginBottom: 14 }}>
                            <label className="input-label">Title *</label>
                            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)}
                                required placeholder="e.g. Register your interest" />
                        </div>
                        <div className="input-group" style={{ marginBottom: 14 }}>
                            <label className="input-label">Description</label>
                            <textarea className="input" rows={2} value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Shown under the title on the public form" />
                        </div>
                        <div className="input-group" style={{ marginBottom: 18 }}>
                            <label className="input-label">Link to Event</label>
                            <select className="input" value={eventId} onChange={(e) => setEventId(e.target.value)}
                                title="Anyone who submits this form is automatically invited to the selected event.">
                                <option value="">No event — just collect contacts</option>
                                {events.map((ev: any) => (
                                    <option key={ev.id} value={ev.id}>{ev.title}</option>
                                ))}
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                            <button type="button" onClick={() => setShowForm(false)} className="btn btn-outline btn-sm">Cancel</button>
                            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
                                {saving ? 'Creating…' : 'Create Form'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {forms.length === 0 ? (
                <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                    <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>No forms yet</p>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        Create a form to collect contacts from a shareable link or your website.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {forms.map((form) => (
                        <div key={form.id} className="glass-card" style={{ padding: 20, opacity: form.isActive ? 1 : 0.55 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                                        <h3 style={{ fontSize: 16, fontWeight: 700 }}>{form.title}</h3>
                                        {!form.isActive && (
                                            <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '2px 8px' }}>
                                                INACTIVE
                                            </span>
                                        )}
                                    </div>
                                    {form.description && (
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>{form.description}</p>
                                    )}
                                    <p style={{ fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all' }}>
                                        {origin}/forms/{form.slug}
                                    </p>
                                </div>

                                <div style={{ textAlign: 'center', minWidth: 90 }}>
                                    <div style={{ fontSize: 24, fontWeight: 800, color: '#0F6E56' }}>{form.submissions}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                        Submissions
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                                <button className="btn btn-outline btn-sm" title="Copy the public link to share with attendees."
                                    onClick={() => copy(shareLinkFor(form), 'Link')}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Icon icon={faLink} /> Copy Link
                                </button>
                                <button className="btn btn-outline btn-sm" title="Copy the HTML snippet to embed this form on your website."
                                    onClick={() => copy(embedCodeFor(form), 'Embed code')}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <Icon icon={faCode} /> Copy Embed Code
                                </button>
                                {form.isActive && (
                                    <button className="btn btn-danger btn-sm" title="Deactivate this form so it stops accepting submissions."
                                        onClick={() => handleDeactivate(form.id)}
                                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <Icon icon={faTrash} /> Deactivate
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
