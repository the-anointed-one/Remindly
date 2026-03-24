'use client';

import { useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/Icon';
import { faRocket, faCheck } from '@fortawesome/free-solid-svg-icons';

interface UpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature?: string;
    requiredPlan?: string;
}

const PLAN_INFO: Record<string, { name: string; price: string; color: string; features: string[] }> = {
    SMS_VOICE: {
        name: 'Growth',
        price: '₦10,000/mo',
        color: '#8b5cf6',
        features: ['Voice call reminders', 'WhatsApp messaging', '500 SMS/month'],
    },
    SMS_VOICE_AI: {
        name: 'Pro',
        price: '₦18,000/mo',
        color: '#ec4899',
        features: ['AI template generation', 'Voice + WhatsApp', 'Unlimited SMS'],
    },
};

export function UpgradeModal({ isOpen, onClose, feature, requiredPlan }: UpgradeModalProps) {
    if (!isOpen) return null;

    const plan = requiredPlan ? PLAN_INFO[requiredPlan] : null;

    return (
        <>
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    backdropFilter: 'blur(4px)', zIndex: 1000,
                    animation: 'fadeIn 0.15s ease',
                }}
            />
            {/* Modal */}
            <div style={{
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '36px 32px',
                width: '100%', maxWidth: 420, zIndex: 1001,
                boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
                animation: 'scaleIn 0.18s ease',
            }}>
                <button
                    onClick={onClose}
                    style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 20 }}
                >×</button>

                <div style={{ fontSize: 36, marginBottom: 12, textAlign: 'center', color: 'var(--text-muted)' }}><Icon icon={faRocket} /></div>
                <h2 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center', marginBottom: 8 }}>
                    Unlock {feature || 'this feature'}
                </h2>
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: 24, fontSize: 14, lineHeight: 1.6 }}>
                    This feature requires a higher plan. Upgrade to get instant access.
                </p>

                {plan && (
                    <div style={{
                        background: `linear-gradient(135deg, ${plan.color}15, ${plan.color}08)`,
                        border: `1px solid ${plan.color}40`,
                        borderRadius: 12, padding: '16px 20px', marginBottom: 20,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: plan.color }}>{plan.name} Plan</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{plan.price}</span>
                        </div>
                        {plan.features.map((f, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                                <span style={{ color: plan.color, fontSize: 12 }}><Icon icon={faCheck} /></span>
                                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{f}</span>
                            </div>
                        ))}
                    </div>
                )}

                <Link
                    href="/onboarding/plan"
                    className="btn btn-primary"
                    style={{ display: 'block', textAlign: 'center', width: '100%', marginBottom: 10 }}
                    onClick={onClose}
                >
                    View Plans & Upgrade →
                </Link>
                <button
                    onClick={onClose}
                    style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '8px 0' }}
                >
                    Maybe later
                </button>
            </div>
            <style>{`
                @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
                @keyframes scaleIn { from { opacity: 0; transform: translate(-50%,-50%) scale(0.92) } to { opacity: 1; transform: translate(-50%,-50%) scale(1) } }
            `}</style>
        </>
    );
}

// Global state for upgrade modal - used by the api.ts interceptor
let upgradeModalHandler: ((feature: string, plan: string) => void) | null = null;

export function registerUpgradeModalHandler(handler: (feature: string, plan: string) => void) {
    upgradeModalHandler = handler;
}

export function triggerUpgradeModal(feature: string, plan: string) {
    if (upgradeModalHandler) upgradeModalHandler(feature, plan);
}
