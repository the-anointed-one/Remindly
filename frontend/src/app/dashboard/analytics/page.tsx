'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import FeatureBanner from '@/components/FeatureBanner';
import EmptyState from '@/components/EmptyState';
import Icon from '@/components/ui/Icon';
import {
    faComment, faPhone, faEnvelope, faChartLine, faCalendar, faCheck, faShieldHalved, faCoins, faChartBar,
    faArrowTrendUp, faArrowTrendDown, faMinus, faClock, faUsers, faTag
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { useCurrency } from '@/hooks/useCurrency';

// ── Types ────────────────────────────────────

interface TrendInfo { direction: 'up' | 'down' | 'flat'; pct: number }

interface DashboardMetrics {
    week: {
        appointments: { value: number; trend: TrendInfo };
        confirmed: { value: number; rate: number; trend: TrendInfo };
        noShowsPrevented: { value: number; trend: TrendInfo };
        revenueSaved: { value: number; formatted: string; trend: TrendInfo };
    };
    allTime: { totalAppointments: number; confirmationRate: number };
}

interface RatePoint { date: string; total: number; confirmed: number; rate: number | null }

interface WeekPoint {
    weekStart: string;
    weekLabel: string;
    total: number;
    noShows: number;
    prevented: number;
    noShowRate: number;
    preventionRate: number;
}

interface ChannelStat {
    channel: string;
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
}

interface RevenueSnapshot {
    appointments_booked: number;
    appointments_confirmed: number;
    no_shows_prevented: number;
    revenue_recovered: number;
    revenue_recovered_formatted: string;
    confirmation_rate: number;
    all_time_confirmation_rate: number;
}

interface RevenueTimePoint {
    date: string;
    label: string;
    noShowsPrevented: number;
    revenueRecovered: number;
    cumulative: number;
}

interface ChannelRevenue {
    channel: string;
    appointmentsInfluenced: number;
    revenueAttributed: number;
    formatted: string;
    percentageOfTotal: number;
}

interface RevenueSummary {
    avgAppointmentValue: number;
    weekly: { noShowsPrevented: number; revenueRecovered: number; formatted: string };
    monthly: { noShowsPrevented: number; revenueRecovered: number; formatted: string };
    allTime: { noShowsPrevented: number; revenueRecovered: number; formatted: string };
    confirmationRate: number;
    projectedMonthlyRevenue: { value: number; formatted: string; noShowsPrevented: number };
    roi: { estimatedMessagingCost: number; netRevenue: number; roiPercent: number };
}

// ── Helpers ──────────────────────────────────

function fmtDate(iso: string, days: number): string {
    const d = new Date(iso + 'T12:00:00');
    if (days <= 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
    if (days <= 30) return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const CHANNEL_COLOR: Record<string, string> = {
    SMS: '#3b82f6', WHATSAPP: '#22c55e', VOICE: '#F7941D', EMAIL: '#8b5cf6',
};
const CHANNEL_ICON: Record<string, React.ReactNode> = {
    SMS: <Icon icon={faComment} />, WHATSAPP: <Icon icon={faWhatsapp} />, VOICE: <Icon icon={faPhone} />, EMAIL: <Icon icon={faEnvelope} />,
};

// ── Trend badge ──────────────────────────────

function TrendBadge({ trend, invertColor = false }: { trend: TrendInfo; invertColor?: boolean }) {
    if (trend.direction === 'flat' || trend.pct === 0) {
        return (
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.15)', borderRadius: 100, padding: '2px 8px' }}>
                — vs last week
            </span>
        );
    }
    const positive = invertColor ? trend.direction === 'down' : trend.direction === 'up';
    return (
        <span style={{ fontSize: 11, fontWeight: 600, color: positive ? '#4ade80' : '#f87171', background: positive ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)', border: `1px solid ${positive ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, borderRadius: 100, padding: '2px 8px' }}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.pct}% vs last week
        </span>
    );
}

// ── Metric card ──────────────────────────────

function MetricCard({ icon, label, value, sub, trend, accent = '#6366f1', invertTrend = false }: {
    icon: React.ReactNode; label: string; value: string | number; sub?: string;
    trend?: TrendInfo; accent?: string; invertTrend?: boolean;
}) {
    return (
        <div className="glass-card" style={{ padding: '24px 28px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: '12px 12px 0 0' }} />
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                {trend && <TrendBadge trend={trend} invertColor={invertTrend} />}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: -1, marginBottom: 4 }}>{value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: sub ? 4 : 0 }}>{label}</div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{sub}</div>}
        </div>
    );
}

// ── Stat tile (compact) ──────────────────────

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent: string }) {
    return (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '18px 20px', border: '1px solid var(--border)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 3, background: accent, borderRadius: '12px 0 0 12px' }} />
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 16 }}>{icon}</span> {value}
            </div>
        </div>
    );
}

