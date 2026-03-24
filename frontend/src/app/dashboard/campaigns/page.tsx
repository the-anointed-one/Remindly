'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import FeatureBanner from '@/components/FeatureBanner';
import Icon from '@/components/ui/Icon';
import { HelpTip } from '@/components/ui/Tooltip';
import TooltipField from '@/components/ui/TooltipField';
import {
    faBullhorn, faTag, faUsers, faBolt, faChevronDown, faChevronRight,
    faPlus, faTrash, faPen, faXmark, faCheck, faCircleInfo,
    faPaperPlane, faCalendar, faReply, faFilter, faChartBar,
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

// ── Types ─────────────────────────────────────────────────────────────────────

type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED';
type ChannelType = 'SMS' | 'WHATSAPP' | 'EMAIL' | 'VOICE';

interface Tag {
    id: string;
    name: string;
    _count: { contactTags: number };
}

interface AudienceSegment {
    id: string;
    name: string;
    tagId: string | null;
    tag: { id: string; name: string } | null;
    createdAt: string;
}

interface Campaign {
    id: string;
    name: string;
    description: string | null;
    status: CampaignStatus;
    createdAt: string;
    segments: AudienceSegment[];
}

type ResponseStatus = 'confirmed' | 'cancelled' | 'pending';

interface Recipient {
    id: string;
    recipient: string;
    channel: ChannelType;
    status: string;
    sentAt: string | null;
    responseText: string | null;
    respondedAt: string | null;
    contact: { id: string; name: string; phone: string | null; email: string | null } | null;
    messageResponse: { id: string; responseStatus: ResponseStatus; responseText: string; timestamp: string } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<CampaignStatus, string> = {
    ACTIVE: 'var(--success)',
    PAUSED: 'var(--warning)',
    COMPLETED: 'var(--muted)',
};

function statusLabel(s: CampaignStatus) {
    return s.charAt(0) + s.slice(1).toLowerCase();
}

function channelColor(ch: ChannelType): string {
    const map: Record<ChannelType, string> = {
        SMS: 'var(--primary)', WHATSAPP: 'var(--success)', EMAIL: 'var(--warning)', VOICE: 'var(--accent-cta)',
    };
    return map[ch] ?? 'var(--muted)';
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 15, boxSizing: 'border-box',
    outline: 'none', minHeight: 42,
};

const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8,
};

// ── Toast ─────────────────────────────────────────────────────────────────────

interface Toast { id: number; msg: string; ok: boolean; }

function ToastStack({ toasts, dismiss }: { toasts: Toast[]; dismiss: (id: number) => void }) {
    return (
        <div style={{ position: 'fixed', bottom: 28, right: 28, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {toasts.map(t => (
                <div key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 18px', borderRadius: 10,
                    background: t.ok ? 'rgba(46, 204, 143, 0.12)' : 'rgba(224, 82, 82, 0.12)',
                    border: `1px solid ${t.ok ? 'rgba(46, 204, 143, 0.35)' : 'rgba(224, 82, 82, 0.35)'}`,
                    color: t.ok ? 'var(--success)' : 'var(--error)',
                    fontSize: 14, fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                }}>
                    <span>{t.ok ? '✓' : '✕'}</span>
                    <span style={{ flex: 1 }}>{t.msg}</span>
                    <button onClick={() => dismiss(t.id)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, opacity: 0.6, padding: 0 }}>×</button>
                </div>
            ))}
        </div>
    );
}

// ── Slide Panel ───────────────────────────────────────────────────────────────

function SlidePanel({ open, title, subtitle, onClose, children }: {
    open: boolean; title: string; subtitle?: string;
    onClose: () => void; children: React.ReactNode;
}) {
    return (
        <>
            {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(2px)' }} />}
            <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0,
                width: 480, maxWidth: '95vw',
                background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
                zIndex: 1001,
                transform: open ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
                display: 'flex', flexDirection: 'column',
                boxShadow: '-8px 0 40px rgba(0,0,0,0.4)',
            }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 28px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800 }}>{title}</div>
                        {subtitle && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
                    </div>
                    <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={faXmark} />
                    </button>
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>{children}</div>
            </div>
        </>
    );
}

// ── Campaign Form ─────────────────────────────────────────────────────────────

function CampaignForm({ initial, onSave, onCancel, saving, error }: {
    initial: { name: string; description: string };
    onSave: (v: { name: string; description: string }) => void;
    onCancel: () => void;
    saving: boolean;
    error: string;
}) {
    const [f, setF] = useState(initial);
    return (
        <form onSubmit={e => { e.preventDefault(); onSave(f); }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', color: 'var(--error)', fontSize: 13 }}>{error}</div>
            )}
            <TooltipField label="Campaign Name *" tooltip="The internal operations name for this campaign.">
                <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Startup Masterclass" required style={inputStyle} />
            </TooltipField>
            <TooltipField label="Description (optional)" tooltip="Internal notes for team tracking.">
                <textarea value={f.description} onChange={e => setF(p => ({ ...p, description: e.target.value }))} placeholder="What is this campaign about?" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
            </TooltipField>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" onClick={onCancel} className="btn btn-outline">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Save Campaign'}</button>
            </div>
        </form>
    );
}

