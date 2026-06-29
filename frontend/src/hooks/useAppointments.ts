import { useState, useEffect, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';

export interface AppointmentRaw {
  id: string;
  title: string;
  description?: string | null;
  scheduledAt?: string;
  scheduled_at?: string;
  startTime?: string;
  endTime?: string | null;
  end_time?: string | null;
  location?: string | null;
  type?: 'event' | 'appointment';
  status?: string;
  eventType?: string;
  isDemoData?: boolean;
  _count?: { participants?: number; responses?: number };
  [key: string]: string | boolean | number | object | undefined | null;
}

export interface UseAppointmentsResult {
  data: AppointmentRaw[];
  isLoading: boolean;
  error: any;
  refetch: () => Promise<void>;
  queryKey: string[];
}

export const useAppointments = (tenantId?: string): UseAppointmentsResult => {
  const [data, setData] = useState<AppointmentRaw[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const { isAuthenticated, loading: authLoading } = useAuth();

  const lastFetchedRef = useRef<number>(0);
  const STALE_TIME = 60000;

  const fetchAppointments = useCallback(async (force = false) => {
    if (!tenantId) {
      setData([]);
      setIsLoading(false);
      return;
    }

    if (!force && Date.now() - lastFetchedRef.current < STALE_TIME && data.length > 0) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    try {
      const resp = await api.get(`/events/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const entries = [
        ...(resp.data?.appointments ?? []),
        ...(resp.data?.events ?? []),
      ];
      setData(entries);
      lastFetchedRef.current = Date.now();
    } catch (err: unknown) {
      console.warn('[useAppointments] calendar fetch failed, falling back to /appointments', err);
      try {
        const resp = await api.get('/appointments');
        // Handle both plain array and { data: Appointment[] } shapes
        setData(Array.isArray(resp.data) ? resp.data : resp.data?.data ?? []);
        lastFetchedRef.current = Date.now();
      } catch (fallbackErr: unknown) {
        console.error('[useAppointments] fallback /appointments failed', fallbackErr);
        setData([]);
        setError(fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, data]);

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    void fetchAppointments();
  }, [isAuthenticated, authLoading, fetchAppointments]);

  return {
    data,
    isLoading,
    error,
    refetch: () => fetchAppointments(true),
    queryKey: ['appointments', tenantId || ''],
  };
};
