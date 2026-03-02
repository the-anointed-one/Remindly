import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <div className={styles.brand}>
                    <span className={styles.logo}>⚡ Attendlyx</span>
                    <p>Smart appointment reminders that reduce no-shows by up to 70%.</p>
                </div>
                <div className={styles.col}>
                    <h4>Product</h4>
                    <Link href="/features">Features</Link>
                    <Link href="/pricing">Pricing</Link>
                    <Link href="/register">Start Free Trial</Link>
                </div>
                <div className={styles.col}>
                    <h4>Industries</h4>
                    <Link href="/industries/dentists">Dentists</Link>
                    <Link href="/industries/auto-repair">Auto Repair</Link>
                    <Link href="/industries/salons">Salons</Link>
                </div>
                <div className={styles.col}>
                    <h4>Company</h4>
                    <Link href="/login">Login</Link>
                    <Link href="/register">Sign Up</Link>
                </div>
            </div>
            <div className={styles.bottom}>
                <p>&copy; {new Date().getFullYear()} Attendlyx. All rights reserved.</p>
            </div>
        </footer>
    );
}
