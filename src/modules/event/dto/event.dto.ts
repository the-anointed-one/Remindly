import {
  IsString,
  IsOptional,
  IsEnum,
  IsDateString,
  IsArray,
  IsUUID,
  IsObject,
  IsIn,
} from 'class-validator';
import { EventType } from '@prisma/client';

// Keep backward compatibility with local enum if needed,
// but use Prisma enum for class validation.
export enum EventTypeDto {
  APPOINTMENT = 'APPOINTMENT',
  MEETING = 'MEETING',
  WEBINAR = 'WEBINAR',
  TRAINING = 'TRAINING',
  CONSULTATION = 'CONSULTATION',
  OTHER = 'OTHER',
}

export class CreateEventDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsDateString()
  startTime: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds?: string[];

  @IsOptional()
  @IsObject()
  automationSettings?: {
    remindNonResponders?: boolean;
    sendLocationOnConfirm?: boolean;
    sendFollowupAfter?: boolean;
  };

  @IsString()
  @IsOptional()
  @IsIn(['none', 'discount', 'cashback'])
  incentiveType?: string;

  @IsString()
  @IsOptional()
  incentiveValue?: string;

  @IsString()
  @IsOptional()
  incentiveMessage?: string;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsDateString()
  endTime?: string;

  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds?: string[];

  @IsOptional()
  @IsObject()
  automationSettings?: {
    remindNonResponders?: boolean;
    sendLocationOnConfirm?: boolean;
    sendFollowupAfter?: boolean;
  };

  @IsOptional()
  @IsString()
  status?: string;

  @IsString()
  @IsOptional()
  @IsIn(['none', 'discount', 'cashback'])
  incentiveType?: string;

  @IsString()
  @IsOptional()
  incentiveValue?: string;

  @IsString()
  @IsOptional()
  incentiveMessage?: string;
}

export class InviteContactsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  contactIds: string[];
}

export class RecordResponseDto {
  @IsUUID('4')
  contactId: string;

  @IsString()
  response: string;

  @IsOptional()
  @IsUUID('4')
  eventId?: string;
}

export class BroadcastDto {
  @IsArray()
  @IsUUID('4', { each: true })
  participantIds: string[];

  @IsString()
  message: string;
}

export class ReplaceParticipantDto {
  @IsUUID()
  oldParticipantId: string;

  @IsUUID()
  newContactId: string;
}

// ── Smart Reminders ────────────────────────

export interface SmartReminderDto {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone?: string;
  contactEmail?: string;
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  channel: 'SMS' | 'VOICE' | 'EMAIL' | 'WHATSAPP';
  scheduledSendTime: Date;
  sentAt?: Date;
  messageContent: string;
  reminderRuleName?: string;
}

export interface SmartRemindersResponseDto {
  eventId: string;
  eventTitle: string;
  eventStartTime: Date;
  totalReminders: number;
  pending: SmartReminderDto[];
  sent: SmartReminderDto[];
  failed: SmartReminderDto[];
  recommendations: string[];
}
