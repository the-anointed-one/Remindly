'use client';

import { useState, useEffect, useRef } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { useAuth } from '@/lib/auth';
import { TIMEZONES } from '@/lib/timezones';

// ─────────────────────────────────────────────────────────────────────────────
// Themed date/time picker — drop-in replacement for <input type="datetime-local">
// and <input type="time">.
//
//   • mode="datetime": value/onChange is a UTC ISO-8601 instant
//     ("2026-07-03T01:00:00.000Z"). The picked wall-clock is interpreted in the
//     business timezone (the `timezone` prop, defaulting to the tenant's stored
//     zone) and converted to that UTC instant here — NOT via the browser's
//     implicit local offset. A timezone dropdown in the Time tab lets the user
//     schedule against a different zone (e.g. a specific location).
//   • mode="time": value/onChange is "HH:mm" wall-clock. Timezone-irrelevant
//     (a bare time has no date to anchor an offset), so tz logic is skipped.
//
// The popover has two tabs — Date and Time. onChange only fires when a tab's
// ✓ Save button is clicked, so mid-drag movement doesn't commit a partial value.
// ─────────────────────────────────────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

// Parse an incoming value into a Date whose *local* getters read the wall-clock
// in `tz` (so the popover drafts and display show the business-zone time).
function parseValue(value: string, isTime: boolean, tz: string): Date | null {
    if (!value) return null;
    if (isTime) {
        const [h, m] = value.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) return null;
        const d = new Date();
        d.setHours(h, m, 0, 0);
        return d;
    }
    const utc = new Date(value);
    if (isNaN(utc.getTime())) return null;
    return toZonedTime(utc, tz);
}

// datetime → UTC ISO instant; time → "HH:mm" wall-clock.
function toValueString(d: Date, isTime: boolean): string {
    if (isTime) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return d.toISOString();
}