// ── Area / Line chart ────────────────────────

function ConfirmationRateChart({ data, days }: { data: RatePoint[]; days: number }) {
    const W = 800, H = 180;
    const padL = 38, padR = 16, padT = 12, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const filled = data.map((d) => ({ ...d, rate: d.rate ?? 0 }));
    const n = filled.length;
    if (n < 2) return <EmptyChart message="Not enough data yet" />;

    const xS = (i: number) => padL + (i / (n - 1)) * plotW;
    const yS = (v: number) => padT + plotH - (v / 100) * plotH;

    const pts = filled.map((d, i) => ({ x: xS(i), y: yS(d.rate), ...d }));
    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${pts[n - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} L ${padL} ${(padT + plotH).toFixed(1)} Z`;

    const labelEvery = n <= 7 ? 1 : n <= 30 ? 5 : 10;
    const labelIdxs = filled.map((_, i) => i).filter((i) => i === 0 || i === n - 1 || i % labelEvery === 0);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {[0, 25, 50, 75, 100].map((pct) => (
                <g key={pct}>
                    <line x1={padL} y1={yS(pct)} x2={W - padR} y2={yS(pct)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                    <text x={padL - 5} y={yS(pct) + 4} textAnchor="end" fontSize={9} fill="rgba(148,163,184,0.6)">{pct}%</text>
                </g>
            ))}
            <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F7941D" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#F7941D" stopOpacity={0.02} />
                </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#areaGrad)" />
            <path d={linePath} fill="none" stroke="#F7941D" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {pts.filter((_, i) => n <= 30 || i % Math.ceil(n / 20) === 0 || i === n - 1).map((p, i) => (
                <g key={i}>
                    <circle cx={p.x} cy={p.y} r={3.5} fill="#F7941D" />
                    <circle cx={p.x} cy={p.y} r={5} fill="#F7941D" opacity={0.15} />
                    <title>{p.date}: {p.rate}%</title>
                </g>
            ))}
            {labelIdxs.map((i) => (
                <text key={i} x={xS(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="rgba(148,163,184,0.65)">
                    {fmtDate(filled[i].date, days)}
                </text>
            ))}
        </svg>
    );
}

// ── Grouped bar chart (no-show reduction) ────

function NoShowReductionChart({ data }: { data: WeekPoint[] }) {
    const W = 800, H = 220;
    const padL = 10, padR = 10, padT = 10, padB = 36;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const n = data.length;
    if (n === 0) return <EmptyChart message="No appointment data yet" />;

    const maxVal = Math.max(...data.map((d) => d.total), 1);
    const groupW = plotW / n;
    const barW = Math.max(4, (groupW - 6) / 2);
    const yS = (v: number) => padT + plotH - (v / maxVal) * plotH;
    const barH = (v: number) => Math.max(0, (v / maxVal) * plotH);

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line key={pct} x1={padL} y1={padT + plotH * (1 - pct)} x2={W - padR} y2={padT + plotH * (1 - pct)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            ))}
            {data.map((d, i) => {
                const gx = padL + i * groupW;
                const cx = gx + groupW / 2;
                const x1 = cx - barW - 2;
                const x2 = cx + 2;
                return (
                    <g key={i}>
                        <rect x={x1} y={yS(d.prevented)} width={barW} height={barH(d.prevented)} rx={3} fill="#22c55e" opacity={0.8}>
                            <title>Wk {d.weekLabel} — Prevented: {d.prevented} ({d.preventionRate}%)</title>
                        </rect>
                        <rect x={x2} y={yS(d.noShows)} width={barW} height={barH(d.noShows)} rx={3} fill="#f87171" opacity={0.8}>
                            <title>Wk {d.weekLabel} — No-Shows: {d.noShows} ({d.noShowRate}%)</title>
                        </rect>
                        <text x={cx} y={H - 8} textAnchor="middle" fontSize={9} fill="rgba(148,163,184,0.65)">
                            {d.weekLabel}
                        </text>
                    </g>
                );
            })}
            <g transform={`translate(${W - 160}, ${padT + 4})`}>
                <rect x={0} y={0} width={10} height={10} rx={2} fill="#22c55e" opacity={0.85} />
                <text x={14} y={9} fontSize={9} fill="rgba(148,163,184,0.8)">Prevented</text>
                <rect x={80} y={0} width={10} height={10} rx={2} fill="#f87171" opacity={0.85} />
                <text x={94} y={9} fontSize={9} fill="rgba(148,163,184,0.8)">No-Shows</text>
            </g>
        </svg>
    );
}

// ── Channel performance ──────────────────────

function ChannelPerformance({ data }: { data: ChannelStat[] }) {
    if (data.length === 0) return <EmptyChart message="No messages sent yet" />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {data.sort((a, b) => b.sent - a.sent).map((ch) => {
                const color = CHANNEL_COLOR[ch.channel] ?? '#64748b';
                const icon = CHANNEL_ICON[ch.channel] ?? <Icon icon={faEnvelope} />;
                const deliveryPct = ch.deliveryRate;
                const failPct = ch.sent > 0 ? Math.round((ch.failed / ch.sent) * 100) : 0;
                return (
                    <div key={ch.channel}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                                    {icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{ch.channel}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {ch.sent.toLocaleString()} sent · {ch.delivered.toLocaleString()} delivered · {ch.failed.toLocaleString()} failed
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color }}>{deliveryPct}%</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>delivery rate</div>
                            </div>
                        </div>
                        <div style={{ height: 7, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${deliveryPct}%`, background: color, borderRadius: '4px 0 0 4px', transition: 'width 0.6s ease' }} />
                            <div style={{ width: `${failPct}%`, background: '#f87171', transition: 'width 0.6s ease' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 5 }}>
                            <span style={{ fontSize: 10, color }}>{deliveryPct}% delivered</span>
                            {failPct > 0 && <span style={{ fontSize: 10, color: '#f87171' }}>{failPct}% failed</span>}
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                {(100 - deliveryPct - failPct).toFixed(0)}% pending/other
                            </span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Revenue over time chart ──────────────────

