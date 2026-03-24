'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Icon from '@/components/ui/Icon';
import { faCheckCircle, faTimesCircle, faInfoCircle, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    toast: {
        success: (msg: string) => void;
        error: (msg: string) => void;
        info: (msg: string) => void;
        warning: (msg: string) => void;
    };
}

const ToastContext = createContext<ToastContextType | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
    success: <Icon icon={faCheckCircle} />,
    error: <Icon icon={faTimesCircle} />,
    info: <Icon icon={faInfoCircle} />,
    warning: <Icon icon={faExclamationTriangle} />,
};

const COLORS: Record<ToastType, { bg: string; border: string; text: string }> = {
    success: { bg: 'rgba(46, 204, 143, 0.12)', border: 'rgba(46, 204, 143, 0.3)', text: 'var(--success)' },
    error: { bg: 'rgba(224, 82, 82, 0.12)', border: 'rgba(224, 82, 82, 0.3)', text: 'var(--error)' },
    info: { bg: 'rgba(0, 169, 157, 0.12)', border: 'rgba(0, 169, 157, 0.3)', text: 'var(--primary)' },
    warning: { bg: 'rgba(247, 148, 29, 0.12)', border: 'rgba(247, 148, 29, 0.3)', text: 'var(--warning)' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = useCallback((message: string, type: ToastType) => {
        const id = `${Date.now()}-${Math.random()}`;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 4000);
    }, []);

    const toast = {
        success: (msg: string) => addToast(msg, 'success'),
        error: (msg: string) => addToast(msg, 'error'),
        info: (msg: string) => addToast(msg, 'info'),
        warning: (msg: string) => addToast(msg, 'warning'),
    };

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            {/* Toast container */}
            <div style={{
                position: 'fixed', top: 20, right: 20, zIndex: 9999,
                display: 'flex', flexDirection: 'column', gap: 10,
                maxWidth: 380, width: '100%',
            }}>
                {toasts.map(t => {
                    const c = COLORS[t.type];
                    return (
                        <div key={t.id} style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            background: 'var(--bg-card)', border: `1px solid ${c.border}`,
                            borderLeft: `3px solid ${c.text}`,
                            borderRadius: 10, padding: '12px 16px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                            animation: 'slideIn 0.22s ease',
                        }}>
                            <span style={{ fontSize: 16, marginTop: 1 }}>{ICONS[t.type]}</span>
                            <span style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t.message}</span>
                            <button
                                onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
                                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}
                            >×</button>
                        </div>
                    );
                })}
            </div>
            <style>{`
                @keyframes slideIn {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx.toast;
}
