import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

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

  const fetchAppointments = useCallback(async () => {
    if (!tenantId) {
      setData([]);
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
    } catch (err: unknown) {
      console.warn('[useAppointments] calendar fetch failed, falling back to /appointments', err);
      try {
        const resp = await api.get('/appointments');
        setData(Array.isArray(resp.data) ? resp.data : resp.data?.data ?? []);
      } catch (fallbackErr: unknown) {
        console.error('[useAppointments] fallback /appointments failed', fallbackErr);
        setData([]);
        setError(fallbackErr);
      }
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { void fetchAppointments(); }, [fetchAppointments]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchAppointments,
    queryKey: ['appointments', tenantId || ''],
  };
};
