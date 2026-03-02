'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';

type AITab = 'generate' | 'improve' | 'tone' | 'optimize';

export default function AIPage() {
    const { plan, usage, refreshUsage } = useAuth();
    const [tab, setTab] = useState<AITab>('generate');
    const [result, setResult] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Generate form
    const [genForm, setGenForm] = useState({ businessType: '', channel: 'SMS', purpose: 'appointment reminder', tone: 'professional' });
    // Improve/Tone/Optimize forms
    const [templateInput, setTemplateInput] = useState('');
    const [improvementGoal, setImprovementGoal] = useState('');
    const [targetTone, setTargetTone] = useState('casual');

    const notEligible = plan !== 'SMS_VOICE_AI';
    const limitReached = usage.ai.used >= usage.ai.limit;

    const callAI = async (endpoint: string, body: object) => {
        setError('');
        setResult('');
        setLoading(true);
        try {
            const { data } = await api.post(`/ai/${endpoint}`, body);
            setResult(data.text || data.improved || data.rewritten || data.optimized || '');
            refreshUsage();
        } catch (err: any) {
            setError(err.response?.data?.message || 'AI request failed');
        } finally { setLoading(false); }
    };

    if (notEligible) {
        return (
            <div>
                <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 32 }}>AI Assistant</h1>
                <div className="card" style={{ textAlign: 'center', padding: 64 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>🔒</div>
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
                <div className="card" style={{ textAlign: 'center', padding: 64 }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>⚠️</div>
                    <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>AI Limit Reached</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
                        You&apos;ve used {usage.ai.used}/{usage.ai.limit} AI requests. Resets on your next billing cycle.
                    </p>
                </div>
            </div>
        );
    }

    const tabs: { key: AITab; label: string; icon: string }[] = [
        { key: 'generate', label: 'Generate', icon: '✨' },
        { key: 'improve', label: 'Improve', icon: '📈' },
        { key: 'tone', label: 'Change Tone', icon: '🎨' },
        { key: 'optimize', label: 'Optimize', icon: '🎯' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>AI Assistant</h1>
                <span className="badge badge-accent">{usage.ai.limit - usage.ai.used} requests remaining</span>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                {tabs.map((t) => (
                    <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-ghost'} btn-sm`} onClick={() => { setTab(t.key); setResult(''); setError(''); }}>
                        {t.icon} {t.label}
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
                            <button className="btn btn-primary" onClick={() => callAI('generate-template', genForm)} disabled={loading}>{loading ? 'Generating...' : 'Generate ✨'}</button>
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
                                {loading ? 'Processing...' : tab === 'improve' ? 'Improve 📈' : tab === 'tone' ? 'Change Tone 🎨' : 'Optimize 🎯'}
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
                            <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(result)}>📋 Copy to Clipboard</button>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                            <p>AI-generated content will appear here</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
