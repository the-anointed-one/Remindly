'use client';
import { INDUSTRIES } from './IndustrySelector';

const WORKFLOWS: Record<string, {
  title: string;
  steps: { number: string; label: string; detail: string }[];
}> = {
  clinics: {
    title: 'How Meetora works for clinics',
    steps: [
      {
        number: '01',
        label: 'Patient books appointment',
        detail: 'New appointments sync automatically from your booking system or are added manually.',
      },
      {
        number: '02',
        label: 'Reminders sent automatically',
        detail: 'SMS and WhatsApp reminders go out 48 hours and 2 hours before — no manual calls.',
      },
      {
        number: '03',
        label: 'Patient confirms or reschedules',
        detail: 'Patients reply YES to confirm or NO to cancel. Status updates instantly in your dashboard.',
      },
      {
        number: '04',
        label: 'No-show risk flagged early',
        detail: 'AI flags high-risk appointments so staff can follow up before the slot is lost.',
      },
    ],
  },
  beauty: {
    title: 'How Meetora works for beauty & wellness',
    steps: [
      {
        number: '01',
        label: 'Client books a session',
        detail: 'Bookings come in via your existing system. Meetora picks them up automatically.',
      },
      {
        number: '02',
        label: 'WhatsApp reminder sent',
        detail: 'A friendly reminder goes out with the appointment time, location, and prep instructions.',
      },
      {
        number: '03',
        label: 'Client confirms with one reply',
        detail: 'Client replies YES — confirmed. Replies NO — a reschedule flow triggers automatically.',
      },
      {
        number: '04',
        label: 'Review request sent after visit',
        detail: 'A Google review request goes out automatically 2 hours after the appointment ends.',
      },
    ],
  },
  coaching: {
    title: 'How Meetora works for coaches',
    steps: [
      {
        number: '01',
        label: 'Session scheduled',
        detail: 'Add contacts and create a session event. Meetora handles everything from here.',
      },
      {
        number: '02',
        label: 'Pre-session reminder sent',
        detail: 'Client receives a reminder with the Zoom link, agenda, and session time — automatically.',
      },
      {
        number: '03',
        label: 'Attendance confirmed',
        detail: 'Client confirms via SMS or Email. You see live attendance status before the session starts.',
      },
      {
        number: '04',
        label: 'Follow-up sent automatically',
        detail: 'A post-session follow-up with notes or next steps goes out without you lifting a finger.',
      },
    ],
  },
};

interface IndustryWorkflowProps {
  selected: string;
}

export default function IndustryWorkflow({ selected }: IndustryWorkflowProps) {
  const industry = INDUSTRIES.find((i) => i.id === selected)!;
  const workflow = WORKFLOWS[selected];

  if (!workflow) return null;

  return (
    <section
      style={{
        padding: 'clamp(32px, 6vw, 72px) clamp(16px, 5vw, 80px)',
        maxWidth: 1100,
        margin: '0 auto',
        borderTop: '0.5px solid var(--border)',
      }}
    >
      {/* Title */}
      <h3
        style={{
          fontSize: 'clamp(18px, 2.5vw, 24px)',
          fontWeight: 600,
          color: 'var(--text-primary)',
          marginBottom: 40,
          textAlign: 'center',
        }}
      >
        {workflow.title}
      </h3>

      {/* Steps */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 24,
        }}
      >
        {workflow.steps.map((step, index) => (
          <div key={step.number} style={{ position: 'relative' }}>
            {/* Connector line between steps (hidden on last) */}
            {index < workflow.steps.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  top: 20,
                  right: -12,
                  width: 24,
                  height: 1,
                  background: 'var(--border)',
                  display: 'none', // hidden on mobile, shown on desktop via grid gap
                }}
              />
            )}

            {/* Step number */}
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: industry.bg,
                color: industry.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {step.number}
            </div>

            {/* Step label */}
            <p
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: 8,
                lineHeight: 1.3,
              }}
            >
              {step.label}
            </p>

            {/* Step detail */}
            <p
              style={{
                fontSize: 14,
                color: 'var(--text-secondary)',
                lineHeight: 1.65,
                margin: 0,
              }}
            >
              {step.detail}
            </p>
          </div>
        ))}
      </div>

      {/* Bottom CTA */}
      <div style={{ textAlign: 'center', marginTop: 48 }}>
        <p
          style={{
            fontSize: 15,
            color: 'var(--text-secondary)',
            marginBottom: 16,
          }}
        >
          Ready to automate your attendance workflow?
        </p>
        
        <a
          href="/register"
          style={{
            display: 'inline-block',
            padding: '12px 32px',
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
          Get started free →
        </a>
      </div>
    </section>
  );
}
