import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Attendlyx — Smart Appointment Reminders That Reduce No-Shows',
  description: 'Automated SMS, voice, and AI-powered appointment reminders for dentists, salons, auto repair shops, and service businesses. Reduce no-shows by up to 70%.',
  keywords: 'appointment reminders, no show reduction, SMS reminders, voice reminders, AI appointment, dentist reminders, salon reminders',
  openGraph: {
    title: 'Attendlyx — Smart Appointment Reminders',
    description: 'Reduce no-shows by up to 70% with automated SMS, voice, and AI-powered reminders.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
