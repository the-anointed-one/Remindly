'use client';

import { useCallback, useEffect, useState } from 'react';

// ── Responsive hook ───────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < breakpoint);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, [breakpoint]);
    return isMobile;
}
import api from '@/lib/api';
import FeatureBanner from '@/components/FeatureBanner';
import Icon from '@/components/ui/Icon';
import { faExclamationCircle, faExclamationTriangle, faCheckCircle, faBell } from '@fortawesome/free-solid-svg-icons';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PredictionStats {
    highRiskCount: number;
    mediumRiskCount: number;
    lowRiskCount: number;
    avgRiskScore: number | null;
    totalPredicted: number;
    escalationsTriggered: number;
    predictedNoShows: number;
}

interface RiskAppointment {
    id: string;
    title: string;
    scheduledAt: string;
    status: string;
    noShowRiskScore: number;
    riskCalculatedAt: string | null;
    customer: {
        id: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        email: string | null;
    };
    predictionLogs: Array<{
        riskScore: number;
        riskLevel: string;
        escalationTriggered: boolean;
        escalationChannels: string[];
        generatedAt: string;
        signals: Record<string, number>;
    }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
    });
}

function riskColor(score: number): string {
    if (score >= 61) return '#ef4444';
    if (score >= 36) return '#f59e0b';
    return '#22c55e';
}

// ── Risk score ring ───────────────────────────────────────────────────────────

