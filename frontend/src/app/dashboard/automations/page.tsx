'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/EmptyState';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faCheck, faTimes, faFlagCheckered, faStar, faMoon, faBolt, faComment, faMobileAlt, faPhone, faEnvelope, faRobot, faTag, faPlay, faChartBar, faMousePointer } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

// ── Types ────────────────────────────────────

interface WorkflowTrigger {
    type: string;
    config: Record<string, unknown>;
}

interface WorkflowCondition {
    conditionType: string;
    operator: string;
    value: string;
    actionId?: string;
}

interface WorkflowAction {
    id?: string;
    stepOrder: number;
    type: string;
    config: Record<string, unknown>;
    delayMinutes: number;
    conditions: WorkflowCondition[];
}

interface Workflow {
    id: string;
    name: string;
    description?: string;
    isActive: boolean;
    trigger: WorkflowTrigger;
    actions: WorkflowAction[];
    _count?: { executions: number };
    createdAt: string;
}

interface Execution {
    id: string;
    status: string;
    triggerType: string;
    actionsRun: number;
    actionsSkipped: number;
    error?: string;
    startedAt: string;
    completedAt?: string;
}

// ── Constants ────────────────────────────────

const TRIGGER_OPTIONS = [
    { value: 'appointment_created', label: 'Appointment Booked', icon: <Icon icon={faCalendar} /> },
    { value: 'appointment_confirmed', label: 'Appointment Confirmed', icon: <Icon icon={faCheck} /> },
    { value: 'appointment_cancelled', label: 'Appointment Cancelled', icon: <Icon icon={faTimes} /> },
    { value: 'appointment_completed', label: 'Appointment Completed', icon: <Icon icon={faFlagCheckered} /> },
    { value: 'review_received', label: 'Review Received', icon: <Icon icon={faStar} /> },
    { value: 'client_inactive', label: 'Client Inactive', icon: <Icon icon={faMoon} /> },
];

const ACTION_OPTIONS = [
    { value: 'send_sms', label: 'Send SMS', icon: <Icon icon={faComment} />, color: '#22c55e' },
    { value: 'send_whatsapp', label: 'Send WhatsApp', icon: <Icon icon={faWhatsapp} />, color: '#25d366' },
    { value: 'send_voice', label: 'Send Voice Call', icon: <Icon icon={faPhone} />, color: '#3b82f6' },
    { value: 'send_email', label: 'Send Email', icon: <Icon icon={faEnvelope} />, color: '#6366f1' },
    { value: 'generate_ai_message', label: 'Generate AI Message', icon: <Icon icon={faRobot} />, color: '#a855f7' },
    { value: 'request_review', label: 'Request Review', icon: <Icon icon={faStar} />, color: '#f59e0b' },
    { value: 'add_tag', label: 'Add Tag', icon: <Icon icon={faTag} />, color: '#06b6d4' },
];

const CONDITION_OPTIONS = [
    { value: 'appointment_status_is', label: 'Appointment status is' },
    { value: 'customer_tag_has', label: 'Customer tag' },
    { value: 'customer_unsubscribed', label: 'Customer unsubscribed' },
    { value: 'time_of_day_between', label: 'Time of day between' },
];

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
    appointment_status_is: [
        { value: 'equals', label: 'equals' },
        { value: 'not_equals', label: 'does not equal' },
    ],
    customer_tag_has: [
        { value: 'has', label: 'has tag' },
        { value: 'not_has', label: 'does not have tag' },
    ],
    customer_unsubscribed: [
        { value: 'equals', label: 'is' },
    ],
    time_of_day_between: [
        { value: 'between', label: 'between' },
        { value: 'outside', label: 'outside' },
    ],
};

// ── Helpers ──────────────────────────────────

function getTriggerOption(type: string) {
    return TRIGGER_OPTIONS.find((t) => t.value === type) ?? { value: type, label: type, icon: <Icon icon={faBolt} /> };
}

function getActionOption(type: string) {
    return ACTION_OPTIONS.find((a) => a.value === type) ?? { value: type, label: type, icon: <Icon icon={faPlay} />, color: '#6b7280' };
}

function newBlankAction(stepOrder: number): WorkflowAction {
    return { stepOrder, type: 'send_sms', config: {}, delayMinutes: 0, conditions: [] };
}

