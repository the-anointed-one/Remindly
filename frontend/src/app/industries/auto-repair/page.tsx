import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Appointment Reminders for Auto Repair Shops — Attendlyx',
    description: 'Keep your repair bays full with automated service reminders. Reduce missed appointments and improve customer retention.',
};

export default function AutoRepairPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 120 }}>
                <section className="section">
                    <div className="container" style={{ maxWidth: 800, textAlign: 'center' }}>
                        <div style={{ fontSize: 64, marginBottom: 24 }}>🔧</div>
                        <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, marginBottom: 16 }}>
                            Keep Your <span className="text-gradient">Bays Full</span>
                        </h1>
                        <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.7 }}>
                            Auto repair shops lose revenue when customers forget their service appointments. Attendlyx sends automated reminders so every bay stays booked.
                        </p>
                        <Link href="/register" className="btn btn-primary btn-lg">Start Free Trial →</Link>
                    </div>
                </section>
                <section className="section" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="container">
                        <div className="grid-3">
                            {[
                                { icon: '📱', title: 'Service Reminders', desc: '"Your oil change is scheduled for Friday at 10 AM. Reply YES to confirm." Automated, hands-free.' },
                                { icon: '📞', title: 'Voice Follow-ups', desc: 'For customers who don\'t read texts. A quick automated call confirms the appointment.' },
                                { icon: '⏰', title: 'Multi-Reminder Rules', desc: 'Send a text 48h before, another 2h before. Set it once, works for every appointment.' },
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
