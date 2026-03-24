'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircleExclamation, faBell, faCheck } from '@fortawesome/free-solid-svg-icons';

// ── Types ────────────────────────────────────

interface ServiceItem { name: string; duration: number; price?: number }

interface WidgetData {
    tenantId: string;
    businessName: string;
    welcomeMessage: string | null;
    services: ServiceItem[];
    accentColor: string;
    slotDuration: number;
    workingDays: number[];
    workingHoursStart: string;
    workingHoursEnd: string;
}

type Step = 'service' | 'datetime' | 'contact' | 'confirm';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ── Calendar ─────────────────────────────────

function MiniCalendar({
    selected, onSelect, workingDays, accentColor,
}: {
    selected: string | null;
    onSelect: (d: string) => void;
    workingDays: number[];
    accentColor: string;
}) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const offset = firstDay === 0 ? 6 : firstDay - 1; // shift to Mon-start

    const toIso = (d: Date) => d.toISOString().slice(0, 10);
    const isoDay = (d: Date) => d.getDay() === 0 ? 7 : d.getDay();

    const prevMonth = () => setCursor(new Date(year, month - 1, 1));
    const nextMonth = () => setCursor(new Date(year, month + 1, 1));

    const monthLabel = cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    return (
        <div style={{ width: '100%', maxWidth: 320 }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <button onClick={prevMonth} style={navBtnStyle}>‹</button>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{monthLabel}</span>
                <button onClick={nextMonth} style={navBtnStyle}>›</button>
            </div>

            {/* Weekday labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <div key={i} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94a3b8', padding: '4px 0' }}>{d}</div>
                ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                    const date = new Date(year, month, i + 1);
                    const iso = toIso(date);
                    const isPast = date < today;
                    const isWorking = workingDays.includes(isoDay(date));
                    const isSelected = selected === iso;
                    const isToday = iso === toIso(today);
                    const disabled = isPast || !isWorking;

                    return (
                        <button
                            key={i}
                            onClick={() => !disabled && onSelect(iso)}
                            disabled={disabled}
                            style={{
                                aspectRatio: '1', borderRadius: 8, border: isSelected ? `2px solid ${accentColor}` : isToday ? `1px solid ${accentColor}60` : '1px solid transparent',
                                background: isSelected ? accentColor : 'transparent',
                                color: isSelected ? '#fff' : disabled ? '#475569' : '#f8fafc',
                                fontSize: 13, fontWeight: isSelected ? 700 : 500, cursor: disabled ? 'not-allowed' : 'pointer',
                                opacity: disabled ? 0.35 : 1, transition: 'all 0.12s',
                            }}
                        >{i + 1}</button>
                    );
                })}
            </div>
        </div>
    );
}

const navBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1,
};

// ── Time slot grid ────────────────────────────

function SlotGrid({ slots, selected, onSelect, accentColor }: {
    slots: string[]; selected: string | null; onSelect: (s: string) => void; accentColor: string;
}) {
    if (slots.length === 0) {
        return <div style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>No available slots on this day.</div>;
    }
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {slots.map((s) => {
                const active = selected === s;
                const [h, m] = s.split(':').map(Number);
                const suffix = h >= 12 ? 'pm' : 'am';
                const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                const label = `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
                return (
                    <button
                        key={s}
                        onClick={() => onSelect(s)}
                        style={{
                            padding: '10px 6px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            border: `1.5px solid ${active ? accentColor : 'rgba(255,255,255,0.12)'}`,
                            background: active ? accentColor : 'rgba(255,255,255,0.04)',
                            color: active ? '#fff' : '#e2e8f0', transition: 'all 0.12s',
                        }}
                    >{label}</button>
                );
            })}
        </div>
    );
}

// ── Step indicator ────────────────────────────

function StepDots({ step, accent }: { step: Step; accent: string }) {
    const steps: Step[] = ['service', 'datetime', 'contact', 'confirm'];
    const labels = ['Service', 'Date & Time', 'Your Info', 'Done'];
    const current = steps.indexOf(step);
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
            {steps.map((s, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: done ? accent : active ? accent : 'rgba(255,255,255,0.08)',
                                color: done || active ? '#fff' : '#64748b',
                                border: `2px solid ${done || active ? accent : 'rgba(255,255,255,0.1)'}`,
                                transition: 'all 0.2s',
                            }}>
                                {done ? <FontAwesomeIcon icon={faCheck} style={{ fontSize: 10 }} /> : i + 1}
                            </div>
                            <span style={{ fontSize: 10, color: active ? '#e2e8f0' : '#64748b', fontWeight: active ? 700 : 500, whiteSpace: 'nowrap' }}>{labels[i]}</span>
                        </div>
                        {i < steps.length - 1 && (
                            <div style={{ width: 40, height: 2, background: i < current ? accent : 'rgba(255,255,255,0.08)', margin: '0 4px', marginBottom: 14, transition: 'background 0.3s' }} />
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ── Main widget ──────────────────────────────

export default function BookingWidget() {
    const { tenantId } = useParams<{ tenantId: string }>();
    const [widgetData, setWidgetData] = useState<WidgetData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState<Step>('service');

    // Selections
    const [selectedService, setSelectedService] = useState<number | null>(null);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [slots, setSlots] = useState<string[]>([]);
    const [loadingSlots, setLoadingSlots] = useState(false);
    const [form, setForm] = useState({ name: '', phone: '', email: '' });
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ service: string; scheduledAt: string; remindersScheduled: number } | null>(null);

    // Load widget config
    useEffect(() => {
        if (!tenantId) return;
        fetch(`${API_BASE}/public/booking/${tenantId}`)
            .then((r) => r.ok ? r.json() : Promise.reject(r.status))
            .then(setWidgetData)
            .catch(() => setError('This booking widget is not available.'));
    }, [tenantId]);

    // Load slots when date or service changes
    const loadSlots = useCallback(async (date: string, svcIdx: number) => {
        if (!widgetData) return;
        const duration = widgetData.services[svcIdx]?.duration ?? widgetData.slotDuration;
        setLoadingSlots(true);
        try {
            const r = await fetch(`${API_BASE}/public/booking/${tenantId}/slots?date=${date}&duration=${duration}`);
            const data = await r.json();
            setSlots(Array.isArray(data) ? data : []);
        } catch { setSlots([]); }
        setLoadingSlots(false);
    }, [widgetData, tenantId]);

    useEffect(() => {
        if (selectedDate && selectedService !== null) {
            setSelectedTime(null);
            loadSlots(selectedDate, selectedService);
        }
    }, [selectedDate, selectedService, loadSlots]);

    const handleBook = async () => {
        if (!selectedService === null || !selectedDate || !selectedTime) return;
        if (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) return;

        setSubmitting(true);
        const [h, m] = selectedTime!.split(':').map(Number);
        const [y, mo, d] = selectedDate!.split('-').map(Number);
        const scheduledAt = new Date(y, mo - 1, d, h, m, 0).toISOString();

        try {
            const r = await fetch(`${API_BASE}/public/booking/${tenantId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: form.name.trim(),
                    phone: form.phone.trim() || undefined,
                    email: form.email.trim() || undefined,
                    serviceIndex: selectedService,
                    scheduledAt,
                }),
            });
            if (!r.ok) throw new Error(await r.text());
            const data = await r.json();
            setResult(data);
            setStep('confirm');
        } catch (e: any) {
            alert('Booking failed. Please try again.');
        }
        setSubmitting(false);
    };

    const accent = widgetData?.accentColor ?? '#6366f1';

    if (error) {
        return (
            <div style={containerStyle}>
                <div style={cardStyle}>
                    <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                        <div style={{ fontSize: 28, marginBottom: 12, color: '#f87171' }}><FontAwesomeIcon icon={faCircleExclamation} /></div>
                        <p style={{ color: '#94a3b8', fontSize: 14 }}>{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!widgetData) {
        return (
            <div style={containerStyle}>
                <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
                    <div style={{ width: 36, height: 36, border: `3px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
            </div>
        );
    }

    return (
        <div style={containerStyle}>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                * { box-sizing: border-box; }
                body { margin: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
                input, textarea { outline: none; }
                input:focus, textarea:focus { border-color: ${accent} !important; }
                button:focus { outline: none; }
            `}</style>

            <div style={cardStyle}>
                {/* Header */}
                <div style={{ padding: '24px 28px 0', borderBottom: `3px solid ${accent}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: accent }} />
                        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#f8fafc', margin: 0 }}>{widgetData.businessName}</h1>
                    </div>
                    {widgetData.welcomeMessage && (
                        <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 16, marginTop: 0 }}>{widgetData.welcomeMessage}</p>
                    )}
                </div>

                {/* Body */}
                <div style={{ padding: '28px' }}>
                    {step !== 'confirm' && <StepDots step={step} accent={accent} />}

                    {/* ── Step 1: Service ── */}
                    {step === 'service' && (
                        <div>
                            <h2 style={stepTitleStyle}>Choose a Service</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {widgetData.services.map((s, i) => {
                                    const active = selectedService === i;
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => setSelectedService(i)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '16px 18px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
                                                border: `1.5px solid ${active ? accent : 'rgba(255,255,255,0.1)'}`,
                                                background: active ? `${accent}18` : 'rgba(255,255,255,0.04)',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 14, fontWeight: 700, color: '#f8fafc', marginBottom: 2 }}>{s.name}</div>
                                                <div style={{ fontSize: 12, color: '#94a3b8' }}>{s.duration} minutes</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                {s.price != null && s.price > 0 && (
                                                    <div style={{ fontSize: 16, fontWeight: 800, color: accent }}>${s.price}</div>
                                                )}
                                                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${active ? accent : 'rgba(255,255,255,0.2)'}`, background: active ? accent : 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginTop: s.price ? 4 : 0 }}>
                                                    {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setStep('datetime')}
                                disabled={selectedService === null}
                                style={{ ...primaryBtnStyle(accent), marginTop: 24, opacity: selectedService === null ? 0.4 : 1 }}
                            >Continue →</button>
                        </div>
                    )}

                    {/* ── Step 2: Date + time ── */}
                    {step === 'datetime' && (
                        <div>
                            <h2 style={stepTitleStyle}>Pick a Date & Time</h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                <MiniCalendar
                                    selected={selectedDate}
                                    onSelect={setSelectedDate}
                                    workingDays={widgetData.workingDays}
                                    accentColor={accent}
                                />

                                {selectedDate && (
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                        </div>
                                        {loadingSlots ? (
                                            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
                                                <div style={{ width: 28, height: 28, border: `2px solid ${accent}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                                            </div>
                                        ) : (
                                            <SlotGrid slots={slots} selected={selectedTime} onSelect={setSelectedTime} accentColor={accent} />
                                        )}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                                <button onClick={() => setStep('service')} style={ghostBtnStyle}>← Back</button>
                                <button
                                    onClick={() => setStep('contact')}
                                    disabled={!selectedDate || !selectedTime}
                                    style={{ ...primaryBtnStyle(accent), flex: 1, opacity: !selectedDate || !selectedTime ? 0.4 : 1 }}
                                >Continue →</button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Contact info ── */}
                    {step === 'contact' && (
                        <div>
                            <h2 style={stepTitleStyle}>Your Details</h2>

                            {/* Booking summary */}
                            <div style={{ padding: '12px 16px', borderRadius: 10, background: `${accent}12`, border: `1px solid ${accent}30`, marginBottom: 20, fontSize: 13 }}>
                                <div style={{ fontWeight: 700, color: '#f8fafc', marginBottom: 4 }}>
                                    {widgetData.services[selectedService!]?.name}
                                </div>
                                <div style={{ color: '#94a3b8' }}>
                                    {selectedDate && new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    {' at '}
                                    {selectedTime && (() => {
                                        const [h, m] = selectedTime.split(':').map(Number);
                                        const suffix = h >= 12 ? 'pm' : 'am';
                                        const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
                                        return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
                                    })()}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div>
                                    <label style={labelStyle}>Full Name *</label>
                                    <input
                                        value={form.name}
                                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                        placeholder="Jane Smith"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Phone Number</label>
                                    <input
                                        value={form.phone}
                                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                                        placeholder="+1 555 000 0000"
                                        type="tel"
                                        style={inputStyle}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Email Address</label>
                                    <input
                                        value={form.email}
                                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                                        placeholder="jane@example.com"
                                        type="email"
                                        style={inputStyle}
                                    />
                                </div>
                                <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>Phone or email required for reminder messages.</p>
                            </div>

                            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                                <button onClick={() => setStep('datetime')} style={ghostBtnStyle}>← Back</button>
                                <button
                                    onClick={handleBook}
                                    disabled={submitting || !form.name.trim() || (!form.phone.trim() && !form.email.trim())}
                                    style={{ ...primaryBtnStyle(accent), flex: 1, opacity: (!form.name.trim() || (!form.phone.trim() && !form.email.trim())) ? 0.4 : 1 }}
                                >
                                    {submitting ? 'Booking…' : 'Confirm Booking'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Confirmation ── */}
                    {step === 'confirm' && result && (
                        <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
                            <div style={{ width: 64, height: 64, borderRadius: '50%', background: `${accent}20`, border: `2px solid ${accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: accent, margin: '0 auto 20px' }}>
                                <FontAwesomeIcon icon={faCheck} />
                            </div>
                            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#f8fafc', marginBottom: 8 }}>You're booked!</h2>
                            <p style={{ fontSize: 14, color: '#94a3b8', marginBottom: 20 }}>
                                Your appointment has been confirmed. You'll receive a reminder message before your appointment.
                            </p>

                            <div style={{ padding: '16px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', marginBottom: 24, textAlign: 'left' }}>
                                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Service</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', marginBottom: 12 }}>{result.service}</div>
                                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 4 }}>Date & Time</div>
                                <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>
                                    {new Date(result.scheduledAt).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                    {' at '}
                                    {new Date(result.scheduledAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </div>
                            </div>

                            {result.remindersScheduled > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', fontSize: 13, color: '#4ade80' }}>
                                    <FontAwesomeIcon icon={faBell} />
                                    <span>{result.remindersScheduled} reminder{result.remindersScheduled > 1 ? 's' : ''} scheduled</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 28px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
                    <a href="https://meetora.co" target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, color: '#475569', textDecoration: 'none', fontWeight: 600 }}>
                        Powered by Meetora
                    </a>
                </div>
            </div>
        </div>
    );
}

// ── Shared styles ────────────────────────────

const containerStyle: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
    padding: '24px 16px', background: '#0f172a',
};

const cardStyle: React.CSSProperties = {
    width: '100%', maxWidth: 480, borderRadius: 16, overflow: 'hidden',
    background: '#1e293b', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
};

const stepTitleStyle: React.CSSProperties = {
    fontSize: 17, fontWeight: 800, color: '#f8fafc', marginBottom: 18, marginTop: 0,
};

const primaryBtnStyle = (accent: string): React.CSSProperties => ({
    width: '100%', padding: '13px', borderRadius: 10, border: 'none', background: accent,
    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'opacity 0.15s',
});

const ghostBtnStyle: React.CSSProperties = {
    padding: '13px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent', color: '#94a3b8', fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#94a3b8',
    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 14, color: '#f8fafc',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)',
    transition: 'border-color 0.15s',
};
