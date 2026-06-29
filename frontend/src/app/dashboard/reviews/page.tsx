'use client';

import { useState, useEffect, useCallback } from 'react';
import FeatureBanner from '@/components/FeatureBanner';
import Icon from '@/components/ui/Icon';
import EmptyState from '@/components/EmptyState';
import { faChartBar, faSmile, faStar, faExclamationTriangle, faInbox, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

// ── Types ────────────────────────────────────

interface ReputationStats {
    total: number;
    positive: number;
    neutral: number;
    negative: number;
    avgRating: number;
    satisfactionRate: number;
    recentResponses: FeedbackResponse[];
}

interface FeedbackRequest {
    phone: string;
    appointmentId: string;
}

interface FeedbackResponse {
    id: string;
    rating: number;
    sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    reviewLinkSent: boolean;
    privateFormSent: boolean;
    receivedAt: string;
    request: FeedbackRequest;
}

interface ResponsesPayload {
    data: FeedbackResponse[];
    total: number;
    page: number;
    limit: number;
}

// ── Helpers ──────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

function authHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...authHeaders(), ...(options?.headers ?? {}) } });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Request failed: ${res.status}`);
    }
    return res.json() as Promise<T>;
}

function maskPhone(phone: string): string {
    if (!phone || phone.length < 7) return phone;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return phone;
    return `+${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function ratingLabel(rating: number): React.ReactNode {
    if (rating === 1) return <><Icon icon={faStar} className="text-warning" /><Icon icon={faStar} className="text-warning" /><Icon icon={faStar} className="text-warning" /> Great</>;
    if (rating === 2) return <><Icon icon={faStar} className="text-warning" /><Icon icon={faStar} className="text-warning" /> Okay</>;
    return <><Icon icon={faStar} className="text-warning" /> Not Great</>;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Sub-components ───────────────────────────

function SentimentBadge({ sentiment }: { sentiment: FeedbackResponse['sentiment'] }) {
    const map: Record<FeedbackResponse['sentiment'], { label: string; color: string; bg: string; border: string }> = {
        POSITIVE: { label: 'Positive', color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
        NEUTRAL: { label: 'Neutral', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.25)' },
        NEGATIVE: { label: 'Negative', color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
    };
    const m = map[sentiment];
    return (
        <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.05em',
            color: m.color, background: m.bg, border: `1px solid ${m.border}`,
            borderRadius: 100, padding: '3px 10px', whiteSpace: 'nowrap',
        }}>
            {m.label}
        </span>
    );
}

function StatCard({
    icon, label, value, color, sub,
}: {
    icon: string;
    label: string;
    value: string | number;
    color: string;
    sub?: string;
}) {
    return (
        <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: '22px 24px',
            position: 'relative',
            overflow: 'hidden',
        }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: color, borderRadius: '14px 14px 0 0' }} />
            <div style={{ fontSize: 22, marginBottom: 10 }}>{typeof icon === 'string' ? icon : <Icon icon={icon as any} />}</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color, marginBottom: 4, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</div>
            {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{sub}</div>}
        </div>
    );
}

function RatingBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>
                    {count} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>({pct}%)</span>
                </span>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: color,
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                }} />
            </div>
        </div>
    );
}

function Spinner() {
    return (
        <div style={{
            display: 'inline-block',
            width: 28, height: 28,
            border: '3px solid rgba(16,185,129,0.2)',
            borderTopColor: '#10b981',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
        }} />
    );
}

// ── Main Page ────────────────────────────────

