'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import styles from './dashboard.module.css';
import Icon from '@/components/ui/Icon';
import { useOnboarding } from '@/hooks/useOnboarding';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import {
    faHouse, faCalendarDays, faUsers, faBolt, faCalendar, faCommentDots, faCog,
    faCreditCard, faCheckCircle, faTimesCircle, faLock, faBars, faXmark,
    faExclamationTriangle, faClock, faChartLine
} from '@fortawesome/free-solid-svg-icons';
import UserMenu from '@/components/navigation/UserMenu';

// ── PRIMARY NAV (6 items) ─────────────────────────────────────
const NAV_PRIMARY = [
    { href: '/dashboard',              icon: faHouse,        label: 'Home' },
    { href: '/dashboard/contacts',     icon: faUsers,        label: 'Contacts' },
    { href: '/dashboard/appointments', icon: faCalendarDays, label: 'Appointments' },
    { href: '/dashboard/automations',  icon: faBolt,         label: 'Follow-ups' },
    { href: '/dashboard/events',       icon: faCalendar,     label: 'Events' },
    { href: '/dashboard/campaigns',    icon: faCommentDots,  label: 'Campaigns' },
];

// ── SETTINGS (bottom) ────────────────────────────────────────
const NAV_SETTINGS = [
    { href: '/dashboard/settings', icon: faCog, label: 'Settings' },
];

// kept for pageTitle lookup — not rendered directly
const NAV_HIDDEN = [
    { href: '/dashboard/reminders',  icon: faBolt,        label: 'Follow-ups' },
    { href: '/dashboard/messaging',  icon: faCommentDots, label: 'Messages' },
    { href: '/dashboard/campaigns',  icon: faCommentDots, label: 'Campaigns' },
    { href: '/dashboard/templates',  icon: faCommentDots, label: 'Messages' },
    { href: '/dashboard/analytics',  icon: faChartLine,   label: 'Analytics' },
    { href: '/dashboard/tags',       icon: faUsers,       label: 'Contacts' },
    { href: '/dashboard/billing',    icon: faCreditCard,  label: 'Settings' },
    { href: '/dashboard/locations',  icon: faCog,         label: 'Settings' },
    { href: '/dashboard/ai',         icon: faBolt,        label: 'Follow-ups' },
];

function StatusBadge({
    subscriptionStatus,
    trialActive,
    trialDaysRemaining,
    plan,
}: {
    subscriptionStatus: string;
    trialActive: boolean;
    trialDaysRemaining: number;
    plan: string;
}) {
    if (trialActive) {
        const urgent = trialDaysRemaining <= 3;
        return (
            <div className={styles.trialBadge} style={{ background: urgent ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.1)', border: `1px solid ${urgent ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
                <span style={{ fontSize: 14 }}>{urgent ? <Icon icon={faExclamationTriangle} /> : <Icon icon={faClock} />}</span>
                <span style={{ color: urgent ? '#f87171' : '#F7941D', fontWeight: 600 }}>
                    {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left in trial
                </span>
                <Link href="/dashboard/billing" className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}>
                    Upgrade
                </Link>
            </div>
        );
    }

    if (subscriptionStatus === 'ACTIVE') {
        return (
            <div className={styles.trialBadge} style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span style={{ fontSize: 14 }}><Icon icon={faCheckCircle} /></span>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>
                    Active — {plan.replace(/_/g, ' + ')}
                </span>
            </div>
        );
    }

    if (subscriptionStatus === 'PAST_DUE') {
        return (
            <div className={styles.trialBadge} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <span style={{ fontSize: 14 }}><Icon icon={faTimesCircle} /></span>
                <span style={{ color: '#f87171', fontWeight: 600 }}>Payment Failed</span>
                <Link href="/dashboard/billing" className="btn btn-sm" style={{ marginLeft: 8, background: '#ef4444', color: '#fff', border: 'none' }}>
                    Fix Now
                </Link>
            </div>
        );
    }

    if (subscriptionStatus === 'CANCELLED' || subscriptionStatus === 'EXPIRED') {
        return (
            <div className={styles.trialBadge} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <span style={{ fontSize: 14 }}><Icon icon={faLock} /></span>
                <span style={{ color: '#a5b4fc', fontWeight: 600 }}>Subscription Required</span>
                <Link href="/onboarding/plan" className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}>
                    Subscribe
                </Link>
            </div>
        );
    }

    // TRIALING but trialActive === false → pending checkout
    if (subscriptionStatus === 'TRIALING' && !trialActive) {
        return (
            <div className={styles.trialBadge} style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)' }}>
                <span style={{ fontSize: 14 }}><Icon icon={faCreditCard} /></span>
                <span style={{ color: '#a5b4fc', fontWeight: 600 }}>Complete setup to start trial</span>
                <Link href="/onboarding/plan" className="btn btn-primary btn-sm" style={{ marginLeft: 8 }}>
                    Start Trial
                </Link>
            </div>
        );
    }

    return null;
}

