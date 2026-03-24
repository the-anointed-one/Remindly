'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import FeatureBanner from '@/components/FeatureBanner';
import Icon from '@/components/ui/Icon';
import { faComment, faPhone, faEnvelope, faBullhorn, faClock, faBell, faCalendar, faCog, faCheck, faInfoCircle } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { HelpTip, Tooltip } from '@/components/ui/Tooltip';
import TooltipField from '@/components/ui/TooltipField';

// ── Types ─────────────────────────────────────

interface Template {
    id: string;
    name: string;
    channel: string;
    body: string;
}

interface ReminderRule {
    id: string;
    name: string;
    channel: 'SMS' | 'VOICE' | 'EMAIL' | 'WHATSAPP';
    offsetMinutes: number;
    messageTemplate: string | null;
    isActive: boolean;
    isDemoData?: boolean;
    templateId: string | null;
    template: { id: string; name: string; body: string } | null;
    createdAt: string;
}

// ── Helpers ───────────────────────────────────

function offsetLabel(min: number): string {
    if (min >= 1440) {
        const d = Math.floor(min / 1440);
        const h = Math.floor((min % 1440) / 60);
        return h > 0 ? `${d}d ${h}h before` : `${d} day${d !== 1 ? 's' : ''} before`;
    }
    if (min >= 60) {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return m > 0 ? `${h}h ${m}m before` : `${h} hour${h !== 1 ? 's' : ''} before`;
    }
    return `${min} min${min !== 1 ? 's' : ''} before`;
}

function channelColor(ch: string): string {
    const map: Record<string, string> = {
        SMS: '#3b82f6',
        VOICE: '#8b5cf6',
        EMAIL: '#f59e0b',
        WHATSAPP: '#22c55e',
    };
    return map[ch] ?? '#64748b';
}

function channelIcon(ch: string): React.ReactNode {
    const map: Record<string, React.ReactNode> = {
        SMS: <Icon icon={faComment} />,
        VOICE: <Icon icon={faPhone} />,
        EMAIL: <Icon icon={faEnvelope} />,
        WHATSAPP: <Icon icon={faWhatsapp} />
    };
    return map[ch] ?? <Icon icon={faBullhorn} />;
}

// ── Timing presets ────────────────────────────

const PRESETS = [
    { label: '48h before', minutes: 2880 },
    { label: '24h before', minutes: 1440 },
    { label: '12h before', minutes: 720 },
    { label: '4h before', minutes: 240 },
    { label: '2h before', minutes: 120 },
    { label: '1h before', minutes: 60 },
    { label: '30m before', minutes: 30 },
];

// ── Message variables reference ───────────────

const VARS = ['{{customer_name}}', '{{appointment_title}}', '{{appointment_time}}', '{{appointment_date}}'];

// ── Rule Form ─────────────────────────────────

interface RuleFormState {
    name: string;
    channel: string;
    offsetMinutes: number;
    customOffsetValue: string;
    customOffsetUnit: 'minutes' | 'hours' | 'days';
    messageTemplate: string;
    templateId: string;
    isActive: boolean;
}

const DEFAULT_FORM: RuleFormState = {
    name: '',
    channel: 'SMS',
    offsetMinutes: 1440,
    customOffsetValue: '24',
    customOffsetUnit: 'hours',
    messageTemplate: '',
    templateId: '',
    isActive: true,
};