function toDisplayString(value: string, isTime: boolean, tz: string): string {
    const d = parseValue(value, isTime, tz);
    if (!d) return '';
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (isTime) return time;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${time}`;
}

// 24h → { h12 (1-12), ampm }
function to12h(h24: number): { h12: number; ampm: 'AM' | 'PM' } {
    const ampm = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return { h12, ampm };
}
// { h12, ampm } → 24h
function to24h(h12: number, ampm: 'AM' | 'PM'): number {
    if (ampm === 'AM') return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
}

interface DateTimePickerProps {
    value: string | null | undefined;
    onChange: (value: string) => void;
    mode?: 'datetime' | 'time';
    required?: boolean;
    disabled?: boolean;
    placeholder?: string;
    className?: string;
    style?: React.CSSProperties;
    id?: string;
    timeIntervals?: number;
    // Business timezone the wall-clock is interpreted in (datetime mode).
    // Defaults to the tenant's stored zone from auth context. Ignored for
    // mode="time".
    timezone?: string;
}

export default function DateTimePicker({
    value,
    onChange,
    mode = 'datetime',
    required = false,
    disabled = false,
    placeholder,
    className = 'input',
    style,
    id,
    timezone,
    // timeIntervals is kept in the contract for call-site compatibility but the
    // slider-based Time tab no longer uses a fixed interval list.
}: DateTimePickerProps) {
    const isTime = mode === 'time';
    const { tenantTimezone } = useAuth();
    // Effective default zone: explicit prop → tenant setting → UTC.
    const propTz = timezone || tenantTimezone || 'UTC';
    const v = value ?? '';
    const wrapperRef = useRef<HTMLDivElement>(null);

    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<'date' | 'time'>(isTime ? 'time' : 'date');

    // Draft state — edited inside the popover, only committed on Save.
    const [draftDate, setDraftDate] = useState<Date | null>(null); // date part (calendar)
    const [h12, setH12] = useState(9);
    const [minute, setMinute] = useState(0);
    const [ampm, setAmpm] = useState<'AM' | 'PM'>('AM');
    // The zone the picked wall-clock is committed against. Seeded from propTz,
    // user-overridable via the Time-tab dropdown.
    const [tz, setTz] = useState(propTz);

    // Keep the effective zone in sync when the caller changes it (e.g. the
    // appointments form switching to a selected location's timezone).
    useEffect(() => {
        setTz(propTz);
    }, [propTz]);

    // Seed the draft from the incoming value whenever the popover opens (so it
    // always reflects the committed value, and external changes are picked up).
    useEffect(() => {
        if (!open) return;
        const d = parseValue(v, isTime, tz);
        if (d) {
            setDraftDate(isTime ? null : d);
            const { h12: hh, ampm: ap } = to12h(d.getHours());
            setH12(hh);
            setMinute(d.getMinutes());
            setAmpm(ap);
        } else {
            setDraftDate(null);
            setH12(9);
            setMinute(0);
            setAmpm('AM');
        }
        setTab(isTime ? 'time' : 'date');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    // Close on outside click.
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Build the committed Date from the current draft (date + time parts).
    // For datetime, the draft's wall-clock fields are interpreted in `tz` and
    // converted to a real UTC instant. For time, no conversion is applied.
    const buildDate = (): Date => {
        const base = draftDate
            ? new Date(draftDate)
            : isTime
                ? new Date()
                : toZonedTime(new Date(), tz);
        base.setHours(to24h(h12, ampm), minute, 0, 0);
        if (isTime) return base;
        return fromZonedTime(base, tz);
    };

    const commit = (closeAfter: boolean, goToTime = false) => {
        onChange(toValueString(buildDate(), isTime));
        if (goToTime) setTab('time');
        if (closeAfter) setOpen(false);
    };

    const display = toDisplayString(v, isTime, tz);
    const timeReadout = `${pad(h12)}:${pad(minute)}`;

    const tabBtn = (key: 'date' | 'time', label: string): React.CSSProperties => ({
        flex: 1, padding: '8px 0', textAlign: 'center', cursor: 'pointer',
        fontSize: 13, fontWeight: 600,
        color: tab === key ? 'var(--primary)' : 'var(--text-muted)',
        borderBottom: `2px solid ${tab === key ? 'var(--primary)' : 'transparent'}`,
        background: 'none', border: 'none',
        appearance: 'none', WebkitAppearance: 'none',
    });

    const saveBtn: React.CSSProperties = {
        width: '100%', marginTop: 12, padding: '9px 0', borderRadius: 8,
        background: 'var(--primary)', color: '#fff', border: 'none',
        fontSize: 14, fontWeight: 600, cursor: 'pointer',
        appearance: 'none', WebkitAppearance: 'none',
    };

    return (
        <div className="dtp-wrapper" ref={wrapperRef} style={{ position: 'relative' }}>
            <input
                id={id}
                className={className}
                style={style}
                value={display}
                placeholder={placeholder ?? (isTime ? 'HH:mm' : 'dd/mm/yyyy --:--')}
                required={required}
                disabled={disabled}
                readOnly
                onClick={() => !disabled && setOpen((o) => !o)}
                autoComplete="off"
            />

            {open && (
                <div
                    className="dtp-panel"
                    style={{
                        position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 9999,
                        background: 'var(--bg-elevated, var(--bg-secondary))',
                        border: '1px solid var(--border)', borderRadius: 12,
                        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                        width: 300, padding: 12,
                    }}
                >
                    {/* Tabs (only for datetime mode) */}
                    {!isTime && (
                        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 12 }}>
                            <button type="button" style={tabBtn('date', 'Date')} onClick={() => setTab('date')}>Date</button>
                            <button type="button" style={tabBtn('time', 'Time')} onClick={() => setTab('time')}>Time</button>
                        </div>
                    )}

                    {/* ── DATE TAB ── */}
                    {!isTime && tab === 'date' && (
                        <div className="dtp-calendar-wrap">
                            <DatePicker
                                selected={draftDate}
                                onChange={(d: Date | null) => setDraftDate(d)}
                                inline
                                calendarClassName="dtp-calendar"
                            />
                            <button type="button" style={saveBtn} onClick={() => commit(false, true)}>
                                ✓ Save
                            </button>
                        </div>
                    )}

                    {/* ── TIME TAB ── */}
                    {(isTime || tab === 'time') && (
                        <div>
                            {/* Digital readout */}
                            <div style={{ textAlign: 'center', marginBottom: 14 }}>
                                <span style={{ fontSize: 40, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                                    {timeReadout}
                                </span>
                                <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)', marginLeft: 8 }}>{ampm}</span>
                            </div>

                            {/* Hours slider */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    <span>Hours</span><span>{pad(h12)}</span>
                                </div>
                                <input type="range" min={1} max={12} step={1} value={h12}
                                    onChange={(e) => setH12(Number(e.target.value))}
                                    className="dtp-slider" style={{ width: '100%' }} />
                            </div>

                            {/* Minutes slider */}
                            <div style={{ marginBottom: 12 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                                    <span>Minutes</span><span>{pad(minute)}</span>
                                </div>
                                <input type="range" min={0} max={59} step={1} value={minute}
                                    onChange={(e) => setMinute(Number(e.target.value))}
                                    className="dtp-slider" style={{ width: '100%' }} />
                            </div>

                            {/* AM/PM toggle */}
                            <div style={{ display: 'flex', gap: 8, marginBottom: isTime ? 4 : 12 }}>
                                {(['AM', 'PM'] as const).map((p) => (
                                    <button
                                        key={p}
                                        type="button"
                                        onClick={() => setAmpm(p)}
                                        style={{
                                            flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                                            fontSize: 13, fontWeight: 600,
                                            border: `1px solid ${ampm === p ? 'var(--primary)' : 'var(--border)'}`,
                                            background: ampm === p ? 'var(--primary)' : 'transparent',
                                            color: ampm === p ? '#fff' : 'var(--text-secondary)',
                                            appearance: 'none', WebkitAppearance: 'none',
                                        }}
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>

                            {/* Timezone selector — datetime mode only (a bare time has
                                no zone). Defaults to the resolved business zone. */}
                            {!isTime && (
                                <div style={{ marginBottom: 4 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Timezone</div>
                                    <select
                                        className="input"
                                        value={tz}
                                        onChange={(e) => setTz(e.target.value)}
                                        style={{ width: '100%', fontSize: 13 }}
                                    >
                                        {/* Ensure the current zone is selectable even if not in the common list */}
                                        {!TIMEZONES.includes(tz as (typeof TIMEZONES)[number]) && (
                                            <option value={tz}>{tz}</option>
                                        )}
                                        {TIMEZONES.map((z) => (
                                            <option key={z} value={z}>{z}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <button type="button" style={saveBtn} onClick={() => commit(true)}>
                                ✓ Save
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
