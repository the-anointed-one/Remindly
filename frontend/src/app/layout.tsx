import type { Metadata } from 'next';
import '@fontsource/plus-jakarta-sans/300.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import './globals.css';
import '@/lib/fontawesome';
import { ToastProvider } from '@/components/Toast';
import { AuthProvider } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Meetora — Smart Appointment Reminders That Reduce No-Shows',
  description: 'Automated SMS, voice, and AI-powered appointment reminders for dentists, salons, auto repair shops, and service businesses. Reduce no-shows by up to 70%.',
  keywords: 'appointment reminders, no show reduction, SMS reminders, voice reminders, AI appointment, dentist reminders, salon reminders',
  openGraph: {
    title: 'Meetora — Smart Appointment Reminders',
    description: 'Reduce no-shows by up to 70% with automated SMS, voice, and AI-powered reminders.',
    type: 'website',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-app text-body">
        <AuthProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
