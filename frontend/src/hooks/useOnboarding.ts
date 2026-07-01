'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

interface UseOnboardingReturn {
    showOnboarding: boolean;
    loadingOnboarding: boolean;
    completeOnboarding: () => Promise<void>;
    skipOnboarding: () => Promise<void>;
}

/**
 * Reads `onboardingCompleted` from the tenant settings JSON blob.
 * No schema migration required — the existing PATCH /tenants/settings
 * endpoint deep-merges any key into the settings JSON.
 *
 * Only runs after `enabled` is true (i.e. after auth resolves and the
 * user is confirmed logged in) so it never fires during the loading phase.
 */
export function useOnboarding(enabled: boolean): UseOnboardingReturn {
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [loadingOnboarding, setLoadingOnboarding] = useState(true);

    useEffect(() => {
        if (!enabled) return;

        let cancelled = false;
        api.get('/tenants/settings')
            .then(({ data }) => {
                if (!cancelled) {
                    setShowOnboarding(data?.onboardingCompleted !== true);
                    setLoadingOnboarding(false);
                }
            })
            .catch(() => {
                // On error, don't block the user — silently skip onboarding
                if (!cancelled) {
                    setShowOnboarding(false);
                    setLoadingOnboarding(false);
                }
            });

        return () => { cancelled = true; };
    }, [enabled]);

    const markComplete = useCallback(async () => {
        setShowOnboarding(false);
        // Optimistically close the modal so the UI feels instant, but surface any
        // persistence failure instead of swallowing it — a silent failure here is
        // what makes the modal reappear on the next visit.
        try {
            await api.patch('/tenants/settings', { onboardingCompleted: true });
        } catch (err) {
            console.error('[Onboarding] Failed to persist onboardingCompleted:', err);
        }
    }, []);

    return {
        showOnboarding,
        loadingOnboarding,
        completeOnboarding: markComplete,
        skipOnboarding: markComplete,
    };
}
