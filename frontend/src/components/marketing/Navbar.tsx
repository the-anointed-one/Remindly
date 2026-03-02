'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './Navbar.module.css';

export default function Navbar() {
    const [open, setOpen] = useState(false);

    return (
        <nav className={styles.nav}>
            <div className={styles.inner}>
                <Link href="/" className={styles.logo}>
                    <span className={styles.logoIcon}>⚡</span>
                    <span className={styles.logoText}>Attendlyx</span>
                </Link>

                <button className={styles.burger} onClick={() => setOpen(!open)} aria-label="Menu">
                    <span />
                    <span />
                    <span />
                </button>

                <div className={`${styles.links} ${open ? styles.open : ''}`}>
                    <Link href="/features">Features</Link>
                    <Link href="/pricing">Pricing</Link>
                    <Link href="/industries/dentists">Industries</Link>
                    <div className={styles.actions}>
                        <Link href="/login" className="btn btn-ghost btn-sm">Log In</Link>
                        <Link href="/register" className="btn btn-primary btn-sm">Start Free Trial</Link>
                    </div>
                </div>
            </div>
        </nav>
    );
}
