'use client';

import { useState } from 'react';
import api from '@/lib/api';
import { useToast } from '@/components/Toast';
import Icon from '@/components/ui/Icon';
import { Tooltip } from '@/components/ui/Tooltip';
import { faBolt, faBullhorn, faComment, faPhone } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

import ChannelSelector, { Channel } from '@/components/messaging/ChannelSelector';
import AudienceSelector, { AudienceSelection } from '@/components/messaging/AudienceSelector';
import MessageEditor from '@/components/messaging/MessageEditor';
import MessagePreview from '@/components/messaging/MessagePreview';

export default function MessagingPage() {
    const toast = useToast();
    const [topTab, setTopTab] = useState<'quick' | 'broadcast'>('quick');

    // Quick Send State
    const [quickTab, setQuickTab] = useState<'sms' | 'voice' | 'whatsapp'>('sms');
    const [to, setTo] = useState('');
    const [quickMessage, setQuickMessage] = useState('');
    const [quickLoading, setQuickLoading] = useState(false);

    // Broadcast State
    const [channel, setChannel] = useState<Channel>('SMS');
    const [audience, setAudience] = useState<AudienceSelection>({ audienceType: 'tag' });
    const [template, setTemplate] = useState('');
    const [campaignName, setCampaignName] = useState('');
    const [broadcastLoading, setBroadcastLoading] = useState(false);

    const handleQuickSend = async (e: React.FormEvent) => {
        e.preventDefault();
        setQuickLoading(true);
        try {
            if (quickTab === 'sms') {
                await api.post('/messaging/send-sms', { to, message: quickMessage });
                toast.success('SMS sent successfully!');
            } else if (quickTab === 'voice') {
                await api.post('/messaging/send-voice', { to, appointmentTitle: quickMessage, customerName: 'Customer', appointmentTime: 'Soon' });
                toast.success('Voice call initiated!');
            } else {
                await api.post('/messaging/send-whatsapp', { to, message: quickMessage });
                toast.success('WhatsApp message sent!');
            }
            setTo('');
            setQuickMessage('');
        } catch (err: any) {
            if (err?.response?.status !== 403) {
                toast.error(err?.response?.data?.message || 'Send failed. Please try again.');
            }
        } finally {
            setQuickLoading(false);
        }
    };

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!audience.audienceType) return toast.error('Please select an audience type');
        if (audience.audienceType !== 'contact' && audience.audienceType !== 'contacts' && !audience.audienceId) return toast.error('Please select an audience target');
        if (audience.audienceType === 'contact' && !audience.audienceId) return toast.error('Please select a contact');
        if (audience.audienceType === 'contacts' && (!audience.audienceIds || audience.audienceIds.length === 0)) return toast.error('Please select at least one contact');
        if (!template.trim()) return toast.error('Please enter a message template');

        setBroadcastLoading(true);
        try {
            const res = await api.post('/messaging/broadcast', {
                channel,
                audienceType: audience.audienceType,
                audienceId: audience.audienceId,
                audienceIds: audience.audienceIds,
                responseStatus: audience.responseStatus,
                template,
                campaignName: campaignName.trim() || undefined,
            });
            
            if (res.data.mode === 'queued') {
                toast.success(`Broadcasting... ${res.data.dispatched} messages queued for background delivery.`);
            } else {
                toast.success(`Broadcast complete! Sent: ${res.data.sent}, Failed: ${res.data.failed}`);
            }
            
            // reset form
            setTemplate('');
            setCampaignName('');
            setAudience({ audienceType: 'tag' });
        } catch (err: any) {
            if (err?.response?.status !== 403) {
                toast.error(err?.response?.data?.message || 'Broadcast failed.');
            }
        } finally {
            setBroadcastLoading(false);
        }
    };

    const quickTabs = [
        { id: 'sms', icon: <Icon icon={faComment} className="w-4 h-4" />, label: 'SMS' },
        { id: 'voice', icon: <Icon icon={faPhone} className="w-4 h-4" />, label: 'Voice Call' },
        { id: 'whatsapp', icon: <Icon icon={faWhatsapp} className="w-4 h-4" />, label: 'WhatsApp' },
    ];

    return (
        <div style={{ paddingBottom: 64 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Messaging</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Send manual reminders or blast to large audiences</p>
                </div>
            </div>

            {/* Top Level Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 32, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
                <button
                    onClick={() => setTopTab('quick')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 24px', borderRadius: 8, fontSize: 15, fontWeight: topTab === 'quick' ? 600 : 500,
                        background: topTab === 'quick' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                        color: topTab === 'quick' ? '#3b82f6' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.2s', border: 'none'
                    }}
                >
                    <Icon icon={faBolt} /> Quick Send
                </button>
                <button
                    onClick={() => setTopTab('broadcast')}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 24px', borderRadius: 8, fontSize: 15, fontWeight: topTab === 'broadcast' ? 600 : 500,
                        background: topTab === 'broadcast' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
                        color: topTab === 'broadcast' ? '#8b5cf6' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'all 0.2s', border: 'none'
                    }}
                >
                    <Icon icon={faBullhorn} /> Broadcast
                </button>
            </div>

            {topTab === 'quick' ? (
                <div className="glass-card" style={{ maxWidth: 520, padding: '28px clamp(16px, 4vw, 32px)' }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: '#0d0d10', borderRadius: 10, padding: 4, width: 'fit-content' }}>
                        {quickTabs.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setQuickTab(t.id as any)}
                                style={{
                                    background: quickTab === t.id ? '#1e1e28' : 'transparent',
                                    border: quickTab === t.id ? '1px solid #2a2a35' : '1px solid transparent',
                                    borderRadius: 8, padding: '8px 20px', cursor: 'pointer',
                                    color: quickTab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontWeight: quickTab === t.id ? 600 : 400, fontSize: 14,
                                    transition: 'all 0.15s',
                                }}
                            >{t.icon} {t.label}</button>
                        ))}
                    </div>

                    <form onSubmit={handleQuickSend}>
                        <div className="form-group">
                            <label className="form-label">Recipient Phone Number</label>
                            <input
                                className="form-input"
                                type="tel"
                                value={to}
                                onChange={e => setTo(e.target.value)}
                                placeholder="+2348012345678"
                                title="Enter the recipient's mobile number in international format."
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                {quickTab === 'voice' ? 'Appointment Title' : 'Message'}
                            </label>
                            <textarea
                                className="form-input"
                                value={quickMessage}
                                onChange={e => setQuickMessage(e.target.value)}
                                placeholder={quickTab === 'voice' ? 'e.g. Dental Checkup' : 'Your appointment reminder...'}
                                rows={4}
                                title="Enter the content of your message or the appointment title."
                                required
                                style={{ resize: 'vertical', fontFamily: 'inherit' }}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={quickLoading}>
                            {quickLoading ? 'Sending...' : `Send ${quickTabs.find(t => t.id === quickTab)?.label}`}
                        </button>
                    </form>
                </div>
            ) : (
                <form onSubmit={handleBroadcast}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 400px', gap: 32, alignItems: 'flex-start' }}>
                        
                        {/* Left Column: Form */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <div className="card">
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>1. Select Channel</h3>
                                <ChannelSelector value={channel} onChange={setChannel} />
                            </div>

                            <div className="card">
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>2. Select Audience</h3>
                                <AudienceSelector value={audience} onChange={setAudience} />
                            </div>

                            <div className="card">
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>3. Compose Template</h3>
                                <MessageEditor value={template} onChange={setTemplate} channel={channel} />
                            </div>

                            <div className="card">
                                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>4. Dispatch Settings (Optional)</h3>
                                <div className="input-group" style={{ marginBottom: 0 }}>
                                    <label className="input-label">Internal Campaign Name</label>
                                    <input 
                                        className="input" 
                                        value={campaignName} 
                                        onChange={e => setCampaignName(e.target.value)} 
                                        placeholder="e.g. Summer Promo 2026" 
                                        title="Give this broadcast a name for internal tracking."
                                    />
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                        Used to track delivery performance in the Campaigns tab.
                                    </div>
                                </div>
                            </div>
                            
                            <button type="submit" className="btn btn-primary" style={{ padding: '16px 24px', fontSize: 16 }} disabled={broadcastLoading}>
                                {broadcastLoading ? 'Broadcasting...' : 'Send Broadcast'}
                            </button>
                        </div>

                        {/* Right Column: Dynamic Live Preview */}
                        <div style={{ position: 'sticky', top: 24 }}>
                            <MessagePreview template={template} previewName={audience.audienceType === 'contact' ? audience.displayData?.name : 'John Doe'} />
                        </div>

                    </div>
                </form>
            )}
        </div>
    );
}
