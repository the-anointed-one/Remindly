import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import ContactSearchDropdown, { ContactSlim } from './ContactSearchDropdown';
import SearchableSelect from '../ui/SearchableSelect';
import { faTag, faUsers, faCalendar, faBullhorn, faReply } from '@fortawesome/free-solid-svg-icons';

export interface AudienceSelection {
    audienceType: 'contact' | 'contacts' | 'tag' | 'group' | 'appointment_participants' | 'campaign' | 'campaign_response';
    audienceId?: string;
    audienceIds?: string[];
    responseStatus?: 'confirmed' | 'cancelled' | 'pending';
    // For UI display of the selected audience
    displayData?: ContactSlim | ContactSlim[] | any;
}

interface Props {
    value: AudienceSelection;
    onChange: (val: AudienceSelection) => void;
}

export default function AudienceSelector({ value, onChange }: Props) {
    const [tags, setTags] = useState<string[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [appointments, setAppointments] = useState<any[]>([]);
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            api.get('/contacts/tags').then(res => setTags(res.data)).catch(() => []),
            api.get('/contacts/groups').then(res => setGroups(res.data)).catch(() => []),
            api.get('/appointments').then(res => setAppointments(Array.isArray(res.data) ? res.data : res.data?.data ?? [])).catch(() => []),
            api.get('/campaigns').then(res => setCampaigns(Array.isArray(res.data) ? res.data : [])).catch(() => []),
        ]).finally(() => setLoading(false));
    }, []);

    const tagOptions = useMemo(() => tags.map(t => ({ id: t, name: t, icon: faTag })), [tags]);
    const groupOptions = useMemo(() => groups.map(g => ({
        id: g.id,
        name: g.name,
        subtext: `${g._count?.members || 0} members`,
        icon: faUsers
    })), [groups]);
    const appointmentOptions = useMemo(() => appointments.map(a => ({
        id: a.id,
        name: a.title,
        subtext: new Date(a.scheduledAt).toLocaleDateString(),
        icon: faCalendar,
    })), [appointments]);
    const campaignOptions = useMemo(() => campaigns.flatMap((c: any) =>
        (c.segments ?? []).map((s: any) => ({
            id: s.id,
            name: s.name,
            subtext: `Campaign: ${c.name}`,
            icon: faBullhorn,
        }))
    ), [campaigns]);

    // Campaign-level options (for "By Response" tab — target the whole campaign, not a segment)
    const campaignTopOptions = useMemo(() => campaigns.map((c: any) => ({
        id: c.id,
        name: c.name,
        subtext: `${c.segments?.length ?? 0} segments`,
        icon: faReply,
    })), [campaigns]);

    const tabs: Array<{ id: AudienceSelection['audienceType'], label: string }> = [
        { id: 'contact', label: 'Single Contact' },
        { id: 'contacts', label: 'Multiple Contacts' },
        { id: 'tag', label: 'By Tag' },
        { id: 'group', label: 'By Group' },
        { id: 'appointment_participants', label: 'Appointment' },
        { id: 'campaign', label: 'Segment' },
        { id: 'campaign_response', label: 'By Response' },
    ];

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Type Tabs */}
            <div style={{ display: 'flex', gap: 6, background: '#0d0d10', padding: 4, borderRadius: 10, width: 'fit-content' }}>
                {tabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        onClick={() => onChange({ audienceType: t.id })}
                        style={{
                            background: value.audienceType === t.id ? '#1e1e28' : 'transparent',
                            border: value.audienceType === t.id ? '1px solid #2a2a35' : '1px solid transparent',
                            padding: '6px 16px', borderRadius: 8, fontSize: 14, fontWeight: value.audienceType === t.id ? 600 : 400,
                            color: value.audienceType === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                            transition: 'all 0.2s', cursor: 'pointer'
                        }}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Selection Input based on tab */}
            <div style={{ minHeight: 60 }}>
                {value.audienceType === 'contact' && (
                    <div className="input-group">
                        <label className="input-label">Select Contact</label>
                        <ContactSearchDropdown
                            value={value.displayData as ContactSlim}
                            onChange={(contact) => onChange({ audienceType: 'contact', audienceId: contact?.id, displayData: contact })}
                            placeholder="Type a name, email, or phone number..."
                        />
                    </div>
                )}

                {value.audienceType === 'contacts' && (
                    <div className="input-group">
                        <label className="input-label">Select Multiple Contacts</label>
                        <ContactSearchDropdown
                            multi
                            value={value.displayData as ContactSlim[]}
                            onChange={(contacts: ContactSlim[]) => onChange({ audienceType: 'contacts', audienceIds: contacts.map(c => c.id), displayData: contacts })}
                            placeholder="Search and add contacts..."
                        />
                    </div>
                )}

                {value.audienceType === 'tag' && (
                    <div className="input-group">
                        <label className="input-label">Select Tag</label>
                        <SearchableSelect
                            options={tagOptions}
                            value={value.audienceId}
                            onChange={(id) => onChange({ audienceType: 'tag', audienceId: id, displayData: id })}
                            placeholder="Search or select a tag..."
                            loading={loading}
                        />
                    </div>
                )}

                {value.audienceType === 'group' && (
                    <div className="input-group">
                        <label className="input-label">Select Group</label>
                        <SearchableSelect
                            options={groupOptions}
                            value={value.audienceId}
                            onChange={(id) => {
                                const grp = groups.find(g => g.id === id);
                                onChange({ audienceType: 'group', audienceId: id, displayData: grp });
                            }}
                            placeholder="Search or select a group..."
                            loading={loading}
                        />
                    </div>
                )}

                {value.audienceType === 'appointment_participants' && (
                    <div className="input-group">
                        <label className="input-label">Select Appointment</label>
                        <SearchableSelect
                            options={appointmentOptions}
                            value={value.audienceId}
                            onChange={(id) => onChange({ audienceType: 'appointment_participants', audienceId: id, displayData: id })}
                            placeholder="Search or select an appointment..."
                            loading={loading}
                        />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>All participants of this appointment will receive the message.</p>
                    </div>
                )}

                {value.audienceType === 'campaign' && (
                    <div className="input-group">
                        <label className="input-label">Select Campaign Segment</label>
                        <SearchableSelect
                            options={campaignOptions}
                            value={value.audienceId}
                            onChange={(id) => onChange({ audienceType: 'campaign', audienceId: id, displayData: id })}
                            placeholder="Search or select a segment..."
                            loading={loading}
                        />
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>All contacts in this audience segment will receive the message.</p>
                    </div>
                )}

                {value.audienceType === 'campaign_response' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div className="input-group">
                            <label className="input-label">Source Campaign</label>
                            <SearchableSelect
                                options={campaignTopOptions}
                                value={value.audienceId}
                                onChange={(id) => onChange({ ...value, audienceType: 'campaign_response', audienceId: id })}
                                placeholder="Select the campaign to follow up on..."
                                loading={loading}
                            />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Response Status to Target</label>
                            <div style={{ display: 'flex', gap: 8 }}>
                                {([
                                    { value: 'confirmed', label: 'Confirmed', color: '#22c55e' },
                                    { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
                                    { value: 'pending',   label: 'Pending',   color: '#f59e0b' },
                                ] as const).map(opt => (
                                    <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => onChange({ ...value, audienceType: 'campaign_response', responseStatus: opt.value })}
                                        style={{
                                            flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                            background: value.responseStatus === opt.value ? `${opt.color}18` : 'var(--bg-secondary)',
                                            border: `1px solid ${value.responseStatus === opt.value ? opt.color + '60' : 'var(--border)'}`,
                                            color: value.responseStatus === opt.value ? opt.color : 'var(--text-muted)',
                                            transition: 'all 0.15s',
                                        }}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => onChange({ ...value, audienceType: 'campaign_response', responseStatus: undefined })}
                                    style={{
                                        flex: 1, padding: '8px 6px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                        background: !value.responseStatus ? 'rgba(255,255,255,0.08)' : 'var(--bg-secondary)',
                                        border: `1px solid ${!value.responseStatus ? 'rgba(255,255,255,0.25)' : 'var(--border)'}`,
                                        color: !value.responseStatus ? 'var(--text-primary)' : 'var(--text-muted)',
                                        transition: 'all 0.15s',
                                    }}
                                >
                                    All
                                </button>
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                {value.responseStatus
                                    ? `Only contacts who replied with status "${value.responseStatus}" will receive this message.`
                                    : 'All contacts who responded (any status) will receive this message.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