function RevenueOverTimeChart({ data, days }: { data: RevenueTimePoint[]; days: number }) {
    const currency = useCurrency();
    const W = 800, H = 200;
    const padL = 56, padR = 16, padT = 12, padB = 32;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    if (data.length < 2) return <EmptyChart message="Not enough revenue data yet" />;

    const maxRev = Math.max(...data.map((d) => d.revenueRecovered), 1);
    const maxCum = Math.max(...data.map((d) => d.cumulative), 1);
    const n = data.length;

    const xS = (i: number) => padL + (i / (n - 1)) * plotW;
    const yBar = (v: number) => padT + plotH - (v / maxRev) * plotH;
    const barH2 = (v: number) => Math.max(0, (v / maxRev) * plotH);
    const yCum = (v: number) => padT + plotH - (v / maxCum) * plotH;

    const cumPts = data.map((d, i) => ({ x: xS(i), y: yCum(d.cumulative) }));
    const cumLine = cumPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    const barW = Math.max(4, (plotW / n) * 0.6);

    const yGridVals = [0, maxRev * 0.25, maxRev * 0.5, maxRev * 0.75, maxRev].map((v) => Math.round(v));

    const labelEvery = n <= 14 ? 1 : n <= 30 ? 3 : 7;
    const labelIdxs = data.map((_, i) => i).filter((i) => i === 0 || i === n - 1 || i % labelEvery === 0);

    function fmtRevLabel(v: number): string {
        return currency.formatAmount(v);
    }

    return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
            <defs>
                <linearGradient id="revBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.3} />
                </linearGradient>
            </defs>

            {/* Y-axis grid + labels */}
            {yGridVals.map((v) => (
                <g key={v}>
                    <line x1={padL} y1={yBar(v)} x2={W - padR} y2={yBar(v)} stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
                    <text x={padL - 5} y={yBar(v) + 4} textAnchor="end" fontSize={9} fill="rgba(148,163,184,0.6)">{fmtRevLabel(v)}</text>
                </g>
            ))}

            {/* Bars (daily/weekly revenue) */}
            {data.map((d, i) => (
                <rect
                    key={i}
                    x={xS(i) - barW / 2}
                    y={yBar(d.revenueRecovered)}
                    width={barW}
                    height={barH2(d.revenueRecovered)}
                    rx={3}
                    fill="url(#revBarGrad)"
                >
                    <title>{d.label}: {d.revenueRecovered > 0 ? `${currency.symbol}${d.revenueRecovered.toLocaleString()}` : `${currency.symbol}0`} · Cumulative: {currency.symbol}{d.cumulative.toLocaleString()}</title>
                </rect>
            ))}

            {/* Cumulative line */}
            <path d={cumLine} fill="none" stroke="#6B3E2E" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="none" opacity={0.9} />
            {cumPts.filter((_, i) => i === 0 || i === n - 1).map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={4} fill="#6B3E2E" />
            ))}

            {/* X labels */}
            {labelIdxs.map((i) => (
                <text key={i} x={xS(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="rgba(148,163,184,0.65)">
                    {data[i].label}
                </text>
            ))}

            {/* Legend */}
            <g transform={`translate(${W - 200}, ${padT + 4})`}>
                <rect x={0} y={0} width={10} height={10} rx={2} fill="#10b981" opacity={0.8} />
                <text x={14} y={9} fontSize={9} fill="rgba(148,163,184,0.8)">Daily revenue</text>
                <line x1={85} y1={5} x2={99} y2={5} stroke="#6B3E2E" strokeWidth={2} />
                <circle cx={92} cy={5} r={3} fill="#6B3E2E" />
                <text x={104} y={9} fontSize={9} fill="rgba(148,163,184,0.8)">Cumulative</text>
            </g>
        </svg>
    );
}

