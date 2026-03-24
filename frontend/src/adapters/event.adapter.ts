export interface AppointmentDTO {
    id: string;
    title: string;
    scheduledAt: string;
    durationMinutes?: number;
    status: string;
    notes?: string | null;
    customer?: { id: string; firstName?: string; lastName?: string; phone?: string | null; email?: string | null } | null;
    location?: { id: string; name: string; address?: string | null } | null;
    isDemoData?: boolean;
    reminders?: Array<{ id: string; channel: string; sendTime: string; status: string; message?: string | null }>;
    participants?: Array<any>;
}

export interface EventItemDTO {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: string;
    endTime: string | null;
    status: string;
    eventType: string;
    isDemoData: boolean;
    _count: { participants: number; responses: number };
}

export function mapAppointmentToEvent(apt: AppointmentDTO): EventItemDTO {
    return {
        id: apt.id,
        title: apt.title,
        description: apt.notes || null,
        location: apt.location?.name || null,
        startTime: apt.scheduledAt,
        endTime: apt.durationMinutes ? new Date(new Date(apt.scheduledAt).getTime() + apt.durationMinutes * 60000).toISOString() : null,
        status: apt.status,
        eventType: 'APPOINTMENT',
        isDemoData: !!apt.isDemoData,
        _count: {
            participants: apt.participants?.length ?? 0,
            responses: apt.reminders?.length ?? 0,
        },
    };
}

export interface AppointmentDetailDTO extends AppointmentDTO {
    responses?: Array<any>;
}

export interface EventDetailDTO {
    id: string;
    title: string;
    description: string | null;
    location: string | null;
    startTime: string;
    endTime: string | null;
    status: string;
    eventType: string;
    isDemoData: boolean;
    participants: Array<any>;
    responses: Array<any>;
    appointments: Array<any>;
}

export function mapAppointmentDetailToEventDetail(apt: AppointmentDetailDTO): EventDetailDTO {
    return {
        id: apt.id,
        title: apt.title,
        description: apt.notes || null,
        location: apt.location?.name || null,
        startTime: apt.scheduledAt,
        endTime: apt.durationMinutes ? new Date(new Date(apt.scheduledAt).getTime() + apt.durationMinutes * 60000).toISOString() : null,
        status: apt.status,
        eventType: 'APPOINTMENT',
        isDemoData: !!apt.isDemoData,
        participants: apt.participants || [],
        responses: apt.responses || [],
        appointments: [],
    };
}
