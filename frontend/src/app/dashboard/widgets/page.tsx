'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import FeatureBanner from '@/components/FeatureBanner';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faWrench, faLightbulb } from '@fortawesome/free-solid-svg-icons';

// ── Types ────────────────────────────────────

interface ServiceItem { name: string; duration: number; price?: number }

interface WidgetConfig {
    id?: string;
    businessName: string;
    welcomeMessage: string;
    services: ServiceItem[];
    accentColor: string;
    workingDays: number[];
    workingHoursStart: string;
    workingHoursEnd: string;
    slotDuration: number;
    isActive: boolean;
}

interface EmbedCode { iframe: string; script: string }

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_DURATIONS = [15, 30, 45, 60, 90, 120];
const DEFAULT_CONFIG: WidgetConfig = {
    businessName: '',
    welcomeMessage: '',
    services: [{ name: 'Consultation', duration: 60 }],
    accentColor: '#6366f1',
    workingDays: [1, 2, 3, 4, 5],
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    slotDuration: 60,
    isActive: true,
};

// ── Service editor row ───────────────────────

function ServiceRow({
    service, index, onChange, onRemove,
}: {
    service: ServiceItem;
    index: number;
    onChange: (i: number, s: ServiceItem) => void;
    onRemove: (i: number) => void;
}) {
    return (
        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_80px_80px_36px] gap-2 sm:items-center w-full">
            <input
                className="w-full"
                value={service.name}
                onChange={(e) => onChange(index, { ...service, name: e.target.value })}
                placeholder="Service name"
                title="The name of the service offered."
                style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16 }}
            />
            <div className="flex gap-2 w-full">
                <div style={{ position: 'relative', flex: 1 }}>
                <input
                    type="number"
                    value={service.duration}
                    min={15}
                    max={480}
                    onChange={(e) => onChange(index, { ...service, duration: Number(e.target.value) })}
                    title="How long the service lasts in minutes."
                    style={{ width: '100%', padding: '8px 28px 8px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16 }}
                />
                <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: 'var(--text-muted)' }}>min</span>
            </div>
            <div style={{ position: 'relative' }}>
                <input
                    type="number"
                    value={service.price ?? ''}
                    min={0}
                    placeholder="0"
                    onChange={(e) => onChange(index, { ...service, price: e.target.value ? Number(e.target.value) : undefined })}
                    title="The cost of the service (optional)."
                    style={{ width: '100%', padding: '8px 8px 8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16 }}
                />
                <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-muted)' }}>$</span>
            </div>
            <button
                className="w-full sm:w-[36px]"
                onClick={() => onRemove(index)}
                style={{ height: 36, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#f87171', cursor: 'pointer', fontSize: 16 }}
            >×</button>
        </div>
    </div>
    );
}

// ── Embed code display ───────────────────────

function EmbedCodeBox({ label, code }: { label: string; code: string }) {
    const [copied, setCopied] = useState(false);
    const copy = () => {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
                <button
                    onClick={copy}
                    style={{
                        padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)',
                        background: copied ? 'rgba(74,222,128,0.1)' : 'var(--bg-secondary)',
                        color: copied ? '#4ade80' : 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                    }}
                >{copied ? '✓ Copied' : 'Copy'}</button>
            </div>
            <pre style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border)',
                fontSize: 12, color: '#a5b4fc', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                fontFamily: 'monospace', margin: 0,
            }}>{code}</pre>
        </div>
    );
}

// ── Main page ────────────────────────────────

