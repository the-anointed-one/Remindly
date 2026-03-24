'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Dialog } from '@headlessui/react';
import Icon from '@/components/ui/Icon';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faBars,
    faXmark,
    faGauge,
    faRightFromBracket,
} from '@fortawesome/free-solid-svg-icons';
import UserMenu from '@/components/navigation/UserMenu';
import { useAuth } from '@/lib/auth';
import styles from './Navbar.module.css';

// ─── Constants ─────────────────────────────────────────────────────────────────

const NAV_LINKS = [
    { href: '/features',          label: 'Features'   },
    { href: '/pricing',           label: 'Pricing'    },
    { href: '/insights',          label: 'Insights'   },
];

// Wrap Dialog.Panel with Framer Motion so it can receive animation props
// while keeping Headless UI's focus-trap and aria attributes intact.
const MotionDialogPanel = motion(Dialog.Panel);

// ─── Navbar ────────────────────────────────────────────────────────────────────

export default function Navbar() {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const pathname = usePathname();
    const { user, logout } = useAuth();

    // Close drawer whenever the route changes
    useEffect(() => {
        setDrawerOpen(false);
    }, [pathname]);

    const close = () => setDrawerOpen(false);

    return (
        <>
            {/* ── Main navbar ──────────────────────────────────────────────── */}
            <nav className={styles.nav}>
                <div className={styles.inner}>

                    {/* Logo */}
                    <Link href={user ? '/dashboard' : '/'} className={styles.logo}>
                        <span className={styles.logoText}>Meetora</span>
                    </Link>

                    {/* Desktop centre links */}
                    <div className={styles.links}>
                        {NAV_LINKS.map((l) => (
                            <Link
                                key={l.href}
                                href={l.href}
                                className={pathname.startsWith(l.href) ? styles.linkActive : undefined}
                            >
                                {l.label}
                            </Link>
                        ))}
                    </div>

                    {/* Right side — UserMenu always visible, hamburger mobile-only */}
                    <div className={styles.navRight}>
                        <div className={styles.userMenuWrapper}>
                            <UserMenu />
                        </div>
                        <button
                            className={styles.menuBtn}
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open navigation menu"
                            aria-expanded={drawerOpen}
                            aria-controls="mobile-drawer"
                        >
                            <FontAwesomeIcon icon={faBars} />
                        </button>
                    </div>

                </div>
            </nav>

            {/* ── Mobile drawer ────────────────────────────────────────────── */}
            <AnimatePresence>
                {drawerOpen && (
                    <Dialog
                        static
                        open={drawerOpen}
                        onClose={close}
                        id="mobile-drawer"
                    >
                        {/* Backdrop */}
                        <motion.div
                            className={styles.overlay}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            aria-hidden
                            onClick={close}
                        />

                        {/* Drawer panel — slides in from the right */}
                        <MotionDialogPanel
                            className={styles.drawer}
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ duration: 0.25, ease: [0.32, 0, 0.67, 0] }}
                        >
                            {/* Header */}
                            <div className={styles.drawerHeader}>
                                <Link href={user ? '/dashboard' : '/'} className={styles.logo} onClick={close}>
                                    <span className={styles.logoText}>Meetora</span>
                                </Link>
                                <button className={styles.closeBtn} onClick={close} aria-label="Close menu">
                                    <FontAwesomeIcon icon={faXmark} />
                                </button>
                            </div>

                            {/* Nav links */}
                            <nav className={styles.drawerNav}>
                                {NAV_LINKS.map((l) => (
                                    <Link
                                        key={l.href}
                                        href={l.href}
                                        className={`${styles.drawerLink} ${pathname.startsWith(l.href) ? styles.drawerLinkActive : ''}`}
                                        onClick={close}
                                    >
                                        {l.label}
                                    </Link>
                                ))}
                            </nav>

                            {/* Auth section */}
                            <div className={styles.drawerAuth}>
                                {user ? (
                                    <>
                                        <Link href="/dashboard" className={styles.drawerAuthLink} onClick={close}>
                                            <FontAwesomeIcon icon={faGauge} className={styles.drawerAuthIcon} />
                                            Dashboard
                                        </Link>
                                        <button
                                            className={styles.drawerLogout}
                                            onClick={() => { logout(); close(); }}
                                        >
                                            <FontAwesomeIcon icon={faRightFromBracket} className={styles.drawerAuthIcon} />
                                            Logout
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <Link href="/login" className={styles.drawerSignIn} onClick={close}>
                                            Log In
                                        </Link>
                                        <Link href="/register" className={styles.drawerSignUp} onClick={close}>
                                            Start Free Trial
                                        </Link>
                                    </>
                                )}
                            </div>
                        </MotionDialogPanel>
                    </Dialog>
                )}
            </AnimatePresence>
        </>
    );
}
