'use client';

import { useState, useRef, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { faLock, faExclamationTriangle, faWandMagicSparkles, faChartLine, faPalette, faBullseye, faClipboard, faRobot } from '@fortawesome/free-solid-svg-icons';

type AITab = 'generate' | 'improve' | 'tone' | 'optimize';

export default function AIPage() {
    const { plan, usage, refreshUsage, loading: authLoading } = useAuth();
    const [tab, setTab] = useState<AITab>('generate');
    const [result, setResult] = useState<string>('');
    const isMounted = useRef(true);

    useEffect(() => {
        return () => { isMounted.current = false; };
    }, []);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Generate form
    const [genForm, setGenForm] = useState({ businessType: '', channel: 'SMS', purpose: 'appointment reminder', tone: 'professional' });
    // Improve/Tone/Optimize forms
    const [templateInput, setTemplateInput] = useState('');
    const [improvementGoal, setImprovementGoal] = useState('');
    const [targetTone, setTargetTone] = useState('casual');

    const effectiveUsage = usage || { ai: { used: 0, limit: 0 } };
    const notEligible = plan !== 'SMS_VOICE_AI';
    const limitReached = (effectiveUsage.ai?.used ?? 0) >= (effectiveUsage.ai?.limit ?? 0);

    const callAI = async (endpoint: string, body: object) => {
        if (!isMounted.current) return;
        setError('');
        setResult('');
        setLoading(true);
        try {
            const { data } = await api.post(`/ai/${endpoint}`, body);
            if (isMounted.current) {
                setResult(data.text || data.improved || data.rewritten || data.optimized || '');
            }
            await refreshUsage();
        } catch (err: any) {
            if (isMounted.current) {
                setError(err.response?.data?.message || 'AI request failed');
            }
        } finally {
            if (isMounted.current) setLoading(false);
        }
    };

    if (authLoading) {
        return (
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>AI Assistant</h1>
                <p style={{ color: 'var(--text-muted)' }}>Loading user & usage information…</p>
            </div>
        );
    }

    if (notEligible) {
        return (
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>AI Assistant</h1>
                <div className="card" style={{ textAlign: 'center', padding: 'clamp(24px, 5vw, 64px)' }}>
                    <div style={{ fontSize: 64, marginBottom: 16, color: 'var(--text-muted)' }}><Icon icon={faLock} /></div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>AI Requires Tier 3</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                        AI-powered template generation, improvement, and optimization is available on the SMS + Voice + AI plan.
                    </p>
                    <Link href="/dashboard/billing" className="btn btn-primary">Upgrade to Tier 3 →</Link>
                </div>
            </div>
        );
    }

    if (limitReached) {
        return (
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>AI Assistant</h1>
                <div className="card" style={{ textAlign: 'center', padding: 'clamp(24px, 5vw, 64px)' }}>
                    <div style={{ fontSize: 64, marginBottom: 16, color: 'var(--text-muted)' }}><Icon icon={faExclamationTriangle} /></div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>AI Limit Reached</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        You&apos;ve used {effectiveUsage.ai?.used ?? 0}/{effectiveUsage.ai?.limit ?? 0} AI requests. Resets on your next billing cycle.
                    </p>
                </div>
            </div>
        );
    }

    const tabs: { key: AITab; label: string; icon: any }[] = [
        { key: 'generate', label: 'Generate', icon: faWandMagicSparkles },
        { key: 'improve', label: 'Improve', icon: faChartLine },
        { key: 'tone', label: 'Change Tone', icon: faPalette },
        { key: 'optimize', label: 'Optimize', icon: faBullseye },
    ];

    return (
        <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>AI Assistant</h1>
                <span className="badge badge-accent">{(effectiveUsage.ai?.limit ?? 0) - (effectiveUsage.ai?.used ?? 0)} requests remaining</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
                {tabs.map((t) => (
                    <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => { setTab(t.key); setResult(''); setError(''); }}>
                        <Icon icon={t.icon} className="mr-1.5" /> {t.label}
                    </button>
                ))}
            </div>

            <div className="grid-2">
                {/* Input */}
                <div className="card">
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                        {tab === 'generate' ? 'Generate Template' : tab === 'improve' ? 'Improve Template' : tab === 'tone' ? 'Change Tone' : 'Optimize for Confirmations'}
                    </h3>

                    {tab === 'generate' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="input-group">
                                <label className="input-label">Business Type</label>
                                <input className="input" value={genForm.businessType} onChange={(e) => setGenForm({ ...genForm, businessType: e.target.value })} placeholder="Dental clinic, Salon, Auto shop..." />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Channel</label>
                                <select className="input" value={genForm.channel} onChange={(e) => setGenForm({ ...genForm, channel: e.target.value })}>
                                    <option value="SMS">SMS</option><option value="VOICE">Voice</option><option value="EMAIL">Email</option>
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Tone</label>
                                <select className="input" value={genForm.tone} onChange={(e) => setGenForm({ ...genForm, tone: e.target.value })}>
                                    <option value="professional">Professional</option><option value="casual">Casual</option><option value="friendly">Friendly</option><option value="formal">Formal</option><option value="luxury">Luxury</option>
                                </select>
                            </div>
                            <button className="btn btn-primary" onClick={() => callAI('generate-template', genForm)} disabled={loading}>{loading ? 'Generating...' : <><Icon icon={faWandMagicSparkles} className="mr-1.5" /> Generate</>}</button>
                        </div>
                    )}

                    {(tab === 'improve' || tab === 'tone' || tab === 'optimize') && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div className="input-group">
                                <label className="input-label">Current Template</label>
                                <textarea className="input" value={templateInput} onChange={(e) => setTemplateInput(e.target.value)}
                                    placeholder="Paste your existing template here..." style={{ minHeight: 120 }} />
                            </div>
                            {tab === 'improve' && (
                                <div className="input-group">
                                    <label className="input-label">Improvement Goal (optional)</label>
                                    <input className="input" value={improvementGoal} onChange={(e) => setImprovementGoal(e.target.value)} placeholder="Make it more concise" />
                                </div>
                            )}
                            {tab === 'tone' && (
                                <div className="input-group">
                                    <label className="input-label">Target Tone</label>
                                    <select className="input" value={targetTone} onChange={(e) => setTargetTone(e.target.value)}>
                                        <option value="casual">Casual</option><option value="professional">Professional</option><option value="friendly">Friendly</option><option value="formal">Formal</option><option value="luxury">Luxury</option><option value="urgent">Urgent</option>
                                    </select>
                                </div>
                            )}
                            <button className="btn btn-primary" disabled={loading || !templateInput} onClick={() => {
                                if (tab === 'improve') callAI('improve-template', { currentTemplate: templateInput, improvementGoal });
                                if (tab === 'tone') callAI('change-tone', { currentTemplate: templateInput, targetTone });
                                if (tab === 'optimize') callAI('optimize-confirmation', { currentTemplate: templateInput, channel: 'SMS' });
                            }}>
                                {loading ? 'Processing...' : tab === 'improve' ? <><Icon icon={faChartLine} className="mr-1.5" /> Improve</> : tab === 'tone' ? <><Icon icon={faPalette} className="mr-1.5" /> Change Tone</> : <><Icon icon={faBullseye} className="mr-1.5" /> Optimize</>}
                            </button>
                        </div>
                    )}
                </div>

                {/* Output */}
                <div className="card">
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Result</h3>
                    {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', padding: 16, borderRadius: 'var(--radius-md)', fontSize: 14, marginBottom: 16 }}>{error}</div>}
                    {result ? (
                        <div>
                            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: 20, fontSize: 14, lineHeight: 1.7, color: 'var(--text-primary)', marginBottom: 16 }}>{result}</div>
                            <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(result)}>
                                <Icon icon={faClipboard} className="mr-1.5" /> Copy to Clipboard
                            </button>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 'clamp(20px, 4vw, 48px)', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: 40, marginBottom: 12, color: 'var(--text-muted)' }}><Icon icon={faRobot} /></div>
                            <p>AI-generated content will appear here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
