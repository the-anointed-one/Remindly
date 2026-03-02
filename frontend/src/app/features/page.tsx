import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Features — Attendlyx',
    description: 'Smart SMS reminders, voice calls with IVR, AI-powered templates, scheduling rules, analytics, and more.',
};

const features = [
    { icon: '💬', title: 'SMS Reminders', desc: 'Automated text messages at configurable intervals—24h before, 1h before, or custom. Clients reply YES to confirm instantly.' },
    { icon: '📞', title: 'Voice Calls with IVR', desc: 'Professional voice reminders with interactive menus. Press 1 to confirm, 2 to reschedule. Powered by Twilio.' },
    { icon: '🤖', title: 'AI Template Engine', desc: 'Generate templates, improve language, change tone, or optimize for higher confirmation rates—all powered by GPT-4.' },
    { icon: '⏰', title: 'Smart Scheduling', desc: 'Create rules like "Send SMS 24h before" and "Send voice 1h before". Apply to all appointments automatically.' },
    { icon: '📝', title: 'Template Variables', desc: 'Personalize every message with {{customer_name}}, {{appointment_date}}, {{appointment_time}}, and more.' },
    { icon: '📊', title: 'Usage Analytics', desc: 'Track SMS delivery rates, voice call outcomes, AI usage, and confirmation rates across your business.' },
    { icon: '🏢', title: 'Multi-Tenant', desc: 'Manage multiple business locations with separate configurations, templates, and usage limits under one account.' },
    { icon: '🔄', title: 'BullMQ Job Engine', desc: 'Reliable reminder delivery with exponential retry, dead-letter queues, and failed reminder tracking.' },
    { icon: '💳', title: 'Paystack Billing', desc: 'Seamless subscription management with automatic trial conversion, plan upgrades, and secure webhook processing.' },
    { icon: '🔒', title: 'Security', desc: 'JWT authentication, refresh tokens, tenant isolation, HMAC webhook verification, and rate limiting.' },
    { icon: '📋', title: 'Audit Logging', desc: 'Every action is logged—who did what, when, and what changed. Full accountability for your team.' },
    { icon: '🔔', title: 'Webhook Delivery', desc: 'Real-time status updates via Twilio webhooks. Track delivered, failed, and responded reminders.' },
];

export default function FeaturesPage() {
    return (
        <>
            <Navbar />
            <main style={{ paddingTop: 120 }}>
                <section className="section">
                    <div className="container">
                        <div style={{ textAlign: 'center', marginBottom: 64 }}>
                            <h1 style={{ fontSize: 48, fontWeight: 900, letterSpacing: -2, marginBottom: 16 }}>
                                Powerful <span className="text-gradient">Features</span>
                            </h1>
                            <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 560, margin: '0 auto' }}>
                                Everything you need to automate appointment reminders and reduce no-shows.
                            </p>
                        </div>
                        <div className="grid-3">
                            {features.map((f) => (
                                <div key={f.title} className="card" style={{ textAlign: 'left' }}>
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
