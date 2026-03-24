import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
  IsIn,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export const TRIGGER_TYPES = [
  // Appointment triggers
  'appointment_created',
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_completed',
  // Event triggers
  'event_created',
  'event_published',
  'event_completed',
  'event_cancelled',
  // Attendance/RSVP triggers
  'attendance_confirmed',
  'attendance_cancelled',
  'rsvp_received',
  'rsvp_yes',
  'rsvp_no',
  // Other triggers
  'review_received',
  'client_inactive',
] as const;

export const ACTION_TYPES = [
  'send_sms',
  'send_whatsapp',
  'send_voice',
  'send_email',
  'generate_ai_message',
  'request_review',
  'add_tag',
] as const;

export const CONDITION_TYPES = [
  'appointment_status_is',
  'event_status_is',
  'participant_status_is',
  'customer_tag_has',
  'customer_unsubscribed',
  'time_of_day_between',
  'rsvp_status_is',
] as const;

export type TriggerType = (typeof TRIGGER_TYPES)[number];
export type ActionType = (typeof ACTION_TYPES)[number];
export type ConditionType = (typeof CONDITION_TYPES)[number];

export class WorkflowTriggerDto {
  @IsIn(TRIGGER_TYPES)
  type: TriggerType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}

export class WorkflowConditionDto {
  @IsIn(CONDITION_TYPES)
  conditionType: ConditionType;

  @IsOptional()
  @IsString()
  operator?: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsString()
  actionId?: string; // gate before this specific action; null = global
}

export class WorkflowActionDto {
  @IsInt()
  @Min(0)
  stepOrder: number;

  @IsIn(ACTION_TYPES)
  type: ActionType;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(0)
  delayMinutes?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowConditionDto)
  conditions?: WorkflowConditionDto[];
}

export class CreateWorkflowDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ValidateNested()
  @Type(() => WorkflowTriggerDto)
  trigger: WorkflowTriggerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowActionDto)
  actions: WorkflowActionDto[];
}

export class UpdateWorkflowDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowTriggerDto)
  trigger?: WorkflowTriggerDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowActionDto)
  actions?: WorkflowActionDto[];
}
