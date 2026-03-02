import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Appointment Reminders for Salons & Spas — Attendlyx',
    description: 'Keep stylists booked and clients reminded. Automated SMS and voice reminders built for salons, spas, and beauty businesses.',
};

export default function SalonsPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 120 }}>
                <section className="section">
                    <div className="container" style={{ maxWidth: 800, textAlign: 'center' }}>
                        <div style={{ fontSize: 64, marginBottom: 24 }}>💇</div>
                        <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, marginBottom: 16 }}>
                            Zero Gaps in <span className="text-gradient">Your Schedule</span>
                        </h1>
                        <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.7 }}>
                            Salons and spas thrive on full schedules. Attendlyx sends automated reminders so clients show up, and stylists stay productive.
                        </p>
                        <Link href="/register" className="btn btn-primary btn-lg">Start Free Trial →</Link>
                    </div>
                </section>
                <section className="section" style={{ background: 'var(--bg-secondary)' }}>
                    <div className="container">
                        <div className="grid-3">
                            {[
                                { icon: '💅', title: 'Client Reminders', desc: '"Hi Sarah, your haircut with Jessica is tomorrow at 3 PM. See you then!" Warm, personal, automated.' },
                                { icon: '🔄', title: 'Confirmation Replies', desc: 'Clients reply YES to confirm. No more phone tag. Know your schedule in real-time.' },
                                { icon: '🤖', title: 'AI Tone Matching', desc: 'Match your salon\'s vibe. Casual, luxurious, friendly—AI adapts your reminder tone to your brand.' },
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
