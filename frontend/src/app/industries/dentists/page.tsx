import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Appointment Reminders for Dental Clinics — Attendlyx',
    description: 'Reduce dental patient no-shows by up to 70% with automated SMS and voice reminders. Built specifically for dentists and dental practices.',
};

export default function DentistsPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 120 }}>
                <section className="section">
                    <div className="container" style={{ maxWidth: 800, textAlign: 'center' }}>
                        <div style={{ fontSize: 64, marginBottom: 24 }}>🦷</div>
                        <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, marginBottom: 16 }}>
                            Reduce Patient <span className="text-gradient">No-Shows</span> by 70%
                        </h1>
                        <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.7 }}>
                            Dental practices lose thousands each month to missed appointments. Attendlyx sends automated SMS and voice reminders so patients always show up.
                        </p>
                        <Link href="/register" className="btn btn-primary btn-lg">Start Free Trial →</Link>
                    </div>
                </section>
                <section className="section" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="container">
                        <div className="grid-3">
                            {[
                                { icon: '📱', title: 'Patient SMS Reminders', desc: 'Send "Your dental appointment is tomorrow at 2:00 PM" automatically. Patients reply YES to confirm.' },
                                { icon: '📞', title: 'Voice Confirmation', desc: 'For patients who don\'t respond to texts. Automated voice calls with "Press 1 to confirm your appointment".' },
                                { icon: '🤖', title: 'AI-Optimized Messages', desc: 'Our AI crafts messages that dental patients actually respond to. Higher confirmation rates, fewer empty chairs.' },
                            ].map((f) => (
                                <div key={f.title} className="card">
                                    <div style={{ fontSize: 32, marginBottom: 16 }}>{f.icon}</div>
                                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{f.title}</h3>
                                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>{f.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>
            </main>
            <Footer />
        </>
    );
}