function StatusBadge({ status }: { status: string }) {
    const map: Record<string, { bg: string; color: string }> = {
        RUNNING: { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
        COMPLETED: { bg: 'rgba(34,197,94,0.1)', color: '#4ade80' },
        FAILED: { bg: 'rgba(239,68,68,0.12)', color: '#f87171' },
        SKIPPED: { bg: 'rgba(107,114,128,0.12)', color: '#9ca3af' },
    };
    const s = map[status] ?? map.SKIPPED;
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
            background: s.bg, color: s.color,
        }}>
            {status}
        </span>
    );
}

// ── Action Config Fields ──────────────────────

function ActionConfigFields({
    action,
    onChange,
}: {
    action: WorkflowAction;
    onChange: (updated: WorkflowAction) => void;
}) {
    const cfg = action.config;
    const set = (key: string, val: unknown) =>
        onChange({ ...action, config: { ...cfg, [key]: val } });

    const textAreaStyle: React.CSSProperties = {
        width: '100%', padding: '8px 10px', borderRadius: 8, resize: 'vertical',
        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: 13, minHeight: 80,
        boxSizing: 'border-box',
    };
    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '8px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', fontSize: 13,
        boxSizing: 'border-box',
    };
    const hint = (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Use <code style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '0 3px' }}>
                {'{{customer_name}}'}
            </code>, <code style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '0 3px' }}>
                {'{{appointment_title}}'}
            </code>, <code style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '0 3px' }}>
                {'{{scheduled_at}}'}
            </code>
        </p>
    );

    switch (action.type) {
        case 'send_sms':
        case 'send_whatsapp':
        case 'send_voice':
            return (
                <div>
                    <label className="input-label">Message</label>
                    <textarea
                        style={textAreaStyle}
                        value={String(cfg.message ?? '')}
                        onChange={(e) => set('message', e.target.value)}
                        placeholder="Hi {{customer_name}}, your appointment is confirmed!"
                    />
                    {hint}
                </div>
            );
        case 'send_email':
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                        <label className="input-label">Subject</label>
                        <input
                            style={inputStyle}
                            value={String(cfg.subject ?? '')}
                            onChange={(e) => set('subject', e.target.value)}
                            placeholder="Appointment Confirmation"
                        />
                    </div>
                    <div>
                        <label className="input-label">Message</label>
                        <textarea
                            style={textAreaStyle}
                            value={String(cfg.message ?? '')}
                            onChange={(e) => set('message', e.target.value)}
                            placeholder="Hi {{customer_name}}, your appointment for {{appointment_title}} is confirmed."
                        />
                        {hint}
                    </div>
                </div>
            );
        case 'request_review':
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                        <label className="input-label">Platform</label>
                        <select
                            style={{ ...inputStyle, cursor: 'pointer' }}
                            value={String(cfg.platform ?? 'google')}
                            onChange={(e) => set('platform', e.target.value)}
                        >
                            <option value="google">Google</option>
                            <option value="trustpilot">Trustpilot</option>
                            <option value="yelp">Yelp</option>
                            <option value="facebook">Facebook</option>
                        </select>
                    </div>
                    <div>
                        <label className="input-label">Custom Message (optional)</label>
                        <textarea
                            style={textAreaStyle}
                            value={String(cfg.message ?? '')}
                            onChange={(e) => set('message', e.target.value)}
                            placeholder="Hi {{customer_name}}, we'd love your review!"
                        />
                        {hint}
                    </div>
                </div>
            );
        case 'add_tag':
            return (
                <div>
                    <label className="input-label">Tag Name</label>
                    <input
                        style={inputStyle}
                        value={String(cfg.tag ?? '')}
                        onChange={(e) => set('tag', e.target.value)}
                        placeholder="e.g. vip, follow-up-needed"
                    />
                </div>
            );
        case 'generate_ai_message':
            return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div>
                        <label className="input-label">Channel</label>
                        <select
                            style={{ ...inputStyle, cursor: 'pointer' }}
                            value={String(cfg.channel ?? 'SMS')}
                            onChange={(e) => set('channel', e.target.value)}
                        >
                            <option value="SMS">SMS</option>
                            <option value="WHATSAPP">WhatsApp</option>
                            <option value="EMAIL">Email</option>
                        </select>
                    </div>
                    <div>
                        <label className="input-label">Prompt / Template</label>
                        <textarea
                            style={textAreaStyle}
                            value={String(cfg.prompt ?? '')}
                            onChange={(e) => set('prompt', e.target.value)}
                            placeholder="Generate a friendly follow-up message for {{customer_name}} after their {{appointment_title}} appointment."
                        />
                        {hint}
                    </div>
                </div>
            );
        default:
            return null;
    }
}