function DashboardShell({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading, logout, plan, subscriptionStatus, trialActive, trialDaysRemaining, usage } = useAuth();
    const { showOnboarding, completeOnboarding, skipOnboarding } = useOnboarding(!loading && !!user);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth <= 768 : false
    );

    useEffect(() => {
        const mql = window.matchMedia('(max-width: 768px)');
        const handler = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches);
            if (!e.matches) setSidebarOpen(false);
        };
        mql.addEventListener('change', handler);
        return () => mql.removeEventListener('change', handler);
    }, []);

    const ONBOARDING_NAV_HIGHLIGHT = new Set(['/dashboard/events', '/dashboard/campaigns', '/dashboard/automations']);
    const ALL_NAV = [...NAV_PRIMARY, ...NAV_SETTINGS, ...NAV_HIDDEN];
    const pageTitle = ALL_NAV.find(item => item.href === pathname)?.label ?? 'Dashboard';

    const redirecting = useRef(false);

    useEffect(() => {
        if (loading || redirecting.current) return;

        // Avoid endless redirect loops for protected pages
        const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/onboarding');

        if (!user && !isAuthRoute) {
            redirecting.current = true;
            router.push('/login');
            return;
        }

        if (user && subscriptionStatus === 'TRIALING' && !trialActive && !pathname.startsWith('/onboarding')) {
            redirecting.current = true;
            router.push('/onboarding/plan');
        }
    }, [loading, user, subscriptionStatus, trialActive, router, pathname]);


    if (loading) {
        return <div className={styles.loading}><div className={styles.spinner} /></div>;
    }

    if (!user) return null;

    // Keep user on page if PAST_DUE or CANCELLED — they should see billing to fix it
    const smsLimit = usage?.sms?.limit ?? 0;
    const smsUsed = usage?.sms?.used ?? 0;
    const smsPercent = smsLimit > 0 ? Math.min(100, (smsUsed / smsLimit) * 100) : 0;

    const aiLimit = usage?.ai?.limit ?? 0;
    const aiUsed = usage?.ai?.used ?? 0;
    const aiPercent = aiLimit > 0 ? Math.min(100, (aiUsed / aiLimit) * 100) : 0;

    return (
        <div className={styles.layout}>
            {/* First-time user onboarding walkthrough */}
            {showOnboarding && (
                <OnboardingModal
                    onComplete={completeOnboarding}
                    onSkip={skipOnboarding}
                />
            )}

            {/* Mobile backdrop */}
            <AnimatePresence>
                {sidebarOpen && isMobile && (
                    <motion.div
                        className={styles.mobileOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            <motion.aside
                className={styles.sidebar}
                initial={false}
                animate={isMobile ? { x: sidebarOpen ? 0 : -260 } : { x: 0 }}
                transition={{ duration: 0.2, ease: [0.32, 0, 0.67, 0] }}
            >
                <div className={styles.sidebarLogo}>
                    <Link href="/"><span className="text-gradient">Meetora</span></Link>
                </div>

                <nav className={styles.nav}>
                    {/* Primary nav items */}
                    <div className={styles.navSection}>
                        {NAV_PRIMARY.map((item) => {
                            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                            const highlightOnboarding = showOnboarding && ONBOARDING_NAV_HIGHLIGHT.has(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={`${styles.navItem} ${highlightOnboarding ? styles.onboardingHighlight : ''}`}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 14,
                                        fontWeight: isActive ? 500 : 400,
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        background: isActive ? 'var(--bg-secondary)' : 'transparent',
                                        borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                                        textDecoration: 'none',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.6 }}>
                                        <Icon icon={item.icon} />
                                    </span>
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>

                    {/* Settings at bottom */}
                    <div className={styles.navSection} style={{ marginTop: 'auto' }}>
                        <div className={styles.navSectionDivider} />
                        {NAV_SETTINGS.map((item) => {
                            const isActive = pathname.startsWith(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setSidebarOpen(false)}
                                    className={styles.navItem}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 14,
                                        fontWeight: isActive ? 500 : 400,
                                        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                                        background: isActive ? 'var(--bg-secondary)' : 'transparent',
                                        borderLeft: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                                        textDecoration: 'none',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    <span style={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: isActive ? 1 : 0.6 }}>
                                        <Icon icon={item.icon} />
                                    </span>
                                    {item.label}
                                </Link>
                            );
                        })}
                    </div>
                </nav>

                {/* Usage Bars */}
                <div className={styles.usageSection}>
                    <div className={styles.usageItem}>
                        <div className={styles.usageHeader}>
                            <span>SMS</span>
                            <span>{smsUsed}/{smsLimit}</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className={`progress-fill ${smsPercent > 80 ? 'warning' : ''} ${smsPercent > 95 ? 'danger' : ''}`}
                                style={{ width: `${smsPercent}%` }}
                            />
                        </div>
                    </div>
                    <div className={styles.usageItem}>
                        <div className={styles.usageHeader}>
                            <span>AI</span>
                            <span>{aiUsed}/{aiLimit}</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className={`progress-fill ${aiPercent > 80 ? 'warning' : ''} ${aiPercent > 95 ? 'danger' : ''}`}
                                style={{ width: `${aiPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

            </motion.aside>

            <div className={styles.main}>
                {/* Topbar */}
                <header className={`${styles.topbar} bg-surface border-b border-border`}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                            className={styles.hamburger}
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            aria-label="Toggle navigation"
                        >
                            <Icon icon={sidebarOpen ? faXmark : faBars} />
                        </button>
                        <span className={styles.greeting}>
                            Welcome, {user.firstName || user.email?.split('@')[0] || 'there'}
                        </span>
                        <span className={styles.pageTitle}>{pageTitle}</span>
                    </div>
                    <div className={styles.topbarRight}>
                        <StatusBadge
                            subscriptionStatus={subscriptionStatus}
                            trialActive={trialActive}
                            trialDaysRemaining={trialDaysRemaining}
                            plan={plan}
                        />
                        <UserMenu />
                    </div>
                </header>

                <ErrorBoundary>
                    <div className={styles.content}>
                        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
                            {children}
                        </div>
                    </div>
                </ErrorBoundary>
            </div>
        </div>
    );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <DashboardShell>{children}</DashboardShell>
    );
}
