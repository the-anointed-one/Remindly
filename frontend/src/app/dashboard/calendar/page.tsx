'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import Icon from '@/components/ui/Icon';
import { faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';

interface CalendarEntry {
    id: string;
    type: 'event' | 'appointment';
    title: string;
    startTime: string;
    endTime: string | null;
    status: string;
    eventType?: string;
    location?: string | null;
    participantCount?: number;
}

const STATUS_DOT: Record<string, string> = {
    DRAFT: '#6b7280',
    PUBLISHED: '#3b82f6',
    ACTIVE: '#22c55e',
    SCHEDULED: '#f59e0b',
    CONFIRMED: '#22c55e',
    COMPLETED: '#8b5cf6',
    CANCELLED: '#ef4444',
    NO_SHOW: '#ec4899',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

export default function CalendarPage() {
    const today = new Date();
    const [viewYear, setViewYear] = useState(today.getFullYear());
    const [viewMonth, setViewMonth] = useState(today.getMonth());
    const [entries, setEntries] = useState<CalendarEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const from = new Date(viewYear, viewMonth, 1).toISOString();
        const to = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString();
        setLoading(true);
        api.get(`/events/calendar?from=${from}&to=${to}`)
            .then(({ data }) => {
                const combined: CalendarEntry[] = [
                    ...(data.events ?? []),
                    ...(data.appointments ?? []),
                ];
                setEntries(combined);
            })
            .catch(() => setEntries([]))
            .finally(() => setLoading(false));
    }, [viewYear, viewMonth]);

    const prevMonth = () => {
        if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
        else setViewMonth(m => m - 1);
    };
    const nextMonth = () => {
        if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
        else setViewMonth(m => m + 1);
    };

    // Build calendar grid
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [
        ...Array(firstDay).fill(null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const entriesByDay = new Map<number, CalendarEntry[]>();
    for (const entry of entries) {
        const d = new Date(entry.startTime);
        if (d.getFullYear() === viewYear && d.getMonth() === viewMonth) {
            const day = d.getDate();
            if (!entriesByDay.has(day)) entriesByDay.set(day, []);
            entriesByDay.get(day)!.push(entry);
        }
    }

    const isToday = (day: number) =>
        day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

    return (
        <div style={{ maxWidth: 960 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800 }}>Calendar</h1>
                <Link href="/dashboard/events" className="btn btn-primary btn-sm">+ New Event</Link>
            </div>

            {/* Month navigation */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                    <button onClick={prevMonth} className="btn btn-outline btn-sm" style={{ padding: '6px 12px' }}>
                        <Icon icon={faChevronLeft} />
                    </button>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
                    <button onClick={nextMonth} className="btn btn-outline btn-sm" style={{ padding: '6px 12px' }}>
                        <Icon icon={faChevronRight} />
                    </button>
                </div>

                {/* Day headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {DAY_NAMES.map(d => (
                        <div key={d} style={{ padding: '10px 0', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* Calendar cells */}
                {loading ? (
                    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
                        {cells.map((day, idx) => {
                            const dayEntries = day ? (entriesByDay.get(day) ?? []) : [];
                            const todayDay = day ? isToday(day) : false;
                            return (
                                <div
                                    key={idx}
                                    style={{
                                        minHeight: 90,
                                        padding: '8px 6px',
                                        borderRight: (idx + 1) % 7 !== 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        borderBottom: idx < cells.length - 7 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                        background: todayDay ? 'rgba(99,102,241,0.06)' : 'transparent',
                                    }}
                                >
                                    {day && (
                                        <>
                                            <div style={{
                                                fontSize: 13, fontWeight: 600, marginBottom: 4,
                                                width: 22, height: 22, borderRadius: '50%', marginLeft: 'auto',
                                                background: todayDay ? 'var(--accent)' : 'transparent',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: todayDay ? '#fff' : 'var(--text-secondary)',
                                            }}>
                                                {day}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                {dayEntries.slice(0, 3).map((entry) => (
                                                    <Link
                                                        key={entry.id}
                                                        href={`/dashboard/events/${entry.id}`}
                                                        style={{ textDecoration: 'none' }}
                                                    >
                                                        <div style={{
                                                            fontSize: 10, fontWeight: 600, padding: '2px 5px', borderRadius: 3,
                                                            background: `${STATUS_DOT[entry.status] ?? '#6b7280'}22`,
                                                            borderLeft: `2px solid ${STATUS_DOT[entry.status] ?? '#6b7280'}`,
                                                            color: 'var(--text-primary)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                                                        }}>
                                                            {entry.title}
                                                        </div>
                                                    </Link>
                                                ))}
                                                {dayEntries.length > 3 && (
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 5 }}>
                                                        +{dayEntries.length - 3} more
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
