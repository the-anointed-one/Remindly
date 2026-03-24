'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import api from '@/lib/api';
import FeatureBanner from '@/components/FeatureBanner';
import Icon from '@/components/ui/Icon';
import { HelpTip } from '@/components/ui/Tooltip';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCalendar, faChevronUp, faChevronDown, faXmark, faCheck, faArrowRight } from '@fortawesome/free-solid-svg-icons';

interface Location {
    locationId: string;
    locationName: string;
}

interface CalendarConnection {
    id: string;
    provider: 'GOOGLE' | 'OUTLOOK';
    email: string;
    syncStatus: 'IDLE' | 'SYNCING' | 'ERROR';
    lastSyncAt: string | null;
    eventCount: number;
}

export default function SettingsPage() {
    const { user, plan, refreshProfile } = useAuth();
    const searchParams = useSearchParams();
    const isTier3 = plan === 'SMS_VOICE_AI';

    // Google OAuth callback params
    const googleConnected = searchParams.get('google_connected');
    const googleError = searchParams.get('google_error');
    const locationsParam = searchParams.get('locations');

    // Calendar OAuth callback params
    const calendarConnected = searchParams.get('calendar_connected'); // 'google' | 'outlook'
    const calendarConnectedEmail = searchParams.get('email');
    const calendarError = searchParams.get('calendar_error');

    const [locations, setLocations] = useState<Location[]>([]);
    const [selectedLocation, setSelectedLocation] = useState('');
    const [saving, setSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');
    const [connectionStatus, setConnectionStatus] = useState<{
        connected: boolean;
        connection?: { locationName?: string; connectedAt: string };
    } | null>(null);
    const [disconnecting, setDisconnecting] = useState(false);

    // Calendar connections state
    const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([]);
    const [calendarSyncing, setCalendarSyncing] = useState<string | null>(null);
    const [calendarDisconnecting, setCalendarDisconnecting] = useState<string | null>(null);

    // Failover settings
    const CHANNEL_OPTIONS = ['SMS', 'WHATSAPP', 'VOICE', 'EMAIL'] as const;
    type Channel = typeof CHANNEL_OPTIONS[number];
    const [failoverEnabled, setFailoverEnabled] = useState(true);
    const [failoverChain, setFailoverChain] = useState<Channel[]>(['SMS', 'WHATSAPP', 'VOICE']);
    const [failoverWindow, setFailoverWindow] = useState(60);
    const [failoverSaving, setFailoverSaving] = useState(false);
    const [failoverSaved, setFailoverSaved] = useState(false);

    // Profile settings
    const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '' });
    const [profileSaving, setProfileSaving] = useState(false);
    const [profileSaved, setProfileSaved] = useState(false);
    const [profileError, setProfileError] = useState('');

    // Parse locations from OAuth redirect
    useEffect(() => {
        if (locationsParam) {
            try {
                const parsed: Location[] = JSON.parse(decodeURIComponent(locationsParam));
                setLocations(parsed);
                if (parsed.length > 0) setSelectedLocation(parsed[0].locationId);
            } catch { /* ignore */ }
        }
    }, [locationsParam]);

    // Load existing connection if any
    useEffect(() => {
        if (!isTier3) return;
        api.get('/google-reviews/connection')
            .then(({ data }) => setConnectionStatus(data))
            .catch(() => setConnectionStatus({ connected: false }));
    }, [isTier3]);

    // Load calendar connections + failover settings
    useEffect(() => {
        api.get('/calendar/connections')
            .then(({ data }) => setCalendarConnections(data))
            .catch(() => setCalendarConnections([]));

        api.get('/tenants/settings')
            .then(({ data }) => {
                if (data.failoverEnabled !== undefined) setFailoverEnabled(!!data.failoverEnabled);
                if (Array.isArray(data.failoverChain)) setFailoverChain(data.failoverChain);
                if (data.failoverUnreadWindowMinutes) setFailoverWindow(Number(data.failoverUnreadWindowMinutes));
            })
            .catch(() => { /* use defaults */ });
    }, []);

    // Initialize profile form when user loads
    useEffect(() => {
        if (user) {
            setProfileForm({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
            });
        }
    }, [user]);

    const handleSaveLocation = async () => {
        if (!selectedLocation) return;
        setSaving(true);
        try {
            const loc = locations.find((l) => l.locationId === selectedLocation);
            await api.patch('/google-reviews/connection/location', {
                locationId: selectedLocation,
                locationName: loc?.locationName,
            });
            setSavedMsg(`Location set to "${loc?.locationName || selectedLocation}". Go to Reviews to start syncing.`);
            setConnectionStatus({
                connected: true,
                connection: { locationName: loc?.locationName, connectedAt: new Date().toISOString() },
            });
            setLocations([]); // hide the picker
        } catch {
            setSavedMsg('Failed to save location. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        if (!confirm('Disconnect your Google Business account? This will not delete your existing reviews.')) return;
        setDisconnecting(true);
        try {
            await api.delete('/google-reviews/connection');
            setConnectionStatus({ connected: false });
        } catch { /* ignore */ }
        setDisconnecting(false);
    };

    const handleGoogleConnect = async () => {
        try {
            const { data } = await api.get('/google-reviews/connect');
            window.location.href = data.url;
        } catch {
            alert('Failed to start Google authorization.');
        }
    };

    const handleCalendarConnect = async (provider: 'GOOGLE' | 'OUTLOOK') => {
        try {
            const { data } = await api.get(`/calendar/connect?provider=${provider}`);
            window.location.href = data.url;
        } catch {
            alert('Failed to start calendar authorization.');
        }
    };

    const handleCalendarSync = async (provider: 'GOOGLE' | 'OUTLOOK') => {
        setCalendarSyncing(provider);
        try {
            await api.post(`/calendar/sync/${provider}`);
            // Refresh list after triggering sync
            const { data } = await api.get('/calendar/connections');
            setCalendarConnections(data);
        } catch { /* ignore */ }
        setCalendarSyncing(null);
    };

    const handleCalendarDisconnect = async (provider: 'GOOGLE' | 'OUTLOOK') => {
        if (!confirm(`Disconnect ${provider === 'GOOGLE' ? 'Google' : 'Outlook'} Calendar?`)) return;
        setCalendarDisconnecting(provider);
        try {
            await api.delete(`/calendar/connections/${provider}`);
            setCalendarConnections((prev) => prev.filter((c) => c.provider !== provider));
        } catch { /* ignore */ }
        setCalendarDisconnecting(null);
    };

    const moveChannel = (index: number, direction: -1 | 1) => {
        const next = [...failoverChain];
        const swap = index + direction;
        if (swap < 0 || swap >= next.length) return;
        [next[index], next[swap]] = [next[swap], next[index]];
        setFailoverChain(next);
    };

    const toggleChannelInChain = (ch: Channel) => {
        setFailoverChain((prev) =>
            prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
        );
    };

    const handleSaveFailover = async () => {
        setFailoverSaving(true);
        try {
            await api.patch('/tenants/settings', {
                failoverEnabled,
                failoverChain,
                failoverUnreadWindowMinutes: failoverWindow,
            });
            setFailoverSaved(true);
            setTimeout(() => setFailoverSaved(false), 3000);
        } catch { /* ignore */ }
        setFailoverSaving(false);
    };

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setProfileSaving(true);
        setProfileError('');
        setProfileSaved(false);
        try {
            await api.patch('/users/me', profileForm);
            await refreshProfile();
            setProfileSaved(true);
            setTimeout(() => setProfileSaved(false), 3000);
        } catch (err: any) {
            setProfileError(err.response?.data?.message || 'Failed to update profile');
        } finally {
            setProfileSaving(false);
        }
    };

    return (
        <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Settings</h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>Manage your account and workspace preferences</p>

            {/* Account Info */}
            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Account Profile</h2>
                
                {profileError && (
                    <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)', color: 'var(--error)', fontSize: 13 }}>
                        {profileError}
                    </div>
                )}
                
                <form onSubmit={handleSaveProfile} style={{ display: 'grid', gap: 16 }}>
                    <div>
                        <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email (Read Only)</label>
                        <div style={{ marginTop: 4, padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 15, cursor: 'not-allowed' }}>
                            {user?.email || '—'}
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>First Name</label>
                            <input
                                value={profileForm.firstName}
                                onChange={e => setProfileForm(p => ({ ...p, firstName: e.target.value }))}
                                placeholder="e.g. Jane"
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 15, outline: 'none' }}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Last Name</label>
                            <input
                                value={profileForm.lastName}
                                onChange={e => setProfileForm(p => ({ ...p, lastName: e.target.value }))}
                                placeholder="e.g. Doe"
                                style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontSize: 15, outline: 'none' }}
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 mt-2">
                        <button type="submit" disabled={profileSaving} className="btn btn-primary w-full sm:w-auto">
                            {profileSaving ? 'Saving...' : 'Save Profile'}
                        </button>
                        {profileSaved && <span style={{ fontSize: 13, color: 'var(--success)' }}><Icon icon={faCheck} /> Saved!</span>}
                    </div>
                </form>
            </div>

            {/* Security */}
            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Security</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>Change your login password</p>
                <a href="/forgot-password" className="btn btn-outline" style={{ fontSize: 14, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                    Reset Password <FontAwesomeIcon icon={faArrowRight} />
                </a>
            </div>

            {/* Google Business Integration */}
            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Google Business Integration</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                            Connect your Google Business Profile to enable AI Review Responder
                        </p>
                    </div>
                    <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                        color: 'var(--accent-cta)', background: 'rgba(247, 148, 29, 0.15)',
                        border: '1px solid rgba(247, 148, 29, 0.3)', borderRadius: 4, padding: '3px 8px',
                    }}>
                        TIER 3 ONLY
                    </span>
                </div>

                {!isTier3 ? (
                    <div style={{
                        padding: '16px', borderRadius: 'var(--radius-lg)', background: 'rgba(247, 148, 29, 0.06)',
                        border: '1px solid rgba(247, 148, 29, 0.2)', fontSize: 14, color: 'var(--text-muted)',
                    }}>
                        Upgrade to the SMS + Voice + AI plan to use Google Business Review Responder.{' '}
                        <a href="/dashboard/billing" style={{ color: 'var(--accent-cta)' }}>Upgrade</a>
                    </div>
                ) : (
                    <>
                        {/* Error from OAuth redirect */}
                        {googleError && (
                            <div style={{
                                marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                                background: 'rgba(224, 82, 82, 0.1)', border: '1px solid rgba(224, 82, 82, 0.25)',
                                color: 'var(--error)', fontSize: 14,
                            }}>
                                Google authorization failed: {decodeURIComponent(googleError)}
                            </div>
                        )}

                        {/* Success + location picker after OAuth */}
                        {googleConnected && locations.length > 0 && (
                            <div style={{
                                marginBottom: 16, padding: '16px 20px', borderRadius: 'var(--radius-lg)',
                                background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
                            }}>
                                <p style={{ fontSize: 14, color: 'var(--success)', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Icon icon={faCheck} /> Google account connected! Select which location to track:
                                </p>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                    <select
                                        value={selectedLocation}
                                        onChange={(e) => setSelectedLocation(e.target.value)}
                                        style={{
                                            flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 8,
                                            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                            color: 'var(--text-primary)', fontSize: 16,
                                        }}
                                    >
                                        {locations.map((loc) => (
                                            <option key={loc.locationId} value={loc.locationId}>
                                                {loc.locationName}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleSaveLocation}
                                        disabled={saving}
                                        className="btn btn-primary"
                                    >
                                        {saving ? 'Saving...' : 'Save Location'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {savedMsg && (
                            <div style={{
                                marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                                background: 'rgba(46, 204, 143, 0.08)', border: '1px solid rgba(46, 204, 143, 0.2)',
                                color: 'var(--success)', fontSize: 14,
                            }}>
                                {savedMsg}
                            </div>
                        )}

                        {/* Connected state */}
                        {connectionStatus?.connected ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <span style={{
                                            width: 9, height: 9, borderRadius: '50%',
                                            background: 'var(--success)', display: 'inline-block',
                                        }} />
                                        <span style={{ fontWeight: 700, fontSize: 15 }}>
                                            {connectionStatus.connection?.locationName || 'Connected'}
                                        </span>
                                    </div>
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                        Connected {connectionStatus.connection?.connectedAt
                                            ? new Date(connectionStatus.connection.connectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                            : ''}
                                        {' · '}
                                        <a href="/dashboard/reviews" style={{ color: 'var(--accent-primary)' }}>View Reviews</a>
                                    </p>
                                </div>
                                <button
                                    onClick={handleDisconnect}
                                    disabled={disconnecting}
                                    style={{
                                        padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                                        background: 'none', border: '1px solid rgba(224, 82, 82, 0.35)',
                                        color: 'var(--error)', fontSize: 13, fontWeight: 600,
                                    }}
                                >
                                    {disconnecting ? 'Disconnecting...' : 'Disconnect'}
                                </button>
                            </div>
                        ) : !googleConnected && (
                            <button
                                onClick={handleGoogleConnect}
                                className="btn btn-outline"
                                style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}
                            >
                                <span style={{ fontSize: 18 }}>G</span>
                                Connect Google Business Account
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* Calendar Integrations */}
            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', marginBottom: 20 }}>
                <FeatureBanner
                    src="/images/features/calendar-integration.jpg"
                    title="Calendar Integrations"
                    description="Connect Google or Outlook Calendar. New events automatically create appointments and trigger your reminder rules — no manual entry required."
                    accent="var(--primary)"
                />
                <div style={{ marginBottom: 20 }}>
                    <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Calendar Integrations</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                        Sync your Google or Outlook calendar — new events automatically create appointments and schedule reminders.
                    </p>
                </div>

                {/* OAuth success/error banners */}
                {calendarError && (
                    <div style={{
                        marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                        color: '#f87171', fontSize: 14,
                    }}>
                        Calendar connection failed: {decodeURIComponent(calendarError)}
                    </div>
                )}
                {calendarConnected && calendarConnectedEmail && (
                    <div style={{
                        marginBottom: 16, padding: '12px 16px', borderRadius: 'var(--radius-lg)',
                        background: 'rgba(46, 204, 143, 0.08)', border: '1px solid rgba(46, 204, 143, 0.2)',
                        color: 'var(--success)', fontSize: 14,
                    }}>
                        {calendarConnected === 'google' ? 'Google' : 'Outlook'} Calendar connected as{' '}
                        <strong>{decodeURIComponent(calendarConnectedEmail)}</strong>. Syncing events now.
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: 16 }}>
                    {(['GOOGLE', 'OUTLOOK'] as const).map((provider) => {
                        const conn = calendarConnections.find((c) => c.provider === provider);
                        const label = provider === 'GOOGLE' ? 'Google Calendar' : 'Outlook Calendar';
                        const icon = <Icon icon={faCalendar} />;
                        const accentColor = provider === 'GOOGLE' ? '#3b82f6' : '#06b6d4';

                        return (
                            <div key={provider} style={{
                                padding: '20px', borderRadius: 'var(--radius-xl)',
                                border: `1px solid ${conn ? accentColor + '40' : 'var(--border)'}`,
                                background: conn ? `${accentColor}08` : 'var(--bg-secondary)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                    <span style={{ fontSize: 22 }}>{icon}</span>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: 14 }}>{label}</div>
                                        {conn && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{conn.email}</div>
                                        )}
                                    </div>
                                    {conn && (
                                        <span style={{
                                            marginLeft: 'auto', fontSize: 10, fontWeight: 700,
                                            color: conn.syncStatus === 'ERROR' ? 'var(--error)' : conn.syncStatus === 'SYNCING' ? 'var(--warning)' : 'var(--success)',
                                            background: conn.syncStatus === 'ERROR' ? 'rgba(224, 82, 82, 0.1)' : conn.syncStatus === 'SYNCING' ? 'rgba(247, 148, 29, 0.1)' : 'rgba(46, 204, 143, 0.1)',
                                            border: `1px solid ${conn.syncStatus === 'ERROR' ? 'rgba(224, 82, 82, 0.25)' : conn.syncStatus === 'SYNCING' ? 'rgba(247, 148, 29, 0.25)' : 'rgba(46, 204, 143, 0.25)'}`,
                                            borderRadius: 4, padding: '2px 7px',
                                        }}>
                                            {conn.syncStatus}
                                        </span>
                                    )}
                                </div>

                                {conn ? (
                                    <>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 }}>
                                            {conn.eventCount} events synced
                                            {conn.lastSyncAt && (
                                                <> · Last sync {new Date(conn.lastSyncAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <button
                                                onClick={() => handleCalendarSync(provider)}
                                                disabled={calendarSyncing === provider}
                                                style={{
                                                    flex: 1, padding: '7px 12px', borderRadius: 8,
                                                    background: accentColor + '18', border: `1px solid ${accentColor}40`,
                                                    color: accentColor, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                                }}
                                            >
                                                {calendarSyncing === provider ? 'Syncing...' : 'Sync Now'}
                                            </button>
                                            <button
                                                onClick={() => handleCalendarDisconnect(provider)}
                                                disabled={calendarDisconnecting === provider}
                                                style={{
                                                    padding: '7px 12px', borderRadius: 8,
                                                    background: 'none', border: '1px solid rgba(224, 82, 82, 0.35)',
                                                    color: 'var(--error)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                                }}
                                            >
                                                {calendarDisconnecting === provider ? '...' : 'Disconnect'}
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <button
                                        onClick={() => handleCalendarConnect(provider)}
                                        style={{
                                            width: '100%', padding: '8px 14px', borderRadius: 8,
                                            background: 'none', border: `1px solid ${accentColor}50`,
                                            color: accentColor, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                                        }}
                                    >
                                        Connect {label}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Messaging Failover */}
            <div className="glass-card" style={{ padding: '28px clamp(16px, 4vw, 32px)', marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                    <div>
                        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                            Messaging Failover
                            <HelpTip
                                text="If a message fails to deliver on one channel (e.g. SMS), the system automatically retries on the next channel in your priority list. This ensures your customer always receives the reminder."
                                placement="top"
                                maxWidth={280}
                            />
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                            Automatically retry via the next channel if a message fails to deliver.
                            Default chain: SMS → WhatsApp → Voice.
                        </p>
                    </div>
                    {/* Enable toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', userSelect: 'none' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: failoverEnabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                            {failoverEnabled ? 'Enabled' : 'Disabled'}
                        </span>
                        <div
                            onClick={() => setFailoverEnabled(!failoverEnabled)}
                            style={{
                                width: 44, height: 24, borderRadius: 'var(--radius-xl)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s',
                                background: failoverEnabled ? 'var(--primary)' : 'var(--border)',
                            }}
                        >
                            <div style={{
                                position: 'absolute', top: 3, left: failoverEnabled ? 23 : 3,
                                width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
                            }} />
                        </div>
                    </label>
                </div>

                <div style={{ opacity: failoverEnabled ? 1 : 0.4, pointerEvents: failoverEnabled ? 'auto' : 'none', transition: 'opacity 0.2s' }}>
                    {/* Channel priority order */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>
                            Fallback Channel Order
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {failoverChain.map((ch, i) => {
                                const colors: Record<string, string> = { SMS: '#3b82f6', WHATSAPP: '#22c55e', VOICE: '#f59e0b', EMAIL: '#8b5cf6' };
                                const color = colors[ch] ?? '#64748b';
                                return (
                                    <div key={ch} style={{
                                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                                        borderRadius: 'var(--radius-lg)', background: 'var(--bg-secondary)',
                                        border: `1px solid ${color}30`,
                                    }}>
                                        <span style={{
                                            width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', fontSize: 11, fontWeight: 800,
                                            background: `${color}20`, color,
                                        }}>{i + 1}</span>
                                        <span style={{
                                            flex: 1, fontSize: 13, fontWeight: 700,
                                            color: 'var(--text-primary)',
                                        }}>{ch}</span>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={() => moveChannel(i, -1)}
                                                disabled={i === 0}
                                                style={{
                                                    width: 36, height: 36, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                                    background: 'none', cursor: i === 0 ? 'not-allowed' : 'pointer',
                                                    color: i === 0 ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 12,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}
                                            ><Icon icon={faChevronUp} /></button>
                                            <button
                                                onClick={() => moveChannel(i, 1)}
                                                disabled={i === failoverChain.length - 1}
                                                style={{
                                                    width: 28, height: 28, borderRadius: 'var(--radius-md)', border: '1px solid var(--border)',
                                                    background: 'none', cursor: i === failoverChain.length - 1 ? 'not-allowed' : 'pointer',
                                                    color: i === failoverChain.length - 1 ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 11,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}
                                            ><Icon icon={faChevronDown} /></button>
                                            <button
                                                onClick={() => toggleChannelInChain(ch)}
                                                style={{
                                                    width: 36, height: 36, borderRadius: 'var(--radius-md)', border: '1px solid rgba(224, 82, 82, 0.3)',
                                                    background: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: 12,
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}
                                            ><Icon icon={faXmark} /></button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Add channel */}
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {CHANNEL_OPTIONS.filter((ch) => !failoverChain.includes(ch)).map((ch) => {
                                const colors: Record<string, string> = { SMS: '#3b82f6', WHATSAPP: '#22c55e', VOICE: '#f59e0b', EMAIL: '#8b5cf6' };
                                return (
                                    <button
                                        key={ch}
                                        onClick={() => toggleChannelInChain(ch)}
                                        style={{
                                            padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                            border: `1px dashed ${colors[ch] ?? '#64748b'}50`,
                                            background: 'none', color: colors[ch] ?? '#64748b', cursor: 'pointer',
                                        }}
                                    >
                                        + {ch}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Window minutes */}
                    <div style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            Unread Window (minutes)
                            <HelpTip
                                text="How long to wait after sending a message before assuming it was not read and triggering the next channel in the failover chain."
                                placement="top"
                                maxWidth={260}
                            />
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                            <input
                                type="number"
                                min={5}
                                max={1440}
                                value={failoverWindow}
                                onChange={(e) => setFailoverWindow(Number(e.target.value))}
                                style={{
                                    width: 100, flex: '0 0 100px', padding: '8px 12px', borderRadius: 8, fontSize: 16,
                                    minHeight: 44, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                            <span style={{ fontSize: 13, color: 'var(--text-muted)', flex: '1 1 180px' }}>
                                Trigger fallback if unread after this many minutes
                            </span>
                        </div>
                    </div>

                    {/* Save */}
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleSaveFailover}
                            disabled={failoverSaving}
                            className="btn btn-primary w-full sm:w-auto"
                        >
                            {failoverSaving ? 'Saving...' : 'Save Failover Settings'}
                        </button>
                        {failoverSaved && (
                            <span style={{ fontSize: 13, color: 'var(--success)' }}>Saved!</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
