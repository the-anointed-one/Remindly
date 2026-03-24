import { useMemo } from 'react';
import Icon from '@/components/ui/Icon';
import { 
    faUser, faCalendar, faComment, faPhone, 
    faStar, faTag, faUsers, faBullhorn, faCheckCircle, faTimesCircle
} from '@fortawesome/free-solid-svg-icons';
import { faWhatsapp } from '@fortawesome/free-brands-svg-icons';

export interface Activity {
    id: string;
    type: string;
    description: string;
    createdAt: string;
    metadata?: any;
}

interface Props {
    activities: Activity[];
}

export default function ContactTimeline({ activities }: Props) {
    // Group activities by date (e.g. "May 4, 2026")
    const grouped = useMemo(() => {
        const groups: Record<string, Activity[]> = {};
        activities.forEach(a => {
            const dateStr = new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(a);
        });
        return groups;
    }, [activities]);

    const getIconConfig = (type: string) => {
        switch (type) {
            case 'CREATED': return { icon: faUser, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' };
            case 'APPOINTMENT_SCHEDULED':
            case 'appointment_created': 
                return { icon: faCalendar, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)' };
            case 'APPOINTMENT_RESCHEDULED':
            case 'appointment_rescheduled':
                return { icon: faCalendar, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
            case 'APPOINTMENT_DELETED':
            case 'appointment_deleted':
                return { icon: faTimesCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
            case 'APPOINTMENT_COMPLETED': return { icon: faCheckCircle, color: '#10b981', bg: 'rgba(16,185,129,0.1)' };
            case 'APPOINTMENT_CANCELLED': return { icon: faTimesCircle, color: '#ef4444', bg: 'rgba(239,68,68,0.1)' };
            case 'MESSAGE_SENT':
            case 'MESSAGE_RECEIVED': 
            case 'reminder_sent':
                return { icon: faComment, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
            case 'WHATSAPP_SENT': return { icon: faWhatsapp, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' };
            case 'VOICE_CALL': return { icon: faPhone, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' };
            case 'REVIEW_REQUESTED': return { icon: faStar, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' };
            case 'TAG_ADDED': return { icon: faTag, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' };
            case 'GROUP_JOINED': return { icon: faUsers, color: '#ec4899', bg: 'rgba(236,72,153,0.1)' };
            case 'CAMPAIGN_ADDED': return { icon: faBullhorn, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' };
            default: return { icon: faUser, color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)' };
        }
    };

    if (activities.length === 0) {
        return (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 12 }}>
                <Icon icon={faUser} className="text-muted" />
                <p>No activity yet.</p>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', paddingLeft: 16 }}>
            {/* Vertical timeline line */}
            <div style={{ position: 'absolute', top: 12, bottom: 0, left: 31, width: 2, background: 'var(--border-color)', zIndex: 0 }} />

            {Object.entries(grouped).map(([date, items]) => (
                <div key={date} style={{ marginBottom: 32 }}>
                    <div style={{ 
                        fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', 
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                        marginBottom: 16, paddingLeft: 48 
                    }}>
                        {date}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                        {items.map(activity => {
                            const config = getIconConfig(activity.type);
                            return (
                                <div key={activity.id} style={{ display: 'flex', gap: 16, position: 'relative', zIndex: 1 }}>
                                    {/* Icon badge */}
                                    <div style={{ 
                                        width: 32, height: 32, borderRadius: '50%', 
                                        background: config.bg, color: config.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        flexShrink: 0, border: '2px solid var(--bg-body)'
                                    }}>
                                        <Icon icon={config.icon} />
                                    </div>
                                    
                                    {/* Content Card */}
                                    <div style={{ 
                                        flex: 1, background: 'var(--bg-layer-1)', border: '1px solid var(--border-color)',
                                        borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                                            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>
                                                {activity.description}
                                            </span>
                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {new Date(activity.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
