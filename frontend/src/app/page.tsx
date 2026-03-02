import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import Link from 'next/link';
import styles from './page.module.css';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroBg} />
          <div className={`container ${styles.heroInner}`}>
            <div className={styles.badge}>
              <span className="badge badge-accent">New</span>
              <span>AI-powered template optimization</span>
            </div>
            <h1 className={styles.title}>
              Reduce No-Shows by <span className="text-gradient">70%</span> with
              Smart Reminders
            </h1>
            <p className={styles.subtitle}>
              Automated SMS, voice calls, and AI-powered appointment reminders for
              service businesses. Set it up once, and never chase a client again.
            </p>
            <div className={styles.heroCta}>
              <Link href="/register" className="btn btn-primary btn-lg">
                Start 14-Day Free Trial
              </Link>
              <Link href="/features" className="btn btn-ghost btn-lg">
                See How It Works →
              </Link>
            </div>
            <p className={styles.heroNote}>No credit card required • 14-day trial • Cancel anytime</p>
          </div>
        </section>

        {/* Stats */}
        <section className={styles.stats}>
          <div className="container">
            <div className={styles.statsGrid}>
              {[
                { value: '70%', label: 'Reduction in no-shows' },
                { value: '10K+', label: 'Reminders sent daily' },
                { value: '5 min', label: 'Setup time' },
                { value: '99.9%', label: 'Delivery rate' },
              ].map((s) => (
                <div key={s.label} className={styles.stat}>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="section" id="features">
          <div className="container">
            <div className={styles.sectionHeader}>
              <h2>Everything You Need to <span className="text-gradient">Stop No-Shows</span></h2>
              <p>Powerful tools that work together to keep your schedule full.</p>
            </div>
            <div className="grid-3">
              {[
                { icon: '💬', title: 'SMS Reminders', desc: 'Automated text messages sent at the perfect time. Patients reply YES to confirm.' },
                { icon: '📞', title: 'Voice Calls', desc: 'AI-powered voice reminders with IVR. Clients press 1 to confirm, 2 to reschedule.' },
                { icon: '🤖', title: 'AI Templates', desc: 'Generate, improve, and optimize reminder messages with AI for higher response rates.' },
                { icon: '📅', title: 'Smart Scheduling', desc: 'Set rules once: "24h before", "1h before". We handle the rest automatically.' },
                { icon: '📊', title: 'Analytics', desc: 'Track confirmation rates, delivery stats, and identify patterns in no-shows.' },
                { icon: '🔒', title: 'Multi-Tenant', desc: 'Manage multiple locations. Each with its own templates, rules, and usage limits.' },
              ].map((f) => (
                <div key={f.title} className={`card ${styles.featureCard}`}>
                  <div className={styles.featureIcon}>{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Industries */}
        <section className={`section ${styles.industries}`}>
          <div className="container">
            <div className={styles.sectionHeader}>
              <h2>Built for <span className="text-gradient">Your Industry</span></h2>
              <p>Tailored solutions for service businesses that depend on appointments.</p>
            </div>
            <div className="grid-3">
              {[
                { icon: '🦷', title: 'Dental Clinics', desc: 'Reduce patient no-shows and fill last-minute cancellations automatically.', link: '/industries/dentists' },
                { icon: '🔧', title: 'Auto Repair', desc: 'Keep bays full with automated service reminders and follow-ups.', link: '/industries/auto-repair' },
                { icon: '💇', title: 'Salons & Spas', desc: 'Stylists stay booked. Clients stay reminded. Zero gaps in your schedule.', link: '/industries/salons' },
              ].map((ind) => (
                <Link key={ind.title} href={ind.link} className={`card ${styles.industryCard}`}>
                  <div className={styles.industryIcon}>{ind.icon}</div>
                  <h3>{ind.title}</h3>
                  <p>{ind.desc}</p>
                  <span className={styles.cardLink}>Learn more →</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className={styles.cta}>
          <div className="container">
            <div className={styles.ctaCard}>
              <h2>Ready to Eliminate No-Shows?</h2>
              <p>Start your 14-day free trial today. No credit card required.</p>
              <Link href="/register" className="btn btn-primary btn-lg">
                Get Started Free →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