// ── Channel revenue bars ─────────────────────

function ChannelRevenueChart({ data }: { data: ChannelRevenue[] }) {
    if (data.length === 0) return <EmptyChart message="No revenue data by channel yet" />;

    const maxRev = Math.max(...data.map((d) => d.revenueAttributed), 1);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.sort((a, b) => b.revenueAttributed - a.revenueAttributed).map((ch) => {
                const color = CHANNEL_COLOR[ch.channel] ?? '#64748b';
                const icon = CHANNEL_ICON[ch.channel] ?? <Icon icon={faEnvelope} />;
                const widthPct = Math.round((ch.revenueAttributed / maxRev) * 100);

                return (
                    <div key={ch.channel}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 34, height: 34, borderRadius: 8, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>
                                    {icon}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 13 }}>{ch.channel}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {ch.appointmentsInfluenced} appointments · {ch.percentageOfTotal}% of total
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 18, fontWeight: 800, color }}>{ch.formatted}</div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>attributed revenue</div>
                            </div>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-secondary)', overflow: 'hidden' }}>
                            <div style={{ width: `${widthPct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.7s ease' }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ── Empty state ──────────────────────────────

function EmptyChart({ message }: { message: string }) {
    return (
        <div style={{ height: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: 0.5 }}>
            <div style={{ fontSize: 28 }}><Icon icon={faChartLine} /></div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{message}</div>
        </div>
    );
}

// ── Period selector ──────────────────────────

function PeriodTabs({ value, onChange }: { value: number; onChange: (v: number) => void }) {
    return (
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-secondary)', borderRadius: 8, padding: 3 }}>
            {([7, 30, 90] as const).map((d) => (
                <button
                    key={d}
                    onClick={() => onChange(d)}
                    style={{
                        padding: '5px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: value === d ? 'var(--bg-card)' : 'transparent',
                        color: value === d ? 'var(--text-primary)' : 'var(--text-muted)',
                        boxShadow: value === d ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                        transition: 'all 0.15s',
                    }}
                >
                    {d}d
                </button>
            ))}
        </div>
    );
}

// ── Section header ───────────────────────────

function SectionHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
            <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: subtitle ? 3 : 0 }}>{title}</h2>
                {subtitle && <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{subtitle}</p>}
            </div>
            {right}
        </div>
    );
}

// ── Divider ──────────────────────────────────

function PageSection({ title, subtitle }: { title: string; subtitle: string }) {
    return (
        <div style={{ marginTop: 40, marginBottom: 24, paddingTop: 32, borderTop: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>{title}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>{subtitle}</p>
        </div>
    );
}

// ── Main page ────────────────────────────────

export default function AnalyticsPage() {
    const currency = useCurrency();
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [rateData, setRateData] = useState<RatePoint[]>([]);
    const [noShowData, setNoShowData] = useState<WeekPoint[]>([]);
    const [channelData, setChannelData] = useState<ChannelStat[]>([]);
    const [period, setPeriod] = useState<number>(30);
    const [loading, setLoading] = useState(true);

    // Revenue Analytics state
    const [snapshot, setSnapshot] = useState<RevenueSnapshot | null>(null);
    const [summary, setSummary] = useState<RevenueSummary | null>(null);
    const [revenueTime, setRevenueTime] = useState<RevenueTimePoint[]>([]);
    const [channelRevenue, setChannelRevenue] = useState<ChannelRevenue[]>([]);
    const [revPeriod, setRevPeriod] = useState<number>(30);
    const [revLoading, setRevLoading] = useState(true);

    // Load standard analytics
    useEffect(() => {
        api.get('/analytics/hero-metrics').then(({ data }) => setMetrics(data)).catch(() => { });
        api.get('/analytics/channel-performance').then(({ data }) => setChannelData(data)).catch(() => { });
        api.get('/analytics/no-show-reduction?weeks=8').then(({ data }) => setNoShowData(data)).catch(() => { });
    }, []);

    // Load revenue analytics
    useEffect(() => {
        api.get('/revenue-analytics/snapshot').then(({ data }) => setSnapshot(data)).catch(() => { });
        api.get('/revenue-analytics/summary').then(({ data }) => setSummary(data)).catch(() => { });
        api.get('/revenue-analytics/by-channel').then(({ data }) => setChannelRevenue(data)).catch(() => { });
    }, []);

    const loadRate = useCallback((days: number) => {
        setLoading(true);
        api.get(`/analytics/confirmation-rate?days=${days}`)
            .then(({ data }) => setRateData(data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    const loadRevenueTime = useCallback((days: number) => {
        setRevLoading(true);
        api.get(`/revenue-analytics/over-time?days=${days}`)
            .then(({ data }) => setRevenueTime(data))
            .catch(() => { })
            .finally(() => setRevLoading(false));
    }, []);

    useEffect(() => { loadRate(period); }, [period, loadRate]);
    useEffect(() => { loadRevenueTime(revPeriod); }, [revPeriod, loadRevenueTime]);

    const hasData = metrics && metrics.allTime.totalAppointments > 0;
    const w = metrics?.week;
    const allTime = metrics?.allTime;

    return (
        <div>
            {/* ── Page header ─────────────────────────── */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Analytics</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    Appointment performance, confirmation trends, and channel delivery insights
                </p>
            </div>

            {!loading && !hasData ? (
                <EmptyState
                    title="No analytics data yet"
                    description="Analytics will appear here once your first reminder messages are sent. Start a campaign or sync your appointments to see performance insights."
                    icon={faChartBar}
                    ctaLabel="Go to Campaigns"
                    ctaHref="/dashboard/campaigns"
                />
            ) : (
                <>
                    <FeatureBanner
                        src="/images/features/analytics-dashboard.jpg"
                        title="Business Analytics"
                        description="Track confirmation rates over time, measure no-show reduction week by week, and compare delivery performance across SMS, WhatsApp, and Voice channels."
                        accent="#6B3E2E"
                    />

                    {/* ── Hero metrics ───────────────────────── */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                        <MetricCard
                            icon={<Icon icon={faCalendar} />}
                            label="Appointments This Week"
                            value={w?.appointments.value ?? '—'}
                            sub={allTime ? `${allTime.totalAppointments.toLocaleString()} all-time` : undefined}
                            trend={w?.appointments.trend}
                            accent="#6B3E2E"
                        />
                        <MetricCard
                            icon={<Icon icon={faCheck} />}
                            label="Confirmed Automatically"
                            value={w ? `${w.confirmed.value} (${w.confirmed.rate}%)` : '—'}
                            sub={allTime ? `${allTime.confirmationRate}% all-time rate` : undefined}
                            trend={w?.confirmed.trend}
                            accent="#6B3E2E"
                        />
                        <MetricCard
                            icon={<Icon icon={faShieldHalved} />}
                            label="No-Shows Prevented"
                            value={w?.noShowsPrevented.value ?? '—'}
                            sub="Appointments confirmed via reminder"
                            trend={w?.noShowsPrevented.trend}
                            accent="#F7941D"
                        />
                        <MetricCard
                            icon={<Icon icon={faCoins} />}
                            label="Revenue Recovered"
                            value={w?.revenueSaved.formatted ?? '—'}
                            sub="Est. based on avg appointment value"
                            trend={w?.revenueSaved.trend}
                            accent="#10b981"
                        />
                    </div>
                </>
            )}

            {/* ── Confirmation rate over time ─────────── */}
            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', overflow: 'hidden', marginBottom: 20 }}>
                <SectionHeader
                    title="Confirmation Rate Over Time"
                    subtitle="Daily % of appointments that were confirmed or completed"
                    right={<PeriodTabs value={period} onChange={(d) => { setPeriod(d); loadRate(d); }} />}
                />
                {loading ? (
                    <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                        Loading chart…
                    </div>
                ) : (
                    <ConfirmationRateChart data={rateData} days={period} />
                )}
                {rateData.length > 0 && (() => {
                    const withData = rateData.filter((d) => d.total > 0);
                    const avg = withData.length > 0
                        ? Math.round(withData.reduce((s, d) => s + (d.rate ?? 0), 0) / withData.length)
                        : 0;
                    const peak = withData.length > 0 ? Math.max(...withData.map((d) => d.rate ?? 0)) : 0;
                    return (
                        <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>AVG RATE ({period}d)</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: '#F7941D' }}>{avg}%</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PEAK DAY</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: '#22c55e' }}>{peak}%</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>DAYS WITH DATA</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>{withData.length}</div>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* ── Bottom two panels ──────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 20 }}>
                <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', overflow: 'hidden' }}>
                    <SectionHeader
                        title="No-Show Reduction"
                        subtitle="Weekly prevented no-shows vs actual no-shows (last 8 weeks)"
                    />
                    <NoShowReductionChart data={noShowData} />
                    {noShowData.length > 0 && (() => {
                        const totalPrevented = noShowData.reduce((s, d) => s + d.prevented, 0);
                        const totalNoShows = noShowData.reduce((s, d) => s + d.noShows, 0);
                        const total = noShowData.reduce((s, d) => s + d.total, 0);
                        return (
                            <div style={{ display: 'flex', gap: 20, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, marginBottom: 2 }}>PREVENTED</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#22c55e' }}>{totalPrevented}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: '#f87171', fontWeight: 700, marginBottom: 2 }}>NO-SHOWS</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#f87171' }}>{totalNoShows}</div>
                                </div>
                                <div style={{ marginLeft: 'auto' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>SAVE RATE</div>
                                    <div style={{ fontSize: 18, fontWeight: 800 }}>
                                        {total > 0 ? Math.round((totalPrevented / total) * 100) : 0}%
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', overflow: 'hidden' }}>
                    <SectionHeader
                        title="Channel Performance"
                        subtitle="Delivery stats across all messaging channels"
                    />
                    <ChannelPerformance data={channelData} />
                    {channelData.length > 0 && (() => {
                        const totalSent = channelData.reduce((s, c) => s + c.sent, 0);
                        const totalDelivered = channelData.reduce((s, c) => s + c.delivered, 0);
                        const overallRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
                        return (
                            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>TOTAL SENT</div>
                                    <div style={{ fontSize: 18, fontWeight: 800 }}>{totalSent.toLocaleString()}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>OVERALL RATE</div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: overallRate >= 80 ? '#22c55e' : overallRate >= 60 ? '#f59e0b' : '#f87171' }}>
                                        {overallRate}%
                                    </div>
                                </div>
                                <div style={{ marginLeft: 'auto' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>CHANNELS ACTIVE</div>
                                    <div style={{ fontSize: 18, fontWeight: 800 }}>{channelData.length}</div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* ════════════════════════════════════════════
                REVENUE ANALYTICS SECTION
                ════════════════════════════════════════════ */}

            <PageSection
                title="Revenue Analytics"
                subtitle="Track the direct financial impact of your appointment reminders — revenue recovered, ROI, and channel attribution."
            />

            <FeatureBanner
                src="/images/features/revenue-analytics.jpg"
                title="Revenue Recovery Engine"
                description="Every no-show prevented is revenue recovered. See exactly how much Meetora earns back for your business — broken down by time period, channel, and projected growth."
                accent="#10b981"
            />

            {/* ── 5 key revenue metrics ──────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 24 }}>
                <StatTile
                    icon={<Icon icon={faCalendar} />}
                    label="Appointments Booked"
                    value={snapshot?.appointments_booked ?? '—'}
                    accent="#6366f1"
                />
                <StatTile
                    icon={<Icon icon={faCheck} />}
                    label="Appointments Confirmed"
                    value={snapshot?.appointments_confirmed ?? '—'}
                    accent="#22c55e"
                />
                <StatTile
                    icon={<Icon icon={faShieldHalved} />}
                    label="No-Shows Prevented"
                    value={snapshot?.no_shows_prevented ?? '—'}
                    accent="#f59e0b"
                />
                <StatTile
                    icon={<Icon icon={faCoins} />}
                    label="Revenue Recovered"
                    value={snapshot?.revenue_recovered_formatted ?? '—'}
                    accent="#10b981"
                />
                <StatTile
                    icon={<Icon icon={faChartBar} />}
                    label="Confirmation Rate"
                    value={snapshot ? `${snapshot.confirmation_rate}%` : '—'}
                    accent="#6B3E2E"
                />
            </div>

            {/* ── Revenue over time + ROI panel ─────── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 20, marginBottom: 20 }}>

                {/* Revenue over time chart */}
                <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', overflow: 'hidden' }}>
                    <SectionHeader
                        title="Revenue Recovered Over Time"
                        subtitle="Daily revenue from no-shows prevented + cumulative total"
                        right={<PeriodTabs value={revPeriod} onChange={(d) => { setRevPeriod(d); loadRevenueTime(d); }} />}
                    />
                    {revLoading ? (
                        <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                            Loading chart…
                        </div>
                    ) : (
                        <RevenueOverTimeChart data={revenueTime} days={revPeriod} />
                    )}

                    {revenueTime.length > 0 && (() => {
                        const total = revenueTime.reduce((s, d) => s + d.revenueRecovered, 0);
                        const lastPoint = revenueTime[revenueTime.length - 1];
                        return (
                            <div style={{ display: 'flex', gap: 24, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>PERIOD TOTAL</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: '#10b981' }}>
                                        ${total.toLocaleString()}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>CUMULATIVE</div>
                                    <div style={{ fontSize: 20, fontWeight: 800, color: '#f59e0b' }}>
                                        ${lastPoint?.cumulative.toLocaleString() ?? 0}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ROI + projections panel */}
                <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', overflow: 'hidden' }}>
                    <SectionHeader
                        title="ROI & Projections"
                        subtitle="Return on investment and forward-looking estimates"
                    />

                    {summary ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {/* Weekly / Monthly / All-time */}
                            {[
                                { label: 'This Week', data: summary.weekly, color: '#6366f1' },
                                { label: 'Last 30 Days', data: summary.monthly, color: '#10b981' },
                                { label: 'All Time', data: summary.allTime, color: '#f59e0b' },
                            ].map(({ label, data, color }) => (
                                <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)' }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>{label.toUpperCase()}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                            {data.noShowsPrevented} prevented
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color }}>{data.formatted}</div>
                                </div>
                            ))}

                            {/* Projected */}
                            <div style={{ padding: '14px 16px', background: 'rgba(16,185,129,0.06)', borderRadius: 10, border: '1px solid rgba(16,185,129,0.2)' }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', marginBottom: 4 }}>PROJECTED MONTHLY REVENUE</div>
                                <div style={{ fontSize: 26, fontWeight: 800, color: '#10b981' }}>{summary.projectedMonthlyRevenue.formatted}</div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                    Based on current weekly pace · {summary.projectedMonthlyRevenue.noShowsPrevented} prevented/mo
                                </div>
                            </div>

                            {/* ROI */}
                            <div style={{ padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 10, border: '1px solid var(--border)', display: 'flex', gap: 20 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>MSG COST</div>
                                    <div style={{ fontSize: 16, fontWeight: 700 }}>${summary.roi.estimatedMessagingCost.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>NET REVENUE</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: '#10b981' }}>${summary.roi.netRevenue.toLocaleString()}</div>
                                </div>
                                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>ROI</div>
                                    <div style={{ fontSize: 22, fontWeight: 800, color: summary.roi.roiPercent > 0 ? '#22c55e' : '#f87171' }}>
                                        {summary.roi.roiPercent > 0 ? '+' : ''}{summary.roi.roiPercent}%
                                    </div>
                                </div>
                            </div>

                            <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
                                Avg appointment value: {currency.symbol}{summary.avgAppointmentValue} · Est. {currency.perMessageEst}/message
                            </div>
                        </div>
                    ) : (
                        <EmptyChart message="Loading revenue summary…" />
                    )}
                </div>
            </div>

            {/* ── Channel revenue attribution ─────────── */}
            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', overflow: 'hidden' }}>
                <SectionHeader
                    title="Revenue by Channel"
                    subtitle="Which channels influenced the most appointment confirmations"
                />
                <ChannelRevenueChart data={channelRevenue} />

                {channelRevenue.length > 0 && (() => {
                    const totalRev = channelRevenue.reduce((s, c) => s + c.revenueAttributed, 0);
                    const topChannel = channelRevenue.sort((a, b) => b.revenueAttributed - a.revenueAttributed)[0];
                    return (
                        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>TOTAL ATTRIBUTED</div>
                                <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>${totalRev.toLocaleString()}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>TOP CHANNEL</div>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>
                                    {CHANNEL_ICON[topChannel.channel] ?? ''} {topChannel.channel}
                                </div>
                            </div>
                            <div style={{ marginLeft: 'auto' }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>CHANNELS</div>
                                <div style={{ fontSize: 18, fontWeight: 800 }}>{channelRevenue.length}</div>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