export default function WidgetsPage() {
    const { user } = useAuth();
    const [config, setConfig] = useState<WidgetConfig>(DEFAULT_CONFIG);
    const [embedCode, setEmbedCode] = useState<EmbedCode | null>(null);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState<'config' | 'embed'>('config');
    const [tenantId, setTenantId] = useState<string>('');

    const loadConfig = useCallback(async () => {
        try {
            const { data } = await api.get('/booking-widget/config');
            if (data) {
                setConfig({
                    businessName: data.businessName ?? '',
                    welcomeMessage: data.welcomeMessage ?? '',
                    services: Array.isArray(data.services) ? data.services : [{ name: 'Consultation', duration: 60 }],
                    accentColor: data.accentColor ?? '#6366f1',
                    workingDays: data.workingDays ?? [1, 2, 3, 4, 5],
                    workingHoursStart: data.workingHoursStart ?? '09:00',
                    workingHoursEnd: data.workingHoursEnd ?? '17:00',
                    slotDuration: data.slotDuration ?? 60,
                    isActive: data.isActive ?? true,
                });
            }
        } catch { /* new tenant, use defaults */ }

        try {
            const { data } = await api.get('/booking-widget/embed-code');
            setEmbedCode(data);
        } catch { }
    }, []);

    useEffect(() => {
        loadConfig();
        // Extract tenantId from JWT payload (stored in user object by auth context)
        if (user) setTenantId((user as any).tenantId ?? '');
    }, [loadConfig, user]);

    const handleSave = async () => {
        if (!config.businessName.trim()) return;
        setSaving(true);
        try {
            await api.put('/booking-widget/config', config);
            const { data } = await api.get('/booking-widget/embed-code');
            setEmbedCode(data);
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch { }
        setSaving(false);
    };

    const updateService = (i: number, s: ServiceItem) =>
        setConfig((c) => ({ ...c, services: c.services.map((x, idx) => idx === i ? s : x) }));

    const removeService = (i: number) =>
        setConfig((c) => ({ ...c, services: c.services.filter((_, idx) => idx !== i) }));

    const addService = () =>
        setConfig((c) => ({ ...c, services: [...c.services, { name: '', duration: 60 }] }));

    const toggleDay = (day: number) =>
        setConfig((c) => ({
            ...c,
            workingDays: c.workingDays.includes(day)
                ? c.workingDays.filter((d) => d !== day)
                : [...c.workingDays, day].sort((a, b) => a - b),
        }));

    const previewUrl = tenantId ? `/widget/${tenantId}` : null;

    return (
        <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Booking Widget</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
                        Embed a booking form on your website. Appointments are automatically created and reminders scheduled.
                    </p>
                </div>


                {/* Active toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginTop: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: config.isActive ? '#4ade80' : 'var(--text-muted)' }}>
                        {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <div
                        onClick={() => setConfig((c) => ({ ...c, isActive: !c.isActive }))}
                        style={{ width: 44, height: 24, borderRadius: 12, cursor: 'pointer', position: 'relative', background: config.isActive ? '#22c55e' : 'var(--border)', transition: 'background 0.2s' }}
                    >
                        <div style={{ position: 'absolute', top: 3, left: config.isActive ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
                    </div>
                </label>
            </div>

            <FeatureBanner
                src="/images/features/booking-widget.jpg"
                title="Embeddable Booking Widget"
                description="Give your clients a seamless self-service booking experience. Paste one line of code on your website and appointments flow straight into your dashboard with reminders auto-scheduled."
                accent="#a855f7"
            />

            {/* Tab switcher */}
            <div className="flex flex-wrap" style={{ gap: 4, background: 'var(--bg-secondary)', borderRadius: 10, padding: 4, marginBottom: 24, width: 'fit-content' }}>
                {(['config', 'embed'] as const).map((t) => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                            background: tab === t ? 'var(--bg-card)' : 'transparent',
                            color: tab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                            boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.2)' : 'none', transition: 'all 0.15s',
                        }}
                    >
                        {t === 'config' ? 'Configure' : 'Embed Code'}
                    </button>
                ))}
            </div>

            {tab === 'config' ? (
                <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>

                    {/* Left: config form */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

                        {/* Business info */}
                        <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)' }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Business Info</h2>
                            <div style={{ display: 'grid', gap: 16 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Business Name *</label>
                                    <input
                                        value={config.businessName}
                                        onChange={(e) => setConfig((c) => ({ ...c, businessName: e.target.value }))}
                                        placeholder="e.g. Smith Dental Clinic"
                                        title="The name that will be displayed on the booking widget."
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16 }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Welcome Message</label>
                                    <textarea
                                        value={config.welcomeMessage}
                                        onChange={(e) => setConfig((c) => ({ ...c, welcomeMessage: e.target.value }))}
                                        placeholder="e.g. Book your appointment below — we'll confirm via SMS."
                                        rows={2}
                                        title="A greeting message for your clients."
                                        style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, resize: 'vertical' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Accent Colour</label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <input
                                            type="color"
                                            value={config.accentColor}
                                            onChange={(e) => setConfig((c) => ({ ...c, accentColor: e.target.value }))}
                                            style={{ width: 44, height: 36, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', padding: 2 }}
                                        />
                                        <input
                                            value={config.accentColor}
                                            onChange={(e) => setConfig((c) => ({ ...c, accentColor: e.target.value }))}
                                            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 14, fontFamily: 'monospace' }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Services */}
                        <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)' }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Services</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 18 }}>Clients choose a service before picking a time.</p>

                            <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_36px] gap-2 mb-2">
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Name</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Duration</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Price</span>
                                <span />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {config.services.map((s, i) => (
                                    <ServiceRow key={i} service={s} index={i} onChange={updateService} onRemove={removeService} />
                                ))}
                            </div>

                            <button
                                onClick={addService}
                                style={{ marginTop: 12, padding: '8px 16px', borderRadius: 8, border: '1px dashed var(--border)', background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600, width: '100%' }}
                            >
                                + Add Service
                            </button>
                        </div>

                        {/* Availability */}
                        <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)' }}>
                            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Availability</h2>

                            <div style={{ marginBottom: 20 }}>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Working Days</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                                        const active = config.workingDays.includes(day);
                                        return (
                                            <button
                                                key={day}
                                                onClick={() => toggleDay(day)}
                                                style={{
                                                    width: 40, height: 36, borderRadius: 8, border: `1px solid ${active ? config.accentColor : 'var(--border)'}`,
                                                    background: active ? config.accentColor + '20' : 'var(--bg-secondary)',
                                                    color: active ? config.accentColor : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                                }}
                                            >{DAY_LABELS[day]}</button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid-2" style={{ gap: 16, marginBottom: 20 }}>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>Start Time</label>
                                    <DateTimePicker mode="time" value={config.workingHoursStart}
                                        onChange={(v) => setConfig((c) => ({ ...c, workingHoursStart: v }))}
                                        className=""
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16 }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 6 }}>End Time</label>
                                    <DateTimePicker mode="time" value={config.workingHoursEnd}
                                        onChange={(v) => setConfig((c) => ({ ...c, workingHoursEnd: v }))}
                                        className=""
                                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', fontSize: 16 }} />
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Default Slot Duration</label>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {SLOT_DURATIONS.map((d) => (
                                        <button key={d} onClick={() => setConfig((c) => ({ ...c, slotDuration: d }))}
                                            style={{
                                                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                                border: `1px solid ${config.slotDuration === d ? config.accentColor : 'var(--border)'}`,
                                                background: config.slotDuration === d ? config.accentColor + '20' : 'var(--bg-secondary)',
                                                color: config.slotDuration === d ? config.accentColor : 'var(--text-muted)',
                                            }}>
                                            {d >= 60 ? `${d / 60}h` : `${d}m`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Save */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <button
                                onClick={handleSave}
                                disabled={saving || !config.businessName.trim()}
                                className="btn btn-primary"
                                style={{ fontSize: 15 }}
                            >
                                {saving ? 'Saving…' : 'Save Widget'}
                            </button>
                            {saved && <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 600 }}>✓ Saved</span>}
                        </div>
                    </div>

                    {/* Right: live preview */}
                    <div style={{ position: 'sticky', top: 24 }}>
                        <div className="glass-card" style={{ padding: '20px 24px', marginBottom: 16 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Live Preview</h3>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                                Save to update — will open in a new tab.
                            </p>
                            {previewUrl ? (
                                <a
                                    href={previewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-outline"
                                    style={{ width: '100%', textAlign: 'center', fontSize: 13 }}
                                >
                                    Open Widget Preview →
                                </a>
                            ) : (
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Save to generate preview link.</div>
                            )}
                        </div>

                        {/* Mini preview card */}
                        <div style={{ borderRadius: 12, border: `2px solid ${config.accentColor}40`, overflow: 'hidden', background: '#fff' }}>
                            <div style={{ padding: '16px 18px', borderBottom: `3px solid ${config.accentColor}` }}>
                                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>
                                    {config.businessName || 'Your Business'}
                                </div>
                                <div style={{ fontSize: 12, color: '#666' }}>
                                    {config.welcomeMessage || 'Book your appointment below.'}
                                </div>
                            </div>
                            <div style={{ padding: '12px 18px' }}>
                                {config.services.slice(0, 3).map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 8, marginBottom: 6, border: `1px solid ${config.accentColor}30`, background: `${config.accentColor}08` }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{s.name || 'Service'}</span>
                                        <span style={{ fontSize: 12, color: config.accentColor, fontWeight: 700 }}>{s.duration}min{s.price ? ` · $${s.price}` : ''}</span>
                                    </div>
                                ))}
                                {config.services.length > 3 && (
                                    <div style={{ fontSize: 12, color: '#888', textAlign: 'center' }}>+{config.services.length - 3} more</div>
                                )}
                                <button style={{ width: '100%', marginTop: 10, padding: '10px', borderRadius: 8, border: 'none', background: config.accentColor, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                                    Select Service
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* Embed tab */
                <div style={{ maxWidth: 700 }}>
                    {!embedCode ? (
                        <div className="glass-card" style={{ padding: '40px', textAlign: 'center' }}>
                            <div style={{ fontSize: 28, marginBottom: 12, color: 'var(--accent-primary)' }}><FontAwesomeIcon icon={faWrench} /></div>
                            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Configure your widget first</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 20 }}>
                                Set up your services and availability on the Configure tab, then save to generate your embed code.
                            </p>
                            <button onClick={() => setTab('config')} className="btn btn-primary">Go to Configure →</button>
                        </div>
                    ) : (
                        <>
                            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', marginBottom: 20 }}>
                                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Embed on your website</h2>
                                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
                                    Paste one of these snippets into your website's HTML where you want the booking widget to appear.
                                </p>

                                <EmbedCodeBox label="Option 1 — iframe (simplest)" code={embedCode.iframe} />
                                <EmbedCodeBox label="Option 2 — JavaScript snippet" code={embedCode.script} />
                            </div>

                            <div className="glass-card" style={{ padding: '20px 24px' }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ fontSize: 16, color: 'var(--warning)' }}><FontAwesomeIcon icon={faLightbulb} /></span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>How it works</div>
                                        <ul style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0, paddingLeft: 18 }}>
                                            <li>Clients pick a service, choose a time, and enter their contact details</li>
                                            <li>An appointment is instantly created in your Meetora dashboard</li>
                                            <li>Reminder messages are automatically scheduled based on your reminder rules</li>
                                            <li>Clients receive confirmation and can reply to confirm, reschedule, or cancel</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