function RuleForm({
    initial,
    templates,
    onSave,
    onCancel,
    saving,
    error,
}: {
    initial: RuleFormState;
    templates: Template[];
    onSave: (f: RuleFormState) => void;
    onCancel: () => void;
    saving: boolean;
    error: string;
}) {
    const [f, setF] = useState<RuleFormState>(initial);
    const [usePreset, setUsePreset] = useState(true);
    const [msgMode, setMsgMode] = useState<'inline' | 'template' | 'default'>(
        initial.messageTemplate ? 'inline' : initial.templateId ? 'template' : 'default',
    );

    const set = (key: keyof RuleFormState, val: any) => setF((prev) => ({ ...prev, [key]: val }));

    const resolvedMinutes = usePreset
        ? f.offsetMinutes
        : (() => {
            const n = parseInt(f.customOffsetValue, 10) || 1;
            if (f.customOffsetUnit === 'days') return n * 1440;
            if (f.customOffsetUnit === 'hours') return n * 60;
            return n;
        })();

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: RuleFormState = {
            ...f,
            offsetMinutes: resolvedMinutes,
            messageTemplate: msgMode === 'inline' ? f.messageTemplate : '',
            templateId: msgMode === 'template' ? f.templateId : '',
        };
        onSave(payload);
    };

    const insertVar = (v: string) => {
        set('messageTemplate', (f.messageTemplate ? f.messageTemplate + ' ' : '') + v);
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {error && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171', fontSize: 13 }}>
                    {error}
                </div>
            )}

            {/* Name */}
            <TooltipField label="Rule name" tooltip="A descriptive name for this reminder automation logic.">
                <input
                    value={f.name} onChange={(e) => set('name', e.target.value)}
                    placeholder="e.g. 24h SMS reminder" required
                    style={inputStyle}
                />
            </TooltipField>

            {/* Channel */}
            <div>
                <label style={labelStyle}>
                    Channel{' '}
                    <HelpTip
                        text="Choose how reminders are delivered. SMS works for all phones. WhatsApp sends to the customer's WhatsApp number. Voice calls and reads the message aloud. Email delivers to their inbox."
                        placement="top"
                        maxWidth={280}
                    />
                </label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {([
                        { ch: 'SMS', tip: 'SMS reminders are delivered to any mobile number — no internet required.' },
                        { ch: 'VOICE', tip: 'Voice reminders call the customer and read the appointment details aloud.' },
                        { ch: 'EMAIL', tip: 'Email reminders are sent to the customer\'s email address.' },
                        { ch: 'WHATSAPP', tip: 'WhatsApp reminders send messages directly to your customer\'s WhatsApp number.' },
                    ] as const).map(({ ch, tip }) => (
                        <Tooltip key={ch} content={tip} placement="top" maxWidth={220}>
                            <button
                                type="button"
                                onClick={() => set('channel', ch)}
                                style={{
                                    flex: '1 1 60px', padding: '10px 8px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: 44,
                                    background: f.channel === ch ? `${channelColor(ch)}20` : 'var(--bg-secondary)',
                                    border: `1px solid ${f.channel === ch ? channelColor(ch) + '60' : 'var(--border)'}`,
                                    color: f.channel === ch ? channelColor(ch) : 'var(--text-muted)',
                                }}
                            >
                                {channelIcon(ch)} {ch}
                            </button>
                        </Tooltip>
                    ))}
                </div>
            </div>

            {/* Timing */}
            <TooltipField label="Send timing" tooltip="How far in advance the reminder should automatically trigger.">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {PRESETS.map((p) => (
                        <button
                            key={p.minutes} type="button"
                            onClick={() => { setUsePreset(true); set('offsetMinutes', p.minutes); }}
                            style={{
                                padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                background: usePreset && f.offsetMinutes === p.minutes ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)',
                                border: `1px solid ${usePreset && f.offsetMinutes === p.minutes ? 'rgba(59,130,246,0.5)' : 'var(--border)'}`,
                                color: usePreset && f.offsetMinutes === p.minutes ? '#60a5fa' : 'var(--text-muted)',
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setUsePreset(false)}
                        style={{
                            padding: '5px 12px', borderRadius: 100, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                            background: !usePreset ? 'rgba(59,130,246,0.15)' : 'var(--bg-secondary)',
                            border: `1px solid ${!usePreset ? 'rgba(59,130,246,0.5)' : 'var(--border)'}`,
                            color: !usePreset ? '#60a5fa' : 'var(--text-muted)',
                        }}
                    >
                        Custom
                    </button>
                </div>
                {!usePreset && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                            type="number" min={1} value={f.customOffsetValue}
                            onChange={(e) => set('customOffsetValue', e.target.value)}
                            style={{ ...inputStyle, width: 80, flex: '0 0 80px' }}
                        />
                        <select value={f.customOffsetUnit} onChange={(e) => set('customOffsetUnit', e.target.value as any)}
                            style={{ ...inputStyle, flex: '1 1 100px', minWidth: 100 }}>
                            <option value="minutes">minutes</option>
                            <option value="hours">hours</option>
                            <option value="days">days</option>
                        </select>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>before</span>
                    </div>
                )}
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                    Will send <strong style={{ color: 'var(--text-secondary)' }}>{offsetLabel(resolvedMinutes)}</strong> each appointment
                </div>
            </TooltipField>

            {/* Message */}
            <TooltipField label="Message" tooltip="The automated alert content payload. Variables inject specific customer details.">
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                    {(['default', 'inline', 'template'] as const).map((m) => (
                        <button
                            key={m} type="button"
                            onClick={() => setMsgMode(m)}
                            style={{
                                padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                background: msgMode === m ? 'rgba(139,92,246,0.12)' : 'var(--bg-secondary)',
                                border: `1px solid ${msgMode === m ? 'rgba(139,92,246,0.4)' : 'var(--border)'}`,
                                color: msgMode === m ? '#a78bfa' : 'var(--text-muted)',
                            }}
                        >
                            {m === 'default' ? 'Default' : m === 'inline' ? 'Custom message' : 'Use template'}
                        </button>
                    ))}
                </div>

                {msgMode === 'default' && (
                    <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Hi {'{{customer_name}}'}, reminder: "{'{{appointment_title}}'}" on {'{{appointment_date}}'} at {'{{appointment_time}}'}.<br />
                        Reply: 1 Confirm · 2 Reschedule · 3 Cancel
                    </div>
                )}

                {msgMode === 'inline' && (
                    <div>
                        <textarea
                            value={f.messageTemplate}
                            onChange={(e) => set('messageTemplate', e.target.value)}
                            placeholder="Hi {{customer_name}}, your {{appointment_title}} is on {{appointment_date}}..."
                            rows={4}
                            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: 16 }}
                        />
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                            {VARS.map((v) => (
                                <button
                                    key={v} type="button"
                                    onClick={() => insertVar(v)}
                                    style={{
                                        padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
                                        color: '#a5b4fc',
                                    }}
                                >
                                    {v}
                                </button>
                            ))}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                            {f.messageTemplate.length} / 1600 chars
                        </div>
                    </div>
                )}

                {msgMode === 'template' && (
                    <select
                        value={f.templateId}
                        onChange={(e) => set('templateId', e.target.value)}
                        style={inputStyle}
                    >
                        <option value="">— Select a template —</option>
                        {templates.filter((t) => !f.channel || t.channel === f.channel).map((t) => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                        {templates.filter((t) => !f.channel || t.channel === f.channel).length === 0 && (
                            <option disabled>No {f.channel} templates found</option>
                        )}
                    </select>
                )}
            </TooltipField>

            {/* Active toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                <span>Active — applies to all new appointments</span>
                <HelpTip
                    text="When enabled, this rule will automatically schedule a reminder for every new appointment. Disable it to pause without deleting the rule."
                    placement="top"
                    maxWidth={260}
                />
            </label>

            {/* Actions */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3" style={{ paddingTop: 4 }}>
                <button type="button" onClick={onCancel} className="btn btn-outline w-full sm:w-auto">
                    Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary w-full sm:w-auto">
                    {saving ? 'Saving…' : 'Save Rule'}
                </button>
            </div>
        </form>
    );
}

// ── Rule Card ─────────────────────────────────

function RuleCard({
    rule,
    templates,
    onToggle,
    onDelete,
    onEdit,
}: {
    rule: ReminderRule;
    templates: Template[];
    onToggle: (id: string, active: boolean) => void;
    onDelete: (id: string) => void;
    onEdit: (rule: ReminderRule) => void;
}) {
    const color = channelColor(rule.channel);
    const msgPreview = rule.messageTemplate
        ? rule.messageTemplate.slice(0, 100) + (rule.messageTemplate.length > 100 ? '…' : '')
        : rule.template
            ? `Template: ${rule.template.name}`
            : 'Default message';

    return (
        <div style={{
            border: `1px solid ${rule.isActive ? color + '35' : 'var(--border)'}`,
            borderRadius: 14,
            padding: '20px 22px',
            background: rule.isActive ? `${color}06` : 'var(--bg-secondary)',
            opacity: rule.isActive ? 1 : 0.65,
            position: 'relative',
            overflow: 'hidden',
            transition: 'border-color 200ms, opacity 200ms',
        }}>
            {/* top accent */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: rule.isActive ? `linear-gradient(90deg, ${color}, transparent)` : 'transparent' }} />

            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 18 }}>{channelIcon(rule.channel)}</span>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{rule.name}</span>
                        {rule.isDemoData && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px' }}>
                                DEMO
                            </span>
                        )}
                        {!rule.isActive && (
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 6px' }}>
                                INACTIVE
                            </span>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
                        <span style={{
                            fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 100,
                            background: `${color}15`, border: `1px solid ${color}35`, color, display: 'flex', alignItems: 'center', gap: 6
                        }}>
                            <Icon icon={faClock} /> {offsetLabel(rule.offsetMinutes)}
                        </span>
                        <span style={{
                            fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 100,
                            background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)',
                        }}>
                            {rule.channel}
                        </span>
                    </div>

                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {msgPreview}
                    </div>
                </div>

                <div className="flex flex-row sm:flex-col items-center sm:items-stretch gap-2 sm:gap-6 mt-3 sm:mt-0 flex-wrap">
                    {/* Active toggle */}
                    <button
                        onClick={() => onToggle(rule.id, !rule.isActive)}
                        title={rule.isActive ? 'Disable rule' : 'Enable rule'}
                        style={{
                            width: 36, height: 20, borderRadius: 100, cursor: 'pointer',
                            background: rule.isActive ? color : 'var(--border)',
                            border: 'none', position: 'relative', transition: 'background 200ms',
                        }}
                    >
                        <span style={{
                            position: 'absolute', top: 2, left: rule.isActive ? 18 : 2,
                            width: 16, height: 16, borderRadius: '50%',
                            background: '#fff', transition: 'left 200ms',
                        }} />
                    </button>

                    <button
                        onClick={() => onEdit(rule)}
                        style={{ padding: '5px 14px', borderRadius: 7, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                        Edit
                    </button>
                    <button
                        onClick={() => onDelete(rule.id)}
                        style={{ padding: '5px 14px', borderRadius: 7, background: 'none', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Shared styles ─────────────────────────────

const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 8,
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
    color: 'var(--text-primary)', fontSize: 16, boxSizing: 'border-box',
    minHeight: 44,
};

// ── Main page ─────────────────────────────────

export default function RemindersPage() {
    const [rules, setRules] = useState<ReminderRule[]>([]);
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const isMounted = useRef(true);

    useEffect(() => {
        return () => {
            isMounted.current = false;
        };
    }, []);
    const [editingRule, setEditingRule] = useState<ReminderRule | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const load = useCallback(async () => {
        if (process.env.NODE_ENV !== 'production') console.debug('[RemindersPage] load triggered');
        setLoading(true);
        setFetchError('');
        try {
            const [rulesRes, tplRes] = await Promise.all([
                api.get('/reminder-rules'),
                api.get('/templates').catch(() => ({ data: [] })),
            ]);
            if (!isMounted.current) return;
            setRules(Array.isArray(rulesRes.data) ? rulesRes.data : []);
            setTemplates(Array.isArray(tplRes.data?.data) ? tplRes.data.data : Array.isArray(tplRes.data) ? tplRes.data : []);
        } catch (err: any) {
            if (!isMounted.current) return;
            setFetchError(err.response?.data?.message || 'Failed to load reminder rules');
            setRules([]);
            setTemplates([]);
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleSave = async (f: RuleFormState) => {
        setSaving(true);
        setFormError('');
        try {
            const basePayload = {
                name: f.name,
                channel: f.channel,
                offsetMinutes: f.offsetMinutes,
                messageTemplate: f.messageTemplate || undefined,
                templateId: f.templateId || undefined,
            };
            if (editingRule) {
                await api.put(`/reminder-rules/${editingRule.id}`, { ...basePayload, isActive: f.isActive });
            } else {
                await api.post('/reminder-rules', basePayload);
            }
            setShowForm(false);
            setEditingRule(null);
            await load();
        } catch (err: any) {
            setFormError(err.response?.data?.message || 'Failed to save rule');
        } finally {
            setSaving(false);
        }
    };

    const handleToggle = async (id: string, active: boolean) => {
        await api.put(`/reminder-rules/${id}`, { isActive: active });
        setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: active } : r));
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this reminder rule? It will no longer apply to new appointments.')) return;
        await api.delete(`/reminder-rules/${id}`);
        setRules((prev) => prev.filter((r) => r.id !== id));
    };

    const handleEdit = (rule: ReminderRule) => {
        setEditingRule(rule);
        setShowForm(true);
        setFormError('');
    };

    const editInitial = editingRule ? {
        name: editingRule.name,
        channel: editingRule.channel,
        offsetMinutes: editingRule.offsetMinutes,
        customOffsetValue: String(Math.floor(editingRule.offsetMinutes / 60) || editingRule.offsetMinutes),
        customOffsetUnit: editingRule.offsetMinutes >= 1440 ? 'days' as const : editingRule.offsetMinutes >= 60 ? 'hours' as const : 'minutes' as const,
        messageTemplate: editingRule.messageTemplate ?? '',
        templateId: editingRule.templateId ?? '',
        isActive: editingRule.isActive,
    } : DEFAULT_FORM;

    const active = rules.filter((r) => r.isActive);
    const channelCounts = rules.reduce((acc, r) => { acc[r.channel] = (acc[r.channel] || 0) + 1; return acc; }, {} as Record<string, number>);

    return (
        <div>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 24 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2 }}>Reminder Rules</h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                        Define when and how reminders are sent for every appointment
                    </p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => { setShowForm(true); setEditingRule(null); setFormError(''); }}
                        className="btn btn-primary w-full md:w-auto"
                    >
                        + Add Rule
                    </button>
                )}
            </div>

            {fetchError && (
                <div style={{ marginBottom: 18, padding: '14px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: '#b91c1c' }}>
                    {fetchError}
                </div>
            )}

            <FeatureBanner
                src="/images/features/reminder-workflow.jpg"
                title="Reminder Workflow Engine"
                description="Create rules that automatically send appointment reminders via SMS, WhatsApp, Voice, or Email. Set timing offsets, custom templates, and multi-channel failover per rule."
                accent="#0ea5e9"
            />

            {/* Clarity callout: explain global rules vs per-appointment inline reminders */}
            <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 18px',
                background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 12, marginBottom: 24, marginTop: 4,
            }}>
                <span style={{ fontSize: 18, color: '#60a5fa', flexShrink: 0, marginTop: 2 }}>
                    <Icon icon={faInfoCircle} />
                </span>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                    <strong style={{ color: 'var(--text-secondary)' }}>Reminder Rules are global templates.</strong>{' '}
                    They automatically apply to every new appointment you create. To view the reminder
                    history for a specific appointment, open that appointment&apos;s detail page.
                </div>
            </div>

            {/* Stats */}
            {rules.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <div className="card" style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#3b82f6' }}>{rules.length}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Total rules</div>
                    </div>
                    <div className="card" style={{ padding: '14px 18px' }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{active.length}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Active</div>
                    </div>
                    {Object.entries(channelCounts).map(([ch, count]) => (
                        <div key={ch} className="card" style={{ padding: '14px 18px' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, color: channelColor(ch) }}>{count}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{ch}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Execution flow explanation */}
            {rules.length === 0 && !showForm && !loading && (
                <div className="glass-card" style={{ padding: 'clamp(24px, 5vw, 40px)', textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 42, marginBottom: 16, color: 'var(--text-muted)' }}><Icon icon={faBell} /></div>
                    <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>No reminder rules yet</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.7, maxWidth: 400, margin: '0 auto 20px' }}>
                        Rules define when reminders are sent. Create your first rule and every new appointment will automatically trigger the right reminders.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                        {[
                            { label: 'Appointment created', icon: <Icon icon={faCalendar} /> },
                            { label: 'Rules evaluated', icon: <Icon icon={faCog} /> },
                            { label: 'Jobs scheduled', icon: <Icon icon={faEnvelope} /> },
                            { label: 'Reminders sent', icon: <Icon icon={faCheck} className="text-success" /> },
                        ].map((step, i, arr) => (
                            <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 22, marginBottom: 4 }}>{step.icon}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{step.label}</div>
                                </div>
                                {i < arr.length - 1 && (
                                    <span style={{ color: 'var(--text-muted)', fontSize: 18, margin: '0 2px' }}>→</span>
                                )}
                            </div>
                        ))}
                    </div>
                    <button
                        onClick={() => { setShowForm(true); setEditingRule(null); }}
                        className="btn btn-primary"
                    >
                        Create First Rule
                    </button>
                </div>
            )}

            {/* Form modal */}
            {showForm && (
                <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                        <h2 style={{ fontSize: 17, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {editingRule ? `Edit: ${editingRule.name}` : 'New Reminder Rule'}
                            <HelpTip
                                text="A reminder rule defines when and how a message is sent before an appointment. Each rule runs automatically for every new appointment you create."
                                placement="bottom"
                                maxWidth={270}
                            />
                        </h2>
                    </div>
                    <RuleForm
                        initial={editInitial}
                        templates={templates}
                        onSave={handleSave}
                        onCancel={() => { setShowForm(false); setEditingRule(null); setFormError(''); }}
                        saving={saving}
                        error={formError}
                    />
                </div>
            )}

            {/* Rules list */}
            {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
            ) : rules.length > 0 && (
                <div>
                    {/* Group by channel */}
                    {(['SMS', 'WHATSAPP', 'VOICE', 'EMAIL'] as const).map((ch) => {
                        const group = rules.filter((r) => r.channel === ch);
                        if (group.length === 0) return null;
                        return (
                            <div key={ch} style={{ marginBottom: 28 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                    <span style={{ fontSize: 16 }}>{channelIcon(ch)}</span>
                                    <h2 style={{ fontSize: 14, fontWeight: 700, color: channelColor(ch) }}>{ch}</h2>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {group.length} rule{group.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))', gap: 14 }}>
                                    {group
                                        .sort((a, b) => a.offsetMinutes - b.offsetMinutes)
                                        .map((rule) => (
                                            <RuleCard
                                                key={rule.id}
                                                rule={rule}
                                                templates={templates}
                                                onToggle={handleToggle}
                                                onDelete={handleDelete}
                                                onEdit={handleEdit}
                                            />
                                        ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* How it works */}
            {rules.length > 0 && (
                <div className="glass-card" style={{ padding: '20px 24px', marginTop: 8, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 24, color: '#3b82f6' }}><Icon icon={faInfoCircle} /></span>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                        Active rules automatically apply to every new appointment. Disable a rule to stop it from being applied going forward.
                        Rules use <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 4 }}>{'{{customer_name}}'}</code>,{' '}
                        <code style={{ background: 'var(--bg-secondary)', padding: '1px 5px', borderRadius: 4 }}>{'{{appointment_title}}'}</code>, and other variables.
                    </div>
                </div>
            )}
        </div>
    );
}
