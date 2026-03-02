'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { AuthProvider, useAuth } from '@/lib/auth';
import styles from './dashboard.module.css';

function DashboardShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading, logout, plan, trialActive, trialDaysRemaining, usage } = useAuth();

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login');
        }
    }, [loading, user, router]);

    if (loading) {
        return <div className={styles.loading}><div className={styles.spinner} /></div>;
    }

    if (!user) return null;

    const navItems = [
        { href: '/dashboard', icon: '📊', label: 'Overview' },
        { href: '/dashboard/appointments', icon: '📅', label: 'Appointments' },
        { href: '/dashboard/reminders', icon: '🔔', label: 'Reminder Rules' },
        { href: '/dashboard/templates', icon: '📝', label: 'Templates' },
        { href: '/dashboard/ai', icon: '🤖', label: 'AI Assistant' },
        { href: '/dashboard/billing', icon: '💳', label: 'Billing' },
    ];

    const smsPercent = usage.sms.limit > 0 ? Math.min(100, (usage.sms.used / usage.sms.limit) * 100) : 0;
    const aiPercent = usage.ai.limit > 0 ? Math.min(100, (usage.ai.used / usage.ai.limit) * 100) : 0;

    return (
        <div className={styles.layout}>
            <aside className={styles.sidebar}>
                <div className={styles.sidebarLogo}>
                    <Link href="/">⚡ <span className="text-gradient">Attendlyx</span></Link>
                </div>

                <nav className={styles.nav}>
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.navItem} ${pathname === item.href ? styles.active : ''}`}
                        >
                            <span className={styles.navIcon}>{item.icon}</span>
                            {item.label}
                        </Link>
                    ))}
                </nav>

                {/* Usage Bars */}
                <div className={styles.usageSection}>
                    <div className={styles.usageItem}>
                        <div className={styles.usageHeader}>
                            <span>SMS</span>
                            <span>{usage.sms.used}/{usage.sms.limit}</span>
                        </div>
                        <div className="progress-bar">
                            <div className={`progress-fill ${smsPercent > 80 ? 'warning' : ''} ${smsPercent > 95 ? 'danger' : ''}`} style={{ width: `${smsPercent}%` }} />
                        </div>
                    </div>
                    <div className={styles.usageItem}>
                        <div className={styles.usageHeader}>
                            <span>AI</span>
                            <span>{usage.ai.used}/{usage.ai.limit}</span>
                        </div>
                        <div className="progress-bar">
                            <div className={`progress-fill ${aiPercent > 80 ? 'warning' : ''} ${aiPercent > 95 ? 'danger' : ''}`} style={{ width: `${aiPercent}%` }} />
                        </div>
                    </div>
                </div>

                <button onClick={logout} className={styles.logoutBtn}>Sign Out</button>
            </aside>

            <div className={styles.main}>
                {/* Topbar */}
                <header className={styles.topbar}>
                    <div>
                        <span className={styles.greeting}>Welcome, {user.firstName || user.email.split('@')[0]}</span>
                        <span className={`badge ${plan === 'SMS_VOICE_AI' ? 'badge-accent' : plan === 'SMS_VOICE' ? 'badge-info' : 'badge-success'}`} style={{ marginLeft: 12 }}>
                            {plan.replace(/_/g, ' + ')}
                        </span>
                    </div>
                    <div className={styles.topbarRight}>
                        {trialActive && (
                            <div className={styles.trialBadge}>
                                <span className={styles.trialIcon}>⏱</span>
                                <span>{trialDaysRemaining} days left in trial</span>
                                <Link href="/dashboard/billing" className="btn btn-primary btn-sm" style={{ marginLeft: 12 }}>Upgrade</Link>
                            </div>
                        )}
                    </div>
                </header>

                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <DashboardShell>{children}</DashboardShell>
        </AuthProvider>
    );
}
