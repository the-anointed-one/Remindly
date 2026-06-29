'use client';
import Link from 'next/link';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faHospital, faSpa, faBullseye } from '@fortawesome/free-solid-svg-icons';

const INDUSTRIES = [
  {
    id: 'clinics',
    label: 'Clinics',
    icon: faHospital,
    headline: 'Reduce patient no-shows by up to 60%',
    subheadline:
      'Automated appointment reminders free your front desk from manual calls and keep your schedule full.',
    stat: { value: '60%', label: 'average no-show reduction' },
    useCases: [
      'Send SMS reminders 48h and 2h before appointments',
      'Capture patient confirmations automatically via reply',
      'Trigger reschedule flows instantly when patients cancel',
    ],
    testimonial: {
      quote:
        'We went from 12 no-shows a week to under 3. The automated reminders pay for themselves in the first month.',
      name: 'Dr. Amaka Osei',
      role: 'General Practitioner, Lagos',
    },
    cta: 'Start reducing no-shows',
    color: '#0F6E56',
    bg: '#E1F5EE',
  },
  {
    id: 'beauty',
    label: 'Beauty & Wellness',
    icon: faSpa,
    headline: 'Fill your chair. Stop losing revenue to last-minute gaps.',
    subheadline:
      'Keep your booking calendar full with automated reminders that confirm, reschedule, and follow up — without lifting a finger.',
    stat: { value: '3x', label: 'more confirmed bookings' },
    useCases: [
      'Auto-confirm appointments via WhatsApp or SMS reply',
      'Send location and prep instructions to confirmed clients',
      'Request Google reviews automatically after each visit',
    ],
    testimonial: {
      quote:
        'My clients love the reminders. Cancellations dropped and I get more 5-star reviews now too.',
      name: 'Temi Adeyemi',
      role: 'Owner, Glow Studio Abuja',
    },
    cta: 'Fill your calendar today',
    color: '#993556',
    bg: '#FBEAF0',
  },
  {
    id: 'coaching',
    label: 'Coaching & Consulting',
    icon: faBullseye,
    headline: 'Stop chasing clients. Start running sessions.',
    subheadline:
      'Automated session reminders and RSVP tracking mean you spend your time coaching, not following up.',
    stat: { value: '80%', label: 'fewer manual follow-ups' },
    useCases: [
      'Send pre-session reminders with agenda and Zoom link',
      'Capture attendance confirmations across SMS and Email',
      'Automate follow-up messages after each session',
    ],
    testimonial: {
      quote:
        'I used to spend an hour a day just chasing confirmations. Meetora handles all of it now.',
      name: 'Chidi Nwachukwu',
      role: 'Business Coach, Port Harcourt',
    },
    cta: 'Automate your practice',
    color: '#185FA5',
    bg: '#E6F1FB',
  },
];

export { INDUSTRIES };

interface IndustrySelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

export default function IndustrySelector({
  selected,
  onSelect,
}: IndustrySelectorProps) {
  const industry = INDUSTRIES.find((i) => i.id === selected)!;

  return (
    <section
      style={{
        padding: 'clamp(48px, 8vw, 96px) clamp(16px, 5vw, 80px)',
        maxWidth: 1100,
        margin: '0 auto',
      }}
    >
      {/* Section label */}
      <p
        style={{
          fontSize: 13,
          fontWeight: 500,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          textAlign: 'center',
          marginBottom: 12,
        }}
      >
        Built for your industry
      </p>

      {/* Selector tabs */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 48,
          flexWrap: 'wrap',
        }}
      >
        {INDUSTRIES.map((ind) => (
          <button
            key={ind.id}
            onClick={() => onSelect(ind.id)}
            style={{
              padding: '10px 20px',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: selected === ind.id ? 500 : 400,
              border: `1.5px solid ${
                selected === ind.id ? ind.color : 'var(--border)'
              }`,
              background:
                selected === ind.id ? ind.bg : 'transparent',
              color:
                selected === ind.id ? ind.color : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <FontAwesomeIcon icon={ind.icon} style={{ fontSize: 16 }} />
            {ind.label}
          </button>
        ))}
      </div>

      {/* Dynamic content panel */}
      <div
        key={industry.id}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
          alignItems: 'start',
        }}
      >
        {/* Left — headline + use cases */}
        <div>
          {/* Stat pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 999,
              background: industry.bg,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: industry.color,
              }}
            >
              {industry.stat.value}
            </span>
            <span
              style={{ fontSize: 13, color: industry.color, opacity: 0.85 }}
            >
              {industry.stat.label}
            </span>
          </div>

          {/* Headline */}
          <h2
            style={{
              fontSize: 'clamp(22px, 3vw, 32px)',
              fontWeight: 700,
              lineHeight: 1.25,
              marginBottom: 12,
              color: 'var(--text-primary)',
            }}
          >
            {industry.headline}
          </h2>

          {/* Subheadline */}
          <p
            style={{
              fontSize: 16,
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
              marginBottom: 24,
            }}
          >
            {industry.subheadline}
          </p>

          {/* Use cases */}
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px' }}>
            {industry.useCases.map((uc, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  marginBottom: 12,
                  fontSize: 15,
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: industry.bg,
                    color: industry.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  ✓
                </span>
                {uc}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <Link
            href="/register"
            style={{
              display: 'inline-block',
              padding: '12px 28px',
              borderRadius: 999,
              background: industry.color,
              color: '#fff',
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={(e) =>
              ((e.target as HTMLElement).style.opacity = '0.88')
            }
            onMouseOut={(e) =>
              ((e.target as HTMLElement).style.opacity = '1')
            }
          >
            {industry.cta} →
          </Link>
        </div>

        {/* Right — testimonial card */}
        <div
          style={{
            background: industry.bg,
            borderRadius: 16,
            padding: '28px 28px 24px',
            borderLeft: `4px solid ${industry.color}`,
          }}
        >
          <p
            style={{
              fontSize: 16,
              lineHeight: 1.75,
              color: 'var(--text-primary)',
              marginBottom: 20,
              fontStyle: 'italic',
            }}
          >
            &ldquo;{industry.testimonial.quote}&rdquo;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Avatar initials */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: industry.color,
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {industry.testimonial.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)}
            </div>
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  margin: 0,
                }}
              >
                {industry.testimonial.name}
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--text-muted)',
                  margin: 0,
                }}
              >
                {industry.testimonial.role}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
