import Navbar from '@/components/marketing/Navbar';
import Footer from '@/components/marketing/Footer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Industries — Meetora',
  description:
    'Meetora helps clinics, beauty studios, and coaching practices automate attendance reminders, capture RSVPs, and reduce no-shows.',
};

export default function IndustriesPage() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: 'var(--bg-app)' }}>

        {/* ── HERO ──────────────────────────────────── */}
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
            Built for your business
          </p>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 54px)',
            fontWeight: 700,
            lineHeight: 1.15,
            color: 'var(--text-primary)',
            maxWidth: 680,
            margin: '0 auto 20px',
          }}>
            Attendance automation for every appointment-based business
          </h1>
          <p style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            maxWidth: 520,
            margin: '0 auto 40px',
          }}>
            Whether you run a clinic, a beauty studio, or a
            coaching practice — Meetora fits your workflow.
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
            Start free for your industry →
          </a>
        </section>

        {/* ── INDUSTRY 1: CLINICS ───────────────────── */}
        <section style={{
          padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 48,
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#E1F5EE',
                marginBottom: 20,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#0F6E56',
                }}>
                  Clinics & Healthcare
                </span>
              </div>
              <h2 style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 700,
                lineHeight: 1.2,
                color: 'var(--text-primary)',
                marginBottom: 16,
              }}>
                Reduce patient no-shows. Keep your schedule full.
              </h2>
              <p style={{
                fontSize: 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                marginBottom: 28,
              }}>
                Patient no-shows cost clinics thousands in lost
                revenue every month. Meetora sends automated
                reminders via SMS and WhatsApp, captures patient
                confirmations without any manual work, and flags
                high-risk appointments before they become no-shows.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px' }}>
                {[
                  'Automated SMS and WhatsApp reminders at 48h and 2h',
                  'Patients confirm or reschedule by replying to the message',
                  'AI no-show risk scoring for proactive intervention',
                  'Works alongside your existing booking system',
                ].map((point) => (
                  <li key={point} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 12,
                    fontSize: 15,
                    color: 'var(--text-primary)',
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#E1F5EE', color: '#0F6E56',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11,
                      fontWeight: 700, flexShrink: 0, marginTop: 2,
                    }}>✓</span>
                    {point}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <a href="/register" style={{
                  padding: '11px 24px', borderRadius: 999,
                  background: '#0F6E56', color: '#fff',
                  fontSize: 14, fontWeight: 500,
                  textDecoration: 'none',
                }}>
                  Start reducing no-shows
                </a>
                <a href="/insights" style={{
                  padding: '11px 24px', borderRadius: 999,
                  border: '0.5px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 14, fontWeight: 400,
                  textDecoration: 'none',
                }}>
                  See clinic results →
                </a>
              </div>
            </div>

            {/* Stat card */}
            <div style={{
              background: '#E1F5EE',
              borderRadius: 20,
              padding: '36px 32px',
              borderLeft: '4px solid #0F6E56',
            }}>
              <p style={{
                fontSize: 56,
                fontWeight: 800,
                color: '#0F6E56',
                lineHeight: 1,
                marginBottom: 8,
              }}>
                67%
              </p>
              <p style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#0F6E56',
                marginBottom: 16,
              }}>
                average reduction in patient no-shows
              </p>
              <p style={{
                fontSize: 14,
                color: '#0F6E56',
                opacity: 0.8,
                lineHeight: 1.7,
                marginBottom: 24,
              }}>
                Measured across clinic customers in their first
                90 days using Meetora automated reminders.
              </p>
              <div style={{
                borderTop: '0.5px solid #0F6E5633',
                paddingTop: 20,
              }}>
                <p style={{
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: '#085041',
                  lineHeight: 1.7,
                  marginBottom: 10,
                }}>
                  &ldquo;We went from 12 no-shows a week to under 4.
                  The reminders pay for themselves in the first week.&rdquo;
                </p>
                <p style={{
                  fontSize: 13,
                  color: '#0F6E56',
                  opacity: 0.75,
                  margin: 0,
                }}>
                  Dr. Amaka Osei — Medical Director, Lagos
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── INDUSTRY 2: BEAUTY & WELLNESS ─────────── */}
        <section style={{
          padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 48,
            alignItems: 'center',
          }}>
            {/* Stat card — left on this row */}
            <div style={{
              background: '#FBEAF0',
              borderRadius: 20,
              padding: '36px 32px',
              borderLeft: '4px solid #993556',
              order: 2, // Reorder to stack appropriately on mobile
            }}>
              <p style={{
                fontSize: 56,
                fontWeight: 800,
                color: '#993556',
                lineHeight: 1,
                marginBottom: 8,
              }}>
                3.2x
              </p>
              <p style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#993556',
                marginBottom: 16,
              }}>
                increase in confirmed bookings
              </p>
              <p style={{
                fontSize: 14,
                color: '#993556',
                opacity: 0.8,
                lineHeight: 1.7,
                marginBottom: 24,
              }}>
                Beauty and wellness studios using two-way WhatsApp
                RSVP see 3x more confirmed bookings vs manual
                reminder calls.
              </p>
              <div style={{
                borderTop: '0.5px solid #99355633',
                paddingTop: 20,
              }}>
                <p style={{
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: '#72243E',
                  lineHeight: 1.7,
                  marginBottom: 10,
                }}>
                  &ldquo;My clients love the WhatsApp reminders.
                  Cancellations dropped and my Google rating went
                  from 3.8 to 4.7.&rdquo;
                </p>
                <p style={{
                  fontSize: 13,
                  color: '#993556',
                  opacity: 0.75,
                  margin: 0,
                }}>
                  Temi Adeyemi — Owner, Glow Studio Abuja
                </p>
              </div>
            </div>

            <div style={{ order: 1 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#FBEAF0',
                marginBottom: 20,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#993556',
                }}>
                  Beauty & Wellness
                </span>
              </div>
              <h2 style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 700,
                lineHeight: 1.2,
                color: 'var(--text-primary)',
                marginBottom: 16,
              }}>
                Fill your chair. Stop losing revenue to last-minute gaps.
              </h2>
              <p style={{
                fontSize: 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                marginBottom: 28,
              }}>
                Last-minute cancellations leave chairs empty with
                no time to fill them. Meetora sends WhatsApp
                reminders, captures confirmations automatically,
                and requests Google reviews after every visit —
                without you lifting a finger.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px' }}>
                {[
                  'WhatsApp reminders with prep instructions and location',
                  'Clients confirm or reschedule by replying YES or NO',
                  'Automatic Google review requests after each visit',
                  'Reschedule flows triggered instantly on cancellation',
                ].map((point) => (
                  <li key={point} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 12,
                    fontSize: 15,
                    color: 'var(--text-primary)',
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#FBEAF0', color: '#993556',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11,
                      fontWeight: 700, flexShrink: 0, marginTop: 2,
                    }}>✓</span>
                    {point}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <a href="/register" style={{
                  padding: '11px 24px', borderRadius: 999,
                  background: '#993556', color: '#fff',
                  fontSize: 14, fontWeight: 500,
                  textDecoration: 'none',
                }}>
                  Fill your calendar today
                </a>
                <a href="/insights" style={{
                  padding: '11px 24px', borderRadius: 999,
                  border: '0.5px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 14, fontWeight: 400,
                  textDecoration: 'none',
                }}>
                  See beauty results →
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── INDUSTRY 3: COACHING & CONSULTING ─────── */}
        <section style={{
          padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 80px)',
          maxWidth: 1100,
          margin: '0 auto',
          borderTop: '0.5px solid var(--border)',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: 48,
            alignItems: 'center',
          }}>
            <div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 999,
                background: '#E6F1FB',
                marginBottom: 20,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#185FA5',
                }}>
                  Coaching & Consulting
                </span>
              </div>
              <h2 style={{
                fontSize: 'clamp(24px, 3vw, 36px)',
                fontWeight: 700,
                lineHeight: 1.2,
                color: 'var(--text-primary)',
                marginBottom: 16,
              }}>
                Stop chasing clients. Start running sessions.
              </h2>
              <p style={{
                fontSize: 16,
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                marginBottom: 28,
              }}>
                Coaches and consultants spend hours every week
                chasing session confirmations. Meetora sends
                pre-session reminders with Zoom links and agenda,
                captures attendance automatically, and sends
                post-session follow-ups without any manual effort.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px' }}>
                {[
                  'Pre-session reminders with Zoom link and agenda included',
                  'Attendance confirmed via SMS or Email reply',
                  'Post-session follow-ups sent automatically',
                  'Live attendance dashboard before sessions start',
                ].map((point) => (
                  <li key={point} style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    marginBottom: 12,
                    fontSize: 15,
                    color: 'var(--text-primary)',
                  }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#E6F1FB', color: '#185FA5',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11,
                      fontWeight: 700, flexShrink: 0, marginTop: 2,
                    }}>✓</span>
                    {point}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <a href="/register" style={{
                  padding: '11px 24px', borderRadius: 999,
                  background: '#185FA5', color: '#fff',
                  fontSize: 14, fontWeight: 500,
                  textDecoration: 'none',
                }}>
                  Automate your practice
                </a>
                <a href="/insights" style={{
                  padding: '11px 24px', borderRadius: 999,
                  border: '0.5px solid var(--border)',
                  color: 'var(--text-primary)',
                  fontSize: 14, fontWeight: 400,
                  textDecoration: 'none',
                }}>
                  See coaching results →
                </a>
              </div>
            </div>

            {/* Stat card */}
            <div style={{
              background: '#E6F1FB',
              borderRadius: 20,
              padding: '36px 32px',
              borderLeft: '4px solid #185FA5',
            }}>
              <p style={{
                fontSize: 56,
                fontWeight: 800,
                color: '#185FA5',
                lineHeight: 1,
                marginBottom: 8,
              }}>
                89%
              </p>
              <p style={{
                fontSize: 16,
                fontWeight: 600,
                color: '#185FA5',
                marginBottom: 16,
              }}>
                session confirmation rate
              </p>
              <p style={{
                fontSize: 14,
                color: '#185FA5',
                opacity: 0.8,
                lineHeight: 1.7,
                marginBottom: 24,
              }}>
                Coaches using Meetora automated reminders confirm
                89% of sessions before they start — and spend
                over 1 hour less per day on manual follow-ups.
              </p>
              <div style={{
                borderTop: '0.5px solid #185FA533',
                paddingTop: 20,
              }}>
                <p style={{
                  fontSize: 14,
                  fontStyle: 'italic',
                  color: '#0C447C',
                  lineHeight: 1.7,
                  marginBottom: 10,
                }}>
                  &ldquo;I used to spend an hour a day chasing
                  confirmations. Meetora handles all of it and my
                  clients say the experience feels more
                  professional.&rdquo;
                </p>
                <p style={{
                  fontSize: 13,
                  color: '#185FA5',
                  opacity: 0.75,
                  margin: 0,
                }}>
                  Chidi Nwachukwu — Business Coach, Port Harcourt
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ────────────────────────────── */}
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
            Your industry. Your workflow. Automated.
          </h2>
          <p style={{
            fontSize: 16,
            color: 'var(--text-secondary)',
            maxWidth: 440,
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