// ── Condition Builder ─────────────────────────

function ConditionBuilder({
    conditions,
    onChange,
}: {
    conditions: WorkflowCondition[];
    onChange: (updated: WorkflowCondition[]) => void;
}) {
    const addCondition = () =>
        onChange([...conditions, { conditionType: 'appointment_status_is', operator: 'equals', value: 'CONFIRMED' }]);

    const removeCondition = (idx: number) =>
        onChange(conditions.filter((_, i) => i !== idx));

    const updateCondition = (idx: number, key: keyof WorkflowCondition, val: string) => {
        const updated = conditions.map((c, i) => i === idx ? { ...c, [key]: val } : c);
        onChange(updated);
    };

    const inputStyle: React.CSSProperties = {
        padding: '6px 8px', borderRadius: 6, fontSize: 12,
        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
        color: 'var(--text-primary)', flex: 1,
    };

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label className="input-label" style={{ margin: 0 }}>Conditions (AND logic)</label>
                <button
                    type="button"
                    onClick={addCondition}
                    style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 6,
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                        color: '#a5b4fc', cursor: 'pointer',
                    }}
                >
                    + Add Condition
                </button>
            </div>
            {conditions.length === 0 && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    No conditions — action always runs
                </p>
            )}
            {conditions.map((cond, idx) => {
                const operators = OPERATOR_OPTIONS[cond.conditionType] ?? [{ value: 'equals', label: 'equals' }];
                return (
                    <div key={idx} style={{
                        display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap',
                    }}>
                        <select
                            style={{ ...inputStyle, flex: '0 0 auto', minWidth: 160 }}
                            value={cond.conditionType}
                            onChange={(e) => updateCondition(idx, 'conditionType', e.target.value)}
                        >
                            {CONDITION_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <select
                            style={{ ...inputStyle, flex: '0 0 auto', minWidth: 100 }}
                            value={cond.operator}
                            onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                        >
                            {operators.map((o) => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                        <input
                            style={inputStyle}
                            value={cond.value}
                            onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                            placeholder="value"
                        />
                        <button
                            type="button"
                            onClick={() => removeCondition(idx)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: '#f87171', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0,
                            }}
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

// ── Action Card (in flow canvas) ─────────────

function ActionCard({
    action,
    index,
    isSelected,
    onSelect,
    onDelete,
}: {
    action: WorkflowAction;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
}) {
    const opt = getActionOption(action.type);
    return (
        <div
            onClick={onSelect}
            style={{
                borderRadius: 12,
                border: isSelected
                    ? `1.5px solid ${opt.color}`
                    : '1px solid var(--border)',
                background: isSelected
                    ? `rgba(${hexToRgb(opt.color)},0.08)`
                    : 'rgba(255,255,255,0.04)',
                padding: '12px 14px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                    fontSize: 18, width: 32, height: 32, borderRadius: 8,
                    background: `rgba(${hexToRgb(opt.color)},0.15)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    {opt.icon}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                            STEP {index + 1}
                        </span>
                        {action.delayMinutes > 0 && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                                background: 'rgba(245,158,11,0.1)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.25)',
                            }}>
                                +{action.delayMinutes >= 60
                                    ? `${Math.round(action.delayMinutes / 60)}h`
                                    : `${action.delayMinutes}m`} delay
                            </span>
                        )}
                        {(action.conditions?.length ?? 0) > 0 && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 100,
                                background: 'rgba(99,102,241,0.1)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)',
                            }}>
                                {action.conditions?.length ?? 0} cond.
                            </span>
                        )}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {opt.label}
                    </span>
                    {action.config.message != null && (
                        <p style={{
                            fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220,
                        }}>
                            {String(action.config.message).slice(0, 60)}{String(action.config.message).length > 60 ? '…' : ''}
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(); }}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#9ca3af', fontSize: 18, lineHeight: 1, padding: '2px 4px', flexShrink: 0,
                    }}
                >
                    ×
                </button>
            </div>
        </div>
    );
}

function hexToRgb(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
}

// ── Workflow Builder ──────────────────────────

function WorkflowBuilder({
    initial,
    onSave,
    onBack,
}: {
    initial: Partial<Workflow> | null;
    onSave: (saved: Workflow) => void;
    onBack: () => void;
}) {
    const [name, setName] = useState(initial?.name ?? 'Untitled Workflow');
    const [description, setDescription] = useState(initial?.description ?? '');
    const [trigger, setTrigger] = useState<WorkflowTrigger>(
        initial?.trigger ?? { type: 'appointment_created', config: {} },
    );
    const [actions, setActions] = useState<WorkflowAction[]>(
        initial?.actions ?? [],
    );
    const [selectedIdx, setSelectedIdx] = useState<number | 'trigger' | null>('trigger');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const addAction = () => {
        const next = newBlankAction(actions.length);
        setActions([...actions, next]);
        setSelectedIdx(actions.length);
    };

    const deleteAction = (idx: number) => {
        const updated = actions
            .filter((_, i) => i !== idx)
            .map((a, i) => ({ ...a, stepOrder: i }));
        setActions(updated);
        setSelectedIdx(null);
    };

    const updateAction = (idx: number, updated: WorkflowAction) => {
        const copy = [...actions];
        copy[idx] = { ...updated, stepOrder: idx };
        setActions(copy);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Workflow name is required'); return; }
        if (!trigger.type) { setError('Trigger type is required'); return; }
        if (actions.length === 0) { setError('Add at least one action'); return; }
        setError('');
        setSaving(true);
        try {
            const payload = {
                name: name.trim(),
                description: description.trim() || undefined,
                isActive: true,
                trigger,
                actions: actions.map((a, i) => ({ ...a, stepOrder: i })),
            };
            let res;
            if (initial?.id) {
                res = await api.patch(`/automations/${initial.id}`, payload);
            } else {
                res = await api.post('/automations', payload);
            }
            onSave(res.data);
        } catch (e: any) {
            setError(e.response?.data?.message ?? 'Failed to save workflow');
        } finally {
            setSaving(false);
        }
    };

    const selectedAction = typeof selectedIdx === 'number' ? actions[selectedIdx] : null;

    const panelStyle: React.CSSProperties = {
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 20,
        overflowY: 'auto',
    };

    const connectorStyle: React.CSSProperties = {
        display: 'flex', justifyContent: 'center', padding: '6px 0',
        color: 'var(--text-muted)', fontSize: 20, userSelect: 'none',
    };

    return (
        <div>
            {/* Header */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <button
                    type="button"
                    onClick={onBack}
                    style={{
                        background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                        borderRadius: 8, padding: '7px 12px', cursor: 'pointer',
                        color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                    }}
                >
                    ← Back
                </button>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    title="The internal name for this automation workflow."
                    style={{
                        flex: 1, padding: '8px 14px', borderRadius: 10, fontSize: 18,
                        fontWeight: 700, background: 'transparent', border: '1.5px solid transparent',
                        color: 'var(--text-primary)', outline: 'none',
                        transition: 'border-color 0.15s',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'rgba(99,102,241,0.4)')}
                    onBlur={(e) => (e.target.style.borderColor = 'transparent')}
                />
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="btn btn-primary"
                >
                    {saving ? 'Saving…' : 'Save Workflow'}
                </button>
            </div>

            {error && (
                <div style={{
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#f87171', fontSize: 13,
                }}>
                    {error}
                </div>
            )}

            {/* Two-column layout */}
            <div className="grid-2" style={{ alignItems: 'start' }}>
                {/* LEFT: Flow canvas */}
                <div style={panelStyle}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 16 }}>
                        WORKFLOW FLOW
                    </p>

                    {/* Trigger node */}
                    <div
                        onClick={() => setSelectedIdx('trigger')}
                        style={{
                            borderRadius: 12,
                            border: selectedIdx === 'trigger'
                                ? '1.5px solid var(--primary)'
                                : '1px solid var(--border)',
                            background: selectedIdx === 'trigger'
                                ? 'rgba(99,102,241,0.08)'
                                : 'rgba(255,255,255,0.04)',
                            padding: '14px 16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                                fontSize: 20, width: 36, height: 36, borderRadius: 8,
                                background: 'rgba(99,102,241,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                                <span style={{ flexShrink: 0, width: 20, textAlign: 'center' }}>{getTriggerOption(trigger.type).icon}</span>
                            </span>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>TRIGGER</div>
                                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {getTriggerOption(trigger.type).label}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    {actions.map((action, idx) => (
                        <div key={idx}>
                            <div style={connectorStyle}>↓</div>
                            <ActionCard
                                action={action}
                                index={idx}
                                isSelected={selectedIdx === idx}
                                onSelect={() => setSelectedIdx(idx)}
                                onDelete={() => deleteAction(idx)}
                            />
                        </div>
                    ))}

                    {/* Add Step */}
                    <div style={connectorStyle}>↓</div>
                    <button
                        type="button"
                        onClick={addAction}
                        style={{
                            width: '100%', padding: '12px', borderRadius: 12,
                            border: '1.5px dashed rgba(99,102,241,0.3)',
                            background: 'rgba(99,102,241,0.04)',
                            color: '#a5b4fc', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                            transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => {
                            (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.08)';
                            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.5)';
                        }}
                        onMouseLeave={(e) => {
                            (e.target as HTMLElement).style.background = 'rgba(99,102,241,0.04)';
                            (e.target as HTMLElement).style.borderColor = 'rgba(99,102,241,0.3)';
                        }}
                    >
                        + Add Step
                    </button>
                </div>

                {/* RIGHT: Config panel */}
                <div style={panelStyle}>
                    {selectedIdx === 'trigger' && (
                        <div>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 16 }}>
                                TRIGGER CONFIG
                            </p>
                            <label className="input-label">When this happens…</label>
                            <select
                                style={{
                                    width: '100%', padding: '9px 12px', borderRadius: 8,
                                    background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                                    boxSizing: 'border-box',
                                }}
                                value={trigger.type}
                                onChange={(e) => setTrigger({ ...trigger, type: e.target.value })}
                            >
                                {TRIGGER_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </select>
                            <div style={{ marginTop: 16 }}>
                                <label className="input-label">Description (optional)</label>
                                <input
                                    style={{
                                        width: '100%', padding: '8px 10px', borderRadius: 8,
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
                                    }}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Brief description of this workflow"
                                />
                            </div>
                        </div>
                    )}

                    {typeof selectedIdx === 'number' && selectedAction && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                                STEP {selectedIdx + 1} CONFIG
                            </p>

                            {/* Action type */}
                            <div>
                                <label className="input-label">Action Type</label>
                                <select
                                    style={{
                                        width: '100%', padding: '9px 12px', borderRadius: 8,
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                                        boxSizing: 'border-box',
                                    }}
                                    value={selectedAction.type}
                                    onChange={(e) =>
                                        updateAction(selectedIdx, { ...selectedAction, type: e.target.value, config: {} })
                                    }
                                >
                                    {ACTION_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Action-specific config */}
                            <ActionConfigFields
                                action={selectedAction}
                                onChange={(updated) => updateAction(selectedIdx, updated)}
                            />

                            {/* Delay */}
                            <div>
                                <label className="input-label">Delay (minutes)</label>
                                <input
                                    type="number"
                                    min={0}
                                    style={{
                                        width: '100%', padding: '8px 10px', borderRadius: 8,
                                        background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
                                        color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box',
                                    }}
                                    value={selectedAction.delayMinutes}
                                    onChange={(e) =>
                                        updateAction(selectedIdx, { ...selectedAction, delayMinutes: Number(e.target.value) })
                                    }
                                />
                                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                                    0 = send immediately after trigger
                                </p>
                            </div>

                            {/* Conditions */}
                            <ConditionBuilder
                                conditions={selectedAction.conditions}
                                onChange={(conds) =>
                                    updateAction(selectedIdx, { ...selectedAction, conditions: conds })
                                }
                            />
                        </div>
                    )}

                    {selectedIdx === null && (
                        <div style={{ paddingTop: 40 }}>
                            <EmptyState
                                title="Select a step"
                                description="Click any step in the workflow to configure its settings."
                                icon={faMousePointer}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ── Workflow List Card ────────────────────────

function WorkflowCard({
    workflow,
    onEdit,
    onDelete,
    onToggle,
    onViewExecutions,
}: {
    workflow: Workflow;
    onEdit: () => void;
    onDelete: () => void;
    onToggle: () => void;
    onViewExecutions: () => void;
}) {
    const trigger = getTriggerOption(workflow.trigger?.type ?? '');

    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
        }}>
            {/* Top row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {workflow.name}
                        </h3>
                        <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100,
                            background: workflow.isActive ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                            color: workflow.isActive ? '#4ade80' : '#9ca3af',
                            border: `1px solid ${workflow.isActive ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)'}`,
                        }}>
                            {workflow.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                    </div>
                    {workflow.description && (
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
                            {workflow.description}
                        </p>
                    )}
                </div>
                {/* Toggle */}
                <button
                    type="button"
                    onClick={onToggle}
                    style={{
                        position: 'relative', width: 40, height: 22, borderRadius: 100, border: 'none',
                        cursor: 'pointer', flexShrink: 0,
                        background: workflow.isActive ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                        transition: 'background 0.2s',
                    }}
                >
                    <span style={{
                        position: 'absolute', top: 3, left: workflow.isActive ? 20 : 3,
                        width: 16, height: 16, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s', display: 'block',
                    }} />
                </button>
            </div>

            {/* Trigger & actions summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 12, fontWeight: 600,
                    background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                    color: '#a5b4fc', borderRadius: 8, padding: '3px 9px',
                }}>
                    {trigger.icon} {trigger.label}
                </span>
                {workflow.actions && workflow.actions.slice(0, 4).map((a, i) => {
                    const ao = getActionOption(a.type);
                    return (
                        <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 600,
                            background: `rgba(${hexToRgb(ao.color)},0.1)`,
                            border: `1px solid rgba(${hexToRgb(ao.color)},0.2)`,
                            color: ao.color, borderRadius: 8, padding: '3px 8px',
                        }}>
                            {ao.icon} {ao.label}
                        </span>
                    );
                })}
                {workflow.actions && workflow.actions.length > 4 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        +{workflow.actions.length - 4} more
                    </span>
                )}
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    type="button"
                    onClick={onViewExecutions}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 12, color: 'var(--text-muted)', padding: 0,
                    }}
                >
                    <FontAwesomeIcon icon={faChartBar} style={{ marginRight: 5 }} />{workflow._count?.executions ?? 0} run{(workflow._count?.executions ?? 0) !== 1 ? 's' : ''}
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        type="button"
                        onClick={onEdit}
                        style={{
                            padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                            color: 'var(--text-primary)', cursor: 'pointer',
                        }}
                    >
                        Edit
                    </button>
                    <button
                        type="button"
                        onClick={onDelete}
                        style={{
                            padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                            color: '#f87171', cursor: 'pointer',
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

// ── Execution History Panel ───────────────────

function ExecutionHistoryPanel({
    workflowName,
    executions,
    onClose,
}: {
    workflowName: string;
    executions: Execution[];
    onClose: () => void;
}) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 20,
            marginTop: 24,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Execution History — {workflowName}
                </h3>
                <button
                    type="button"
                    onClick={onClose}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-muted)', fontSize: 20, lineHeight: 1, padding: 0,
                    }}
                >
                    ×
                </button>
            </div>
            {executions.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
                    No executions yet
                </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {executions.map((ex) => {
                    const duration = ex.completedAt
                        ? `${Math.round((new Date(ex.completedAt).getTime() - new Date(ex.startedAt).getTime()) / 1000)}s`
                        : null;
                    return (
                        <div key={ex.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                            padding: '10px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                        }}>
                            <StatusBadge status={ex.status} />
                            <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1, minWidth: 100 }}>
                                {new Date(ex.startedAt).toLocaleString()}
                            </span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {ex.actionsRun} run / {ex.actionsSkipped} skipped
                                {duration && ` · ${duration}`}
                            </span>
                            {ex.error && (
                                <span style={{ fontSize: 11, color: '#f87171', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ex.error}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────

export default function AutomationsPage() {
    const [view, setView] = useState<'list' | 'builder'>('list');
    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingWorkflow, setEditingWorkflow] = useState<Partial<Workflow> | null>(null);
    const [executionPanel, setExecutionPanel] = useState<{ workflowId: string; name: string } | null>(null);
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loadingExecutions, setLoadingExecutions] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

    const loadWorkflows = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/automations');
            const normalized = (res.data as Workflow[]).map(wf => ({
                ...wf,
                actions: (wf.actions ?? []).map(a => ({ ...a, conditions: a.conditions ?? [] })),
            }));
            setWorkflows(normalized);
        } catch {
            // silently fail
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadWorkflows();
    }, [loadWorkflows]);

    const viewExecutions = async (workflowId: string, name: string) => {
        setExecutionPanel({ workflowId, name });
        setLoadingExecutions(true);
        try {
            const res = await api.get(`/automations/${workflowId}/executions`);
            setExecutions(res.data);
        } catch {
            setExecutions([]);
        } finally {
            setLoadingExecutions(false);
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await api.patch(`/automations/${id}/toggle`);
            loadWorkflows();
        } catch {
            // ignore
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await api.delete(`/automations/${id}`);
            setDeleteConfirm(null);
            loadWorkflows();
        } catch {
            // ignore
        }
    };

    const handleSaved = (saved: Workflow) => {
        setView('list');
        setEditingWorkflow(null);
        loadWorkflows();
    };

    if (view === 'builder') {
        return (
            <div>
                <WorkflowBuilder
                    initial={editingWorkflow}
                    onSave={handleSaved}
                    onBack={() => { setView('list'); setEditingWorkflow(null); }}
                />
            </div>
        );
    }

    return (
        <div>
            {/* Page header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        Automations
                    </h1>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
                        Build trigger-based workflows to send messages, tag contacts, and more
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-primary w-full md:w-auto"
                    onClick={() => { setEditingWorkflow(null); setView('builder'); }}
                >
                    + New Workflow
                </button>
            </div>

            {/* Feature banner */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4" style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)',
                border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: 16,
                padding: '20px 24px',
                marginBottom: 28,
            }}>
                <div style={{ fontSize: 28, color: '#a5b4fc' }}><Icon icon={faBolt} /></div>
                <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#a5b4fc', margin: '0 0 4px' }}>
                        Workflow Automation Engine
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
                        Trigger automated sequences when appointments are booked, confirmed, completed, or cancelled.
                        Send SMS, WhatsApp, email, or voice messages with custom delays and conditions.
                    </p>
                </div>
            </div>

            {/* Loading state */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
                    Loading workflows…
                </div>
            ) : workflows.length === 0 ? (
                <EmptyState
                    title="No workflows yet"
                    description="Create your first automation workflow to send reminders, follow-ups, and review requests automatically."
                    icon={faBolt}
                    ctaLabel="Create First Workflow"
                    ctaAction={() => { setEditingWorkflow(null); setView('builder'); }}
                />
            ) : (
                /* Workflow grid */
                <div className="grid-2" style={{ gap: 16 }}>
                    {workflows.map((wf) => (
                        <WorkflowCard
                            key={wf.id}
                            workflow={wf}
                            onEdit={() => { setEditingWorkflow(wf); setView('builder'); }}
                            onDelete={() => setDeleteConfirm(wf.id)}
                            onToggle={() => handleToggle(wf.id)}
                            onViewExecutions={() => viewExecutions(wf.id, wf.name)}
                        />
                    ))}
                </div>
            )}

            {/* Execution history panel */}
            {executionPanel && (
                <div>
                    {loadingExecutions ? (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
                            Loading executions…
                        </div>
                    ) : (
                        <ExecutionHistoryPanel
                            workflowName={executionPanel.name}
                            executions={executions}
                            onClose={() => setExecutionPanel(null)}
                        />
                    )}
                </div>
            )}

            {/* Delete confirm modal */}
            {deleteConfirm && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                }}>
                    <div style={{
                        background: '#1e293b', border: '1px solid var(--border)',
                        borderRadius: 16, padding: 28, width: 360, maxWidth: '90vw',
                    }}>
                        <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 10 }}>
                            Delete Workflow?
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>
                            This will permanently delete the workflow and all its execution history. This cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={() => setDeleteConfirm(null)}
                                style={{
                                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)', cursor: 'pointer',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDelete(deleteConfirm)}
                                style={{
                                    padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                                    background: '#ef4444', border: 'none',
                                    color: '#fff', cursor: 'pointer',
                                }}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
