'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
// import { useAuth } from '@/lib/auth';

export default function CallbackHandler() {
    const router = useRouter();
    const searchParams = useSearchParams();
    // const { refreshProfile } = useAuth(); // Potential enhancement, but sticking to existing logic first

    useEffect(() => {
        try {
            // Try query string params first
            let accessToken = searchParams.get('accessToken') || searchParams.get('access_token');
            let refreshToken = searchParams.get('refreshToken') || searchParams.get('refresh_token');

            // Fallback to URL hash
            if (!accessToken && window.location.hash) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                accessToken = hashParams.get('accessToken') || hashParams.get('access_token');
                refreshToken = hashParams.get('refreshToken') || hashParams.get('refresh_token');
            }

            if (accessToken && refreshToken) {
                localStorage.setItem('accessToken', accessToken);
                localStorage.setItem('refreshToken', refreshToken);
                // Optionally trigger auth refresh here if needed, but sticking to existing behavior
                router.push('/dashboard');
            } else {
                console.error('Missing tokens in OAuth callback');
                router.push('/login?error=oauth_failed');
            }
        } catch (err) {
            console.error('OAuth callback parsing error:', err);
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
            Completing sign in...
        </div>
    );
}