function RiskRing({ score }: { score: number }) {
    const color = riskColor(score);
    return (
        <div style={{
            width: 72,
            height: 72,
            borderRadius: '50%',
            flexShrink: 0,
            background: `conic-gradient(${color} ${score}%, rgba(255,255,255,0.06) 0%)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
        }}>
            <div style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--bg-secondary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
            }}>
                <span style={{ fontSize: 17, fontWeight: 800, color, lineHeight: 1 }}>{score}%</span>
            </div>
        </div>
    );
}

// ── Signal breakdown mini bars ────────────────────────────────────────────────

const SIGNAL_LABELS: Record<string, { label: string; max: number }> = {
    historicalNoShows: { label: 'Historical No-Shows', max: 40 },
    historicalCancellations: { label: 'Cancellations', max: 20 },
    lowConfirmationRate: { label: 'Low Confirmations', max: 10 },
    dayOfWeekRisk: { label: 'Day of Week', max: 10 },
    timeOfDayRisk: { label: 'Time of Day', max: 10 },
    reminderResponseTime: { label: 'Response Time', max: 10 },
};

function SignalBreakdown({ signals }: { signals: Record<string, number> }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
            {Object.entries(SIGNAL_LABELS).map(([key, { label, max }]) => {
                const val = signals[key] ?? 0;
                const pct = Math.min(100, (val / max) * 100);
                const color = pct >= 70 ? '#ef4444' : pct >= 40 ? '#f59e0b' : '#22c55e';
                return (
                    <div key={key}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{label}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color }}>{val}/{max}</span>
                        </div>
                        <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.4s ease' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Channel badge ─────────────────────────────────────────────────────────────

const CHANNEL_COLOR: Record<string, string> = {
    SMS: '#3b82f6',
    WHATSAPP: '#22c55e',
    VOICE: '#f59e0b',
    EMAIL: '#8b5cf6',
};

function ChannelBadge({ channel }: { channel: string }) {
    const color = CHANNEL_COLOR[channel] ?? '#64748b';
    return (
        <span style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 100,
            background: `${color}20`,
            border: `1px solid ${color}40`,
            color,
        }}>
            {channel}
        </span>
    );
}

// ── Stats card ────────────────────────────────────────────────────────────────

function StatCard({
    icon,
    label,
    value,
    accent,
    sub,
}: {
    icon: string;
    label: string;
    value: number | string;
    accent: string;
    sub?: string;
}) {
    return (
        <div className="glass-card" style={{ padding: '20px 24px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '12px 12px 0 0' }} />
            <div style={{ fontSize: 22, marginBottom: 10 }}>{typeof icon === 'string' ? icon : <Icon icon={icon as any} />}</div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, color: accent, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

// ── Period selector tabs ──────────────────────────────────────────────────────

function PeriodTabs({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    const options: Array<{ days: number; label: string }> = [
        { days: 7, label: '7 Days' },
        { days: 14, label: '14 Days' },
        { days: 30, label: '30 Days' },
    ];
    return (
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 8, padding: 3 }}>
            {options.map(({ days, label }) => (
                <button
                    key={days}
                    onClick={() => onChange(days)}
                    style={{
                        padding: '5px 10px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        background: value === days ? 'var(--bg-card)' : 'transparent',
                        color: value === days ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: value === days ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                        transition: 'all 0.15s',
                    }}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}

// ── High-risk appointment card ────────────────────────────────────────────────

function HighRiskCard({
    appt,
    onRecalculate,
    recalculating,
}: {
    appt: RiskAppointment;
    onRecalculate: (id: string) => void;
    recalculating: string | null;
}) {
    const latestLog = appt.predictionLogs[0];
    const score = appt.noShowRiskScore;

    return (
        <div className="glass-card" style={{ padding: '20px 24px' }}>
            {/* Top row: ring + name info + escalation */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                {/* Left: Ring + label */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <RiskRing score={score} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>High Risk</span>
                </div>

                {/* Center: Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 2 }}>
                        {appt.customer.firstName} {appt.customer.lastName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{appt.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDateTime(appt.scheduledAt)}</div>
                </div>

                {/* Right: Escalation + action */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
                    {latestLog?.escalationTriggered ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Escalation sent</span>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                {latestLog.escalationChannels.map((ch) => (
                                    <ChannelBadge key={ch} channel={ch} />
                                ))}
                            </div>
                        </div>
                    ) : (
                        <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 100,
                            background: 'rgba(245,158,11,0.1)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            color: '#f59e0b',
                            whiteSpace: 'nowrap',
                        }}>
                            Auto-escalation pending
                        </span>
                    )}

                    <button
                        onClick={() => onRecalculate(appt.id)}
                        disabled={recalculating === appt.id}
                        className="btn btn-sm"
                        style={{ fontSize: 12, opacity: recalculating === appt.id ? 0.6 : 1 }}
                    >
                        {recalculating === appt.id ? 'Recalculating…' : 'Recalculate'}
                    </button>

                    {appt.riskCalculatedAt && (
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                            Updated {new Date(appt.riskCalculatedAt).toLocaleDateString()}
                        </span>
                    )}
                </div>
            </div>

            {/* Signal breakdown — full width below on all screen sizes */}
            {latestLog?.signals && Object.keys(latestLog.signals).length > 0 && (
                <div style={{ marginTop: 16 }}>
                    <SignalBreakdown signals={latestLog.signals} />
                </div>
            )}
        </div>
    );
}

// ── Medium risk table ─────────────────────────────────────────────────────────

function MediumRiskCard({
    appt,
    onRecalculate,
    recalculating,
}: {
    appt: RiskAppointment;
    onRecalculate: (id: string) => void;
    recalculating: string | null;
}) {
    const score = appt.noShowRiskScore;
    return (
        <div style={{ padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                        {appt.customer.firstName} {appt.customer.lastName}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 2 }}>{appt.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmtDateTime(appt.scheduledAt)}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 100 }}>
                        <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                            <div style={{ width: `${score}%`, height: '100%', background: '#f59e0b', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', minWidth: 36, textAlign: 'right' }}>{score}%</span>
                    </div>
                    <button
                        onClick={() => onRecalculate(appt.id)}
                        disabled={recalculating === appt.id}
                        className="btn btn-sm"
                        style={{ fontSize: 12, opacity: recalculating === appt.id ? 0.6 : 1 }}
                    >
                        {recalculating === appt.id ? 'Recalculating…' : 'Recalculate'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function MediumRiskTable({
    appointments,
    onRecalculate,
    recalculating,
}: {
    appointments: RiskAppointment[];
    onRecalculate: (id: string) => void;
    recalculating: string | null;
}) {
    const isMobile = useIsMobile();
    if (appointments.length === 0) return null;

    return (
        <div className="glass-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <span style={{ fontSize: 18, color: '#f59e0b' }}><Icon icon={faExclamationTriangle} /></span>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b' }}>Medium Risk</h2>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>({appointments.length}, 36–60%)</span>
            </div>

            {isMobile ? (
                /* Mobile: stacked cards */
                <div>
                    {appointments.map((appt) => (
                        <MediumRiskCard
                            key={appt.id}
                            appt={appt}
                            onRecalculate={onRecalculate}
                            recalculating={recalculating}
                        />
                    ))}
                </div>
            ) : (
                /* Desktop: scrollable table */
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                {['Name', 'Appointment', 'Scheduled', 'Risk', 'Actions'].map((h) => (
                                    <th key={h} style={{ textAlign: 'left', padding: '6px 12px 10px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {appointments.map((appt) => {
                                const score = appt.noShowRiskScore;
                                return (
                                    <tr key={appt.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <td style={{ padding: '12px 12px 12px 0', fontSize: 14, fontWeight: 600 }}>
                                            {appt.customer.firstName} {appt.customer.lastName}
                                        </td>
                                        <td style={{ padding: '12px 12px 12px 0', fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {appt.title}
                                        </td>
                                        <td style={{ padding: '12px 12px 12px 0', fontSize: 12, color: 'var(--text-muted)' }}>
                                            {fmtDateTime(appt.scheduledAt)}
                                        </td>
                                        <td style={{ padding: '12px 12px 12px 0', minWidth: 120 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                                                    <div style={{ width: `${score}%`, height: '100%', background: '#f59e0b', borderRadius: 3 }} />
                                                </div>
                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#f59e0b', minWidth: 36 }}>{score}%</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 0 12px 0' }}>
                                            <button
                                                onClick={() => onRecalculate(appt.id)}
                                                disabled={recalculating === appt.id}
                                                className="btn btn-sm"
                                                style={{ fontSize: 12, opacity: recalculating === appt.id ? 0.6 : 1 }}
                                            >
                                                {recalculating === appt.id ? 'Recalculating…' : 'Recalculate'}
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ days }: { days: number }) {
    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: '60px 24px',
            textAlign: 'center',
            opacity: 0.7,
        }}>
            <div style={{ fontSize: 48, color: '#10b981' }}><Icon icon={faCheckCircle} /></div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>No high-risk appointments</div>
            <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                No high or medium risk appointments in the next {days} days
            </div>
        </div>
    );
}

// ── Skeleton loader ───────────────────────────────────────────────────────────

function Skeleton({ height = 80, style = {} }: { height?: number; style?: React.CSSProperties }) {
    return (
        <div style={{
            height,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            animation: 'pulse 1.5s ease-in-out infinite',
            ...style,
        }} />
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PredictionsPage() {
    const [stats, setStats] = useState<PredictionStats | null>(null);
    const [highRisk, setHighRisk] = useState<RiskAppointment[]>([]);
    const [mediumRisk, setMediumRisk] = useState<RiskAppointment[]>([]);
    const [days, setDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState<string | null>(null);
    const [recalcAll, setRecalcAll] = useState(false);

    const loadData = useCallback(async (d: number) => {
        setLoading(true);
        try {
            const [statsRes, highRiskRes] = await Promise.all([
                api.get('/predictions/stats'),
                api.get(`/predictions/high-risk?days=${d}`),
            ]);
            setStats(statsRes.data);

            const all: RiskAppointment[] = highRiskRes.data;
            setHighRisk(all.filter((a) => a.noShowRiskScore >= 61));
            setMediumRisk(all.filter((a) => a.noShowRiskScore >= 36 && a.noShowRiskScore < 61));
        } catch {
            // silently handle
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData(days);
    }, [days, loadData]);

    const handleDaysChange = (d: number) => {
        setDays(d);
    };

    const recalculate = async (appointmentId: string) => {
        setRecalculating(appointmentId);
        try {
            await api.post(`/predictions/appointment/${appointmentId}/recalculate`);
            await loadData(days);
        } catch {
            // silently handle
        } finally {
            setRecalculating(null);
        }
    };

    const recalculateAll = async () => {
        setRecalcAll(true);
        try {
            const all = [...highRisk, ...mediumRisk];
            for (const appt of all) {
                await api.post(`/predictions/appointment/${appt.id}/recalculate`);
            }
            await loadData(days);
        } catch {
            // silently handle
        } finally {
            setRecalcAll(false);
        }
    };

    const hasRisk = highRisk.length > 0 || mediumRisk.length > 0;

    return (
        <div>
            {/* ── Header ─────────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>AI No-Show Predictions</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        Identify high-risk appointments before they become no-shows
                    </p>
                </div>
                <button
                    onClick={recalculateAll}
                    disabled={recalcAll || loading}
                    className="btn btn-primary w-full md:w-auto"
                    style={{ opacity: recalcAll ? 0.7 : 1 }}
                >
                    {recalcAll ? 'Recalculating…' : 'Recalculate All'}
                </button>
            </div>

            {/* ── Feature banner ──────────────────────── */}
            <FeatureBanner
                src="/images/features/ai-prediction.jpg"
                title="AI No-Show Prediction"
                description="Meetora analyzes customer history, behavior patterns, and appointment context to predict which clients are most likely to miss their appointments — then automatically escalates reminders."
                accent="#a855f7"
            />

            {/* ── Stats row ───────────────────────────── */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
                    {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={110} />)}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
                    <StatCard
                        icon={faExclamationCircle as any}
                        label="High Risk"
                        value={stats?.highRiskCount ?? 0}
                        accent="#ef4444"
                        sub="appointments (score ≥ 61%)"
                    />
                    <StatCard
                        icon={faExclamationTriangle as any}
                        label="Medium Risk"
                        value={stats?.mediumRiskCount ?? 0}
                        accent="#f59e0b"
                        sub="appointments (score 36–60%)"
                    />
                    <StatCard
                        icon={faCheckCircle as any}
                        label="Low Risk"
                        value={stats?.lowRiskCount ?? 0}
                        accent="#22c55e"
                        sub="appointments (score < 36%)"
                    />
                    <StatCard
                        icon={faBell as any}
                        label="Escalations Sent"
                        value={stats?.escalationsTriggered ?? 0}
                        accent="#a855f7"
                        sub="auto-escalation reminders triggered"
                    />
                </div>
            )}

            {/* ── Period selector ─────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700 }}>Risk Appointments</h2>
                <PeriodTabs value={days} onChange={handleDaysChange} />
            </div>

            {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Skeleton height={120} />
                    <Skeleton height={120} />
                    <Skeleton height={200} />
                </div>
            ) : !hasRisk ? (
                <div className="glass-card">
                    <EmptyState days={days} />
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* High risk section */}
                    {highRisk.length > 0 && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <span style={{ fontSize: 18, color: '#ef4444' }}><Icon icon={faExclamationCircle} /></span>
                                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ef4444' }}>High Risk</h2>
                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>({highRisk.length} appointments, score ≥ 61%)</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {highRisk.map((appt) => (
                                    <HighRiskCard
                                        key={appt.id}
                                        appt={appt}
                                        onRecalculate={recalculate}
                                        recalculating={recalculating}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Medium risk section */}
                    {mediumRisk.length > 0 && (
                        <MediumRiskTable
                            appointments={mediumRisk}
                            onRecalculate={recalculate}
                            recalculating={recalculating}
                        />
                    )}
                </div>
            )}

            {/* ── Footer stats ────────────────────────── */}
            {stats && (stats.totalPredicted > 0 || stats.avgRiskScore !== null) && (
                <div style={{
                    marginTop: 28,
                    padding: '16px 24px',
                    borderRadius: 12,
                    background: 'rgba(168,85,247,0.04)',
                    border: '1px solid rgba(168,85,247,0.12)',
                    display: 'flex',
                    gap: 32,
                    flexWrap: 'wrap',
                }}>
                    <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Predictions</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#a855f7' }}>{stats.totalPredicted.toLocaleString()}</div>
                    </div>
                    {stats.avgRiskScore !== null && (
                        <div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Risk Score (Next {days}d)</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: riskColor(stats.avgRiskScore) }}>{stats.avgRiskScore}%</div>
                        </div>
                    )}
                    <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Predicted No-Shows</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: '#ef4444' }}>{stats.predictedNoShows}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
