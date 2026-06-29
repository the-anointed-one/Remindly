'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Suspense } from 'react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function verifyPayment() {
      const reference = searchParams.get('reference') || searchParams.get('trxref');

      if (!reference) {
        router.replace('/onboarding/checkout?error=no_reference');
        return;
      }

      try {
        await api.post('/billing/verify', { reference });
        router.replace('/dashboard');
      } catch (err) {
        console.error('Payment verification failed:', err);
        router.replace('/onboarding/checkout?error=payment_failed');
      }
    }

    verifyPayment();
  }, [router, searchParams]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      flexDirection: 'column',
      gap: 16,
      background: 'var(--bg-base)',
      color: 'var(--text-primary)'
    }}>
      <div className="spinner" style={{ 
        width: 40, 
        height: 40, 
        border: '3px solid rgba(0,169,157,0.1)', 
        borderTopColor: 'var(--accent-cta)', 
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <p style={{ fontSize: 16, fontWeight: 500 }}>
        Verifying your payment...
      </p>
      <style jsx>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div style={{
        display: 'flex', 
        alignItems: 'center',
        justifyContent: 'center', 
        minHeight: '100vh',
        background: 'var(--bg-base)',
        color: 'var(--text-primary)'
      }}>
        <p>Verifying payment...</p>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
