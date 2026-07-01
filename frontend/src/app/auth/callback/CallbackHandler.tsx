'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';

export default function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();

    useEffect(() => {
        const success = searchParams.get('success');
        const error = searchParams.get('error');

        if (error) {
            router.push('/login?error=oauth_failed');
            return;
        }

        if (success === 'true') {
            // HttpOnly cookies were set by the backend during the OAuth redirect.
            // Verify the session is valid, then route the user appropriately.
            api.get('/billing')
                .then(({ data }) => {
                    const status = data?.status;
                    const active = data?.trial?.active;
                    if (status === 'TRIALING' && !active) {
                        router.push('/onboarding/plan');
                    } else {
                        router.push('/dashboard');
                    }
                })
                .catch(() => {
                    router.push('/login?error=oauth_failed');
                });
        } else {
            router.push('/login?error=oauth_failed');
        }
    }, [router, searchParams]);

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            fontSize: 14,
            color: 'var(--text-muted)',
        }}>
            Completing sign in…
        </div>
    );
}
