import type { Metadata } from 'next';
import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';

export const metadata: Metadata = {
  title: 'Insights & ROI — Meetora',
  description:
    'Real numbers from Meetora customers. No-show reduction data, case studies, and channel performance across clinics, beauty studios, and coaching practices.',
};

export default function InsightsPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>

        {/* ── SECTION 1: Hero ───────────────────── */}
        <section style={{
          padding: 'clamp(64px, 10vw, 120px) clamp(16px, 5vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          textAlign: 'center',
          paddingTop: 'calc(clamp(64px, 10vw, 120px) + 72px)',
        }}>
          <p style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: 16,
          }}>
            Real results
          </p>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 700,
            lineHeight: 1.15,
            color: 'var(--text-primary)',
            marginBottom: 20,
            maxWidth: 700,
            margin: '0 auto 20px',
          }}>
            What attendance automation actually delivers
          </h1>
          <p style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: 540,
            margin: '0 auto 40px',
          }}>
            Numbers from real Meetora customers across clinics,
            beauty studios, and coaching practices.
          </p>
          
          <a
            href="/register"
            style={{
              display: 'inline-block',
              padding: '13px 32px',
              borderRadius: 999,
              background: 'var(--primary)',
              color: '#fff',
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            Start measuring your results →
          </a>
        </section>

        {/* ── SECTION 2: ROI headline stats ─────── */}
        <section style={{
          padding: 'clamp(48px, 8vw, 80px) clamp(16px, 5vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 32,
          }}>
            {([
              {
                stat: '60%',
                label: 'Average no-show reduction',
                context: 'Across all Meetora customers in their first 90 days of using automated reminders.',
                color: '#0F6E56',
                bg: '#E1F5EE',
              },
              {
                stat: '3x',
                label: 'More confirmed bookings',
                context: 'Customers using two-way RSVP see 3x more explicit confirmations vs manual reminder calls.',
                color: '#185FA5',
                bg: '#E6F1FB',
              },
              {
                stat: '80%',
                label: 'Fewer manual follow-ups',
                context: 'Time previously spent chasing confirmations by phone, now handled automatically.',
                color: '#854F0B',
                bg: '#FAEEDA',
              },
              {
                stat: '5 min',
                label: 'Average setup time',
                context: 'From registration to sending your first automated reminder — measured across new accounts.',
                color: '#993556',
                bg: '#FBEAF0',
              },
            ] as const).map((item) => (
              <div
                key={item.label}
                style={{
                  padding: '28px 24px',
                  borderRadius: 16,
                  background: item.bg,
                  border: `0.5px solid ${item.color}22`,
                }}
              >
                <p style={{
                  fontSize: 48,
                  fontWeight: 800,
                  color: item.color,
                  marginBottom: 8,
                  lineHeight: 1,
                }}>
                  {item.stat}
                </p>
                <p style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: item.color,
                  marginBottom: 10,
                }}>
                  {item.label}
                </p>
                <p style={{
                  fontSize: 13,
                  color: item.color,
                  opacity: 0.8,
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  {item.context}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 3: Methodology ────────────── */}
        <section style={{
          padding: 'clamp(40px, 6vw, 72px) clamp(16px, 5vw, 80px)',
          maxWidth: 860,
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
        }}>
          <p style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: 12,
          }}>
            Methodology
          </p>
          <h2 style={{
            fontSize: 'clamp(20px, 2.5vw, 28px)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 16,
          }}>
            How we calculate these numbers
          </h2>
          <p style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            lineHeight: 1.75,
            marginBottom: 24,
          }}>
            No-show reduction is measured by comparing the
            no-show rate in the 30 days before Meetora to the
            30 days after activating automated reminders for
            the same business. Confirmation rate is the
            percentage of invited contacts who replied YES
            within 24 hours of receiving a reminder. Manual
            follow-up reduction is self-reported by customers
            during onboarding surveys.
          </p>
          <p style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            lineHeight: 1.7,
            borderLeft: '3px solid var(--border)',
            paddingLeft: 16,
            margin: 0,
          }}>
            Results vary by industry, message timing, and
            contact list quality. The numbers above represent
            median outcomes — some customers see more,
            some see less.
          </p>
        </section>

        {/* ── SECTION 4: Case studies ───────────── */}
        <section style={{
          padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
        }}>
          <p style={{
            fontSize: 12,
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted)',
            marginBottom: 12,
            textAlign: 'center',
          }}>
            Case studies
          </p>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 32px)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 48,
            textAlign: 'center',
          }}>
            Results by industry
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {([
              {
                industry: 'Clinic',
                name: 'Wellness First Medical Centre',
                location: 'Lagos, Nigeria',
                challenge: 'The clinic was losing an average of 12 appointments per week to no-shows, costing an estimated ₦180,000 in lost revenue monthly.',
                solution: 'Activated SMS reminders 48 hours and 2 hours before each appointment. Set up an auto-reschedule flow for contacts who replied NO.',
                results: [
                  { metric: '67%', label: 'reduction in no-shows' },
                  { metric: '₦140k', label: 'monthly revenue recovered' },
                  { metric: '2 hrs', label: 'saved per day on manual calls' },
                ],
                quote: 'We went from 12 no-shows a week to under 4. The reminders pay for themselves in the first week.',
                person: 'Dr. Amaka Osei',
                role: 'Medical Director',
                color: '#0F6E56',
                bg: '#E1F5EE',
              },
              {
                industry: 'Beauty & Wellness',
                name: 'Glow Studio',
                location: 'Abuja, Nigeria',
                challenge: 'Last-minute cancellations were leaving chairs empty with no time to fill the slots, averaging 6 lost bookings per week.',
                solution: 'Switched to WhatsApp reminders with two-way RSVP. Set up a Google review request to fire 2 hours after every completed visit.',
                results: [
                  { metric: '71%', label: 'fewer last-minute cancellations' },
                  { metric: '23', label: 'new Google reviews in 60 days' },
                  { metric: '3.2x', label: 'increase in confirmed bookings' },
                ],
                quote: 'My clients love the WhatsApp reminders. Cancellations dropped and my Google rating went from 3.8 to 4.7.',
                person: 'Temi Adeyemi',
                role: 'Owner, Glow Studio',
                color: '#993556',
                bg: '#FBEAF0',
              },
              {
                industry: 'Coaching & Consulting',
                name: 'Nwachukwu Business Consulting',
                location: 'Port Harcourt, Nigeria',
                challenge: 'The founder was spending over an hour per day manually confirming session attendance via WhatsApp.',
                solution: 'Automated pre-session reminders with Zoom links and agenda. Enabled automatic post-session follow-ups with next steps.',
                results: [
                  { metric: '1+ hr', label: 'saved daily on manual follow-ups' },
                  { metric: '89%', label: 'session confirmation rate' },
                  { metric: '100%', label: 'of clients receive follow-ups' },
                ],
                quote: 'I used to spend an hour a day chasing confirmations. Meetora handles all of it and my clients say the experience feels more professional.',
                person: 'Chidi Nwachukwu',
                role: 'Business Coach',
                color: '#185FA5',
                bg: '#E6F1FB',
              },
            ] as const).map((study) => (
              <div key={study.name} style={{
                borderRadius: 16,
                border: '0.5px solid var(--border)',
                overflow: 'hidden',
              }}>
                <div style={{
                  background: study.bg,
                  padding: '20px 28px',
                  borderBottom: `2px solid ${study.color}33`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}>
                  <div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      color: study.color,
                      marginRight: 12,
                    }}>
                      {study.industry}
                    </span>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}>
                      {study.name}
                    </span>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    {study.location}
                  </span>
                </div>

                <div style={{
                  padding: '28px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: 28,
                  background: 'var(--bg-secondary)',
                }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Challenge</p>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>{study.challenge}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8 }}>Solution</p>
                    <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>{study.solution}</p>
                  </div>

                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 16 }}>Results</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                      {study.results.map((r) => (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: study.color, minWidth: 64 }}>{r.metric}</span>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{r.label}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ borderLeft: `3px solid ${study.color}`, paddingLeft: 14 }}>
                      <p style={{ fontSize: 14, fontStyle: 'italic', color: 'var(--text-primary)', lineHeight: 1.7, marginBottom: 8 }}>&ldquo;{study.quote}&rdquo;</p>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>{study.person} — {study.role}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 5: Channel performance ────── */}
        <section style={{
          padding: 'clamp(48px, 8vw, 80px) clamp(16px, 5vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
        }}>
          <h2 style={{
            fontSize: 'clamp(20px, 2.5vw, 28px)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 12,
            textAlign: 'center',
          }}>
            Which channel gets the best response?
          </h2>
          <p style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            maxWidth: 480,
            margin: '0 auto 40px',
            lineHeight: 1.7,
          }}>
            Response rates across all Meetora reminder campaigns.
          </p>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 20,
          }}>
            {([
              { channel: 'WhatsApp', rate: '78%', label: 'response rate', note: 'Highest engagement. Two-way RSVP in the chat thread.', color: '#0F6E56', bg: '#E1F5EE', rank: 1 },
              { channel: 'SMS', rate: '61%', label: 'response rate', note: 'Universal reach. Works without smartphones or data.', color: '#185FA5', bg: '#E6F1FB', rank: 2 },
              { channel: 'Voice', rate: '54%', label: 'answer rate', note: 'Best for older demographics and urgent reminders.', color: '#854F0B', bg: '#FAEEDA', rank: 3 },
              { channel: 'Email', rate: '38%', label: 'open rate', note: 'Best for detailed reminders with attachments.', color: '#993556', bg: '#FBEAF0', rank: 4 },
            ] as const).map((ch) => (
              <div key={ch.channel} style={{
                padding: '24px 20px',
                borderRadius: 12,
                background: ch.bg,
                border: `0.5px solid ${ch.color}33`,
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  width: 22, height: 22, borderRadius: '50%',
                  background: ch.color, color: '#fff',
                  fontSize: 11, fontWeight: 700,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {ch.rank}
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: ch.color, marginBottom: 8 }}>{ch.channel}</p>
                <p style={{ fontSize: 36, fontWeight: 800, color: ch.color, lineHeight: 1, marginBottom: 4 }}>{ch.rate}</p>
                <p style={{ fontSize: 12, color: ch.color, opacity: 0.8, marginBottom: 12 }}>{ch.label}</p>
                <p style={{ fontSize: 13, color: ch.color, opacity: 0.75, lineHeight: 1.6, margin: 0 }}>{ch.note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 6: Bottom CTA ─────────────── */}
        <section style={{
          padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 80px)',
          textAlign: 'center',
          borderTop: '0.5px solid var(--border)',
        }}>
          <h2 style={{
            fontSize: 'clamp(22px, 3vw, 36px)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: 16,
          }}>
            Ready to see your own numbers?
          </h2>
          <p style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            marginBottom: 32,
            maxWidth: 420,
            margin: '0 auto 32px',
            lineHeight: 1.7,
          }}>
            Start free. Set up your first reminder in under
            5 minutes. No credit card required.
          </p>
          <div style={{
            display: 'flex', gap: 12,
            justifyContent: 'center', flexWrap: 'wrap',
          }}>
            <a href="/register" style={{
              display: 'inline-block',
              padding: '13px 32px', borderRadius: 999,
              background: 'var(--primary)', color: '#fff',
              fontSize: 15, fontWeight: 500,
              textDecoration: 'none',
            }}>
              Get started free
            </a>
            <a href="/pricing" style={{
              display: 'inline-block',
              padding: '13px 32px', borderRadius: 999,
              border: '0.5px solid var(--border)',
              color: 'var(--text-primary)',
              fontSize: 15, fontWeight: 400,
              textDecoration: 'none', background: 'transparent',
            }}>
              View pricing
            </a>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
