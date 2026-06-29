import { Suspense } from 'react';
import CallbackHandler from './CallbackHandler';

export const dynamic = 'force-dynamic';

export default function AuthCallbackPage() {
    return (
        <Suspense
            fallback={
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
            }
        >
            <CallbackHandler />
        </Suspense>
    );
}