export default function ReviewsPage() {
    const [stats, setStats] = useState<ReputationStats | null>(null);
    const [responses, setResponses] = useState<FeedbackResponse[]>([]);
    const [respTotal, setRespTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loadingStats, setLoadingStats] = useState(true);
    const [loadingResponses, setLoadingResponses] = useState(true);
    const [error, setError] = useState('');
    const [triggeringId, setTriggeringId] = useState<string | null>(null);
    const [triggerSuccess, setTriggerSuccess] = useState<string | null>(null);

    const LIMIT = 20;

    // ── Fetch stats ──────────────────────────

    const fetchStats = useCallback(async () => {
        setLoadingStats(true);
        try {
            const data = await apiFetch<ReputationStats>('/reputation/stats');
            setStats(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load stats.');
        } finally {
            setLoadingStats(false);
        }
    }, []);

    // ── Fetch responses ──────────────────────

    const fetchResponses = useCallback(async (p: number) => {
        setLoadingResponses(true);
        try {
            const data = await apiFetch<ResponsesPayload>(`/reputation/responses?page=${p}&limit=${LIMIT}`);
            setResponses(data.data);
            setRespTotal(data.total);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load responses.');
        } finally {
            setLoadingResponses(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    useEffect(() => {
        fetchResponses(page);
    }, [fetchResponses, page]);

    // ── Manually trigger feedback request ───

    const handleTrigger = async (appointmentId: string) => {
        setTriggeringId(appointmentId);
        setTriggerSuccess(null);
        setError('');
        try {
            await apiFetch(`/reputation/request/${appointmentId}`, { method: 'POST' });
            setTriggerSuccess(appointmentId);
            setTimeout(() => setTriggerSuccess(null), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send request.');
        } finally {
            setTriggeringId(null);
        }
    };

    // ── Derived values ───────────────────────

    const totalPages = Math.ceil(respTotal / LIMIT);

    const satisfactionColor = stats
        ? stats.satisfactionRate > 70
            ? '#10b981'
            : stats.satisfactionRate >= 40
                ? '#F7941D'
                : '#ef4444'
        : '#10b981';

    // ── Render ───────────────────────────────

    return (
        <div>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>

            {/* Page header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Reputation &amp; Reviews</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                    Client feedback automation — capture sentiment and grow your Google reviews automatically.
                </p>
            </div>

            <FeatureBanner
                src="/images/features/review-automation.jpg"
                title="Reputation Automation"
                description="Automatically collect feedback after every appointment. Happy clients get a Google review link. Unhappy ones get a private resolution."
                accent="#10b981"
            />

            {/* Error banner */}
            {error && (
                <div style={{
                    marginBottom: 20, padding: '12px 16px', borderRadius: 10,
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                    color: '#f87171', fontSize: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span>{error}</span>
                    <button
                        onClick={() => setError('')}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', padding: '0 4px', fontSize: 16 }}
                        aria-label="Dismiss error"
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Stats Cards ──────────────────────── */}
            {loadingStats ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                    <Spinner />
                </div>
            ) : stats ? (
                <>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: 16,
                        marginBottom: 24,
                    }}>
                        <StatCard
                            icon={faChartBar as any}
                            label="Total Feedback"
                            value={stats.total}
                            color="#6B3E2E"
                            sub={`Avg rating: ${stats.avgRating.toFixed(1)}`}
                        />
                        <StatCard
                            icon={faSmile as any}
                            label="Satisfaction Rate"
                            value={`${stats.satisfactionRate}%`}
                            color={satisfactionColor}
                            sub={stats.satisfactionRate > 70 ? 'Excellent' : stats.satisfactionRate >= 40 ? 'Needs attention' : 'Critical'}
                        />
                        <StatCard
                            icon={faStar as any}
                            label="Positive Reviews"
                            value={stats.positive}
                            color="#10b981"
                            sub={stats.total > 0 ? `${Math.round((stats.positive / stats.total) * 100)}% of all feedback` : undefined}
                        />
                        <StatCard
                            icon={faExclamationTriangle as any}
                            label="Need Attention"
                            value={stats.negative}
                            color={stats.negative > 0 ? '#ef4444' : '#64748b'}
                            sub={stats.negative > 0 ? 'Follow up recommended' : 'All clear'}
                        />
                    </div>

                    {/* ── Rating Breakdown Bar ──────────── */}
                    <div style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 14,
                        padding: '24px 28px',
                        marginBottom: 28,
                    }}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Rating Breakdown</h2>
                        <RatingBar label="Positive / Great (3 Stars)" count={stats.positive} total={stats.total} color="#10b981" />
                        <RatingBar label="Okay (2 Stars)" count={stats.neutral} total={stats.total} color="#F7941D" />
                        <RatingBar label="Not Great (1 Star)" count={stats.negative} total={stats.total} color="#ef4444" />
                        <div style={{ paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 4, display: 'flex', gap: 24 }}>
                            <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>TOTAL RESPONSES</div>
                                <div style={{ fontSize: 20, fontWeight: 800 }}>{stats.total}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>AVG RATING</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: '#F7941D' }}>{stats.avgRating.toFixed(1)}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', marginBottom: 2 }}>SATISFACTION</div>
                                <div style={{ fontSize: 20, fontWeight: 800, color: satisfactionColor }}>{stats.satisfactionRate}%</div>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, padding: '48px 32px',
                    textAlign: 'center', marginBottom: 28,
                }}>
                    <div style={{ fontSize: 36, marginBottom: 12, color: 'var(--text-muted)' }}><Icon icon={faChartBar} /></div>
                    <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>No stats available yet. Stats will appear once clients start submitting feedback.</p>
                </div>
            )}

            {/* ── Recent Responses Table ───────────── */}
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14,
                overflow: 'hidden',
            }}>
                {/* Table header row */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
                    flexWrap: 'wrap', gap: 12,
                }}>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>Recent Responses</h2>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {respTotal > 0 ? `${respTotal} total response${respTotal !== 1 ? 's' : ''}` : 'No responses yet'}
                        </p>
                    </div>
                    <button
                        onClick={() => { fetchStats(); fetchResponses(page); }}
                        style={{
                            padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
                            color: '#10b981', fontSize: 13, fontWeight: 600,
                        }}
                    >
                        ↻ Refresh
                    </button>
                </div>

                {loadingResponses ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
                        <Spinner />
                    </div>
                ) : responses.length === 0 ? (
                    <EmptyState
                        title="No reviews or feedback yet"
                        description="Your reputation data will appear here once customers start responding to your feedback requests. Send your first request to get started."
                        icon={faStar}
                        ctaLabel="Go to Contacts"
                        ctaHref="/dashboard/contacts"
                    />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Date', 'Phone', 'Rating', 'Sentiment', 'Review Link', 'Actions'].map((col) => (
                                        <th key={col} style={{
                                            padding: '10px 18px', textAlign: 'left',
                                            fontSize: 10, fontWeight: 700, letterSpacing: '0.07em',
                                            color: 'var(--text-muted)', textTransform: 'uppercase',
                                            background: 'rgba(255,255,255,0.02)',
                                        }}>
                                            {col}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {responses.map((r, idx) => {
                                    const isTriggering = triggeringId === r.request?.appointmentId;
                                    const isSuccess = triggerSuccess === r.request?.appointmentId;
                                    return (
                                        <tr
                                            key={r.id}
                                            style={{
                                                borderBottom: idx < responses.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                                transition: 'background 0.15s',
                                            }}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            {/* Date */}
                                            <td style={{ padding: '14px 18px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                {formatDate(r.receivedAt)}
                                            </td>

                                            {/* Phone */}
                                            <td style={{ padding: '14px 18px', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                {maskPhone(r.request?.phone ?? '')}
                                            </td>

                                            {/* Rating */}
                                            <td style={{ padding: '14px 18px', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontSize: 13 }}>{ratingLabel(r.rating)}</span>
                                            </td>

                                            {/* Sentiment */}
                                            <td style={{ padding: '14px 18px' }}>
                                                <SentimentBadge sentiment={r.sentiment} />
                                            </td>

                                            {/* Review Link Sent */}
                                            <td style={{ padding: '14px 18px', textAlign: 'center' }}>
                                                <span
                                                    title={r.reviewLinkSent ? 'Review link sent' : 'Review link not sent'}
                                                    style={{ fontSize: 16, color: r.reviewLinkSent ? '#10b981' : '#ef4444' }}
                                                >
                                                    {r.reviewLinkSent ? <Icon icon={faCheck} /> : <Icon icon={faTimes} />}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td style={{ padding: '14px 18px' }}>
                                                {r.request?.appointmentId ? (
                                                    <button
                                                        onClick={() => handleTrigger(r.request.appointmentId)}
                                                        disabled={isTriggering || isSuccess}
                                                        style={{
                                                            padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                                                            cursor: isTriggering || isSuccess ? 'default' : 'pointer',
                                                            background: isSuccess
                                                                ? 'rgba(16,185,129,0.15)'
                                                                : 'rgba(255,255,255,0.05)',
                                                            border: isSuccess
                                                                ? '1px solid rgba(16,185,129,0.35)'
                                                                : '1px solid rgba(255,255,255,0.1)',
                                                            color: isSuccess ? '#10b981' : 'var(--text-secondary)',
                                                            opacity: isTriggering ? 0.6 : 1,
                                                            whiteSpace: 'nowrap',
                                                        }}
                                                    >
                                                        {isTriggering ? 'Sending…' : isSuccess ? '✓ Sent' : '↩ Resend'}
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div style={{
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
                        padding: '18px 24px', borderTop: '1px solid rgba(255,255,255,0.06)',
                    }}>
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            style={{
                                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: page === 1 ? 'default' : 'pointer',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--text-secondary)', opacity: page === 1 ? 0.4 : 1,
                            }}
                        >
                            ← Prev
                        </button>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 8px' }}>
                            {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            style={{
                                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: page === totalPages ? 'default' : 'pointer',
                                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                                color: 'var(--text-secondary)', opacity: page === totalPages ? 0.4 : 1,
                            }}
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
