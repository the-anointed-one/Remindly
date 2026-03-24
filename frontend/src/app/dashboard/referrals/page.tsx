'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faGift, faCommentSms, faCopy, faCheck, faRocket } from '@fortawesome/free-solid-svg-icons';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface ReferralEntry {
    id: string;
    referredAt: string;
    rewardIssued: boolean;
    rewardIssuedAt?: string;
    rewardValue: number;
    referred: {
        id: string;
        name: string;
        tenantName: string;
        joinedAt: string;
    };
}

interface ReferralStats {
    code: string;
    referralLink: string;
    totalReferrals: number;
    rewardsIssued: number;
    totalCreditsEarned: number;
    rewardPerReferral: number;
    referrals: ReferralEntry[];
}

export default function ReferralsPage() {
    const [stats, setStats] = useState<ReferralStats | null>(null);
    const [loading, setLoading] = useState(true);

    // Apply code form
    const [showApply, setShowApply] = useState(false);
    const [applyCode, setApplyCode] = useState('');
    const [applying, setApplying] = useState(false);
    const [applyResult, setApplyResult] = useState<{ success: boolean; message: string } | null>(null);

    // Copy state
    const [copied, setCopied] = useState<'code' | 'link' | null>(null);

    const fetchStats = useCallback(async () => {
        try {
            const { data } = await api.get('/referrals/stats');
            setStats(data);
        } catch { } finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const copyToClipboard = async (text: string, type: 'code' | 'link') => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(type);
            setTimeout(() => setCopied(null), 2000);
        } catch { }
    };

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        setApplying(true);
        setApplyResult(null);
        try {
            const { data } = await api.post('/referrals/apply', { code: applyCode.trim().toUpperCase() });
            setApplyResult({ success: true, message: `Code applied! ${data.referrerName} earned ${data.rewardValue} SMS credits.` });
            setApplyCode('');
            setShowApply(false);
        } catch (err: any) {
            const msg = err.response?.data?.message;
            setApplyResult({ success: false, message: Array.isArray(msg) ? msg.join(', ') : (msg || 'Failed to apply code') });
        } finally { setApplying(false); }
    };

    if (loading) {
        return <p style={{ color: 'var(--text-muted)' }}>Loading...</p>;
    }

    if (!stats) {
        return <p style={{ color: '#f87171' }}>Failed to load referral data.</p>;
    }

    return (
        <div>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>Referral Program</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
                    Invite other businesses to Meetora. For every person who signs up with your code, you earn {stats.rewardPerReferral} free SMS credits.
                </p>
            </div>

            {/* Apply result banner */}
            {applyResult && (
                <div style={{
                    marginBottom: 24, padding: '12px 16px', borderRadius: 10,
                    background: applyResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${applyResult.success ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                    color: applyResult.success ? '#4ade80' : '#f87171',
                    fontSize: 14,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                    <span><FontAwesomeIcon icon={applyResult.success ? faCheck : faCopy} style={{ marginRight: 6 }} />{applyResult.message}</span>
                    <button onClick={() => setApplyResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 16 }}>×</button>
                </div>
            )}

            {/* Top row: stats + referral card */}
            <div className="grid-3" style={{ gap: 16, marginBottom: 24 }}>
                <StatCard value={stats.totalReferrals} label="Total Referrals" icon={faUsers} />
                <StatCard value={stats.rewardsIssued} label="Rewards Issued" icon={faGift} />
                <StatCard value={`${stats.totalCreditsEarned}`} label="SMS Credits Earned" icon={faCommentSms} suffix=" credits" />
            </div>

            {/* Referral code card */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-5">
                    <div>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Your Referral Code</h3>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Share this code or link — earn {stats.rewardPerReferral} SMS credits per sign-up.
                        </p>
                    </div>
                    <button
                        className="btn btn-sm w-full sm:w-auto"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 12 }}
                        onClick={() => setShowApply(!showApply)}
                    >
                        {showApply ? 'Cancel' : 'Apply a Code'}
                    </button>
                </div>

                {/* Code display */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <div style={{
                        flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 12,
                        background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: 10, padding: '12px 20px',
                    }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 800, letterSpacing: '0.15em', color: '#a5b4fc' }}>
                            {stats.code}
                        </span>
                        <button
                            onClick={() => copyToClipboard(stats.code, 'code')}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: copied === 'code' ? '#4ade80' : 'var(--text-muted)' }}
                            title="Copy code"
                        >
                            <FontAwesomeIcon icon={copied === 'code' ? faCheck : faCopy} />
                        </button>
                    </div>
                </div>

                {/* Shareable link */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-3" style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8, padding: '10px 14px',
                }}>
                    <span style={{ flex: 1, fontFamily: 'monospace', fontSize: 13, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                        {stats.referralLink}
                    </span>
                    <button
                        onClick={() => copyToClipboard(stats.referralLink, 'link')}
                        className="btn btn-primary btn-sm w-full sm:w-auto"
                        style={{ flexShrink: 0 }}
                    >
                        <FontAwesomeIcon icon={copied === 'link' ? faCheck : faCopy} style={{ marginRight: 6 }} />{copied === 'link' ? 'Copied' : 'Copy Link'}
                    </button>
                </div>

                {/* Apply code form */}
                {showApply && (
                    <form onSubmit={handleApply} style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                            <label className="input-label">Enter a referral code</label>
                            <input
                                className="input"
                                value={applyCode}
                                onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
                                placeholder="XXXXXXXX"
                                maxLength={8}
                                style={{ fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={applying || applyCode.length !== 8}>
                            {applying ? 'Applying...' : 'Apply Code'}
                        </button>
                    </form>
                )}
            </div>

            {/* How it works */}
            <div className="card" style={{ marginBottom: 24, background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>How It Works</h3>
                <div className="grid-3" style={{ gap: 16 }}>
                    {[
                        { step: '1', title: 'Share your code', desc: 'Send your unique referral code or link to another business.' },
                        { step: '2', title: 'They sign up', desc: 'They register on Meetora and apply your code on their dashboard.' },
                        { step: '3', title: 'You get credits', desc: `You instantly receive ${stats.rewardPerReferral} free SMS credits on your account.` },
                    ].map((s) => (
                        <div key={s.step} style={{ display: 'flex', gap: 12 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, fontSize: 13, color: '#a5b4fc',
                            }}>
                                {s.step}
                            </div>
                            <div>
                                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>{s.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Referral history */}
            <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Referral History</h3>
                {stats.referrals.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
                        <div style={{ fontSize: 32, marginBottom: 12, color: 'var(--accent-primary)' }}><FontAwesomeIcon icon={faRocket} /></div>
                        <h4 style={{ fontSize: 15, marginBottom: 8 }}>No referrals yet</h4>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                            Share your code above to start earning free SMS credits.
                        </p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Referred Business</th>
                                    <th>Joined</th>
                                    <th>Reward</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.referrals.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: 14 }}>{r.referred.name}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.referred.tenantName}</div>
                                        </td>
                                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                                            {new Date(r.referred.joinedAt).toLocaleDateString()}
                                        </td>
                                        <td style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc' }}>
                                            +{r.rewardValue} SMS
                                        </td>
                                        <td>
                                            {r.rewardIssued ? (
                                                <span className="badge badge-success">Credited</span>
                                            ) : (
                                                <span className="badge badge-warning">Pending</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({ value, label, icon, suffix = '' }: { value: string | number; label: string; icon: IconDefinition; suffix?: string }) {
    return (
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 8, color: 'var(--accent-primary)' }}><FontAwesomeIcon icon={icon} /></div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
                {value}{suffix}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label}</div>
        </div>
    );
}
