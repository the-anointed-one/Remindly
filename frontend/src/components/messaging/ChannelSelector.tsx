import Icon from '@/components/ui/Icon';
import { faComment, faPhone, faEnvelope } from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';
import { Tooltip } from '@/components/ui/Tooltip';

export type Channel = 'SMS' | 'WHATSAPP' | 'VOICE' | 'EMAIL';

interface Props {
    value: Channel;
    onChange: (channel: Channel) => void;
}

export default function ChannelSelector({ value, onChange }: Props) {
    const channels = [
        { id: 'SMS', icon: faComment, label: 'SMS', tip: 'Universal delivery to any mobile phone.' },
        { id: 'WHATSAPP', icon: faWhatsapp, label: 'WhatsApp', tip: 'Rich messaging directly to WhatsApp.' },
        { id: 'VOICE', icon: faPhone, label: 'Voice Call', tip: 'Automated text-to-speech phone call.' },
        { id: 'EMAIL', icon: faEnvelope, label: 'Email', tip: 'Send to the contact\'s email address.' },
    ];

    return (
        <div style={{ display: 'flex', gap: 6, background: '#0d0d10', padding: 4, borderRadius: 10, width: 'fit-content' }}>
            {channels.map((c) => (
                <Tooltip key={c.id} content={c.tip} placement="bottom" maxWidth={200}>
                    <button
                        type="button"
                        onClick={() => onChange(c.id as Channel)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: value === c.id ? '#1e1e28' : 'transparent',
                            border: value === c.id ? '1px solid #2a2a35' : '1px solid transparent',
                            padding: '8px 16px', borderRadius: 8, fontSize: 14,
                            fontWeight: value === c.id ? 600 : 400,
                            color: value === c.id ? 'var(--text-primary)' : 'var(--text-muted)',
                            transition: 'all 0.2s', cursor: 'pointer'
                        }}
                    >
                        <Icon icon={c.icon} className="w-4 h-4" />
                        {c.label}
                    </button>
                </Tooltip>
            ))}
        </div>
    );
}
