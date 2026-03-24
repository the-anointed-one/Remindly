import Icon from '@/components/ui/Icon';
import { faEye } from '@fortawesome/free-solid-svg-icons';

interface Props {
    template: string;
    previewName?: string;
}

export default function MessagePreview({ template, previewName = 'John Doe' }: Props) {
    const renderPreview = () => {
        let msg = template || 'Type a message to see the preview...';
        
        const first = previewName.split(' ')[0] || 'John';
        const last = previewName.split(' ')[1] || 'Doe';

        msg = msg.replace(/\{\{first_name\}\}/g, first);
        msg = msg.replace(/\{\{last_name\}\}/g, last);
        msg = msg.replace(/\{\{phone\}\}/g, '+1 (555) 012-3456');
        msg = msg.replace(/\{\{email\}\}/g, `${first.toLowerCase()}@example.com`);
        msg = msg.replace(/\{\{appointment_date\}\}/g, 'Tomorrow');
        msg = msg.replace(/\{\{appointment_time\}\}/g, '3:00 PM');
        msg = msg.replace(/\{\{business_name\}\}/g, 'Acme Clinic');
        
        // Handle legacy or undefined vars
        msg = msg.replace(/\{\{customer_name\}\}/g, previewName);
        msg = msg.replace(/\{\{contact_name\}\}/g, previewName);

        return msg;
    };

    return (
        <div style={{
            background: 'var(--bg-layer-2)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{
                background: 'rgba(255,255,255,0.03)',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontSize: 13, fontWeight: 600, color: 'var(--text-muted)'
            }}>
                <Icon icon={faEye} /> Preview for: <span style={{ color: 'var(--text-primary)' }}>{previewName}</span>
            </div>
            <div style={{ 
                padding: 16, 
                fontSize: 14, 
                lineHeight: 1.5, 
                color: template ? 'var(--text-primary)' : 'var(--text-muted)',
                whiteSpace: 'pre-wrap'
            }}>
                {renderPreview()}
            </div>
        </div>
    );
}
