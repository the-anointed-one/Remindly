import { useRef } from 'react';
import { Channel } from './ChannelSelector';

interface Props {
    value: string;
    onChange: (val: string) => void;
    channel: Channel;
}

const VARIABLES = [
    { key: 'first_name', label: 'First Name' },
    { key: 'last_name', label: 'Last Name' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    { key: 'company', label: 'Company' },
    { key: 'event_name', label: 'Event Name' },
    { key: 'appointment_date', label: 'Appt Date' },
    { key: 'appointment_time', label: 'Appt Time' },
    { key: 'location', label: 'Location' },
    { key: 'business_name', label: 'Business Name' },
];

export default function MessageEditor({ value, onChange, channel }: Props) {
    const textRef = useRef<HTMLTextAreaElement>(null);

    const insertVar = (v: string) => {
        const token = `{{${v}}}`;
        const input = textRef.current;
        if (!input) {
            onChange(value + token);
            return;
        }
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const newValue = value.substring(0, start) + token + value.substring(end);
        onChange(newValue);
        
        // Restore focus and cursor position after React re-renders
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(start + token.length, start + token.length);
        }, 0);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8, alignSelf: 'center' }}>Insert Variable:</span>
                {VARIABLES.map(v => (
                    <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVar(v.key)}
                        style={{
                            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: 4, padding: '2px 8px', fontSize: 12, color: 'var(--text-primary)',
                            cursor: 'pointer', transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    >
                        {`{{${v.key}}}`}
                    </button>
                ))}
            </div>

            <textarea
                ref={textRef}
                className="form-input"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder="Write your message here..."
                rows={5}
                style={{ resize: 'vertical', fontFamily: 'inherit' }}
            />

            {channel === 'SMS' && (
                <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                    {value.length}/160 
                    {value.length > 160 && ` (${Math.ceil(value.length / 160)} parts)`}
                </div>
            )}
        </div>
    );
}