// ── Segment Form (inline) ─────────────────────────────────────────────────────

function SegmentForm({ campaignId, tags, onCreated, onCancel }: {
    campaignId: string;
    tags: Tag[];
    onCreated: (seg: AudienceSegment) => void;
    onCancel: () => void;
}) {
    const [name, setName] = useState('');
    const [tagId, setTagId] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        setError('');
        try {
            const res = await api.post(`/campaigns/${campaignId}/segments`, {
                name: name.trim(),
                tagId: tagId || undefined,
            });
            onCreated(res.data);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create segment');
        } finally {
            setSaving(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', marginTop: 10 }}>
            {error && <div style={{ fontSize: 12, color: 'var(--error)' }}>{error}</div>}
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Segment name (e.g. Early Bird)" required style={{ ...inputStyle, fontSize: 13 }} />
            <select value={tagId} onChange={e => setTagId(e.target.value)} style={{ ...inputStyle, fontSize: 13 }}>
                <option value="">— No tag filter (all contacts) —</option>
                {tags.map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t._count.contactTags} contacts)</option>
                ))}
            </select>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={onCancel} style={{ padding: '6px 14px', borderRadius: 7, background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={saving} style={{ padding: '6px 14px', borderRadius: 7, background: 'var(--primary)', border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Adding…' : 'Add Segment'}</button>
            </div>
        </form>
    );
}

// ── Dispatch Modal ────────────────────────────────────────────────────────────

function DispatchModal({ campaign, tags, onClose, onSuccess }: {
    campaign: Campaign;
    tags: Tag[];
    onClose: () => void;
    onSuccess: (msg: string) => void;
}) {
    const [segmentId, setSegmentId] = useState(campaign.segments[0]?.id ?? '');
    const [channel, setChannel] = useState<ChannelType>('SMS');
    const [messageTemplate, setMessageTemplate] = useState('Hi {{customer_name}}, reminder: your appointment is on {{appointment_date}} at {{appointment_time}}. See you then!');
    const [scheduledAt, setScheduledAt] = useState(() => {
        const d = new Date();
        d.setMinutes(d.getMinutes() + 5);
        return d.toISOString().slice(0, 16);
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const channels: ChannelType[] = ['SMS', 'WHATSAPP', 'EMAIL', 'VOICE'];

    const handleDispatch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!segmentId) { setError('Please select a segment'); return; }
        setSaving(true);
        setError('');
        try {
            const res = await api.post(`/campaigns/${campaign.id}/dispatch`, {
                segmentId,
                channel,
                messageTemplate,
                scheduledAt: new Date(scheduledAt).toISOString(),
            });
            onSuccess(`${res.data.queued ?? 0} messages queued successfully`);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Dispatch failed');
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, backdropFilter: 'blur(4px)' }} />
            <div style={{
                position: 'fixed', zIndex: 1201,
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 'min(520px, calc(100vw - 32px))',
                maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 18, padding: '28px 32px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800 }}>Dispatch Campaign</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{campaign.name}</div>
                    </div>
                    <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={faXmark} />
                    </button>
                </div>

                <form onSubmit={handleDispatch} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', color: 'var(--error)', fontSize: 13 }}>{error}</div>}

                    <TooltipField label="Audience Segment" tooltip="Select which group of contacts should receive this campaign's dispatch.">
                        <select value={segmentId} onChange={e => setSegmentId(e.target.value)} style={inputStyle} required>
                            <option value="">— Select a segment —</option>
                            {campaign.segments.map(s => (
                                <option key={s.id} value={s.id}>{s.name}{s.tag ? ` (tag: ${s.tag.name})` : ' (all contacts)'}</option>
                            ))}
                        </select>
                        {campaign.segments.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--warning)', marginTop: 6 }}>⚠ Add at least one segment to dispatch</div>
                        )}
                    </TooltipField>

                    <div>
                        <label style={labelStyle}>Channel</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {channels.map(ch => (
                                <button key={ch} type="button" onClick={() => setChannel(ch)} style={{
                                    flex: '1 1 80px', padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    background: channel === ch ? `${channelColor(ch)}20` : 'var(--bg-secondary)',
                                    border: `1px solid ${channel === ch ? channelColor(ch) + '60' : 'var(--border)'}`,
                                    color: channel === ch ? channelColor(ch) : 'var(--text-muted)',
                                }}>
                                    {ch === 'WHATSAPP' ? <Icon icon={faWhatsapp} /> : null} {ch}
                                </button>
                            ))}
                        </div>
                    </div>

                    <TooltipField label="Message" tooltip="The template content payload for this dispatch segment.">
                        <textarea
                            value={messageTemplate}
                            onChange={e => setMessageTemplate(e.target.value)}
                            rows={4} required
                            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                        />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Variables: <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>{'{{customer_name}}'}</code>{' '}
                            <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>{'{{appointment_date}}'}</code>{' '}
                            <code style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3 }}>{'{{appointment_time}}'}</code>
                        </div>
                    </TooltipField>

                    <TooltipField label="Schedule Send Time" tooltip="Choose when to push the dispatch queue via Background Jobs.">
                        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} required style={inputStyle} />
                    </TooltipField>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                        <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
                        <button type="submit" disabled={saving || campaign.segments.length === 0} className="btn btn-primary" style={{ gap: 8 }}>
                            <Icon icon={faPaperPlane} /> {saving ? 'Dispatching…' : 'Dispatch'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

// ── Responses Tab ─────────────────────────────────────────────────────────────

function ResponsesTab({ campaignId, onFollowUp }: { campaignId: string; onFollowUp: (status?: FollowUpStatus) => void }) {
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/campaigns/${campaignId}/recipients`)
            .then(({ data }) => setRecipients(Array.isArray(data) ? data : []))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [campaignId]);

    const responded = recipients.filter(r => r.messageResponse);

    const statusCounts = responded.reduce<Record<ResponseStatus, number>>(
        (acc, r) => { if (r.messageResponse) acc[r.messageResponse.responseStatus]++; return acc; },
        { confirmed: 0, cancelled: 0, pending: 0 },
    );

    const responseCounts = responded.reduce<Record<string, number>>((acc, r) => {
        const key = (r.responseText ?? '').toUpperCase().trim();
        if (key) acc[key] = (acc[key] ?? 0) + 1;
        return acc;
    }, {});

    const statusColor: Record<ResponseStatus, string> = {
        confirmed: '#22c55e',
        cancelled: '#ef4444',
        pending: '#f59e0b',
    };

    const rcColor = (status: string) => {
        if (status === 'sent' || status === 'delivered') return 'var(--success)';
        if (status === 'failed') return 'var(--error)';
        if (status === 'responded') return '#818cf8';
        return 'var(--warning)';
    };

    if (loading) return <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading responses…</div>;

    if (recipients.length === 0) {
        return (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Icon icon={faReply} style={{ marginBottom: 8, display: 'block', fontSize: 24, opacity: 0.4 }} />
                No recipients yet — dispatch this campaign to start tracking responses.
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Summary pills */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {recipients.length} sent
                </div>
                <div style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.25)', color: '#818cf8', fontWeight: 600 }}>
                    {responded.length} responded
                </div>
                {((['confirmed', 'cancelled', 'pending'] as ResponseStatus[])).map(s => statusCounts[s] > 0 && (
                    <div key={s} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 100, background: `${statusColor[s]}18`, border: `1px solid ${statusColor[s]}40`, color: statusColor[s], fontWeight: 600 }}>
                        {s}: {statusCounts[s]}
                    </div>
                ))}
                {(['confirmed', 'cancelled', 'pending'] as ResponseStatus[]).map(s => statusCounts[s] > 0 && (
                    <div key={s} style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                        padding: '4px 12px', borderRadius: 100, cursor: 'pointer',
                        background: `${statusColor[s]}10`, border: `1px solid ${statusColor[s]}35`,
                        color: statusColor[s], fontWeight: 600,
                    }}
                        onClick={() => onFollowUp(s as FollowUpStatus)}
                        title={`Send follow-up to ${s} contacts`}
                    >
                        <Icon icon={faReply} style={{ fontSize: 10 }} />
                        Follow up {s}: {statusCounts[s]}
                    </div>
                ))}
            </div>

            {/* Recipient table */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr>
                            {['Contact', 'Channel', 'Status', 'Response', 'Responded At'].map(h => (
                                <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {recipients.map(r => (
                            <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <td style={{ padding: '8px 10px', fontWeight: 600 }}>
                                    {r.contact?.name ?? r.recipient}
                                    {r.contact?.phone && r.contact.phone !== r.recipient && (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{r.contact.phone}</div>
                                    )}
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 5, background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{r.channel}</span>
                                </td>
                                <td style={{ padding: '8px 10px' }}>
                                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: `${rcColor(r.status)}18`, border: `1px solid ${rcColor(r.status)}40`, color: rcColor(r.status) }}>
                                        {r.status}
                                    </span>
                                </td>
                                <td style={{ padding: '8px 10px', fontWeight: r.responseText ? 700 : 400, color: r.responseText ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                    {r.responseText ?? '—'}
                                </td>
                                <td style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: 12 }}>
                                    {r.respondedAt ? new Date(r.respondedAt).toLocaleString() : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ── Follow-up Modal ───────────────────────────────────────────────────────────

type FollowUpStatus = 'confirmed' | 'cancelled' | 'pending' | 'all';

const FOLLOW_UP_STATUS_META: Record<FollowUpStatus, { label: string; color: string; desc: string }> = {
    confirmed: { label: 'Confirmed',  color: '#22c55e', desc: 'Contacts who replied "confirmed"' },
    cancelled:  { label: 'Cancelled', color: '#ef4444', desc: 'Contacts who replied "cancelled"' },
    pending:    { label: 'Pending',   color: '#f59e0b', desc: 'Contacts who replied but are undecided' },
    all:        { label: 'All Responses', color: 'var(--text-muted)', desc: 'Everyone who responded to this campaign' },
};

function FollowUpModal({ campaign, initialStatus, onClose, onSuccess }: {
    campaign: Campaign;
    initialStatus?: FollowUpStatus;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}) {
    const [channel, setChannel] = useState<ChannelType>('SMS');
    const [status, setStatus] = useState<FollowUpStatus>(initialStatus ?? 'confirmed');
    const [message, setMessage] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const channels: ChannelType[] = ['SMS', 'WHATSAPP', 'EMAIL', 'VOICE'];

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim()) return;
        setSaving(true);
        setError('');
        try {
            // Primary path: use responseStatus (semantic enum) — matches spec query:
            //   SELECT contact_id FROM message_responses
            //   WHERE broadcast_id = ? AND response_status = ?
            const res = await api.post('/messaging/broadcast', {
                audienceType: 'campaign_response',
                audienceId: campaign.id,
                responseStatus: status === 'all' ? undefined : status,
                channel,
                template: message,
                campaignName: `Follow-up: ${campaign.name} [${status}]`,
            });
            onSuccess(`${res.data.dispatched ?? 0} follow-up messages queued`);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send follow-up');
        } finally {
            setSaving(false);
        }
    };

    const meta = FOLLOW_UP_STATUS_META[status];

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, backdropFilter: 'blur(4px)' }} />
            <div style={{
                position: 'fixed', zIndex: 1201,
                top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: 'min(520px, calc(100vw - 32px))',
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 18, padding: '28px 32px',
                boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <div style={{ fontSize: 17, fontWeight: 800 }}>Send Follow-up Broadcast</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                            Campaign: <em>{campaign.name}</em>
                        </div>
                    </div>
                    <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Icon icon={faXmark} />
                    </button>
                </div>

                <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(224,82,82,0.1)', border: '1px solid rgba(224,82,82,0.25)', color: 'var(--error)', fontSize: 13 }}>{error}</div>}

                    {/* Target Status Selector */}
                    <div>
                        <label style={labelStyle}>Target Audience — Response Status</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                            {(['confirmed', 'cancelled', 'pending', 'all'] as FollowUpStatus[]).map(s => {
                                const m = FOLLOW_UP_STATUS_META[s];
                                const active = status === s;
                                return (
                                    <button key={s} type="button" onClick={() => setStatus(s)} style={{
                                        padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                        background: active ? `${m.color}18` : 'var(--bg-secondary)',
                                        border: `2px solid ${active ? m.color + '80' : 'var(--border)'}`,
                                        color: active ? m.color : 'var(--text-muted)',
                                        transition: 'all 0.15s', textAlign: 'center',
                                    }}>
                                        {m.label}
                                    </button>
                                );
                            })}
                        </div>
                        <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: `${meta.color === 'var(--text-muted)' ? 'rgba(255,255,255,0.04)' : meta.color + '0f'}`, border: `1px solid ${meta.color === 'var(--text-muted)' ? 'var(--border)' : meta.color + '30'}`, fontSize: 12, color: meta.color }}>
                            <strong>Targets:</strong> {meta.desc}
                            {status !== 'all' && (
                                <span style={{ opacity: 0.7, display: 'block', fontSize: 11, marginTop: 2 }}>
                                    Query: SELECT contact_id FROM message_responses WHERE broadcast_id = &apos;{campaign.id.slice(0, 8)}…&apos; AND response_status = &apos;{status}&apos;
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Channel */}
                    <div>
                        <label style={labelStyle}>Channel</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {channels.map(ch => (
                                <button key={ch} type="button" onClick={() => setChannel(ch)} style={{
                                    flex: '1 1 70px', padding: '7px 6px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    background: channel === ch ? `${channelColor(ch)}20` : 'var(--bg-secondary)',
                                    border: `1px solid ${channel === ch ? channelColor(ch) + '60' : 'var(--border)'}`,
                                    color: channel === ch ? channelColor(ch) : 'var(--text-muted)',
                                }}>
                                    {ch === 'WHATSAPP' ? <Icon icon={faWhatsapp} /> : null} {ch}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Message */}
                    <div>
                        <label style={labelStyle}>Message</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            rows={4} required
                            placeholder={status === 'confirmed'
                                ? 'Hi {{contact_name}}, great news! Here is the venue address…'
                                : 'Hi {{contact_name}}, we noticed you haven\'t confirmed yet…'}
                            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }}
                        />
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            Variables:{' '}
                            {['{{contact_name}}', '{{business_name}}', '{{appointment_date}}'].map(v => (
                                <code key={v} style={{ background: 'var(--bg-secondary)', padding: '1px 4px', borderRadius: 3, marginRight: 4 }}>{v}</code>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                        <button type="button" onClick={onClose} className="btn btn-outline">Cancel</button>
                        <button type="submit" disabled={saving} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Icon icon={faPaperPlane} /> {saving ? 'Sending…' : `Send to ${meta.label}`}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
}

// ── Stats Tab ─────────────────────────────────────────────────────────────────

interface StatsSummary {
    scopeName: string;
    scopeId: string;
    total: number;
    confirmed: number;
    cancelled: number;
    pending: number;
    noResponse: number;
}

interface AllStats {
    campaign: StatsSummary;
    segments: StatsSummary[];
    tags: StatsSummary[];
}

function StatRow({ label, stats, isTotal }: { label: string; stats: StatsSummary; isTotal?: boolean }) {
    const responded = stats.confirmed + stats.cancelled + stats.pending;
    const responseRate = stats.total > 0 ? Math.round((responded / stats.total) * 100) : 0;

    return (
        <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: isTotal ? 'rgba(0,169,157,0.04)' : 'transparent' }}>
            <td style={{ padding: '9px 12px', fontWeight: isTotal ? 800 : 600, fontSize: 13 }}>{label}</td>
            <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{stats.total}</td>
            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e' }}>
                    {stats.confirmed}
                </span>
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
                    {stats.cancelled}
                </span>
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b' }}>
                    {stats.pending}
                </span>
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                    {stats.noResponse}
                </span>
            </td>
            <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 12, color: responseRate >= 80 ? '#22c55e' : responseRate >= 40 ? '#f59e0b' : 'var(--text-muted)' }}>
                {responseRate}%
            </td>
        </tr>
    );
}

function StatsTab({ campaignId, segments }: { campaignId: string; segments: AudienceSegment[] }) {
    const [stats, setStats] = useState<AllStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get(`/campaigns/${campaignId}/stats/all`)
            .then(({ data }) => setStats(data))
            .catch(() => setStats(null))
            .finally(() => setLoading(false));
    }, [campaignId]);

    if (loading) {
        return <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Loading stats…</div>;
    }

    if (!stats || stats.campaign.total === 0) {
        return (
            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                <Icon icon={faChartBar} style={{ display: 'block', marginBottom: 10, fontSize: 26, opacity: 0.3 }} />
                No dispatch data yet — send this campaign to see response breakdowns.
            </div>
        );
    }

    const hasSegmentStats = stats.segments.length > 0;
    const hasTagStats = stats.tags.length > 0;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Response rate bar */}
            {(() => {
                const responded = stats.campaign.confirmed + stats.campaign.cancelled + stats.campaign.pending;
                const rate = stats.campaign.total > 0 ? (responded / stats.campaign.total) * 100 : 0;
                return (
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                            <span>Overall Response Rate</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{Math.round(rate)}%</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 100, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${rate}%`, borderRadius: 100, background: 'linear-gradient(90deg, var(--primary), #6366f1)', transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            {[
                                { label: 'Confirmed', value: stats.campaign.confirmed, color: '#22c55e' },
                                { label: 'Cancelled', value: stats.campaign.cancelled, color: '#ef4444' },
                                { label: 'Pending', value: stats.campaign.pending, color: '#f59e0b' },
                                { label: 'No Response', value: stats.campaign.noResponse, color: 'var(--text-muted)' },
                            ].map(({ label, value, color }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                                    <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
                                    <span style={{ fontWeight: 700, color }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}

            {/* Breakdown table */}
            {(hasSegmentStats || hasTagStats) && (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                            <tr>
                                {['Scope', 'Sent', 'Confirmed', 'Cancelled', 'Pending', 'No Reply', 'Rate'].map(h => (
                                    <th key={h} style={{
                                        padding: '6px 12px', textAlign: h === 'Scope' ? 'left' : 'center',
                                        fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                                        textTransform: 'uppercase', letterSpacing: '0.04em',
                                        borderBottom: '1px solid var(--border)',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <StatRow label={`Campaign: ${stats.campaign.scopeName}`} stats={stats.campaign} isTotal />
                            {hasSegmentStats && (
                                <>
                                    <tr><td colSpan={7} style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>By Segment</td></tr>
                                    {stats.segments.map(s => <StatRow key={s.scopeId} label={s.scopeName} stats={s} />)}
                                </>
                            )}
                            {hasTagStats && (
                                <>
                                    <tr><td colSpan={7} style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>By Tag</td></tr>
                                    {stats.tags.map(s => <StatRow key={s.scopeId} label={s.scopeName} stats={s} />)}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ fontSize: 11, color: 'var(--text-muted)', opacity: 0.6, textAlign: 'right' }}>
                Equivalent SQL: <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 3, fontSize: 10 }}>
                    SELECT response_status, COUNT(*) FROM message_responses WHERE broadcast_id = &apos;{campaignId}&apos; GROUP BY response_status
                </code>
            </div>
        </div>
    );
}

// ── Campaign Card ─────────────────────────────────────────────────────────────

function CampaignCard({
    campaign, tags, expanded, onToggle, onEdit, onDelete, onSegmentCreated, onSegmentDeleted, onDispatch, onFollowUp, toast,
}: {
    campaign: Campaign;
    tags: Tag[];
    expanded: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onSegmentCreated: (seg: AudienceSegment) => void;
    onSegmentDeleted: (segId: string) => void;
    onDispatch: () => void;
    onFollowUp: (status?: FollowUpStatus) => void;
    toast: (msg: string, ok?: boolean) => void;
}) {
    const [addingSegment, setAddingSegment] = useState(false);
    const [deletingSegId, setDeletingSegId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'segments' | 'responses' | 'stats'>('segments');
    const color = STATUS_COLORS[campaign.status];

    const handleDeleteSegment = async (segId: string) => {
        if (!confirm('Delete this audience segment?')) return;
        setDeletingSegId(segId);
        try {
            await api.delete(`/campaigns/${campaign.id}/segments/${segId}`);
            onSegmentDeleted(segId);
            toast('Segment deleted');
        } catch {
            toast('Failed to delete segment', false);
        } finally {
            setDeletingSegId(null);
        }
    };

    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, overflow: 'hidden',
            transition: 'border-color 200ms',
        }}>
            {/* Top accent */}
            <div style={{ height: 3, background: `linear-gradient(90deg, var(--primary), transparent)` }} />

            {/* Header */}
            <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <button onClick={onToggle} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 13, padding: '3px 0', flexShrink: 0, marginTop: 2,
                }}>
                    <Icon icon={expanded ? faChevronDown : faChevronRight} />
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontWeight: 800, fontSize: 16 }}>{campaign.name}</span>
                        <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                            background: `${color}18`, border: `1px solid ${color}40`, color,
                        }}>{statusLabel(campaign.status)}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            <Icon icon={faUsers} /> {campaign.segments.length} segment{campaign.segments.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    {campaign.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{campaign.description}</div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                    <button onClick={onDispatch} title="Dispatch campaign" style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: 'rgba(0, 169, 157, 0.12)', border: '1px solid rgba(0, 169, 157, 0.35)', color: 'var(--primary)',
                        display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                        <Icon icon={faBolt} /> Send
                    </button>
                    <Link href={`/dashboard/campaigns/${campaign.id}/responses`} title="Response dashboard" style={{
                        padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.3)', color: '#818cf8',
                        display: 'flex', alignItems: 'center', gap: 5, textDecoration: 'none',
                    }}>
                        <Icon icon={faReply} /> Responses
                    </Link>
                    <button onClick={onEdit} title="Edit campaign" style={{
                        padding: '6px 12px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>
                        <Icon icon={faPen} />
                    </button>
                    <button onClick={onDelete} title="Delete campaign" style={{
                        padding: '6px 10px', borderRadius: 7, background: 'none', border: '1px solid rgba(224, 82, 82, 0.3)', color: 'var(--error)', fontSize: 12, cursor: 'pointer',
                    }}>
                        <Icon icon={faTrash} />
                    </button>
                </div>
            </div>

            {/* Expanded body */}
            {expanded && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                    {/* Tab bar */}
                    <div style={{ display: 'flex', padding: '0 22px', borderBottom: '1px solid var(--border)' }}>
                        {([['segments', 'Segments'], ['responses', 'Responses'], ['stats', 'Stats']] as const).map(([id, label]) => (
                            <button key={id} onClick={() => setActiveTab(id)} style={{
                                padding: '12px 14px', fontSize: 13, fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer',
                                color: activeTab === id ? 'var(--primary)' : 'var(--text-muted)',
                                borderBottom: `2px solid ${activeTab === id ? 'var(--primary)' : 'transparent'}`,
                                marginRight: 8, transition: 'all 0.15s',
                            }}>{label}</button>
                        ))}
                    </div>

                    <div style={{ padding: '16px 22px 18px' }}>
                    {activeTab === 'segments' && (<>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Icon icon={faUsers} /> Audience Segments
                        <HelpTip text="Segments target specific groups within this campaign. Each segment is linked to a tag — contacts with that tag will receive the campaign messages." placement="top" maxWidth={240} />
                    </div>

                    {campaign.segments.length === 0 && !addingSegment && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '12px 0', fontStyle: 'italic' }}>
                            No segments yet — add one below to target specific contact groups.
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {campaign.segments.map(seg => (
                            <div key={seg.id} style={{
                                display: 'flex', alignItems: 'center', gap: 10,
                                padding: '10px 14px', borderRadius: 9,
                                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                            }}>
                                <Icon icon={faUsers} className="text-primary text-[13px] shrink-0" />
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{seg.name}</div>
                                    {seg.tag ? (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <Icon icon={faTag} />
                                            <span style={{ background: 'rgba(0, 169, 157, 0.12)', border: '1px solid rgba(0, 169, 157, 0.25)', color: 'var(--primary)', padding: '1px 7px', borderRadius: 4, fontWeight: 600 }}>
                                                {seg.tag.name}
                                            </span>
                                        </div>
                                    ) : (
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>All contacts</div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteSegment(seg.id)}
                                    disabled={deletingSegId === seg.id}
                                    style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 12, opacity: deletingSegId === seg.id ? 0.5 : 1 }}
                                >
                                    <Icon icon={faXmark} />
                                </button>
                            </div>
                        ))}
                    </div>

                    {addingSegment ? (
                        <SegmentForm
                            campaignId={campaign.id}
                            tags={tags}
                            onCreated={seg => { onSegmentCreated(seg); setAddingSegment(false); toast('Segment added'); }}
                            onCancel={() => setAddingSegment(false)}
                        />
                    ) : (
                        <button onClick={() => setAddingSegment(true)} style={{
                            marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                            background: 'none', border: '1px dashed var(--border)',
                            color: 'var(--text-muted)', cursor: 'pointer', width: '100%',
                            justifyContent: 'center',
                        }}>
                            <Icon icon={faPlus} /> Add Segment
                        </button>
                    )}
                    </>)}

                    {activeTab === 'responses' && (
                        <ResponsesTab campaignId={campaign.id} onFollowUp={onFollowUp} />
                    )}

                    {activeTab === 'stats' && (
                        <StatsTab campaignId={campaign.id} segments={campaign.segments} />
                    )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // Panel state
    const [panelOpen, setPanelOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
    const [panelSaving, setPanelSaving] = useState(false);
    const [panelError, setPanelError] = useState('');

    // Dispatch
    const [dispatchTarget, setDispatchTarget] = useState<Campaign | null>(null);
    const [followUpTarget, setFollowUpTarget] = useState<{ campaign: Campaign; status?: FollowUpStatus } | null>(null);

    // Toasts
    const [toasts, setToasts] = useState<Toast[]>([]);
    const toast = (msg: string, ok = true) => {
        const id = Date.now();
        setToasts(p => [...p, { id, msg, ok }]);
        setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    };

    const load = useCallback(async () => {
        try {
            const [cRes, tRes] = await Promise.all([
                api.get('/campaigns'),
                api.get('/tags'),
            ]);
            setCampaigns(Array.isArray(cRes.data) ? cRes.data : []);
            setTags(Array.isArray(tRes.data) ? tRes.data : []);
        } catch {
            // error handled by empty state
        }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleExpand = (id: string) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const openCreate = () => {
        setEditingCampaign(null);
        setPanelError('');
        setPanelOpen(true);
    };

    const openEdit = (c: Campaign) => {
        setEditingCampaign(c);
        setPanelError('');
        setPanelOpen(true);
    };

    const handleSave = async (f: { name: string; description: string }) => {
        setPanelSaving(true);
        setPanelError('');
        try {
            if (editingCampaign) {
                const res = await api.patch(`/campaigns/${editingCampaign.id}`, f);
                setCampaigns(p => p.map(c => c.id === editingCampaign.id ? res.data : c));
                toast('Campaign updated');
            } else {
                const res = await api.post('/campaigns', f);
                setCampaigns(p => [res.data, ...p]);
                setExpandedIds(prev => new Set([...prev, res.data.id]));
                toast('Campaign created');
            }
            setPanelOpen(false);
        } catch (err: any) {
            setPanelError(err.response?.data?.message || 'Failed to save');
        } finally {
            setPanelSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this campaign and all its segments?')) return;
        try {
            await api.delete(`/campaigns/${id}`);
            setCampaigns(p => p.filter(c => c.id !== id));
            toast('Campaign deleted');
        } catch {
            toast('Failed to delete', false);
        }
    };

    const handleSegmentCreated = (campaignId: string, seg: AudienceSegment) => {
        setCampaigns(p => p.map(c => c.id === campaignId ? { ...c, segments: [...c.segments, seg] } : c));
    };

    const handleSegmentDeleted = (campaignId: string, segId: string) => {
        setCampaigns(p => p.map(c => c.id === campaignId ? { ...c, segments: c.segments.filter(s => s.id !== segId) } : c));
    };

    const demoCampaigns = campaigns.filter(c => c.name.toLowerCase().includes('demo') || c.description?.toLowerCase().includes('demo'));

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Icon icon={faBullhorn} className="text-primary text-[22px]" /> Campaigns
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        Organise reminder workflows into campaigns with targeted audience segments
                        <HelpTip text="A campaign groups related reminder workflows. Each campaign can have multiple audience segments — linked to contact tags — so you can target the right people at the right time." placement="bottom" maxWidth={280} />
                    </p>
                </div>
                <button onClick={openCreate} className="btn btn-primary w-full md:w-auto">
                    <Icon icon={faPlus} /> New Campaign
                </button>
            </div>

            <FeatureBanner
                src="/images/features/reminders.jpg"
                title="Campaign Audience Engine"
                description="Create campaigns with audience segments. Target contacts by tag, dispatch to hundreds of recipients via BullMQ queues, and track delivery across SMS, WhatsApp, Email and Voice."
                accent="var(--primary)"
            />

            {/* Demo data notice */}
            {demoCampaigns.length > 0 && (
                <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '12px 16px', borderRadius: 10, marginBottom: 20,
                    background: 'rgba(247, 148, 29, 0.08)', border: '1px solid rgba(247, 148, 29, 0.3)',
                    fontSize: 13, color: 'var(--warning)',
                }}>
                    <Icon icon={faCircleInfo} className="shrink-0 mt-[1px]" />
                    <span>
                        <strong>Demo data:</strong> The <em>Startup Masterclass</em> campaign was generated automatically so you can explore the system. You can delete it anytime.
                    </span>
                </div>
            )}

            {/* Stats row */}
            {campaigns.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 24 }}>
                    {[
                        { label: 'Campaigns', value: campaigns.length, color: 'var(--primary)' },
                        { label: 'Segments', value: campaigns.reduce((n, c) => n + c.segments.length, 0), color: '#8b5cf6' },
                        { label: 'Tags', value: tags.length, color: 'var(--success)' },
                        { label: 'Active', value: campaigns.filter(c => c.status === 'ACTIVE').length, color: 'var(--warning)' },
                    ].map(s => (
                        <div key={s.label} className="card" style={{ padding: '14px 18px' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Campaign list */}
            {loading ? (
                <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : campaigns.length === 0 ? (
                <div className="glass-card" style={{ padding: 'clamp(28px, 5vw, 48px)', textAlign: 'center' }}>
                    <div style={{ fontSize: 44, marginBottom: 16, color: 'var(--text-muted)' }}><Icon icon={faBullhorn} /></div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>No campaigns yet</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 24px' }}>
                        Campaigns organise your reminder workflows. Create your first campaign, add audience segments,
                        and dispatch messages to hundreds of contacts automatically.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 24, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-muted)' }}>
                        {['Create Campaign', '→', 'Add Segments', '→', 'Link Tags', '→', 'Dispatch'].map((s, i) => (
                            <span key={i} style={{ fontWeight: s === '→' ? 400 : 600, color: s === '→' ? 'var(--text-muted)' : 'var(--text-secondary)' }}>{s}</span>
                        ))}
                    </div>
                    <button onClick={openCreate} className="btn btn-primary">
                        <Icon icon={faPlus} /> Create First Campaign
                    </button>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {campaigns.map(campaign => (
                        <CampaignCard
                            key={campaign.id}
                            campaign={campaign}
                            tags={tags}
                            expanded={expandedIds.has(campaign.id)}
                            onToggle={() => toggleExpand(campaign.id)}
                            onEdit={() => openEdit(campaign)}
                            onDelete={() => handleDelete(campaign.id)}
                            onSegmentCreated={seg => handleSegmentCreated(campaign.id, seg)}
                            onSegmentDeleted={segId => handleSegmentDeleted(campaign.id, segId)}
                            onDispatch={() => setDispatchTarget(campaign)}
                            onFollowUp={(status) => setFollowUpTarget({ campaign, status })}
                            toast={toast}
                        />
                    ))}
                </div>
            )}

            {/* How it works footer */}
            {campaigns.length > 0 && (
                <div className="glass-card" style={{ padding: '16px 22px', marginTop: 20, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <Icon icon={faCircleInfo} className="text-primary text-[18px] shrink-0 mt-[2px]" />
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.65 }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>How it works:</strong>{' '}
                        Each campaign holds audience segments. A segment is linked to a <Icon icon={faTag} /> <strong>tag</strong> — when you dispatch,
                        all contacts with that tag receive the message via the chosen channel. Audiences of 100+ contacts are queued in the background via BullMQ.
                    </div>
                </div>
            )}

            {/* Create / Edit Campaign slide panel */}
            <SlidePanel
                open={panelOpen}
                title={editingCampaign ? `Edit: ${editingCampaign.name}` : 'New Campaign'}
                subtitle={editingCampaign ? undefined : 'Group your reminder workflows into a named campaign'}
                onClose={() => setPanelOpen(false)}
            >
                <CampaignForm
                    initial={{ name: editingCampaign?.name ?? '', description: editingCampaign?.description ?? '' }}
                    onSave={handleSave}
                    onCancel={() => setPanelOpen(false)}
                    saving={panelSaving}
                    error={panelError}
                />
            </SlidePanel>

            {/* Dispatch modal */}
            {dispatchTarget && (
                <DispatchModal
                    campaign={dispatchTarget}
                    tags={tags}
                    onClose={() => setDispatchTarget(null)}
                    onSuccess={msg => { setDispatchTarget(null); toast(msg); }}
                />
            )}

            {/* Follow-up modal */}
            {followUpTarget && (
                <FollowUpModal
                    campaign={followUpTarget.campaign}
                    initialStatus={followUpTarget.status}
                    onClose={() => setFollowUpTarget(null)}
                    onSuccess={msg => toast(msg)}
                />
            )}

            {/* Toasts */}
            <ToastStack toasts={toasts} dismiss={id => setToasts(p => p.filter(t => t.id !== id))} />
        </div>
    );
}
