'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { faUsers, faCircleCheck, faClock, faXmark } from '@fortawesome/free-solid-svg-icons';

interface RsvpStats {
    eventId: string;
    eventTitle: string;
    eventStartTime: Date | string;
    total: number;
    invited: number;
    confirmed: number;
    pending: number;
    cancelled: number;
    confirmationRate: number;
}

interface EventRsvpTrackerProps {
    eventId: string;
    onStatsLoaded?: (stats: RsvpStats) => void;
}

export function EventRsvpTracker({ eventId, onStatsLoaded }: EventRsvpTrackerProps) {
    const [stats, setStats] = useState<RsvpStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { data } = await api.get(`/events/${eventId}/stats`);
                setStats(data);
                onStatsLoaded?.(data);
            } catch (err) {
                console.error('Failed to load RSVP stats:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        // Poll every 10 seconds for live updates
        const interval = setInterval(fetchStats, 10000);
        return () => clearInterval(interval);
    }, [eventId, onStatsLoaded]);

    if (loading || !stats) {
        return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading RSVP stats...</div>;
    }

    const rsvpItems = [
        { label: 'Confirmed', value: stats.confirmed, icon: faCircleCheck, color: '#22c55e' },
        { label: 'Pending', value: stats.pending, icon: faClock, color: '#f59e0b' },
        { label: 'Invited', value: stats.invited, icon: faUsers, color: '#6b7280' },
        { label: 'Declined', value: stats.cancelled, icon: faXmark, color: '#ef4444' },
    ];

    const confirmationPercentage = stats.total > 0 ? Math.round((stats.confirmed / stats.total) * 100) : 0;

    return (
        <div style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: 20,
            marginBottom: 20,
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon icon={faUsers} /> RSVP Status
                </h3>
                <div style={{
                    fontSize: 18,
                    fontWeight: 800,
                    color: confirmationPercentage >= 70 ? '#22c55e' : confirmationPercentage >= 50 ? '#f59e0b' : '#ef4444',
                }}>
                    {confirmationPercentage}%
                </div>
            </div>

            {/* Overview */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 12,
                marginBottom: 16,
            }}>
                {rsvpItems.map((item) => (
                    <div
                        key={item.label}
                        style={{
                            background: `${item.color}0d`,
                            border: `1px solid ${item.color}40`,
                            borderRadius: 8,
                            padding: 12,
                            textAlign: 'center',
                        }}
                    >
                        <div style={{ fontSize: 24, fontWeight: 800, color: item.color, marginBottom: 4 }}>
                            {item.value}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                            {item.label}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {stats.total > 0 ? Math.round((item.value / stats.total) * 100) : 0}%
                        </div>
                    </div>
                ))}
            </div>

            {/* Progress bar */}
            <div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Confirmation Rate</div>
                <div style={{
                    height: 8,
                    background: 'var(--bg-secondary)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    position: 'relative',
                }}>
                    <div
                        style={{
                            height: '100%',
                            width: `${confirmationPercentage}%`,
                            background: confirmationPercentage >= 70 
                                ? 'linear-gradient(90deg, #22c55e, #16a34a)' 
                                : confirmationPercentage >= 50 
                                ? 'linear-gradient(90deg, #f59e0b, #d97706)' 
                                : 'linear-gradient(90deg, #ef4444, #dc2626)',
                            transition: 'width 0.4s ease',
                            borderRadius: 4,
                        }}
                    />
                </div>
            </div>

            {/* Summary */}
            <div style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginTop: 12,
                paddingTop: 12,
                borderTop: '1px solid var(--border-color)',
            }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stats.confirmed}</span> confirmed,{' '}
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stats.pending}</span> pending,{' '}
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stats.total}</span> total
            </div>
        </div>
    );
}
